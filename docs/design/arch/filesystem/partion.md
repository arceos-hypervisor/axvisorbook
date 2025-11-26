---
sidebar_position: 4
---

## 分区识别机制

ArceOS目前支持两种主流的分区表格式：

####  GPT(GUID分区表)

GPT是现代系统广泛使用的分区表格式，具有以下特点：

- 支持128个主分区
- 使用128位GUID唯一标识分区类型
- 支持分区名称(UTF-16LE编码)
- 包含备份分区表
- 支持CRC32校验

GPT解析过程如下：

1. 读取LBA 1处的GPT头
2. 验证签名("EFI PART")
3. 解析分区项位置和数量
4. 读取分区项数组
5. 提取分区信息

####  MBR(主引导记录)

MBR是传统的分区表格式，虽然功能有限，但仍广泛使用：

- 支持4个主分区
- 使用分区类型标识(1字节)
- 支持扩展分区

当GPT解析失败时，系统会尝试解析MBR分区表，确保向后兼容。

### 分区扫描流程

分区扫描是系统启动时的关键步骤，流程如下：

1. **初始化块设备**：创建`Disk`对象，获取设备信息
2. **尝试GPT解析**：读取GPT头，验证签名
3. **解析分区项**：读取分区项数组，提取分区信息
4. **MBR回退**：如果GPT解析失败，尝试MBR
5. **全盘处理**：如果都没有分区表，将整个磁盘作为单个分区
6. **文件系统检测**：对每个分区进行文件系统类型检测

### 分区信息结构

分区信息通过`PartitionInfo`结构体表示：

```rust
pub struct PartitionInfo {
    pub index: u32,                    // 分区索引(0-based)
    pub name: String,                   // 分区名称
    pub partition_type_guid: [u8; 16],  // 分区类型GUID
    pub unique_partition_guid: [u8; 16], // 唯一分区GUID
    pub filesystem_uuid: Option<String>, // 文件系统UUID
    pub starting_lba: u64,              // 起始LBA
    pub ending_lba: u64,                // 结束LBA
    pub size_bytes: u64,                // 分区大小(字节)
    pub filesystem_type: Option<FilesystemType>, // 文件系统类型
}
```

这种结构设计包含了分区的所有关键信息，便于上层文件系统使用。

## 文件系统探测机制

###  文件系统类型检测

文件系统类型检测是通过分析分区开始的特定数据结构实现的，目前支持：

####  FAT文件系统检测

FAT文件系统(FAT12/FAT16/FAT32)的检测基于以下特征：

- FAT12/FAT16：在偏移0x36处有"FAT"签名
- FAT32：在偏移0x52处有"FAT32"签名

```rust
fn is_fat_filesystem(boot_sector: &[u8; 512]) -> bool {
    // 检查FAT12/FAT16/FAT32签名
    if boot_sector.len() >= 0x36 + 3 {
        let fat_sig = &boot_sector[0x36..0x36 + 3];
        if fat_sig == b"FAT" {
            return true;
        }
    }

    if boot_sector.len() >= 0x52 + 5 {
        let fat32_sig = &boot_sector[0x52..0x52 + 5];
        if fat32_sig == b"FAT32" {
            return true;
        }
    }

    false
}
```

检测过程：

1. 读取分区开始的512字节(引导扇区)
2. 检查特定偏移处的签名
3. 确定FAT类型

#### ext4文件系统检测

ext4文件系统的检测基于超级块特征：

- 超级块位于分区偏移1024字节处
- 魔数0xEF53位于超级块偏移1080字节处

```rust
fn is_ext4_filesystem(disk: &mut Disk, start_lba: u64) -> bool {
    // ext4超级块位于分区偏移1024字节处
    let superblock_offset = start_lba * 512 + 1024;
    let mut superblock = [0u8; 2048];

    // 保存当前位置
    let pos = disk.position();

    // 设置位置读取超级块
    disk.set_position(superblock_offset);

    let result = if let Err(_) = read_exact(disk, &mut superblock) {
        warn!("Failed to read ext4 superblock at offset {}", superblock_offset);
        false
    } else {
        // 检查ext4魔数(0xEF53)位于超级块偏移1080字节处
        // 由于我们从1024字节处开始读取，魔数位于索引56处
        if superblock.len() >= 58 {
            let magic = u16::from_le_bytes([superblock[56], superblock[57]]);
            magic == 0xEF53
        } else {
            false
        }
    };

    // 恢复位置
    disk.set_position(pos);

    result
}
```

检测过程：

1. 定位到超级块位置
2. 读取超级块数据
3. 验证魔数

### 文件系统UUID读取

为了支持通过UUID挂载文件系统，ArceOS实现了从文件系统超级块读取UUID的功能：

#### ext4 UUID读取

ext4的UUID位于超级块偏移0x68处，共16字节。UUID的存储格式为：

- 前3个字段：小端序
- 后2个字段：大端序

读取后转换为标准UUID格式(8-4-4-4-12)。

#### FAT32 UUID读取

FAT32没有标准UUID，但有卷标ID(Volume ID)，位于引导扇区偏移0x43处，共4字节。读取后格式化为8字符十六进制字符串。

### 文件系统创建

对于检测到的文件系统，ArceOS会创建对应的文件系统实例：

1. **创建分区包装器**：将分区包装为文件系统可访问的设备
2. **初始化文件系统**：调用文件系统的初始化函数
3. **创建根节点**：创建文件系统的根目录节点
4. **注册到VFS**：将文件系统注册到虚拟文件系统



## 启动流程与挂载策略

###  系统启动流程

文件系统的初始化是系统启动的关键步骤，流程如下：

1. **设备初始化**：初始化块设备驱动
2. **分区扫描**：扫描并识别分区
3. **文件系统检测**：检测各分区的文件系统类型
4. **根文件系统选择**：根据启动参数或默认策略选择根文件系统
5. **文件系统挂载**：挂载根文件系统和其他分区
6. **虚拟文件系统挂载**：挂载/dev, /proc, /sys等虚拟文件系统

### 根文件系统选择策略

ArceOS支持多种根文件系统选择策略：

1. **启动参数指定**：通过`root=`参数指定
   - `root=/dev/sdaX`：按设备路径指定
   - `root=PARTUUID=xxx`：按分区GUID指定
   - `root=UUID=xxx`：按文件系统UUID指定

2. **默认策略**：如果没有指定，使用第一个支持的文件系统分区

3. **回退策略**：如果没有支持的文件系统，使用ramfs作为根文