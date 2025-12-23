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

### 3. 权限验证

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

**用户代码示例**：
```rust
use axfs::api::File;

// 方式 1：创建新文件（打开时会截断）
let mut file = File::create("/tmp/output.txt")?;
let data = b"Hello, World!";
let bytes_written = file.write(data)?;
file.flush()?;

// 方式 2：使用 OpenOptions 更精细控制
let opts = File::options()
    .write(true)
    .append(true)
    .create(true);
let mut file = opts.open("/var/log/app.log")?;
file.write(b"App started\n")?;
```

**调用链**：
```
File::create(path)
  └─> OpenOptions::write(true).create(true).truncate(true).open()
      └─> fops::File::open(path, opts)
          └─> fops::File::_open_at(dir, path, opts)
```

**关键说明**：
- `File::create()` 本身不是独立的入口，而是通过 `OpenOptions` 配置后调用 `open()`
- `create()` 等价于配置了 `write=true`、`create=true`、`truncate=true` 的 `OpenOptions`
- 文件打开流程与读取流程共享相同的路径解析和权限验证机制

### 2. 文件打开流程（路径解析与权限验证）

**位置**：`src/fops.rs`, lines 122-156

文件打开是写入流程的第一步，涉及完整的路径解析和权限验证：

```rust
fn _open_at(dir: Option<&VfsNodeRef>, path: &str, opts: &OpenOptions) -> AxResult<Self> {
    debug!("open file: {} {:?}", path, opts);

    // 步骤 1：验证 OpenOptions 有效性
    if !opts.is_valid() {
        return ax_err!(InvalidInput);
    }

    // 步骤 2：路径查找（路径解析）
    let node_option = crate::root::lookup(dir, path);
    let node = if opts.create || opts.create_new {
        // 模式 A：创建新文件
        match node_option {
            Ok(node) => {
                // 文件已存在
                if opts.create_new {
                    // create_new 模式：文件已存在则报错
                    return ax_err!(AlreadyExists);
                }
                // 普通打开已存在文件
                node
            }
            Err(VfsError::NotFound) => {
                // 文件不存在，需要创建新文件
                crate::root::create_file(dir, path)?
            }
            Err(e) => return Err(e),
        }
    } else {
        // 模式 B：仅打开现有文件（不创建）
        node_option?
    };

    // 步骤 3：获取文件属性
    let attr = node.get_attr()?;

    // 步骤 4：检查文件类型
    if attr.is_dir()
        && (opts.create || opts.create_new || opts.write || opts.append || opts.truncate)
    {
        return ax_err!(IsADirectory);
    }

    // 步骤 5：权限验证
    let access_cap = opts.into();  // 从 OpenOptions 提取所需权限
    if !perm_to_cap(attr.perm()).contains(access_cap) {
        return ax_err!(PermissionDenied);
    }

    // 步骤 6：打开节点（某些文件系统需要初始化资源）
    node.open()?;

    // 步骤 7：截断文件（如果设置了 truncate）
    if opts.truncate {
        node.truncate(0)?;
    }

    // 步骤 8：创建 fops::File 对象，封装权限令牌
    Ok(Self {
        node: WithCap::new(node, access_cap),
        is_append: opts.append,
        offset: 0,
    })
}
```

### 3. 文件创建操作

**位置**：`src/root.rs`, lines 465-470

当文件不存在且设置了 `create=true` 时，会调用 `create_file()` 创建新文件：

```rust
pub(crate) fn create_file(dir: Option<&VfsNodeRef>, path: &str) -> AxResult<VfsNodeRef> {
    // 步骤 1：路径有效性检查
    if path.is_empty() {
        return ax_err!(NotFound);
    } else if path.ends_with('/') {
        return ax_err!(NotADirectory);
    }

    // 步骤 2：获取父目录节点
    let parent = parent_node_of(dir, path);

    // 步骤 3：在父目录中创建文件节点
    parent.create(path, VfsNodeType::File)?;

    // 步骤 4：查找刚创建的文件节点
    parent.lookup(path)
}
```

**文件创建调用链**：
```
create_file(None, "/tmp/output.txt")
    ↓
1. 路径检查："/tmp/output.txt" 有效
    ↓
2. parent_node_of()

// 获取当前目录或从路径解析父目录
CURRENT_DIR.lookup("/tmp") 或 ROOT_DIR.lookup("/")
    ↓
递归查找父目录
    ↓
返回父目录节点 (VfsNodeRef)
    ↓
3. parent.create("output.txt", VfsNodeType::File)
    ↓
[文件系统实现]
ext4:
  mkfile(inner, fs, "output.txt", ...)
    ↓
  创建 inode，设置类型为文件

fatfs:
  FatFileSystem::create_file("output.txt")
    ↓
  创建 FAT 文件表项
    ↓
4. parent.lookup("output.txt")
    ↓
返回新创建的文件节点
```

### 4. 文件写入操作

**位置**：`src/fops.rs`, lines 154-167

文件打开后，`write()` 方法负责将数据写入文件：

```rust
pub fn write(&mut self, buf: &[u8]) -> AxResult<usize> {
    // 步骤 1：确定写入位置
    let offset = if self.is_append {
        // 追加模式：写入位置 = 文件当前大小
        self.get_attr()?.size()
    } else {
        // 普通模式：写入位置 = 当前游标位置
        self.offset
    };

    // 步骤 2：权限快速验证（使用 WithCap 封装的权限令牌）
    let node = self.access_node(Cap::WRITE)?;

    // 步骤 3：调用 VFS 层执行写入
    let write_len = node.write_at(offset, buf)?;

    // 步骤 4：更新游标位置
    self.offset = offset + write_len as u64;

    Ok(write_len)
}
```

**写入模式对比**：

| 模式 | `is_append` | `offset` 计算 | 行为 |
|------|-------------|---------------|------|
| **普通写入** | `false` | `self.offset` | 从游标位置写入，写入后游标前进 |
| **追加写入** | `true` | `file_size` | 从文件末尾写入，忽略原游标 |
| **随机写入** | `false` | 调用 `seek()` 后再 `write()` | 通过 seek() 设置游标，再写入 |

### 5. 权限令牌快速验证

**位置**：`src/fops.rs`, lines 170-173

与读取流程相同，写入操作也使用 `WithCap` 封装的权限令牌进行快速验证：

```rust
pub fn access_node(&self, cap: Cap) -> AxResult<&VfsNodeRef> {
    self.node.access_or_err(cap, AxError::PermissionDenied)
}

// WithCap::access_or_err 实现
pub fn access_or_err(&self, cap: Cap, error: E) -> Result<&T, E> {
    if !self.cap.contains(cap) {
        Err(error)  // 权限不匹配
    } else {
        Ok(&self.inner)  // 权限匹配，返回内部节点
    }
}
```

**优势**：
- **无需重复遍历**：打开时已捕获权限令牌，后续每次操作只需进行位运算检查
- **零额外开销**：`contains()` 是简单的位运算，无需查找或解析
- **安全性**：权限令牌在打开时绑定，无法在运行时更改

### 6. ext4 文件系统写入

**位置**：`src/fs/ext4fs.rs`, lines 401-412

VFS 层的 `write_at()` 委托给 ext4 实现的 `FileWrapper`：

```rust
impl VfsNodeOps for FileWrapper {
    fn write_at(&self, offset: u64, buf: &[u8]) -> VfsResult<usize> {
        debug!(
            "write_at ext4: path={}, offset={}, len={}",
            self.path, offset, buf.len()
        );

        // 需加锁保护文件系统访问
        let mut fs = self.fs.lock();
        match self.inner {
            Ext4Inner::Partition(ref inner) => {
                let mut inner = inner.lock();
                // 调用 rsext4 的 write_file 函数
                write_file(&mut *inner, &mut *fs, &self.path, offset, buf)
                    .map_err(|_| VfsError::Io)?;
            }
            Ext4Inner::Disk(ref inner) => {
                let mut inner = inner.lock();
                write_file(&mut *inner, &mut *fs, &self.path, offset, buf)
                    .map_err(|_| VfsError::Io)?;
            }
        }
        Ok(buf.len())  // 返回写入的字节数
    }
}
```

### 7. ext4 写入内部逻辑

**位置**：rsext4 crate 内部

`write_file()` 是 ext4 文件系统的核心写入函数，处理块分配、缓存管理和元数据更新：

```rust
// rsext4 crate 内部实现（伪代码）
pub fn write_file(
    dev: &mut Jbd2Dev<Partition>,
    fs: &mut Rsext4FileSystem,
    path: &str,
    offset: u64,
    buf: &[u8]
) -> Result<()> {
    // 阶段 1：查找或获取 inode
    let inode = get_inode_with_num(dev, fs, path)?;

    // 阶段 2：扩展文件大小（如果写入位置超出当前大小）
    let new_size = offset + buf.len() as u64;
    if new_size > inode.size() {
        truncate(dev, fs, path, new_size)?;
    }

    // 阶段 3：按块循环写入数据
    let mut write_offset = offset;
    let mut buf_pos = 0;
    const BLOCK_SIZE: usize = 4096;

    while buf_pos < buf.len() {
        // 计算 block_index 和 block_offset
        let block_index = (write_offset / BLOCK_SIZE as u64) as usize;
        let block_offset = (write_offset % BLOCK_SIZE as u64) as usize;

        // 分配物理块号（如果尚未分配）
        let phys_block = alloc_block(dev, fs, inode, block_index)?;

        // 获取缓存块
        let block_cache = fs.datablock_cache.get_or_load(dev, phys_block)?;

        // 判断是写入完整块还是部分块
        if block_offset != 0 || buf.len() - buf_pos < BLOCK_SIZE {
            // 部分块：读-改-写模式
            let mut block = block_cache.data.clone();
            let write_len = BLOCK_SIZE.min(block_offset + buf.len() - buf_pos) - block_offset;

            // 读取原有数据 + 写入新数据
            block[block_offset..][..write_len].copy_from_slice(
                &buf[buf_pos..][..write_len]
            );

            // 标记缓存块为脏
            block_cache.dirty = true;
            block_cache.data = block;
        } else {
            // 完整块：直接写入
            block_cache.data.copy_from_slice(&buf[buf_pos..][..BLOCK_SIZE]);
            block_cache.dirty = true;
        }

        write_offset += BLOCK_SIZE as u64;
        buf_pos += BLOCK_SIZE;
    }

    // 阶段 4：更新 inode 元数据
    update_inode_metadata(dev, fs, inode)?;

    Ok(())
}
```

### 8. 设备访问层

**Partition 层写入**：

**位置**：`src/dev.rs`, Partition 实现

```rust
// Partition 通过转发到 Disk 实现 write_one
impl Partition {
    pub fn write_one(&mut self, buf: &[u8]) -> DevResult<usize> {
        // 计算相对于 Disk 的绝对位置
        // self.inner 是 Arc<Disk>，直接转发
        self.inner.write_one(buf)
    }
}
```

**Disk 层块写入**：

**位置**：`src/dev.rs`, lines 73-91

```rust
impl Disk {
    pub fn write_one(&mut self, buf: &[u8]) -> DevResult<usize> {
        let write_size = if self.offset == 0 && buf.len() >= BLOCK_SIZE {
            // 优化：写入完整块
            let mut dev = self.dev.lock();
            dev.write_block(self.block_id, &buf[0..BLOCK_SIZE])?;
            self.block_id += 1;  // 前进块号
            BLOCK_SIZE
        } else {
            // 部分：读-改-写（与 ext4 逻辑类似，但更底层）
            let mut data = [0u8; BLOCK_SIZE];
            let start = self.offset;
            let count = buf.len().min(BLOCK_SIZE - self.offset);

            // 先读取整个块
            {
                let mut dev = self.dev.lock();
                dev.read_block(self.block_id, &mut data)?;
            }

            // 修改数据
            data[start..start + count].copy_from_slice(&buf[..count]);

            // 写回块
            {
                let mut dev = self.dev.lock();
                dev.write_block(self.block_id, &data)?;
            }

            // 更新游标
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

### 9. 刷新操作

**位置**：`src/fops.rs`, lines 183-186

**位置**：`src/fops.rs`, flush 实现

```rust
pub fn flush(&self) -> AxResult {
    // 步骤 1：权限验证
    self.access_node(Cap::WRITE)?.fsync()
    // fsync 由具体文件系统实现，负责将缓存数据持久化到设备
    Ok(())
}
```

**ext4 fsync 实现**（rsext4 内部）：

```rust
// pseudo-code for ext4 fsync
impl VfsNodeOps for FileWrapper {
    fn fsync(&self) -> VfsResult {
        // 步骤 1：获取文件系统锁
        let mut fs = self.fs.lock();

        // 步骤 2：遍历 datablock_cache，找出所有脏块
        for (block_num, cached_block) in fs.datablock_cache.iter() {
            if cached_block.dirty {
                // 步骤 3：写出脏块到设备
                dev.write_block(block_num, &cached_block.data)?;

                // 步骤 4：标记为已刷新
                cached_block.dirty = false;
            }
        }

        // 步骤 5：提交 journaling 日志
        flush_journal(fs)?;

        // 步骤 6：调用设备底层的 sync
        match self.inner {
            Ext4Inner::Partition(ref inner) => {
                let mut inner = inner.lock();
                inner.sync()?;
            }
            Ext4Inner::Disk(ref inner) => {
                let mut inner = inner.lock();
                inner.sync()?;
            }
        }

        Ok(())
    }
}
```
