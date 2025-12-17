---
title: "ROC-RK3568-PC"
sidebar_label: "ROC-RK3568-PC"
description: "ROC-RK3568-PC 开发板上 AxVisor 虚拟化系统的完整部署指南"
---

# ROC-RK3568-PC

本文档介绍如何在 ROC-RK3568-PC 开发板上启动和验证 AxVisor 项目，涵盖多种部署场景：

- **AxVisor + Linux 客户机**：在虚拟化环境中运行 Linux 系统
- **AxVisor + ArceOS 客户机**：在虚拟化环境中运行 ArceOS 系统
- **AxVisor + 多客户机**：同时运行多个不同类型的客户机系统

## 开发环境

AxVisor 及 ROC-RK3568-PC 的 SDK 仅支持在 Linux 系统中进行开发。本文档基于 **Ubuntu 24.04** 系统验证，其他 Linux 发行版可能需要相应调整。

### 系统要求

- Linux 操作系统（推荐 Ubuntu 20.04+）
- Git 工具
- Rust 工具链（用于编译 AxVisor）
- 基本的 Linux 命令行操作能力

> **注意**：ROC-RK3568-PC 的 SDK 对 Python 环境有特殊要求，详见后续章节。

## 构建准备

### 准备 AxVisor 源码

首先，使用 `git clone` 命令获取 AxVisor 的源代码并创建工作目录：
```bash
git clone https://github.com/arceos-hypervisor/axvisor.git
cd axvisor

# 创建工作目录
mkdir -p tmp/{configs,images}
```

### 准备设备树文件

设备树文件可以通过在开发板上运行 Linux 系统导出，也可以下载项目提供的设备树文件使用。

项目提供的 Linux 镜像文件夹中包含设备树文件，可直接下载到 `tmp/images` 目录：

```bash
# 下载包含设备树的 Linux 镜像
cargo xtask image download roc-rk3568-pc_linux --output-dir tmp/images
```

### 准备客户机镜像

AxVisor 项目提供了预构建的客户机镜像，方便用户快速验证和体验功能。通过 `cargo xtask image` 命令可以方便地管理这些镜像。

```bash
# 下载 ArceOS 客户机镜像
cargo xtask image download roc-rk3568-pc_arceos --output-dir tmp/images

# 下载 Linux 客户机镜像
cargo xtask image download roc-rk3568-pc_linux --output-dir tmp/images

# 列出所有可用镜像
cargo xtask image ls
```

AxVisor 所支持的客户机镜像的构建脚本和构建产物可以在 [axvisor-guest](https://github.com/arceos-hypervisor/axvisor-guest) 仓库中找到。

### 准备开发板配置文件

开发板配置文件定义了 AxVisor 在 RK3568 硬件平台上的基本运行参数。配置文件位于 `configs/board/roc-rk3568-pc.toml`，直接复制到工作目录即可：

```bash
# 复制开发板配置文件
cp configs/board/roc-rk3568-pc.toml tmp/configs/
```

## 部署到开发板

### 部署方式概述

AxVisor 支持两种客户机加载方式：

**方式一：内存加载部署**

编译时将客户机镜像打包进 AxVisor 二进制文件中，AxVisor 启动后直接从内存中加载客户机镜像。客户机配置文件设置 `image_location = "memory"`。

**方式二：文件系统加载部署**

客户机镜像独立存放在开发板的文件系统中，AxVisor 启动后从文件系统加载客户机镜像。客户机配置文件设置 `image_location = "fs"`。

---

由于瑞芯微提供的 SDK 对整个部署方式进行了预定义，难以实现自定义部署方式，因此我们通过构建后编辑瑞芯微原生镜像的方式来实现部署。整个部署操作要求在 ROC-RK3568-PC 的 SDK 目录中执行相关命令，以便直接使用 SDK 生成的各种镜像和工具。

### 方式一：内存加载部署

#### 准备客户机配置文件

复制客户机配置文件模板到工作目录：

```bash
# 复制 ArceOS 客户机配置文件
cp configs/vms/arceos-aarch64-rk3568-smp1.toml tmp/configs/

# 复制 Linux 客户机配置文件
cp configs/vms/linux-aarch64-rk3568-smp1.toml tmp/configs/
```

修改客户机配置文件，设置为内存加载模式：

```bash
# 修改 ArceOS 客户机配置
sed -i 's|image_location = ".*"|image_location = "memory"|g' tmp/configs/arceos-aarch64-rk3568-smp1.toml
sed -i "s|kernel_path = \".*\"|kernel_path = \"../images/roc-rk3568-pc_arceos/roc-rk3568-pc\"|g" tmp/configs/arceos-aarch64-rk3568-smp1.toml

# 修改 Linux 客户机配置
sed -i 's|image_location = ".*"|image_location = "memory"|g' tmp/configs/linux-aarch64-rk3568-smp1.toml
sed -i "s|kernel_path = \".*\"|kernel_path = \"../images/roc-rk3568-pc_linux/roc-rk3568-pc\"|g" tmp/configs/linux-aarch64-rk3568-smp1.toml
```

#### 配置构建文件

使用 `cargo xtask defconfig roc-rk3568-pc` 命令设置 ROC-RK3568-PC 为默认构建配置。这个命令会将 `configs/board/roc-rk3568-pc.toml` 复制为 `.build.toml`，作为默认的构建配置：

```bash
cargo xtask defconfig roc-rk3568-pc
```

然后指定要打包进 AxVisor 的客户机配置文件，修改 `.build.toml` 中的 `vm_configs` 字段：

**启动单个 ArceOS 客户机：**

```bash
sed -i 's|vm_configs\s*=.*|vm_configs = ["tmp/configs/arceos-aarch64-rk3568-smp1.toml"]|g' .build.toml
```

**启动单个 Linux 客户机：**

```bash
sed -i 's|vm_configs\s*=.*|vm_configs = ["tmp/configs/linux-aarch64-rk3568-smp1.toml"]|g' .build.toml
```

**启动多个客户机：**

```bash
sed -i 's|vm_configs\s*=.*|vm_configs = ["tmp/configs/arceos-aarch64-rk3568-smp1.toml", "tmp/configs/linux-aarch64-rk3568-smp1.toml"]|g' .build.toml
```

#### 编译 AxVisor

编译 AxVisor：

```bash
cargo xtask build
```

编译完成后，AxVisor 镜像位于 `target/aarch64-unknown-none-softfloat/release/axvisor.bin`。

#### 修改 boot.img

使用 ROC-RK3568-PC 的 SDK 会生成一个独立的 `boot.img`，其中存放了 Linux 内核镜像、设备树等文件。我们需要将其中的 Linux 内核镜像替换成 AxVisor 镜像。
```bash
# 进入 SDK 的固件输出目录
cd <SDK_PATH>/output/firmware

# 创建挂载点
mkdir -p boot

# 挂载 boot.img
sudo mount boot.img boot

# 复制 AxVisor 镜像，覆盖原有的 Linux 内核镜像
sudo cp <AXVISOR_PATH>/target/aarch64-unknown-none-softfloat/release/axvisor.bin boot/Image-5.10.198

# 卸载
sudo umount boot
```

#### 打包完整固件

在 SDK 目录中执行：
```bash
./build.sh updateimg
```

打包完成后，固件位于 `<SDK_PATH>/output/update/Image/update.img`。

#### 烧写固件

使用烧写工具（如瑞芯微的 AndroidTool）将完整的 `update.img` 固件烧写到开发板。

![deploy_download](./imgs_roc-rk3568-pc/deploy_download.png)

烧写完成后，重新上电启动开发板即可运行 AxVisor。

### 方式二：文件系统加载部署

#### 准备客户机配置文件

复制客户机配置文件模板到工作目录：
```bash
# 复制 ArceOS 客户机配置文件
cp configs/vms/arceos-aarch64-rk3568-smp1.toml tmp/configs/

# 复制 Linux 客户机配置文件
cp configs/vms/linux-aarch64-rk3568-smp1.toml tmp/configs/
```

修改客户机配置文件，设置为文件系统加载模式：
```bash
# 修改 ArceOS 客户机配置
sed -i 's|image_location = ".*"|image_location = "fs"|g' tmp/configs/arceos-aarch64-rk3568-smp1.toml
sed -i "s|kernel_path = \".*\"|kernel_path = \"/guest/images/arceos.bin\"|g" tmp/configs/arceos-aarch64-rk3568-smp1.toml

# 修改 Linux 客户机配置
sed -i 's|image_location = ".*"|image_location = "fs"|g' tmp/configs/linux-aarch64-rk3568-smp1.toml
sed -i "s|kernel_path = \".*\"|kernel_path = \"/guest/images/linux.bin\"|g" tmp/configs/linux-aarch64-rk3568-smp1.toml
```

#### 配置构建文件

使用 `cargo xtask defconfig roc-rk3568-pc` 命令设置 ROC-RK3568-PC 为默认构建配置：
```bash
cargo xtask defconfig roc-rk3568-pc
```

然后修改 `.build.toml` 文件，启用文件系统相关特性：
```bash
# 在 features 数组中添加文件系统相关特性
sed -i '/^features = \[/,/^\]/c\
features = [\
    "fs",\
    "axstd/ext4fs",\
    "driver/rk3568-clk",\
    "driver/sdmmc",\
    "dyn-plat",\
    "axstd/bus-mmio",\
]' .build.toml
```

或者手动编辑 `.build.toml` 文件，将 `features` 字段修改为：
```toml
features = [
    "fs",
    "axstd/ext4fs",
    "driver/rk3568-clk",
    "driver/sdmmc",
    "dyn-plat",
    "axstd/bus-mmio",
]
```

**注意：** 文件系统加载模式下，`vm_configs` 保持为空数组 `[]`，不需要指定客户机配置文件。

#### 编译 AxVisor

编译 AxVisor：

```bash
cargo xtask build
```

编译完成后，AxVisor 镜像位于 `target/aarch64-unknown-none-softfloat/release/axvisor.bin`。

#### 修改 boot.img

将 boot.img 中的 Linux 内核镜像替换为 AxVisor 镜像：
```bash
# 进入 SDK 的固件输出目录
cd <SDK_PATH>/output/firmware

# 创建挂载点
mkdir -p boot

# 挂载 boot.img
sudo mount boot.img boot

# 复制 AxVisor 镜像
sudo cp <AXVISOR_PATH>/target/aarch64-unknown-none-softfloat/release/axvisor.bin boot/Image-5.10.198

# 卸载
sudo umount boot
```

#### 添加客户机配置到 rootfs.img

在文件系统加载模式下，需要将客户机镜像和配置文件添加到根文件系统中。AxVisor 默认从 `/guest` 目录加载客户机文件。
```bash
# 创建挂载点
mkdir -p rootfs

# 挂载 rootfs.img
sudo mount rootfs.img rootfs

# 创建目录结构
sudo mkdir -p rootfs/guest/configs
sudo mkdir -p rootfs/guest/images

# 复制客户机配置文件
sudo cp <AXVISOR_PATH>/tmp/configs/arceos-aarch64-rk3568-smp1.toml rootfs/guest/configs/
sudo cp <AXVISOR_PATH>/tmp/configs/linux-aarch64-rk3568-smp1.toml rootfs/guest/configs/

# 复制客户机镜像
sudo cp <AXVISOR_PATH>/tmp/images/roc-rk3568-pc_arceos/roc-rk3568-pc rootfs/guest/images/roc-rk3568-pc-arceos
sudo cp <AXVISOR_PATH>/tmp/images/roc-rk3568-pc_linux/roc-rk3568-pc rootfs/guest/images/roc-rk3568-pc-linux

# 卸载
sudo umount rootfs
```

文件系统中的目录结构如下：
```
/guest/
├── configs/
│   ├── arceos-aarch64-rk3568-smp1.toml
│   └── linux-aarch64-rk3568-smp1.toml
└── images/
    ├── arceos.bin
    └── linux.bin
```

![deploy_rootfs](./imgs_roc-rk3568-pc/deploy_rootfs.png)

#### 打包完整固件

在 SDK 目录中执行：
```bash
./build.sh updateimg
```

打包完成后，固件位于 `<SDK_PATH>/output/update/Image/update.img`。

#### 烧写固件

使用烧写工具将完整的 `update.img` 固件烧写到开发板。

![deploy_download](./imgs_roc-rk3568-pc/deploy_download.png)

烧写完成后，重新上电启动开发板即可运行 AxVisor。

## 运行验证

开发板启动后，AxVisor 会根据配置自动加载并启动客户机。可以通过串口或 SSH 连接到开发板查看运行状态。