---
sidebar_position: 1
sidebar_label: "概述"
---

# 概述

AxVisor 是一个基于 [ArceOS](https://github.com/arceos-org/arceos) 框架实现的 Hypervisor。其目标是利用 ArceOS 提供的基础操作系统功能作为基础实现一个统一的组件化 Hypervisor。

![AxVisor](./design/arch/images/axvisor.png)

**统一**是指使用同一套代码同时支持 x86_64、AArch64 、RISC-V LoongArch 这四种架构，以最大化复用架构无关代码，简化代码开发和维护成本。

**组件化**则是指 Hypervisor 的功能被分解为多个可独立使用的组件，每个组件实现一个特定的功能，组件之间通过标准接口进行通信，以实现功能的解耦和复用。

## 客户机系统支持

目前，AxVisor 已经在对如下系统作为客户机的情况进行了验证。

### ArceOS

[ArceOS](https://github.com/arceos-org/arceos) 是一个用 Rust 编写的专为嵌入式系统和物联网设备设计的轻量级操作系统，提供简单、高效、可定制的功能，适合需要实时响应和低资源开销的应用场景。
### Starry-OS

[Starry-OS](https://github.com/Starry-OS) 是一款轻量级、组件化且高效的操作系统，专为嵌入式系统和物联网设备设计。它具有实时性支持、跨平台能力以及灵活的定制选项，适合在资源受限的环境中运行。

### NimbOS

[NimbOS](https://github.com/equation314/nimbos) 是一款用 Rust 编写的专为资源受限环境和嵌入式设备设计的实时操作系统，具有轻量化、实时支持、低功耗、组件化架构等优点。

### Linux

硬件厂家发布的 Linux 发行版

## 硬件支持

AxVisor 被设计为可以在 x86_64、AArch64 、RISC-V、LoongArch 四大芯片架构上运行，目前，已经在如下平台进行了验证：

- [x] QEMU ARM64 virt (qemu-max)
- [x] Rockchip RK3568 / RK3588
- [x] 飞腾派
- 更多硬件平台逐步添加中