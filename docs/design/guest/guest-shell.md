---
sidebar_position: 2
---

# 客户机管理工具

## VM 列表管理

### 数据结构设计

**VMList 结构**（`kernel/src/vmm/vm_list.rs`）：

```rust
/// VM 列表管理器
///
/// 使用 BTreeMap 而不是 HashMap 的原因：
/// 1. VM ID 通常是连续的小整数（0-255）
/// 2. BTreeMap 提供有序遍历（按 VM ID 排序）
/// 3. 小规模数据下性能相当，内存占用更小
/// 4. 支持范围查询（如获取 ID 0-10 的 VM）
struct VMList {
    vm_list: BTreeMap<usize, VMRef>,
}

/// 全局 VM 列表（使用 Mutex 保护）
static GLOBAL_VM_LIST: Mutex<VMList> = Mutex::new(VMList::new());
```

**BTreeMap vs HashMap 对比**：

| 特性 | BTreeMap | HashMap |
|------|----------|---------|
| 查找时间 | O(log n) | O(1) 平均 |
| 插入时间 | O(log n) | O(1) 平均 |
| 删除时间 | O(log n) | O(1) 平均 |
| 遍历顺序 | 有序（按 key） | 无序 |
| 内存占用 | 较小 | 较大（需要额外空间） |
| 范围查询 | 支持 | 不支持 |
| 适用场景 | 小规模有序数据 | 大规模无序数据 |

**为什么使用 BTreeMap**：

```rust
// 场景 1: 按顺序列出所有 VM
for (vm_id, vm) in vm_list.iter() {
    println!("VM[{}]: {}", vm_id, vm.name());
    // BTreeMap 保证按 ID 递增顺序输出
}

// 场景 2: 查找特定 ID 范围的 VM
let vms_0_to_10: Vec<_> = vm_list
    .range(0..=10)  // BTreeMap 支持范围查询
    .collect();

// 场景 3: VM 数量通常很小（< 10）
// O(log n) vs O(1) 差异可忽略
```

### VMList 实现

```rust
impl VMList {
    /// 创建新的 VM 列表
    const fn new() -> Self {
        Self {
            vm_list: BTreeMap::new(),
        }
    }

    /// 添加 VM 到列表
    ///
    /// # 参数
    /// - vm_id: VM 唯一标识符
    /// - vm: VM 引用（Arc）
    ///
    /// # Panic
    /// - 如果 VM ID 已存在
    fn push_vm(&mut self, vm_id: usize, vm: VMRef) {
        if self.vm_list.contains_key(&vm_id) {
            panic!("VM with id {} already exists", vm_id);
        }
        self.vm_list.insert(vm_id, vm);
        info!("VM[{}] added to global list", vm_id);
    }

    /// 根据 ID 获取 VM 引用
    ///
    /// # 返回值
    /// - Some(VMRef): VM 存在
    /// - None: VM 不存在
    fn get_vm_by_id(&self, vm_id: usize) -> Option<VMRef> {
        self.vm_list.get(&vm_id).cloned()
    }

    /// 从列表中移除 VM
    ///
    /// # 返回值
    /// - Some(VMRef): VM 存在并已移除
    /// - None: VM 不存在
    fn remove_vm(&mut self, vm_id: usize) -> Option<VMRef> {
        let vm = self.vm_list.remove(&vm_id);
        if vm.is_some() {
            info!("VM[{}] removed from global list", vm_id);
        }
        vm
    }
}
```

### 全局 API

```rust
/// 添加 VM 到全局列表
pub fn push_vm(vm: VMRef) {
    let vm_id = vm.id();
    GLOBAL_VM_LIST.lock().push_vm(vm_id, vm);
}

/// 根据 ID 获取 VM
///
/// # 线程安全
/// 使用 Arc 引用计数，返回 VM 的克隆引用
/// 原始 VM 在列表中保留，引用计数 +1
pub fn get_vm_by_id(vm_id: usize) -> Option<VMRef> {
    GLOBAL_VM_LIST.lock().get_vm_by_id(vm_id)
}

/// 从列表移除 VM
///
/// # 注意
/// - 仅从列表移除，不停止 VM
/// - 如果 VM 仍在运行，调用者需负责停止
pub fn remove_vm(vm_id: usize) -> Option<VMRef> {
    GLOBAL_VM_LIST.lock().remove_vm(vm_id)
}

/// 获取所有 VM 的列表
///
/// # 返回值
/// Vec<VMRef>: 所有 VM 的引用（克隆）
///
/// # 性能
/// O(n)，n 为 VM 数量
pub fn get_vm_list() -> Vec<VMRef> {
    GLOBAL_VM_LIST
        .lock()
        .vm_list
        .values()
        .cloned()
        .collect()
}
```

## VCpu 任务管理

### VMVCpus 数据结构

**结构定义**（`kernel/src/vmm/vcpus.rs`）：

```rust
/// VM 的所有 VCpu 任务管理器
pub struct VMVCpus {
    /// VM ID（仅用于调试）
    _vm_id: usize,

    /// 等待队列（用于 VCpu 同步）
    wait_queue: WaitQueue,

    /// VCpu 任务列表
    /// 索引 = VCpu ID
    vcpu_task_list: Vec<AxTaskRef>,

    /// 运行中或暂停的 VCpu 计数
    ///
    /// 用途：
    /// - 跟踪有多少 VCpu 正在运行或处于 Halt 状态
    /// - 当最后一个 VCpu 退出时，转换 VM 状态为 Stopped
    ///
    /// 使用 AtomicUsize 原因：
    /// - 多个 VCpu 线程并发访问
    /// - 无需额外锁保护
    /// - Relaxed 内存序即可（不需要同步其他数据）
    running_halting_vcpu_count: AtomicUsize,
}
```

**全局队列**：

```rust
/// 全局 VCpu 任务队列
///
/// 为什么使用 UnsafeCell：
/// 1. VMVCpus 不实现 Sync，但我们需要全局访问
/// 2. 访问总是通过 VM ID 分区，避免数据竞争
/// 3. 手动保证线程安全（不同 VM 的 VCpu 不会冲突）
static VM_VCPU_TASK_WAIT_QUEUE: Queue = Queue::new();

struct Queue(UnsafeCell<BTreeMap<usize, VMVCpus>>);

unsafe impl Sync for Queue {}
unsafe impl Send for Queue {}

impl Queue {
    const fn new() -> Self {
        Self(UnsafeCell::new(BTreeMap::new()))
    }

    /// 获取不可变引用
    ///
    /// # 安全性
    /// 调用者需保证：
    /// - 不会同时修改同一个 VM 的 VMVCpus
    /// - 读取时没有并发写入
    fn get(&self, vm_id: &usize) -> Option<&VMVCpus> {
        unsafe { (*self.0.get()).get(vm_id) }
    }

    /// 获取可变引用
    ///
    /// # 安全性
    /// 调用者需保证：
    /// - 独占访问（没有其他线程读取或写入）
    #[allow(clippy::mut_from_ref)]
    fn get_mut(&self, vm_id: &usize) -> Option<&mut VMVCpus> {
        unsafe { (*self.0.get()).get_mut(vm_id) }
    }

    fn insert(&self, vm_id: usize, vcpus: VMVCpus) {
        unsafe {
            (*self.0.get()).insert(vm_id, vcpus);
        }
    }

    fn remove(&self, vm_id: &usize) -> Option<VMVCpus> {
        unsafe { (*self.0.get()).remove(vm_id) }
    }
}
```

### VCpu 任务生命周期

**主 VCpu 设置**（`setup_vm_primary_vcpu`）：

```rust
/// 为 VM 设置主 vCPU（vCPU 0）
///
/// 调用时机：VM 初始化完成后，启动前
///
/// 流程：
/// 1. 创建 VMVCpus 管理器
/// 2. 创建主 VCpu 任务（处于阻塞状态）
/// 3. 添加到全局队列
pub fn setup_vm_primary_vcpu(vm: VMRef) {
    info!("Initializing VM[{}]'s {} vcpus", vm.id(), vm.vcpu_num());
    let vm_id = vm.id();

    // 创建管理器
    let mut vm_vcpus = VMVCpus::new(vm.clone());

    // 创建主 vCPU（vCPU 0）
    let primary_vcpu_id = 0;
    let primary_vcpu = vm.vcpu_list()[primary_vcpu_id].clone();
    let primary_vcpu_task = alloc_vcpu_task(vm.clone(), primary_vcpu);

    // 添加任务
    vm_vcpus.add_vcpu_task(primary_vcpu_task);

    // 注册到全局队列
    VM_VCPU_TASK_WAIT_QUEUE.insert(vm_id, vm_vcpus);
}
```

**辅助 VCpu 启动**（`vcpu_on`）：

```rust
/// 启动辅助 vCPU（vCPU 1, 2, ...）
///
/// 调用时机：客户机执行 PSCI CPU_ON 时
/// 调用者：主 VCpu 或其他已运行的 VCpu
///
/// # 参数
/// - vm: VM 引用
/// - vcpu_id: 要启动的 VCpu ID
/// - entry_point: VCpu 入口地址（GPA）
/// - arg: 传递给 VCpu 的参数（寄存器 x0）
fn vcpu_on(
    vm: VMRef,
    vcpu_id: usize,
    entry_point: GuestPhysAddr,
    arg: usize,
) {
    let vcpu = vm.vcpu_list()[vcpu_id].clone();

    // 验证状态
    assert_eq!(
        vcpu.state(),
        VCpuState::Free,
        "vcpu_on: {} invalid vcpu state {:?}",
        vcpu.id(),
        vcpu.state()
    );

    // 设置入口和参数
    vcpu.set_entry(entry_point)
        .expect("vcpu_on: set_entry failed");
    vcpu.set_gpr(0, arg);  // x0 = arg

    // 创建任务
    let vcpu_task = alloc_vcpu_task(vm.clone(), vcpu);

    // 添加到任务列表
    VM_VCPU_TASK_WAIT_QUEUE
        .get_mut(&vm.id())
        .unwrap()
        .add_vcpu_task(vcpu_task);
}
```

**任务分配**（`alloc_vcpu_task`）：

```rust
/// 为 VCpu 分配 axtask 任务
///
/// 特点：
/// 1. 入口函数：vcpu_run（无限循环）
/// 2. 栈大小：256 KiB
/// 3. CPU 亲和性：根据配置绑定到特定物理 CPU
/// 4. 任务扩展：存储 VM 和 VCpu 引用
///
/// # 线程安全
/// - 使用 Weak 引用 VM，避免循环引用
/// - VCpu 引用使用 Arc，共享所有权
fn alloc_vcpu_task(vm: VMRef, vcpu: VCpuRef) -> AxTaskRef {
    const KERNEL_STACK_SIZE: usize = 0x40000; // 256 KiB

    info!("Spawning task for VM[{}] VCpu[{}]", vm.id(), vcpu.id());

    // 创建任务
    let mut vcpu_task = TaskInner::new(
        vcpu_run,  // 入口函数
        format!("VM[{}]-VCpu[{}]", vm.id(), vcpu.id()),
        KERNEL_STACK_SIZE,
    );

    // 设置 CPU 亲和性
    if let Some(phys_cpu_set) = vcpu.phys_cpu_set() {
        vcpu_task.set_cpumask(AxCpuMask::from_raw_bits(phys_cpu_set));
        debug!(
            "VCpu[{}] pinned to CPU mask: {:#b}",
            vcpu.id(),
            phys_cpu_set
        );
    }

    // 关联 VM 和 VCpu
    // 使用 Weak 引用避免 VM 无法释放
    vcpu_task.init_task_ext(TaskExt::from_vm_ref(vm.clone(), vcpu));

    info!(
        "VCpu task {} created {:?}",
        vcpu_task.id_name(),
        vcpu_task.cpumask()
    );

    axtask::spawn_task(vcpu_task)
}
```

### VCpu 主循环

**vcpu_run 实现**：

```rust
/// VCpu 任务主循环
///
/// 执行流程：
/// 1. 等待 VM 进入 Running 状态
/// 2. 循环运行 VCpu
/// 3. 处理 VMExit
/// 4. 检查 VM 状态（暂停/停止）
fn vcpu_run() {
    let curr = axtask::current();
    let vm = curr.task_ext().vm();
    let vcpu = curr.task_ext().vcpu.clone();
    let vm_id = vm.id();
    let vcpu_id = vcpu.id();

    // ═══════════════════════════════════════
    // 阶段 1: 启动延迟
    // ═══════════════════════════════════════
    // 避免所有 VM 同时启动造成资源竞争
    let boot_delay_sec = (vm_id - 1) * 5;
    if boot_delay_sec > 0 {
        info!("VM[{vm_id}] boot delay: {boot_delay_sec}s");
        busy_wait(Duration::from_secs(boot_delay_sec as _));
    }

    // ═══════════════════════════════════════
    // 阶段 2: 等待 VM 启动
    // ═══════════════════════════════════════
    info!("VM[{}] VCpu[{}] waiting for running", vm_id, vcpu_id);
    wait_for(vm_id, || vm.running());

    info!("VM[{}] VCpu[{}] running...", vm_id, vcpu_id);
    mark_vcpu_running(vm_id);

    // ═══════════════════════════════════════
    // 阶段 3: 主循环
    // ═══════════════════════════════════════
    loop {
        // 运行 VCpu
        match vm.run_vcpu(vcpu_id) {
            Ok(exit_reason) => {
                // 处理 VMExit（详见 4.2.4）
                handle_vmexit(exit_reason, &vm, &vcpu);
            }
            Err(err) => {
                error!("VM[{vm_id}] VCpu[{vcpu_id}] error: {err:?}");
                vm.shutdown().expect("VM shutdown failed");
            }
        }

        // ═══════════════════════════════════════
        // 检查 VM 暂停状态
        // ═══════════════════════════════════════
        if vm.suspending() {
            debug!(
                "VM[{}] VCpu[{}] suspended, waiting...",
                vm_id, vcpu_id
            );
            wait_for(vm_id, || !vm.suspending());
            info!("VM[{}] VCpu[{}] resumed", vm_id, vcpu_id);
            continue;
        }

        // ═══════════════════════════════════════
        // 检查 VM 停止状态
        // ═══════════════════════════════════════
        if vm.stopping() {
            warn!(
                "VM[{}] VCpu[{}] stopping",
                vm_id, vcpu_id
            );

            // 最后一个退出的 VCpu 负责更新状态
            if mark_vcpu_exiting(vm_id) {
                info!("VM[{vm_id}] last VCpu exiting");

                // 转换状态：Stopping -> Stopped
                vm.set_vm_status(axvm::VMStatus::Stopped);

                // 减少运行 VM 计数
                sub_running_vm_count(1);

                // 唤醒等待的线程
                ax_wait_queue_wake(&super::VMM, 1);
            }

            break; // 退出主循环
        }
    }

    info!("VM[{}] VCpu[{}] exiting...", vm_id, vcpu_id);
}
```

### VMExit 处理

**Hypercall**：

```rust
AxVCpuExitReason::Hypercall { nr, args } => {
    debug!("Hypercall [{nr}] args {args:x?}");

    use crate::vmm::hvc::HyperCall;

    match HyperCall::new(vcpu.clone(), vm.clone(), nr, args) {
        Ok(hypercall) => {
            let ret_val = match hypercall.execute() {
                Ok(ret_val) => ret_val as isize,
                Err(err) => {
                    warn!("Hypercall [{nr:#x}] failed: {err:?}");
                    -1
                }
            };
            vcpu.set_return_value(ret_val as usize);
        }
        Err(err) => {
            warn!("Hypercall [{nr:#x}] failed: {err:?}");
        }
    }
}
```

**外部中断**：

```rust
AxVCpuExitReason::ExternalInterrupt { vector } => {
    debug!("VM[{vm_id}] VCpu[{vcpu_id}] IRQ {vector}");

    // 分发中断到中断处理器
    axhal::irq::irq_handler(vector as usize);

    // 检查定时器事件
    super::timer::check_events();
}
```

**CPU 电源管理**：

```rust
// CpuUp: 启动辅助 CPU
AxVCpuExitReason::CpuUp {
    target_cpu,
    entry_point,
    arg,
} => {
    info!(
        "VM[{vm_id}] VCpu[{vcpu_id}] booting CPU {target_cpu} \
         entry={entry_point:x} arg={arg:#x}"
    );

    // 从物理 CPU ID (MPIDR) 映射到 VCpu ID
    let vcpu_mappings = vm.get_vcpu_affinities_pcpu_ids();
    let target_vcpu_id = vcpu_mappings
        .iter()
        .find_map(|(vid, _, pid)| {
            if *pid == target_cpu as usize {
                Some(*vid)
            } else {
                None
            }
        })
        .expect("Physical CPU ID not found");

    // 启动目标 VCpu
    vcpu_on(vm.clone(), target_vcpu_id, entry_point, arg);
    vcpu.set_gpr(0, 0); // 返回成功
}

// CpuDown: 关闭 CPU
AxVCpuExitReason::CpuDown { _state } => {
    warn!("VM[{vm_id}] VCpu[{vcpu_id}] CPU down");
    wait(vm_id); // 进入等待状态
}

// Halt: 暂停执行（WFI 指令）
AxVCpuExitReason::Halt => {
    debug!("VM[{vm_id}] VCpu[{vcpu_id}] Halt");
    wait(vm_id);
}
```

**核间中断（IPI）**：

```rust
AxVCpuExitReason::SendIPI {
    target_cpu,
    target_cpu_aux: _,
    send_to_all,
    send_to_self,
    vector,
} => {
    debug!(
        "VM[{vm_id}] VCpu[{vcpu_id}] SendIPI \
         target={target_cpu:#x} vector={vector}"
    );

    if send_to_all {
        unimplemented!("Broadcast IPI not supported");
    }

    if target_cpu == vcpu_id as u64 || send_to_self {
        // 发送给自己
        inject_interrupt(vector as _);
    } else {
        // 发送给其他 VCpu
        vm.inject_interrupt_to_vcpu(
            CpuMask::one_shot(target_cpu as _),
            vector as _,
        )
        .unwrap();
    }
}
```

**系统关机**：

```rust
AxVCpuExitReason::SystemDown => {
    warn!("VM[{vm_id}] VCpu[{vcpu_id}] system shutdown");
    vm.shutdown().expect("VM shutdown failed");
}
```

## AxVisor Shell 实现

AxVisor 提供了强大的交互式 Shell 命令系统,用于虚拟机的全生命周期管理。Shell 命令系统采用**命令树(Command Tree)**架构,支持子命令、选项标志和位置参数的灵活组合。本节深入分析 Shell 命令的内部实现机制,包括命令解析、状态验证、批处理等核心功能。
AxVisor Shell 命令框架采用**命令树(Command Tree)**架构，提供灵活、可扩展的命令管理系统。框架的核心设计理念是：

1. **层次化组织**: 使用树状结构组织命令，支持任意深度的子命令嵌套
2. **声明式注册**: 通过构建器模式声明式注册命令，代码简洁清晰
3. **类型安全**: 利用 Rust 类型系统确保参数解析的正确性
4. **零成本抽象**: 命令解析和分发在编译期完成大部分工作，运行时开销最小

### 设计目标

- **用户友好**: 直观的命令语法（类似 Docker/Kubectl）
- **开发友好**: 简单的命令添加流程，无需修改核心框架
- **类型安全**: 编译期捕获大部分错误
- **性能优化**: 最小化运行时解析开销
- **可扩展**: 支持动态添加新命令模块

---

### 命令框架架构 

#### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                       User Input Layer                       │
│                  (REPL / Script Execution)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Command Parser Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Tokenizer   │─>│  Arg Parser  │─>│ Validation   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │ ParsedCommand
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Command Tree Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Root Command Node                        │   │
│  │  ├─ vm (CommandNode)                                  │   │
│  │  │  ├─ start (handler: vm_start)                      │   │
│  │  │  ├─ stop  (handler: vm_stop)                       │   │
│  │  │  └─ list  (handler: vm_list)                       │   │
│  │  └─ help (CommandNode)                                │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ Route to Handler
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Command Handler Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  vm_start()  │  │  vm_stop()   │  │  vm_list()   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      VMM Core Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   vm_list    │  │    vcpus     │  │   config     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

#### 命令解析流程

命令从用户输入到执行的完整流程：

```rust
// 完整的命令解析和执行流程示例
// 1. 用户输入
let input = "vm start 0 1 --detach";
// 2. 词法分析 (Tokenization)
let tokens = tokenize(input);
// => ["vm", "start", "0", "1", "--detach"]
// 3. 命令树查找
let command_tree = CommandTree::new();
let (node, remaining_tokens) = command_tree.find_command(&tokens);
// node: CommandNode for "vm start"
// remaining_tokens: ["0", "1", "--detach"]
// 4. 参数解析
let parsed = parse_arguments(node, remaining_tokens);
// => ParsedCommand {
//      positional_args: ["0", "1"],
//      flags: {"detach": true},
//      options: {}
//    }
// 5. 参数验证
validate_arguments(node, &parsed)?;
// 6. 执行处理函数
if let Some(handler) = node.handler {
    handler(&parsed);
}
```
##### 详细的解析阶段

**阶段 1: 词法分析 (Tokenization)** 

将输入字符串分割成 token 列表，支持：
- 空白符分隔: `vm start 0` → `["vm", "start", "0"]`
- 引号包围: `vm create "my vm"` → `["vm", "create", "my vm"]`
- 转义字符: `echo \"hello\"` → `["echo", "\"hello\""]`

```rust
/// 词法分析器：将输入字符串分割为 token 列表
///
/// # 支持的语法
/// - 空白符分隔: `vm start 0` -> ["vm", "start", "0"]
/// - 单引号: `echo 'hello world'` -> ["echo", "hello world"]
/// - 双引号: `echo "hello world"` -> ["echo", "hello world"]
/// - 转义字符: `echo \"test\"` -> ["echo", "\"test\""]
///
/// # 示例
/// ```
/// let input = "vm start 0 1 --name \"test vm\"";
/// let tokens = tokenize(input);
/// assert_eq!(tokens, vec!["vm", "start", "0", "1", "--name", "test vm"]);
/// ```

fn tokenize(input: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current_token = String::new();
    let mut in_quotes = false;
    let mut quote_char = '\0';
    let mut escaped = false;

    for ch in input.chars() {
        if escaped {
            current_token.push(ch);
            escaped = false;
            continue;
        }

        match ch {
            '\\' => {
                escaped = true;
            }
            '"' | '\'' => {
                if in_quotes {
                    if ch == quote_char {
                        // 结束引号
                        in_quotes = false;
                        quote_char = '\0';
                    } else {
                        current_token.push(ch);
                    }
                } else {
                    // 开始引号
                    in_quotes = true;
                    quote_char = ch;
                }
            }
            ' ' | '\t' | '\n' => {
                if in_quotes {
                    current_token.push(ch);
                } else if !current_token.is_empty() {
                    tokens.push(current_token.clone());
                    current_token.clear();
                }
            }
            _ => {
                current_token.push(ch);
            }
        }
    }

    if !current_token.is_empty() {
        tokens.push(current_token);
    }

    tokens
}
```

**阶段 2: 命令查找 (Command Lookup)** 

在命令树中查找匹配的命令节点：

```rust
/// 在命令树中查找命令节点
///
/// # 查找过程
/// 1. 从根节点开始
/// 2. 逐层匹配 token
/// 3. 遇到叶子节点或无法匹配时停止
/// 4. 返回最后匹配的节点和剩余 token
///
/// # 示例
/// ```
/// let tokens = vec!["vm", "start", "0", "1"];
/// let (node, remaining) = tree.find_command(&tokens);
/// // node: CommandNode for "vm start"
/// // remaining: ["0", "1"]
/// ```

impl CommandTree {
    pub fn find_command<'a>(
        &self,
        tokens: &'a [String],
    ) -> Result<(&CommandNode, &'a [String]), CommandError> {
        if tokens.is_empty() {
            return Err(CommandError::EmptyCommand);
        }

        let mut current_node = &self.root;
        let mut depth = 0;

        // 逐层匹配命令路径
        for (i, token) in tokens.iter().enumerate() {
            // 尝试在当前节点的子命令中查找
            if let Some(subcommand) = current_node.subcommands.get(token) {
                current_node = subcommand;
                depth = i + 1;
            } else {
                // 找不到子命令，停止查找
                break;
            }
        }

        // 检查是否找到有效的处理函数
        if current_node.handler.is_none() && depth < tokens.len() {
            return Err(CommandError::UnknownCommand(tokens[depth].clone()));
        }

        Ok((current_node, &tokens[depth..]))
    }
}
```

**阶段 3: 参数解析 (Argument Parsing)**

将剩余的 token 解析为位置参数、选项和标志： 

```rust
/// 参数解析器：将 token 列表解析为结构化的命令参数
///
/// # 参数类型
/// - 位置参数: `vm start 0 1` -> positional_args: ["0", "1"]
/// - 长选项: `--format json` -> options: {"format": "json"}
/// - 长选项(等号): `--format=json` -> options: {"format": "json"}
/// - 短选项: `-f json` -> options: {"f": "json"}
/// - 标志: `--force` -> flags: {"force": true}
///
/// # 解析规则
/// 1. 以 `--` 开头的是长选项或长标志
/// 2. 以 `-` 开头的是短选项或短标志
/// 3. 不以 `-` 开头的是位置参数
/// 4. 如果选项后面没有值，视为标志
fn parse_arguments(
    node: &CommandNode,
    tokens: &[String],
) -> Result<ParsedCommand, ParseError> {
    let mut positional_args = Vec::new();
    let mut options = BTreeMap::new();
    let mut flags = BTreeMap::new();
    let mut i = 0;

    while i < tokens.len() {
        let token = &tokens[i];
        if token.starts_with("--") {
            // 长选项或长标志
            let key_value = token.trim_start_matches("--");
            if let Some(eq_pos) = key_value.find('=') {
                // --option=value 格式
                let key = &key_value[..eq_pos];
                let value = &key_value[eq_pos + 1..];
                options.insert(key.to_string(), value.to_string());
            } else {
                // 检查下一个 token 是否是值
                if i + 1 < tokens.len() && !tokens[i + 1].starts_with('-') {
                    // --option value 格式
                    options.insert(key_value.to_string(), tokens[i + 1].clone());
                    i += 1; // 跳过下一个 token
                } else {
                    // --flag 格式
                    flags.insert(key_value.to_string(), true);
                }
            }
        } else if token.starts_with('-') && token.len() > 1 {
            // 短选项或短标志
            let key = token.trim_start_matches('-');
            if i + 1 < tokens.len() && !tokens[i + 1].starts_with('-') {
                // -o value 格式
                options.insert(key.to_string(), tokens[i + 1].clone());
                i += 1;
            } else {
                // -f 格式（标志）
                flags.insert(key.to_string(), true);
            }
        } else {
            // 位置参数
            positional_args.push(token.clone());
        }

        i += 1;
    }

    Ok(ParsedCommand {
        positional_args,
        options,
        flags,
    })
}
```

**阶段 4: 参数验证 (Validation)**

验证解析后的参数是否符合命令的要求：

```rust
/// 参数验证：检查解析后的参数是否符合命令定义
///
/// # 验证项
/// 1. 必需选项是否都已提供
/// 2. 选项值的类型是否正确
/// 3. 未知选项/标志检测
/// 4. 位置参数数量检查
fn validate_arguments(
    node: &CommandNode,
    parsed: &ParsedCommand,
) -> Result<(), ParseError> {
    // 检查必需的选项
    for opt_def in &node.options {
        if opt_def.required && !parsed.options.contains_key(&opt_def.name) {
            return Err(ParseError::MissingRequiredOption(opt_def.name.clone()));
        }
    }

    // 检查未知选项
    for key in parsed.options.keys() {
        let is_valid = node.options.iter().any(|opt| {
            opt.name == *key || opt.short_name.as_ref() == Some(key)
        });

        if !is_valid {
            return Err(ParseError::UnknownOption(key.clone()));
        }
    }

    // 检查未知标志
    for key in parsed.flags.keys() {
        let is_valid = node.flags.iter().any(|flag| {
            flag.name == *key || flag.short_name.as_ref() == Some(key)
        });

        if !is_valid {
            return Err(ParseError::UnknownFlag(key.clone()));
        }
    }

    Ok(())
}
```

#### 命令树设计

命令树是框架的核心数据结构，使用 `BTreeMap` 组织子命令，提供有序遍历能力。

##### 设计理念 

```
理念 1: 层次化命名空间
  - 不同功能域的命令分属不同子树
  - 避免命名冲突，易于管理

理念 2: 递归结构
  - 每个节点可以是命令（有 handler）
  - 每个节点也可以是命令组（有 subcommands）
  - 支持任意深度的嵌套

理念 3: 延迟执行
  - 命令树只负责路由，不执行业务逻辑
  - 处理函数通过函数指针注册，保持低耦合

理念 4: 自动生成帮助
  - 每个节点包含描述和使用说明
  - 可递归展示整个命令树结构
```

##### 树的组织示例

```
Root CommandTree
│
├─── vm (CommandNode)
│    ├─── handler: None                    // 命令组，无处理函数
│    ├─── description: "Virtual machine management"
│    ├─── subcommands:
│    │    ├─── start (CommandNode)
│    │    │    ├─── handler: Some(vm_start)
│    │    │    ├─── description: "Start virtual machines"
│    │    │    ├─── flags: [FlagDef { name: "detach", ... }]
│    │    │    └─── options: []
│    │    │
│    │    ├─── stop (CommandNode)
│    │    │    ├─── handler: Some(vm_stop)
│    │    │    ├─── flags: [FlagDef { name: "force", ... }]
│    │    │    └─── options: []
│    │    │
│    │    └─── list (CommandNode)
│    │         ├─── handler: Some(vm_list)
│    │         ├─── options: [OptionDef { name: "format", ... }]
│    │         └─── flags: []
│    │
├─── vcpu (CommandNode)
│    ├─── handler: None
│    └─── subcommands: [...]
│
└─── help (CommandNode)
     └─── handler: Some(show_help)

```

### 参数解析机制

参数分为三类：**位置参数**、**选项**和**标志**。

#### 参数类型对比

| 参数类型 | 语法示例 | 解析结果 | 用途 |
|---------|---------|---------|------|
| **位置参数** | `vm start 0 1` | `positional_args: ["0", "1"]` | 必需的主要参数（VM ID 等） |
| **选项（长）** | `--format json` | `options: {"format": "json"}` | 可选配置，需要值 |
| **选项（短）** | `-f json` | `options: {"f": "json"}` | 选项的简写形式 |
| **选项（等号）** | `--format=json` | `options: {"format": "json"}` | 选项的紧凑形式 |
| **标志（长）** | `--force` | `flags: {"force": true}` | 布尔开关，无需值 |
| **标志（短）** | `-f` | `flags: {"f": true}` | 标志的简写形式 |

#### 解析优先级和规则

```rust
// 解析规则决策树
if token.starts_with("--") {
    // 1. 长选项或长标志
    let key = token.trim_start_matches("--");

    if key.contains('=') {
        // 1a. --option=value 格式
        parse_as_option_with_equals();
    } else if next_token_is_value() {
        // 1b. --option value 格式
        parse_as_option_with_space();
    } else {
        // 1c. --flag 格式
        parse_as_flag();
    }
} else if token.starts_with('-') && token.len() > 1 {
    // 2. 短选项或短标志
    let key = token.trim_start_matches('-');

    if next_token_is_value() {
        // 2a. -o value 格式
        parse_as_short_option();
    } else {
        // 2b. -f 格式
        parse_as_short_flag();
    }
} else {
    // 3. 位置参数
    parse_as_positional_arg();
}
```

#### 特殊语法支持

**1. 混合参数顺序**

```bash

# 灵活的参数顺序
vm start --force 0 1 --detach
vm start 0 1 --force --detach
vm start 0 --force 1 --detach

# 都解析为：
# positional_args: ["0", "1"]
# flags: {"force": true, "detach": true}
```

**2. 多值选项**（可选扩展）

```bash
# 未来支持多值选项
vm create --cpu 0,1,2 --cpu 3,4
# options: {"cpu": ["0,1,2", "3,4"]}
```

**3. 参数终止符 `--`**（可选扩展）

```bash
# -- 之后的所有内容都视为位置参数
vm exec 0 -- ls -la --color=auto
# positional_args: ["ls", "-la", "--color=auto"]
```

---

### 核心数据结构

#### CommandNode - 命令节点

```rust
/// 命令树的节点
///
/// 每个节点可以是：
/// 1. 命令组（handler = None, subcommands 非空）
/// 2. 叶子命令（handler = Some, subcommands 可空）
/// 3. 混合节点（handler = Some, subcommands 非空）
#[derive(Debug, Clone)]
pub struct CommandNode {
    /// 命令处理函数
    /// None 表示这是一个命令组，需要继续匹配子命令
    pub handler: Option<fn(&ParsedCommand)>,
 
    /// 子命令映射
    /// Key: 子命令名称
    /// Value: 子命令节点
    pub subcommands: BTreeMap<String, CommandNode>,
 
    /// 命令的简短描述
    /// 用于生成帮助信息
    pub description: &'static str,
 
    /// 命令的使用说明
    /// 格式: "command [OPTIONS] <ARGS>"
    pub usage: Option<&'static str>,
 
    /// 支持的选项定义列表
    pub options: Vec<OptionDef>,
 
    /// 支持的标志定义列表
    pub flags: Vec<FlagDef>,
}
 
impl CommandNode {
    /// 创建新的命令节点
    pub const fn new(description: &'static str) -> Self {
        Self {
            handler: None,
            subcommands: BTreeMap::new(),
            description,
            usage: None,
            options: Vec::new(),
            flags: Vec::new(),
        }
    }
 
    /// 构建器模式：设置处理函数
    pub fn with_handler(mut self, handler: fn(&ParsedCommand)) -> Self {
        self.handler = Some(handler);
        self
    }
 
    /// 构建器模式：设置使用说明
    pub fn with_usage(mut self, usage: &'static str) -> Self {
        self.usage = Some(usage);
        self
    }
 
    /// 构建器模式：添加子命令
    pub fn add_subcommand(
        mut self,
        name: &str,
        subcommand: CommandNode,
    ) -> Self {
        self.subcommands.insert(name.to_string(), subcommand);
        self
    }
 
    /// 构建器模式：添加选项
    pub fn add_option(mut self, option: OptionDef) -> Self {
        self.options.push(option);
        self
    }
 
    /// 构建器模式：添加标志
    pub fn add_flag(mut self, flag: FlagDef) -> Self {
        self.flags.push(flag);
        self
    }
}
```

#### OptionDef - 选项定义

```rust
/// 命令选项定义
///
/// 选项是需要值的参数，如 `--format json`
#[derive(Debug, Clone)]
pub struct OptionDef {
    /// 选项名称（长格式）
    /// 例如: "format"
    pub name: String,
 
    /// 选项短名称（可选）
    /// 例如: Some("f")
    pub short_name: Option<String>,
 
    /// 选项描述
    pub description: &'static str,
 
    /// 是否必需
    pub required: bool,
 
    /// 默认值（可选）
    pub default_value: Option<String>,
 
    /// 值的类型提示（用于帮助信息）
    /// 例如: "FORMAT", "PATH", "NUMBER"
    pub value_type: &'static str,
}
 
impl OptionDef {
    /// 创建新的选项定义
    pub fn new(name: &str, description: &'static str) -> Self {
        Self {
            name: name.to_string(),
            short_name: None,
            description,
            required: false,
            default_value: None,
            value_type: "VALUE",
        }
    }
 
    /// 设置短名称
    pub fn with_short(mut self, short: &str) -> Self {
        self.short_name = Some(short.to_string());
        self
    }
 
    /// 设置为必需选项
    pub fn required(mut self) -> Self {
        self.required = true;
        self
    }
 
    /// 设置默认值
    pub fn with_default(mut self, value: &str) -> Self {
        self.default_value = Some(value.to_string());
        self
    }
 
    /// 设置值类型提示
    pub fn with_value_type(mut self, value_type: &'static str) -> Self {
        self.value_type = value_type;
        self
    }
}
```

#### FlagDef - 标志定义

```rust
/// 命令标志定义
///
/// 标志是布尔开关，不需要值，如 `--force`
#[derive(Debug, Clone)]
pub struct FlagDef {
    /// 标志名称（长格式）
    /// 例如: "force"
    pub name: String,
 
    /// 标志短名称（可选）
    /// 例如: Some("f")
    pub short_name: Option<String>,
 
    /// 标志描述
    pub description: &'static str,
}
 
impl FlagDef {
    /// 创建新的标志定义
    pub fn new(name: &str, description: &'static str) -> Self {
        Self {
            name: name.to_string(),
            short_name: None,
            description,
        }
    }
 
    /// 设置短名称
    pub fn with_short(mut self, short: &str) -> Self {
        self.short_name = Some(short.to_string());
        self
    }
}
```

#### ParsedCommand - 解析结果 

```rust
/// 解析后的命令
///
/// 包含所有解析出的参数信息
#[derive(Debug)]
pub struct ParsedCommand {
    /// 位置参数列表
    /// 例如: ["0", "1", "2"]
    pub positional_args: Vec<String>,
 
    /// 选项映射
    /// Key: 选项名称
    /// Value: 选项值
    /// 例如: {"format": "json", "output": "/tmp/out.txt"}
    pub options: BTreeMap<String, String>,
 
    /// 标志映射
    /// Key: 标志名称
    /// Value: 是否设置（始终为 true）
    /// 例如: {"force": true, "verbose": true}
    pub flags: BTreeMap<String, bool>,
}
 
impl ParsedCommand {
    /// 获取位置参数（按索引）
    pub fn get_arg(&self, index: usize) -> Option<&String> {
        self.positional_args.get(index)
    }
 
    /// 获取选项值
    pub fn get_option(&self, name: &str) -> Option<&String> {
        self.options.get(name)
    }
 
    /// 获取标志状态
    pub fn has_flag(&self, name: &str) -> bool {
        self.flags.get(name).copied().unwrap_or(false)
    }
 
    /// 位置参数数量
    pub fn arg_count(&self) -> usize {
        self.positional_args.len()
    }
}
```

#### CommandTree - 命令树

```rust
/// 命令树
///
/// 管理所有注册的命令
pub struct CommandTree {
    /// 根节点
    root: CommandNode,
}
 
impl CommandTree {
    /// 创建新的命令树
    pub fn new() -> Self {
        let mut root = CommandNode::new("AxVisor Shell");
 
        // 注册内置命令
        root = root
            .add_subcommand("help", build_help_command())
            .add_subcommand("exit", build_exit_command());
 
        // 注册 VM 命令
        root = root.add_subcommand("vm", build_vm_command());
 
        // 未来可以添加更多命令模块
        // root = root.add_subcommand("vcpu", build_vcpu_command());
        // root = root.add_subcommand("config", build_config_command());
 
        Self { root }
    }
 
    /// 执行命令
    pub fn execute(&self, input: &str) {
        // 1. 词法分析
        let tokens = tokenize(input);
        if tokens.is_empty() {
            return;
        }
 
        // 2. 命令查找
        let (node, remaining) = match self.find_command(&tokens) {
            Ok(result) => result,
            Err(e) => {
                eprintln!("Error: {:?}", e);
                return;
            }
        };
 
        // 3. 参数解析
        let parsed = match parse_arguments(node, remaining) {
            Ok(cmd) => cmd,
            Err(e) => {
                eprintln!("Error: {:?}", e);
                self.show_usage(node);
                return;
            }
        };
 
        // 4. 参数验证
        if let Err(e) = validate_arguments(node, &parsed) {
            eprintln!("Error: {:?}", e);
            self.show_usage(node);
            return;
        }
 
        // 5. 执行处理函数
        if let Some(handler) = node.handler {
            handler(&parsed);
        } else {
            eprintln!("Error: Command has no handler");
            self.show_usage(node);
        }
    }
 
    /// 显示命令用法
    fn show_usage(&self, node: &CommandNode) {
        if let Some(usage) = node.usage {
            println!("Usage: {}", usage);
        }
        println!("{}", node.description);
 
        if !node.options.is_empty() {
            println!("\nOptions:");
            for opt in &node.options {
                print!("  --{}", opt.name);
                if let Some(short) = &opt.short_name {
                    print!(", -{}", short);
                }
                println!(" <{}>    {}", opt.value_type, opt.description);
            }
        }
 
        if !node.flags.is_empty() {
            println!("\nFlags:");
            for flag in &node.flags {
                print!("  --{}", flag.name);
                if let Some(short) = &flag.short_name {
                    print!(", -{}", short);
                }
                println!("    {}", flag.description);
            }
        }
    }
}
```

--- 

### 命令注册机制

命令注册采用**构建器模式**，代码简洁易读。

#### 注册流程

```rust
/// VM 命令树构建函数
///
/// 在 Shell 初始化时调用，注册所有 VM 相关子命令
pub fn build_vm_command() -> CommandNode {
    // 1. 创建根节点
    let mut vm_node = CommandNode::new("Virtual machine management")
        .with_usage("vm <COMMAND> [OPTIONS] [ARGS]");

    // 2. 注册 start 子命令
    let start_cmd = CommandNode::new("Start virtual machines")
        .with_handler(vm_start)
        .with_usage("vm start [OPTIONS] [VM_ID...]")
        .add_flag(
            FlagDef::new("detach", "Run in background mode")
                .with_short("d")
        );

    vm_node = vm_node.add_subcommand("start", start_cmd);

    // 3. 注册 stop 子命令
    let stop_cmd = CommandNode::new("Stop virtual machines")
        .with_handler(vm_stop)
        .with_usage("vm stop [OPTIONS] <VM_ID...>")
        .add_flag(
            FlagDef::new("force", "Force stop without waiting")
                .with_short("f")
        );

    vm_node = vm_node.add_subcommand("stop", stop_cmd);

    // 4. 注册 list 子命令
    let list_cmd = CommandNode::new("List all virtual machines")
        .with_handler(vm_list)
        .with_usage("vm list [OPTIONS]")
        .add_option(
            OptionDef::new("format", "Output format")
                .with_short("f")
                .with_value_type("FORMAT")
                .with_default("table")
        );

    vm_node = vm_node.add_subcommand("list", list_cmd);

    // 5. 注册 show 子命令
    let show_cmd = CommandNode::new("Show virtual machine details")
        .with_handler(vm_show)
        .with_usage("vm show [OPTIONS] <VM_ID>")
        .add_flag(FlagDef::new("full", "Show full details"))
        .add_flag(FlagDef::new("config", "Show configuration"))
        .add_flag(FlagDef::new("stats", "Show statistics"));

    vm_node = vm_node.add_subcommand("show", show_cmd);

    // ... 注册其他子命令
    vm_node
}
```

#### 条件编译支持

```rust
/// 支持条件编译的命令注册
pub fn build_vm_command() -> CommandNode {
    let mut vm_node = CommandNode::new("Virtual machine management");

    // 始终可用的命令
    vm_node = vm_node
        .add_subcommand("list", build_vm_list_cmd())
        .add_subcommand("show", build_vm_show_cmd())
        .add_subcommand("stop", build_vm_stop_cmd());

    // 仅在 fs feature 启用时可用
    #[cfg(feature = "fs")]
    {
        vm_node = vm_node
            .add_subcommand("create", build_vm_create_cmd())
            .add_subcommand("start", build_vm_start_cmd());
    }

    vm_node
}
```
---

### 命令执行流程

#### 完整的执行路径

```rust
// Shell 主循环
pub fn run_shell() {
    let command_tree = CommandTree::new();

    loop {
        // 1. 显示提示符
        print!("axvisor> ");
        std::io::stdout().flush().unwrap();

        // 2. 读取用户输入
        let mut input = String::new();
        if std::io::stdin().read_line(&mut input).is_err() {
            break;
        }

        let input = input.trim();

        if input.is_empty() {
            continue;
        }
        // 3. 处理特殊命令
        if input == "exit" || input == "quit" {
            break;
        }

        // 4. 执行命令
        command_tree.execute(input);
    }
}
```

#### 命令处理函数签名

所有命令处理函数遵循统一的签名：

```rust
/// 命令处理函数的标准签名
type CommandHandler = fn(&ParsedCommand);

/// 示例：VM start 命令处理函数
fn vm_start(cmd: &ParsedCommand) {
    // 1. 获取参数
    let vm_ids = &cmd.positional_args;
    let detach = cmd.has_flag("detach");

    // 2. 参数校验
    if vm_ids.is_empty() {
        // 处理无参数情况：启动所有 VM
        start_all_vms(detach);
        return;
    }

    // 3. 执行业务逻辑
    for vm_id_str in vm_ids {
        match vm_id_str.parse::<usize>() {
            Ok(vm_id) => start_vm_by_id(vm_id, detach),
            Err(_) => eprintln!("Invalid VM ID: {}", vm_id_str),
        }
    }
}
```

---
### VM 管理命令实现

#### 状态验证函数

**状态验证的必要性**

虚拟机的生命周期管理涉及多个状态之间的转换。不合理的状态转换可能导致系统不一致甚至崩溃。例如:

- 尝试启动已经运行的 VM → 资源泄漏
- 尝试暂停已停止的 VM → 无效操作
- 删除运行中的 VM → 内存泄漏或段错误

为了防止这些问题,AxVisor 实现了一套完整的**状态验证函数**,在执行状态转换操作前进行严格检查。

**VM 状态机回顾**

```
      create()
         │
         ▼
    ┌─────────┐
    │ Loading │
    └────┬────┘
         │ init()
         ▼
    ┌─────────┐    boot()    ┌─────────┐
    │ Loaded  │─────────────>│ Running │
    └─────────┘               └────┬────┘
                                   │
                        suspend()  │  shutdown()
                              ┌────┴────┐
                              ▼         ▼
                        ┌───────────┐  ┌──────────┐
                        │ Suspended │  │ Stopping │
                        └─────┬─────┘  └────┬─────┘
                              │             │
                      resume()│             │
                              └─────────────┘
                                     │
                                     ▼
                                ┌─────────┐
                                │ Stopped │
                                └─────────┘
```

**状态转换验证**

每个状态转换操作都配备相应的验证函数,形成一个完整的**状态转换矩阵**:

| 操作 | 允许的起始状态 | 拒绝的状态 | 特殊处理 |
|------|--------------|-----------|---------|
| `start` | Loaded, Stopped | Running, Suspended, Stopping, Loading | - |
| `stop` | Running, Suspended | Stopped | force 标志可覆盖 Stopping |
| `suspend` | Running | Suspended, Stopped, Stopping, Loading, Loaded | - |
| `resume` | Suspended | Running, Stopped, Stopping, Loading, Loaded | - |

下面详细分析每个验证函数的实现:

**启动验证** (`can_start_vm`)

启动操作是最常见的状态转换。验证函数需要确保:

1. VM 处于可启动状态(Loaded 或 Stopped)
2. 不重复启动已运行的 VM(避免资源泄漏)
3. 引导用户使用正确的恢复命令(对 Suspended 状态)

```rust
/// 检查 VM 是否可以启动
///
/// # 设计要点
/// 1. 允许从 Loaded 和 Stopped 状态启动
/// 2. 对于 Suspended 状态,提示用户使用 resume 而非 start
/// 3. 对于 Stopping 状态,要求用户等待停止完成
///
/// # 返回值
/// - Ok(()): 允许启动
/// - Err(&str): 拒绝启动,错误消息包含建议操作
fn can_start_vm(status: VMStatus) -> Result<(), &'static str> {
    match status {
        // 正常可启动状态
        VMStatus::Loaded | VMStatus::Stopped => Ok(()),

        // 已经在运行,无需重复启动
        VMStatus::Running => Err("VM is already running"),

        // 暂停状态应使用 resume 命令
        VMStatus::Suspended => Err("VM is suspended, use 'vm resume' instead"),

        // 正在停止,需要等待
        VMStatus::Stopping => Err("VM is stopping, wait for it to fully stop"),

        // 仍在加载中,不应启动
        VMStatus::Loading => Err("VM is still loading"),
    }
}

/// 检查 VM 是否可以停止
///
/// 允许状态：Running, Suspended, (Loaded 仅用于强制停止)
/// force 参数允许覆盖某些限制
fn can_stop_vm(status: VMStatus, force: bool) -> Result<(), &'static str> {
    match status {
        VMStatus::Running | VMStatus::Suspended => Ok(()),
        VMStatus::Stopping => {
            if force {
                Ok(())
            } else {
                Err("VM is already stopping")
            }
        }
        VMStatus::Stopped => Err("VM is already stopped"),
        VMStatus::Loading | VMStatus::Loaded => Ok(()),
    }
}

/// 检查 VM 是否可以暂停
fn can_suspend_vm(status: VMStatus) -> Result<(), &'static str> {
    match status {
        VMStatus::Running => Ok(()),
        VMStatus::Suspended => Err("VM is already suspended"),
        VMStatus::Stopped => Err("VM is stopped, cannot suspend"),
        VMStatus::Stopping => Err("VM is stopping, cannot suspend"),
        VMStatus::Loading => Err("VM is loading, cannot suspend"),
        VMStatus::Loaded => Err("VM is not running, cannot suspend"),
    }
}

/// 检查 VM 是否可以恢复
fn can_resume_vm(status: VMStatus) -> Result<(), &'static str> {
    match status {
        VMStatus::Suspended => Ok(()),
        VMStatus::Running => Err("VM is already running"),
        VMStatus::Stopped => Err("VM is stopped, use 'vm start' instead"),
        VMStatus::Stopping => Err("VM is stopping, cannot resume"),
        VMStatus::Loading => Err("VM is loading, cannot resume"),
        VMStatus::Loaded => Err("VM is not started yet, use 'vm start' instead"),
    }
}
```

#### VM 创建

**vm create 命令设计**

`vm create` 命令是动态虚拟机管理的入口点,允许用户在运行时从配置文件创建新的虚拟机实例。该命令仅在启用 `fs` feature 时可用,因为它需要从文件系统读取 TOML 配置文件。

设计特点:

1. **批量创建支持**: 允许一次指定多个配置文件,系统将依次创建所有虚拟机
2. **错误隔离**: 单个虚拟机创建失败不会影响其他虚拟机的创建过程
3. **统计反馈**: 命令执行完毕后提供创建成功/失败的统计信息
4. **配置验证**: 在创建前自动验证配置文件的格式和内容
5. **原子性操作**: 每个虚拟机的创建是原子性的,要么完全成功要么回滚

创建流程概述:

```
用户调用 vm create
    │
    ├─→ 1. 参数验证 (检查是否提供配置文件路径)
    │
    ├─→ 2. 遍历所有配置文件
    │   ├─→ a. 读取配置文件内容
    │   ├─→ b. 调用 init_guest_vm() 解析并创建 VM
    │   ├─→ c. 成功: 打印 VM ID, 失败: 记录错误
    │   └─→ d. 继续下一个配置文件
    │
    └─→ 3. 输出统计信息和后续操作提示
```

**vm create**（`#[cfg(feature = "fs")]`）：

```rust
fn vm_create(cmd: &ParsedCommand) {
    let args = &cmd.positional_args;

    if args.is_empty() {
        println!("Error: No VM configuration file specified");
        println!("Usage: vm create [CONFIG_FILE]");
        return;
    }

    let initial_vm_count = vm_list::get_vm_list().len();

    // ═══════════════════════════════════════
    // 支持批量创建
    // ═══════════════════════════════════════
    for config_path in args.iter() {
        println!("Creating VM from config: {}", config_path);

        // 读取配置文件
        match read_to_string(config_path) {
            Ok(raw_cfg) => {
                // 调用 VMM 初始化函数
                match init_guest_vm(&raw_cfg) {
                    Ok(vm_id) => {
                        println!(
                            "✓ Successfully created VM[{}] from config: {}",
                            vm_id, config_path
                        );
                    }
                    Err(_) => {
                        println!(
                            "✗ Failed to create VM from {}: Configuration error",
                            config_path
                        );
                    }
                }
            }
            Err(e) => {
                println!("✗ Failed to read config file {}: {:?}", config_path, e);
            }
        }
    }

    // ═══════════════════════════════════════
    // 统计创建结果
    // ═══════════════════════════════════════
    let final_vm_count = vm_list::get_vm_list().len();
    let created_count = final_vm_count - initial_vm_count;

    if created_count > 0 {
        println!("Successfully created {} VM(s)", created_count);
        println!("Use 'vm start <VM_ID>' to start the created VMs.");
    } else {
        println!("No VMs were created.");
    }
}
```

**使用示例**：

```bash
# 创建单个 VM
vm create /guest/linux-rk3588.toml

# 批量创建
vm create /guest/vm1.toml /guest/vm2.toml /guest/vm3.toml
```

#### VM 启动

**vm start 命令设计**

`vm start` 命令负责将处于 `Loaded` 或 `Stopped` 状态的虚拟机转换到 `Running` 状态。这是虚拟机生命周期中最关键的操作之一,涉及 VCpu 任务创建、资源分配和状态同步等复杂流程。

命令特性:

1. **灵活的目标选择**:
   - 无参数: 启动所有处于可启动状态的虚拟机
   - 指定 ID: 启动一个或多个指定的虚拟机
   - 状态过滤: 自动跳过已运行或无法启动的虚拟机

2. **智能状态处理**:
   - 已运行的虚拟机: 跳过并提示
   - Suspended 状态: 提示使用 `vm resume` 而非 `vm start`
   - Stopping 状态: 要求用户等待停止完成
   - Loaded/Stopped 状态: 正常启动流程

3. **后台模式**:
   - `--detach` 标志: 虚拟机在后台运行,不阻塞命令行
   - 适用场景: 批量启动多个虚拟机,无需等待每个虚拟机完全启动

启动流程详解:

```
vm start [ID...] [--detach]
    │
    ├─→ 参数解析
    │   ├─ 无参数 → 启动所有虚拟机
    │   └─ 有参数 → 启动指定虚拟机
    │
    ├─→ 对每个目标虚拟机:
    │   │
    │   ├─→ 1. 状态验证 (can_start_vm)
    │   │   ├─ Loaded/Stopped → 允许
    │   │   ├─ Running → 跳过
    │   │   ├─ Suspended → 提示使用 resume
    │   │   └─ 其他 → 拒绝
    │   │
    │   ├─→ 2. 创建主 VCpu 任务 (setup_vm_primary_vcpu)
    │   │   └─ 仅首次启动时执行
    │   │
    │   ├─→ 3. 引导虚拟机 (vm.boot())
    │   │   ├─ 初始化 VCpu 状态
    │   │   ├─ 设置 EPT 页表
    │   │   └─ 转换状态 → Running
    │   │
    │   ├─→ 4. 唤醒主 VCpu (notify_primary_vcpu)
    │   │   └─ VCpu 线程开始执行
    │   │
    │   └─→ 5. 更新运行计数 (add_running_vm_count)
    │
    └─→ 统计并输出结果
```

**vm start**（`#[cfg(feature = "fs")]`）：

```rust
fn vm_start(cmd: &ParsedCommand) {
    let args = &cmd.positional_args;
    let detach = cmd.flags.get("detach").unwrap_or(&false);

    if args.is_empty() {
        // ═══════════════════════════════════════
        // 启动所有 VM
        // ═══════════════════════════════════════
        info!("VMM starting, booting all VMs...");
        let mut started_count = 0;

        for vm in vm_list::get_vm_list() {
            let status = vm.vm_status();

            // 跳过已运行的 VM
            if status == VMStatus::Running {
                println!("⚠ VM[{}] is already running, skipping", vm.id());
                continue;
            }

            // 仅启动 Loaded 或 Stopped 状态的 VM
            if status != VMStatus::Loaded && status != VMStatus::Stopped {
                println!("⚠ VM[{}] is in {:?} state, cannot start", vm.id(), status);
                continue;
            }

            if let Err(e) = start_single_vm(vm.clone()) {
                println!("✗ VM[{}] failed to start: {:?}", vm.id(), e);
            } else {
                println!("✓ VM[{}] started successfully", vm.id());
                started_count += 1;
            }
        }

        println!("Started {} VM(s)", started_count);
    } else {
        // ═══════════════════════════════════════
        // 启动指定 VM
        // ═══════════════════════════════════════
        for vm_name in args {
            if let Ok(vm_id) = vm_name.parse::<usize>() {
                start_vm_by_id(vm_id);
            } else {
                println!("Error: Invalid VM ID: {}", vm_name);
            }
        }
    }

    if *detach {
        println!("VMs started in background mode");
    }
}

/// 启动单个 VM 的核心逻辑
fn start_single_vm(vm: VMRef) -> Result<(), &'static str> {
    let vm_id = vm.id();
    let status = vm.vm_status();

    // ═══════════════════════════════════════
    // 1. 验证状态
    // ═══════════════════════════════════════
    can_start_vm(status)?;

    // ═══════════════════════════════════════
    // 2. 设置主 VCpu
    // ═══════════════════════════════════════
    vcpus::setup_vm_primary_vcpu(vm.clone());

    // ═══════════════════════════════════════
    // 3. 引导 VM
    // ═══════════════════════════════════════
    match vm.boot() {
        Ok(_) => {
            // ═══════════════════════════════════════
            // 4. 唤醒主 VCpu
            // ═══════════════════════════════════════
            vcpus::notify_primary_vcpu(vm_id);

            // ═══════════════════════════════════════
            // 5. 增加运行计数
            // ═══════════════════════════════════════
            add_running_vm_count(1);

            Ok(())
        }
        Err(err) => {
            error!("Failed to boot VM[{}]: {:?}", vm_id, err);
            Err("Failed to boot VM")
        }
    }
}
```

**使用示例**：

```bash
# 启动所有 VM
vm start

# 启动指定 VM
vm start 0
vm start 0 1 2

```

#### VM 停止

**vm stop 命令设计**

`vm stop` 命令用于优雅地停止运行中的虚拟机,将其从 `Running` 或 `Suspended` 状态转换到 `Stopped` 状态。停止操作涉及复杂的资源清理和状态同步过程,必须确保所有 VCpu 线程安全退出。

关键设计考量:

1. **优雅关机 vs 强制关机**:
   - **默认行为** (优雅关机): 向虚拟机发送关机信号,等待 VCpu 线程自然退出
     - 优点: 允许客户机执行清理操作,保证数据完整性
     - 缺点: 如果客户机无响应,可能无法完成关机

   - **强制关机** (`--force`): 立即终止 VCpu 线程,不等待客户机响应
     - 优点: 快速强制停止,适用于故障场景
     - 缺点: 可能导致客户机数据丢失,类似于强制断电

2. **批量停止支持**:
   - 允许一次停止多个虚拟机
   - 错误隔离: 单个虚拟机停止失败不影响其他虚拟机

3. **状态转换安全**:
   - 防止重复停止已停止的虚拟机
   - 对 `Stopping` 状态的特殊处理: 默认拒绝,`--force` 可覆盖

停止流程详解:

```
vm stop <ID...> [--force]
    │
    ├─→ 对每个目标虚拟机:
    │   │
    │   ├─→ 1. 状态验证 (can_stop_vm)
    │   │   ├─ Running/Suspended → 允许
    │   │   ├─ Stopped → 拒绝 (已停止)
    │   │   ├─ Stopping + force → 允许 (强制覆盖)
    │   │   └─ Stopping + !force → 拒绝 (正在停止)
    │   │
    │   ├─→ 2. 打印提示信息
    │   │   ├─ 强制停止: "Force stopping VM[id]..."
    │   │   └─ 优雅停止: "Gracefully stopping VM[id]..."
    │   │
    │   ├─→ 3. 调用 vm.shutdown()
    │   │   ├─ 设置 VM 状态为 Stopping
    │   │   ├─ 向所有 VCpu 发送停止信号
    │   │   └─ VCpu 主循环检测到 vm.stopping() 后退出
    │   │
    │   └─→ 4. 等待 VCpu 退出
    │       ├─ 最后一个退出的 VCpu 负责:
    │       │   ├─ 设置状态为 Stopped
    │       │   ├─ 减少运行计数 (sub_running_vm_count)
    │       │   └─ 唤醒等待的线程
    │       └─ 其他 VCpu 直接退出
    │
    └─→ 输出结果
```

**停止信号传播机制**:

```
Shell 命令层
    │ vm.shutdown()
    ▼
VM 状态层
    │ set_vm_status(Stopping)
    ▼
VCpu 主循环
    │ 检测 vm.stopping()
    ▼
VCpu 退出
    │ mark_vcpu_exiting()
    ▼
最后一个 VCpu
    │ 更新状态 → Stopped
    │ 减少运行计数
    └─ 唤醒等待线程
```

**vm stop**：

```rust
fn vm_stop(cmd: &ParsedCommand) {
    let args = &cmd.positional_args;
    let force = cmd.flags.get("force").unwrap_or(&false);

    if args.is_empty() {
        println!("Error: No VM specified");
        println!("Usage: vm stop [OPTIONS] <VM_ID>");
        return;
    }

    for vm_name in args {
        if let Ok(vm_id) = vm_name.parse::<usize>() {
            stop_vm_by_id(vm_id, *force);
        } else {
            println!("Error: Invalid VM ID: {}", vm_name);
        }
    }
}

fn stop_vm_by_id(vm_id: usize, force: bool) {
    match with_vm(vm_id, |vm| {
        let status = vm.vm_status();

        // ═══════════════════════════════════════
        // 1. 验证状态
        // ═══════════════════════════════════════
        if let Err(err) = can_stop_vm(status, force) {
            println!("⚠ VM[{}] {}", vm_id, err);
            return Err(err);
        }

        // ═══════════════════════════════════════
        // 2. 打印提示信息
        // ═══════════════════════════════════════
        match status {
            VMStatus::Stopping if force => {
                println!("Force stopping VM[{}]...", vm_id);
            }
            VMStatus::Running => {
                if force {
                    println!("Force stopping VM[{}]...", vm_id);
                } else {
                    println!("Gracefully stopping VM[{}]...", vm_id);
                }
            }
            VMStatus::Loading | VMStatus::Loaded => {
                println!("⚠ VM[{}] is in {:?} state, stopping anyway...", vm_id, status);
            }
            _ => {}
        }

        // ═══════════════════════════════════════
        // 3. 调用 shutdown
        // ═══════════════════════════════════════
        match vm.shutdown() {
            Ok(_) => Ok(()),
            Err(_err) => Err("Failed to shutdown VM"),
        }
    }) {
        Some(Ok(_)) => {
            println!("✓ VM[{}] stop signal sent successfully", vm_id);
            println!("  Note: VCpu threads will exit gracefully, VM status will transition to Stopped");
        }
        Some(Err(err)) => {
            println!("✗ Failed to stop VM[{}]: {:?}", vm_id, err);
        }
        None => {
            println!("✗ VM[{}] not found", vm_id);
        }
    }
}
```

**使用示例**：

```bash
# 正常停止
vm stop 0

# 强制停止
vm stop 0 --force

# 批量停止
vm stop 0 1 2
```

#### VM 暂停和恢复(实现未完善)

**suspend/resume 命令设计**

`vm suspend` 和 `vm resume` 命令实现虚拟机的暂停和恢复功能,允许临时冻结虚拟机执行而不完全停止它。这对于资源管理、快照创建和调试场景非常有用。

**暂停机制 (vm suspend)**

暂停操作将虚拟机从 `Running` 状态转换到 `Suspended` 状态。与完全停止不同,暂停保留虚拟机的所有状态,可以快速恢复执行。

设计特点:

1. **非阻塞暂停**:
   - 命令立即返回,VCpu 在下一次 VMExit 时进入暂停状态
   - VMExit 触发时机: 定时器中断、I/O 操作、异常等
   - 适用于客户机当前正在执行密集计算的场景

2. **状态同步验证**:
   - 轮询检查所有 VCpu 是否都进入 `Blocked` 状态
   - 超时机制 (默认 1 秒): 防止无限等待
   - 提供清晰的状态反馈

3. **渐进式暂停**:
   ```
   设置状态 → Suspended
       ↓
   VCpu 主循环检测 vm.suspending()
       ↓
   下一次 VMExit 时调用 wait_for()
       ↓
   VCpu 进入 Blocked 状态
       ↓
   虚拟机完全暂停
   ```

**恢复机制 (vm resume)**

恢复操作将虚拟机从 `Suspended` 状态转换回 `Running` 状态,所有 VCpu 从暂停点继续执行。

设计特点:

1. **即时恢复**:
   - 设置状态为 `Running`
   - 调用 `notify_all_vcpus()` 唤醒所有 VCpu
   - VCpu 立即从 `wait_for()` 返回并继续执行

2. **状态一致性保证**:
   - 仅允许从 `Suspended` 状态恢复
   - 对其他状态提供明确的错误提示
   - `Stopped` 状态需使用 `vm start` 而非 `vm resume`

暂停/恢复流程对比:

```
┌─────────── vm suspend ───────────┐     ┌─────────── vm resume ────────────┐
│                                  │     │                                  │
│  1. can_suspend_vm() 验证        │     │  1. can_resume_vm() 验证         │
│     ├─ Running → 允许            │     │     ├─ Suspended → 允许          │
│     └─ 其他 → 拒绝               │     │     └─ 其他 → 拒绝               │
│                                  │     │                                  │
│  2. set_vm_status(Suspended)     │     │  2. set_vm_status(Running)       │
│                                  │     │                                  │
│  3. VCpu 检测 vm.suspending()    │     │  3. notify_all_vcpus()           │
│     └─ 在下一次 VMExit 时暂停   │     │     └─ 唤醒等待队列中的 VCpu     │
│                                  │     │                                  │
│  4. VCpu 调用 wait_for()         │     │  4. VCpu 从 wait_for() 返回      │
│     └─ 进入 Blocked 状态         │     │     └─ 恢复执行                  │
│                                  │     │                                  │
│  5. 轮询验证所有 VCpu 已暂停     │     │  5. 立即返回                     │
│     └─ 超时 1 秒                 │     │     └─ 虚拟机继续运行            │
└──────────────────────────────────┘     └──────────────────────────────────┘
```

**使用场景**:

1. **临时释放资源**: 暂停高优先级虚拟机让出 CPU 给其他任务
2. **快照创建**: 暂停虚拟机以捕获一致的内存快照
3. **调试分析**: 暂停虚拟机检查内部状态
4. **迁移准备**: 暂停虚拟机为热迁移做准备

**vm suspend**：

```rust
fn suspend_vm_by_id(vm_id: usize) {
    println!("Suspending VM[{}]...", vm_id);

    let result = with_vm(vm_id, |vm| {
        let status = vm.vm_status();

        // ═══════════════════════════════════════
        // 1. 验证状态
        // ═══════════════════════════════════════
        if let Err(err_msg) = can_suspend_vm(status) {
            return Err(err_msg);
        }

        // ═══════════════════════════════════════
        // 2. 设置状态为 Suspended
        // ═══════════════════════════════════════
        vm.set_vm_status(VMStatus::Suspended);
        info!("VM[{}] status set to Suspended", vm_id);

        Ok(())
    });

    match result {
        Some(Ok(_)) => {
            println!("✓ VM[{}] suspend signal sent", vm_id);

            // ═══════════════════════════════════════
            // 3. 等待所有 VCpu 进入 Blocked 状态
            // ═══════════════════════════════════════
            let vcpu_count = with_vm(vm_id, |vm| vm.vcpu_num()).unwrap_or(0);
            println!("  Note: {} VCpu task(s) will enter wait queue at next VMExit", vcpu_count);

            println!("  Waiting for VCpus to suspend...");
            let max_wait_iterations = 10; // 1 秒超时
            let mut iterations = 0;
            let mut all_suspended = false;

            while iterations < max_wait_iterations {
                if let Some(vm) = vm_list::get_vm_by_id(vm_id) {
                    let vcpu_states: Vec<_> = vm.vcpu_list()
                        .iter()
                        .map(|vcpu| vcpu.state())
                        .collect();

                    let blocked_count = vcpu_states
                        .iter()
                        .filter(|s| matches!(s, VCpuState::Blocked))
                        .count();

                    if blocked_count == vcpu_states.len() {
                        all_suspended = true;
                        break;
                    }
                }

                iterations += 1;
                busy_wait(Duration::from_millis(100));
            }

            if all_suspended {
                println!("✓ All VCpu tasks are now suspended");
            } else {
                println!("⚠ Some VCpu tasks may still be transitioning to suspended state");
                println!("  VCpus will suspend at next VMExit (timer interrupt, I/O, etc.)");
            }

            println!("  Use 'vm resume {}' to resume the VM", vm_id);
        }
        Some(Err(err)) => {
            println!("✗ Failed to suspend VM[{}]: {}", vm_id, err);
        }
        None => {
            println!("✗ VM[{}] not found", vm_id);
        }
    }
}
```

**vm resume**：

```rust
fn resume_vm_by_id(vm_id: usize) {
    println!("Resuming VM[{}]...", vm_id);

    let result = with_vm(vm_id, |vm| {
        let status = vm.vm_status();

        // ═══════════════════════════════════════
        // 1. 验证状态
        // ═══════════════════════════════════════
        if let Err(err_msg) = can_resume_vm(status) {
            return Err(err_msg);
        }

        // ═══════════════════════════════════════
        // 2. 设置状态为 Running
        // ═══════════════════════════════════════
        vm.set_vm_status(VMStatus::Running);

        // ═══════════════════════════════════════
        // 3. 唤醒所有 VCpu
        // ═══════════════════════════════════════
        vcpus::notify_all_vcpus(vm_id);

        info!("VM[{}] resumed", vm_id);
        Ok(())
    });

    match result {
        Some(Ok(_)) => {
            println!("✓ VM[{}] resumed successfully", vm_id);
        }
        Some(Err(err)) => {
            println!("✗ Failed to resume VM[{}]: {}", vm_id, err);
        }
        None => {
            println!("✗ VM[{}] not found", vm_id);
        }
    }
}
```

#### VM 重启

**vm restart 命令设计**

`vm restart` 命令提供虚拟机的重启功能,实现"停止-等待-启动"的完整重启序列。与手动执行 `vm stop` + `vm start` 相比,restart 命令提供了自动化、同步化和错误处理的便利性。

设计特点:

1. **智能状态路由**:
   - **已停止状态** (Stopped/Loaded): 直接调用启动流程,跳过不必要的停止操作
   - **运行中状态** (Running/Suspended): 执行完整的停止-等待-启动序列
   - **过渡状态** (Stopping): 根据 force 标志决定等待或拒绝

2. **同步等待机制**:
   - 重启命令是**同步操作**,必须等待虚拟机完全停止后才启动
   - 使用轮询机制检查状态转换: Stopping → Stopped
   - 超时保护 (默认 5 秒): 防止无限等待卡住的虚拟机

3. **一致性保证**:
   - 确保新启动的虚拟机使用干净的初始状态
   - 避免停止未完成时启动导致的状态不一致
   - 防止资源泄漏 (VCpu 线程、内存映射等)

4. **错误处理策略**:
   - 停止超时: 中止重启操作,提示用户手动干预
   - 意外状态: 检测到非预期状态时立即终止,防止进一步破坏
   - VM 消失: 在等待过程中检测 VM 是否仍存在

**重启流程详解**:

```
vm restart <ID> [--force]
    │
    ├─→ 状态检查
    │   ├─ Stopped/Loaded → 直接启动 (快速路径)
    │   ├─ Running/Suspended → 完整重启序列
    │   ├─ Stopping + force → 等待停止完成
    │   ├─ Stopping + !force → 拒绝操作
    │   └─ Loading → 拒绝操作
    │
    ├─→ 完整重启序列 (Running/Suspended)
    │   │
    │   ├─→ 1. 发送停止信号
    │   │   └─ stop_vm_by_id(vm_id, force)
    │   │
    │   ├─→ 2. 同步等待停止
    │   │   ├─ 轮询检查状态 (每 100ms)
    │   │   ├─ 最大等待 50 次 (5 秒)
    │   │   ├─ Stopped → 继续启动
    │   │   ├─ Stopping → 继续等待
    │   │   ├─ 超时 → 中止重启
    │   │   └─ 其他状态 → 中止重启
    │   │
    │   └─→ 3. 重新启动
    │       └─ start_vm_by_id(vm_id)
    │
    └─→ 快速路径 (Stopped/Loaded)
        └─→ 直接启动
            └─ start_vm_by_id(vm_id)
```

**同步等待的必要性**:

重启命令必须是同步的,原因如下:

1. **资源一致性**: 新启动的虚拟机必须使用完全释放的资源
   - VCpu 线程必须完全退出
   - EPT 页表必须清理干净
   - 设备映射必须解除

2. **状态一致性**: 避免新旧虚拟机状态混淆
   - 防止两个虚拟机同时访问相同资源
   - 确保配置更新生效 (如果配置有变更)

3. **用户体验**: 提供明确的操作完成反馈
   - 用户知道何时重启真正完成
   - 可以安全地执行后续操作

**超时处理策略**:

```
5 秒超时 = 50 次轮询 × 100ms 间隔

正常情况下,虚拟机停止时间:
- 空闲虚拟机: < 100ms (几乎立即)
- 运行中虚拟机: 100-500ms (等待 VMExit)
- 密集计算虚拟机: 500-2000ms (等待下一次 VMExit)

5 秒超时覆盖了 99% 的正常场景,同时避免了:
- 无限等待卡住的虚拟机
- 用户体验差 (长时间无响应)
- 资源锁定 (其他操作无法进行)
```

**使用场景**:

1. **应用配置更改**: 修改虚拟机配置后需要重启生效
2. **故障恢复**: 虚拟机进入异常状态,重启以恢复正常
3. **定期重置**: 定期重启以清理累积的状态和资源
4. **开发调试**: 快速重启以测试新的内核或应用

**vm restart**：

```rust
fn restart_vm_by_id(vm_id: usize, force: bool) {
    println!("Restarting VM[{}]...", vm_id);

    // ═══════════════════════════════════════
    // 1. 检查当前状态
    // ═══════════════════════════════════════
    let current_status = with_vm(vm_id, |vm| vm.vm_status());
    if current_status.is_none() {
        println!("✗ VM[{}] not found", vm_id);
        return;
    }

    let status = current_status.unwrap();
    match status {
        VMStatus::Stopped | VMStatus::Loaded => {
            // ═══════════════════════════════════════
            // VM 已停止，直接启动
            // ═══════════════════════════════════════
            println!("VM[{}] is already stopped, starting...", vm_id);
            start_vm_by_id(vm_id);
        }
        VMStatus::Suspended | VMStatus::Running => {
            // ═══════════════════════════════════════
            // 先停止 VM
            // ═══════════════════════════════════════
            println!("Stopping VM[{}]...", vm_id);
            stop_vm_by_id(vm_id, force);

            // ═══════════════════════════════════════
            // 等待 VM 完全停止
            // ═══════════════════════════════════════
            println!("Waiting for VM[{}] to stop completely...", vm_id);
            let max_wait_iterations = 50; // 5 秒超时
            let mut iterations = 0;

            loop {
                if let Some(vm_status) = with_vm(vm_id, |vm| vm.vm_status()) {
                    match vm_status {
                        VMStatus::Stopped => {
                            println!("✓ VM[{}] stopped successfully", vm_id);
                            break;
                        }
                        VMStatus::Stopping => {
                            iterations += 1;
                            if iterations >= max_wait_iterations {
                                println!("⚠ VM[{}] stop timeout", vm_id);
                                return;
                            }
                            busy_wait(Duration::from_millis(100));
                        }
                        _ => {
                            println!("⚠ VM[{}] in unexpected state: {:?}", vm_id, vm_status);
                            return;
                        }
                    }
                } else {
                    println!("✗ VM[{}] no longer exists", vm_id);
                    return;
                }
            }

            // ═══════════════════════════════════════
            // 重新启动 VM
            // ═══════════════════════════════════════
            println!("Starting VM[{}]...", vm_id);
            start_vm_by_id(vm_id);
        }
        VMStatus::Stopping => {
            if force {
                println!("⚠ VM[{}] is currently stopping, waiting...", vm_id);
            } else {
                println!("⚠ VM[{}] is currently stopping", vm_id);
                println!("  Wait for shutdown to complete, then use 'vm start {}'", vm_id);
            }
        }
        VMStatus::Loading => {
            println!("✗ VM[{}] is still loading, cannot restart", vm_id);
        }
    }
}
```

#### VM 删除

**vm delete 命令设计**

`vm delete` 命令负责完全移除虚拟机,包括从全局列表删除、清理 VCpu 线程、释放内存资源以及可选的数据清理。这是虚拟机生命周期的最终阶段,涉及复杂的资源回收和一致性保证。

设计特点:

1. **多级安全检查**:
   - **默认保护**: 拒绝删除运行中或正在停止的虚拟机,防止意外数据丢失
   - **Force 覆盖**: `--force` 标志允许强制删除任何状态的虚拟机,适用于故障恢复
   - **状态反馈**: 对每种状态提供明确的错误消息和建议操作

2. **分阶段资源清理**:
   ```
   阶段 1: 发送关闭信号 (如果 VM 仍在运行)
   阶段 2: 从全局列表移除 (断开管理引用)
   阶段 3: Join VCpu 线程 (等待线程安全退出)
   阶段 4: 清理数据文件 (可选,取决于 --keep-data)
   阶段 5: 验证 Arc 引用计数 (检测内存泄漏)
   ```

3. **数据保留选项**:
   - **默认行为**: 完全删除虚拟机及其所有数据 (配置、磁盘镜像、日志)
   - **--keep-data**: 仅移除运行时状态,保留配置和数据文件,便于后续重新创建

4. **Arc 引用计数检测**:
   - 删除操作后检查 VM 的 `Arc::strong_count`
   - 期望值: 1 (仅剩 delete 函数持有的引用)
   - 如果 > 1: 警告可能的引用泄漏,帮助开发者发现 bug

**删除流程详解**:

```
vm delete <ID> [--force] [--keep-data]
    │
    ├─→ 1. 状态验证
    │   ├─ Running + !force → 拒绝 (提示先停止或使用 --force)
    │   ├─ Running + force → 警告并继续
    │   ├─ Stopping + !force → 拒绝 (提示等待或使用 --force)
    │   ├─ Stopping + force → 警告并继续
    │   ├─ Stopped → 正常删除
    │   └─ 其他状态 + !force → 拒绝 (提示使用 --force)
    │
    ├─→ 2. 发送关闭信号
    │   ├─ Running/Suspended/Stopping → set_vm_status(Stopping) + shutdown()
    │   ├─ Loaded → set_vm_status(Stopped)
    │   └─ Stopped → 无需操作
    │
    ├─→ 3. 从全局列表移除
    │   ├─ vm_list::remove_vm(vm_id)
    │   ├─ 成功 → 返回 Arc<VM>
    │   └─ 失败 → 打印错误并退出
    │
    ├─→ 4. Join VCpu 线程
    │   ├─ vcpus::cleanup_vm_vcpus(vm_id)
    │   ├─ 对每个 VCpu 任务调用 task.join()
    │   ├─ 等待所有线程安全退出
    │   └─ 释放 VCpu 相关资源
    │
    ├─→ 5. 清理数据 (可选)
    │   ├─ keep_data = false → 删除磁盘镜像、配置文件、日志
    │   └─ keep_data = true → 仅移除运行时状态
    │
    └─→ 6. Arc 引用计数验证
        ├─ Arc::strong_count(&vm) == 1 → 正常,VM 将被释放
        └─ Arc::strong_count(&vm) > 1 → 警告,可能存在引用泄漏
```

**Arc 引用计数管理**:

虚拟机使用 `Arc<AxVM>` 进行生命周期管理,理解引用计数至关重要:

```
VM 创建后的引用计数变化:

1. VM::new(config)                     → 引用计数 = 1
2. push_vm(vm.clone())                 → 引用计数 = 2 (全局列表 + 局部变量)
3. setup_vm_primary_vcpu(vm.clone())   → 引用计数 = 3 (+ VCpu 任务扩展)
4. vcpu_run 中保存 vm 引用             → 引用计数 = 4 (+ VCpu 主循环)

删除时的引用计数减少:

1. 局部变量超出作用域                  → 引用计数 = 3
2. VCpu 主循环退出                     → 引用计数 = 2
3. cleanup_vm_vcpus 清理任务扩展       → 引用计数 = 1
4. vm_list::remove_vm 移除全局引用     → 引用计数 = 1 (delete 函数持有)
5. delete_vm_by_id 函数返回            → 引用计数 = 0 → VM 被 Drop
```

**VCpu 线程清理机制**:

```rust
pub fn cleanup_vm_vcpus(vm_id: usize) {
    // 1. 从全局队列移除 VMVCpus 结构
    if let Some(vm_vcpus) = VM_VCPU_TASK_WAIT_QUEUE.remove(&vm_id) {
        // 2. Join 所有 VCpu 任务
        for (idx, task) in vm_vcpus.vcpu_task_list.iter().enumerate() {
            // join() 会阻塞直到线程退出
            if let Some(exit_code) = task.join() {
                debug!("VCpu[{}] exited with code: {}", idx, exit_code);
            }
        }
        // 3. vm_vcpus 超出作用域后被 drop
        //    其中的 vcpu_task_list 被 drop
        //    每个 AxTaskRef 被 drop
        //    任务扩展 (TaskExt) 被 drop
        //    TaskExt 中的 VMRef (Weak 升级的 Arc) 被 drop
    }
}
```

**数据清理策略** (TODO 部分):

```rust
// 当前实现: 仅打印 TODO
if !keep_data {
    // TODO: 实际清理操作
    // 计划实现:
    // 1. 删除磁盘镜像文件
    // 2. 删除配置文件
    // 3. 删除日志文件
    // 4. 清理临时文件
}

// 未来实现示例:
fn cleanup_vm_data(vm_id: usize, vm_name: &str) {
    #[cfg(feature = "fs")]
    {
        // 删除磁盘镜像
        let disk_path = format!("/guest/vms/{}/disk.img", vm_name);
        let _ = fs::remove_file(&disk_path);

        // 删除配置文件
        let config_path = format!("/guest/vms/{}/config.toml", vm_name);
        let _ = fs::remove_file(&config_path);

        // 删除日志文件
        let log_path = format!("/guest/vms/{}/vm.log", vm_name);
        let _ = fs::remove_file(&log_path);
    }
}
```

**安全删除 vs 强制删除对比**:

| 方面 | 安全删除 (默认) | 强制删除 (--force) |
|------|----------------|-------------------|
| **运行中 VM** | 拒绝,提示先停止 | 警告后继续 |
| **数据完整性** | 保证 (VM 已停止) | 可能丢失 (类似强制断电) |
| **适用场景** | 正常删除流程 | 故障恢复、卡死 VM |
| **风险** | 低 | 高 (可能导致数据损坏) |
| **用户体验** | 需要两步操作 | 一步完成 |

**使用场景**:

1. **清理测试 VM**: 测试完成后删除临时虚拟机
2. **释放资源**: 删除不再需要的虚拟机以释放内存和 CPU
3. **故障恢复**: 强制删除卡死或状态异常的虚拟机
4. **重新配置**: 删除现有 VM,使用新配置重新创建 (配合 --keep-data)

**vm delete**：

```rust
fn vm_delete(cmd: &ParsedCommand) {
    let args = &cmd.positional_args;
    let force = cmd.flags.get("force").unwrap_or(&false);
    let keep_data = cmd.flags.get("keep-data").unwrap_or(&false);

    if args.is_empty() {
        println!("Error: No VM specified");
        println!("Usage: vm delete [OPTIONS] <VM_ID>");
        return;
    }

    let vm_name = &args[0];

    if let Ok(vm_id) = vm_name.parse::<usize>() {
        // ═══════════════════════════════════════
        // 1. 检查 VM 状态
        // ═══════════════════════════════════════
        let vm_status = with_vm(vm_id, |vm| vm.vm_status());

        if vm_status.is_none() {
            println!("✗ VM[{}] not found", vm_id);
            return;
        }

        let status = vm_status.unwrap();

        // ═══════════════════════════════════════
        // 2. 验证状态和 force 标志
        // ═══════════════════════════════════════
        match status {
            VMStatus::Running => {
                if !force {
                    println!("✗ VM[{}] is currently running", vm_id);
                    println!("  Use 'vm stop {}' first, or use '--force'", vm_id);
                    return;
                }
                println!("⚠ Force deleting running VM[{}]...", vm_id);
            }
            VMStatus::Stopping => {
                if !force {
                    println!("⚠ VM[{}] is currently stopping", vm_id);
                    println!("  Wait for it to stop, or use '--force'");
                    return;
                }
                println!("⚠ Force deleting stopping VM[{}]...", vm_id);
            }
            VMStatus::Stopped => {
                println!("Deleting stopped VM[{}]...", vm_id);
            }
            _ => {
                println!("⚠ VM[{}] is in {:?} state", vm_id, status);
                if !force {
                    println!("Use --force to force delete");
                    return;
                }
            }
        }

        delete_vm_by_id(vm_id, *keep_data);
    } else {
        println!("Error: Invalid VM ID: {}", vm_name);
    }
}

fn delete_vm_by_id(vm_id: usize, keep_data: bool) {
    // ═══════════════════════════════════════
    // 1. 发送关闭信号（如果需要）
    // ═══════════════════════════════════════
    let vm_status = with_vm(vm_id, |vm| {
        let status = vm.vm_status();

        match status {
            VMStatus::Running | VMStatus::Suspended | VMStatus::Stopping => {
                println!("  VM[{}] is {:?}, sending shutdown signal...", vm_id, status);
                vm.set_vm_status(VMStatus::Stopping);
                let _ = vm.shutdown();
            }
            VMStatus::Loaded => {
                vm.set_vm_status(VMStatus::Stopped);
            }
            _ => {}
        }

        status
    });

    if vm_status.is_none() {
        println!("✗ VM[{}] not found or already removed", vm_id);
        return;
    }

    // ═══════════════════════════════════════
    // 2. 从全局列表移除
    // ═══════════════════════════════════════
    match vm_list::remove_vm(vm_id) {
        Some(vm) => {
            println!("✓ VM[{}] removed from VM list", vm_id);

            // ═══════════════════════════════════════
            // 3. 等待 VCpu 线程退出
            // ═══════════════════════════════════════
            let status = vm_status.unwrap();
            match status {
                VMStatus::Running
                | VMStatus::Suspended
                | VMStatus::Stopping
                | VMStatus::Stopped => {
                    println!("  Waiting for VCpu threads to exit...");

                    // 清理 VCpu 资源（join 所有任务）
                    vcpus::cleanup_vm_vcpus(vm_id);
                }
                _ => {
                    vcpus::cleanup_vm_vcpus(vm_id);
                }
            }

            // ═══════════════════════════════════════
            // 4. 清理数据（可选）
            // ═══════════════════════════════════════
            if keep_data {
                println!("✓ VM[{}] deleted (configuration and data preserved)", vm_id);
            } else {
                println!("✓ VM[{}] deleted completely", vm_id);
                // TODO: 清理磁盘镜像、配置文件、日志文件
            }

            // ═══════════════════════════════════════
            // 5. 验证 Arc 引用计数
            // ═══════════════════════════════════════
            use alloc::sync::Arc;
            let count = Arc::strong_count(&vm);

            if count == 1 {
                println!("  ✓ VM will be freed immediately");
            } else {
                println!("  ⚠ Warning: Unexpected Arc count {}, possible leak!", count);
            }
        }
        None => {
            println!("✗ Failed to remove VM[{}] from list", vm_id);
        }
    }

    println!("✓ VM[{}] deletion completed", vm_id);
}
```

**使用示例**：

```bash
# 删除已停止的 VM
vm delete 0

# 强制删除运行中的 VM
vm delete 0 --force

# 删除但保留数据
vm delete 0 --keep-data
```

#### VM 列表

**vm list 命令设计**

`vm list` 命令提供系统中所有虚拟机的概览视图,是运维人员最常用的监控命令之一。该命令支持两种输出格式:人类友好的表格格式和机器可读的 JSON 格式,满足不同场景的需求。

设计特点:

1. **双格式输出**:
   - **表格格式** (默认): 列对齐的文本表格,直观展示关键信息
     - 适用场景: 终端交互、快速浏览、人工监控
     - 优势: 可读性强、信息密度高、一目了然
   - **JSON 格式** (--format json): 结构化数据输出
     - 适用场景: 自动化脚本、监控系统集成、API 调用
     - 优势: 易于解析、支持程序化处理、可扩展性强

2. **智能信息聚合**:
   - **VCpu 状态压缩**: 多核虚拟机的 VCpu 状态以摘要形式显示 (如 `Run:2,Blk:1`)
     - 避免冗长的逐核列举
     - 快速识别异常状态 (如某些核心卡在 Blocked)
   - **内存自动格式化**: 根据大小自动选择单位 (B/KB/MB/GB)
     - 提升可读性,避免冗长的字节数
     - 统一单位格式,便于快速比较

3. **零配置运行**:
   - 无需任何参数即可执行,默认显示所有虚拟机
   - 空列表友好提示: `No virtual machines found.`
   - 适合新手用户快速了解系统状态

4. **列选择策略**:
   表格格式包含 6 个关键列,经过精心设计以平衡信息量和可读性:
   - **VM ID**: 数字标识符,用于后续命令操作
   - **NAME**: 人类可读名称,便于识别虚拟机用途
   - **STATUS**: 当前状态 (Running/Stopped/Suspended 等)
   - **VCPU**: VCpu ID 列表 (单核显示 `0`,多核显示 `0,1,2,3`)
   - **MEMORY**: 总内存大小 (自动格式化)
   - **VCPU STATE**: VCpu 状态聚合 (如 `Run:2,Blk:1`)

**输出格式对比**:

```
表格格式:
- 优点: 一屏内可查看多个 VM,列对齐便于比较
- 缺点: 不适合程序化处理,难以解析

JSON 格式:
- 优点: 结构化数据,易于集成到监控系统
- 缺点: 人工阅读不便,需要额外处理

设计决策: 默认表格格式满足 80% 的日常使用场景,JSON 格式作为可选项支持自动化需求
```

**VCpu 状态聚合机制**:

虚拟机可能有多个 VCpu (如 8 核虚拟机),逐一显示每个 VCpu 的状态会占用大量空间。`vm list` 采用智能聚合策略:

1. 统计各状态的 VCpu 数量 (使用 BTreeMap 保证顺序)
2. 生成紧凑格式: `状态缩写:数量`
3. 多个状态用逗号连接: `Run:4,Blk:2,Free:2`

状态缩写映射:
- Free → `Free` (未使用)
- Running → `Run` (运行中)
- Blocked → `Blk` (阻塞)
- Invalid → `Inv` (无效)
- Created → `Cre` (已创建)
- Ready → `Rdy` (就绪)

示例解读:
```
VCPU STATE: Run:2,Blk:1
含义: 2 个 VCpu 正在运行,1 个 VCpu 被阻塞

VCPU STATE: Blk:8
含义: 8 个 VCpu 全部阻塞 (通常表示 VM 处于 Suspended 状态)

VCPU STATE: Free:2
含义: 2 个 VCpu 未使用 (VM 已停止)
```

**内存格式化策略**:

`format_memory_size()` 函数根据字节数自动选择合适的单位:

```
决策树:
< 1024 字节        → 显示为 B (如 512B)
< 1024 KB (1 MB)   → 显示为 KB (如 256KB)
< 1024 MB (1 GB)   → 显示为 MB (如 512MB)
≥ 1 GB             → 显示为 GB (如 3GB)

优势:
1. 避免显示 "268435456" 这样的冗长数字
2. 统一格式便于快速比较内存配置
3. 与系统工具 (如 free, top) 的输出风格一致
```

**使用场景**:

1. **日常运维**: 快速检查所有虚拟机的运行状态
   ```bash
   vm list  # 一眼看出哪些 VM 在运行,哪些已停止
   ```

2. **监控脚本**: 定期采集虚拟机状态数据
   ```bash
   vm list --format json | jq '.vms[] | select(.state == "Running")'
   # 筛选出所有运行中的虚拟机
   ```

3. **容量规划**: 查看内存分配情况
   ```bash
   vm list  # 查看各 VM 的内存配置,评估宿主机资源使用
   ```

4. **故障排查**: 快速定位异常虚拟机
   ```bash
   vm list  # VCpu STATE 列显示异常 (如 Inv:1) 时需进一步调查
   ```

**vm list**:

```rust
fn vm_list(cmd: &ParsedCommand) {
    let binding = "table".to_string();
    let format = cmd.options.get("format").unwrap_or(&binding);

    let display_vms = vm_list::get_vm_list();

    if display_vms.is_empty() {
        println!("No virtual machines found.");
        return;
    }

    if format == "json" {
        // ═══════════════════════════════════════
        // JSON 输出
        // ═══════════════════════════════════════
        println!("{{");
        println!("  \"vms\": [");
        for (i, vm) in display_vms.iter().enumerate() {
            let status = vm.vm_status();
            let total_memory: usize = vm.memory_regions()
                .iter()
                .map(|region| region.size())
                .sum();

            println!("    {{");
            println!("      \"id\": {},", vm.id());
            println!("      \"name\": \"{}\",", vm.with_config(|cfg| cfg.name()));
            println!("      \"state\": \"{}\",", status.as_str());
            println!("      \"vcpu\": {},", vm.vcpu_num());
            println!("      \"memory\": \"{}\"", format_memory_size(total_memory));

            if i < display_vms.len() - 1 {
                println!("    }},");
            } else {
                println!("    }}");
            }
        }
        println!("  ]");
        println!("}}");
    } else {
        // ═══════════════════════════════════════
        // 表格输出（默认）
        // ═══════════════════════════════════════
        println!(
            "{:<6} {:<15} {:<12} {:<15} {:<10} {:<20}",
            "VM ID", "NAME", "STATUS", "VCPU", "MEMORY", "VCPU STATE"
        );
        println!(
            "{:-<6} {:-<15} {:-<12} {:-<15} {:-<10} {:-<20}",
            "", "", "", "", "", ""
        );

        for vm in display_vms {
            let status = vm.vm_status();
            let total_memory: usize = vm.memory_regions()
                .iter()
                .map(|region| region.size())
                .sum();

            // VCpu ID 列表
            let vcpu_ids: Vec<String> = vm.vcpu_list()
                .iter()
                .map(|vcpu| vcpu.id().to_string())
                .collect();
            let vcpu_id_list = vcpu_ids.join(",");

            // VCpu 状态统计
            let mut state_counts = BTreeMap::new();
            for vcpu in vm.vcpu_list() {
                let state = match vcpu.state() {
                    VCpuState::Free => "Free",
                    VCpuState::Running => "Run",
                    VCpuState::Blocked => "Blk",
                    VCpuState::Invalid => "Inv",
                    VCpuState::Created => "Cre",
                    VCpuState::Ready => "Rdy",
                };
                *state_counts.entry(state).or_insert(0) += 1;
            }

            // 格式：Run:2,Blk:1
            let summary: Vec<String> = state_counts
                .iter()
                .map(|(state, count)| format!("{}:{}", state, count))
                .collect();
            let vcpu_state_summary = summary.join(",");

            println!(
                "{:<6} {:<15} {:<12} {:<15} {:<10} {:<20}",
                vm.id(),
                vm.with_config(|cfg| cfg.name()),
                status.as_str(),
                vcpu_id_list,
                format_memory_size(total_memory),
                vcpu_state_summary
            );
        }
    }
}

/// 格式化内存大小
fn format_memory_size(bytes: usize) -> String {
    if bytes < 1024 {
        format!("{}B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{}KB", bytes / 1024)
    } else if bytes < 1024 * 1024 * 1024 {
        format!("{}MB", bytes / (1024 * 1024))
    } else {
        format!("{}GB", bytes / (1024 * 1024 * 1024))
    }
}
```

**输出示例**：

```
VM ID  NAME            STATUS       VCPU            MEMORY     VCPU STATE
------ --------------- ------------ --------------- ---------- --------------------
0      linux-qemu      Running      0               256MB      Run:1
1      linux-rk3588    Suspended    0,1,2,3,4,5,6,7 3GB        Blk:8
2      arceos          Stopped      0,1             8MB        Free:2
```

**JSON 输出示例**：

```bash
vm list --format json
```

```json
{
  "vms": [
    {
      "id": 0,
      "name": "linux-qemu",
      "state": "Running",
      "vcpu": 1,
      "memory": "256MB"
    },
    {
      "id": 1,
      "name": "linux-rk3588",
      "state": "Suspended",
      "vcpu": 8,
      "memory": "3GB"
    }
  ]
}
```

#### VM 详情

**vm show 命令设计**

`vm show` 命令提供单个虚拟机的深度信息展示,是故障诊断和配置验证的核心工具。该命令采用**分层信息架构**,通过可选标志控制输出详细程度,在简洁性和完整性之间取得平衡。

设计特点:

1. **四级详细度控制**:
   - **基本模式** (默认): 显示核心运行状态信息
     - 适用场景: 快速检查 VM 是否正常运行
     - 信息量: VM ID、名称、状态、vCPU 数量、内存总量、vCPU/内存摘要
   - **配置模式** (-c/--config): 附加显示启动配置
     - 适用场景: 验证入口地址、中断模式等启动参数
     - 额外信息: BSP/AP 入口点、DTB 地址、中断模式
   - **统计模式** (-s/--stats): 附加显示设备统计
     - 适用场景: 检查设备数量、MMIO 映射等资源分配
     - 额外信息: MMIO 设备数、系统寄存器设备数
   - **完整模式** (-f/--full): 显示所有详细信息
     - 适用场景: 深度故障诊断、配置审查、开发调试
     - 信息量: 所有 VCpu 详情、内存区域布局、设备映射、CPU 亲和性

2. **智能状态感知提示**:
   根据 VM 当前状态提供**操作建议**,引导用户执行下一步操作:
   - **Suspended 状态**: 提示 `Use 'vm resume X' to continue.`
   - **Stopped 状态**: 提示 `Use 'vm delete X' to clean up.`
   - **Loaded 状态**: 提示 `Use 'vm start X' to boot.`
   - 设计理念: 不仅展示"是什么",还告诉用户"怎么做"

3. **渐进式信息披露**:
   基本模式显示摘要信息,完整模式展开详细内容,避免信息过载:
   ```
   基本模式:
   VCPU Summary:
     Running: 2
     Blocked: 1

   完整模式:
   VCPU Details:
     VCPU 0: Running (Affinity: 0x1)
     VCPU 1: Running (Affinity: 0x2)
     VCPU 2: Blocked (Affinity: 0x4)
   ```

4. **自引导性设计**:
   基本模式末尾提示 `Use 'vm show X --full' for detailed information`,引导用户发现更多功能

**详细度对比表**:

| 信息类别 | 基本 | +配置 | +统计 | 完整 |
|---------|------|-------|-------|------|
| VM ID/名称/状态 | ✓ | ✓ | ✓ | ✓ |
| VCpu 数量 | ✓ | ✓ | ✓ | ✓ |
| 内存总量 | ✓ | ✓ | ✓ | ✓ |
| VCpu 状态摘要 | ✓ | ✓ | ✓ | - |
| 内存区域摘要 | ✓ | ✓ | ✓ | - |
| BSP/AP 入口点 | - | ✓ | - | ✓ |
| DTB 地址 | - | ✓ | - | ✓ |
| 中断模式 | - | ✓ | - | ✓ |
| MMIO 设备数 | - | - | ✓ | ✓ |
| SysReg 设备数 | - | - | ✓ | ✓ |
| 每个 VCpu 详情 | - | - | - | ✓ |
| 内存区域详情 | - | - | - | ✓ |
| 设备映射详情 | - | - | - | ✓ |
| CPU 亲和性详情 | - | - | - | ✓ |

**基本模式 vs 完整模式对比**:

```
基本模式输出示例 (适合人工快速检查):
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

---

完整模式输出示例 (适合深度诊断):
=== VM Details: 0 ===

Basic Information:
  VM ID:     0
  Name:      linux-qemu
  Status:    ● Running
  VCPUs:     1
  Memory:    256MB
  EPT Root:  0x12345000

VCPU Details:
  VCPU 0: Running (Affinity: 0x1)

Memory Regions: (1 region(s), 256MB total)
  Region 0: GPA=0x80000000 HVA=0x40000000 Size=256MB Type=Allocated

Configuration:
  BSP Entry:      0x80200000
  AP Entry:       0x80200000
  Interrupt Mode: Passthrough
  DTB Address:    0x80000000
  Kernel GPA:     0x80200000

  Passthrough Devices: (1 device(s))
    - uart: GPA[0xfe660000~0xfe670000] -> HPA[0xfe660000~0xfe670000] (64KB)

  VCpu Affinity Details:
    VCpu 0: Physical CPU mask 0x1, PCpu ID 0
```

**使用场景**:

1. **快速健康检查** (基本模式):
   ```bash
   vm show 0  # 快速确认 VM 是否正常运行
   ```

2. **配置验证** (配置模式):
   ```bash
   vm show 0 --config  # 验证内核入口点、DTB 地址是否正确
   ```

3. **资源审计** (统计模式):
   ```bash
   vm show 0 --stats  # 检查设备数量,评估资源占用
   ```

4. **故障诊断** (完整模式):
   ```bash
   vm show 0 --full  # 查看所有详细信息,定位问题根因
   ```

5. **配置对比**:
   ```bash
   vm show 0 --config > vm0.txt
   vm show 1 --config > vm1.txt
   diff vm0.txt vm1.txt  # 对比两个 VM 的配置差异
   ```

**状态感知提示机制**:

该机制通过 match 表达式根据 VM 状态提供**上下文相关的操作建议**:

```rust
match status {
    VMStatus::Suspended => {
        println!("  ℹ VM is paused. Use 'vm resume {}' to continue.", vm_id);
    }
    VMStatus::Stopped => {
        println!("  ℹ VM is stopped. Use 'vm delete {}' to clean up.", vm_id);
    }
    VMStatus::Loaded => {
        println!("  ℹ VM is ready. Use 'vm start {}' to boot.", vm_id);
    }
    _ => {}
}
```

设计理念:
- **新手友好**: 不熟悉命令的用户能立即知道下一步操作
- **减少错误**: 避免用户执行无效操作 (如对已停止的 VM 执行 suspend)
- **工作流引导**: 将常见任务序列 (查看状态 → 执行操作) 流畅连接

**完整模式的内存区域详情**:

完整模式展示每个内存区域的详细映射信息,用于:
- **验证地址映射**: 确认 GPA 和 HVA 的映射关系
- **识别恒等映射**: `[identical]` 标记表示 GPA = HPA
- **检查内存类型**: `Allocated` vs `Reserved`

输出格式:
```
Memory Regions: (2 region(s), 3GB total)
  Region 0: GPA=0x9400000 HVA=0x9400000 Size=3GB Type=Allocated [identical]
  Region 1: GPA=0x920000 HVA=0x920000 Size=8KB Type=Reserved [identical]
```

解读示例:
- Region 0: 3GB 主内存,恒等映射 (裸机 OS 需求)
- Region 1: 8KB 保留区域,用于共享内存或 DMA 缓冲区

**完整模式的设备映射详情**:

展示每个直通设备的完整地址映射:
```
Passthrough Devices: (2 device(s))
  - uart: GPA[0xfe660000~0xfe670000] -> HPA[0xfe660000~0xfe670000] (64KB)
  - gpio: GPA[0xfd8a0000~0xfd8b0000] -> HPA[0xfd8a0000~0xfd8b0000] (64KB)
```

关键信息:
- **设备名称**: 便于识别设备用途
- **GPA 范围**: 客户机看到的地址
- **HPA 范围**: 实际物理设备地址
- **映射大小**: 设备寄存器区域大小

**CPU 亲和性详情展示**:

完整模式显示每个 VCpu 的物理 CPU 绑定信息:
```
VCpu Affinity Details:
  VCpu 0: Physical CPU mask 0x1, PCpu ID 0
  VCpu 1: Physical CPU mask 0x2, PCpu ID 0x100
  VCpu 2: Physical CPU mask 0x4, PCpu ID 0x200
```

用途:
- **性能调优**: 验证 VCpu 是否绑定到期望的物理核心
- **NUMA 优化**: 确认 VCpu 分布是否符合 NUMA 拓扑
- **故障排查**: 检查 CPU 亲和性配置错误

**vm show**:

```rust
fn vm_show(cmd: &ParsedCommand) {
    let args = &cmd.positional_args;
    let show_config = cmd.flags.get("config").unwrap_or(&false);
    let show_stats = cmd.flags.get("stats").unwrap_or(&false);
    let show_full = cmd.flags.get("full").unwrap_or(&false);

    if args.is_empty() {
        println!("Error: No VM specified");
        println!("Usage: vm show [OPTIONS] <VM_ID>");
        println!();
        println!("Options:");
        println!("  -f, --full     Show full detailed information");
        println!("  -c, --config   Show configuration details");
        println!("  -s, --stats    Show statistics");
        return;
    }

    let vm_name = &args[0];
    if let Ok(vm_id) = vm_name.parse::<usize>() {
        if *show_full {
            show_vm_full_details(vm_id);
        } else {
            show_vm_basic_details(vm_id, *show_config, *show_stats);
        }
    } else {
        println!("Error: Invalid VM ID: {}", vm_name);
    }
}
```

**基本信息显示**（`show_vm_basic_details`）：

```rust
fn show_vm_basic_details(vm_id: usize, show_config: bool, show_stats: bool) {
    match with_vm(vm_id, |vm| {
        let status = vm.vm_status();

        println!("VM Details: {}", vm_id);
        println!();

        // ═══════════════════════════════════════
        // 基本信息
        // ═══════════════════════════════════════
        println!("  VM ID:     {}", vm.id());
        println!("  Name:      {}", vm.with_config(|cfg| cfg.name()));
        println!("  Status:    {}", status.as_str_with_icon());
        println!("  VCPUs:     {}", vm.vcpu_num());

        let total_memory: usize = vm.memory_regions()
            .iter()
            .map(|region| region.size())
            .sum();
        println!("  Memory:    {}", format_memory_size(total_memory));

        // ═══════════════════════════════════════
        // 状态特定提示
        // ═══════════════════════════════════════
        match status {
            VMStatus::Suspended => {
                println!();
                println!("  ℹ VM is paused. Use 'vm resume {}' to continue.", vm_id);
            }
            VMStatus::Stopped => {
                println!();
                println!("  ℹ VM is stopped. Use 'vm delete {}' to clean up.", vm_id);
            }
            VMStatus::Loaded => {
                println!();
                println!("  ℹ VM is ready. Use 'vm start {}' to boot.", vm_id);
            }
            _ => {}
        }

        // ═══════════════════════════════════════
        // VCpu 摘要
        // ═══════════════════════════════════════
        println!();
        println!("VCPU Summary:");
        let mut state_counts = BTreeMap::new();
        for vcpu in vm.vcpu_list() {
            let state = match vcpu.state() {
                VCpuState::Free => "Free",
                VCpuState::Running => "Running",
                VCpuState::Blocked => "Blocked",
                VCpuState::Invalid => "Invalid",
                VCpuState::Created => "Created",
                VCpuState::Ready => "Ready",
            };
            *state_counts.entry(state).or_insert(0) += 1;
        }

        for (state, count) in state_counts {
            println!("  {}: {}", state, count);
        }

        // ═══════════════════════════════════════
        // 内存摘要
        // ═══════════════════════════════════════
        println!();
        println!("Memory Summary:");
        println!("  Total Regions: {}", vm.memory_regions().len());
        println!("  Total Size:    {}", format_memory_size(total_memory));

        // ═══════════════════════════════════════
        // 配置详情（可选）
        // ═══════════════════════════════════════
        if show_config {
            println!();
            println!("Configuration:");
            vm.with_config(|cfg| {
                println!("  BSP Entry:      {:#x}", cfg.bsp_entry().as_usize());
                println!("  AP Entry:       {:#x}", cfg.ap_entry().as_usize());
                println!("  Interrupt Mode: {:?}", cfg.interrupt_mode());
                if let Some(dtb_addr) = cfg.image_config().dtb_load_gpa {
                    println!("  DTB Address:    {:#x}", dtb_addr.as_usize());
                }
            });
        }

        // ═══════════════════════════════════════
        // 设备统计（可选）
        // ═══════════════════════════════════════
        if show_stats {
            println!();
            println!("Device Summary:");
            println!("  MMIO Devices:   {}", vm.get_devices().iter_mmio_dev().count());
            println!("  SysReg Devices: {}", vm.get_devices().iter_sys_reg_dev().count());
        }

        println!();
        println!("Use 'vm show {} --full' for detailed information", vm_id);
    }) {
        Some(_) => {}
        None => {
            println!("✗ VM[{}] not found", vm_id);
        }
    }
}
```

**完整详情显示**（`show_vm_full_details`）：

```rust
fn show_vm_full_details(vm_id: usize) {
    match with_vm(vm_id, |vm| {
        let status = vm.vm_status();

        println!("=== VM Details: {} ===", vm_id);
        println!();

        // 基本信息
        println!("Basic Information:");
        println!("  VM ID:     {}", vm.id());
        println!("  Name:      {}", vm.with_config(|cfg| cfg.name()));
        println!("  Status:    {}", status.as_str_with_icon());
        println!("  VCPUs:     {}", vm.vcpu_num());

        let total_memory: usize = vm.memory_regions()
            .iter()
            .map(|region| region.size())
            .sum();
        println!("  Memory:    {}", format_memory_size(total_memory));
        println!("  EPT Root:  {:#x}", vm.ept_root().as_usize());

        // VCpu 详情
        println!();
        println!("VCPU Details:");

        for vcpu in vm.vcpu_list() {
            let vcpu_state = match vcpu.state() {
                VCpuState::Free => "Free",
                VCpuState::Running => "Running",
                VCpuState::Blocked => "Blocked",
                VCpuState::Invalid => "Invalid",
                VCpuState::Created => "Created",
                VCpuState::Ready => "Ready",
            };

            if let Some(phys_cpu_set) = vcpu.phys_cpu_set() {
                println!("  VCPU {}: {} (Affinity: {:#x})",
                    vcpu.id(), vcpu_state, phys_cpu_set);
            } else {
                println!("  VCPU {}: {} (No affinity)", vcpu.id(), vcpu_state);
            }
        }

        // 内存区域
        println!();
        println!("Memory Regions: ({} region(s), {} total)",
            vm.memory_regions().len(),
            format_memory_size(total_memory)
        );
        for (i, region) in vm.memory_regions().iter().enumerate() {
            let region_type = if region.needs_dealloc {
                "Allocated"
            } else {
                "Reserved"
            };
            let identical = if region.is_identical() {
                " [identical]"
            } else {
                ""
            };
            println!(
                "  Region {}: GPA={:#x} HVA={:#x} Size={} Type={}{}",
                i, region.gpa, region.hva,
                format_memory_size(region.size()),
                region_type, identical
            );
        }

        // 配置
        println!();
        println!("Configuration:");
        vm.with_config(|cfg| {
            println!("  BSP Entry:      {:#x}", cfg.bsp_entry().as_usize());
            println!("  AP Entry:       {:#x}", cfg.ap_entry().as_usize());
            println!("  Interrupt Mode: {:?}", cfg.interrupt_mode());

            if let Some(dtb_addr) = cfg.image_config().dtb_load_gpa {
                println!("  DTB Address:    {:#x}", dtb_addr.as_usize());
            }

            println!("  Kernel GPA:     {:#x}",
                cfg.image_config().kernel_load_gpa.as_usize());

            // 直通设备
            if !cfg.pass_through_devices().is_empty() {
                println!();
                println!("  Passthrough Devices: ({} device(s))",
                    cfg.pass_through_devices().len());
                for device in cfg.pass_through_devices() {
                    println!(
                        "    - {}: GPA[{:#x}~{:#x}] -> HPA[{:#x}~{:#x}] ({})",
                        device.name,
                        device.base_gpa, device.base_gpa + device.length,
                        device.base_hpa, device.base_hpa + device.length,
                        format_memory_size(device.length)
                    );
                }
            }
        });

        // VCpu 亲和性详情
        println!();
        println!("  VCpu Affinity Details:");
        for (vcpu_id, affinity, pcpu_id) in vm.get_vcpu_affinities_pcpu_ids() {
            if let Some(aff) = affinity {
                println!("    VCpu {}: Physical CPU mask {:#x}, PCpu ID {}",
                    vcpu_id, aff, pcpu_id);
            } else {
                println!("    VCpu {}: No specific affinity, PCpu ID {}",
                    vcpu_id, pcpu_id);
            }
        }
    }) {
        Some(_) => {}
        None => {
            println!("✗ VM[{}] not found", vm_id);
        }
    }
}
```

**使用示例**：

```bash
# 基本信息
vm show 0

# 包含配置
vm show 0 --config

# 包含统计
vm show 0 --stats

# 完整详情
vm show 0 --full
```
