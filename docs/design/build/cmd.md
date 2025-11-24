---
sidebar_position: 4
---

# 构建命令

Axvisor 的 xtask 系统提供了丰富的命令集，涵盖了从配置管理到构建、测试、运行的完整开发流程。每个命令都经过精心设计，既提供了简单的默认行为，又支持高级用户进行细粒度控制。

## defconfig 命令

defconfig 命令用于设置默认构建配置，这是开发者开始新项目时的第一步。它将预定义的板级配置复制为当前项目的构建配置，大大简化了初始设置过程。

使用方法：

```bash
cargo xtask defconfig qemu-aarch64
```

实现逻辑：

```rust
fn defconfig_command(board_name: &str) -> Result<()> {
    println!("Setting default configuration for board: {board_name}");

    // 验证板级配置是否存在
    let board_config_path = format!("configs/board/{board_name}.toml");
    if !Path::new(&board_config_path).exists() {
        return Err(anyhow!(
            "Board configuration '{board_name}' not found. Available boards: qemu-aarch64, orangepi-5-plus"
        ));
    }

    // 备份现有配置
    backup_existing_config()?;

    // 复制板级配置到 .build.toml
    copy_board_config(board_name)?;

    println!("Successfully set default configuration to: {board_name}");
    Ok(())
}
```

defconfig 命令的核心功能是生成 `.build.toml` 文件，该过程包括以下几个步骤：

1. **验证板级配置存在性**：检查 `configs/board/{board_name}.toml` 文件是否存在
2. **备份现有配置**：如果当前目录已存在 `.build.toml`，会创建带时间戳的备份文件
3. **复制板级配置**：将选定的板级配置文件复制为 `.build.toml`

板级配置文件定义了构建所需的所有参数，例如：

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

这个命令的设计考虑了用户体验和安全性：
- **验证**：确保请求的板级配置存在，避免用户输入错误
- **备份**：自动备份现有配置，防止意外丢失用户自定义设置
- **反馈**：提供清晰的成功/失败消息，让用户了解操作结果

## build 命令

build 命令是 xtask 系统的核心，负责执行完整的项目构建过程。它不仅仅是简单地调用 `cargo build`，而是包含了配置加载、环境变量设置、依赖检查等复杂逻辑。

使用方法：

```bash
cargo xtask build
```

build 命令的执行流程：

1. **加载配置**：调用 `load_config()` 加载和处理构建配置
2. **环境变量设置**：根据配置设置必要的环境变量
3. **调用 ostool**：使用 `ostool` 库执行实际的 Cargo 构建

```rust
pub async fn run_build(&mut self) -> anyhow::Result<()> {
    let config = self.load_config()?;
    self.ctx.build_cargo(&config).await?;
    Ok(())
}
```

这个命令的复杂性在于它需要处理多种配置选项和环境变量，确保构建过程的一致性和可重现性。通过自动生成 Schema 文件和严格的配置验证，构建系统能够在编译前捕获配置错误，提高开发效率。

build 命令的核心是 [`load_config()`](https://github.com/arceos-hypervisor/axvisor/tree/next/xtask/src/tbuld.rs) 函数，它负责加载和处理构建配置：

1. **生成 JSON Schema**：使用 `schemars` 库为 `Config` 结构体生成 JSON Schema
2. **写入 .build-schema.json**：将生成的 Schema 写入 `.build-schema.json` 文件，用于配置验证
3. **读取 .build.toml**：从工作目录读取 `.build.toml` 配置文件
4. **解析配置**：使用 `toml` 库解析配置文件内容为 `Config` 结构体
5. **处理虚拟机配置**：验证和扩展虚拟机配置路径
6. **转换为 Cargo 配置**：将配置转换为 `ostool` 库所需的 `Cargo` 结构体

实现细节：

```rust
pub fn load_config(&mut self) -> anyhow::Result<Cargo> {
    // 1. 生成 JSON Schema
    let json = schema_for!(Config);
    
    // 2. 确定配置文件路径
    let mut config_path = self.ctx.workspace_folder.join(".build.toml");
    if let Some(c) = &self.build_config_path {
        config_path = c.clone();
    }
    
    // 3. 写入 Schema 文件
    std::fs::write(
        config_path.parent().unwrap().join(".build-schema.json"),
        serde_json::to_string_pretty(&json).unwrap(),
    )?;
    
    // 4. 读取和解析配置文件
    let config_str = std::fs::read_to_string(&config_path)?;
    let config: Config = toml::from_str(&config_str)?;
    
    // 5. 处理虚拟机配置路径
    let mut vm_configs = config.vm_configs.to_vec();
    vm_configs.extend(self.vmconfigs.iter().cloned());
    
    // 6. 转换为 Cargo 配置
    let mut cargo = Cargo {
        target: config.target,
        package: "axvisor".to_string(),
        features: config.features,
        log: config.log,
        args: config.cargo_args,
        to_bin: config.to_bin,
        ..Default::default()
    };
    
    // 7. 设置环境变量
    if let Some(smp) = config.smp {
        cargo.env.insert("AXVISOR_SMP".to_string(), smp.to_string());
    }
    
    if !vm_config_paths.is_empty() {
        let value = vm_config_paths
            .iter()
            .map(|p| format!("{}", p.display()))
            .collect::<Vec<_>>()
            .join(";");
        cargo.env.insert("AXVISOR_VM_CONFIGS".to_string(), value);
    }
    
    Ok(cargo)
}
```

`.build-schema.json` 文件是构建系统的重要组成部分，它提供了配置文件的 JSON Schema 定义，用于：

1. **配置验证**：确保 `.build.toml` 文件的结构和类型正确
2. **IDE 支持**：为编辑器提供自动完成和错误检查功能
3. **文档生成**：自动生成配置选项的文档

生成过程：

1. **Schema 生成**：使用 `schemars::schema_for!` 宏为 `Config` 结构体生成 Schema
2. **序列化**：将 Schema 序列化为格式化的 JSON 字符串
3. **文件写入**：将 JSON 写入 `.build-schema.json` 文件

Schema 包含了所有配置字段的详细信息：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Config",
  "description": "Build configuration for Axvisor",
  "type": "object",
  "properties": {
    "target": {
      "description": "target triple",
      "type": "string"
    },
    "features": {
      "description": "features to enable",
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "log": {
      "description": "log level feature",
      "anyOf": [
        {
          "type": "string"
        }
      ]
    },
    "cargo_args": {
      "description": "other cargo args",
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "to_bin": {
      "description": "whether to output as binary",
      "type": "boolean"
    },
    "smp": {
      "description": "Number of CPU cores",
      "type": "integer",
      "minimum": 1
    },
    "vm_configs": {
      "description": "VM configuration files",
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "target",
    "features",
    "to_bin"
  ]
}
```

## clippy 命令

clippy 命令实现了全面的代码质量检查，远超标准的 `cargo clippy` 功能。它支持多目标架构、多特性组合的检查，并提供了详细的统计报告和自动修复功能。

使用方法：

```bash
cargo xtask clippy
```

[`clippy.rs`](https://github.com/arceos-hypervisor/axvisor/tree/next/xtask/src/clippy.rs) 实现了全面的代码检查：

1. **多目标架构检查**：自动检查所有支持的目标架构
2. **特性组合检查**：测试各种特性组合，确保兼容性
3. **详细的统计报告**：提供通过、失败、跳过的检查数量统计
4. **自动修复和干运行模式**：支持自动修复常见问题和预览模式

这个命令对于维护代码质量至关重要，特别是在一个支持多平台的项目中，它能确保代码在所有目标平台上都能正确编译和工作。

## qemu 命令

qemu 命令简化了在 QEMU 模拟器中运行构建系统的过程。它自动处理架构检测、配置文件生成和 QEMU 启动，让开发者可以快速测试构建结果。

使用方法：

```bash
cargo xtask qemu
```

实现逻辑：

```rust
pub async fn run_qemu(&mut self, config_path: Option<PathBuf>) -> anyhow::Result<()> {
    let build_config = self.load_config()?;
    
    let arch = if build_config.target.contains("aarch64") {
        Arch::Aarch64
    } else if build_config.target.contains("x86_64") {
        Arch::X86_64
    } else {
        return Err(anyhow::anyhow!(
            "Unsupported target architecture: {}",
            build_config.target
        ));
    };
    
    // 设置 QEMU 配置...
}
```

这个命令的智能之处在于它能够自动检测目标架构并选择适当的 QEMU 版本和配置，大大简化了测试流程。

## uboot 命令

uboot 命令提供了在 U-Boot 环境中运行构建系统的功能，这对于在真实硬件上测试 Axvisor 特别重要。U-Boot（Universal Boot Loader）是一个广泛使用的开源引导加载程序，支持多种计算机体系结构。

使用方法：

```bash
cargo xtask uboot
```

实现逻辑：

```rust
pub async fn run_uboot(&mut self, config_path: Option<PathBuf>) -> anyhow::Result<()> {
    let build_config = self.load_config()?;

    let config_path = config_path.unwrap_or_else(|| PathBuf::from(".uboot.toml"));

    let kind = CargoRunnerKind::Uboot {
        uboot_config: Some(config_path),
    };

    self.ctx.cargo_run(&build_config, &kind).await?;

    Ok(())
}
```

这个命令的设计考虑了真实硬件部署的需求：
- **配置文件管理**：支持自定义 U-Boot 配置文件，默认使用 `.uboot.toml`
- **硬件兼容性**：通过 `ostool` 库与 U-Boot 工具链集成
- **自动化流程**：简化了从构建到在真实硬件上运行的复杂过程

U-Boot 命令与 QEMU 命令的主要区别在于：
- **目标环境**：QEMU 用于虚拟化测试，U-Boot 用于真实硬件
- **配置复杂度**：U-Boot 需要处理更多硬件特定的配置
- **调试方式**：U-Boot 环境下的调试通常需要硬件调试器支持

这个命令对于在真实开发板上部署和测试 Axvisor 至关重要，特别是在产品开发阶段。

## image 命令

image 命令提供了完整的客户机镜像管理功能，包括列出、下载、验证和删除镜像。这对于虚拟机监视器项目特别重要，因为它需要管理多个客户机操作系统镜像。

使用方法：

```bash
cargo xtask image ls
cargo xtask image download evm3588_arceos --output-dir ./images
cargo xtask image rm evm3588_arceos
```

[`image.rs`](https://github.com/arceos-hypervisor/axvisor/tree/next/xtask/src/image.rs) 实现了完整的镜像管理功能：

1. **列出可用镜像**：显示所有支持的镜像及其描述
2. **下载并验证镜像**：自动下载并使用 SHA-256 验证完整性
3. **自动解压镜像**：下载后自动解压到指定目录
4. **删除本地镜像**：清理临时文件和已下载的镜像

这个命令的设计考虑了网络可靠性和存储效率，包括断点续传、完整性验证和自动清理等功能。

## vmconfig 命令

vmconfig 命令用于生成虚拟机配置的 JSON Schema 文件，为虚拟机配置提供验证和 IDE 支持功能。

使用方法：

```bash
cargo xtask vmconfig
```

实现逻辑：

```rust
pub async fn run_vmconfig(&mut self) -> anyhow::Result<()> {
    let json = schemars::schema_for!(axvmconfig::AxVMCrateConfig);
    std::fs::write(
        ".vmconfig-schema.json",
        serde_json::to_string_pretty(&json).unwrap(),
    )
    .with_context(|| "Failed to write schema file .vmconfig-schema.json")?;
    Ok(())
}
```

与 `.build-schema.json` 类似，`.vmconfig-schema.json` 文件也是通过 `schemars` 库自动生成的：

1. **Schema 生成**：使用 `schemars::schema_for!` 宏为 `axvmconfig::AxVMCrateConfig` 结构体生成 Schema
2. **序列化**：将 Schema 序列化为格式化的 JSON 字符串
3. **文件写入**：将 JSON 写入 `.vmconfig-schema.json` 文件

这个 Schema 文件包含了虚拟机配置的所有字段定义和验证规则，确保虚拟机配置文件的结构正确性。它与 `.build-schema.json` 共同构成了 Axvisor 配置系统的验证基础。

## menuconfig 命令

menuconfig 命令提供了交互式配置界面，让开发者可以通过图形界面修改构建配置，而不需要手动编辑 TOML 文件。

使用方法：

```bash
cargo xtask menuconfig
```

这个命令使用 `jkconfig` 库实现了一个基于终端的配置界面，支持：
- 特性选择
- 参数配置
- 实时验证
- 配置保存和加载
