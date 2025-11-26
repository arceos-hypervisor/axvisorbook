---
sidebar_position: 1
---
# 核心数据结构与算法

### 1. 关键数据结构

#### 1.1 NodeAction 枚举 - 节点处理策略

```rust
enum NodeAction {
    Skip,                     // 跳过节点，不在客户机FDT中包含
    RootNode,                 // 根节点，必须包含
    CpuNode,                  // CPU节点，需要根据配置过滤
    IncludeAsPassthroughDevice,  // 作为直通设备节点包含
    IncludeAsChildNode,       // 作为直通设备的子节点包含
    IncludeAsAncestorNode,    // 作为直通设备的祖先节点包含
}
```

**设计理念**：
- 明确每个节点的处理策略
- 保证设备树结构的完整性
- 支持复杂的设备依赖关系处理

#### 1.2 Phandle 映射表 - 依赖关系索引

```rust
BTreeMap<u32, (String, BTreeMap<String, u32>)>
```

**结构说明**：
- **键**：32位 phandle 值
- **值元组**：`(节点完整路径, cells属性映射表)`

**核心用途**：
- 快速查找 phandle 对应的设备节点
- 支持复杂 phandle 属性的智能解析
- 提高设备依赖分析的性能

#### 1.3 设备缓存结构 - 高效查找索引

```rust
BTreeMap<String, Vec<Node>>
```

**设计优势**：
- O(log n) 的查找性能
- 支持同路径多节点的情况
- 便于路径前缀匹配操作
- 优化设备树的遍历和查询

### 2. 设备发现与查找算法

#### 2.1 节点路径构建算法

```rust
pub fn build_node_path(all_nodes: &[Node], target_index: usize) -> String
```

**实现原理**：
- 基于节点层级关系构建完整路径
- 通过遍历节点序列确定父子关系
- 避免同名节点的路径冲突问题

**路径示例**：
```
节点: uart@2800c000 (level: 3)
路径: /soc/uart@2800c000
```

#### 2.2 后代节点查找算法

```rust
fn get_descendant_nodes_by_path(node_cache: &BTreeMap<String, Vec<Node>>, parent_path: &str) -> Vec<String>
```

**查找策略**：
- 使用路径前缀匹配快速定位后代节点
- 支持递归查找所有子节点和孙节点
- 高效处理大型设备树结构

**查找逻辑**：
```rust
let search_prefix = if parent_path == "/" { "/".to_string() } else { parent_path.to_string() + "/" };

for path in node_cache.keys() {
    if path.starts_with(&search_prefix) && path.len() > search_prefix.len() {
        descendant_paths.push(path.clone());
    }
}
```

#### 2.3 设备依赖分析算法

```rust
fn find_device_dependencies(device_node_path: &str, phandle_map: &BTreeMap<u32, (String, BTreeMap<String, u32>)>, node_cache: &BTreeMap<String, Vec<Node>>) -> Vec<String>
```

**支持的 Phandle 属性类型**：
- `clocks`, `assigned-clocks` - 时钟依赖
- `power-domains` - 电源域依赖  
- `phys`, `phy-handle` - PHY 依赖
- `interrupts`, `interrupts-extended` - 中断依赖
- `gpios`, `*-gpios`, `*-gpio` - GPIO 依赖
- `dmas` - DMA 依赖
- 以及其他 10+ 种属性类型

**依赖解析原理**：
```rust
fn parse_phandle_property(prop_data: &[u8], prop_name: &str, phandle_map: &BTreeMap<u32, (String, BTreeMap<String, u32>)>) -> Vec<String> {
    // 1. 解析属性数据为u32数组
    let u32_values: Vec<u32> = prop_data.chunks(4)
        .map(|chunk| u32::from_be_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect();

    // 2. 识别phandle并解析specifier
    // 3. 根据cells数量正确解析依赖关系
}
```

### 3. 性能优化实现

#### 3.1 节点缓存构建优化

```rust
pub fn build_optimized_node_cache<'a>(fdt: &'a Fdt) -> BTreeMap<String, Vec<Node<'a>>>
```

**优化策略**：
- 一次性遍历构建完整索引
- 使用 BTreeMap 提供对数级查找性能
- 预分配容器容量减少动态扩容

**实现要点**：
```rust
let all_nodes: Vec<Node> = fdt.all_nodes().collect();
for (index, node) in all_nodes.iter().enumerate() {
    let node_path = build_node_path(&all_nodes, index);
    node_cache.entry(node_path).or_default().push(node.clone());
}
```

#### 3.2 工作队列算法

```rust
let mut devices_to_process: Vec<String> = configured_device_names.iter().cloned().collect();
let mut processed_devices: BTreeSet<String> = BTreeSet::new();

while let Some(device_node_path) = devices_to_process.pop() {
    if processed_devices.contains(&device_node_path) {
        continue; // 避免重复处理
    }
    // 处理依赖并添加到队列
}
```

**算法优势**：
- 避免重复处理同一设备
- 支持递归依赖发现
- 保证处理的完整性和正确性

### 4. 地址映射与中断处理原理

#### 4.1 PCIe 地址空间处理

**支持的 PCIe 空间类型**：
- **Configuration Space**：PCIe配置空间，用于设备配置
- **I/O Space**：I/O端口地址空间，用于端口映射
- **Memory32 Space**：32位内存地址空间，用于32位设备
- **Memory64 Space**：64位内存地址空间，用于大型设备

**映射算法**：
```rust
fn add_pci_ranges_config(vm_cfg: &mut AxVMConfig, node_name: &str, range: &PciRange, index: usize) {
    let base_address = range.cpu_address as usize;
    let size = range.size as usize;
    
    let prefix = match range.space {
        PciSpace::Configuration => "config",
        PciSpace::IO => "io", 
        PciSpace::Memory32 => "mem32",
        PciSpace::Memory64 => "mem64",
    };
    
    // 创建对应的直通设备配置
}
```

#### 4.2 中断路由处理

**中断类型过滤**：
- 只处理 GIC_SPI 类型的中断
- 跳过中断控制器节点本身
- 验证中断父节点的有效性

**中断信息提取**：
```rust
// 中断属性格式: <GIC_SPI/GIC_PPI, IRQn, trigger_mode>
for interrupt in interrupts {
    for (k, v) in interrupt.enumerate() {
        match k {
            0 => if v != 0 { break; }, // 只处理GIC_SPI
            1 => vm_cfg.add_pass_through_spi(v), // 中断号
            2 => {}, // 触发方式
            _ => {}
        }
    }
}
```

