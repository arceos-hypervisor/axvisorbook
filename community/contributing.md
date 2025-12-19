---
sidebar_position: 97
---

# 贡献指南

感谢您对 AxVisor 项目的关注！我们欢迎各种形式的贡献，包括但不限于代码、文档、测试、设计和社区建设。本指南将帮助您了解如何为项目做出贡献。

## 贡献方式

### 🐛 报告问题
如果您发现了 bug 或有问题需要反馈：

1. 首先检查 [GitHub Issues](https://github.com/arceos-hypervisor/axvisor/issues) 确认问题尚未被报告
2. 使用清晰、描述性的标题
3. 提供详细的问题描述，包括：
   - 重现步骤
   - 期望行为
   - 实际行为
   - 环境信息（操作系统、版本等）
   - 相关日志和错误信息

### 💡 功能建议
如果您有新功能的想法：

1. 在 [GitHub Discussions](https://github.com/arceos-hypervisor/axvisor/discussions) 中发起讨论
2. 详细描述功能的使用场景和价值
3. 考虑是否可以作为插件或扩展实现

### 🔧 代码贡献
我们欢迎代码贡献！以下是贡献代码的流程：

#### 开发环境设置
1. Fork [AxVisor 仓库](https://github.com/arceos-hypervisor/axvisor)
2. 克隆您的 fork：
   ```bash
   git clone https://github.com/YOUR_USERNAME/axvisor.git
   cd axvisor
   ```
3. 添加上游仓库：
   ```bash
   git remote add upstream https://github.com/arceos-hypervisor/axvisor.git
   ```
4. 创建新的分支：
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### 代码规范
- 遵循 [Rust 官方代码风格](https://rust-lang.github.io/api-guidelines/)
- 使用 `cargo fmt` 格式化代码
- 使用 `cargo clippy` 检查代码质量
- 为公共 API 编写文档注释
- 为新功能添加测试

#### 提交 Pull Request
1. 确保您的代码与主分支保持最新：
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```
2. 运行测试确保所有测试通过：
   ```bash
   cargo test
   ```
3. 提交您的更改：
   ```bash
   git commit -m "feat: add your feature description"
   ```
4. 推送到您的 fork：
   ```bash
   git push origin feature/your-feature-name
   ```
5. 在 GitHub 上创建 Pull Request

### 📖 文档贡献
良好的文档对项目至关重要：

- 修正错误或不清楚的文档
- 添加使用示例和教程
- 翻译文档到其他语言
- 改进文档结构和导航

### 🧪 测试贡献
测试是确保代码质量的关键：

- 编写单元测试
- 添加集成测试
- 改进测试覆盖率
- 报告测试相关问题

## 开发指南

### 代码审查
所有代码贡献都需要经过代码审查：

- 维护者会审查您的 PR
- 您可能需要根据反馈进行修改
- 保持友好和专业的交流

### 发布流程
我们遵循语义化版本控制：

- 主版本号：不兼容的 API 修改
- 次版本号：向下兼容的功能性新增
- 修订号：向下兼容的问题修正

### 社区行为准则
我们致力于创建一个友好、安全和欢迎的环境：

- 尊重不同的观点和经验
- 使用友好和包容的语言
- 接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

## 获得认可

我们会在以下地方认可贡献者：

- [贡献者列表](/community/team)
- 发布说明中的致谢
- 项目 README 中的贡献者部分
- 特殊贡献的专门感谢

## 获得帮助

如果您在贡献过程中需要帮助：

- 在 [GitHub Discussions](https://github.com/arceos-hypervisor/axvisor/discussions) 中提问
- 通过 [GitHub Issues](https://github.com/arceos-hypervisor/axvisor/issues) 报告问题
- 查看我们的[支持页面](/community/support)获取更多帮助渠道

感谢您考虑为 AxVisor 做出贡献！您的参与对项目的成功至关重要。