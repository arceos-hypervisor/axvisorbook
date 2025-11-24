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

## 板级配置

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

## 虚拟机配置

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

## 内核构建脚本

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

## 链接脚本生成

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

## 链接脚本模板

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


# 高级特性

Axvisor 的构建系统包含了许多高级特性，这些特性使得它能够处理复杂的虚拟化场景和多平台支持需求。这些特性的设计体现了现代软件开发的最佳实践，特别是在处理复杂的系统级软件时。

## 多架构支持

构建系统支持多种目标架构，这是虚拟机监视器项目的基本要求。每个架构都有特定的编译选项、链接脚本和运行时需求，构建系统必须能够智能地处理这些差异。

支持的目标架构：

- `aarch64-unknown-none-softfloat`：ARM64 架构，无操作系统，软浮点
- `x86_64-unknown-none`：x86_64 架构，无操作系统
- `riscv64gc-unknown-none-elf`：RISC-V 64位架构，通用，无操作系统

通过 `rust-toolchain.toml` 配置：

```toml
[toolchain]
profile = "minimal"
channel = "nightly-2025-05-20"
components = ["rust-src", "llvm-tools", "rustfmt", "clippy"]
targets = ["x86_64-unknown-none", "riscv64gc-unknown-none-elf", "aarch64-unknown-none-softfloat"]
```

这种配置确保了所有开发者使用相同版本的 Rust 工具链，避免了因工具链版本不一致导致的问题。同时，通过指定 `nightly` 版本，项目可以使用最新的 Rust 特性和优化，这对于系统级软件开发特别重要。

多架构支持的实现还包括：
- **条件编译**：使用 `cfg` 属性根据目标架构编译不同的代码
- **架构特定优化**：为不同架构提供特定的编译选项和优化
- **链接脚本适配**：根据架构生成不同的内存布局和链接配置
- **测试覆盖**：确保所有架构的代码都经过充分测试

## 特性管理

项目支持多种构建特性，这些特性控制着编译时包含的功能和优化。特性系统允许同一个代码库支持不同的配置需求，从最小化的嵌入式系统到功能齐全的虚拟化平台。

主要构建特性：

- `ept-level-4`: 4级EPT页表支持，用于大内存虚拟化
- `fs`: 文件系统支持，用于客户机文件访问
- `axstd/myplat`: 自定义平台支持，用于特定硬件平台
- `axstd/bus-mmio`: MMIO总线支持，用于内存映射I/O设备

特性系统的设计使得开发者可以根据具体需求定制构建，减少不必要的代码和内存占用。这对于嵌入式和虚拟化环境特别重要，因为资源通常有限。

特性管理的实现包括：
- **依赖解析**：自动处理特性之间的依赖关系
- **冲突检测**：防止不兼容的特性组合
- **默认配置**：为常见使用场景提供合理的默认特性组合
- **文档化**：为每个特性提供清晰的文档和使用示例

## 环境变量控制

构建系统通过环境变量提供了灵活的配置机制，这些变量可以在不修改配置文件的情况下调整构建行为。这种设计使得构建系统可以与 CI/CD 系统和其他工具链集成，提供了额外的灵活性。

主要环境变量：

- `AXVISOR_SMP`: 设置CPU核心数，用于多核处理器支持
- `AXVISOR_VM_CONFIGS`: 指定虚拟机配置文件路径，支持多个配置文件
- `AX_CONFIG_PATH`: ArceOS配置文件路径，用于底层系统配置

环境变量系统的设计考虑了：
- **默认值**：为所有环境变量提供合理的默认值
- **验证**：检查环境变量值的有效性，提供清晰的错误信息
- **文档**：在构建脚本中记录所有支持的环境变量及其用途
- **兼容性**：确保环境变量与配置文件系统的一致性

## 代码质量保证

[`clippy.rs`](https://github.com/arceos-hypervisor/axvisor/tree/next/xtask/src/clippy.rs) 实现了全面的代码质量检查系统，这是确保项目长期可维护性的关键组件。代码质量检查不仅仅是发现错误，更是维护代码风格、性能和安全性的重要工具。

代码质量检查功能：

1. **多目标架构检查**：确保代码在所有支持的目标架构上都能正确编译
2. **特性组合检查**：测试各种特性组合，避免特性冲突
3. **自动修复支持**：自动修复常见的代码问题，提高开发效率
4. **详细的统计报告**：提供全面的检查结果统计，帮助跟踪代码质量趋势

这个系统的设计考虑了大型项目的实际需求，包括：
- **并行检查**：利用多核处理器并行执行检查，提高效率
- **增量检查**：只检查修改的文件，减少不必要的重复工作
- **分类报告**：将问题按严重程度分类，帮助开发者优先处理重要问题
- **集成支持**：与 CI/CD 系统集成，自动阻止低质量代码合并

代码质量保证还包括：
- **性能分析**：检查潜在的性能问题和优化机会
- **安全审计**：识别常见的安全漏洞和不良实践
- **文档检查**：确保公共 API 有适当的文档
- **测试覆盖**：监控测试覆盖率，确保代码充分测试
