# 飞腾派

# 开发环境

AxVisor 及 ROC-RK3568-PC 的 SDK 仅支持在 Linux 系统进中进行开发。本文中的构建及部署环境均采用 Ubuntu 24.04 系统作为开发环境。

本文同时验证 AxVisor + Linux 客户机、AxVisor + ArceOS 客户机 以及 AxVisor + Linux 客户机 和 ArceOS 客户机三种情况！

# 构建

准备 AxVisor 镜像 + Linux 客户机镜像 + ArceOS 镜像。

## 构建 Linux 客户机镜像

根据飞腾派开发板官方文档，构建 Linux 客户机镜像。

### 获取 SDK

下载飞腾派官方 OS 构建系统 https://gitee.com/phytium_embedded/phytium-pi-os 以此来构建相关镜像。下载的 Phytium-Pi-OS 实际上是基于 Buildroot 。

