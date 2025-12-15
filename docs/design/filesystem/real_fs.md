---
sidebar_position: 3
---

# 实际文件系统

## fat32文件系统

### 主要特性

- **全面的 FAT 支持**：支持 FAT12、FAT16 和 FAT32 文件系统
- **长文件名支持**：支持 LFN (Long File Name) 扩展，完全兼容 Windows 长文件名规范
- **标准 I/O 接口**：实现了标准的 Read/Write traits，与 Rust 生态系统无缝集成
- **目录操作**：支持创建、删除、重命名文件和目录
- **时间戳管理**：支持读写文件时间戳（启用 `chrono` 功能时自动更新）
- **格式化功能**：支持格式化卷，可自定义各种参数
- **no_std 支持**：基本支持 `no_std` 环境，适用于嵌入式开发
- **可配置日志**：支持通过 cargo 功能在编译时配置日志级别
- **错误处理**：提供详细的错误类型和处理机制


### 核心模块

1. **文件系统核心 (`fs.rs`)**
   - `FileSystem` 结构体：文件系统的主要接口
   - `FatType` 枚举：定义 FAT 类型（FAT12/FAT16/FAT32）
   - `FsStatusFlags` 结构体：文件系统状态标志
   - `FormatVolumeOptions` 结构体：格式化选项，可自定义文件系统参数
   - 文件系统初始化和管理功能

2. **目录管理 (`dir.rs`)**
   - `Dir` 结构体：目录操作接口
   - `DirRawStream` 枚举：目录底层数据流
   - `DirEditor` 结构体：目录编辑器，用于修改目录项
   - 目录遍历、创建和删除功能

3. **文件操作 (`file.rs`)**
   - `File` 结构体：文件操作接口
   - `Extent` 结构体：文件在磁盘上的数据范围
   - `FileEditor` 结构体：文件元数据编辑器
   - 文件读写、截断和扩展功能

4. **目录项管理 (`dir_entry.rs`)**
   - `DirEntry` 结构体：目录项接口，提供文件和目录的元数据访问
   - `DirEntryData` 枚举：目录项数据，区分文件、目录和长文件名项
   - `DirFileEntryData` 结构体：文件目录项的具体数据
   - `DirLfnEntryData` 结构体：长文件名项的具体数据
   - `ShortName` 结构体：短文件名（8.3 格式）处理
   - 短文件名和长文件名处理

5. **引导扇区 (`boot_sector.rs`)**
   - `BootSector` 结构体：引导扇区解析，包含文件系统关键信息
   - `BiosParameterBlock` 结构体：BIOS 参数块，包含文件系统几何信息
   - `FsInfo` 结构体：FAT32 文件系统信息结构
   - 文件系统元数据解析和验证
   - 引导代码和签名验证

6. **错误处理 (`error.rs`)**
   - `Error` 枚举：定义各种错误类型
   - 统一的错误处理机制
   - 错误上下文和详细信息

7. **I/O 抽象 (`io.rs`)**
   - `IoBase` trait：基础 I/O 操作
   - `Read`、`Write`、`Seek` traits：标准 I/O 接口
   - `ReadWriteSeek` trait：组合 trait，简化类型签名
   - `StdIoWrapper` 结构体：标准 I/O 类型的包装器
   - `IntoStorage` trait：类型转换 trait，简化 API 使用

8. **时间管理 (`time.rs`)**
   - `TimeProvider` trait：时间提供者接口，支持自定义时间源
   - `DateTime`、`Date`、`Time` 结构体：时间表示，与 FAT 时间格式兼容
   - `DefaultTimeProvider` 结构体：默认时间提供者
   - `ChronoTimeProvider` 结构体：基于 chrono 库的时间提供者
   - `NullTimeProvider` 结构体：空时间提供者，用于测试或无时间环境
   - 时间格式转换和时区处理.

9. **FAT 表管理 (`table.rs`)**
   - `ClusterIterator` 结构体：簇链迭代器，用于遍历文件占用的所有簇
   - FAT 表读写操作
   - 簇分配和释放算法
   - 坏簇检测和处理
   - FAT 表缓存和优化

### 高级功能

1. **文件系统格式化**

```rust
use fatfs::{format_volume, FormatVolumeOptions, FsOptions, MediaType};

// 基本格式化
let options = FormatVolumeOptions::new();
let formatted_img = format_volume(&mut img_file, options)?;

// 自定义格式化选项
let options = FormatVolumeOptions::new()
    .format_fat_type(fatfs::FatType::Fat32)  // 指定 FAT 类型
    .volume_label("MYVOLUME")                 // 设置卷标
    .bytes_per_cluster(4096)                  // 设置每簇字节数
    .media(MediaType::FixedDisk);             // 设置媒体类型

let formatted_img = format_volume(&mut img_file, options)?;
```

2. **时间戳管理**

```rust
use fatfs::{FileSystem, FsOptions};
use chrono::{Utc, DateTime};

// 创建文件系统时启用时间戳
let fs = FileSystem::new(buf_stream, FsOptions::new())?;

// 获取文件时间戳
let file = root_dir.open_file("example.txt")?;
let modified_time = file.modified();
let created_time = file.created();
let accessed_time = file.accessed();
```

3. **文件扩展信息**

```rust
// 获取文件在磁盘上的物理位置
let mut file = root_dir.open_file("large_file.bin")?;
for extent in file.extents() {
    let extent = extent?;
    println!("Offset: {}, Size: {}", extent.offset, extent.size);
}
```

4. **文件系统状态检查**

```rust
// 检查文件系统状态
let status_flags = fs.status_flags();
if status_flags.dirty() {
    println!("文件系统标记为脏，可能未正确卸载");
}
if status_flags.io_error() {
    println!("文件系统检测到 I/O 错误");
}

// 获取文件系统统计信息
let total_clusters = fs.total_clusters();
let free_clusters = fs.free_clusters()?;
let used_clusters = total_clusters - free_clusters;
println!("使用率: {:.1}%", (used_clusters as f64 / total_clusters as f64) * 100.0);
```

5. **文件属性操作**

```rust
use fatfs::FileAttributes;

let file = root_dir.open_file("important.txt")?;
let mut attrs = file.attributes();

// 检查属性
if attrs.contains(FileAttributes::READ_ONLY) {
    println!("文件为只读");
}

// 修改属性
attrs.set(FileAttributes::HIDDEN, true);  // 设置隐藏属性
attrs.set(FileAttributes::ARCHIVE, false); // 清除归档属性
file.set_attributes(attrs)?;
```

### 实现细节

#### FAT 类型检测

根据簇的数量自动确定 FAT 类型：

- FAT12: 簇数量 < 4085
- FAT16: 4085 ≤ 簇数量 < 65525
- FAT32: 簇数量 ≥ 65525

#### 长文件名处理

长文件名通过多个连续的目录项实现，每个长文件名项可以存储最多 13 个 Unicode 字符。自动处理长文件名和短文件名（8.3 格式）之间的转换。

#### 簇链管理

FAT 文件系统使用簇链来管理文件和目录的存储。提供了完整的簇链操作功能，包括分配、释放和遍历。

#### 缓存策略

建议使用缓冲流（如 `fscommon::BufStream`）来提高性能，减少底层 I/O 操作次数。

**缓存层次结构：**
1. 应用层缓存：使用 `BufStream` 缓冲 I/O 操作
2. FAT 表缓存：缓存频繁访问的 FAT 表项
3. 目录项缓存：缓存最近访问的目录项
4. 数据缓存：缓存文件数据块

**缓存一致性：**
- 实现了写回策略确保数据一致性
- 支持强制刷新机制
- 处理缓存失效和更新

## ext4文件系统

### 主要特性

- **多架构支持**：支持 x86_64、riscv64 和 aarch64 架构
- **完整文件类型支持**：常规文件、目录、软链接、FIFO、字符设备、块设备、Socket 等
- **权限管理**：支持文件的读写执行等权限控制
- **日志事务**：提供 Journal 日志事务及恢复功能
- **缓存机制**：实现 block cache 的内存缓存
- **无系统依赖**：设计为独立库，不依赖特定操作系统
- **内存安全**：利用 Rust 的所有权系统确保内存安全
- **异步支持**：为未来的异步 I/O 操作预留接口
- **可配置性**：支持编译时配置优化

### 核心组件

#### 1. Ext4BlockWrapper

`Ext4BlockWrapper` 是块设备的封装类，负责管理 ext4 文件系统的挂载、卸载和基本操作。

**主要功能：**
- 初始化和挂载 ext4 文件系统
- 管理块设备接口
- 提供文件系统统计信息
- 处理日志事务
- 缓存管理和优化
- 错误恢复机制

**关键方法：**
```rust
impl<K: KernelDevOp> Ext4BlockWrapper<K> {
    pub fn new(block_dev: K::DevType) -> Result<Self, i32>
    pub fn new_with_name(block_dev: K::DevType, dev_name: &str) -> Result<Self, i32>
    pub fn lwext4_mount(&mut self) -> Result<usize, i32>
    pub fn lwext4_umount(&mut self) -> Result<usize, i32>
    pub fn lwext4_dir_ls(&self)
    pub fn print_lwext4_mp_stats(&self)
    pub fn print_lwext4_block_stats(&self)
    pub fn ext4_set_debug(&self)
}
```

**生命周期管理：**
```rust
impl<K: KernelDevOp> Drop for Ext4BlockWrapper<K> {
    fn drop(&mut self) {
        // 自动卸载文件系统并释放资源
        self.lwext4_umount().unwrap();
        let devtype = unsafe { Box::from_raw((*(&self.value).bdif).p_user as *mut K::DevType) };
        drop(devtype);
    }
}
```

**内部状态：**
- `value`: ext4_blockdev 结构体，包含块设备信息
- `name`: 设备名称（最大16字节）
- `mount_point`: 挂载点路径（最大32字节）
- `pd`: PhantomData，用于类型安全

#### 2. Ext4File

`Ext4File` 提供文件级别的操作接口，与块设备解耦，专注于文件操作。

**主要功能：**
- 文件的打开、关闭、读取、写入
- 文件属性获取和设置
- 目录操作
- 符号链接处理
- 文件权限管理
- 扩展属性支持

**关键方法：**
```rust
impl Ext4File {
    pub fn new(path: &str, types: InodeTypes) -> Self
    pub fn open(&mut self, flags: i32) -> Result<(), i32>
    pub fn close(&mut self) -> Result<(), i32>
    pub fn read(&mut self, buf: &mut [u8]) -> Result<usize, i32>
    pub fn write(&mut self, buf: &[u8]) -> Result<usize, i32>
    pub fn seek(&mut self, offset: i64, whence: i32) -> Result<i64, i32>
    pub fn ftruncate(&mut self, new_size: u64) -> Result<(), i32>
    pub fn fstat(&self) -> Result<ext4_inode, i32>
    pub fn chmod(&mut self, mode: u32) -> Result<(), i32>
}
```

**文件打开标志：**
```rust
/// 文件打开模式说明
/// |---------------------------------------------------------------|
/// |   r 或 rb                 O_RDONLY                            |
/// |---------------------------------------------------------------|
/// |   w 或 wb                 O_WRONLY|O_CREAT|O_TRUNC            |
/// |---------------------------------------------------------------|
/// |   a 或 ab                 O_WRONLY|O_CREAT|O_APPEND           |
/// |---------------------------------------------------------------|
/// |   r+ 或 rb+ 或 r+b        O_RDWR                              |
/// |---------------------------------------------------------------|
/// |   w+ 或 wb+ 或 w+b        O_RDWR|O_CREAT|O_TRUNC              |
/// |---------------------------------------------------------------|
/// |   a+ 或 ab+ 或 a+b        O_RDWR|O_CREAT|O_APPEND             |
/// |---------------------------------------------------------------|
```

**文件类型枚举：**
```rust
pub enum InodeTypes {
    EXT4_DE_UNKNOWN,     // 未知类型
    EXT4_DE_REG_FILE,    // 常规文件
    EXT4_DE_DIR,         // 目录
    EXT4_DE_CHRDEV,      // 字符设备
    EXT4_DE_BLKDEV,      // 块设备
    EXT4_DE_FIFO,        // FIFO管道
    EXT4_DE_SOCK,        // Socket
    EXT4_DE_SYMLINK,     // 符号链接
}
```

#### 3. KernelDevOp Trait

`KernelDevOp` 是设备操作的抽象接口，允许不同的块设备实现统一的操作接口。

```rust
pub trait KernelDevOp {
    type DevType;
    
    fn write(dev: &mut Self::DevType, buf: &[u8]) -> Result<usize, i32>;
    fn read(dev: &mut Self::DevType, buf: &mut [u8]) -> Result<usize, i32>;
    fn seek(dev: &mut Self::DevType, off: i64, whence: i32) -> Result<i64, i32>;
    fn flush(dev: &mut Self::DevType) -> Result<usize, i32>;
}
```

**实现示例（VirtIO 块设备）：**
```rust
impl<H: Hal, T: Transport> KernelDevOp for Disk<H, T> {
    type DevType = Self;
    
    fn read(dev: &mut Self::DevType, buf: &mut [u8]) -> Result<usize, i32> {
        let mut total_read = 0;
        while total_read < buf.len() {
            let read = dev.read_one(&mut buf[total_read..])?;
            if read == 0 {
                break;
            }
            total_read += read;
        }
        Ok(total_read)
    }
    
    fn write(dev: &mut Self::DevType, buf: &[u8]) -> Result<usize, i32> {
        let mut total_written = 0;
        while total_written < buf.len() {
            let written = dev.write_one(&buf[total_written..])?;
            if written == 0 {
                break;
            }
            total_written += written;
        }
        Ok(total_written)
    }
    
    fn seek(dev: &mut Self::DevType, off: i64, whence: i32) -> Result<i64, i32> {
        let new_pos = match whence {
            SEEK_SET => off,
            SEEK_CUR => dev.position() as i64 + off,
            SEEK_END => dev.size() as i64 + off,
            _ => return Err(EINVAL as i32),
        };
        
        if new_pos < 0 || new_pos > dev.size() as i64 {
            return Err(EINVAL as i32);
        }
        
        dev.set_position(new_pos as u64);
        Ok(new_pos)
    }
    
    fn flush(_dev: &mut Self::DevType) -> Result<usize, i32> {
        // VirtIO 块设备通常不需要显式刷新
        Ok(0)
    }
}
```
### 内部实现细节

#### 1. 内存管理

使用 `alloc` crate 进行内存管理，支持 `no_std` 环境。关键数据结构使用 `Box` 进行堆分配。

**内存分配策略：**
```rust
// 自定义内存分配器实现
#[no_mangle]
pub extern "C" fn ext4_user_malloc(size: c_size_t) -> *mut c_void {
    // 使用 Rust 全局分配器
    let layout = Layout::from_size_align(size + CTRL_BLK_SIZE, 8).unwrap();
    let ptr = unsafe { alloc(layout) };
    
    if ptr.is_null() {
        return null_mut();
    }
    
    // 存储控制块信息
    let ptr = ptr.cast::<MemoryControlBlock>();
    unsafe { ptr.write(MemoryControlBlock { size }) }
    ptr.add(1).cast()
}
```

**内存对齐和优化：**
- 所有数据结构按照 8 字节对齐
- 使用零拷贝技术减少内存复制
- 实现内存池管理减少分配开销

#### 2. 错误处理

使用 Rust 的 `Result` 类型进行错误处理，同时保持与 C 库的错误码兼容。

**错误映射：**
```rust
// C 错误码到 Rust 错误的映射
fn map_c_error(ret: c_int) -> Result<(), i32> {
    match ret {
        EOK => Ok(()),
        EIO => Err(EIO),
        ENOMEM => Err(ENOMEM),
        EINVAL => Err(EINVAL),
        _ => Err(ret),
    }
}
```

**错误恢复机制：**
- 文件系统自动检测和恢复
- 日志回滚机制
- 块设备错误重试

#### 3. 并发安全

通过 `PhantomData` 确保类型安全，但实际的并发安全需要上层实现保证。

**线程安全设计：**
```rust
// 使用 RefCell 提供内部可变性
pub struct FileWrapper(RefCell<Ext4File>);

// 使用 Arc 提供共享所有权
pub struct Ext4FileSystem<H: Hal, T: Transport> {
    inner: Ext4BlockWrapper<Disk<H, T>>,
    root: Arc<dyn VfsNodeOps>,
}

unsafe impl<H: Hal, T: Transport> Sync for Ext4FileSystem<H, T> {}
unsafe impl<H: Hal, T: Transport> Send for Ext4FileSystem<H, T> {}
```

**锁策略：**
- 文件级别锁：避免全局锁竞争
- 读写锁：支持并发读取
- 自旋锁：短临界区保护

#### 4. 日志系统

集成 `log` crate，提供分级日志输出，支持调试和问题排查。

**日志级别：**
```rust
// 日志级别映射
#[cfg(feature = "print")]
unsafe extern "C" fn printf(str: *const c_char, mut args: ...) -> c_int {
    // 将 C printf 转换为 Rust log
    let mut s = String::new();
    let bytes_written = printf_compat::format(str as _, args.as_va_list(), 
                                             printf_compat::output::fmt_write(&mut s));
    info!("[lwext4] {}", s);
    bytes_written
}
```

**调试功能：**
```rust
// 启用调试输出
pub fn ext4_set_debug(&self) {
    unsafe {
        ext4_dmask_set(DEBUG_ALL);
    }
}

// 性能统计
pub fn print_lwext4_mp_stats(&self) {
    let mut stats: ext4_mount_stats = unsafe { core::mem::zeroed() };
    let c_mountpoint = &self.mount_point as *const _ as *const c_char;
    
    unsafe {
        ext4_mount_point_stats(c_mountpoint, &mut stats);
    }
    
    // 打印详细统计信息
    trace!("inodes_count = {}", stats.inodes_count);
    trace!("free_inodes_count = {}", stats.free_inodes_count);
    trace!("blocks_count = {}", stats.blocks_count);
    trace!("free_blocks_count = {}", stats.free_blocks_count);
}
```