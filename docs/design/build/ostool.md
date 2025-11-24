---
sidebar_position: 2
---

# ostool 库

Axvisor 的整个 xtask 系统构建在 `ostool` 库之上，这是一个专门为嵌入式和操作系统开发而设计的功能完整的 Rust 工具库，提供了从构建配置到系统运行的全流程支持。

## 核心架构

`ostool` 采用模块化工作空间架构，包含四个核心子项目，每个子项目负责特定的功能领域：

```
ostool/
├── ostool/          # 核心工具库和CLI
├── jkconfig/        # 配置编辑器和TUI框架
├── fitimage/        # U-Boot FIT镜像构建工具
└── uboot-shell/     # U-Boot通信库
```

## 主要功能

`ostool` 库为 Axvisor 提供了以下核心功能：

1. **构建系统抽象**：支持 Cargo 和自定义构建系统，提供统一的构建接口
2. **多平台运行支持**：集成 QEMU 和 U-Boot 运行环境，支持虚拟化和真实硬件测试
3. **配置管理**：基于 JSON Schema 的类型安全配置系统，支持交互式编辑
4. **二进制处理**：自动处理 ELF 到二进制格式的转换，支持多种架构
5. **环境变量管理**：智能处理构建和运行时环境变量，支持变量替换

## 核心组件详解

### AppContext

[`AppContext`](https://github.com/ZR233/ostool/tree/main/ostool/src/ctx.rs) 是 `ostool` 的核心数据结构，封装了构建和运行过程中的所有状态信息：

```rust
#[derive(Default, Clone)]
pub struct AppContext {
    pub workspace_folder: PathBuf,
    pub manifest_dir: PathBuf,
    pub debug: bool,
    pub elf_path: Option<PathBuf>,
    pub bin_path: Option<PathBuf>,
    pub arch: Option<Architecture>,
    pub build_config: Option<BuildConfig>,
    pub build_config_path: Option<PathBuf>,
}
```

这个上下文对象提供了以下关键功能：

- **路径管理**：统一管理工作空间和清单目录路径
- **构建状态**：跟踪 ELF 和二进制文件路径，自动检测目标架构
- **配置管理**：存储和管理构建配置，支持配置验证
- **命令执行**：提供统一的命令执行接口，支持环境变量替换

### 构建系统支持

`ostool` 支持两种构建系统，通过 [`BuildSystem`](https://github.com/ZR233/ostool/tree/main/ostool/src/build/config.rs) 枚举定义：

```rust
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub enum BuildSystem {
    Custom(Custom),
    Cargo(Cargo),
}
```

**Cargo 构建系统**提供了完整的 Rust 项目构建支持：

- **特性管理**：自动处理 Rust 特性标志，支持日志级别自动配置
- **目标架构**：支持多目标架构编译，自动选择适当的工具链
- **环境变量**：智能设置构建环境变量，支持自定义配置
- **前后置命令**：支持构建前后执行自定义命令，实现复杂构建流程

**自定义构建系统**支持非 Rust 项目：

- **命令执行**：执行任意构建命令，支持 Make 等传统构建工具
- **路径处理**：自动处理构建产物路径，支持后续运行和调试
- **二进制转换**：自动将 ELF 文件转换为纯二进制格式

### 运行环境支持

`ostool` 提供了完整的运行环境支持，通过 [`CargoRunnerKind`](https://github.com/ZR233/ostool/tree/main/ostool/src/run/cargo.rs) 枚举定义：

```rust
pub enum CargoRunnerKind {
    Qemu {
        qemu_config: Option<PathBuf>,
        debug: bool,
        dtb_dump: bool,
    },
    Uboot {
        uboot_config: Option<PathBuf>,
    },
}
```

**QEMU 运行支持**：
- **自动配置**：根据目标架构自动选择 QEMU 版本和参数
- **调试支持**：集成 GDB 调试，支持断点和单步执行
- **设备树**：支持设备树文件生成和转储，便于调试

**U-Boot 运行支持**：
- **串口通信**：通过串口与真实硬件通信，支持多种波特率
- **文件传输**：支持 YMODEM 协议传输文件到目标设备
- **网络启动**：支持 TFTP 网络启动，便于远程开发

## 子项目

### jkconfig

[`jkconfig`](https://github.com/ZR233/ostool/tree/main/jkconfig/) 是一个基于 JSON Schema 的配置编辑器，提供了现代化的 TUI 界面：

**核心特性**：
- **类型安全**：基于 JSON Schema 的类型验证和自动完成
- **交互式编辑**：支持多种数据类型的交互式编辑界面
- **实时验证**：编辑时实时验证配置正确性
- **多格式支持**：支持 TOML、JSON 等多种配置格式

**技术实现**：
- 使用 `cursive` TUI 框架构建用户界面
- 基于 `schemars` 库生成 JSON Schema
- 支持自定义编辑器组件和验证规则

### fitimage

[`fitimage`](https://github.com/ZR233/ostool/tree/main/fitimage/) 是用于创建 U-Boot 兼容的 FIT (Flattened Image Tree) 镜像的专业工具：

**核心功能**：
- **标准兼容**：完全符合 U-Boot FIT 规范
- **多组件支持**：支持内核、设备树、ramdisk 等多种组件
- **压缩支持**：支持 gzip 等多种压缩算法
- **校验支持**：支持 CRC32、SHA1 等多种校验算法

**技术实现**：
- 使用 `device_tree` 和 `vm-fdt` 库处理设备树
- 支持多种压缩和哈希算法
- 提供灵活的配置 API

### uboot-shell

[`uboot-shell`](https://github.com/ZR233/ostool/tree/main/uboot-shell/) 提供了与 U-Boot 引导程序的通信功能：

**核心功能**：
- **串口通信**：通过串口与 U-Boot 进行命令交互
- **文件传输**：支持 YMODEM 协议传输文件
- **命令执行**：支持执行 U-Boot 命令并获取返回结果
- **环境变量**：支持读取和设置 U-Boot 环境变量

**技术实现**：
- 使用 `serialport` 库进行串口通信
- 实现完整的 YMODEM 协议
- 提供异步和同步两种通信模式

## 配置系统

`ostool` 的配置系统基于 JSON Schema，提供了类型安全的配置管理：

**配置文件结构**：
- `.build.toml`：构建配置，定义如何编译项目
- `.qemu.toml`：QEMU 运行配置，定义虚拟机参数
- `.uboot.toml`：U-Boot 运行配置，定义硬件启动参数

**配置验证**：
- 自动生成 JSON Schema 文件（`.build-schema.json`）
- 支持 IDE 自动完成和错误检查
- 运行时配置验证，提供详细错误信息

**环境变量支持**：
- 支持环境变量替换，格式为 `${env:VAR_NAME:-default}`
- 提供默认值机制，增强配置灵活性
- 支持路径变量，如 `${workspaceFolder}`

## 高级特性

`ostool` 提供了许多高级特性，支持复杂的开发场景：

1. **远程配置**：支持从 URL 下载配置文件，便于团队协作
2. **并行构建**：支持多核并行构建，提高构建效率
3. **增量构建**：智能检测文件变化，只构建必要的部分
4. **缓存支持**：支持构建产物缓存，加速重复构建
5. **插件系统**：支持自定义插件扩展功能

### 使用示例

- **基本构建流程**：

	```rust
	use ostool::ctx::AppContext;

	let mut ctx = AppContext::new();
	let build_config = ctx.perpare_build_config(None, false).await?;
	ctx.build_cargo(&build_config).await?;
	```

- **QEMU 运行**：

	```rust
	use ostool::run::cargo::CargoRunnerKind;

	let runner = CargoRunnerKind::Qemu {
	    qemu_config: Some(PathBuf::from(".qemu.toml")),
	    debug: true,
	    dtb_dump: false,
	};
	ctx.cargo_run(&build_config, &runner).await?;
	```

- **U-Boot 运行**：

	```rust
	let runner = CargoRunnerKind::Uboot {
	    uboot_config: Some(PathBuf::from(".uboot.toml")),
	};
	ctx.cargo_run(&build_config, &runner).await?;
	```

`ostool` 库为 Axvisor 项目提供了强大而灵活的构建和运行支持，使得复杂的虚拟化系统开发变得简单高效。通过模块化设计和类型安全的配置系统，`ostool` 不仅提高了开发效率，还确保了系统的可靠性和可维护性。
