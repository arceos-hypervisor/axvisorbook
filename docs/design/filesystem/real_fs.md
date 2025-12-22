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


- **完整 Ext4 实现**：支持 Ext4 文件系统的所有核心特性，包括动态 inode 大小、extent 树、块组管理等
- **Extent 树支持**：使用 extent 树替代传统块映射，提高大文件存储效率，支持连续块分配
- **日志系统 (JBD2)**：实现 Journaling Block Device 2，支持 ordered 模式，保证文件系统一致性
- **块设备抽象**：通过 `BlockDevice` trait 抽象底层存储，提供统一的块读写接口
- **多级缓存系统**：包括位图缓存、inode 表缓存、数据块缓存，支持 LRU 淘汰策略
- **目录操作**：支持目录创建、遍历、硬链接、符号链接等
- **文件操作**：支持文件的创建、读取、写入、截断、删除等，支持基于偏移量的随机访问
- **元数据校验**：支持元数据校验和功能（通过 feature flag 控制）


### 核心组件

#### Ext4FileSystem

文件系统的核心结构体，管理整个文件系统的状态：

```rust
pub struct Ext4FileSystem {
    pub superblock: Ext4Superblock,           // 超级块
    pub group_descs: Vec<Ext4GroupDesc>,      // 块组描述符数组
    pub block_allocator: BlockAllocator,      // 块分配器
    pub inode_allocator: InodeAllocator,      // Inode分配器
    pub bitmap_cache: BitmapCache,            // 位图缓存
    pub inodetable_cahce: InodeCache,         // Inode表缓存
    pub datablock_cache: DataBlockCache,      // 数据块缓存
    pub root_inode: u32,                      // 根目录inode号
    pub group_count: u32,                     // 块组数量
    pub mounted: bool,                        // 是否已挂载
    pub journal_sb_block_start: Option<u32>,  // Journal超级块位置
}
```

该结构体封装了文件系统的所有核心状态，是文件系统操作的中心枢纽。超级块包含全局文件系统信息，块组描述符管理各个块组的元数据，各种分配器负责资源管理，缓存系统提高性能。挂载时初始化所有组件，卸载时确保数据持久化并清理资源。

#### BlockDevice Trait

抽象底层块设备的接口，提供统一的块读写操作：

```rust
pub trait BlockDevice {
    fn read(&mut self, buffer: &mut [u8], block_id: u32, count: u32) -> BlockDevResult<()>;
    fn write(&mut self, buffer: &[u8], block_id: u32, count: u32) -> BlockDevResult<()>;
    fn open(&mut self) -> BlockDevResult<()>;
    fn close(&mut self) -> BlockDevResult<()>;
    fn total_blocks(&self) -> u64;
    fn block_size(&self) -> u32;
}
```

这个 trait 定义了块设备的基本操作接口，通过抽象层屏蔽了底层存储的差异。`read` 和 `write` 方法支持多块连续操作，提高了 I/O 效率。`open` 和 `close` 方法允许设备进行初始化和清理工作。`total_blocks` 和 `block_size` 提供了设备的基本信息。这种设计使得 rsext4 可以轻松适配不同的存储介质，如传统的磁盘驱动器、RAM 磁盘、SSD 或甚至是网络存储。通过实现这个 trait，开发者可以为 rsext4 添加新的存储后端支持。

#### Jbd2Dev

日志系统的包装器，为块设备添加日志功能：

```rust
pub struct Jbd2Dev<B: BlockDevice> {
    block_dev: B,
    journal_system: Option<JBD2DEVSYSTEM>,
    use_journal: bool,
}
```

Jbd2Dev 在 BlockDevice 基础上增加了事务日志支持，确保文件系统操作的原子性和一致性。它维护了一个日志系统状态，可以动态启用或禁用日志功能。`journal_system` 字段存储日志系统的内部状态，`use_journal` 标志控制是否实际使用日志。这种设计允许在性能和安全性之间进行权衡：在格式化或某些特殊操作时可以临时关闭日志以提高性能，而在正常运行时启用日志保证数据一致性。Jbd2Dev 还处理日志的重放，确保系统崩溃后能够恢复到一致状态。

#### 缓存系统

##### BitmapCache

管理块位图和 inode 位图的缓存，支持按需加载和 LRU 淘汰：

```rust
/// 位图缓存管理器
pub struct BitmapCache {
    /// 缓存的位图
    cache: BTreeMap<CacheKey, CachedBitmap>,
    /// 最大缓存条目数（LRU淘汰）
    max_entries: usize,
    /// 访问计数器（用于LRU）
    access_counter: u64,
}

/// 使用闭包修改指定位图，并自动标记为脏
pub fn modify<B, F>(
    &mut self,
    block_dev: &mut Jbd2Dev<B>,
    key: CacheKey,
    block_num: u64,
    f: F,
) -> BlockDevResult<()>
where
    B: BlockDevice,
    F: FnOnce(&mut [u8]),
{
    let bitmap = self.get_or_load_mut(block_dev, key, block_num)?;
    f(&mut bitmap.data);
    bitmap.mark_dirty();
    Ok(())
}
```

BitmapCache 通过 LRU 策略管理位图缓存，减少磁盘 I/O，提高分配性能。

##### InodeCache

缓存 inode 表数据，避免频繁磁盘访问：

```rust
/// Inode缓存管理器
pub struct InodeCache {
    /// 缓存的inode
    cache: BTreeMap<InodeCacheKey, CachedInode>,
    /// 最大缓存条目数
    max_entries: usize,
    /// 访问计数器
    access_counter: u64,
    /// 每个inode的大小
    inode_size: usize,
}

/// 使用闭包修改指定inode
pub fn modify<B, F>(
    &mut self,
    block_dev: &mut Jbd2Dev<B>,
    inode_num: u64,
    block_num: u64,
    offset: usize,
    f: F,
) -> BlockDevResult<()>
where
    B: BlockDevice,
    F: FnOnce(&mut Ext4Inode),
{
    let cached = self.get_or_load_mut(block_dev, inode_num, block_num, offset)?;
    f(&mut cached.inode);
    cached.mark_dirty();
    Ok(())
}
```

InodeCache 缓存 inode 结构，支持延迟写回，减少元数据访问延迟。

##### DataBlockCache

缓存文件数据块，支持大文件的高效访问：

```rust
/// 数据块缓存管理器
pub struct DataBlockCache {
    /// 缓存的数据块
    cache: BTreeMap<BlockCacheKey, CachedBlock>,
    /// 最大缓存条目数
    max_entries: usize,
    /// 访问计数器（用于LRU）
    access_counter: u64,
    /// 块大小
    block_size: usize,
}

/// 获取数据块（如果不存在则从磁盘加载）
pub fn get_or_load<B: BlockDevice>(
    &mut self,
    block_dev: &mut Jbd2Dev<B>,
    block_num: u64,
) -> BlockDevResult<&CachedBlock> {
    if !self.cache.contains_key(&block_num) {
        if self.cache.len() >= self.max_entries {
            self.evict_lru(block_dev)?;
        }
        // 加载块数据...
    }
    // 返回缓存的块
    self.cache.get(&block_num).ok_or(BlockDevError::Corrupted)
}
```

DataBlockCache 缓存文件内容块，支持随机访问和顺序访问的性能优化。

#### 分配器

##### BlockAllocator

负责数据块的分配和释放，支持连续块分配：

```rust
/// 块分配器
pub struct BlockAllocator {
    blocks_per_group: u32,
    first_data_block: u32,
}

/// 在指定块组中分配连续的多个块
pub fn alloc_contiguous_blocks(
    &self,
    bitmap_data: &mut [u8],
    group_idx: u32,
    count: u32,
) -> Result<BlockAlloc, AllocError> {
    let mut bitmap = BlockBitmapMut::new(bitmap_data, self.blocks_per_group);
    let block_in_group = self
        .find_contiguous_free_blocks(&bitmap, count)?
        .ok_or(AllocError::NoSpace)?;
    bitmap.allocate_range(block_in_group, count)?;
    let global_block = self.block_to_global(group_idx, block_in_group);
    Ok(BlockAlloc {
        group_idx,
        block_in_group,
        global_block,
    })
}
```

BlockAllocator 管理数据块的分配和释放，支持连续块分配以减少碎片，提高 I/O 性能。连续分配算法通过扫描位图找到指定数量的连续空闲块，这种策略能够显著减少文件碎片，提高文件访问的局部性。

##### InodeAllocator

负责 inode 的分配和释放：

```rust
/// Inode分配器
pub struct InodeAllocator {
    inodes_per_group: u32,
    first_inode: u32,
}

/// 在指定块组中分配一个inode
pub fn alloc_inode_in_group(
    &self,
    bitmap_data: &mut [u8],
    group_idx: u32,
    group_desc: &Ext4GroupDesc,
) -> Result<InodeAlloc, AllocError> {
    if group_desc.free_inodes_count() == 0 {
        return Err(AllocError::NoSpace);
    }
    let mut bitmap = InodeBitmapMut::new(bitmap_data, self.inodes_per_group);
    let inode_in_group = self.find_free_inode(&bitmap)?.ok_or(AllocError::NoSpace)?;
    bitmap.allocate(inode_in_group)?;
    let global_inode = self.inode_to_global(group_idx, inode_in_group);
    Ok(InodeAlloc {
        group_idx,
        inode_in_group,
        global_inode,
    })
}
```

InodeAllocator 管理 inode 分配，确保文件和目录的元数据空间。每个 inode 代表文件系统中的一个文件或目录，分配器维护 inode 位图以跟踪使用情况。

### 内部细节

#### 文件系统布局

Ext4 文件系统按块组组织，每个块组包含：

- **超级块**：文件系统全局元数据
- **块组描述符**：块组元数据
- **块位图**：标记块使用情况
- **inode 位图**：标记 inode 使用情况  
- **inode 表**：存储 inode 结构
- **数据块**：实际存储文件数据

超级块结构定义：

```rust
#[repr(C)]
pub struct Ext4Superblock {
    // 基本信息
    pub s_inodes_count: u32,         // Inode总数
    pub s_blocks_count_lo: u32,      // 块总数（低32位）
    pub s_free_blocks_count_lo: u32, // 空闲块数（低32位）
    pub s_free_inodes_count: u32,    // 空闲inode数
    pub s_first_data_block: u32,     // 第一个数据块
    pub s_log_block_size: u32,       // 块大小 = 1024 << s_log_block_size
    pub s_blocks_per_group: u32,     // 每个块组的块数
    pub s_inodes_per_group: u32,     // 每个块组的inode数
    
    // 状态和特性
    pub s_magic: u16,                // 魔数 0xEF53
    pub s_state: u16,                // 文件系统状态
    pub s_feature_compat: u32,       // 兼容特性标志
    pub s_feature_incompat: u32,     // 不兼容特性标志
    pub s_uuid: [u8; 16],            // 128位UUID
    // ... 更多字段
}
```

块组描述符结构：

```rust
#[repr(C)]
pub struct Ext4GroupDesc {
    // 基本信息（32字节）
    pub bg_block_bitmap_lo: u32,     // 块位图块号（低32位）
    pub bg_inode_bitmap_lo: u32,     // Inode位图块号（低32位）
    pub bg_inode_table_lo: u32,      // Inode表起始块号（低32位）
    pub bg_free_blocks_count_lo: u16, // 空闲块数（低16位）
    pub bg_free_inodes_count_lo: u16, // 空闲inode数（低16位）
    pub bg_used_dirs_count_lo: u16,   // 目录数（低16位）
    pub bg_flags: u16,                // 标志
    // ... 更多字段
}
```

文件系统布局提供了高效的元数据管理和数据访问机制。块组结构将相关元数据集中存储，减少了磁盘寻道时间，提高了 I/O 性能。

#### 挂载过程

挂载过程涉及读取和验证文件系统元数据，初始化各种组件：

```rust
/// 打开Ext4文件系统
pub fn mount<B: BlockDevice>(block_dev: &mut Jbd2Dev<B>) -> Result<Self, RSEXT4Error> {
    // 1. 读取超级块
    let superblock = read_superblock(block_dev).map_err(|_| RSEXT4Error::IoError)?;
    
    // 2. 验证魔数
    if superblock.s_magic != EXT4_SUPER_MAGIC {
        return Err(RSEXT4Error::InvalidMagic);
    }
    
    // 3. 计算块组数量并读取块组描述符
    let group_count = superblock.block_groups_count();
    let group_descs = Self::load_group_descriptors(block_dev, group_count)?;
    
    // 4. 初始化分配器和缓存
    let block_allocator = BlockAllocator::new(&superblock);
    let inode_allocator = InodeAllocator::new(&superblock);
    let bitmap_cache = BitmapCache::default();
    let inode_cache = InodeCache::new(INODE_CACHE_MAX, inode_size);
    let datablock_cache = DataBlockCache::new(DATABLOCK_CACHE_MAX, BLOCK_SIZE);
    
    // 5. 构造文件系统实例
    let mut fs = Self {
        superblock,
        group_descs,
        block_allocator,
        inode_allocator,
        bitmap_cache,
        inodetable_cahce: inode_cache,
        datablock_cache,
        root_inode: 2,
        group_count,
        mounted: true,
        journal_sb_block_start: None,
    };
    
    // 6. 检查和创建根目录
    let root_inode = fs.get_root(block_dev)?;
    if root_inode.i_mode == 0 || !root_inode.is_dir() {
        fs.create_root_dir(block_dev)?;
    }
    
    Ok(fs)
}
```

挂载过程确保文件系统处于一致状态，并初始化所有必要的组件。

#### 文件操作流程

##### 文件读取

文件读取涉及路径解析、extent映射和数据缓存：

```rust
///读取整个文件内容
pub fn read<B: BlockDevice>(
    dev: &mut Jbd2Dev<B>,
    fs: &mut Ext4FileSystem,
    path: &str,
) -> BlockDevResult<Option<Vec<u8>>> {
    read_file(dev, fs, path)
}

/// read_at 计算文件offset后读取
pub fn read_at<B: BlockDevice>(
    dev: &mut Jbd2Dev<B>,
    fs: &mut Ext4FileSystem,
    file: &mut OpenFile,
    len: usize,
) -> BlockDevResult<Vec<u8>> {
    refresh_open_file_inode(dev, fs, file)?;
    let file_size = file.inode.size() as u64;
    if file.offset >= file_size {
        return Ok(Vec::new());
    }
    
    let extent_map = resolve_inode_block_allextend(fs, dev, &mut file.inode)?;
    // 解析extent树获取块映射，然后读取数据块缓存
    // ...
}
```

文件读取通过extent树高效定位数据块，支持随机访问。extent树将逻辑块号映射到物理块号，减少了间接块的开销。对于大文件，这种映射方式特别高效。

##### 文件写入

文件写入涉及块分配、extent更新和缓存管理：

```rust
///写入文件:基于当前offset追加写入
pub fn write_at<B: BlockDevice>(
    dev: &mut Jbd2Dev<B>,
    fs: &mut Ext4FileSystem,
    file: &mut OpenFile,
    data: &[u8],
) -> BlockDevResult<()> {
    write_file(dev, fs, &file.path, file.offset, data)?;
    file.offset = file.offset.saturating_add(data.len() as u64);
    refresh_open_file_inode(dev, fs, file)?;
    Ok(())
}
```

文件写入通过extent树管理块分配，支持动态扩展。写入操作首先检查是否有足够的空闲块，然后分配块并更新extent树，最后将数据写入缓存。

#### Extent 树机制

Extent 树是 Ext4 的核心特性，用于高效管理大文件的块映射。传统的块映射使用间接块，随着文件增大，间接块层次会增加，导致访问效率降低。Extent 树通过记录连续块范围解决了这个问题，每个 extent 条目表示一段连续的块映射，大大减少了元数据开销。

```rust
/// 内存中的 extent 树节点表示
pub enum ExtentNode {
    /// 叶子节点：存储实际的块映射
    Leaf {
        header: Ext4ExtentHeader,
        entries: Vec<Ext4Extent>,
    },
    /// 内部节点：存储子节点的块号
    Index {
        header: Ext4ExtentHeader,
        entries: Vec<Ext4ExtentIdx>,
    },
}

/// 绑定到单个 inode 的 extent 树视图
pub struct ExtentTree<'a> {
    pub inode: &'a mut Ext4Inode,
}
```

Extent 树支持连续块范围的映射，减少元数据开销，提高大文件性能。

#### 日志系统 (JBD2)

JBD2 保证文件系统一致性：

```rust
///提交事务
pub fn commit_transaction<B: BlockDevice>(
    &mut self,
    block_dev: &mut B,
) -> Result<bool, ()> {
    let tid = self.sequence;
    // 写描述符块
    let mut desc_buffer = vec![0; BLOCK_SIZE];
    let mut new_jbd_header = JournalHeaderS::default();
    new_jbd_header.h_blocktype = 1; // Descriptor
    new_jbd_header.h_sequence = tid;
    new_jbd_header.to_disk_bytes(&mut desc_buffer[0..JournalHeaderS::disk_size()]);
    
    // 写数据块标签和数据
    for (idx, update) in self.commit_queue.iter().enumerate() {
        let mut tag = JournalBlockTagS {
            t_blocknr: update.0 as u32,
            t_checksum: 0,
            t_flags: 0,
        };
        // 处理最后一个标签和逃逸标记
        if idx == self.commit_queue.len() - 1 {
            tag.t_flags |= JBD2_FLAG_LAST_TAG;
        }
        // 写入标签和数据块
    }
    Ok(true)
}
```

JBD2 通过预写日志确保操作的原子性，防止文件系统损坏。日志记录了元数据变更，在系统崩溃时可以重放日志恢复一致性。

#### 缓存策略

缓存策略包括按需加载、LRU淘汰和延迟写入：

```rust
/// 获取位图（如果不存在则从磁盘加载）
pub fn get_or_load<B: BlockDevice>(
    &mut self,
    block_dev: &mut Jbd2Dev<B>,
    key: CacheKey,
    block_num: u64,
) -> BlockDevResult<&CachedBitmap> {
    if !self.cache.contains_key(&key) {
        if self.cache.len() >= self.max_entries {
            self.evict_lru(block_dev)?;
        }
        block_dev.read_block(block_num as u32)?;
        let buffer = block_dev.buffer();
        let data = buffer.to_vec();
        let bitmap = CachedBitmap::new(data, block_num);
        self.cache.insert(key, bitmap);
    }
    self.access_counter += 1;
    // 更新访问时间戳
    self.cache.get(&key).ok_or(BlockDevError::Corrupted)
}
```

缓存策略平衡内存使用和I/O性能。

#### 错误处理

错误处理使用Result类型和错误传播：

```rust
/// 块设备错误类型
pub enum BlockDevError {
    IoError,
    BufferTooSmall { provided: usize, required: usize },
    InvalidInput,
    Corrupted,
    NoSpace,
    Unsupported,
    WriteError,
}
```

所有操作返回Result，确保错误被正确处理和传播。

#### 性能优化

性能优化包括连续I/O、批量操作和零拷贝：

- **连续I/O**：extent 树减少随机访问
- **批量操作**：缓存减少磁盘I/O次数  
- **零拷贝**：直接操作缓存缓冲区，避免数据拷贝
- **内存池**：复用内存分配，提高效率

这些优化使得 rsext4 在嵌入式和性能敏感场景下具备更好的表现。