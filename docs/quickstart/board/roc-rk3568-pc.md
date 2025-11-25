---
title: "ROC-RK3568-PC"
sidebar_label: "ROC-RK3568-PC"
---

# ROC-RK3568-PC

本文档介绍如何在 ROC-RK3568-PC 开发板上启动和验证 AxVisor 项目。ROC-RK3568-PC 是基于瑞芯微 RK3568 芯片的开发板，具有强大的计算能力和丰富的外设接口，是 AxVisor 虚拟化平台的理想硬件载体。

## 1. 环境要求

### 硬件要求

- **串口线**：用于连接开发板和主机，进行调试和日志输出
- **以太网线**：用于网络通信和镜像传输
- **MicroSD 卡**：可选，用于启动和存储系统镜像（建议 Class 10 或更高速度）
- **USB 数据线**：用于连接主机和开发板，进行镜像烧录

### 软件要求

- **Linux 主机系统**：推荐使用 Ubuntu 20.04 或更高版本，用于构建和烧录
- **Rust 开发环境**：根据 Rust 官网介绍安装 Rust 开发环境，然后参考项目根目录的 `rust-toolchain.toml` 文件安装指定的编译工具链
- **串口终端工具**：如 minicom、picocom 或 putty，用于串口通信
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
# 下载 ArceOS 镜像
cargo xtask image download roc-rk3568-pc_arceos --output-dir tmp/images

# 下载 Linux 镜像
cargo xtask image download roc-rk3568-pc_linux --output-dir tmp/images

# 列出所有可用镜像
cargo xtask image ls
```
AxVisor 所支持的客户机镜像的构建脚本和构建产物可以在 [axvisor-guest](https://github.com/arceos-hypervisor/axvisor-guest) 仓库中找到。

### 准备开发板配置文件

开发板配置文件定义了 AxVisor 在 RK3568 硬件平台上的基本运行参数。配置文件位于 `configs/board/roc-rk3568-pc.toml`，我们直接使用这个配置文件，不需要改动。直接将开发板配置文件复制到 `tmp/configs` 目录即可。

```bash
# 复制开发板配置文件
cp configs/board/roc-rk3568-pc.toml tmp/configs/

# 复制 U-Boot 配置文件
cp .github/workflows/uboot.toml tmp/configs/
```

### 准备客户机配置文件

客户机配置文件定义了每个虚拟机的具体参数，包括内存布局、CPU 分配和设备访问等，相关客户机配置文件全部位于 `configs/vms` 目录下。我们需要将适用于 QEMU AArch64 的客户机配置文件复制到 `tmp/configs` 目录，并修改其中的 `kernel_path` 参数。

- 复制客户机配置文件：

  ```bash
  cp configs/vms/arceos-aarch64-rk3568-smp1.toml tmp/configs/
  cp configs/vms/linux-aarch64-rk3568-smp1.toml tmp/configs/
  ```

- 修改客户机配置文件中的 `kernel_path`，使其指向我们下载的客户机镜像：

  ```bash
  # 修改 ArceOS 客户机配置
  sed -i "s|kernel_path = \"/path/arceos-aarch64-dyn.bin\"|kernel_path = \"../images/roc-rk3568-pc_arceos/roc-rk3568-pc\"|g" tmp/configs/arceos-aarch64-rk3568-smp1.toml

  # 修改 Linux 客户机配置
  sed -i "s|kernel_path = \"/path/Image\"|kernel_path = \"../images/roc-rk3568-pc_linux/roc-rk3568-pc\"|g" tmp/configs/linux-aarch64-rk3568-smp1.toml
  ```

## 构建及启动

完成前期准备后，我们可以开始构建和启动 AxVisor。

### 生成配置

使用 `cargo xtask defconfig roc-rk3568-pc` 命令设置 QEMU AArch64 为默认构建配置。这个命令会将 `configs/board/roc-rk3568-pc.toml` 复制为 `.build.toml`，作为默认的构建配置。

### 编译及启动

AxVisor 构建系统集成了 UBoot 通信脚本，使用 `cargo xtask uboot` 命令即可启动 QEMU 虚拟机。该命令会自动先编译 AxVisor 及其所有依赖项，然后生成适合在 roc-rk3568-pc 环境中运行的二进制文件，最后与 UBoot 通信下载镜像并启动。

#### 启动单个 ArceOS 客户机

```bash
cargo xtask uboot \
  --build-config tmp/configs/roc-rk3568-pc.toml \
  --uboot-config tmp/configs/uboot.toml \
  --vmconfigs tmp/configs/arceos-aarch64-rk3568-smp1.toml
```

#### 启动单个 Linux 客户机

```bash
cargo xtask uboot \
  --build-config tmp/configs/roc-rk3568-pc.toml \
  --uboot-config tmp/configs/uboot.toml \
  --vmconfigs tmp/configs/linux-aarch64-rk3568-smp1.toml
```

#### 启动多个客户机

```bash
cargo xtask uboot \
  --build-config tmp/configs/roc-rk3568-pc.toml \
  --uboot-config tmp/configs/uboot.toml \
  --vmconfigs tmp/configs/arceos-aarch64-rk3568-smp1.toml,tmp/configs/linux-aarch64-rk3568-smp1.toml
```

## 常见问题

在 ROC-RK3568-PC 平台上使用 AxVisor 可能会遇到特定于硬件的问题。本节提供常见问题的解决方案和调试技巧。

### 串口连接失败

- **问题现象**：
  ```
  minicom: cannot open /dev/ttyUSB0: Permission denied
  ```

- **原因分析**：用户没有访问串口设备的权限，Linux 系统中串口设备通常属于 dialout 组。

- **解决方案**：
  ```bash
  # 将用户添加到 dialout 组
  sudo usermod -a -G dialout $USER

  # 注销并重新登录使更改生效
  # 或者使用 sudo 运行 minicom
  sudo minicom -D /dev/ttyUSB0 -b 115200

  # 检查串口设备是否存在
  ls -la /dev/ttyUSB*
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

  # 检查镜像文件内容
  ls -la tmp/images/roc-rk3568-pc_arceos/
  ls -la tmp/images/roc-rk3568-pc_linux/

  # 验证配置文件中的路径
  cat tmp/configs/arceos-aarch64-rk3568-smp1.toml | grep kernel_path
  cat tmp/configs/linux-aarch64-rk3568-smp1.toml | grep kernel_path

  # 如果路径错误，重新修改配置文件
  sed -i "s|错误的路径|正确的路径|g" tmp/configs/客户机配置文件.toml
  ```

### 内存不足

- **问题现象**：
  ```
  [ERROR] Memory allocation failed
  ```

- **原因分析**：RK3568 开发板可用内存不足以分配给 AxVisor 和客户机，或者内存区域配置冲突。

- **解决方案**：
  ```bash
  # 减少客户机内存分配，修改客户机配置文件
  # 对于 ArceOS，将内存大小从 0x1000_0000 (256MB) 减少到 0x800_0000 (128MB)
  sed -i 's|\[0x7000_0000, 0x1000_0000, 0x7, 1\]|[0x7000_0000, 0x800_0000, 0x7, 1]|g' tmp/configs/arceos-aarch64-rk3568-smp1.toml

  # 对于 Linux，将内存大小从 0x6000_0000 (1.5GB) 减少到 0x4000_0000 (1GB)
  sed -i 's|\[0x8000_0000, 0x6000_0000, 0x7, 1\]|[0x8000_0000, 0x4000_0000, 0x7, 1]|g' tmp/configs/linux-aarch64-rk3568-smp1.toml

  # 检查内存区域是否重叠
  # 确保 ArceOS 内存区域 (0x7000_0000-0x8000_0000) 和 Linux 内存区域 (0x8000_0000-0xC000_0000) 不重叠
  ```

### 虚拟机启动失败

- **问题现象**：
  ```
  [ERROR] Failed to start VM 1
  ```

- **原因分析**：可能是 CPU 分配冲突、设备配置错误或硬件兼容性问题。

- **解决方案**：
  ```bash
  # 检查虚拟机配置，确保 CPU ID 不冲突
  # ArceOS 使用 phys_cpu_ids = [0x200]
  # Linux 使用 phys_cpu_ids = [0x00]

  # 增加 AxVisor 日志级别
  sed -i 's/log = "Info"/log = "Debug"/g' tmp/configs/roc-rk3568-pc.toml

  # 重新构建并启动，查看详细错误信息
  cargo xtask build
  cargo xtask uboot --build-config tmp/configs/roc-rk3568-pc.toml --uboot-config tmp/configs/uboot.toml --vmconfigs tmp/configs/客户机配置文件.toml
  ```
