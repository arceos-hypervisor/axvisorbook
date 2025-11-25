---
title: "AArch64"
sidebar_label: "AArch64"
---

# AArch64

本文档介绍如何在 QEMU AArch64 环境中启动和验证 AxVisor 项目。在 QEMU AArch64 环境中，AxVisor 支持同时启动运行多个客户机操作系统，以下将启动 ArceOS 和 Linux 两个客户机操作系统。

## 环境要求

### 硬件要求

- **主机系统**：支持 KVM 的 Linux 主机系统（可选，用于加速虚拟化性能）
- **内存**：至少 8GB 可用内存，以确保 AxVisor 和客户机操作系统能够流畅运行
- **存储空间**：至少 2GB 可用磁盘空间，用于存储源代码、构建产物和客户机镜像

### 软件要求

- **QEMU**：版本 8.0 或更高版本，以便完整模拟 AArch64 硬件平台。目前 CI 中使用的是 QEMU 10.1.x 版本
- **Rust 开发环境**：根据 Rust 官网介绍安装 Rust 开发环境，然后参考项目根目录的 `rust-toolchain.toml` 文件安装指定的编译工具链
- **Linux 操作系统**：推荐使用 Ubuntu 20.04 或更高版本
- **Git**：用于克隆源代码仓库
- **构建工具**：确保系统已安装基本的构建工具（如 make、gcc 等）

## 前期准备

在开始构建和启动 AxVisor 之前，需要完成以下准备工作：

### 准备 AxVisor 源码

首先，需要使用 `git clone https://github.com/arceos-hypervisor/axvisor.git` 命令获取 AxVisor 的源代码并创建工作目录。然后，在 AxVisor 源码目录中创建一个 `tmp` 目录，用于存放配置文件和客户机镜像。

```bash
cd axvisor

# 创建工作目录
mkdir -p tmp/{configs,images}
```

### 准备客户机镜像

为了便于验证 AxVisor 的功能，AxVisor 项目提供了预构建的客户机镜像，并在 AxVisor 构建系统中集成了客户机镜像管理功能，使用 `cargo xtask image` 相关命令就可以查看及下载客户机镜像。这里我们直接将适用于 QEMU AArch64 的客户机镜像下载到我们创建的 `tmp/images` 目录即可。

```bash
# 列出所有可用镜像
cargo xtask image ls

# 下载 ArceOS 镜像
cargo xtask image download qemu_arceos_aarch64 --output-dir tmp/images

# 下载 Linux 镜像
cargo xtask image download qemu_linux_aarch64 --output-dir tmp/images
```

AxVisor 所支持的客户机镜像的构建脚本和构建产物可以在 [axvisor-guest](https://github.com/arceos-hypervisor/axvisor-guest) 仓库中找到。

### 准备开发板配置文件

开发板配置文件定义了 AxVisor 在特定硬件平台上的基本运行参数。对于 QEMU AArch64 环境，配置文件位于 `configs/board/qemu-aarch64.toml`，我们直接使用这个配置文件，不需要改动。直接将开发板配置文件复制到 `tmp/configs` 目录即可。

```bash
# 复制开发板配置文件
cp configs/board/qemu-aarch64.toml tmp/configs/
```

### 准备客户机配置文件

客户机配置文件定义了每个虚拟机的具体参数，包括内存布局、CPU 分配和设备访问等，相关客户机配置文件全部位于 `configs/vms` 目录下。我们需要将适用于 QEMU AArch64 的客户机配置文件复制到 `tmp/configs` 目录，并修改其中的 `kernel_path` 参数。

1. 复制客户机配置文件：

    ```bash
    cp configs/vms/arceos-aarch64-qemu-smp1.toml tmp/configs/

    cp configs/vms/linux-aarch64-qemu-smp1.toml tmp/configs/
    ```

2. 修改客户机配置文件中的 `kernel_path`，使其指向我们下载的客户机镜像：

    ```bash
    # 修改 ArceOS 客户机配置
    sed -i "s|kernel_path = \"path/arceos-aarch64-dyn-smp1.bin\"|kernel_path = \"../images/qemu_arceos_aarch64/qemu-aarch64\"|g" tmp/configs/arceos-aarch64-qemu-smp1.toml

    # 修改 Linux 客户机配置
    sed -i "s|kernel_path = \"tmp/Image\"|kernel_path = \"../images/qemu_linux_aarch64/qemu-aarch64\"|g" tmp/configs/linux-aarch64-qemu-smp1.toml
    ```

## 构建及启动

完成前期准备后，我们可以开始构建和启动 AxVisor。

### 生成配置

使用 `cargo xtask defconfig qemu-aarch64` 命令设置 QEMU AArch64 为默认构建配置。实际上，这个命令会将 `configs/board/qemu-aarch64.toml` 复制为 `.build.toml`，作为默认的构建配置。

### 编译及启动

AxVisor 构建系统集成了 QEMU 启动脚本，使用 `cargo xtask qemu` 命令即可启动 QEMU 虚拟机。该命令会自动先编译 AxVisor 及其所有依赖项，生成适合在 QEMU AArch64 环境中运行的二进制文件然后在 QEMU 中启动。

1. 启动单个 ArceOS 客户机

    ```bash
    cargo xtask qemu \
    --build-config tmp/configs/qemu-aarch64.toml \
    --qemu-config .github/workflows/qemu-aarch64.toml \
    --vmconfigs tmp/configs/arceos-aarch64-qemu-smp1.toml
    ```

2. 启动单个 Linux 客户机

    ```bash
    cargo xtask qemu \
    --build-config tmp/configs/qemu-aarch64.toml \
    --qemu-config .github/workflows/qemu-aarch64.toml \
    --vmconfigs tmp/configs/linux-aarch64-qemu-smp1.toml
    ```

3. 启动多个客户机

    ```bash
    cargo xtask qemu \
    --build-config tmp/configs/qemu-aarch64.toml \
    --qemu-config .github/workflows/qemu-aarch64.toml \
    --vmconfigs tmp/configs/arceos-aarch64-qemu-smp1.toml,tmp/configs/linux-aarch64-qemu-smp1.toml
    ```

## 常见问题

在使用 AxVisor 过程中，可能会遇到各种问题。本节提供常见问题的解决方案和调试技巧。

### KVM 不可用

**问题现象**：
```
warning: KVM not available, using TCG
```

**原因分析**：KVM（Kernel-based Virtual Machine）是 Linux 内核的虚拟化模块，可以显著提高虚拟化性能。如果 KVM 不可用，QEMU 会回退到 TCG（Tiny Code Generator），这是一个纯软件模拟器，性能较差。

**解决方案**：
```bash
# 检查 KVM 模块是否已加载
lsmod | grep kvm

# 加载 KVM 模块
sudo modprobe kvm-arm

# 检查 CPU 是否支持硬件虚拟化
egrep -c '(vmx|svm)' /proc/cpuinfo

# 如果输出大于 0，表示 CPU 支持硬件虚拟化
```

### 内存不足

- **问题现象**：
    ```
    cannot allocate memory
    ```

- **原因分析**：系统可用内存不足以分配给 QEMU 虚拟机，或者系统限制了进程可以分配的内存量。

- **解决方案**：
    ```bash
    # 减少虚拟机内存分配，修改 QEMU 配置文件
    # 将 "-m", "8g" 改为 "-m", "4g" 或更小

    # 增加系统交换空间
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile

    # 检查系统内存使用情况
    free -h
    ```

### 客户机镜像找不到

- **问题现象**：
    ```
    Failed to open file 'path/to/image': No such file or directory
    ```

- **原因分析**：客户机配置文件中的 `kernel_path` 指向了不存在的文件，可能是路径错误或镜像未正确下载。

- **解决方案**：
    ```bash
    # 检查镜像文件是否存在
    ls -la tmp/images/

    # 验证配置文件中的路径
    cat tmp/configs/arceos-aarch64-qemu-smp1.toml | grep kernel_path
    cat tmp/configs/linux-aarch64-qemu-smp1.toml | grep kernel_path

    # 如果路径错误，重新修改配置文件
    sed -i "s|错误的路径|正确的路径|g" tmp/configs/客户机配置文件.toml
    ```

### 虚拟机启动失败

- **问题现象**：
    ```
    [ERROR] Failed to start VM 1
    ```

- **原因分析**：可能是内存区域重叠、CPU 分配冲突或设备配置错误。

- **解决方案**：
    ```bash
    # 检查虚拟机配置，确保内存区域不重叠
    # 比较不同虚拟机的 memory_regions 配置

    # 增加 AxVisor 日志级别
    sed -i 's/log = "Info"/log = "Debug"/g' tmp/configs/qemu-aarch64.toml

    # 重新构建并启动，查看详细错误信息
    cargo xtask build
    cargo xtask qemu --build-config tmp/configs/qemu-aarch64.toml --qemu-config .github/workflows/qemu-aarch64.toml --vmconfigs tmp/configs/客户机配置文件.toml
    ```
