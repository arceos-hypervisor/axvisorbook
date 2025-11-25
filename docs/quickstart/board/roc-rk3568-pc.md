---
title: "ROC-RK3568-PC"
sidebar_label: "ROC-RK3568-PC"
---

# ROC-RK3568-PC

本文档介绍如何在 ROC-RK3568-PC 开发板上启动和验证 AxVisor 项目。ROC-RK3568-PC 是基于瑞芯微 RK3568 芯片的开发板，具有强大的计算能力和丰富的外设接口，是 AxVisor 虚拟化平台的理想硬件载体。

## 1. 环境要求

### 硬件要求

- **ROC-RK3568-PC 开发板**：基于瑞芯微 RK3568 四核 Cortex-A55 处理器，支持硬件虚拟化扩展
- **串口线**：用于连接开发板和主机，进行调试和日志输出
- **以太网线**：用于网络通信和镜像传输
- **电源适配器**：提供稳定的 12V/2A 电源供应
- **MicroSD 卡**：可选，用于启动和存储系统镜像（建议 Class 10 或更高速度）
- **USB 数据线**：用于连接主机和开发板，进行镜像烧录

### 软件要求

- **Linux 主机系统**：推荐使用 Ubuntu 20.04 或更高版本，用于构建和烧录
- **Rust 工具链**：参考项目根目录的 [`rust-toolchain.toml`](rust-toolchain.toml) 文件中指定的版本
- **U-Boot 引导加载器**：支持 RK3568 开发板的版本
- **串口终端工具**：如 minicom、picocom 或 putty，用于串口通信
- **Fastboot 工具**：用于镜像烧录和系统更新
- **Git**：用于克隆源代码仓库

## 2. 前期准备

在开始构建和启动 AxVisor 之前，需要完成以下准备工作：

### 2.1 准备 AxVisor 源码

首先，我们需要获取 AxVisor 的源代码并创建工作目录：

```bash
# 克隆 AxVisor 仓库
git clone https://github.com/arceos-hypervisor/axvisor.git
cd axvisor

# 安装指定版本的 Rust 工具链
rustup default $(cat rust-toolchain.toml)

# 安装 ostool，用于镜像管理和设备操作
cargo +stable install -f --git https://github.com/ZR233/ostool ostool

# 验证 Rust 工具链版本
rustc --version
```

接下来，在 AxVisor 源码目录中创建一个 `tmp` 目录，用于存放配置文件和客户机镜像：

```bash
# 创建工作目录
mkdir -p tmp

# 创建配置文件子目录
mkdir -p tmp/configs

# 创建客户机镜像子目录
mkdir -p tmp/images
```

### 2.2 准备客户机镜像

AxVisor 项目从 [axvisor-guest 仓库](https://github.com/arceos-hypervisor/axvisor-guest) 下载预构建的客户机镜像。这些镜像已经过 RK3568 平台的优化和测试，可以直接用于验证 AxVisor 的功能。

CI 流程中使用的镜像包括：

- **ROC-RK3568-PC ArceOS**: `roc-rk3568-pc_arceos`
  - 描述：适用于 ROC-RK3568-PC 开发板的 ArceOS 操作系统
  - 特点：轻量级、实时响应、专为 RK3568 硬件优化
  - 内存需求：低，适合资源受限的环境
  - SHA256: `a68d4981a0053278b7f90c11ede1661c037310223dd3188ffe4a4e272a7e3cdd`

- **ROC-RK3568-PC Linux**: `roc-rk3568-pc_linux`
  - 描述：适用于 ROC-RK3568-PC 开发板的 Linux 操作系统
  - 特点：功能完整、支持丰富的应用生态、针对 RK3568 硬件优化
  - 内存需求：中等，适合需要完整 Linux 功能的应用
  - SHA256: `53a8db12bd8b5b75e1f29847cec6486c8d9e3bf58a03ca162322662ff61eb7fa`

使用 AxVisor 提供的 `xtask` 工具下载客户机镜像到我们创建的 `tmp/images` 目录：

```bash
# 下载 ArceOS 镜像
cargo xtask image download roc-rk3568-pc_arceos --output-dir tmp/images

# 下载 Linux 镜像
cargo xtask image download roc-rk3568-pc_linux --output-dir tmp/images

# 列出所有可用镜像
cargo xtask image ls
```

镜像下载过程包括以下步骤：
1. 从 GitHub Releases 下载压缩的镜像文件
2. 验证 SHA256 校验和，确保文件完整性和安全性
3. 自动解压到指定目录
4. 准备好供 AxVisor 使用的镜像文件

### 2.3 准备开发板配置文件

开发板配置文件定义了 AxVisor 在 RK3568 硬件平台上的基本运行参数。配置文件位于 [`configs/board/roc-rk3568-pc.toml`](configs/board/roc-rk3568-pc.toml)，我们直接使用这个配置文件，不需要改动。

将开发板配置文件复制到 `tmp/configs` 目录：

```bash
# 复制开发板配置文件
cp configs/board/roc-rk3568-pc.toml tmp/configs/

# 复制 U-Boot 配置文件
cp .github/workflows/uboot.toml tmp/configs/
```

### 2.4 准备客户机配置文件

客户机配置文件定义了每个虚拟机的具体参数，包括内存布局、CPU 分配和设备访问等。我们需要将这些配置文件复制到 `tmp/configs` 目录，并修改其中的 `kernel_path` 参数。

复制客户机配置文件：

```bash
# 复制客户机配置文件
cp configs/vms/arceos-aarch64-rk3568-smp1.toml tmp/configs/
cp configs/vms/linux-aarch64-rk3568-smp1.toml tmp/configs/
```

修改客户机配置文件中的 `kernel_path`，使其指向我们下载的客户机镜像：

```bash
# 修改 ArceOS 客户机配置
sed -i "s|kernel_path = \"/path/arceos-aarch64-dyn.bin\"|kernel_path = \"tmp/images/roc-rk3568-pc_arceos/arceos-aarch64-dyn.bin\"|g" tmp/configs/arceos-aarch64-rk3568-smp1.toml

# 修改 Linux 客户机配置
sed -i "s|kernel_path = \"/path/Image\"|kernel_path = \"tmp/images/roc-rk3568-pc_linux/Image\"|g" tmp/configs/linux-aarch64-rk3568-smp1.toml
```

这些修改确保了客户机配置文件能够正确找到我们下载的镜像文件。

## 3. 构建及启动

完成前期准备后，我们可以开始构建和启动 AxVisor。

### 设置环境变量

为了正确使用 U-Boot 启动，需要设置以下环境变量：

```bash
# 串口设备（根据实际连接调整）
export BOARD_COMM_UART_DEV="/dev/ttyUSB0"

# 串口波特率
export BOARD_COMM_UART_BAUD="115200"

# 设备树文件（需要根据实际硬件调整路径）
export BOARD_DTB="path/to/rk3568-pc.dtb"

# 电源控制命令（可选，根据实际硬件调整）
export BOARD_POWER_RESET="echo 'Resetting board'"
export BOARD_POWER_OFF="echo 'Powering off board'"

# 网络接口（可选）
export BOARD_COMM_NET_IFACE="eth0"
```

这些环境变量会被 U-Boot 配置文件引用，确保 AxVisor 能够正确与开发板通信。

### 连接串口

使用串口线连接 ROC-RK3568-PC 开发板和主机，然后启动串口终端：

```bash
# 使用 minicom（假设设备为 /dev/ttyUSB0，波特率为 115200）
sudo minicom -D /dev/ttyUSB0 -b 115200

# 或者使用 picocom
sudo picocom /dev/ttyUSB0 -b 115200
```

如果遇到权限问题，可能需要将用户添加到 dialout 组：
```bash
sudo usermod -a -G dialout $USER
# 注销并重新登录使更改生效
```

### 设置构建配置

使用 `xtask` 工具设置 ROC-RK3568-PC 为默认构建配置：

```bash
# 设置构建配置
cargo xtask defconfig roc-rk3568-pc
```

这个命令会将 [`configs/board/roc-rk3568-pc.toml`](configs/board/roc-rk3568-pc.toml) 复制为 `.build.toml`，作为默认的构建配置。

### 构建项目

现在我们可以构建 AxVisor：

```bash
# 构建 AxVisor
cargo xtask build
```

构建过程会编译 AxVisor 及其所有依赖项，生成适合在 RK3568 平台上运行的二进制文件。构建完成后，可以在 `target/aarch64-unknown-none-softfloat/debug/` 目录下找到生成的二进制文件。

### 启动 AxVisor

根据需要，我们可以启动单个客户机或多个客户机：

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

### 验证启动

成功启动后，您应该看到以下输出：

```
[INFO] AxVisor is starting...
[INFO] Initializing virtualization extensions...
[INFO] Setting up memory management...
[INFO] Welcome to AxVisor Shell!
>
```

这表示 AxVisor 已经成功启动并进入了交互式 Shell。接下来，我们可以使用 Shell 命令来管理和监控虚拟机：

```bash
# 列出所有虚拟机
> vm list

# 查看特定虚拟机信息
> vm info 1

# 启动虚拟机
> vm start 1

# 查看虚拟机控制台输出
> vm console 1

# 在虚拟机间发送消息
> vm ivc send 1 2 "Hello from VM1"
> vm ivc recv 2
```

对于 ArceOS 客户机，成功启动后应该看到：
```
[INFO] Starting VM 1: arceos
[INFO] VM 1 is running
Hello, world!
```

对于 Linux 客户机，成功启动后应该看到：
```
[INFO] Starting VM 2: linux
[INFO] VM 2 is running
[    0.000000] Booting Linux on physical CPU 0x0
[    0.000000] Linux version 6.6.62 (...)
...
[    1.234567] Run /init as init process
root@firefly:~#
```

## 4. 问题处理

在 ROC-RK3568-PC 平台上使用 AxVisor 可能会遇到特定于硬件的问题。本节提供常见问题的解决方案和调试技巧。

### 常见问题

#### 1. 串口连接失败

**问题现象**：
```
minicom: cannot open /dev/ttyUSB0: Permission denied
```

**原因分析**：用户没有访问串口设备的权限，Linux 系统中串口设备通常属于 dialout 组。

**解决方案**：
```bash
# 将用户添加到 dialout 组
sudo usermod -a -G dialout $USER

# 注销并重新登录使更改生效
# 或者使用 sudo 运行 minicom
sudo minicom -D /dev/ttyUSB0 -b 115200

# 检查串口设备是否存在
ls -la /dev/ttyUSB*
```

#### 2. 客户机镜像找不到

**问题现象**：
```
Failed to open file 'path/to/image': No such file or directory
```

**原因分析**：客户机配置文件中的 `kernel_path` 指向了不存在的文件，可能是路径错误或镜像未正确下载。

**解决方案**：
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

#### 3. 内存不足

**问题现象**：
```
[ERROR] Memory allocation failed
```

**原因分析**：RK3568 开发板可用内存不足以分配给 AxVisor 和客户机，或者内存区域配置冲突。

**解决方案**：
```bash
# 减少客户机内存分配，修改客户机配置文件
# 对于 ArceOS，将内存大小从 0x1000_0000 (256MB) 减少到 0x800_0000 (128MB)
sed -i 's|\[0x7000_0000, 0x1000_0000, 0x7, 1\]|[0x7000_0000, 0x800_0000, 0x7, 1]|g' tmp/configs/arceos-aarch64-rk3568-smp1.toml

# 对于 Linux，将内存大小从 0x6000_0000 (1.5GB) 减少到 0x4000_0000 (1GB)
sed -i 's|\[0x8000_0000, 0x6000_0000, 0x7, 1\]|[0x8000_0000, 0x4000_0000, 0x7, 1]|g' tmp/configs/linux-aarch64-rk3568-smp1.toml

# 检查内存区域是否重叠
# 确保 ArceOS 内存区域 (0x7000_0000-0x8000_0000) 和 Linux 内存区域 (0x8000_0000-0xC000_0000) 不重叠
```

#### 4. 虚拟机启动失败

**问题现象**：
```
[ERROR] Failed to start VM 1
```

**原因分析**：可能是 CPU 分配冲突、设备配置错误或硬件兼容性问题。

**解决方案**：
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

### 调试技巧

#### 1. 增加日志级别

修改 [`configs/board/roc-rk3568-pc.toml`](configs/board/roc-rk3568-pc.toml) 或我们复制的 `tmp/configs/roc-rk3568-pc.toml`：

```toml
log = "Debug"  # 从 "Info" 改为 "Debug"
```

这会输出更详细的调试信息，帮助定位问题。

#### 2. 查看设备树

在 AxVisor Shell 中：
```bash
> fdt print
```

这会打印设备树信息，帮助理解硬件配置和设备状态。

#### 3. 检查内存映射

在 AxVisor Shell 中：
```bash
> mem list
```

这会显示所有虚拟机的内存映射情况，帮助诊断内存冲突。

#### 4. 查看 CPU 状态

在 AxVisor Shell 中：
```bash
> cpu list
```

这会显示所有 CPU 的状态和分配情况，帮助诊断 CPU 分配问题。

#### 5. 验证虚拟机间通信

在 AxVisor Shell 中：
```bash
> vm ivc send 1 2 "Hello from VM1"
> vm ivc recv 2
```

这可以验证虚拟机间通信机制是否正常工作。

### 性能优化

#### 1. 调整 CPU 分配

修改客户机配置文件中的 `phys_cpu_ids`：
```toml
[base]
phys_cpu_ids = [0x100, 0x101]  # 分配多个 CPU 核心
```

注意 RK3568 的 CPU ID 格式，确保使用有效的物理 CPU ID。

#### 2. 优化内存分配

根据客户机需求调整内存区域大小：
```toml
# 对于轻量级客户机（如 ArceOS）
memory_regions = [
  [0x7000_0000, 0x800_0000, 0x7, 1], # 128MB 内存
]

# 对于资源密集型客户机（如 Linux）
memory_regions = [
  [0x8000_0000, 0x4000_0000, 0x7, 1], # 1GB 内存
]
```

#### 3. 减少设备直通

只直通必要的设备，减少虚拟化开销：
```toml
[devices]
passthrough_devices = [
    ["/serial"],  # 只直通串口设备
]
```

### RK3568 特定注意事项

1. **内存布局**：RK3568 平台使用特殊的内存布局，客户机内存地址从 0x7000_0000 和 0x8000_0000 开始，避免与 AxVisor 自身的内存区域冲突

2. **CPU 核心分配**：RK3568 的物理 CPU ID 使用特殊格式（如 0x00、0x200），需要根据实际硬件配置

3. **设备树兼容性**：确保使用与 RK3568 硬件兼容的设备树文件，包含所有必要的外设定义

4. **中断处理**：RK3568 的中断控制器（GIC）配置需要特别注意，确保正确配置中断模式

5. **电源管理**：RK3568 的电源管理单元（PMU）可能需要特殊配置，以确保系统稳定运行

通过以上优化措施和注意事项，可以显著提高 AxVisor 在 RK3568 平台上的运行性能和稳定性。

## 参考资源

- [ROC-RK3568-PC 硬件手册](https://wiki.t-firefly.com/zh/ROC-RK3568-PC/)
- [RK3568 数据手册](https://www.rockchip.com/)
- [AxVisor 项目文档](https://github.com/arceos-hypervisor/axvisor)
