---
sidebar_position: 6
---

# 读写流程

本节详细描述 AXFS 组件中文件读写操作的完整调用链路，剖析从上层 API 到底层设备接口的所有中间环节

## 调用链路层次

```
User Application
       ↓
High-level API (api::File)
       ↓
Low-level Operations (fops::File)
       ↓
Root Directory (RootDirectory)
       ↓
VFS Abstraction (VfsNodeOps)
       ↓
Filesystem Implementation (ext4fs/FAT/ramfs)
       ↓
Device Layer (Partition/Disk)
       ↓
Block Device (AxBlockDevice)
```

## 核心数据结构

### 文件描述符链

```rust
// 高层 API（用户可见）
api::File {
    inner: fops::File  // 持有底层文件对象
}

// 低层操作（带权限）
fops::File {
    node: WithCap<VfsNodeRef>,  // 带权限令牌的 VFS 节点
    is_append: bool,            // 追加模式标志
    offset: u64,                // 文件游标位置
}

// VFS 节点（具体实现）
VfsNodeRef = Arc<dyn VfsNodeOps>
    ├─ ext4fs::FileWrapper
    ├─ fatfs::FileWrapper<'static>
    └─ ramfs::RamFile

// 设备层
Partition {
    inner: Arc<Disk>,       // 关联的磁盘
    start_lba: u64,         // 起始扇区
    end_lba: u64,           // 结束扇区
}
Disk {
    block_id: u64,          // 当前块号
    offset: usize,           // 块内偏移
    dev: Arc<Mutex<AxBlockDevice>>,
}
```

### 权限模型

```rust
// 能力令牌
pub enum Cap {
    READ    = 0b001,
    WRITE   = 0b010,
    EXEC    = 0b100,
    empty() = 0b000,
}

// 带权限的包装器
pub struct WithCap<T> {
    inner: T,
    cap: Cap,
}
```

## 文件读取流程

### 1. 高层 API 调用

**用户代码**：
```rust
use axfs::api::File;

let mut file = File::open("/etc/hostname")?;
let mut buffer = [0u8; 1024];
let bytes_read = file.read(&mut buffer)?;
```

**调用链**：
```
api::File::read()
  └─> Read trait 实现
      └─> fops::File::read()
```

### 2. 低层操作层

**位置**：`src/fops.rs`, lines 143-152

```rust
// fops::File::read 实现
pub fn read(&mut self, buf: &mut [u8]) -> AxResult<usize> {
    let node = self.access_node(Cap::READ)?;  // 验证读取权限
    let read_len = node.read_at(self.offset, buf)?;  // 调用 VFS 层
    self.offset += read_len as u64;  // 更新游标
    Ok(read_len)
}
```

**关键步骤**：
1. **权限验证**：`access_node(Cap::READ)` 验证当前是否拥有读取权限
2. **调用读取**：`node.read_at(self.offset, buf)` 委托给 VFS 节点
3. **更新游标**：成功读取后前进文件游标

### 3. 权限验证流程

**位置**：`src/fops.rs`, lines 108-110

```rust
fn access_node(&self, cap: Cap) -> AxResult<&VfsNodeRef> {
    self.node.access_or_err(cap, AxError::PermissionDenied)
}
```

**`WithCap::access_or_err` 逻辑**：
```rust
pub fn access_or_err(&self, cap: Cap, error: E) -> Result<&T, E> {
    if !self.cap.contains(cap) {
        Err(error)
    } else {
        Ok(&self.inner)
    }
}
```

### 4. 路径解析与查找

**文件打开时的路径解析**在 `_open_at` 中完成：

**位置**：`src/fops.rs`, lines 119-140

```rust
fn _open_at(dir: Option<&VfsNodeRef>, path: &str, opts: &OpenOptions) -> AxResult<Self> {
    // 1. 验证选项有效性
    if !opts.is_valid() {
        return ax_err!(InvalidInput);
    }

    // 2. 查找路径对应的节点
    let node_option = crate::root::lookup(dir, path);
    let node = if opts.create || opts.create_new {
        match node_option {
            Ok(node) => { /* 文件已存在 */ node }
            Err(VfsError::NotFound) => crate::root::create_file(dir, path)?,
            Err(e) => return Err(e),
        }
    } else {
        node_option?
    };

    // 3. 检查属性和权限
    let attr = node.get_attr()?;
    if attr.is_dir() && (opts.write || opts.create...) {
        return ax_err!(IsADirectory);
    }

    // 4. 验证权限并创建 File
    let access_cap = opts.into();
    if !perm_to_cap(attr.perm()).contains(access_cap) {
        return ax_err!(PermissionDenied);
    }

    // 5. 打开节点（可选截断）
    node.open()?;
    if opts.truncate {
        node.truncate(0)?;
    }

    Ok(Self {
        node: WithCap::new(node, access_cap),
        is_append: opts.append,
        offset: 0,
    })
}
```

### 5. RootDirectory 路径解析

**位置**：`src/root.rs`, lookup 调用链

```rust
// root.rs 中的 lookup 实现
pub(crate) fn lookup(dir: Option<&VfsNodeRef>, path: &str) -> VfsResult<VfsNodeRef> {
    if let Some(dir) = dir {
        dir.lookup(path)
    } else {
        ROOT_DIR.lookup(path)
    }
}
```

**RootDirectory::lookup 实现路径**：
```rust
impl VfsNodeOps for RootDirectory {
    fn lookup(self: Arc<Self>, path: &str) -> VfsResult<VfsNodeRef> {
        self.lookup_mounted_fs(path, |fs, rest_path| {
            fs.root_dir().lookup(rest_path)
        })
    }
}
```

### 6. 挂载点查找逻辑

**位置**：`src/root.rs`, lines 72-100

```rust
fn lookup_mounted_fs<F, T>(&self, path: &str, f: F) -> AxResult<T>
where
    F: FnOnce(Arc<dyn VfsOps>, &str) -> AxResult<T>,
{
    debug!("lookup at root: {}", path);
    let normalized_path = self.normalize_path(path);

    // 查找最佳匹配的挂载点（最长前缀匹配）
    if let Some((mount_fs, rest_path)) = self.find_best_mount(&normalized_path) {
        f(mount_fs, rest_path)
    } else {
        // 无挂载点匹配，使用主文件系统
        f(self.main_fs.clone(), &normalized_path)
    }
}

fn find_best_mount<'a>(&self, path: &'a str) -> Option<(Arc<dyn VfsOps>, &'a str)> {
    let mut best_match = None;
    let mut max_len = 0;

    for (i, mp) in self.mounts.iter().enumerate() {
        let mount_path = &mp.path[1..];  // 去掉前导 '/'

        if path.starts_with(mount_path) && mp.path.len() - 1 > max_len {
            max_len = mp.path.len() - 1;
            best_match = Some(i);
        }
    }

    if let Some(idx) = best_match {
        let rest_path = &path[max_len..];
        Some((self.mounts[idx].fs.clone(), rest_path))
    } else {
        None
    }
}
```

**示例**：
- 请求路径：`/mnt/data/file.txt`
- 挂载点 1：`/mnt` (fs_a)
- 挂载点 2：`/mnt/data` (fs_b)
- 匹配结果：`fs_b` + `file.txt`

### 7. ext4 文件系统读取

**位置**：`src/fs/ext4fs.rs`, lines 383-398

```rust
impl VfsNodeOps for FileWrapper {
    fn read_at(&self, offset: u64, buf: &mut [u8]) -> VfsResult<usize> {
        // 1. 获取或打开文件句柄
        let mut file_guard = self.file.lock();
        if file_guard.is_none() {
            let mut fs = self.fs.lock();
            *file_guard = match self.inner {
                Ext4Inner::Partition(ref inner) => {
                    let mut inner = inner.lock();
                    open(&mut *inner, &mut *fs, &self.path, false).ok()
                }
                // ... Disk 分支类似
            };
        }

        // 2. 执行读取
        if let Some(ref mut file) = *file_guard {
            let mut fs = self.fs.lock();
            lseek(file, offset);  // 定位到 offset
            let data = match self.inner {
                Ext4Inner::Partition(ref inner) => {
                    let mut inner = inner.lock();
                    read_at(&mut *inner, &mut *fs, file, buf.len())
                        .map_err(|_| VfsError::Io)?
                }
                // ... Disk 分支类似
            };
            let len = data.len().min(buf.len());
            buf[..len].copy_from_slice(&data[..len]);
            Ok(len)
        } else {
            Err(VfsError::NotFound)
        }
    }
}
```

### 8. ext4 设备访问

**rsext4 通过 Jbd2Dev 访问设备**：

```rust
// rsext4 内部调用（在 rsext4 crate 中）
pub fn read_at(
    dev: &mut Jbd2Dev<Partition>,
    fs: &mut Rsext4FileSystem,
    file: &mut OpenFile,
    len: usize
) -> Result<Vec<u8>> {
    // 1. 解析文件块映射
    let blocks = resolve_inode_block_allextend(fs, dev, &mut inode)?;

    // 2. 从缓存读取数据块
    for (_, phys_block) in blocks {
        let cached = fs.datablock_cache.get_or_load(dev, phys_block)?;
        // ... 提取数据
    }

    Ok(data)
}
```

**分区层转发**：

**位置**：`src/dev.rs`, Partition 实现

```rust
// Partition 通过转发到 Disk
impl Partition {
    pub fn read_one(&mut self, buf: &mut [u8]) -> DevResult<usize> {
        // 根据 start_lba 偏移转发到 disk
        let absolute_pos = self.start_lba * 512 + self.current_offset / 512;
        // ...
        self.inner.read_one(buf)
    }
}
```

**Disk 层块读取**：

**位置**：`src/dev.rs`, lines 48-71

```rust
impl Disk {
    pub fn read_one(&mut self, buf: &mut [u8]) -> DevResult<usize> {
        let read_size = if self.offset == 0 && buf.len() >= BLOCK_SIZE {
            // 读取完整块
            let mut dev = self.dev.lock();
            dev.read_block(self.block_id, &mut buf[0..BLOCK_SIZE])?;
            self.block_id += 1;
            BLOCK_SIZE
        } else {
            // 读取部分块（需先读整个块再提取）
            let mut data = [0u8; BLOCK_SIZE];
            let start = self.offset;
            let count = buf.len().min(BLOCK_SIZE - self.offset);

            {
                let mut dev = self.dev.lock();
                dev.read_block(self.block_id, &mut data)?;
            }
            buf[..count].copy_from_slice(&data[start..start + count]);
            self.offset += count;
            if self.offset >= BLOCK_SIZE {
                self.block_id += 1;
                self.offset -= BLOCK_SIZE;
            }
            count
        };
        Ok(read_size)
    }
}
```

## 文件写入流程

### 1. 高层 API 调用

**用户代码**：
```rust
use axfs::api::File;

let mut file = File::create("/tmp/output.txt")?;
let data = b"Hello, World!";
let bytes_written = file.write(data)?;
file.flush()?;
```

### 2. 低层操作层

**位置**：`src/fops.rs`, lines 154-167

```rust
pub fn write(&mut self, buf: &[u8]) -> AxResult<usize> {
    // 1. 确定写入位置
    let offset = if self.is_append {
        self.get_attr()?.size()  // 追加模式：写入文件末尾
    } else {
        self.offset               // 普通模式：使用当前游标
    };

    // 2. 执行写入
    let node = self.access_node(Cap::WRITE)?;
    let write_len = node.write_at(offset, buf)?;

    // 3. 更新游标（追加模式下需要特殊处理）
    self.offset = offset + write_len as u64;
    Ok(write_len)
}
```

### 3. ext4 文件系统写入

**位置**：`src/fs/ext4fs.rs`, lines 401-412

```rust
impl VfsNodeOps for FileWrapper {
    fn write_at(&self, offset: u64, buf: &[u8]) -> VfsResult<usize> {
        let mut fs = self.fs.lock();
        match self.inner {
            Ext4Inner::Partition(ref inner) => {
                let mut inner = inner.lock();
                write_file(&mut *inner, &mut *fs, &self.path, offset, buf)
                    .map_err(|_| VfsError::Io)?;
            }
            // ... Disk 分支类似
        }
        Ok(buf.len())
    }
}
```

### 4. ext4 写入细节

**rsext4 内部逻辑**（伪代码）：
```rust
// rsext4 crate 实现
pub fn write_file(
    dev: &mut Jbd2Dev<Partition>,
    fs: &mut Rsext4FileSystem,
    path: &str,
    offset: u64,
    buf: &[u8]
) -> Result<()> {
    // 1. 查找或创建 inode
    let inode = get_inode_with_num(dev, fs, path)?;

    // 2. 扩展文件大小（如果需要）
    if offset + buf.len() > inode.size() {
        truncate(dev, fs, path, offset + buf.len())?;
    }

    // 3. 计算写入块映射
    let mut write_offset = offset;
    let mut buf_pos = 0;
    while buf_pos < buf.len() {
        let block_offset = write_offset % 4096;
        let block_index = write_offset / 4096;

        // 分配或获取块号
        let phys_block = alloc_block(dev, fs, inode, block_index)?;

        // 4. 从缓存读取块（如果写入部分块）
        if block_offset != 0 || buf.len() - buf_pos < 4096 {
            let cached = fs.datablock_cache.get_or_load(dev, phys_block)?;
            let mut block = cached.data.clone();

            // 写入数据
            let write_len = min(4096 - block_offset, buf.len() - buf_pos);
            block[block_offset..][..write_len].copy_from_slice(&buf[buf_pos..][..write_len]);

            // 标记缓存为脏
            cached.set_dirty();
        } else {
            // 写入完整块
            let cached = fs.datablock_cache.get_mut(dev, phys_block)?;
            cached.data.copy_from_slice(&buf[buf_pos..][..4096]);
            cached.set_dirty();
        }

        write_offset += 4096;
        buf_pos += 4096;
    }

    // 5. 更新 inode 元数据
    update_inode_metadata(dev, fs, inode)?;

    Ok(())
}
```

### 5. Partition/Disk 写入

**Partition 写入**：
```rust
impl Partition {
    pub fn write_one(&mut self, buf: &[u8]) -> DevResult<usize> {
        self.inner.write_one(buf)
    }
}
```

**Disk 写入**：

**位置**：`src/dev.rs`, lines 73-91

```rust
impl Disk {
    pub fn write_one(&mut self, buf: &[u8]) -> DevResult<usize> {
        let write_size = if self.offset == 0 && buf.len() >= BLOCK_SIZE {
            // 写入完整块
            let mut dev = self.dev.lock();
            dev.write_block(self.block_id, &buf[0..BLOCK_SIZE])?;
            self.block_id += 1;
            BLOCK_SIZE
        } else {
            // 写入部分块（先读后写）
            let mut data = [0u8; BLOCK_SIZE];
            let start = self.offset;
            let count = buf.len().min(BLOCK_SIZE - self.offset);

            let mut dev = self.dev.lock();
            dev.read_block(self.block_id, &mut data)?;
            data[start..start + count].copy_from_slice(&buf[..count]);
            dev.write_block(self.block_id, &data)?;

            self.offset += count;
            if self.offset >= BLOCK_SIZE {
                self.block_id += 1;
                self.offset -= BLOCK_SIZE;
            }
            count
        };
        Ok(write_size)
    }
}
```

### 6. 刷新操作

**位置**：`src/fops.rs`, lines 183-186

```rust
pub fn flush(&self) -> AxResult {
    self.access_node(Cap::WRITE)?.fsync()?;
    Ok(())
}
```

**ext4 fsync**：
```rust
// ext4fs::FileWrapper 需要实现 fsync
fn fsync(&self) -> VfsResult {
    // rsext4 内部调用：
    // 1. 刷新所有脏缓存块
    // 2. 提交 journaling 日志
    // 3. 调用底层设备 sync
    //    - dev.sync() / dev.flush()
}
```
