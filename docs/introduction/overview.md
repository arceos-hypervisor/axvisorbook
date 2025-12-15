---
sidebar_position: 1
sidebar_label: "概述"
---

# 概述

AxVisor 是一个基于 [ArceOS](https://github.com/arceos-org/arceos) 框架实现的 Hypervisor。其目标是利用 ArceOS 提供的基础操作系统功能作为基础实现一个统一的组件化 Hypervisor。

![AxVisor](../design/architecture/images/axvisor.png)

**统一**是指使用同一套代码同时支持 x86_64、AArch64 、RISC-V LoongArch 这四种架构，以最大化复用架构无关代码，简化代码开发和维护成本。

**组件化**则是指 Hypervisor 的功能被分解为多个可独立使用的组件，每个组件实现一个特定的功能，组件之间通过标准接口进行通信，以实现功能的解耦和复用。

## 核心特性

- **多架构支持**：AxVisor 设计为支持多种处理器架构，包括 x86_64、AArch64、RISC-V 和 LoongArch，实现代码的最大化复用。

- **多客户机支持**：支持多种客户机操作系统，包括 [ArceOS](https://github.com/arceos-org/arceos)、[Starry-OS](https://github.com/Starry-OS)、[NimbOS](https://github.com/equation314/nimbos)、RT-Thread 和 Linux 发行版。详细信息请参考 [客户机支持](./guest.md)。

- **硬件平台兼容性**：已在多种硬件平台上验证，包括 QEMU Aarch64、QEMU x86_64、Rockchip RK3568/RK3588 和飞腾派。更多信息请查看 [硬件支持](./hardware.md)。

- **高效虚拟化**：提供高效的虚拟化解决方案，支持多虚拟机同时运行，每个虚拟机可以运行不同的客户机操作系统。

- **灵活配置**：通过配置文件可以灵活配置虚拟机的资源分配、设备映射等参数，满足不同应用场景的需求。

## 应用场景

AxVisor 适用于需要同时运行多个操作系统的场景，例如：

- 嵌入式系统开发与测试
- 物联网设备的多任务隔离
- 安全关键系统的实时与非实时任务分离
- 多操作系统环境的资源整合

## 快速开始

想要快速体验 AxVisor，请参考我们的 [快速开始指南](../quickstart/)，其中包含了在不同硬件平台上部署和运行 AxVisor 的详细步骤。
