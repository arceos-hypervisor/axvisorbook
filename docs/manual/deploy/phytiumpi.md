---
title: "飞腾派"
sidebar_label: "飞腾派"
---

# 飞腾派

本文详细介绍如何在飞腾派开发板上部署和运行 AxVisor 虚拟化系统，包括 AxVisor + Linux 客户机、AxVisor + ArceOS 客户机以及 AxVisor + 多客户机等场景。

## 开发环境

AxVisor 及飞腾派的 SDK 仅支持在 Linux 系统中进行开发。本文中的构建及部署环境均采用 Ubuntu 24.04 系统作为开发环境。

## 构建准备

### 准备 AxVisor 源码

首先，使用 `git clone` 命令获取 AxVisor 的源代码并创建工作目录：
```bash
git clone https://github.com/arceos-hypervisor/axvisor.git
cd axvisor

# 创建工作目录
mkdir -p tmp/{configs,images}
```

### 准备客户机镜像

为了便于验证 AxVisor 的功能，AxVisor 项目提供了预构建的客户机镜像。AxVisor 构建系统集成了客户机镜像管理功能，使用 `cargo xtask image` 相关命令即可查看及下载客户机镜像：
```bash
# 下载 ArceOS 客户机镜像
cargo xtask image download phytiumpi_arceos --output-dir tmp/images

# 下载 Linux 客户机镜像
cargo xtask image download phytiumpi_linux --output-dir tmp/images

# 列出所有可用镜像
cargo xtask image ls
```

AxVisor 所支持的客户机镜像的构建脚本和构建产物可以在 [axvisor-guest](https://github.com/arceos-hypervisor/axvisor-guest) 仓库中找到。

## 部署到开发板

### 部署方式概述

AxVisor 支持两种客户机加载方式：

**方式一：内存加载部署**

编译时将客户机镜像打包进 AxVisor 二进制文件中，AxVisor 启动后直接从内存中加载客户机镜像。客户机配置文件设置 `image_location = "memory"`，并在 `.build.toml` 中的 `vm_configs` 字段指定要打包的客户机配置文件。

**方式二：文件系统加载部署**

客户机镜像独立存放在开发板的文件系统中，AxVisor 启动后从文件系统加载客户机镜像。客户机配置文件设置 `image_location = "fs"`，`.build.toml` 中的 `vm_configs` 字段设置为空数组 `[]`，并启用文件系统相关特性。

---

飞腾固件以及 U-Boot 并不开源，Phytium-Pi-OS 中默认以二进制文件的形式提供飞腾固件 + U-Boot 固件组合体 `fip-all.bin`，`fip-all.bin` 会被直接写入最终 IMAGE 镜像的开头位置。整个部署操作要求在飞腾派的 SDK 目录中执行相关命令，以便直接使用 SDK 生成的各种镜像和工具。

### 方式一：内存加载部署

#### 准备客户机配置文件

在 AxVisor 源码的 `configs/vms` 目录下有适用于飞腾派开发板的客户机配置文件：
- `linux-aarch64-e2000_smp1.toml`、`linux-aarch64-e2000_smp2.toml`
- `arceos-aarch64-e2000_smp1.toml`、`arceos-aarch64-e2000_smp2.toml`

复制客户机配置文件模板到工作目录：
```bash
# 复制 ArceOS 客户机配置文件
cp configs/vms/arceos-aarch64-e2000_smp1.toml tmp/configs/

# 复制 Linux 客户机配置文件
cp configs/vms/linux-aarch64-e2000_smp1.toml tmp/configs/
```

修改客户机配置文件，设置为内存加载模式：
```bash
# 修改 ArceOS 客户机配置
sed -i 's|image_location = ".*"|image_location = "memory"|g' tmp/configs/arceos-aarch64-e2000_smp1.toml
sed -i "s|kernel_path = \".*\"|kernel_path = \"../images/phytiumpi_arceos/phytiumpi\"|g" tmp/configs/arceos-aarch64-e2000_smp1.toml

# 修改 Linux 客户机配置
sed -i 's|image_location = ".*"|image_location = "memory"|g' tmp/configs/linux-aarch64-e2000_smp1.toml
sed -i "s|kernel_path = \".*\"|kernel_path = \"../images/phytiumpi_linux/phytiumpi\"|g" tmp/configs/linux-aarch64-e2000_smp1.toml
```

如果客户机配置文件中有 `dtb_path` 字段，同样需要修改为本地构建环境中的设备树文件路径。

#### 配置构建文件

使用 `cargo xtask defconfig phytiumpi` 命令设置飞腾派为默认构建配置：
```bash
cargo xtask defconfig phytiumpi
```

然后指定要打包进 AxVisor 的客户机配置文件，修改 `.build.toml` 中的 `vm_configs` 字段：

**启动单个 ArceOS 客户机：**
```bash
sed -i 's|vm_configs\s*=.*|vm_configs = ["tmp/configs/arceos-aarch64-e2000_smp1.toml"]|g' .build.toml
```

**启动单个 Linux 客户机：**
```bash
sed -i 's|vm_configs\s*=.*|vm_configs = ["tmp/configs/linux-aarch64-e2000_smp1.toml"]|g' .build.toml
```

**启动多个客户机：**
```bash
sed -i 's|vm_configs\s*=.*|vm_configs = ["tmp/configs/arceos-aarch64-e2000_smp1.toml", "tmp/configs/linux-aarch64-e2000_smp1.toml"]|g' .build.toml
```

#### 编译 AxVisor

编译 AxVisor：
```bash
cargo xtask build
```

编译完成后，AxVisor 镜像位于 `target/aarch64-unknown-none-softfloat/release/axvisor.bin`，此镜像已包含指定的客户机镜像。

#### 修改 fitImage

对于飞腾派，Phytium-Pi-OS 默认使用 fitImage 作为内核格式。需要修改 `kernel.its` 文件将 AxVisor 镜像打包进去。

**注意：** `kernel.its` 源文件位于 `<SDK_PATH>/package/phyuboot/src/kernel.its`，但我们在 `<SDK_PATH>/output/images` 目录下操作，该目录包含了 SDK 构建生成的所有镜像文件。

1. 进入 SDK 的 images 输出目录：
```bash
cd <SDK_PATH>/output/images
```

2. 创建或修改 `kernel.its` 文件：
```bash
cat > kernel.its << 'EOF'
/*
 * Compilation:
 * mkimage -f fit_kernel_dtb.its fit_kernel_dtb.itb
 *
 * Files in linux build dir:
 * - arch/arm/boot/Image (zImage-old-ok)
 * - arch/arm/boot/dts/ft.dtb
 *
 * fatload usb 0:1 0x90100000 fit_kernel_dtb.itb
 * bootm 0x90100000#e2000
 *
 */

/dts-v1/;
/ {
    description = "U-Boot fitImage for Phytium Phytiumpi";
    #address-cells = <1>;

    images {
        kernel {
            description = "AxVisor";
            data = /incbin/("axvisor.bin");
            type = "kernel";
            arch = "arm64";
            os = "linux";
            compression = "none";
            load =  <0x80080000>;
            entry = <0x80080000>;
            hash-1 {
                algo = "sha1";
            };
        };

        fdt-phytium {
            description = "FDT phytiumpi";
            data = /incbin/("phytiumpi_firefly.dtb");
            type = "flat_dt";
            arch = "arm64";
            compression = "none";
            hash-1 {
                algo = "sha1";
            };
        };
    };

    configurations {
        default = "phytium@cecport";

        phytium {
            description = "phytimpi";
            kernel = "kernel";
            fdt = "fdt-phytium";
            hash-1 {
                algo = "sha1";
            };
        };
    };
};
EOF
```

3. 将 AxVisor 镜像复制到当前目录：
```bash
cp <AXVISOR_PATH>/target/aarch64-unknown-none-softfloat/release/axvisor.bin .
```

4. 使用 mkimage 工具生成 fitImage：
```bash
../host/bin/mkimage_phypi -f kernel.its fitImage
```

#### 生成 sdcard.img

**注意：** `genimage-sd.cfg` 源文件位于 `<SDK_PATH>/board/phytium/genimage-sd.cfg`，但我们继续在 `<SDK_PATH>/output/images` 目录下操作。

1. 创建或修改 `genimage-sd.cfg` 文件：
```bash
cat > genimage.cfg << 'EOF'
image sdcard.img {
    hdimage {
    }

    partition uboot {
        in-partition-table = no
        offset = 0
        image = "fip-all.bin"
        size = 4M
        holes = {"(0; 512)"}
    }
    partition bootload {
        in-partition-table = no
        offset = 4M
        image = "fitImage"
        size = 60M
    }

    partition root {
        partition-type = 0x83
        image = "rootfs.ext2"
        size = 5G
    }
}
EOF
```

2. 创建所需目录：
```bash
mkdir -p tmp root
```

3. 使用 genimage 工具生成 sdcard.img：
```bash
../host/bin/genimage --inputpath ./ --outputpath ./ --config genimage-sd.cfg --tmppath ./tmp --rootpath ./root
```

生成的 `sdcard.img` 位于当前目录 `<SDK_PATH>/output/images/sdcard.img`。

#### 烧写固件

将生成的 `sdcard.img` 烧写到 SD 卡：
```bash
sudo dd if=sdcard.img of=/dev/sdX bs=4M status=progress
sync
```

**注意：** 将 `/dev/sdX` 替换为实际的 SD 卡设备名称（可通过 `lsblk` 命令查看）。

烧写完成后，将 SD 卡插入开发板并上电启动即可运行 AxVisor。

### 方式二：文件系统加载部署

#### 准备客户机配置文件

复制客户机配置文件模板到工作目录：
```bash
# 复制 ArceOS 客户机配置文件
cp configs/vms/arceos-aarch64-e2000_smp1.toml tmp/configs/

# 复制 Linux 客户机配置文件
cp configs/vms/linux-aarch64-e2000_smp1.toml tmp/configs/
```

修改客户机配置文件，设置为文件系统加载模式：
```bash
# 修改 ArceOS 客户机配置
sed -i 's|image_location = ".*"|image_location = "fs"|g' tmp/configs/arceos-aarch64-e2000_smp1.toml
sed -i "s|kernel_path = \".*\"|kernel_path = \"/guest/images/arceos.bin\"|g" tmp/configs/arceos-aarch64-e2000_smp1.toml

# 修改 Linux 客户机配置
sed -i 's|image_location = ".*"|image_location = "fs"|g' tmp/configs/linux-aarch64-e2000_smp1.toml
sed -i "s|kernel_path = \".*\"|kernel_path = \"/guest/images/linux.bin\"|g" tmp/configs/linux-aarch64-e2000_smp1.toml
```

如果客户机配置文件中有 `dtb_path` 字段，同样需要修改为本地构建环境中的设备树文件路径。

#### 配置构建文件

使用 `cargo xtask defconfig phytiumpi` 命令设置飞腾派为默认构建配置：
```bash
cargo xtask defconfig phytiumpi
```

然后修改 `.build.toml` 文件，启用文件系统相关特性：
```bash
# 在 features 数组中添加文件系统相关特性
sed -i '/^features = \[/,/^\]/c\
features = [\
    "fs",\
    "axstd/ext4fs",\
    "driver/phytium-blk",\
    "dyn-plat",\
    "axstd/bus-mmio",\
]' .build.toml
```

或者手动编辑 `.build.toml` 文件，将 `features` 字段修改为：
```toml
features = [
    "fs",
    "axstd/ext4fs",
    "driver/phytium-blk",
    "dyn-plat",
    "axstd/bus-mmio",
]
```

**注意：** 文件系统加载模式下，`vm_configs` 保持为空数组 `[]`。

#### 编译 AxVisor

编译 AxVisor：
```bash
cargo xtask build
```

编译完成后，AxVisor 镜像位于 `target/aarch64-unknown-none-softfloat/release/axvisor.bin`。

#### 修改 fitImage

1. 进入 SDK 的 images 输出目录：
```bash
cd <SDK_PATH>/output/images
```

2. 创建或修改 `kernel.its` 文件（内容与内存加载模式相同）：
```bash
cat > kernel.its << 'EOF'
/*
 * Compilation:
 * mkimage -f fit_kernel_dtb.its fit_kernel_dtb.itb
 *
 * Files in linux build dir:
 * - arch/arm/boot/Image (zImage-old-ok)
 * - arch/arm/boot/dts/ft.dtb
 *
 * fatload usb 0:1 0x90100000 fit_kernel_dtb.itb
 * bootm 0x90100000#e2000
 *
 */

/dts-v1/;
/ {
    description = "U-Boot fitImage for Phytium Phytiumpi";
    #address-cells = <1>;

    images {
        kernel {
            description = "AxVisor";
            data = /incbin/("axvisor.bin");
            type = "kernel";
            arch = "arm64";
            os = "linux";
            compression = "none";
            load =  <0x82000000>;
            entry = <0x820000000>;
            hash-1 {
                algo = "sha1";
            };
        };

        fdt-phytium {
            description = "FDT phytiumpi";
            data = /incbin/("phytiumpi_firefly.dtb");
            type = "flat_dt";
            arch = "arm64";
            compression = "none";
            hash-1 {
                algo = "sha1";
            };
        };
    };

    configurations {
        default = "phytium@cecport";

        phytium {
            description = "phytimpi";
            kernel = "kernel";
            fdt = "fdt-phytium";
            hash-1 {
                algo = "sha1";
            };
        };
    };
};
EOF
```

3. 将 AxVisor 镜像复制到当前目录：
```bash
cp <AXVISOR_PATH>/target/aarch64-unknown-none-softfloat/release/axvisor.bin .
```

4. 使用 mkimage 工具生成 fitImage：
```bash
../host/bin/mkimage_phypi -f kernel.its fitImage
```

#### 添加客户机配置到 rootfs.ext2

在文件系统加载模式下，需要将客户机镜像和配置文件添加到根文件系统中。AxVisor 默认从 `/guest` 目录加载客户机文件。
```bash
# 创建挂载点
mkdir -p rootfs

# 挂载 rootfs.ext2
sudo mount rootfs.ext2 rootfs

# 创建目录结构
sudo mkdir -p rootfs/guest/configs
sudo mkdir -p rootfs/guest/images

# 复制客户机配置文件
sudo cp <AXVISOR_PATH>/tmp/configs/arceos-aarch64-e2000_smp1.toml rootfs/guest/configs/
sudo cp <AXVISOR_PATH>/tmp/configs/linux-aarch64-e2000_smp1.toml rootfs/guest/configs/

# 复制客户机镜像
sudo cp <AXVISOR_PATH>/tmp/images/phytiumpi_arceos/phytiumpi rootfs/guest/images/phytiumpi-arceos
sudo cp <AXVISOR_PATH>/tmp/images/phytiumpi_linux/phytiumpi rootfs/guest/images/phytiumpi-linux

# 如果有设备树文件，也需要复制
# sudo cp <DTB_PATH> rootfs/guest/images/

# 卸载
sudo umount rootfs
```

文件系统中的目录结构如下：
```
/guest/
├── configs/
│   ├── arceos-aarch64-e2000_smp1.toml
│   └── linux-aarch64-e2000_smp1.toml
└── images/
    ├── phytiumpi-arceos
    ├── phytiumpi-linux
    └── *.dtb (如果需要)
```

#### 生成 sdcard.img

1. 创建或修改 `genimage.cfg` 文件：
```bash
cat > genimage.cfg << 'EOF'
image sdcard.img {
    hdimage {
    }

    partition uboot {
        in-partition-table = no
        offset = 0
        image = "fip-all.bin"
        size = 4M
        holes = {"(0; 512)"}
    }
    partition bootload {
        in-partition-table = no
        offset = 4M
        image = "fitImage"
        size = 60M
    }

    partition root {
        partition-type = 0x83
        image = "rootfs.ext2"
        size = 5G
    }
}
EOF
```

2. 创建所需目录：
```bash
mkdir -p tmp root
```

3. 使用 genimage 工具生成 sdcard.img：
```bash
../host/bin/genimage --inputpath ./ --outputpath ./ --config genimage.cfg --tmppath ./tmp --rootpath ./root
```

生成的 `sdcard.img` 位于当前目录 `<SDK_PATH>/output/images/sdcard.img`。

#### 烧写固件

将生成的 `sdcard.img` 烧写到 SD 卡：
```bash
sudo dd if=sdcard.img of=/dev/sdX bs=4M status=progress
sync
```

**注意：** 将 `/dev/sdX` 替换为实际的 SD 卡设备名称（可通过 `lsblk` 命令查看）。

烧写完成后，将 SD 卡插入开发板并上电启动即可运行 AxVisor。

## 运行验证

完成部署后，需要对 AxVisor 的运行状态进行验证，确保虚拟化系统正常工作。本节将详细介绍连接方法、启动过程验证以及常见问题的处理方法。

### 串口连接

在验证运行状态之前，需要通过串口连接到飞腾派开发板。

#### 安装串口工具

在主机上安装串口通信工具：

```bash
# Ubuntu/Debian 系统
sudo apt install picocom minicom

# 或者使用 minicom
sudo apt install minicom
```

#### 连接设置

飞腾派的串口参数：
- 波特率：115200
- 数据位：8
- 停止位：1
- 校验位：无

使用 picocom 连接：
```bash
# 查看串口设备
ls /dev/ttyUSB*

# 连接串口（根据实际设备调整）
picocom -b 115200 --imap lfcrlf /dev/ttyUSB0
```

使用 minicom 连接：
```bash
# 配置 minicom
sudo minicom -s

# 或者直接连接
sudo minicom -D /dev/ttyUSB0 -b 115200
```

**退出 picocom：** `Ctrl+A` 然后按 `Ctrl+X`
**退出 minicom：** `Ctrl+A` 然后按 `Q`

### 启动过程验证

#### AxVisor 启动信息

开发板上电后，应该能看到以下启动信息：

![deploy](./imgs_phytiumpi/deploy.png)

#### 文件系统加载模式验证

如果使用文件系统加载部署，需要手动创建和启动客户机：

```bash
# 进入 AxVisor shell
# AxVisor>

# 列出可用的客户机配置
ls /guest/configs/

# 创建客户机实例
vm create /guest/configs/arceos-aarch64-e2000-smp1.toml

# 启动客户机（VM ID 为 0）
vm start 1

# 创建第二个客户机
vm create /guest/configs/linux-aarch64-e2000-smp1.toml

# 启动第二个客户机（VM ID 为 1）
vm start 2
```

#### 客户机运行状态

**Linux 客户机启动信息：**
```
axvisor:/$ vm start 2
[ 86.383762 0:2 axvisor::vmm::vcpus:341] Initializing VM[2]'s 1 vcpus
[ 86.388597 0:2 axvisor::vmm::vcpus:390] Spawning task for VM[2] VCpu[0]
[ 86.396416 0:2 axvisor::vmm::vcpus:405] VCpu task Task(14, "VM[2]-VCpu[0]") created cpumask: [3, ]
[ 86.406568 0:2 axvm::vm:416] Booting VM[2]
[ 86.409561 3:14 axvisor::vmm::vcpus:428] VM[2] boot delay: 5s
✓ VM[2] started successfully
axvisor:/$ [ 91.418803 3:14 axvisor::vmm::vcpus:431] VM[2] VCpu[0] waiting for running
[ 91.424007 3:14 axvisor::vmm::vcpus:434] VM[2] VCpu[0] running...
[    0.000000] Booting Linux on physical CPU 0x0000000100 [0x701f6643]
[    0.000000] Linux version 5.10.209-phytium-embedded-v2.3 (runner@s1lqc) (aarch64-none-linux-gnu-gcc (GNU Toolchain for the A-profile Architecture 10.2-2020.11 (arm-10.16)) 10.2.1 20201103, GNU ld (GNU Toolchain for the A-profile Architecture 10.2-2020.11 (arm-10.16)) 2.35.1.20201028) #1 SMP PREEMPT Thu Nov 20 15:21:23 CST 2025
[    0.000000] Machine model: Phytium Pi Board
[    0.000000] earlycon: pl11 at MMIO 0x000000002800d000 (options '')
[    0.000000] printk: bootconsole [pl11] enabled

............

Welcome to Phytium Pi OS firstlogin!
```

**ArceOS 客户机启动信息：**
```

```

> **当前版本的 AxVisor 存在以下限制：**
> 
> 1. **Shell 切换限制**：Linux 客户机启动后，无法返回 AxVisor shell，需要重启开发板
