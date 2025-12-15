---
sidebar_position: 3
sidebar_label: "硬件支持"
---

# 硬件支持

AxVisor 被设计为可以在 x86_64、AArch64 、RISC-V、LoongArch 四大芯片架构上运行，目前，已经在如下平台进行了验证：

## 已验证硬件平台

### 虚拟化平台

- **QEMU Aarch64**
  
  QEMU Aarch64 平台是 AxVisor 开发和测试的主要平台之一，支持完整的虚拟化功能，包括：
  
  - 虚拟 CPU 支持
  - 内存虚拟化
  - 设备虚拟化
  - 中断虚拟化
  
  部署指南请参考 [QEMU Aarch64 快速开始](../quickstart/qemu/aarch64.md)。

- **QEMU x86_64**
  
  QEMU x86_64 平台提供了对 x86_64 架构的完整支持，包括：
  
  - 完整的 x86_64 指令集支持
  - 虚拟化扩展支持 (Intel VT-x / ~~AMD-V~~)
  - 多核处理器模拟
  - 丰富的设备模拟
  
  部署指南请参考 [QEMU x86_64 快速开始](../quickstart/qemu/x86_64.md)。

### 物理硬件平台

- **Rockchip RK3568 / RK3588**
  
  Rockchip RK3568 和 RK3588 是瑞芯微推出的一系列高性能 ARM 处理器，广泛应用于嵌入式设备和物联网场景。
  
  **RK3568 特性**：
  - 四核 ARM Cortex-A55 处理器
  - 支持 OpenGL ES 3.2, Vulkan 1.1
  - 多种视频编解码格式支持
  - 丰富的外设接口
  
  **RK3588 特性**：
  - 八核处理器 (4×Cortex-A76 + 4×Cortex-A55)
  - 高性能 GPU 支持
  - 8K 视频处理能力
  - 高速接口支持 (PCIe 3.0, USB 3.1)
  
  部署指南请参考 [Rockchip RK3568/RK3588 部署指南](../quickstart/board/roc-rk3568-pc.md)。

- **飞腾派**
  
  飞腾派是基于飞腾处理器系列的开发板，支持国产化处理器架构，为国内嵌入式应用提供了可靠的硬件平台。
  
  **特性**：
  - 飞腾 FT-2000/4 四核处理器
  - 支持硬件虚拟化扩展
  - 丰富的外设接口
  - 国产化可控
  
  部署指南请参考 [飞腾派部署指南](../quickstart/board/phytiumpi.md)。

## 架构支持详情

### x86_64 架构
- 支持 Intel VT-x 和 ~~AMD-V 虚拟化扩展~~
- 支持嵌套虚拟化
- 支持 EPT/NPT 二级地址转换
- 支持虚拟化 I/O (VT-d/~~AMD-Vi~~)

### AArch64 架构
- 支持 ARM Virtualization Extensions
- 支持 Stage-2 地址转换
- 支持 GICv2/GICv3 中断控制器虚拟化
- 支持 Timer 虚拟化

### ~~RISC-V 架构~~
- ~~支持 RISC-V Hypervisor Extension~~
- ~~支持二级地址转换~~
- ~~支持中断虚拟化~~
- ~~支持定时器虚拟化~~

### ~~LoongArch 架构~~
- ~~支持 LoongArch 虚拟化扩展~~
- ~~支持地址转换机制~~
- ~~支持中断虚拟化~~
- ~~支持定时器虚拟化~~

## 硬件要求

### 最低配置要求
- 内存：至少 512MB 可用内存
- 存储：至少 64MB 可用存储空间
- 处理器：支持硬件虚拟化扩展

### 推荐配置
- 内存：2GB 或更多
- 存储：1GB 或更多
- 处理器：多核处理器，支持硬件虚拟化扩展

## 未来支持计划

我们计划在未来的版本中添加对更多硬件平台的支持，包括：

- [ ] 更多 RISC-V 硬件平台
- [ ] LoongArch 物理硬件平台
- [ ] 更多 ARM 处理器平台
- [ ] 特定应用场景的定制硬件平台
