---
sidebar_position: 2
---

# FDT 设备树处理

## FDT 处理概述和架构

### FDT 在 AxVisor 中的角色

**设备树（Device Tree）** 是 ARM 平台描述硬件拓扑的标准方式。AxVisor 使用 FDT 实现：

1. **设备发现**：从宿主机 FDT 提取硬件信息
2. **资源分配**：为客户机分配 CPU、内存、设备
3. **DTB 生成**：为客户机生成定制的 DTB
4. **设备直通**：配置设备直接访问

**FDT 处理流程图**：

```
┌─────────────────────────────────────────────────────────────┐
│  宿主机 FDT (Host FDT)                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  • Bootloader 传递的完整设备树                              │
│  • 包含所有硬件信息（CPU、内存、设备、中断）                │
│  • 格式：DTB (Device Tree Blob，二进制)                     │
│  • 位置：通过 axhal::get_bootarg() 获取                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ get_host_fdt()
                   │ fdt_parser::Fdt::from_bytes()
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  宿主机 FDT 解析                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  1. set_phys_cpu_sets()                                      │
│     └─ 提取 /cpus/cpu@* 节点                                │
│        └─ 计算 VCpu 到物理 CPU 的亲和性掩码                 │
│                                                              │
│  2. setup_guest_fdt_from_vmm() 或 update_provided_fdt()     │
│     ├─ 用户提供 DTB？                                       │
│     │   ├─ 是：update_cpu_node() 更新 CPU 节点             │
│     │   └─ 否：                                              │
│     │       ├─ find_all_passthrough_devices()               │
│     │       │   └─ 发现直通设备及其依赖                     │
│     │       └─ crate_guest_fdt()                            │
│     │           └─ 生成客户机 DTB                           │
│     │                                                        │
│     └─ crate_guest_fdt_with_cache()                         │
│         └─ 缓存生成的 DTB                                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ get_vm_dtb_arc()
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  客户机 DTB 后处理                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  1. parse_passthrough_devices_address()                      │
│     └─ 提取设备物理地址和大小                               │
│        └─ 填充 vm_config.pass_through_devices               │
│                                                              │
│  2. parse_vm_interrupt()                                     │
│     └─ 提取 GIC SPI 中断                                    │
│        └─ 填充 vm_config.spi_list                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ update_fdt() (镜像加载时)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  客户机 DTB 最终处理                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  1. 添加内存节点（根据 VM 实际分配的内存）                  │
│  2. 计算 DTB 加载地址                                        │
│  3. 加载到客户机内存                                         │
└─────────────────────────────────────────────────────────────┘
```

### FDT 模块架构

**模块组织**（`kernel/src/vmm/fdt/`）：

```
kernel/src/vmm/fdt/
├── mod.rs          # FDT 模块入口和协调逻辑
│   ├─ handle_fdt_operations()   ★ 主入口
│   ├─ init_dtb_cache()
│   ├─ get_developer_provided_dtb()
│   └─ crate_guest_fdt_with_cache()
│
├── parser.rs       # 设备树解析和配置提取
│   ├─ get_host_fdt()             ★ 获取宿主机 FDT
│   ├─ set_phys_cpu_sets()        ★ CPU 亲和性计算
│   ├─ setup_guest_fdt_from_vmm() ★ 生成客户机 FDT
│   ├─ parse_passthrough_devices_address()  ★ 设备地址解析
│   ├─ parse_vm_interrupt()       ★ 中断解析
│   └─ update_provided_fdt()
│
├── device.rs       # 设备依赖分析和直通设备发现
│   ├─ find_all_passthrough_devices()  ★ 三阶段设备发现
│   ├─ build_node_path()           # 构建节点路径
│   ├─ build_optimized_node_cache() # 节点缓存
│   ├─ build_phandle_map()         # phandle 映射表
│   ├─ parse_phandle_property()    # phandle 解析
│   └─ get_descendant_nodes_by_path() # 获取后代节点
│
├── create.rs       # 客户机 FDT 生成
│   ├─ crate_guest_fdt()           ★ 生成 DTB
│   ├─ update_fdt()                # 更新内存节点
│   ├─ update_cpu_node()           # 更新 CPU 节点
│   ├─ add_memory_node()           # 添加内存节点
│   ├─ calculate_dtb_load_addr()   # 计算 DTB 地址
│   └─ 各种辅助函数
│
└── print.rs        # FDT 调试输出工具
    ├─ print_fdt()                 # 打印宿主机 FDT
    └─ print_guest_fdt()           # 打印客户机 FDT
```

**数据流**：

```
TOML 配置
    │
    ├─ passthrough_devices: [["/soc/uart@fe660000"]]
    └─ phys_cpu_ids: [0x0, 0x100]
    │
    ▼
handle_fdt_operations()
    │
    ├─→ get_host_fdt()
    │   └─→ 宿主机 DTB 二进制数据
    │
    ├─→ set_phys_cpu_sets()
    │   ├─ 输入：phys_cpu_ids, host_fdt
    │   └─ 输出：phys_cpu_sets (亲和性掩码)
    │
    ├─→ setup_guest_fdt_from_vmm()
    │   ├─ find_all_passthrough_devices()
    │   │   ├─ 输入：初始设备列表
    │   │   └─ 输出：完整设备列表（包含依赖）
    │   │
    │   └─ crate_guest_fdt()
    │       ├─ 输入：host_fdt, 设备列表
    │       └─ 输出：客户机 DTB 二进制
    │
    ├─→ parse_passthrough_devices_address()
    │   ├─ 输入：客户机 DTB
    │   └─ 输出：填充 pass_through_devices（地址、大小）
    │
    └─→ parse_vm_interrupt()
        ├─ 输入：客户机 DTB
        └─ 输出：填充 spi_list（中断号）
```

## 宿主机 FDT 解析

### 获取宿主机 FDT

**get_host_fdt() 实现**（`kernel/src/vmm/fdt/parser.rs`）：

```rust
/// 从 Bootloader 传递的地址获取宿主机 FDT
///
/// # ARM Boot Protocol
/// - Bootloader 通过 x0 寄存器传递 DTB 地址
/// - DTB 是 FDT 的二进制格式（Flattened Device Tree Blob）
/// - Magic Number: 0xd00dfeed（大端序）
///
/// # 返回值
/// 返回宿主机 FDT 的完整字节切片（生命周期 'static）
pub fn get_host_fdt() -> &'static [u8] {
    const FDT_VALID_MAGIC: u32 = 0xd00d_feed;

    // ═══════════════════════════════════════
    // 步骤 1: 获取 Bootloader 传递的 DTB 地址
    // ═══════════════════════════════════════
    // axhal::get_bootarg() 返回 x0 寄存器值
    let bootarg: usize = std::os::arceos::modules::axhal::get_bootarg();
    debug!("Bootloader DTB address: {:#x}", bootarg);

    // ═══════════════════════════════════════
    // 步骤 2: 读取 FDT 头部
    // ═══════════════════════════════════════
    let header_bytes = unsafe {
        core::slice::from_raw_parts(
            bootarg as *const u8,
            core::mem::size_of::<FdtHeader>()
        )
    };

    // 解析头部结构
    let fdt_header = FdtHeader::from_bytes(header_bytes)
        .map_err(|e| format!("Failed to parse FDT header: {:#?}", e))
        .expect("Invalid FDT header");

    // ═══════════════════════════════════════
    // 步骤 3: 验证 Magic Number
    // ═══════════════════════════════════════
    if fdt_header.magic.get() != FDT_VALID_MAGIC {
        error!(
            "FDT magic check failed:\n\
             - Expected: {:#x}\n\
             - Got:      {:#x}",
            FDT_VALID_MAGIC,
            fdt_header.magic.get()
        );
        panic!("Invalid FDT magic number");
    }

    // ═══════════════════════════════════════
    // 步骤 4: 读取完整 FDT
    // ═══════════════════════════════════════
    let total_size = fdt_header.total_size();
    debug!(
        "FDT header validated:\n\
         - Magic: {:#x}\n\
         - Total size: {} bytes\n\
         - Version: {}",
        fdt_header.magic.get(),
        total_size,
        fdt_header.version.get()
    );

    unsafe {
        core::slice::from_raw_parts(bootarg as *const u8, total_size)
    }
}
```

**FDT 头部结构**（`fdt_parser` crate）：

```rust
/// FDT 头部结构（44 字节）
#[repr(C)]
pub struct FdtHeader {
    pub magic: BigEndian<u32>,         // 0x00: Magic (0xd00dfeed)
    pub totalsize: BigEndian<u32>,     // 0x04: 总大小
    pub off_dt_struct: BigEndian<u32>, // 0x08: 结构块偏移
    pub off_dt_strings: BigEndian<u32>,// 0x0C: 字符串块偏移
    pub off_mem_rsvmap: BigEndian<u32>,// 0x10: 内存保留映射偏移
    pub version: BigEndian<u32>,       // 0x14: FDT 版本
    pub last_comp_version: BigEndian<u32>, // 0x18: 最后兼容版本
    pub boot_cpuid_phys: BigEndian<u32>,   // 0x1C: 引导 CPU 物理 ID
    pub size_dt_strings: BigEndian<u32>,   // 0x20: 字符串块大小
    pub size_dt_struct: BigEndian<u32>,    // 0x24: 结构块大小
}

impl FdtHeader {
    /// 解析头部
    pub fn from_bytes(bytes: &[u8]) -> Result<&Self, FdtError> {
        if bytes.len() < core::mem::size_of::<Self>() {
            return Err(FdtError::BadSize);
        }

        unsafe {
            Ok(&*(bytes.as_ptr() as *const Self))
        }
    }

    /// 获取总大小
    pub fn total_size(&self) -> usize {
        self.totalsize.get() as usize
    }
}
```

**Big-Endian 处理**：

```rust
/// FDT 使用大端序（网络字节序）
#[repr(transparent)]
pub struct BigEndian<T>(T);

impl BigEndian<u32> {
    /// 转换为本地字节序
    pub fn get(&self) -> u32 {
        u32::from_be(self.0)
    }
}

// 示例：
// FDT 中存储：0x00 0x01 0x00 0x00（大端序）
// 读取为 u32：0x00010000
```

**错误处理**：

```rust
// 场景 1: Bootloader 未传递 DTB
// bootarg = 0
// -> 读取地址 0 会导致段错误

// 场景 2: DTB 地址错误
// Magic 校验失败
// -> 打印错误信息并 panic

// 场景 3: DTB 损坏
// total_size 过小或过大
// -> 后续解析会失败
```

### FDT 数据结构

**FDT 布局**：

```
┌─────────────────────────────────────┐  ← bootarg (DTB 基地址)
│  FDT Header (44 bytes)              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  magic:         0xd00dfeed          │
│  totalsize:     <total size>        │
│  off_dt_struct: <offset>            │
│  off_dt_strings:<offset>            │
│  ...                                │
├─────────────────────────────────────┤  ← off_mem_rsvmap
│  Memory Reservation Block           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  (address, size) pairs              │
│  terminated by (0, 0)               │
├─────────────────────────────────────┤  ← off_dt_struct
│  Structure Block                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  FDT_BEGIN_NODE                     │
│    "/"                              │
│    FDT_PROP                         │
│      compatible = "..."             │
│    FDT_BEGIN_NODE                   │
│      "cpus"                         │
│      FDT_BEGIN_NODE                 │
│        "cpu@0"                      │
│        FDT_PROP                     │
│          reg = <0x0>                │
│      FDT_END_NODE                   │
│    FDT_END_NODE                     │
│  FDT_END_NODE                       │
│  FDT_END                            │
├─────────────────────────────────────┤  ← off_dt_strings
│  Strings Block                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  "compatible\0"                     │
│  "reg\0"                            │
│  "device_type\0"                    │
│  "rockchip,rk3588\0"                │
│  ...                                │
└─────────────────────────────────────┘  ← bootarg + totalsize
```

**Structure Block Token**：

```rust
const FDT_BEGIN_NODE: u32 = 0x1;  // 开始节点
const FDT_END_NODE: u32 = 0x2;    // 结束节点
const FDT_PROP: u32 = 0x3;        // 属性
const FDT_NOP: u32 = 0x4;         // 空操作
const FDT_END: u32 = 0x9;         // FDT 结束
```

**节点表示**（`fdt_parser` crate）：

```rust
/// FDT 节点
pub struct Node<'a> {
    /// 节点名称（如 "cpu@0"）
    name: &'a str,

    /// 节点层级（1 = 根节点）
    pub level: usize,

    /// 节点数据（原始字节）
    data: &'a [u8],

    /// 字符串块引用
    strings: &'a [u8],
}

impl<'a> Node<'a> {
    /// 获取节点名称
    pub fn name(&self) -> &'a str {
        self.name
    }

    /// 获取属性迭代器
    pub fn propertys(&self) -> PropertyIter<'a> {
        PropertyIter::new(self.data, self.strings)
    }

    /// 获取 'reg' 属性（地址和大小）
    pub fn reg(&self) -> Option<RegIter<'a>> {
        self.property("reg")
            .map(|prop| RegIter::new(prop.raw_value()))
    }

    /// 获取 'compatible' 属性
    pub fn compatible(&self) -> Option<Compatible<'a>> {
        self.property("compatible")
            .map(|prop| Compatible::new(prop.raw_value()))
    }

    /// 查找属性
    pub fn property(&self, name: &str) -> Option<Property<'a>> {
        self.propertys().find(|p| p.name == name)
    }

    /// 获取 phandle
    pub fn phandle(&self) -> Option<Phandle> {
        self.property("phandle")
            .or_else(|| self.property("linux,phandle"))
            .map(|prop| Phandle(prop.u32()))
    }
}
```

**属性表示**：

```rust
/// FDT 属性
pub struct Property<'a> {
    /// 属性名称（如 "reg", "compatible"）
    pub name: &'a str,

    /// 属性值（原始字节）
    value: &'a [u8],
}

impl<'a> Property<'a> {
    /// 获取原始值
    pub fn raw_value(&self) -> &'a [u8] {
        self.value
    }

    /// 作为 u32（大端序转本地序）
    pub fn u32(&self) -> u32 {
        u32::from_be_bytes([
            self.value[0],
            self.value[1],
            self.value[2],
            self.value[3],
        ])
    }

    /// 作为字符串
    pub fn as_str(&self) -> Option<&'a str> {
        core::str::from_utf8(self.value).ok()
    }

    /// 作为 u32 数组
    pub fn as_u32_array(&self) -> impl Iterator<Item = u32> + 'a {
        self.value
            .chunks_exact(4)
            .map(|chunk| u32::from_be_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
    }
}
```

### FDT 解析示例

**遍历所有节点**：

```rust
let fdt_bytes = get_host_fdt();
let fdt = Fdt::from_bytes(fdt_bytes)
    .expect("Failed to parse FDT");

for node in fdt.all_nodes() {
    println!("Node: {} (level: {})", node.name(), node.level);

    for prop in node.propertys() {
        println!("  Property: {}", prop.name);
    }
}
```

**查找 CPU 节点**：

```rust
let cpu_nodes: Vec<_> = fdt.find_nodes("/cpus/cpu").collect();
println!("Found {} CPU nodes", cpu_nodes.len());

for cpu_node in cpu_nodes {
    if let Some(mut reg_iter) = cpu_node.reg() {
        if let Some(reg) = reg_iter.next() {
            println!(
                "CPU {}: MPIDR = {:#x}",
                cpu_node.name(),
                reg.address
            );
        }
    }
}
```

**读取 compatible 属性**：

```rust
let root = fdt.find_node("/").expect("Root node not found");

if let Some(compat) = root.compatible() {
    for comp_str in compat {
        println!("Compatible: {}", comp_str);
    }
}

// 输出示例：
// Compatible: rockchip,rk3588
// Compatible: rockchip,rk3588evb
```

**读取 reg 属性**：

```rust
let uart_node = fdt.find_node("/soc/serial@fe660000")
    .expect("UART not found");

if let Some(mut reg_iter) = uart_node.reg() {
    while let Some(reg) = reg_iter.next() {
        println!(
            "UART region: base={:#x}, size={:#x}",
            reg.address,
            reg.size.unwrap_or(0)
        );
    }
}
```

## CPU 亲和性计算

### ARM MPIDR 寄存器

**MPIDR（Multiprocessor Affinity Register）**：

ARM 处理器使用 MPIDR 寄存器标识每个 CPU 核心：

```
MPIDR_EL1 (64-bit)
┌────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ [63:40]    │ [39:32]     │ [23:16]     │ [15:8]      │ [7:0]       │
│ RES0       │ Aff3        │ Aff2        │ Aff1        │ Aff0        │
└────────────┴─────────────┴─────────────┴─────────────┴─────────────┘

Aff0: 核心 ID（同一个簇内）
Aff1: 簇 ID
Aff2: 集群 ID
Aff3: 保留
```

**RK3588 示例**（8 核处理器）：

```
CPU 0 (Little Core 0): MPIDR = 0x0000_0000
CPU 1 (Little Core 1): MPIDR = 0x0000_0100
CPU 2 (Little Core 2): MPIDR = 0x0000_0200
CPU 3 (Little Core 3): MPIDR = 0x0000_0300
CPU 4 (Big Core 0):    MPIDR = 0x0000_0400
CPU 5 (Big Core 1):    MPIDR = 0x0000_0500
CPU 6 (Big Core 2):    MPIDR = 0x0000_0600
CPU 7 (Big Core 3):    MPIDR = 0x0000_0700
```

### CPU 亲和性计算算法

**set_phys_cpu_sets() 实现**（`kernel/src/vmm/fdt/parser.rs`）：

```rust
/// 从宿主机 FDT 计算 VCpu 到物理 CPU 的亲和性掩码
///
/// # 输入
/// - vm_cfg: VM 配置（将被修改）
/// - fdt: 宿主机 FDT
/// - crate_config: VM 创建配置（包含 phys_cpu_ids）
///
/// # 输出
/// - 填充 vm_cfg.phys_cpu_ls.phys_cpu_sets
pub fn set_phys_cpu_sets(
    vm_cfg: &mut AxVMConfig,
    fdt: &Fdt,
    crate_config: &AxVMCrateConfig,
) {
    // ═══════════════════════════════════════════════════
    // 步骤 1: 获取配置中的物理 CPU ID 列表
    // ═══════════════════════════════════════════════════
    let phys_cpu_ids = crate_config
        .base
        .phys_cpu_ids
        .as_ref()
        .expect("ERROR: phys_cpu_ids not found in config.toml");

    debug!("Requested physical CPU IDs: {:x?}", phys_cpu_ids);

    // ═══════════════════════════════════════════════════
    // 步骤 2: 从宿主机 FDT 提取所有 CPU 节点
    // ═══════════════════════════════════════════════════
    let host_cpus: Vec<_> = fdt.find_nodes("/cpus/cpu").collect();
    info!("Found {} host CPU nodes", host_cpus.len());

    // ═══════════════════════════════════════════════════
    // 步骤 3: 提取每个 CPU 节点的 MPIDR 值
    // ═══════════════════════════════════════════════════
    let cpu_nodes_info: Vec<(String, usize)> = host_cpus
        .iter()
        .filter_map(|cpu_node| {
            // 获取 'reg' 属性（包含 MPIDR 值）
            if let Some(mut cpu_reg) = cpu_node.reg() {
                if let Some(r) = cpu_reg.next() {
                    let cpu_address = r.address as usize;
                    info!(
                        "CPU node: {}, MPIDR: {:#x}",
                        cpu_node.name(),
                        cpu_address
                    );
                    return Some((cpu_node.name().to_string(), cpu_address));
                }
            }
            None
        })
        .collect();

    // ═══════════════════════════════════════════════════
    // 步骤 4: 构建唯一 CPU 地址列表（按 FDT 顺序）
    // ═══════════════════════════════════════════════════
    let mut unique_cpu_addresses = Vec::new();
    for (_, cpu_address) in &cpu_nodes_info {
        if !unique_cpu_addresses.contains(cpu_address) {
            unique_cpu_addresses.push(*cpu_address);
        } else {
            panic!("Duplicate CPU address found: {:#x}", cpu_address);
        }
    }

    // 打印 CPU 索引分配
    for (index, &cpu_address) in unique_cpu_addresses.iter().enumerate() {
        for (cpu_name, node_address) in &cpu_nodes_info {
            if *node_address == cpu_address {
                debug!(
                    "CPU node: {}, MPIDR: {:#x}, assigned index: {}",
                    cpu_name, cpu_address, index
                );
                break;
            }
        }
    }

    // ═══════════════════════════════════════════════════
    // 步骤 5: 计算亲和性掩码
    // ═══════════════════════════════════════════════════
    let mut new_phys_cpu_sets = Vec::new();

    for phys_cpu_id in phys_cpu_ids {
        // 在 unique_cpu_addresses 中查找索引
        if let Some(cpu_index) = unique_cpu_addresses
            .iter()
            .position(|&addr| addr == *phys_cpu_id)
        {
            // 计算位掩码：1 << cpu_index
            let cpu_mask = 1usize << cpu_index;

            new_phys_cpu_sets.push(cpu_mask);

            debug!(
                "VCpu with phys_cpu_id {:#x} -> CPU index {} (mask: {:#x})",
                phys_cpu_id, cpu_index, cpu_mask
            );
        } else {
            error!(
                "phys_cpu_id {:#x} not found in device tree!",
                phys_cpu_id
            );
            panic!("Invalid phys_cpu_id");
        }
    }

    // ═══════════════════════════════════════════════════
    // 步骤 6: 更新 VM 配置
    // ═══════════════════════════════════════════════════
    info!("Calculated phys_cpu_sets: {:?}", new_phys_cpu_sets);

    vm_cfg
        .phys_cpu_ls_mut()
        .set_guest_cpu_sets(new_phys_cpu_sets);

    // 打印最终映射
    debug!(
        "Final VCpu mappings: {:?}",
        vm_cfg.phys_cpu_ls_mut().get_vcpu_affinities_pcpu_ids()
    );
}
```

**算法详解**：

1. **输入**：
   ```
   phys_cpu_ids = [0x0, 0x100, 0x200, 0x300]
   ```

2. **从 FDT 提取**：
   ```
   /cpus/cpu@0:   reg = <0x0>    -> MPIDR = 0x0
   /cpus/cpu@100: reg = <0x100>  -> MPIDR = 0x100
   /cpus/cpu@200: reg = <0x200>  -> MPIDR = 0x200
   /cpus/cpu@300: reg = <0x300>  -> MPIDR = 0x300
   ...
   ```

3. **构建唯一列表**（去重并保持顺序）：
   ```
   unique_cpu_addresses = [0x0, 0x100, 0x200, 0x300, 0x400, ...]
   索引:                   [0,    1,     2,     3,     4,   ...]
   ```

4. **计算掩码**：
   ```
   phys_cpu_id = 0x0   -> index = 0 -> mask = 1 << 0 = 0b0001 = 1
   phys_cpu_id = 0x100 -> index = 1 -> mask = 1 << 1 = 0b0010 = 2
   phys_cpu_id = 0x200 -> index = 2 -> mask = 1 << 2 = 0b0100 = 4
   phys_cpu_id = 0x300 -> index = 3 -> mask = 1 << 3 = 0b1000 = 8
   ```

5. **输出**：
   ```
   phys_cpu_sets = [1, 2, 4, 8]
   ```

**CPU 掩码的含义**：

```
掩码 0b0001 (1)  : 绑定到物理 CPU 索引 0
掩码 0b0010 (2)  : 绑定到物理 CPU 索引 1
掩码 0b0100 (4)  : 绑定到物理 CPU 索引 2
掩码 0b1000 (8)  : 绑定到物理 CPU 索引 3
掩码 0b1111 (15) : 可以在 CPU 0-3 上运行（多个位）
```

**使用掩码**（`kernel/src/vmm/vcpus.rs`）：

```rust
fn alloc_vcpu_task(vm: VMRef, vcpu: VCpuRef) -> AxTaskRef {
    let mut vcpu_task = TaskInner::new(...);

    // 设置 CPU 亲和性
    if let Some(phys_cpu_set) = vcpu.phys_cpu_set() {
        // phys_cpu_set 就是上面计算的掩码
        vcpu_task.set_cpumask(AxCpuMask::from_raw_bits(phys_cpu_set));

        info!(
            "VCpu[{}] pinned to CPU mask: {:#b}",
            vcpu.id(),
            phys_cpu_set
        );
    }

    axtask::spawn_task(vcpu_task)
}
```

### PhysCpuList 详解

**数据结构**（`axvm/src/config.rs`）：

```rust
#[derive(Debug, Default, Clone)]
pub struct PhysCpuList {
    cpu_num: usize,                       // VCpu 总数
    phys_cpu_ids: Option<Vec<usize>>,     // 物理 CPU MPIDR 值
    phys_cpu_sets: Option<Vec<usize>>,    // CPU 亲和性掩码
}
```

**核心方法**：

```rust
impl PhysCpuList {
    /// 返回 (VCpu ID, 亲和性掩码, 物理 ID) 三元组列表
    ///
    /// # 返回值
    /// Vec<(VCpu ID, Option<亲和性掩码>, 物理 CPU ID)>
    ///
    /// # 示例
    /// ```
    /// let mappings = phys_cpu_ls.get_vcpu_affinities_pcpu_ids();
    /// // [
    /// //   (0, Some(1), 0x0),    // VCpu 0 -> 掩码 1, MPIDR 0x0
    /// //   (1, Some(2), 0x100),  // VCpu 1 -> 掩码 2, MPIDR 0x100
    /// //   (2, Some(4), 0x200),  // VCpu 2 -> 掩码 4, MPIDR 0x200
    /// //   (3, Some(8), 0x300),  // VCpu 3 -> 掩码 8, MPIDR 0x300
    /// // ]
    /// ```
    pub fn get_vcpu_affinities_pcpu_ids(&self) -> Vec<(usize, Option<usize>, usize)> {
        let mut vcpu_pcpu_tuples = Vec::new();

        // ═══════════════════════════════════════
        // 验证配置一致性
        // ═══════════════════════════════════════
        if let Some(phys_cpu_ids) = &self.phys_cpu_ids {
            if self.cpu_num != phys_cpu_ids.len() {
                error!(
                    "CPU count mismatch: cpu_num={}, phys_cpu_ids.len()={}",
                    self.cpu_num,
                    phys_cpu_ids.len()
                );
            }
        }

        // ═══════════════════════════════════════
        // 步骤 1: 初始化（vCPU ID, None, VCpu ID）
        // ═══════════════════════════════════════
        for vcpu_id in 0..self.cpu_num {
            vcpu_pcpu_tuples.push((vcpu_id, None, vcpu_id));
        }

        // ═══════════════════════════════════════
        // 步骤 2: 填充亲和性掩码
        // ═══════════════════════════════════════
        if let Some(phys_cpu_sets) = &self.phys_cpu_sets {
            for (vcpu_id, pcpu_mask) in phys_cpu_sets.iter().enumerate() {
                vcpu_pcpu_tuples[vcpu_id].1 = Some(*pcpu_mask);
            }
        }

        // ═══════════════════════════════════════
        // 步骤 3: 填充物理 CPU ID（MPIDR）
        // ═══════════════════════════════════════
        if let Some(phys_cpu_ids) = &self.phys_cpu_ids {
            for (vcpu_id, phys_id) in phys_cpu_ids.iter().enumerate() {
                vcpu_pcpu_tuples[vcpu_id].2 = *phys_id;
            }
        }

        vcpu_pcpu_tuples
    }

    /// 设置亲和性掩码列表
    pub fn set_guest_cpu_sets(&mut self, phys_cpu_sets: Vec<usize>) {
        self.phys_cpu_sets = Some(phys_cpu_sets);
    }

    /// 获取 VCpu 数量
    pub fn cpu_num(&self) -> usize {
        self.cpu_num
    }

    /// 获取物理 CPU ID 列表
    pub fn phys_cpu_ids(&self) -> &Option<Vec<usize>> {
        &self.phys_cpu_ids
    }

    /// 获取亲和性掩码列表
    pub fn phys_cpu_sets(&self) -> &Option<Vec<usize>> {
        &self.phys_cpu_sets
    }
}
```

**使用场景**：

1. **创建 VCpu 任务时设置亲和性**：
   ```rust
   let mappings = vm.get_vcpu_affinities_pcpu_ids();
   for (vcpu_id, affinity, _) in mappings {
       let vcpu_task = create_vcpu_task(...);
       if let Some(mask) = affinity {
           vcpu_task.set_cpumask(AxCpuMask::from_raw_bits(mask));
       }
   }
   ```

2. **CpuUp 时查找 VCpu ID**：
   ```rust
   // 客户机调用 PSCI CPU_ON，传递物理 CPU ID
   let target_cpu = 0x100;  // MPIDR

   let mappings = vm.get_vcpu_affinities_pcpu_ids();
   let target_vcpu_id = mappings.iter()
       .find_map(|(vid, _, pid)| {
           if *pid == target_cpu {
               Some(*vid)
           } else {
               None
           }
       })
       .expect("CPU not found");

   vcpu_on(vm, target_vcpu_id, entry_point, arg);
   ```

3. **调试输出**：
   ```rust
   vm show 0 --full
   // VCpu Affinities:
   //   VCpu[0] -> pCPU[0] (affinity: 0x1, MPIDR: 0x0)
   //   VCpu[1] -> pCPU[1] (affinity: 0x2, MPIDR: 0x100)
   //   VCpu[2] -> pCPU[2] (affinity: 0x4, MPIDR: 0x200)
   //   VCpu[3] -> pCPU[3] (affinity: 0x8, MPIDR: 0x300)
   ```

## 设备发现与依赖分析

### 设备发现概述

**问题背景**：

在设备直通场景中，用户配置文件仅指定根设备节点（如 `/soc/uart@fe660000`），但实际上该设备可能依赖其他设备才能正常工作：

1. **子设备**：设备节点下的后代节点（如 DMA 通道、子控制器）
2. **依赖设备**：通过 phandle 引用的其他设备（如时钟控制器、电源域、复位控制器）

**三阶段**（`find_all_passthrough_devices`）：

```
阶段 1: 发现后代节点
   └─ 输入：用户配置的设备列表
   └─ 输出：所有子设备、孙设备等后代节点

阶段 2: 发现依赖设备
   └─ 输入：阶段 1 的所有设备
   └─ 输出：所有依赖设备（递归解析 phandle 引用）

阶段 3: 移除排除设备
   └─ 输入：阶段 2 的所有设备 + excluded_devices 列表
   └─ 输出：最终的直通设备列表
```

### 数据结构准备

**节点缓存**（`build_optimized_node_cache`）：

构建优化的节点缓存表用于避免多次遍历 FDT 树（O(n²) → O(n)），按完整路径索引节点，加速查找。

**phandle 映射表**（`build_phandle_map`）：

构建 phandle 到节点信息的映射表，数据结构为 `BTreeMap<phandle, (节点路径, #*-cells 属性)>`。

cells 属性包括：
- #clock-cells: 时钟指定器长度
- #reset-cells: 复位指定器长度
- #power-domain-cells: 电源域指定器长度
- #phy-cells: PHY 指定器长度
- 等等

### 阶段 1：后代节点发现

该阶段遍历初始设备列表，对每个设备调用 `get_descendant_nodes_by_path()` 获取所有后代节点。后代节点查找算法在 node_cache 中查找所有以 parent_path 为前缀的节点。

示例：
```
parent_path = "/soc/usb@fc000000"

返回：[
    "/soc/usb@fc000000/phy",
    "/soc/usb@fc000000/connector",
    "/soc/usb@fc000000/port@0",
    "/soc/usb@fc000000/port@0/endpoint",
]
```

####阶段 2：依赖设备发现

使用工作队列算法递归查找所有依赖设备。对于每个设备，调用 `find_device_dependencies()` 查找其通过 phandle 引用的依赖设备，然后将这些依赖设备加入工作队列继续处理，直到队列为空。

处理的属性包括：
- clocks: 时钟依赖
- power-domains: 电源域依赖
- resets: 复位控制器依赖
- phys: PHY 依赖
- *-supply: 电源供应依赖
- *-gpios: GPIO 依赖
- dmas: DMA 依赖
- 等等

**phandle 属性解析**支持三种格式：
1. 单 phandle: `<phandle>`
2. phandle + 指定符: `<phandle specifier1 specifier2 ...>`
3. 多 phandle 引用: `<phandle1 spec1 spec2 phandle2 spec1 spec2 ...>`

**cells 数量计算**根据属性名称和目标节点的 cells 信息确定需要的 cells 数量，例如：
- clocks → #clock-cells
- resets → #reset-cells
- power-domains → #power-domain-cells
- phys → #phy-cells

### 阶段 3：排除设备处理

该阶段处理 excluded_devices 列表：
1. 查找排除设备的所有后代
2. 合并所有设备名称列表
3. 从最终列表中移除排除设备及其后代
4. 移除根节点 "/"

## 客户机 DTB 生成

### DTB 生成概述

**目标**：从宿主机 FDT 提取必要节点，生成客户机专用的 DTB。

**生成策略**：

节点包含规则：
1. 根节点 "/"：必须包含
2. CPU 节点：仅包含 phys_cpu_ids 指定的 CPU
3. 内存节点：跳过（稍后根据 VM 实际内存动态添加）
4. 直通设备节点：包含（来自设备发现阶段）
5. 设备后代节点：包含（子节点、孙节点等）
6. 设备祖先节点：包含（父节点、祖父节点等，用于维护树结构）
7. 其他节点：跳过

### DTB 生成实现

主函数 `crate_guest_fdt()` 遍历所有节点，根据 `determine_node_action()` 返回的动作选择性包含节点：

**节点动作枚举**：
- Skip：跳过节点
- RootNode：根节点
- CpuNode：CPU 节点
- IncludeAsPassthroughDevice：直通设备节点
- IncludeAsChildNode：直通设备的子节点
- IncludeAsAncestorNode：直通设备的祖先节点

**CPU 节点过滤**：
1. /cpus 节点：总是包含
2. /cpus/cpu@* 节点：仅包含 phys_cpu_ids 中指定的 CPU

**节点层级处理**：当节点层级降低时（从子节点回到父节点），需要结束中间的所有节点以确保正确的 FDT 结构。

### 内存节点更新

客户机 DTB 生成后，内存节点需要根据 VM 实际分配的内存动态添加。这在镜像加载时通过 `update_fdt()` 完成。

**添加内存节点** DTB 格式：
```dts
memory {
    device_type = "memory";
    reg = <address_high address_low size_high size_low>;
};
```

**DTB 加载地址计算**策略：
1. 如果配置中已指定 dtb_load_gpa 且不是恒等映射：使用配置值
2. 否则：计算为内存末尾 - DTB 大小，2MB 对齐

计算示例：
```
VM 内存配置：memory_regions = [[0x8000_0000, 0x1000_0000, 0x7, 0]]  # 256MB
DTB 大小：0x5000  # 20KB
计算结果：0x8fe00000
```

### 用户提供 DTB 的处理

用户可能提供自己的 DTB 文件（通过 `dtb_path` 配置），此时需要更新其中的 CPU 节点。`update_cpu_node()` 的策略是：
1. 从用户 DTB 复制所有非 CPU 节点
2. 从宿主机 FDT 复制过滤后的 CPU 节点

## 设备地址和中断解析

### 解析概述

生成的客户机 DTB 包含设备节点，但配置结构（`AxVMConfig`）需要提取设备的物理地址和中断信息，用于：
1. **内存映射**：建立设备寄存器区域的 GPA → HPA 映射
2. **中断注入**：配置 vGIC，转发设备中断到客户机

### 设备地址解析

`parse_passthrough_devices_address()` 遍历所有节点，提取 reg 属性。

**reg 属性格式**：
```dts
// 单个区域
reg = <0x0 0xfe660000 0x0 0x100>;
//     高32位 低32位   大小高 大小低

// 多个区域
reg = <0x0 0xfe660000 0x0 0x100>,   // 区域 0
      <0x0 0xfe661000 0x0 0x1000>;  // 区域 1
```

对于多区域设备，第一个区域使用设备名称，后续区域使用 `{name}-region{index}` 格式。

### 中断解析

`parse_vm_interrupt()` 遍历所有节点，提取 interrupts 属性。

**interrupts 属性格式**：
```dts
interrupts = <GIC_SPI 103 IRQ_TYPE_LEVEL_HIGH>;
//           类型     编号  触发方式

// 原始数据格式（大端序）：
// [0x00000000, 0x00000067, 0x00000004]
//  类型 (0 = SPI)  中断号 (103)  标志 (LEVEL_HIGH)
```

每个中断占 3 个 u32：(type, number, flags)。仅提取 type = 0 (SPI) 的中断，结果去重并排序后存入 `vm_cfg.spi_list`。

## 性能优化和缓存策略

### DTB 缓存机制

DTB 生成是计算密集型操作，对于相同配置不应重复生成。使用全局 DTB 缓存 `GENERATED_DTB_CACHE` 存储生成的 DTB，以 VM ID 为键。

缓存流程：
```
VM 初始化
    ├─→ handle_fdt_operations()
    │   ├─ setup_guest_fdt_from_vmm()
    │   │   ├─ crate_guest_fdt()  ← 生成 DTB
    │   │   └─ crate_guest_fdt_with_cache()  ← 存入缓存
    │   └─ parse_passthrough_devices_address()
    │       └─ get_vm_dtb_arc()  ← 从缓存读取
    └─→ 镜像加载
        └─ update_fdt()
            └─ get_vm_dtb_arc()  ← 从缓存读取
```

## 调试工具

### FDT 打印工具

`print_fdt()` 和 `print_guest_fdt()` 提供调试输出，遍历所有节点并格式化打印。对于常见属性（reg、compatible、phandle）提供特殊处理，其他属性显示原始十六进制数据（前 16 字节）。

### 设备发现日志

关键日志点：
- 阶段 1：`trace` 级别记录后代节点发现
- 阶段 2：`trace` 级别记录依赖分析，`debug` 级别记录 phandle 解析
- 阶段 3：`info` 级别记录排除设备
- 最终结果：`info` 级别记录总设备数和新增数

日志级别使用：
- `trace`：详细的节点遍历信息
- `debug`：phandle 解析、依赖查找
- `info`：阶段完成、最终结果
- `warn`：数据格式错误、预期外情况
- `error`：严重错误（解析失败、重复路径）

---
