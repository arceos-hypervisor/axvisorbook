---
sidebar_position: 3
---

# 构建流程

Axvisor 的构建流程是一个高度复杂但设计精良的系统，它需要处理多平台支持、多种配置选项和复杂的依赖关系。整个构建流程从配置管理开始，经过代码生成、编译、链接，最终生成可运行的二进制文件。

## 工作空间结构

Axvisor 使用 Cargo 工作空间来管理多个相关 crate，这是 Rust 生态系统中管理大型项目的标准方式。通过工作空间，可以将项目分解为多个逻辑独立的模块，每个模块有自己的 `Cargo.toml` 文件，但共享同一个依赖解析和构建流程。

```toml
[workspace]
members = [
  "crates/*",
  "modules/*",
  "platform/*",
  "xtask",
  "kernel",
]
resolver = "3"
```

这种结构有几个重要优势：
- **模块化**：不同功能模块可以独立开发和测试
- **依赖管理**：工作空间确保所有 crate 使用相同版本的依赖
- **构建优化**：可以并行构建多个 crate，提高构建效率
- **代码共享**：模块之间可以轻松共享代码和类型定义

工作空间中的每个目录都有特定的用途：
- `crates/`：包含项目的核心功能库
- `modules/`：包含 ArceOS 相关的模块
- `platform/`：包含平台特定的代码
- `xtask/`：构建工具本身
- `kernel/`：内核主代码

## 构建配置

Axvisor 的构建配置系统是其最复杂的部分之一，需要支持多种硬件平台、不同的虚拟机配置和灵活的构建选项。配置系统采用分层设计，从全局默认配置到板级特定配置，再到虚拟机配置，每一层都可以覆盖和扩展上一层的设置。

### 板级配置

项目支持多种开发板的配置，存储在 [`configs/board/`](https://github.com/arceos-hypervisor/axvisor/tree/next/configs/board/) 目录下。每个开发板都有自己的特定配置，包括目标架构、编译特性、调试选项等。这种设计使得同一个代码库可以支持多种不同的硬件平台，而无需修改核心代码。

支持的开发板包括：
- [`qemu-aarch64.toml`](https://github.com/arceos-hypervisor/axvisor/tree/next/configs/board/qemu-aarch64.toml)：QEMU 模拟的 ARM64 平台
- [`orangepi-5-plus.toml`](https://github.com/arceos-hypervisor/axvisor/tree/next/configs/board/orangepi-5-plus.toml)：Orange Pi 5 Plus 开发板
- [`phytiumpi.toml`](https://github.com/arceos-hypervisor/axvisor/tree/next/configs/board/phytiumpi.toml)：Phytium Pi 开发板
- [`roc-rk3568-pc.toml`](https://github.com/arceos-hypervisor/axvisor/tree/next/configs/board/roc-rk3568-pc.toml)：ROC-RK3568-PC 开发板

每个板级配置文件定义了目标架构、特性、日志级别等构建参数：

```toml
cargo_args = []
features = [
    "ept-level-4",
    "axstd/myplat",
    "axstd/bus-mmio",
]
log = "Info"
target = "aarch64-unknown-none-softfloat"
to_bin = true
vm_configs = []
```

这些配置参数控制着构建过程的各个方面：
- `cargo_args`：传递给 Cargo 的额外参数
- `features`：启用的 Rust 特性标志
- `log`：日志级别设置
- `target`：目标三元组，定义目标架构和系统
- `to_bin`：是否生成二进制文件
- `vm_configs`：虚拟机配置文件列表

### 虚拟机配置

虚拟机配置存储在 [`configs/vms/`](https://github.com/arceos-hypervisor/axvisor/tree/next/configs/vms/) 目录下，定义了每个虚拟机的详细参数。这些配置比板级配置更加详细，包括内存布局、设备配置、中断处理等虚拟化相关的设置。每个虚拟机配置文件都包含了虚拟机的完整定义：

```toml
[base]
id = 1
name = "arceos-qemu"
vm_type = 1
cpu_num = 1
phys_cpu_ids = [0]

[kernel]
entry_point = 0x8020_0000
image_location = "memory"
kernel_path = "/tmp/axvisor/qemu_arceos_aarch64/qemu-aarch64"
kernel_load_addr = 0x8020_0000
```

虚拟机配置分为几个主要部分：
- `base`：基本信息，包括虚拟机 ID、名称、类型和 CPU 配置
- `kernel`：内核相关配置，包括入口点、镜像位置和加载地址
- `memory_regions`：内存区域定义，指定虚拟机的内存布局
- `devices`：设备配置，包括直通设备和模拟设备
- `interrupt_mode`：中断模式配置

这种详细的配置系统使得 Axvisor 可以支持复杂的虚拟化场景，包括多种客户机操作系统、不同的设备配置和灵活的资源分配。

## 构建脚本

构建脚本是 Axvisor 构建系统的核心，它们在编译时执行，负责生成代码、处理配置和设置编译选项。Axvisor 使用了多个构建脚本，每个都有特定的职责。

### 内核构建脚本

[`kernel/build.rs`](https://github.com/arceos-hypervisor/axvisor/tree/next/kernel/build.rs) 是构建系统的核心组件之一，负责处理最复杂的构建逻辑。这个脚本在内核编译时执行，主要职责包括：

1. **读取虚拟机配置文件**：从环境变量或配置文件中读取虚拟机配置
2. **生成链接脚本**：根据目标架构和平台参数生成适当的链接脚本
3. **处理环境变量**：解析各种环境变量，如 `AXVISOR_SMP` 和 `AXVISOR_VM_CONFIGS`
4. **生成 Rust 代码**：将配置数据嵌入到 Rust 代码中，供运行时使用

关键功能实现：

```rust
fn main() -> anyhow::Result<()> {
    let arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap();
    let mut smp = None;
    if let Ok(s) = std::env::var("AXVISOR_SMP") {
        smp = Some(s.parse::<usize>().unwrap_or(1));
    }

    let platform = if arch == "aarch64" {
        "aarch64-generic".to_string()
    } else if arch == "x86_64" {
        "x86-qemu-q35".to_string()
    } else {
        "dummy".to_string()
    };

    println!("cargo:rustc-cfg=platform=\"{platform}\"");

    if platform != "dummy" {
        gen_linker_script(&arch, platform.as_str(), smp.unwrap_or(1)).unwrap();
    }

    // 处理虚拟机配置...
}
```

这个构建脚本展示了 Rust 构建系统的强大功能：它可以读取环境变量、执行复杂的逻辑、生成文件，并通过 `println!` 宏向 Cargo 发送指令。这些指令可以影响编译过程，比如设置 `cfg` 条件编译标志。

### 链接脚本生成

链接脚本是构建过程中最关键的部分之一，它定义了最终二进制文件的内存布局。Axvisor 需要支持多种架构和平台，每种都有不同的内存布局要求，因此构建系统必须能够动态生成适当的链接脚本。

构建系统根据目标架构和平台参数动态生成链接脚本：

```rust
fn gen_linker_script(arch: &str, platform: &str, smp: usize) -> io::Result<()> {
    let fname = format!("linker_{platform}.lds");
    let output_arch = if arch == "x86_64" {
        "i386:x86-64"
    } else if arch.contains("riscv") {
        "riscv"
    } else {
        arch
    };
    let ld_content = std::fs::read_to_string("../scripts/lds/linker.lds.S")?;
    let ld_content = ld_content.replace("%ARCH%", output_arch);
    let ld_content = ld_content.replace("%KERNEL_BASE%", &format!("{:#x}", 0x800000000000usize));
    let ld_content = ld_content.replace("%SMP%", &format!("{smp}",));

    // 写入生成的链接脚本...
}
```

这个过程展示了构建系统的灵活性：它使用模板文件（`linker.lds.S`），然后根据目标架构和运行时参数替换占位符，生成最终的链接脚本。这种方法避免了为每个平台维护单独的链接脚本，减少了维护工作量和出错的可能性。

### 链接脚本模板

[`scripts/lds/linker.lds.S`](https://github.com/arceos-hypervisor/axvisor/tree/next/scripts/lds/linker.lds.S) 是链接脚本的模板，使用占位符支持参数化。这个模板定义了内核的内存布局，包括各个段的排列、对齐要求和符号定义。

```ld
OUTPUT_ARCH(%ARCH%)

BASE_ADDRESS = %KERNEL_BASE%;
SMP = %SMP%

ENTRY(_start)
SECTIONS
{
    . = BASE_ADDRESS;
    _skernel = .;

    .text : ALIGN(4K) {
        _stext = .;
        *(.text.boot)
        *(.text .text.*)
        . = ALIGN(4K);
        _etext = .;
    }
    
    // 其他段定义...
}
```

这个链接脚本模板有几个重要特点：
- **参数化**：使用 `%ARCH%`、`%KERNEL_BASE%` 和 `%SMP%` 等占位符，允许在构建时定制
- **段对齐**：所有段都按 4K 边界对齐，这是页面大小对齐的要求
- **符号定义**：定义了 `_stext`、`_etext` 等符号，供运行时代码使用
- **特殊段**：包含了 `.percpu` 段，用于支持多核处理器的 per-cpu 数据

这种设计使得同一个链接脚本模板可以支持多种不同的配置，大大简化了构建系统的复杂性。
