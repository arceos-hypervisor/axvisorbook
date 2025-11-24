---
sidebar_position: 4
---

# 开发板配置

测试设备是要运行 AxVisor 的设备，目前包括一块 x86 开发板，一块飞腾派开发板，一块瑞芯微开发板。后续随着 AxVisor 的平台扩展逐步添加新的测试设备。不同的测试设备需要不同的 AxVisor 固件，此外，他们的 Debug 接口和固件加载方式也不相同。

## ROC-RK3568-PC

[ROC-RK3568-PC](https://www.t-firefly.com/product/industry/rocrk3568pc.html) 是天启智能科技的 Filefly 团队推出的一款采用 RK3568 四核 64 位 Cortex-A55 处理器的嵌入式开发板。主频最高 2.0GHz、集成双核心架构 GPU 以及高效能 NPU；最大支持 8G 大内存；支持 WiFi6, 双千兆以太网。

![ROC-RK3568-PC](./images_test/roc-rk3568-pc.png)

### 调试接口

使用 USB 转 TTL 工具将 ROC-RK3568-PC 上的 Debug 接口与本地测试服务器相连，默认串口参数 1500000 N 8 1。当系统运行时，运行日志将通过 Debug 接口直接输出到本地测试服务器。

![ROC-RK3568-PC-DEBUG](./images_test/roc-rk3568-pc-debug.png)

### 固件加载

ROC-RK3568-PC 的启动固件默认使用 U-Boot 作为引导程序，我们通过 U-Boot 的 `loady` 功能将固件加载到 DDR 中运行。但是默认并不支持 `loady` 功能。因此，我们需要修改 SDK 源码中的 U-Boot 源码，添加 `loady` 功能，进而就可以借助 `loady` 功能通过 Debug 接口将测试固件直接加载到 DDR 中运行。

## 飞腾派

![phytiumpi](./images_test/phytiumpi.png)

### 调试接口

使用 USB 转 TTL 工具将飞腾派上的 Debug 引脚与本地测试服务器相连，默认串口参数 115200 N 8 1。当系统运行时，运行日志就会通过 Debug 引脚直接输出到本地测试服务器。

![phytiumpi_debug](./images_test/phytiumpi_debug.png)

### 固件加载

飞腾派的启动固件目前不开源，但是其默认也是采用 U-Boot 作为引导程序且支持 `loady` 功能，因此，我们可以直接借助 U-Boot 的 `loady` 功能将固件加载到 DDR 中运行。

由于，飞腾派的调试串口默认的波特率太低，加载镜像时间太长，不过其 U-Boot 默认支持网络，因此，我们可以直接借助于网口来实现固件加载。

## x86 开发板

TODO

### 固件加载

x86 平台的引导程序（BIOS）各厂家通常差别较大，但是，他们一般都支持 PXE 功能，因此，我们通过 PXE 来实现测试固件的加载。

![PXE](./images_test/pxe.png)
