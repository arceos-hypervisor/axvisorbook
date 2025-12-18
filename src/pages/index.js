import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import Translate, { translate } from "@docusaurus/Translate";
import { useColorMode } from "@docusaurus/theme-common";
import { useEffect, useRef, useState } from "react";
import DownloadModal from "@site/src/components/DownloadModal";
import PageNavigator from "@site/src/components/PageNavigator";
import "./index.css";

// 图标库
const iconLibrary = {
  orbit: (
    <svg viewBox="0 0 120 120" role="presentation" aria-hidden="true">
      <circle cx="60" cy="60" r="40" className="icon-ring" />
      <circle cx="60" cy="60" r="4" className="icon-core" />
      <path d="M20,60 Q60,10 100,60 Q60,110 20,60" className="icon-orbit" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 120 120" role="presentation" aria-hidden="true">
      <path d="M20 40 L60 20 L100 40 L60 60 Z" className="icon-layer" />
      <path d="M20 70 L60 50 L100 70 L60 90 Z" className="icon-layer" />
      <path d="M20 100 L60 80 L100 100 L60 120 Z" className="icon-layer" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 120 120" role="presentation" aria-hidden="true">
      <path d="M60 10 L100 30 V65 C100 88 83 108 60 112 C37 108 20 88 20 65 V30 Z" className="icon-shield" />
      <path d="M45 55 L55 65 L75 45" className="icon-check" />
    </svg>
  ),
  pulse: (
    <svg viewBox="0 0 120 120" role="presentation" aria-hidden="true">
      <polyline points="10,70 35,70 50,40 70,90 85,55 110,55" className="icon-pulse" />
    </svg>
  ),
  chip: (
    <svg viewBox="0 0 120 120" role="presentation" aria-hidden="true">
      <rect x="35" y="35" width="50" height="50" rx="6" className="icon-chip" />
      <g className="icon-chip-pins">
        <line x1="60" y1="10" x2="60" y2="30" />
        <line x1="60" y1="90" x2="60" y2="110" />
        <line x1="10" y1="60" x2="30" y2="60" />
        <line x1="90" y1="60" x2="110" y2="60" />
      </g>
    </svg>
  ),
  wave: (
    <svg viewBox="0 0 120 120" role="presentation" aria-hidden="true">
      <path d="M0 70 Q30 40 60 70 T120 70" className="icon-wave" />
      <path d="M0 90 Q30 60 60 90 T120 90" className="icon-wave" />
    </svg>
  ),
  server: (
    <svg viewBox="0 0 120 120" role="presentation" aria-hidden="true">
      <rect x="20" y="30" width="80" height="20" rx="4" className="icon-device" />
      <circle cx="30" cy="40" r="3" className="icon-dot" />
      <circle cx="50" cy="40" r="3" className="icon-dot" />
      <circle cx="70" cy="40" r="3" className="icon-dot" />
      <line x1="20" y1="60" x2="100" y2="60" className="icon-line" />
      <rect x="20" y="70" width="80" height="20" rx="4" className="icon-device" />
      <circle cx="30" cy="80" r="3" className="icon-dot" />
      <circle cx="50" cy="80" r="3" className="icon-dot" />
      <circle cx="70" cy="80" r="3" className="icon-dot" />
    </svg>
  ),
  robot: (
    <svg viewBox="0 0 120 120" role="presentation" aria-hidden="true">
      <rect x="30" y="20" width="60" height="50" rx="8" className="icon-robot-head" />
      <circle cx="45" cy="35" r="6" className="icon-robot-eye" />
      <circle cx="75" cy="35" r="6" className="icon-robot-eye" />
      <rect x="35" y="75" width="15" height="30" className="icon-robot-arm" />
      <rect x="70" y="75" width="15" height="30" className="icon-robot-arm" />
      <rect x="45" y="75" width="30" height="15" className="icon-robot-body" />
    </svg>
  ),
};

function HeroBanner() {
  const heroStats = [
    {
      label: translate({ id: "home.hero.components", message: "核心组件" }),
      value: translate({ id: "home.hero.components.value", message: "15+" }),
    },
    {
      label: translate({ id: "home.hero.targets", message: "支持架构" }),
      value: translate({ id: "home.hero.targets.value", message: "4个" }),
    },
    {
      label: translate({ id: "home.hero.guests", message: "客户机系统" }),
      value: translate({ id: "home.hero.guests.value", message: "5+" }),
    },
  ];

  return (
    <section className="hero-banner home-section" id="hero" aria-label={translate({ id: "home.hero.title", message: "AxVisor overview banner" })}>
      {/* SVG 动画背景 */}
      <svg className="hero-background-svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="heroGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--hero-grad-start-1)" />
            <stop offset="100%" stopColor="var(--hero-grad-end-1)" />
          </linearGradient>
          <linearGradient id="heroGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--hero-grad-start-2)" />
            <stop offset="100%" stopColor="var(--hero-grad-end-2)" />
          </linearGradient>
          <filter id="heroGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="heroBlur">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>
        {/* 背景渐变区域 */}
        <rect width="1200" height="800" fill="url(#heroGrad1)" opacity="0.3" />
        
        {/* 波浪形分割线 - 上方 */}
        <path d="M0,100 Q300,50 600,100 T1200,100" stroke="url(#heroGrad2)" strokeWidth="2" fill="none" opacity="0.4" className="hero-wave-top" />
        <path d="M0,120 Q300,80 600,120 T1200,120" stroke="url(#heroGrad2)" strokeWidth="1" fill="none" opacity="0.2" className="hero-wave-top" />
        
        {/* 动画圆形 */}
        <circle cx="150" cy="250" r="80" fill="none" stroke="url(#heroGrad2)" strokeWidth="2" opacity="0.2" className="hero-circle-anim" />
        <circle cx="150" cy="250" r="60" fill="none" stroke="url(#heroGrad2)" strokeWidth="1" opacity="0.1" className="hero-circle-anim-delayed" />
        
        <circle cx="1100" cy="600" r="100" fill="none" stroke="url(#heroGrad2)" strokeWidth="2" opacity="0.15" className="hero-circle-anim-reverse" />
        <circle cx="1100" cy="600" r="70" fill="none" stroke="url(#heroGrad2)" strokeWidth="1" opacity="0.1" className="hero-circle-anim-reverse" />
        
        {/* 装饰线条 */}
        <line x1="100" y1="650" x2="300" y2="700" stroke="url(#heroGrad2)" strokeWidth="1" opacity="0.3" className="hero-line-anim" />
        <line x1="950" y1="150" x2="1100" y2="200" stroke="url(#heroGrad2)" strokeWidth="1" opacity="0.3" className="hero-line-anim-reverse" />
        
        {/* 动画点 */}
        <circle cx="600" cy="150" r="4" fill="url(#heroGrad2)" opacity="0.6" className="hero-dot-pulse" />
        <circle cx="200" cy="600" r="3" fill="url(#heroGrad2)" opacity="0.5" className="hero-dot-pulse" />
        <circle cx="1000" cy="400" r="3" fill="url(#heroGrad2)" opacity="0.5" className="hero-dot-pulse-delayed" />
      </svg>

      {/* 波浪形分割底部 */}
      <svg className="hero-wave-divider" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="waveFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--hero-wave-color)" />
            <stop offset="100%" stopColor="var(--section-bg-1)" />
          </linearGradient>
        </defs>
        <path d="M0,20 Q300,0 600,20 T1200,20 L1200,100 L0,100 Z" fill="url(#waveFill)" />
        <path d="M0,30 Q300,10 600,30 T1200,30 L1200,100 L0,100 Z" fill="var(--section-bg-1)" opacity="0.5" />
      </svg>

      <div className="hero-content">
        <div className="hero-copy">
          <p className="eyebrow">
            <Translate>基于 ArceOS 的统一组件化虚拟化管理器</Translate>
          </p>
          <h1>
            <span>
              <Translate>AxVisor</Translate>
            </span>
            <em>
              <Translate>开源、高性能、多架构支持</Translate>
            </em>
          </h1>
          <p className="lead">
            <Translate>
              新一代开源虚拟化解决方案，支持多架构、多客户机，为嵌入式、IoT、边缘计算、汽车电子等应用场景提供高效、安全的虚拟化环境
            </Translate>
          </p>
          <div className="hero-actions">
            <Link className="button button--primary button--hero" to={useBaseUrl("docs/introduction/overview")}>
              <Translate>查看文档</Translate>
            </Link>
            <Link className="button button--outline button--hero" to={useBaseUrl("docs/quickstart")}>
              <Translate>快速开始</Translate>
            </Link>
          </div>
          <div className="hero-stats" role="list">
            {heroStats.map((stat) => (
              <div className="stat" role="listitem" key={stat.label}>
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          {/* 终端演示 */}
          <HeroTerminal />
        </div>
      </div>
    </section>
  );
}

function HeroTerminal() {
  const terminalRef = useRef(null);

  // 精简的命令场景
  const commandScenarios = [
    {
      command: 'vm list',
      output: [
        'VM ID  NAME            STATUS       VCPU     MEMORY',
        '-----  --------------  -----------  -------  --------',
        '0      guest-linux     Running      0,1      512MB',
        '1      guest-test      Stopped      0        256MB'
      ],
      type: 'output'
    },
    {
      command: 'vm show 0',
      output: [
        'VM Details: 0',
        '  Name:      guest-linux',
        '  Status:    ▶ Running',
        '  VCPUs:     2',
        '  Memory:    512MB'
      ],
      type: 'output'
    },
    {
      command: 'vm create vm-config.toml',
      output: [
        '✓ Successfully created VM[2]',
        'Use \'vm start 2\' to start'
      ],
      type: 'success'
    },
    {
      command: 'vm start 2',
      output: ['✓ VM[2] started successfully'],
      type: 'success'
    },
    {
      command: 'uname -a',
      output: ['ArceOS 0.1.0 SMP riscv64'],
      type: 'success'
    }
  ];

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    let scenarioIndex = 0;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const scrollToBottom = () => {
      terminal.scrollTop = terminal.scrollHeight;
    };

    const clearScreen = async () => {
      terminal.innerHTML = `
        <div class="hero-terminal-welcome">Welcome to AxVisor Shell!</div>
        <div style="margin: 8px 0;"></div>
      `;
    };

    const typeCommand = async (command, inputSpan) => {
      for (let i = 0; i < command.length; i++) {
        inputSpan.textContent += command[i];
        await delay(60 + Math.random() * 30);
        scrollToBottom();
      }
    };

    const executeCommand = async (scenario) => {
      const commandLine = document.createElement('div');
      commandLine.innerHTML = `
        <span class="hero-terminal-prompt">$ </span>
        <span class="hero-terminal-input"></span>
        <span class="hero-terminal-cursor"></span>
      `;
      terminal.appendChild(commandLine);
      scrollToBottom();

      const inputSpan = commandLine.querySelector('.hero-terminal-input');
      await typeCommand(scenario.command, inputSpan);
      await delay(300);

      const cursor = commandLine.querySelector('.hero-terminal-cursor');
      if (cursor) cursor.remove();

      if (scenario.output && scenario.output.length > 0) {
        await delay(200);
        const outputDiv = document.createElement('div');
        outputDiv.className = `hero-terminal-${scenario.type || 'output'}`;
        outputDiv.innerHTML = scenario.output.join('<br>');
        terminal.appendChild(outputDiv);
        scrollToBottom();
      }

      await delay(800);
    };

    const runAnimation = async () => {
      while (true) {
        const scenario = commandScenarios[scenarioIndex];
        await executeCommand(scenario);
        await delay(1500);

        scenarioIndex = (scenarioIndex + 1) % commandScenarios.length;

        if (scenarioIndex === 0) {
          await delay(2000);
          await clearScreen();
          await delay(800);
        }
      }
    };

    runAnimation();
  }, []);

  return (
    <div className="hero-terminal-container">
      <div className="hero-terminal-header">
        <div className="hero-terminal-buttons">
          <div className="hero-terminal-button hero-btn-close"></div>
          <div className="hero-terminal-button hero-btn-minimize"></div>
          <div className="hero-terminal-button hero-btn-maximize"></div>
        </div>
        <div className="hero-terminal-title">AxVisor Shell</div>
      </div>
      <div className="hero-terminal-screen" ref={terminalRef}>
        <div className="hero-terminal-welcome">Welcome to AxVisor Shell!</div>
        <div style={{ margin: '8px 0' }}></div>
      </div>
    </div>
  );
}

function FeatureSection() {
  const featureHighlights = [
    {
      id: "feature-modular",
      title: translate({ id: "home.features.modular", message: "组件化设计" }),
      description: translate({
        id: "home.features.modular.desc",
        message: "通过组件化架构实现功能解耦，每个虚拟化组件独立运作，通过标准接口通信。支持灵活的功能组合和定制，最大化代码复用和维护效率。",
      }),
      icon: "orbit",
    },
    {
      id: "feature-kernel",
      title: translate({ id: "home.features.kernel", message: "多架构统一支持" }),
      description: translate({
        id: "home.features.kernel.desc",
        message: "采用分层架构设计，同一套代码支持 x86_64、AArch64、RISC-V、LoongArch 四大主流芯片架构。最大化架构无关代码，简化开发维护成本。",
      }),
      icon: "layers",
    },
    {
      id: "feature-security",
      title: translate({ id: "home.features.security", message: "内存安全与隔离" }),
      description: translate({
        id: "home.features.security.desc",
        message: "采用 Rust 语言实现，提供类型安全和所有权机制。内存管理、CPU 调度和访客隔离保持可审计，支持形式化验证，确保虚拟化环境的安全性。",
      }),
      icon: "shield",
    },
    {
      id: "feature-ci",
      title: translate({ id: "home.features.ci", message: "灵活部署 · 快速迭代" }),
      description: translate({
        id: "home.features.ci.desc",
        message: "支持多种客户机系统（ArceOS、Linux、NimbOS、Starry-OS）和硬件平台。提供完整的开发板启动、QEMU 仿真和运行器流程文档，加速项目集成和部署。",
      }),
      icon: "pulse",
    },
  ];

  return (
    <section className="home-section feature-section" id="features" style={{ "--section-index": 1 }}>
      {/* 顶部不规则分割 - 波浪形 */}
      <svg className="section-divider-top" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="divider1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--feature-divider-1)" />
            <stop offset="100%" stopColor="var(--feature-divider-2)" />
          </linearGradient>
        </defs>
        <path d="M0,30 Q300,0 600,30 T1200,30 L1200,0 L0,0 Z" fill="url(#divider1)" opacity="0.6" />
        <path d="M0,50 Q300,20 600,50 T1200,50 L1200,30 Q300,60 0,30 Z" fill="var(--section-bg-1)" opacity="0.3" />
        <line x1="0" y1="90" x2="1200" y2="100" stroke="url(#divider1)" strokeWidth="2" opacity="0.4" />
      </svg>

      <div className="section-inner">
        <div className="section-header">
          <p className="eyebrow">
            <Translate>核心优势</Translate>
          </p>
          <h2>
            <Translate>组件化架构 · 多架构统一</Translate>
          </h2>
          <p>
            <Translate>
              AxVisor 通过组件化设计实现功能解耦，每个组件通过标准接口通信。
              采用分层架构支持多种处理器，使用 Rust 编写确保内存安全，
              提供从实验室验证到生产部署的完整虚拟化解决方案。
            </Translate>
          </p>
        </div>
        <div className="feature-grid">
          {featureHighlights.map((feature, index) => (
            <article className="feature-card" key={feature.id} style={{ "--card-index": index }}>
              <div className="feature-icon">{iconLibrary[feature.icon]}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              {/* SVG 背景装饰 */}
              <svg className="feature-card-bg" viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id={`cardGrad-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--feature-accent-1)" />
                    <stop offset="100%" stopColor="var(--feature-accent-2)" />
                  </linearGradient>
                </defs>
                <path d="M0,0 Q50,20 100,0 T200,0 L200,200 L0,200 Z" fill="url(#cardGrad-{index})" opacity="0.05" />
              </svg>
            </article>
          ))}
        </div>
      </div>

      {/* 底部不规则分割 */}
      <svg className="section-divider-bottom" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="divider-down-1" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--feature-divider-1)" />
            <stop offset="100%" stopColor="var(--feature-divider-2)" />
          </linearGradient>
        </defs>
        <path d="M0,70 Q300,100 600,70 T1200,70 L1200,120 L0,120 Z" fill="url(#divider-down-1)" opacity="0.5" />
        <path d="M0,50 Q300,80 600,50 T1200,50 L1200,70 Q300,40 0,70 Z" fill="var(--section-bg-2)" opacity="0.4" />
      </svg>
    </section>
  );
}

function ArchitectureSection() {
  const architectureItems = [
    {
      id: "arch-hypervisor",
      title: translate({ id: "home.arch.hypervisor", message: "Hypervisor 核心" }),
      description: translate({
        id: "home.arch.hypervisor.desc",
        message: "Type I 类型 Hypervisor，直接运行在硬件上，提供高效的虚拟化服务。",
      }),
      icon: "orbit",
    },
    {
      id: "arch-memory",
      title: translate({ id: "home.arch.memory", message: "内存管理" }),
      description: translate({
        id: "home.arch.memory.desc",
        message: "采用 TLSF 分配器和 Stage-2 地址转换，支持多级页表和内存共享。",
      }),
      icon: "layers",
    },
    {
      id: "arch-cpu",
      title: translate({ id: "home.arch.cpu", message: "CPU 虚拟化" }),
      description: translate({
        id: "home.arch.cpu.desc",
        message: "支持 vCPU 创建、调度和中断注入，实现高效的 CPU 虚拟化。",
      }),
      icon: "chip",
    },
    {
      id: "arch-device",
      title: translate({ id: "home.arch.device", message: "设备虚拟化" }),
      description: translate({
        id: "home.arch.device.desc",
        message: "支持设备直通和虚拟设备模拟，包括 VirtIO 框架。",
      }),
      icon: "server",
    },
    {
      id: "arch-filesystem",
      title: translate({ id: "home.arch.filesystem", message: "文件系统" }),
      description: translate({
        id: "home.arch.filesystem.desc",
        message: "支持多种文件系统，包括 FAT32、EXT4、RAMFS 等。",
      }),
      icon: "wave",
    }
  ];

  return (
    <section className="home-section architecture-section" id="architecture" style={{ "--section-index": 6 }}>
      {/* 顶部斜切分割 */}
      <svg className="section-divider-top skew-divider" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="archDivider1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--scenario-divider-1)" />
            <stop offset="100%" stopColor="var(--scenario-divider-2)" />
          </linearGradient>
        </defs>
        <polygon points="0,50 1200,0 1200,50 0,100" fill="url(#archDivider1)" opacity="0.6" />
        <line x1="0" y1="75" x2="1200" y2="25" stroke="url(#archDivider1)" strokeWidth="2" opacity="0.3" />
      </svg>

      <div className="section-inner">
        <div className="section-header">
          <p className="eyebrow">
            <Translate>系统架构</Translate>
          </p>
          <h2>
            <Translate>分层设计 · 轻量虚拟化</Translate>
          </h2>
          <p>
            <Translate>
              AxVisor 采用分层架构设计，从 Hypervisor 核心到设备虚拟化，各层通过标准接口通信，
              实现高度组件化和可扩展性。
            </Translate>
          </p>
        </div>
        
        {/* 架构图 */}
        <div className="architecture-diagram">
          <img src={useBaseUrl("images/homepage/axvisor.arch.png")} alt="AxVisor Architecture" />
        </div>
        
        <div className="architecture-grid">
          {architectureItems.map((item, index) => (
            <article className="architecture-card" key={item.id} style={{ "--arch-index": index }}>
              <div className="architecture-icon">{iconLibrary[item.icon]}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>

      {/* 底部锯齿分割 */}
      <svg className="section-divider-bottom zigzag-divider" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="archDividerBg" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--scenario-divider-2)" />
            <stop offset="100%" stopColor="var(--scenario-divider-1)" />
          </linearGradient>
        </defs>
        <polyline points="0,40 150,0 300,40 450,0 600,40 750,0 900,40 1050,0 1200,40 1200,80 0,80" fill="url(#archDividerBg)" opacity="0.4" />
        <polyline points="0,60 150,20 300,60 450,20 600,60 750,20 900,60 1050,20 1200,60" stroke="url(#archDividerBg)" fill="none" strokeWidth="1" opacity="0.3" />
      </svg>
    </section>
  );
}

function ComponentDesignSection() {
  const components = [
    {
      id: "comp-axruntime",
      title: translate({ id: "home.comp.runtime", message: "AxRuntime" }),
      description: translate({
        id: "home.comp.runtime.desc",
        message: "运行时环境，负责系统初始化、组件加载和任务调度。",
      }),
      icon: "orbit",
    },
    {
      id: "comp-axhal",
      title: translate({ id: "home.comp.hal", message: "AxHAL" }),
      description: translate({
        id: "home.comp.hal.desc",
        message: "硬件抽象层，提供统一的硬件接口，支持多架构。",
      }),
      icon: "layers",
    },
    {
      id: "comp-axmm",
      title: translate({ id: "home.comp.mm", message: "AxMM" }),
      description: translate({
        id: "home.comp.mm.desc",
        message: "内存管理组件，负责物理内存和虚拟内存管理。",
      }),
      icon: "chip",
    },
    {
      id: "comp-axfs",
      title: translate({ id: "home.comp.fs", message: "AxFS" }),
      description: translate({
        id: "home.comp.fs.desc",
        message: "文件系统组件，支持多种文件系统和虚拟文件系统。",
      }),
      icon: "wave",
    },
    {
      id: "comp-axvcpu",
      title: translate({ id: "home.comp.vcpu", message: "AxVCPU" }),
      description: translate({
        id: "home.comp.vcpu.desc",
        message: "同一套代码支持 x86_64、AArch64、RISC-V、LoongArch 四大主流芯片架构。",
      }),
      icon: "pulse",
    },
    {
      id: "comp-axvmm",
      title: translate({ id: "home.comp.vmm", message: "AxVMM" }),
      description: translate({
        id: "home.comp.vmm.desc",
        message: "虚拟机管理组件，负责虚拟机生命周期管理。",
      }),
      icon: "server",
    },
  ];

  return (
    <section className="home-section component-design-section" id="component-design" style={{ "--section-index": 7 }}>
      {/* 顶部圆弧分割 */}
      <svg className="section-divider-top arc-divider" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="compDivider1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--hw-divider-1)" />
            <stop offset="100%" stopColor="var(--hw-divider-2)" />
          </linearGradient>
        </defs>
        <path d="M0,60 Q300,10 600,60 T1200,60 L1200,0 L0,0 Z" fill="url(#compDivider1)" opacity="0.5" />
        <path d="M0,40 Q300,0 600,40 T1200,40" stroke="url(#compDivider1)" strokeWidth="2" fill="none" opacity="0.4" />
      </svg>

      <div className="section-inner">
        <div className="section-header">
          <p className="eyebrow">
            <Translate>组件设计</Translate>
          </p>
          <h2>
            <Translate>标准接口 · 高度解耦</Translate>
          </h2>
          <p>
            <Translate>
              AxVisor 采用组件化设计，各组件通过标准接口通信，实现高度解耦和可复用。
              每个组件专注于特定功能，降低系统复杂度，提高可维护性。
            </Translate>
          </p>
        </div>
        
        {/* 组件关系图 */}
        <div className="component-diagram">
          <img src={useBaseUrl("images/homepage/axvisor.module.png")} alt="AxVisor Components" />
        </div>
        
        <div className="component-grid">
          {components.map((component, index) => (
            <article className="component-card" key={component.id} style={{ "--comp-index": index }}>
              <div className="component-icon">{iconLibrary[component.icon]}</div>
              <h3>{component.title}</h3>
              <p>{component.description}</p>
            </article>
          ))}
        </div>
      </div>

      {/* 底部波浪分割 */}
      <svg className="section-divider-bottom wave-divider" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="compDividerBg" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--hw-divider-2)" />
            <stop offset="100%" stopColor="var(--hw-divider-1)" />
          </linearGradient>
        </defs>
        <path d="M0,40 Q300,60 600,40 T1200,40 L1200,100 L0,100 Z" fill="url(#compDividerBg)" opacity="0.5" />
        <path d="M0,60 Q300,80 600,60 T1200,60" stroke="url(#compDividerBg)" strokeWidth="1" fill="none" opacity="0.3" />
      </svg>
    </section>
  );
}

function HardwareSection({ onDownloadClick }) {
  const hardwarePlatforms = [
    {
      id: "qemu",
      name: "QEMU 模拟环境",
      arch: "多架构虚拟化支持",
      doc: "docs/quickstart/qemu/aarch64",
      icon: "chip",
      guestSupport: {
        arceos: "ArceOS - 组件化操作系统",
        linux: "Linux - 通用操作系统",
        nimbos: "NimbOS - 轻量级操作系统",
        starry: "Starry-OS - 实时操作系统"
      },
      performance: {
        bootTime: "< 10秒",
        latency: "< 200μs",
        throughput: "取决于主机配置",
        powerConsumption: "无实际功耗"
      }
    },
    {
      id: "phytiumpi",
      name: "飞腾派",
      arch: "ARM 商用芯片",
      doc: "docs/quickstart/board/phytiumpi",
      icon: "chip",
      guestSupport: {
        arceos: "ArceOS - 组件化操作系统",
        linux: "Linux - 通用操作系统",
        nimbos: "RT-Thread - 实时操作系统",
        starry: "Starry-OS - 实时操作系统"
      },
      performance: {
        bootTime: "< 3秒",
        latency: "< 100μs",
        throughput: "10Gbps",
        powerConsumption: "15W TDP"
      }
    },
    {
      id: "roc3568",
      name: "ROC-RK3568-PC",
      arch: "ARM big.LITTLE 异构",
      doc: "docs/quickstart/board/roc-rk3568-pc",
      icon: "chip",
      guestSupport: {
        arceos: "ArceOS - 组件化操作系统",
        linux: "Linux - 通用操作系统",
        starry: "Starry-OS - 实时操作系统"
      },
      performance: {
        bootTime: "< 5秒",
        latency: "< 150μs",
        throughput: "5Gbps",
        powerConsumption: "12W TDP"
      }
    }
  ];

  return (
    <section className="home-section hardware-section" id="hardware" style={{ "--section-index": 2 }}>
      {/* 顶部斜切分割 */}
      <svg className="section-divider-top skew-divider" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="hwDivider1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--hw-divider-1)" />
            <stop offset="100%" stopColor="var(--hw-divider-2)" />
          </linearGradient>
        </defs>
        <polygon points="0,50 1200,0 1200,50 0,100" fill="url(#hwDivider1)" opacity="0.6" />
        <line x1="0" y1="75" x2="1200" y2="25" stroke="url(#hwDivider1)" strokeWidth="2" opacity="0.3" />
      </svg>

      <div className="section-inner">
        <div className="section-header">
          <p className="eyebrow">
            <Translate>硬件平台</Translate>
          </p>
          <h2>
            <Translate>跨平台支持 · 从虚拟化境到真实硬件</Translate>
          </h2>
          <p>
            <Translate>
              AxVisor 已在多个开发平台进行验证，包括 QEMU 仿真环境和物理硬件平台。
              支持从学习评估到生产部署的全栈场景。完整的硬件适配文档和引导程序支持，
              帮助快速在目标平台部署。
            </Translate>
          </p>
        </div>
        <div className="hardware-marquee" role="list">
          {hardwarePlatforms.map((platform, index) => (
            <article className="hardware-card" key={platform.id} role="listitem" style={{ "--hw-index": index }}>
              <div className="hardware-icon">{iconLibrary[platform.icon]}</div>
              <div className="hardware-header">
                <h3>{platform.name}</h3>
                <p>{platform.arch}</p>
              </div>
              
              {/* 详细参数部分 */}
              <div className="hardware-specs">
                <div className="specs-section">
                  <h4>客户机支持</h4>
                  <div className="specs-grid">
                    <div className="spec-item">
                      <span className="spec-label">ArceOS</span>
                      <span className="spec-value">{platform.guestSupport.arceos}</span>
                    </div>
                    <div className="spec-item">
                      <span className="spec-label">Linux</span>
                      <span className="spec-value">{platform.guestSupport.linux}</span>
                    </div>
                    <div className="spec-item">
                      <span className="spec-label">NimbOS</span>
                      <span className="spec-value">{platform.guestSupport.nimbos}</span>
                    </div>
                    <div className="spec-item">
                      <span className="spec-label">Starry-OS</span>
                      <span className="spec-value">{platform.guestSupport.starry}</span>
                    </div>
                  </div>
                </div>
                
                <div className="performance-section">
                  <h4>性能指标</h4>
                  <div className="performance-grid">
                    <div className="perf-item">
                      <span className="perf-label">启动时间</span>
                      <span className="perf-value">{platform.performance.bootTime}</span>
                    </div>
                    <div className="perf-item">
                      <span className="perf-label">延迟</span>
                      <span className="perf-value">{platform.performance.latency}</span>
                    </div>
                    <div className="perf-item">
                      <span className="perf-label">吞吐量</span>
                      <span className="perf-value">{platform.performance.throughput}</span>
                    </div>
                    <div className="perf-item">
                      <span className="perf-label">功耗</span>
                      <span className="perf-value">{platform.performance.powerConsumption}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 底部按钮 */}
              <div className="hardware-actions">
                <button
                  className="hardware-button primary-button"
                  onClick={() => onDownloadClick(platform.id)}
                >
                  <Translate>下载体验</Translate>
                </button>
                <Link className="hardware-button secondary-button" to={useBaseUrl(platform.doc)}>
                  <Translate>查看指南</Translate>
                </Link>
              </div>
              
              {/* 卡片背景动画 */}
              <svg className="hardware-card-decoration" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id={`hwGrad-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--hw-accent-1)" />
                    <stop offset="100%" stopColor="var(--hw-accent-2)" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="300" height="30" fill="url(#hwGrad-{index})" opacity="0.1" />
                <path d="M0,350 Q75,370 150,350 T300,350 L300,400 L0,400 Z" fill="url(#hwGrad-{index})" opacity="0.05" />
              </svg>
            </article>
          ))}
        </div>
      </div>

      {/* 底部锯齿分割 */}
      <svg className="section-divider-bottom zigzag-divider" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="hwDividerBg" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--hw-divider-2)" />
            <stop offset="100%" stopColor="var(--hw-divider-1)" />
          </linearGradient>
        </defs>
        <polyline points="0,40 150,0 300,40 450,0 600,40 750,0 900,40 1050,0 1200,40 1200,80 0,80" fill="url(#hwDividerBg)" opacity="0.4" />
        <polyline points="0,60 150,20 300,60 450,20 600,60 750,20 900,60 1050,20 1200,60" stroke="url(#hwDividerBg)" fill="none" strokeWidth="1" opacity="0.3" />
      </svg>
    </section>
  );
}

function ScenarioSection() {
  const scenarios = [
    {
      id: "edge",
      title: translate({ id: "home.scenario.edge", message: "边缘计算 · 机器人" }),
      description: translate({
        id: "home.scenario.edge.desc",
        message: "配对实时访客与 Linux 帮助程序，协调传感器、AI 推理和确定性执行器。适合需要低延迟和硬实时的边缘设备。",
      }),
      accent: "robot",
    },
    {
      id: "cloud",
      title: translate({ id: "home.scenario.cloud", message: "云隔离" }),
      description: translate({
        id: "home.scenario.cloud.desc",
        message: "在 AxVisor 上运行多个租户 OS 堆栈，灵活的调度策略提供资源隔离和服务保证。",
      }),
      accent: "server",
    },
    {
      id: "automotive",
      title: translate({ id: "home.scenario.auto", message: "汽车电子" }),
      description: translate({
        id: "home.scenario.auto.desc",
        message: "通过访客配置组合安全分区、RTOS 和多媒体工作负载。满足功能安全和性能隔离要求。",
      }),
      accent: "chip",
    },
    {
      id: "iot",
      title: translate({ id: "home.scenario.iot", message: "物联网" }),
      description: translate({
        id: "home.scenario.iot.desc",
        message: "轻量级虚拟化支持多个 RTOS 访客，用于分布式传感、设备管理和数据采集。",
      }),
      accent: "pulse",
    },
    {
      id: "industrial",
      title: translate({ id: "home.scenario.industrial", message: "工业控制" }),
      description: translate({
        id: "home.scenario.industrial.desc",
        message: "确定性时间满足实时控制要求，支持多个控制系统和数据采集单元的隔离运行。",
      }),
      accent: "layers",
    },
    {
      id: "aerospace",
      title: translate({ id: "home.scenario.aerospace", message: "航空航天" }),
      description: translate({
        id: "home.scenario.aerospace.desc",
        message: "可审计的虚拟化架构满足严格隔离和认证要求。支持安全关键系统的形式化验证。",
      }),
      accent: "orbit",
    },
  ];

  const renderScenarioImage = (index, gradId) => {
    // 使用硬编码颜色值，避免在SSR环境中使用getComputedStyle
    const isDarkMode = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
    
    // 根据主题设置颜色
    const color1 = isDarkMode ? '#38bdf8' : '#38bdf8';
    const color2 = isDarkMode ? '#3b82f6' : '#3b82f6';
    
    const images = [
      // Edge + Robot
      () => (
        <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color1} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <rect width="200" height="200" fill={`url(#${gradId})`} opacity="0.08" />
          <circle cx="100" cy="60" r="25" fill="none" stroke={`url(#${gradId})`} strokeWidth="2" opacity="0.6" />
          <circle cx="100" cy="60" r="18" fill="none" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.4" />
          <rect x="60" y="95" width="20" height="40" rx="3" fill="none" stroke={`url(#${gradId})`} strokeWidth="2" opacity="0.6" />
          <rect x="120" y="95" width="20" height="40" rx="3" fill="none" stroke={`url(#${gradId})`} strokeWidth="2" opacity="0.6" />
          <rect x="85" y="110" width="30" height="20" rx="2" fill={`url(#${gradId})`} opacity="0.3" />
        </svg>
      ),
      // Cloud Isolation
      () => (
        <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color1} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <rect width="200" height="200" fill={`url(#${gradId})`} opacity="0.08" />
          <path d="M50 90 Q40 80 50 70 Q60 60 75 70 Q85 50 100 60 Q110 45 125 60 Q140 55 150 70 Q160 80 150 90 Z" fill="none" stroke={`url(#${gradId})`} strokeWidth="2" opacity="0.6" />
          <circle cx="70" cy="120" r="12" fill="none" stroke={`url(#${gradId})`} strokeWidth="1.5" opacity="0.5" />
          <circle cx="100" cy="130" r="12" fill="none" stroke={`url(#${gradId})`} strokeWidth="1.5" opacity="0.5" />
          <circle cx="130" cy="120" r="12" fill="none" stroke={`url(#${gradId})`} strokeWidth="1.5" opacity="0.5" />
        </svg>
      ),
      // Automotive
      () => (
        <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color1} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <rect width="200" height="200" fill={`url(#${gradId})`} opacity="0.08" />
          <rect x="50" y="80" width="100" height="35" rx="4" fill="none" stroke={`url(#${gradId})`} strokeWidth="2" opacity="0.6" />
          <rect x="65" y="85" width="15" height="8" rx="2" fill={`url(#${gradId})`} opacity="0.3" />
          <rect x="120" y="85" width="15" height="8" rx="2" fill={`url(#${gradId})`} opacity="0.3" />
          <circle cx="65" cy="130" r="8" fill="none" stroke={`url(#${gradId})`} strokeWidth="2" opacity="0.6" />
          <circle cx="135" cy="130" r="8" fill="none" stroke={`url(#${gradId})`} strokeWidth="2" opacity="0.6" />
        </svg>
      ),
      // IoT
      () => (
        <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color1} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <rect width="200" height="200" fill={`url(#${gradId})`} opacity="0.08" />
          <circle cx="100" cy="70" r="15" fill="none" stroke={`url(#${gradId})`} strokeWidth="2" opacity="0.6" />
          <circle cx="100" cy="70" r="22" fill="none" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.3" />
          <circle cx="60" cy="120" r="8" fill="none" stroke={`url(#${gradId})`} strokeWidth="1.5" opacity="0.5" />
          <circle cx="100" cy="140" r="8" fill="none" stroke={`url(#${gradId})`} strokeWidth="1.5" opacity="0.5" />
          <circle cx="140" cy="120" r="8" fill="none" stroke={`url(#${gradId})`} strokeWidth="1.5" opacity="0.5" />
          <line x1="100" y1="85" x2="60" y2="120" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.4" />
          <line x1="100" y1="85" x2="100" y2="140" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.4" />
          <line x1="100" y1="85" x2="140" y2="120" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.4" />
        </svg>
      ),
      // Industrial
      () => (
        <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color1} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <rect width="200" height="200" fill={`url(#${gradId})`} opacity="0.08" />
          <rect x="45" y="50" width="110" height="100" rx="2" fill="none" stroke={`url(#${gradId})`} strokeWidth="2" opacity="0.5" />
          <line x1="55" y1="65" x2="145" y2="65" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.4" />
          <line x1="55" y1="80" x2="145" y2="80" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.4" />
          <line x1="55" y1="95" x2="145" y2="95" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.4" />
          <line x1="55" y1="110" x2="145" y2="110" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.4" />
          <line x1="55" y1="125" x2="145" y2="125" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.4" />
          <circle cx="65" cy="72" r="3" fill={`url(#${gradId})`} opacity="0.5" />
          <circle cx="100" cy="87" r="3" fill={`url(#${gradId})`} opacity="0.5" />
          <circle cx="135" cy="102" r="3" fill={`url(#${gradId})`} opacity="0.5" />
        </svg>
      ),
      // Aerospace
      () => (
        <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color1} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <rect width="200" height="200" fill={`url(#${gradId})`} opacity="0.08" />
          <path d="M100 40 L120 100 L100 130 L80 100 Z" fill="none" stroke={`url(#${gradId})`} strokeWidth="2" opacity="0.6" />
          <circle cx="100" cy="100" r="15" fill={`url(#${gradId})`} opacity="0.2" />
          <path d="M70 105 L65 120 M130 105 L135 120" stroke={`url(#${gradId})`} strokeWidth="1.5" opacity="0.5" />
          <circle cx="100" cy="40" r="6" fill="none" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.4" />
        </svg>
      ),
    ];
    
    return images[index]();
  };

  return (
    <section className="home-section scenario-section" id="scenarios" style={{ "--section-index": 3 }}>
      {/* 顶部圆弧分割 */}
      <svg className="section-divider-top arc-divider" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="scenarioDivider" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--scenario-divider-1)" />
            <stop offset="100%" stopColor="var(--scenario-divider-2)" />
          </linearGradient>
        </defs>
        <path d="M0,60 Q300,10 600,60 T1200,60 L1200,0 L0,0 Z" fill="url(#scenarioDivider)" opacity="0.5" />
        <path d="M0,40 Q300,0 600,40 T1200,40" stroke="url(#scenarioDivider)" strokeWidth="2" fill="none" opacity="0.4" />
      </svg>

      <div className="section-inner">
        <div className="section-header">
          <p className="eyebrow">
            <Translate>应用场景</Translate>
          </p>
          <h2>
            <Translate>覆盖多领域 · 灵活满足多样化需求</Translate>
          </h2>
          <p>
            <Translate>
              AxVisor 的组件化和多架构支持使其能适应各种应用场景。
              从实时机器人控制到云隔离、汽车电子、物联网、工业控制、航空航天等领域，
              提供灵活的虚拟化解决方案。
            </Translate>
          </p>
        </div>
        <div className="scenario-marquee">
          <div className="scenario-scroll-container">
            {scenarios.map((scenario, index) => (
              <article className="scenario-card" key={scenario.id} style={{ "--scenario-index": index }}>
                <div className="scenario-image-placeholder" aria-label={scenario.title}>
                  {renderScenarioImage(index, `scenarioImg-${index}`)}
                </div>
                <div className="scenario-content">
                  <div className="scenario-icon">{iconLibrary[scenario.accent]}</div>
                  <div className="scenario-text">
                    <h3>{scenario.title}</h3>
                    <p>{scenario.description}</p>
                  </div>
                </div>
                {/* 卡片背景装饰 */}
                <svg className="scenario-card-decoration" viewBox="0 0 400 250" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id={`scenarioGrad-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--scenario-accent-1)" />
                      <stop offset="100%" stopColor="var(--scenario-accent-2)" />
                    </linearGradient>
                  </defs>
                  <circle cx="400" cy="0" r="150" fill="url(#scenarioGrad-{index})" opacity="0.08" />
                  <circle cx="0" cy="250" r="120" fill="url(#scenarioGrad-{index})" opacity="0.06" />
                </svg>
              </article>
            ))}
            {/* 复制卡片用于无缝滚动 */}
            {scenarios.map((scenario, index) => (
              <article className="scenario-card" key={`${scenario.id}-clone`} style={{ "--scenario-index": index }}>
                <div className="scenario-image-placeholder" aria-label={scenario.title}>
                  {renderScenarioImage(index, `scenarioImg-${index}-clone`)}
                </div>
                <div className="scenario-content">
                  <div className="scenario-icon">{iconLibrary[scenario.accent]}</div>
                  <div className="scenario-text">
                    <h3>{scenario.title}</h3>
                    <p>{scenario.description}</p>
                  </div>
                </div>
                {/* 卡片背景装饰 */}
                <svg className="scenario-card-decoration" viewBox="0 0 400 250" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id={`scenarioGrad-${index}-clone`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--scenario-accent-1)" />
                      <stop offset="100%" stopColor="var(--scenario-accent-2)" />
                    </linearGradient>
                  </defs>
                  <circle cx="400" cy="0" r="150" fill="url(#scenarioGrad-{index}-clone)" opacity="0.08" />
                  <circle cx="0" cy="250" r="120" fill="url(#scenarioGrad-{index}-clone)" opacity="0.06" />
                </svg>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* 底部波浪分割 */}
      <svg className="section-divider-bottom wave-divider" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="scenarioDividerBg" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--scenario-divider-2)" />
            <stop offset="100%" stopColor="var(--scenario-divider-1)" />
          </linearGradient>
        </defs>
        <path d="M0,40 Q300,60 600,40 T1200,40 L1200,100 L0,100 Z" fill="url(#scenarioDividerBg)" opacity="0.5" />
        <path d="M0,60 Q300,80 600,60 T1200,60" stroke="url(#scenarioDividerBg)" strokeWidth="1" fill="none" opacity="0.3" />
      </svg>
    </section>
  );
}

function PartnerSection() {
  const partners = [
    { id: "partner-open", label: "开源社区" },
    { id: "partner-soc", label: "芯片厂商" },
    { id: "partner-academia", label: "学术机构" },
    { id: "partner-industrial", label: "工业合作伙伴" },
  ];

  return (
    <section className="home-section partner-section" id="partners" style={{ "--section-index": 4 }}>
      {/* 顶部不规则分割 */}
      <svg className="section-divider-top blob-divider" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="partnerDivider" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--partner-divider-1)" />
            <stop offset="100%" stopColor="var(--partner-divider-2)" />
          </linearGradient>
        </defs>
        <path d="M0,40 Q150,0 300,40 T600,40 T900,40 T1200,40 L1200,0 L0,0 Z" fill="url(#partnerDivider)" opacity="0.5" />
        <path d="M0,60 Q150,20 300,60 T600,60 T900,60 T1200,60" stroke="url(#partnerDivider)" strokeWidth="1" fill="none" opacity="0.3" className="partner-line-anim" />
      </svg>

      <div className="section-inner">
        <div className="section-header">
          <p className="eyebrow">
            <Translate>合作伙伴</Translate>
          </p>
          <h2>
            <Translate>共同建设 · 开源生态协作</Translate>
          </h2>
          <p>
            <Translate>
              AxVisor 秉持开源精神，与芯片厂商、系统集成商、学术机构和工业界伙伴合作。
              欢迎社区贡献，共同推动虚拟化技术的创新和应用。
            </Translate>
          </p>
        </div>
        <div className="partner-grid" role="list">
          {partners.map((partner, index) => (
            <div className="partner-card" role="listitem" key={partner.id} style={{ "--partner-index": index }}>
              <svg viewBox="0 0 160 80" role="presentation" aria-hidden="true" className="partner-badge-svg">
                <defs>
                  <linearGradient id={`partnerBadge-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--partner-accent-1)" />
                    <stop offset="100%" stopColor="var(--partner-accent-2)" />
                  </linearGradient>
                </defs>
                <rect x="10" y="20" width="140" height="40" rx="20" className="partner-badge" fill="none" stroke={`url(#partnerBadge-${index})`} strokeWidth="2" />
              </svg>
              <span className="partner-text">{partner.label}</span>
              {/* 卡片背景动画 */}
              <svg className="partner-card-decoration" viewBox="0 0 160 80" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <radialGradient id={`partnerGlow-${index}`} cx="50%" cy="50%">
                    <stop offset="0%" stopColor="var(--partner-accent-1)" />
                    <stop offset="100%" stopColor="var(--partner-accent-2)" />
                  </radialGradient>
                </defs>
                <circle cx="80" cy="40" r="60" fill="url(#partnerGlow-{index})" opacity="0.05" className="partner-glow" />
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* 底部最终分割 */}
      <svg className="section-divider-bottom final-divider" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="partnerFinalDivider" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--partner-divider-2)" />
            <stop offset="100%" stopColor="var(--partner-divider-1)" />
          </linearGradient>
        </defs>
        <path d="M0,30 Q200,0 400,30 T800,30 T1200,30 L1200,80 L0,80 Z" fill="url(#partnerFinalDivider)" opacity="0.4" />
      </svg>
    </section>
  );
}

export default function Home() {
  const scrollingRef = useRef(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  // 定义页面导航的sections
  const navSections = [
    { id: 'hero', label: '首页' },
    { id: 'features', label: '核心优势' },
    { id: 'architecture', label: '系统架构' },
    { id: 'component-design', label: '组件设计' },
    { id: 'hardware', label: '硬件平台' },
    { id: 'scenarios', label: '应用场景' },
  ];

  // 处理下载按钮点击
  const handleDownloadClick = (platformId) => {
    setSelectedPlatform(platformId);
    setDownloadModalOpen(true);
  };

  // 关闭下载模态框
  const closeDownloadModal = () => {
    setDownloadModalOpen(false);
    setSelectedPlatform(null);
  };

  useEffect(() => {
    const handleWheel = (e) => {
      // 正在滚动时阻止新事件
      if (scrollingRef.current) {
        e.preventDefault();
        return;
      }

      const sections = document.querySelectorAll(".home-section");
      if (!sections.length) return;

      // 查找当前最接近的 section
      const scrollTop = window.scrollY;
      let currentIndex = 0;
      let minDistance = Infinity;
      
      sections.forEach((section, index) => {
        const distance = Math.abs(section.offsetTop - scrollTop);
        if (distance < minDistance) {
          minDistance = distance;
          currentIndex = index;
        }
      });

      const isScrollingDown = e.deltaY > 0;
      
      // 在边界允许自由滚动：最后一个 section 向下滚或第一个 section 向上滚
      if ((isScrollingDown && currentIndex === sections.length - 1) || 
          (!isScrollingDown && currentIndex === 0)) {
        return;
      }

      // 滚动强度阈值，减少误触发
      if (Math.abs(e.deltaY) < 30) return;

      e.preventDefault();

      // 计算目标 section
      const targetIndex = isScrollingDown 
        ? Math.min(currentIndex + 1, sections.length - 1)
        : Math.max(currentIndex - 1, 0);

      if (targetIndex === currentIndex) return;

      // 滚动到目标 section
      scrollingRef.current = true;
      sections[targetIndex].scrollIntoView({ behavior: "smooth" });
      
      setTimeout(() => {
        scrollingRef.current = false;
      }, 800);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <Layout
      title={translate({ message: "AxVisor - 基于 ArceOS 的统一组件化超级监管程序" })}
      description={translate({ message: "AxVisor - 基于 ArceOS 的统一组件化超级监管程序" })}
    >
      <main className="home">
        <PageNavigator sections={navSections} />
        <HeroBanner />
        <FeatureSection />
        <ArchitectureSection />
        <ComponentDesignSection />
        <HardwareSection onDownloadClick={handleDownloadClick} />
        <ScenarioSection />
        <DownloadModal
          isOpen={downloadModalOpen}
          onClose={closeDownloadModal}
          platformId={selectedPlatform}
        />
      </main>
    </Layout>
  );
}
