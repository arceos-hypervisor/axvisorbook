---
sidebar_position: 1
sidebar_label: "客户机管理"
---

# 客户机管理

AxVisor Shell 提供了一套完整的虚拟机管理命令，用于创建、启动、停止和监控虚拟机。


:::warning 开发状态
该部分内容目前处于**测试开发阶段**，实现细节可能会随着项目迭代而发生变化。请在使用或参考此处内容时注意其暂时性，并以实际代码仓库中的最新实现为准。如果你在使用过程中发现问题或有改进建议，欢迎通过 [GitHub Issues](https://github.com/arceos-hypervisor) 反馈。
:::

## 快速参考

| 命令 | 功能 | 示例 |
|------|------|------|
| `vm list` | 列出所有 VM | `vm list` |
| `vm show <id>` | 显示 VM 详情 | `vm show 0` |
| `vm create <config>` | 创建 VM | `vm create /guest/vm.toml` |
| `vm start [id...]` | 启动 VM | `vm start 0` |
| `vm stop <id...>` | 停止 VM | `vm stop 0` |
| `vm suspend <id>` | 暂停 VM | `vm suspend 0` |
| `vm resume <id>` | 恢复 VM | `vm resume 0` |
| `vm restart <id>` | 重启 VM | `vm restart 0` |
| `vm delete <id>` | 删除 VM | `vm delete 0` |


## 命令详解

### vm list


列出所有虚拟机的状态。这是最常用的命令之一，用于快速查看系统中所有 VM 的概况，包括它们的运行状态、资源配置和 Vcpu 状态统计。

#### 用法

```bash
vm list [--format <FORMAT>]
```

#### 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--format, -f` | 输出格式：table 或 json | table |

#### 输出示例

命令支持两种输出格式：表格格式适合人类阅读，JSON 格式适合程序解析。

**表格格式**（默认）：

```
VM ID  NAME            STATUS       VCPU            MEMORY     VCPU STATE
------ --------------- ------------ --------------- ---------- --------------------
0      linux-qemu      Running      0               256MB      Run:1
1      linux-rk3588    Suspended    0,1,2,3,4,5,6,7 3GB        Blk:8
2      arceos          Stopped      0,1             8MB        Free:2
```

**JSON 格式**：

```bash
vm list --format json
```

```json
{
  "vms": [
    { "id": 0, "name": "linux-qemu", "state": "Running", "vcpu": 1, "memory": "256MB" }
  ]
}
```

### vm show

显示单个虚拟机的详细信息。该命令提供了多个层次的信息输出，用户可以根据需要选择查看基本信息、配置详情、设备统计或完整的详细信息。

#### 用法

```bash
vm show <VM_ID> [OPTIONS]
```

#### 选项

| 选项 | 说明 |
|------|------|
| `--full, -f` | 显示完整详情 |
| `--config, -c` | 显示配置信息 |
| `--stats, -s` | 显示设备统计 |

#### 输出示例

**基本模式**：

```
VM Details: 0

  VM ID:     0
  Name:      linux-qemu
  Status:    ● Running
  VCPUs:     1
  Memory:    256MB

VCPU Summary:
  Running: 1

Memory Summary:
  Total Regions: 1
  Total Size:    256MB

Use 'vm show 0 --full' for detailed information
```

**状态感知提示**：

根据 VM 状态提供操作建议：

| 状态 | 提示 |
|------|------|
| Suspended | `Use 'vm resume X' to continue.` |
| Stopped | `Use 'vm delete X' to clean up.` |
| Loaded | `Use 'vm start X' to boot.` |

### vm create

从配置文件创建虚拟机。该命令读取 TOML 格式的配置文件，解析并验证配置，然后在系统中创建相应的 VM 实例。支持批量创建多个 VM，每个配置文件对应一个独立的虚拟机。

####

```bash
vm create <CONFIG_FILE> [CONFIG_FILE...]
```

#### 批量创建

支持一次创建多个 VM。每个配置文件都会被独立处理，单个配置文件的解析或创建失败不会影响其他 VM 的创建。这对于需要同时部署多个虚拟机的场景非常有用：

```bash
vm create /guest/vm1.toml /guest/vm2.toml /guest/vm3.toml
```

每个配置独立处理，单个失败不影响其他。

### vm start

启动虚拟机。该命令将 VM 从 Loaded 或 Stopped 状态转换到 Running 状态。如果不指定 VM ID，则会尝试启动所有处于可启动状态的虚拟机。支持后台启动模式，避免命令行阻塞。

#### 用法

```bash
vm start [VM_ID...] [--detach]
```

#### 选项

| 选项 | 说明 |
|------|------|
| `--detach, -d` | 后台运行（不阻塞） |

### vm stop

停止虚拟机。该命令会向 VM 发送停止信号，让 Vcpu 退出执行循环。支持两种模式：优雅停止（等待 VM 完成清理）和强制停止（立即终止）。可以同时停止多个 VM。

#### 用法

```bash
vm stop <VM_ID...> [--force]
```

**注意：该功能仍在完善中。**

#### 选项

| 选项 | 说明 |
|------|------|
| `--force, -f` | 强制停止（不等待） |

### vm suspend / vm resume

暂停和恢复虚拟机。暂停会让所有 Vcpu 进入阻塞状态但保留执行状态，恢复则会唤醒所有 Vcpu 继续执行。这对于临时释放 CPU 资源或进行系统维护非常有用。

#### 用法

```bash
vm suspend <VM_ID>
vm resume <VM_ID>
```

**注意：该功能目前并未真正实现，仍在完善中。**

### vm restart

重启虚拟机。

#### 用法

```bash
vm restart <VM_ID> [--force]
```

**注意：该功能目前并未真正实现，仍在完善中。**

### vm delete

删除虚拟机。

#### 用法

```bash
vm delete <VM_ID> [--force] [--keep-data]
```

#### 选项

| 选项 | 说明 |
|------|------|
| `--force` | 强制删除（即使运行中） |
| `--keep-data` | 保留配置和数据文件 |

## 常见场景

### 快速测试一个 VM

```bash
vm create /guest/test.toml && vm start
```

### 批量管理 VM

```bash
# 创建多个 VM
vm create /guest/vm1.toml /guest/vm2.toml /guest/vm3.toml

# 启动所有 VM
vm start

# 查看所有 VM 状态
vm list

# 停止所有 VM
vm stop 0 1 2
```

### 调试 VM

```bash
# 查看 VM 详细信息
vm show 0 --full

# 查看配置
vm show 0 --config

# 查看设备统计
vm show 0 --stats
```

## 命令速查表

```bash
# 查看
vm list                           # 列出所有 VM
vm show 0                         # 查看 VM 基本信息
vm show 0 --full                  # 查看完整详情

# 创建
vm create /guest/linux.toml       # 创建 VM

# 控制
vm start 0                        # 启动 VM
vm stop 0                         # 停止 VM
vm suspend 0                      # 暂停 VM
vm resume 0                       # 恢复 VM
vm restart 0                      # 重启 VM

# 删除
vm delete 0                       # 删除 VM
vm delete 0 --force               # 强制删除
```