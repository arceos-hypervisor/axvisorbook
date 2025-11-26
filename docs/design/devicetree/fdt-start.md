---
sidebar_position: 1
---
# 设备树（FDT）使用说明

### 1. 快速开始

AxVisor 的设备树（FDT）处理模块为 AArch64 架构的虚拟机提供定制化的设备树生成服务。根据需求，可以选择以下两种使用方式：

**方式一：使用预定义设备树文件**
```toml
[kernel]
dtb_path = "/path/to/your-custom.dtb"
```
适用场景：已经有完整的、经过验证的设备树文件，后续将只会更新memory节点和CPU节点信息。

**方式二：动态生成设备树**
```toml
[kernel]
# dtb_path = ""  # 不使用此字段，触发动态生成
```
适用场景：无客户机设备树文件。

### 2. 配置文件完整模板

以下是一个完整的 VM 配置模板，包含了所有 FDT 相关的配置选项：

```toml
[base]
id = 1                      # VM 唯一标识
name = "my-vm"              # VM 名称，用于日志和调试
vm_type = 1                 # 虚拟化类型（固定为1）
cpu_num = 2                 # 虚拟CPU数量
phys_cpu_ids = [0x200, 0x201]  # 物理CPU ID列表

[kernel]
# 镜像配置
entry_point = 0x80200000    # 内核入口地址
image_location = "memory"   # 镜像位置："memory" 或 "fs"
kernel_path = "Image"       # 内核文件路径
kernel_load_addr = 0x80200000  # 内核加载地址

# 设备树配置
#dtb_path = "/path/to/your-custom.dtb"   # 可选：预定义DTB
#dtb_load_addr = 0x80000000               # 可选：DTB加载地址

# 内存区域配置
memory_regions = [
    [0x80000000, 0x20000000, 0x7, 1],  # 基地址, 大小, 权限, 映射类型
    [0xa0000000, 0x10000000, 0x7, 0]
]

[devices]
# 直通设备配置（仅在动态生成时生效）
passthrough_devices = [
    ["/soc/uart@2800c000"],           # 完整路径格式（推荐）
    # 或者传统格式，两种格式不可以混用
    # ["uart0", 0x2800c000, 0x2800c000, 0x1000, 0x1] #[name, base_gpa, base_hpa, length, irq_id]
]

# 排除设备配置
excluded_devices = [
    ["/gic-v3"],                      # 排除中断控制器
]

# 直通地址配置
passthrough_addresses = [
    [0x28041000, 0x1000000],         # 基地址, 长度
]
```

### 3. 字段说明

**3.1 `dtb_path`（设备树文件位置）**

客户机设备树可以有两种来源，一种是基于axvisor的设备树和客户机配置文件生成的客户机设备树，另一种是基于开发者提供的客户机设备树。当客户机配置文件中使用`dtb_path`字段时，客户机设备树基于`dtb_path`字段指定的设备树文件生成，不使用该字段时基于axvisor设备树生成。

```toml
[kernel]
dtb_path = "/path/to/custom.dtb"  # 使用预定义设备树
# dtb_path = ""                    # 动态生成设备树
```

**3.2 `dtb_load_addr`(客户机设备树加载地址)**

`dtb_load_addr`字段指定生成的客户机设备树放置的客户机物理地址（GPA），当使用该字段且当客户机内存使用直通方式（GPA=HVA）时，客户机设备树将会加载到该地址，当配置文件中未使用该字段或客户机内存使用非直通方式（GPA≠HVA）时，客户机设备树将放置到客户机内存的前512MB内存的最后一段的位置，该地址由axvisor计算获得。

**3.3 `phys_cpu_ids`(客户机CPU ID)**

phys_cpu_ids字段用来选择客户机使用的CPU物理ID，例如飞腾派e2000平台的设备树cpus字段如下，其中reg属性中定义了CPU物理ID (0x200/0x201/0x00/0x100)。
```
cpus {
    #address-cells = <0x02>;
    #size-cells = <0x00>;

    cpu@0 {
        compatible = "phytium,ftc310\0arm,armv8";
        reg = <0x00 0x200>;
        ...
    };

    cpu@1 {
        compatible = "phytium,ftc310\0arm,armv8";
        reg = <0x00 0x201>;
        ...
    };

    cpu@100 {
        compatible = "phytium,ftc664\0arm,armv8";
        reg = <0x00 0x00>;
        ...
    };

    cpu@101 {
        compatible = "phytium,ftc664\0arm,armv8";
        reg = <0x00 0x100>;
        ...
    };
};
```
**3.4 `memory_regions`(客户机内存地址)**

无论哪种客户机内存分配方式，客户机设备树都会根据申请到的客户机内存更新memory字段
```
memory {
    device_type = "memory";
    reg = <0x00 0x80000000 0x00 0x20000000>;
};
```
**3.5 `passthrough_devices`（直通设备）**

现支持两种格式的设备直通方式

格式一：传统完整配置
```
passthrough_devices = [
    ["intc@8000000", 0x800_0000, 0x800_0000, 0x50_000, 0x1], #[name, base_gpa, base_hpa, length, irq_id]
    ["pl011@9000000", 0x900_0000, 0x900_0000, 0x1000, 0x1],
    ["pl031@9010000", 0x901_0000, 0x901_0000, 0x1000, 0x1],
]
```

格式二：全路径配置（推荐）
```
passthrough_devices = [
    ["/syscon@fdc20000"],
    ["/pinctrl/gpio3@fe760000"], #从根节点开始的完整路径
    ["/"],        #根节点，表示所有设备都直通
]
```

当直通设备使用全路径方式时，这里只需要填写需要直通的设备名称即可，设备名称是从跟节点开始的完整路径，此时axvisor会根据提供的设备树或主设备树自动查找相关节点并直通，该节点及相关节点的地址均等信息会根据设备树识别并补充完整，其中"/"表示根节点，当直通根节点时主机所有节点均会直通给客户机。

**3.6 `excluded_devices` （不直通设备）**

设备直通时axvisor会识别相关设备并一并直通给客户机，当某个设备不希望直通给客户机时可以加入该字段中，这样该设备及其地址将不会直通给客户机使用，生成的客户机设备树也不会包含该设备。

**3.7 `passthrough_addresses`（直通地址）**

该字段用于将指定地址直通给客户机使用，在启动如定制linux客户机需要使用某段地址或设备树非标准需要直接指定直通地址时将会使用到。

