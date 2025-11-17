---
sidebar_position: 1
---

# **Cargo xtask 构建系统**

## 简介

- **位置**: `xtask/` 是本仓库用于组织辅助构建、运行与工具命令的子命令二进制。主入口在 `xtask/src/main.rs`。

**概览**:

- **用途**: `cargo xtask` 提供一个简单的、以仓库为中心的构建与运行工具集，用来封装常用的 build、qemu 启动、uboot 构建、clippy 检查等操作。
- **原理**: 使用一个单独的二进制（`xtask`），通过 clap 解析子命令并调用仓库内部实现（例如在 `xtask/src/cargo.rs` 中的 `run_qemu`）。这样可以避免在 CI/开发机器上写大量 shell 脚本，同时将仓库特定的逻辑用 Rust 实现并纳入版本控制。

## 可用子命令

- `defconfig <board_name>`: 从 `configs/board/<board>.toml` 复制到仓库根目录的 `.build.toml`，用于设置当前默认构建配置。
- `build`: 运行完整的构建流程（仓库的 build 实现）。
- `clippy`: 在仓库目标上运行 clippy 检查（有选项如 `--packages`、`--targets`、`--fix` 等）。
- `qemu`: 启动/运行 QEMU（与仓库的 `ostool` 集成）。
- `uboot`: 构建并运行 U-Boot（类似 `qemu`，但使用 uboot runner）。
- `vmconfig`: 与 VM 配置相关的操作（仓库内实现）。
- `menuconfig`: 启动交互式菜单配置。

## 在本仓库中 `qemu` 的实现细节

- CLI 定义为：
  - `--build-config <path>` (可选) — 在 `QemuArgs` 中定义，但当前 `main.rs` 在 `Qemu` 分支中只把 `vmconfigs` 传到上下文，未将 `build_config` 或 `qemu_config` 显式转发给 `Context::run_qemu`。
  - `--qemu-config <path>` (可选) — 同上，定义存在但主函数未直接使用。
  - `--vmconfigs <name>`  — 将要运行的 VM 配置名称（例如 `arceos-aarch64-qemu-smp1`）。

- 在 `xtask/src/cargo.rs::run_qemu` 中，实际流程为：
  1. 调用 `self.load_config()` 读取构建配置（通常来自仓库根的 `.build.toml`）。
  2. 根据构建目标 (`build_config.target`) 判断架构（aarch64 或 x86_64）。
  3. 生成一个默认 QEMU 配置文件路径（例如 `.qemu-aarch64.toml`）。如果该文件不存在，会从 `scripts/ostool/qemu-aarch64.toml` 复制过去。
  4. 构造 `CargoRunnerKind::Qemu` 并调用 `self.ctx.cargo_run(&build_config, &kind).await`，交由 `ostool` 执行具体的 cargo 运行 / 启动 qemu 流程。

### **影响**:

- 虽然 `QemuArgs` 声明了 `--build-config` 和 `--qemu-config`，`main.rs` 当前实现并没有把它们传递给 `Context`。因此，实际 `cargo xtask qemu` 会依赖仓库根的 `.build.toml`（或使用 `cargo xtask defconfig` 预先设置），并自动创建 `.qemu-<arch>.toml`。
- QEMU 的具体行为依赖 `ostool` 的 `CargoRunnerKind::Qemu` 实现以及 `scripts/ostool/qemu-*.toml` 模板。

### **前置条件**:

- Rust toolchain（与仓库 `rust-toolchain.toml` 一致）。
- 系统安装 QEMU（例如 `qemu-system-aarch64`）以便 `ostool` 能够启动模拟器。
- 在第一次运行 `qemu` 之前，最好通过 `cargo xtask defconfig <board>` 初始化 `.build.toml`，或者手工创建 `.build.toml` 并确保 `target` 字段正确（例如包含 `aarch64-`）。

## **快速上手**:

1. 设置默认 board（示例使用 qemu-aarch64）:

```bash
cargo xtask defconfig qemu-aarch64
```

该命令会将 `configs/board/qemu-aarch64.toml` 复制为仓库根的 `.build.toml`（并在存在旧 `.build.toml` 时做备份）。

2. 可选：编辑 `.build.toml` 来调整构建选项或 target（例如确保 `target = "aarch64-unknown-none-softfloat"` 或其他关于目标的字段）。

3. 运行 QEMU：

- 使用 VM 配置名（示例）：

```bash
cargo xtask qemu --vmconfigs configs/vms/arceos-aarch64-qemu-smp1.toml
```

- 说明：
  - `--vmconfigs` 接受一个或多个 VM 名称（与仓库 `configs/vms/` 下的 TOML 文件名对应，但不一定要带路径）。
  - 运行时，xtask 会根据 `.build.toml` 决定 target，自动创建 `.qemu-<arch>.toml`（若缺失），并通过 `ostool` 的 cargo runner 启动 QEMU。

##  **完整示例：从 0 到启动**

1) 进入仓库根目录：

```bash
cd /path/to/axvisor
```

2) 设置默认 board（复制 board 配置到 `.build.toml`）：

```bash
cargo xtask defconfig qemu-aarch64
```

3) （可选）查看并编辑 `.build.toml`，确保 `target` 字段是 aarch64（或你需要的目标）：

```bash
# 打开编辑器修改 .build.toml
nano .build.toml
```

4) 使用 vm 配置名启动 QEMU（示例使用仓库中的 `arceos-aarch64-qemu-smp1`）:

```bash
cargo xtask qemu --vmconfigs configs/vms/arceos-aarch64-qemu-smp1.toml
```

5) （拓展）如果需要传入多个 VM 配置，在 `--vmconfigs`中加入多个配置文件，以";"分隔：

```bash
cargo xtask qemu --vmconfigs configs/vms/arceos-aarch64-qemu-smp1.toml;configs/vms/linux-aarch64-qemu-smp1.toml
```

### **调试与常见问题**:

- 如果 `cargo xtask qemu` 提示找不到 `.build.toml` 或 target 不支持，请先运行 `cargo xtask defconfig <board>`。
- 若 QEMU 无法启动，检查本机是否安装了相应的 QEMU 二进制（例如 `qemu-system-aarch64`）并在 PATH 中可用。
- 想要自定义 qemu 配置文件，可在仓库根创建 `.qemu-aarch64.toml`（xtask 会优先使用它；若不存在则从 `scripts/ostool/qemu-aarch64.toml` 复制模板）。

### **注意**:

- 本仓库把与执行相关的细节抽象到 `xtask`（Rust 二进制）和 `ostool`（工具运行器）中，方便在 CI 与本地开发环境中复用。若需要不同的 CLI 行为（例如传递自定义 `--qemu-config` 到 `run_qemu`），可以在 `xtask/src/main.rs` 中将参数传递到 `Context` 并在 `xtask/src/cargo.rs` 中使用这些路径（当前 `qemu` 分支未直接使用 `QemuArgs.build_config` / `qemu_config`）。