---
sidebar_position: 2
---


# 客户机配置

## 配置体系架构

### 三层配置模型

AxVisor 采用**分层配置架构**，将用户友好的声明式配置（TOML）转换为高效的运行时配置：

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: TOML 文件                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  功能：                                                          │
│  • 用户可编辑的配置文件                                          │
│  • 支持注释、可选字段、默认值                                    │
│  • 人类可读的声明式语法                                          │
│                                                                  │
│  示例：                                                          │
│  [base]                                                          │
│  id = 1                                                          │
│  name = "linux-qemu"                                             │
│  cpu_num = 4                                                     │
│  phys_cpu_ids = [0x0, 0x100, 0x200, 0x300]                      │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           │ serde_toml::from_str()
                           │ (反序列化，类型检查)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: AxVMCrateConfig (axvmconfig crate)                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  功能：                                                          │
│  • TOML 的 Rust 类型表示                                         │
│  • 保留所有 TOML 字段（包括可选字段）                            │
│  • 由 serde 自动反序列化                                         │
│  • 可序列化回 TOML（双向转换）                                   │
│                                                                  │
│  结构：                                                          │
│  pub struct AxVMCrateConfig {                                    │
│      pub base: BaseConfig,        // [base] section             │
│      pub kernel: KernelConfig,    // [kernel] section           │
│      pub devices: DeviceConfig,   // [devices] section          │
│  }                                                               │
│                                                                  │
│  特点：                                                          │
│  • 字段使用 Option<T> 表示可选项                                 │
│  • 包含嵌套结构体（BaseConfig, KernelConfig 等）                │
│  • 实现 Deserialize trait（serde 自动派生）                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           │ From<AxVMCrateConfig> for AxVMConfig
                           │ (字段转换，计算派生值，类型转换)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: AxVMConfig (axvm crate)                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  功能：                                                          │
│  • 运行时配置结构                                                │
│  • 所有字段已填充、验证、计算                                     │
│  • 用于 VM 创建和运行                                            │
│  • 支持动态修改（通过 with_config）                              │
│                                                                  │
│  结构：                                                          │
│  pub struct AxVMConfig {                                         │
│      id: usize,                                                  │
│      name: String,                                               │
│      vm_type: VMType,                                            │
│      phys_cpu_ls: PhysCpuList,        // CPU 管理结构            │
│      cpu_config: AxVCpuConfig,        // VCpu 配置               │
│      image_config: VMImageConfig,     // 镜像加载地址            │
│      emu_devices: Vec<EmulatedDeviceConfig>,                     │
│      pass_through_devices: Vec<PassThroughDeviceConfig>,         │
│      spi_list: Vec<u32>,              // 运行时填充              │
│      interrupt_mode: VMInterruptMode,                            │
│  }                                                               │
│                                                                  │
│  特点：                                                          │
│  • 使用具体类型代替 Option（已验证的值）                        │
│  • 包含派生字段（如 spi_list 由 FDT 解析填充）                  │
│  • 地址类型转换为 GuestPhysAddr                                 │
│  • 提供运行时修改接口                                            │
└─────────────────────────────────────────────────────────────────┘
```

**设计优势**：

1. **关注点分离**：
   - Layer 1：用户关注点（易读、易写）
   - Layer 2：序列化关注点（类型安全、验证）
   - Layer 3：运行时关注点（性能、内存布局）

2. **类型安全**：
   - TOML 字符串 → Rust 类型（编译时检查）
   - `usize` → `GuestPhysAddr`（防止地址误用）
   - `Vec<String>` → `BTreeMap<usize, DeviceConfig>`（加速查找）

3. **灵活性**：
   - 可选字段在 Layer 2 保留为 `Option<T>`
   - 必需字段在 Layer 3 转换为 T
   - 运行时可动态修改 Layer 3

### 关键结构体详解

**Layer 2: AxVMCrateConfig**（`axvmconfig` crate）

```rust
/// TOML 配置的直接表示
/// 所有字段都是公开的，便于 serde 反序列化
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AxVMCrateConfig {
    pub base: BaseConfig,
    pub kernel: KernelConfig,
    pub devices: DeviceConfig,
}

/// [base] section: 基本配置
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct BaseConfig {
    /// VM 唯一标识符 (0-255)
    pub id: usize,

    /// VM 名称（用于日志和显示）
    pub name: String,

    /// 虚拟化类型：1 = 完全虚拟化
    pub vm_type: u8,

    /// VCpu 数量
    pub cpu_num: usize,

    /// 物理 CPU MPIDR 值（ARM 特定）
    /// 长度必须等于 cpu_num
    pub phys_cpu_ids: Option<Vec<usize>>,

    /// CPU 亲和性掩码（已弃用，由 FDT 计算）
    #[deprecated]
    pub phys_cpu_sets: Option<Vec<usize>>,
}

/// [kernel] section: 内核和镜像配置
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct KernelConfig {
    /// 内核入口点（vCPU PC 寄存器初始值）
    pub entry_point: usize,

    /// 镜像位置："memory" 或 "fs"
    pub image_location: Option<String>,

    /// 内核镜像路径
    pub kernel_path: String,

    /// 内核加载地址（GPA）
    pub kernel_load_addr: usize,

    /// DTB 文件路径（可选）
    pub dtb_path: Option<String>,

    /// DTB 加载地址（可选，未指定则自动计算）
    pub dtb_load_addr: Option<usize>,

    /// BIOS 文件路径（可选，用于 UEFI 启动）
    pub bios_path: Option<String>,

    /// BIOS 加载地址（可选）
    pub bios_load_addr: Option<usize>,

    /// Ramdisk 文件路径（可选）
    pub ramdisk_path: Option<String>,

    /// Ramdisk 加载地址（可选）
    pub ramdisk_load_addr: Option<usize>,

    /// 内存区域列表（至少一个）
    pub memory_regions: Vec<VmMemConfig>,
}

/// 内存区域配置
/// TOML 数组格式：[GPA, 大小, 标志, 映射类型]
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct VmMemConfig {
    pub gpa: usize,               // Guest Physical Address
    pub size: usize,              // 区域大小（字节）
    pub flags: usize,             // ARM 页表标志（RWX）
    pub map_type: VmMemMappingType,  // 映射类型
}

/// 内存映射类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[repr(u8)]
pub enum VmMemMappingType {
    MapAlloc = 0,      // 分配新物理内存
    MapIdentical = 1,  // 恒等映射（GPA = HPA）
    MapReserved = 2,   // 映射保留的物理地址
}

/// [devices] section: 设备配置
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DeviceConfig {
    /// 模拟设备列表
    pub emu_devices: Vec<EmulatedDeviceConfig>,

    /// 直通设备列表
    /// 格式 1: [["/soc/serial@fe660000"]]（FDT 路径）
    /// 格式 2: [["uart", 0xfe660000, 0xfe660000, 0x10000, 23]]（手动配置）
    pub passthrough_devices: Vec<PassThroughDeviceConfig>,

    /// 排除设备列表（不直通的设备）
    pub excluded_devices: Vec<Vec<String>>,

    /// 直通地址列表（不依赖 FDT）
    pub passthrough_addresses: Vec<PassThroughAddressConfig>,

    /// 中断模式："passthrough" 或 "emulated"
    pub interrupt_mode: VMInterruptMode,
}
```

**Layer 3: AxVMConfig**（`axvm` crate）

```rust
/// 运行时 VM 配置
/// 所有字段都是私有的，通过方法访问
#[derive(Debug)]
pub struct AxVMConfig {
    // ═══════════════════════════════════════
    // 基本信息（不可变）
    // ═══════════════════════════════════════
    id: usize,
    name: String,
    vm_type: VMType,

    // ═══════════════════════════════════════
    // CPU 配置
    // ═══════════════════════════════════════
    /// CPU 列表管理器
    /// 封装 cpu_num、phys_cpu_ids、phys_cpu_sets
    phys_cpu_ls: PhysCpuList,

    /// VCpu 配置（BSP/AP 入口地址）
    pub cpu_config: AxVCpuConfig,

    // ═══════════════════════════════════════
    // 镜像配置（运行时可修改）
    // ═══════════════════════════════════════
    /// 镜像加载地址配置
    /// 可通过 with_config 修改（如恒等映射调整）
    pub image_config: VMImageConfig,

    // ═══════════════════════════════════════
    // 设备配置（运行时可修改）
    // ═══════════════════════════════════════
    emu_devices: Vec<EmulatedDeviceConfig>,
    pass_through_devices: Vec<PassThroughDeviceConfig>,
    excluded_devices: Vec<Vec<String>>,
    pass_through_addresses: Vec<PassThroughAddressConfig>,

    /// SPI 中断列表（运行时由 FDT 解析填充）
    spi_list: Vec<u32>,

    interrupt_mode: VMInterruptMode,
}

/// VCpu 配置
#[derive(Clone, Copy, Debug, Default)]
pub struct AxVCpuConfig {
    /// BSP（Bootstrap Processor）入口地址
    pub bsp_entry: GuestPhysAddr,

    /// AP（Application Processor）入口地址
    pub ap_entry: GuestPhysAddr,
}

/// 镜像加载地址配置
#[derive(Debug, Default, Clone)]
pub struct VMImageConfig {
    pub kernel_load_gpa: GuestPhysAddr,
    pub bios_load_gpa: Option<GuestPhysAddr>,
    pub dtb_load_gpa: Option<GuestPhysAddr>,
    pub ramdisk_load_gpa: Option<GuestPhysAddr>,
}

/// CPU 列表管理器
#[derive(Debug, Default, Clone)]
pub struct PhysCpuList {
    cpu_num: usize,
    phys_cpu_ids: Option<Vec<usize>>,   // ARM MPIDR 值
    phys_cpu_sets: Option<Vec<usize>>,  // CPU 亲和性掩码
}
```

**GuestPhysAddr 类型**（类型安全的地址）：

```rust
/// 客户机物理地址（GPA）
/// 使用 newtype 模式防止地址误用
#[repr(transparent)]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord)]
pub struct GuestPhysAddr(usize);

impl GuestPhysAddr {
    /// 创建 GPA
    pub fn from_usize(addr: usize) -> Self {
        Self(addr)
    }

    /// 转换为 usize
    pub fn as_usize(&self) -> usize {
        self.0
    }

    /// 2MB 向下对齐
    pub fn align_down(&self, align: usize) -> Self {
        Self(self.0 & !(align - 1))
    }

    /// 2MB 向上对齐
    pub fn align_up(&self, align: usize) -> Self {
        Self((self.0 + align - 1) & !(align - 1))
    }

    /// 偏移
    pub fn offset(&self, offset: isize) -> Self {
        Self((self.0 as isize + offset) as usize)
    }
}

// 支持算术运算
impl std::ops::Add<usize> for GuestPhysAddr {
    type Output = Self;
    fn add(self, rhs: usize) -> Self {
        Self(self.0 + rhs)
    }
}

impl std::ops::Sub<usize> for GuestPhysAddr {
    type Output = Self;
    fn sub(self, rhs: usize) -> Self {
        Self(self.0 - rhs)
    }
}

// 从 usize 隐式转换
impl From<usize> for GuestPhysAddr {
    fn from(addr: usize) -> Self {
        Self(addr)
    }
}
```

**VMType 枚举**：

```rust
/// 虚拟化类型
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VMType {
    /// 完全虚拟化（Full Virtualization）
    /// 客户机不知道自己运行在虚拟环境中
    VmTFull = 1,

    // 未来扩展：
    // VmTPara = 2,  // 半虚拟化
    // VmTContainer = 3,  // 容器
}

impl From<u8> for VMType {
    fn from(val: u8) -> Self {
        match val {
            1 => VMType::VmTFull,
            _ => panic!("Invalid VM type: {}", val),
        }
    }
}
```

## TOML 解析流程

### 文件发现和加载

**静态配置加载**（编译时嵌入，`kernel/src/vmm/config.rs`）：

```rust
// ═══════════════════════════════════════════════════
// build.rs 生成的代码（位于 OUT_DIR/vm_configs.rs）
// ═══════════════════════════════════════════════════

/// 返回静态嵌入的 VM 配置字符串
pub fn static_vm_configs() -> Vec<&'static str> {
    vec![
        // include_str! 在编译时将文件内容嵌入二进制
        include_str!("../configs/vms/linux-aarch64-qemu-smp1.toml"),
        include_str!("../configs/vms/linux-aarch64-rk3588-smp8.toml"),
        include_str!("../configs/vms/arceos-aarch64-rk3568-smp2.toml"),
        // ... 更多配置文件
    ]
}

/// 返回静态嵌入的 VM 镜像
pub fn get_memory_images() -> Vec<VMImages> {
    vec![
        VMImages {
            id: 1,
            // include_bytes! 在编译时嵌入二进制文件
            kernel: include_bytes!("../tmp/Image"),
            dtb: Some(include_bytes!("../tmp/linux.dtb")),
            bios: None,
            ramdisk: None,
        },
        VMImages {
            id: 2,
            kernel: include_bytes!("../tmp/arceos.bin"),
            dtb: Some(include_bytes!("../tmp/arceos.dtb")),
            bios: None,
            ramdisk: None,
        },
    ]
}

/// 镜像结构体
pub struct VMImages {
    pub id: usize,
    pub kernel: &'static [u8],
    pub dtb: Option<&'static [u8]>,
    pub bios: Option<&'static [u8]>,
    pub ramdisk: Option<&'static [u8]>,
}
```

**build.rs 实现**（自动扫描配置文件）：

```rust
// build.rs（项目根目录）

use std::env;
use std::fs;
use std::path::Path;

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("vm_configs.rs");

    // 扫描 configs/vms/ 目录
    let config_dir = Path::new("configs/vms");
    let mut config_files = Vec::new();

    if config_dir.exists() {
        for entry in fs::read_dir(config_dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("toml") {
                config_files.push(path);
            }
        }
    }

    // 生成代码
    let mut code = String::from("pub fn static_vm_configs() -> Vec<&'static str> {\n    vec![\n");

    for config_file in &config_files {
        code.push_str(&format!(
            "        include_str!(\"{}\"),\n",
            config_file.display()
        ));
    }

    code.push_str("    ]\n}\n");

    fs::write(&dest_path, code).unwrap();

    // 重新构建触发器
    println!("cargo:rerun-if-changed=configs/vms/");
}
```

**动态配置加载**（运行时从文件系统，需要 `fs` feature）：

```rust
#[cfg(feature = "fs")]
pub fn filesystem_vm_configs() -> Vec<String> {
    use axstd::fs;
    use axstd::io::{BufReader, Read};

    let config_dir = "/guest/vm_default";
    let mut configs = Vec::new();

    debug!("Scanning VM configs from: {}", config_dir);

    // ═══════════════════════════════════════
    // 步骤 1: 读取目录
    // ═══════════════════════════════════════
    let entries = match fs::read_dir(config_dir) {
        Ok(entries) => {
            info!("Found config directory: {}", config_dir);
            entries
        }
        Err(e) => {
            info!("Config directory not found: {} ({})", config_dir, e);
            return configs;
        }
    };

    // ═══════════════════════════════════════
    // 步骤 2: 过滤 .toml 文件
    // ═══════════════════════════════════════
    for entry in entries.flatten() {
        let path = entry.path();
        let path_str = path.as_str();

        debug!("Considering file: {}", path_str);

        // 仅处理 .toml 文件
        if !path_str.ends_with(".toml") {
            debug!("Skipping non-TOML file: {}", path_str);
            continue;
        }

        // ═══════════════════════════════════════
        // 步骤 3: 读取文件内容
        // ═══════════════════════════════════════
        let toml_file = match fs::File::open(path_str) {
            Ok(file) => file,
            Err(e) => {
                error!("Failed to open {}: {:?}", path_str, e);
                continue;
            }
        };

        let file_size = match toml_file.metadata() {
            Ok(meta) => meta.len() as usize,
            Err(e) => {
                error!("Failed to get metadata of {}: {:?}", path_str, e);
                continue;
            }
        };

        info!("Reading config file: {} (size: {} bytes)", path_str, file_size);

        // 检查空文件
        if file_size == 0 {
            warn!("Empty config file: {}", path_str);
            continue;
        }

        // 读取文件内容到缓冲区
        let mut file = BufReader::new(toml_file);
        let mut buffer = vec![0u8; file_size];

        if let Err(e) = file.read_exact(&mut buffer) {
            error!("Failed to read {}: {:?}", path_str, e);
            continue;
        }

        // ═══════════════════════════════════════
        // 步骤 4: UTF-8 验证
        // ═══════════════════════════════════════
        let content = match String::from_utf8(buffer) {
            Ok(s) => s,
            Err(e) => {
                error!("Invalid UTF-8 in {}: {:?}", path_str, e);
                continue;
            }
        };

        // ═══════════════════════════════════════
        // 步骤 5: 快速验证必需字段
        // ═══════════════════════════════════════
        // 避免完整 TOML 解析，仅检查关键字段是否存在
        if content.contains("[base]")
            && content.contains("[kernel]")
            && content.contains("[devices]")
        {
            configs.push(content);
            info!("✓ Loaded valid config: {}", path_str);
        } else {
            warn!("✗ Invalid config structure in: {}", path_str);
            debug!("Missing required sections: [base], [kernel], or [devices]");
        }
    }

    info!("Loaded {} VM configs from filesystem", configs.len());
    configs
}

// 未启用 fs feature 时的回退实现
#[cfg(not(feature = "fs"))]
pub fn filesystem_vm_configs() -> Vec<String> {
    Vec::new()
}
```

**配置加载优先级**（`init_guest_vms`）：

```rust
pub fn init_guest_vms() {
    // ═══════════════════════════════════════
    // 步骤 1: 初始化 DTB 缓存（仅 aarch64）
    // ═══════════════════════════════════════
    #[cfg(target_arch = "aarch64")]
    {
        init_dtb_cache();
        info!("DTB cache initialized");
    }

    // ═══════════════════════════════════════
    // 步骤 2: 尝试从文件系统加载（优先级最高）
    // ═══════════════════════════════════════
    let mut gvm_raw_configs = config::filesystem_vm_configs();

    if !gvm_raw_configs.is_empty() {
        info!("Using {} filesystem VM configs", gvm_raw_configs.len());
    } else {
        // ═══════════════════════════════════════
        // 步骤 3: 回退到静态配置
        // ═══════════════════════════════════════
        let static_configs = config::static_vm_configs();

        if static_configs.is_empty() {
            info!("No VM configs found");
            info!("Entering shell mode...");
        } else {
            info!("Using {} static VM configs", static_configs.len());
        }

        // 转换 &str -> String
        gvm_raw_configs.extend(
            static_configs.into_iter().map(|s| s.into())
        );
    }

    // ═══════════════════════════════════════
    // 步骤 4: 逐个初始化 VM
    // ═══════════════════════════════════════
    for (index, raw_cfg_str) in gvm_raw_configs.iter().enumerate() {
        debug!("Initializing VM #{} from config:\n{}", index, raw_cfg_str);

        if let Err(e) = init_guest_vm(raw_cfg_str) {
            error!("Failed to initialize VM #{}: {:?}", index, e);
            // 继续处理下一个配置，不中断
        }
    }

    info!("Guest VM initialization complete");
}
```

**配置加载流程图**：

```
启动 VMM
    │
    ▼
init_guest_vms()
    │
    ├─→ [aarch64] init_dtb_cache()
    │
    ├─→ filesystem_vm_configs()
    │   │
    │   ├─→ 文件系统存在？
    │   │   ├─→ 是：读取 /guest/vm_default/*.toml
    │   │   │   └─→ 验证必需字段 → configs
    │   │   └─→ 否：返回空 Vec
    │   │
    │   └─→ configs.is_empty()?
    │       ├─→ 是：回退到 static_vm_configs()
    │       └─→ 否：使用文件系统配置
    │
    └─→ for config in configs:
        └─→ init_guest_vm(config)
            └─→ 解析、创建、初始化 VM
```

### TOML 反序列化详解

**serde 自动反序列化**（`axvmconfig` crate）：

```rust
impl AxVMCrateConfig {
    /// 从 TOML 字符串解析配置
    ///
    /// # 错误处理
    /// - TOML 语法错误：返回 toml::de::Error
    /// - 缺少必需字段：返回 toml::de::Error
    /// - 类型不匹配：返回 toml::de::Error
    pub fn from_toml(toml_str: &str) -> Result<Self, toml::de::Error> {
        // serde_toml 自动将 TOML 映射到结构体
        toml::from_str(toml_str)
    }
}
```

**字段映射示例**：

TOML 输入：
```toml
[base]
id = 1
name = "linux-qemu"
vm_type = 1
cpu_num = 4
phys_cpu_ids = [0x0, 0x100, 0x200, 0x300]
# phys_cpu_sets 未指定
```

Rust 结构体：
```rust
BaseConfig {
    id: 1,
    name: String::from("linux-qemu"),
    vm_type: 1,
    cpu_num: 4,
    phys_cpu_ids: Some(vec![0x0, 0x100, 0x200, 0x300]),
    phys_cpu_sets: None,  // 未在 TOML 中指定
}
```

**嵌套数组解析示例**：

TOML 输入：
```toml
memory_regions = [
    [0x8000_0000, 0x1000_0000, 0x7, 0],  # 256MB RAM
    [0x920_0000, 0x2000, 0xf, 2],        # 8KB 保留区域
]
```

Rust 结构体：
```rust
memory_regions: vec![
    VmMemConfig {
        gpa: 0x8000_0000,
        size: 0x1000_0000,
        flags: 0x7,  // RWX
        map_type: VmMemMappingType::MapAlloc,  // 0 -> MapAlloc
    },
    VmMemConfig {
        gpa: 0x920_0000,
        size: 0x2000,
        flags: 0xf,  // 全权限
        map_type: VmMemMappingType::MapReserved,  // 2 -> MapReserved
    },
]
```

**嵌套结构解析示例**：

TOML 输入：
```toml
[base]
id = 1
name = "test-vm"

[kernel]
entry_point = 0x8020_0000
kernel_path = "Image"

[devices]
interrupt_mode = "passthrough"
```

Rust 结构体：
```rust
AxVMCrateConfig {
    base: BaseConfig {
        id: 1,
        name: String::from("test-vm"),
        // ... 其他字段
    },
    kernel: KernelConfig {
        entry_point: 0x8020_0000,
        kernel_path: String::from("Image"),
        // ... 其他字段
    },
    devices: DeviceConfig {
        interrupt_mode: VMInterruptMode::Passthrough,
        // ... 其他字段
    },
}
```

**枚举类型映射**：

```rust
/// 内存映射类型枚举
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[repr(u8)]
pub enum VmMemMappingType {
    MapAlloc = 0,
    MapIdentical = 1,
    MapReserved = 2,
}

// serde 自动处理整数 -> 枚举转换
// TOML: map_type = 0 -> VmMemMappingType::MapAlloc
// TOML: map_type = 1 -> VmMemMappingType::MapIdentical
// TOML: map_type = 2 -> VmMemMappingType::MapReserved

// 也可以使用字符串（需要额外配置）
#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VMInterruptMode {
    Passthrough,
    Emulated,
}

// TOML: interrupt_mode = "passthrough" -> VMInterruptMode::Passthrough
// TOML: interrupt_mode = "emulated" -> VMInterruptMode::Emulated
```

**错误处理示例**：

```rust
match AxVMCrateConfig::from_toml(toml_str) {
    Ok(config) => {
        info!("Config parsed successfully");
        // 继续处理
    }
    Err(e) => {
        // serde 提供详细的错误信息
        error!("Failed to parse TOML: {}", e);

        // 常见错误类型：
        // - 缺少必需字段: "missing field `id` at line 1"
        // - 类型不匹配: "invalid type: string \"abc\", expected usize at line 5"
        // - 语法错误: "expected `.` or `=`, found `,` at line 3"

        return Err(...);
    }
}
```

### 配置转换流程（Layer 2 → Layer 3）

**From Trait 实现**（`axvm/src/config.rs`）：

```rust
impl From<AxVMCrateConfig> for AxVMConfig {
    fn from(cfg: AxVMCrateConfig) -> Self {
        // ═══════════════════════════════════════════════════
        // 阶段 1: 基本信息直接复制
        // ═══════════════════════════════════════════════════
        let id = cfg.base.id;
        let name = cfg.base.name;
        let vm_type = VMType::from(cfg.base.vm_type);

        // ═══════════════════════════════════════════════════
        // 阶段 2: CPU 配置封装
        // ═══════════════════════════════════════════════════
        // 将分散的 CPU 字段封装到 PhysCpuList
        let phys_cpu_ls = PhysCpuList {
            cpu_num: cfg.base.cpu_num,
            phys_cpu_ids: cfg.base.phys_cpu_ids,
            phys_cpu_sets: cfg.base.phys_cpu_sets,
        };

        // ═══════════════════════════════════════════════════
        // 阶段 3: VCpu 配置（BSP 和 AP 使用相同入口）
        // ═══════════════════════════════════════════════════
        let cpu_config = AxVCpuConfig {
            bsp_entry: GuestPhysAddr::from(cfg.kernel.entry_point),
            ap_entry: GuestPhysAddr::from(cfg.kernel.entry_point),
        };

        // ═══════════════════════════════════════════════════
        // 阶段 4: 镜像加载地址转换
        // ═══════════════════════════════════════════════════
        // usize -> GuestPhysAddr（类型安全）
        // Option<usize> -> Option<GuestPhysAddr>
        let image_config = VMImageConfig {
            kernel_load_gpa: GuestPhysAddr::from(cfg.kernel.kernel_load_addr),
            bios_load_gpa: cfg.kernel.bios_load_addr.map(GuestPhysAddr::from),
            dtb_load_gpa: cfg.kernel.dtb_load_addr.map(GuestPhysAddr::from),
            ramdisk_load_gpa: cfg.kernel.ramdisk_load_addr.map(GuestPhysAddr::from),
        };

        // ═══════════════════════════════════════════════════
        // 阶段 5: 设备配置直接复制
        // ═══════════════════════════════════════════════════
        let emu_devices = cfg.devices.emu_devices;
        let pass_through_devices = cfg.devices.passthrough_devices;
        let excluded_devices = cfg.devices.excluded_devices;
        let pass_through_addresses = cfg.devices.passthrough_addresses;
        let interrupt_mode = cfg.devices.interrupt_mode;

        // ═══════════════════════════════════════════════════
        // 阶段 6: 初始化运行时字段
        // ═══════════════════════════════════════════════════
        // SPI 列表初始为空，稍后由 FDT 解析填充
        let spi_list = Vec::new();

        // ═══════════════════════════════════════════════════
        // 构造最终配置
        // ═══════════════════════════════════════════════════
        Self {
            id,
            name,
            vm_type,
            phys_cpu_ls,
            cpu_config,
            image_config,
            emu_devices,
            pass_through_devices,
            excluded_devices,
            pass_through_addresses,
            spi_list,
            interrupt_mode,
        }
    }
}
```

**类型转换详解**：

1. **基本类型转换**：
   ```rust
   // u8 -> VMType
   let vm_type = VMType::from(cfg.base.vm_type);

   // usize -> GuestPhysAddr
   let kernel_gpa = GuestPhysAddr::from(cfg.kernel.kernel_load_addr);

   // Option<usize> -> Option<GuestPhysAddr>
   let dtb_gpa = cfg.kernel.dtb_load_addr.map(GuestPhysAddr::from);
   ```

2. **结构封装**：
   ```rust
   // 分散字段 -> 封装结构
   let phys_cpu_ls = PhysCpuList {
       cpu_num: cfg.base.cpu_num,
       phys_cpu_ids: cfg.base.phys_cpu_ids,
       phys_cpu_sets: cfg.base.phys_cpu_sets,
   };
   ```

3. **派生字段计算**：
   ```rust
   // BSP 和 AP 使用相同入口（可能稍后修改）
   let cpu_config = AxVCpuConfig {
       bsp_entry: GuestPhysAddr::from(cfg.kernel.entry_point),
       ap_entry: GuestPhysAddr::from(cfg.kernel.entry_point),
   };
   ```

## 配置验证机制

### 编译时验证（类型系统）

```rust
// ✓ 类型系统保证：
// 1. 必需字段必须存在
pub struct BaseConfig {
    pub id: usize,        // 必需
    pub name: String,     // 必需
    pub cpu_num: usize,   // 必需
}

// 2. 可选字段使用 Option<T>
pub struct KernelConfig {
    pub dtb_path: Option<String>,      // 可选
    pub dtb_load_addr: Option<usize>,  // 可选
}

// 3. 枚举类型限制取值范围
#[repr(u8)]
pub enum VmMemMappingType {
    MapAlloc = 0,
    MapIdentical = 1,
    MapReserved = 2,
    // 不可能有其他值
}

// 4. newtype 模式防止类型混淆
pub struct GuestPhysAddr(usize);  // 不能与 usize 混用
pub struct HostPhysAddr(usize);   // 不同的地址类型
```

### 运行时验证

**TOML 反序列化验证**：

```rust
// serde 自动验证：
// - 缺少必需字段
// - 类型不匹配
// - 枚举值超出范围

let config = AxVMCrateConfig::from_toml(toml_str)
    .expect("Failed to parse VM config");
// 如果解析成功，则所有字段都已验证
```

**自定义验证逻辑**（`init_guest_vm`）：

```rust
pub fn init_guest_vm(raw_cfg: &str) -> AxResult<usize> {
    // ═══════════════════════════════════════
    // 步骤 1: 解析配置
    // ═══════════════════════════════════════
    let vm_create_config = AxVMCrateConfig::from_toml(raw_cfg)
        .expect("Failed to parse TOML");

    // ═══════════════════════════════════════
    // 步骤 2: 验证 CPU 配置一致性
    // ═══════════════════════════════════════
    if let Some(phys_cpu_ids) = &vm_create_config.base.phys_cpu_ids {
        if phys_cpu_ids.len() != vm_create_config.base.cpu_num {
            panic!(
                "CPU count mismatch: cpu_num={}, phys_cpu_ids.len()={}. \
                 These must be equal!",
                vm_create_config.base.cpu_num,
                phys_cpu_ids.len()
            );
        }

        // 验证 MPIDR 值唯一性
        let mut seen = std::collections::HashSet::new();
        for &mpidr in phys_cpu_ids {
            if !seen.insert(mpidr) {
                panic!("Duplicate MPIDR value: {:#x}", mpidr);
            }
        }
    }

    // ═══════════════════════════════════════
    // 步骤 3: 验证内存配置
    // ═══════════════════════════════════════
    if vm_create_config.kernel.memory_regions.is_empty() {
        panic!("VM must have at least one memory region");
    }

    // 验证内存地址对齐
    const MB: usize = 1024 * 1024;
    for (i, region) in vm_create_config.kernel.memory_regions.iter().enumerate() {
        if region.gpa % (2 * MB) != 0 {
            panic!(
                "Memory region {} GPA {:#x} must be 2MB aligned",
                i, region.gpa
            );
        }

        if region.size == 0 {
            panic!("Memory region {} has zero size", i);
        }
    }

    // ═══════════════════════════════════════
    // 步骤 4: 验证镜像配置
    // ═══════════════════════════════════════
    match vm_create_config.kernel.image_location.as_deref() {
        Some("memory") | Some("fs") => {
            // 有效的镜像位置
        }
        Some(other) => {
            panic!("Invalid image_location: '{}'. Must be 'memory' or 'fs'", other);
        }
        None => {
            panic!("image_location is required");
        }
    }

    // ═══════════════════════════════════════
    // 步骤 5: 验证设备配置
    // ═══════════════════════════════════════
    match vm_create_config.devices.interrupt_mode {
        VMInterruptMode::Passthrough | VMInterruptMode::Emulated => {
            // 有效的中断模式
        }
        _ => {
            panic!("Invalid interrupt mode");
        }
    }

    // ... 继续创建 VM
}
```

**验证错误示例**：

```rust
// 错误 1: CPU 数量不匹配
[base]
cpu_num = 4
phys_cpu_ids = [0, 1]  # ❌ 长度为 2，与 cpu_num 不符

// Panic: CPU count mismatch: cpu_num=4, phys_cpu_ids.len()=2

// 错误 2: 内存地址未对齐
memory_regions = [
    [0x8000_0001, 0x1000_0000, 0x7, 0],  # ❌ 未 2MB 对齐
]

// Panic: Memory region 0 GPA 0x80000001 must be 2MB aligned

// 错误 3: 内存区域为空
memory_regions = []  # ❌ 至少需要一个

// Panic: VM must have at least one memory region

// 错误 4: 无效的镜像位置
[kernel]
image_location = "network"  # ❌ 不支持

// Panic: Invalid image_location: 'network'. Must be 'memory' or 'fs'
```

## 配置后处理

### 内存地址调整（恒等映射）

**问题背景**：

对于裸机操作系统（如 ArceOS），使用恒等映射（GPA = HPA）时，配置文件中的地址可能不是实际分配的物理地址。需要在运行时调整所有相关地址。

**调整函数**（`kernel/src/vmm/config.rs`）：

```rust
fn config_guest_address(vm: &VM, main_memory: &VMMemoryRegion) {
    const MB: usize = 1024 * 1024;

    vm.with_config(|config| {
        // 仅对恒等映射进行调整
        if !main_memory.is_identical() {
            debug!("Memory is not identical mapping, no adjustment needed");
            return;
        }

        debug!(
            "Adjusting addresses for identical mapping:\n\
             - Original kernel GPA: {:#x}\n\
             - Actual memory GPA:   {:#x}\n\
             - Memory size:         {:#x}",
            config.image_config.kernel_load_gpa.as_usize(),
            main_memory.gpa.as_usize(),
            main_memory.size()
        );

        // ═══════════════════════════════════════
        // 计算内核加载地址
        // ═══════════════════════════════════════
        let mut kernel_addr = main_memory.gpa;

        // 如果有 BIOS，内核地址需要偏移
        if config.image_config.bios_load_gpa.is_some() {
            kernel_addr += 2 * MB;  // BIOS 占用前 2MB
            debug!("BIOS present, kernel offset by 2MB");
        }

        // ═══════════════════════════════════════
        // 更新所有相关地址
        // ═══════════════════════════════════════
        config.image_config.kernel_load_gpa = kernel_addr;
        config.cpu_config.bsp_entry = kernel_addr;
        config.cpu_config.ap_entry = kernel_addr;

        info!(
            "Address adjustment complete:\n\
             - New kernel GPA: {:#x}\n\
             - BSP entry:      {:#x}\n\
             - AP entry:       {:#x}",
            kernel_addr.as_usize(),
            config.cpu_config.bsp_entry.as_usize(),
            config.cpu_config.ap_entry.as_usize()
        );
    });
}
```

**调整示例**：

```
配置文件：
  memory_regions = [[0x4000_0000, 0x800_0000, 0x7, 1]]  # 8MB 恒等映射
  kernel_load_addr = 0x4020_0000
  entry_point = 0x4020_0000

实际分配：
  vm.alloc_memory_region(..., None)
  -> 系统分配物理地址 0x8000_0000

调整后：
  kernel_load_gpa = 0x8020_0000  (0x8000_0000 + 2MB)
  bsp_entry       = 0x8020_0000
  ap_entry        = 0x8020_0000
```

**为什么需要调整**：

1. **恒等映射约束**：裸机 OS 期望 GPA = HPA
2. **物理地址不确定**：实际分配的物理地址由系统决定
3. **地址依赖**：内核加载地址、入口点、BIOS 偏移都相互关联
4. **简化配置**：用户不需要猜测实际物理地址

---