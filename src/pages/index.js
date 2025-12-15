import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import Translate, { translate } from '@docusaurus/Translate';
import "./index.css";

function HeroBanner() {
  return (
    <div className="hero-banner">
      <div className="hero-container">
        <div className="hero-content">
          <h1 className="hero-title">
            <Translate>AxVisor</Translate>
          </h1>
          <p className="hero-subtitle">
            <Translate>基于 ArceOS 的统一模块化虚拟机监视器</Translate>
          </p>
          <p className="hero-description">
            <Translate>新一代开源虚拟化解决方案，支持多架构、多客户机，为嵌入式系统和企业应用提供高效、安全的虚拟化环境</Translate>
          </p>
          <div className="hero-buttons">
            <a
              className="button button--primary button--lg hero-button-primary"
              href={useBaseUrl("docs/introduction/overview")}>
              <Translate>开始使用</Translate>
            </a>
            <a
              className="button button--secondary button--lg hero-button-secondary"
              href={useBaseUrl("docs/quickstart/qemu/aarch64")}>
              <Translate>快速体验</Translate>
            </a>
          </div>
        </div>
        <div className="hero-image">
          <img src={useBaseUrl("images/homepage/axvisor.arch.png")} alt="AxVisor Architecture" />
        </div>
      </div>
    </div>
  );
}

function FeaturesSection() {
  return (
    <section className="features-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">
            <Translate>核心特性</Translate>
          </h2>
          <p className="section-subtitle">
            <Translate>为现代虚拟化需求设计的强大功能</Translate>
          </p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <h3 className="feature-title">
              <Translate>多架构支持</Translate>
            </h3>
            <p className="feature-description">
              <Translate>统一支持 x86_64、AArch64、RISC-V 和 LoongArch 四大芯片架构，实现代码最大化复用</Translate>
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <h3 className="feature-title">
              <Translate>多客户机支持</Translate>
            </h3>
            <p className="feature-description">
              <Translate>支持 ArceOS、Linux、RT-Thread 等多种客户机操作系统，满足不同应用场景需求</Translate>
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
            <h3 className="feature-title">
              <Translate>高效虚拟化</Translate>
            </h3>
            <p className="feature-description">
              <Translate>提供高效的虚拟化解决方案，支持多虚拟机同时运行，每个虚拟机可运行不同的客户机操作系统</Translate>
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6m4.22-13.22l4.24 4.24M1.54 9.96l4.24 4.24M20.46 14.04l-4.24 4.24M7.78 7.78L3.54 3.54"></path>
              </svg>
            </div>
            <h3 className="feature-title">
              <Translate>组件化设计</Translate>
            </h3>
            <p className="feature-description">
              <Translate>基于组件化的架构设计，功能模块化，便于定制和扩展，提高开发效率和系统可靠性</Translate>
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <h3 className="feature-title">
              <Translate>灵活配置</Translate>
            </h3>
            <p className="feature-description">
              <Translate>通过配置文件灵活配置虚拟机的资源分配、设备映射等参数，满足不同应用场景需求</Translate>
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <h3 className="feature-title">
              <Translate>安全可靠</Translate>
            </h3>
            <p className="feature-description">
              <Translate>采用 Rust 语言开发，内存安全保证，提供强大的隔离机制，确保虚拟机之间的安全隔离</Translate>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section className="architecture-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">
            <Translate>架构设计</Translate>
          </h2>
          <p className="section-subtitle">
            <Translate>统一模块化的虚拟机监视器架构</Translate>
          </p>
        </div>
        <div className="architecture-content">
          <div className="architecture-image">
            <img src={useBaseUrl("images/homepage/axvisor.form.png")} alt="AxVisor Architecture" />
          </div>
          <div className="architecture-description">
            <h3 className="architecture-title">
              <Translate>多内核架构形式</Translate>
            </h3>
            <p className="architecture-text">
              <Translate>AxVisor 允许灵活组合各种内核架构形式，通过精炼内核模块属性形成单向依赖，创建独立的内核模块。</Translate>
            </p>
            <ul className="architecture-features">
              <li><Translate>语言级独立于操作系统的核心库</Translate></li>
              <li><Translate>独立于操作系统的组件库</Translate></li>
              <li><Translate>基于配置和静态分析的架构优化</Translate></li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComponentDesignSection() {
  return (
    <section className="component-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">
            <Translate>组件化设计</Translate>
          </h2>
          <p className="section-subtitle">
            <Translate>通过组件化实现灵活高效的内核开发</Translate>
          </p>
        </div>
        <div className="component-content">
          <div className="component-description">
            <h3 className="component-title">
              <Translate>基于组件的设计方法</Translate>
            </h3>
            <p className="component-text">
              <Translate>通过对现有典型 OS 内核的分析和我们在多种内核模式下的实践经验，我们发现通过提取通用功能并将其封装为独立组件，可以创建一个组件库。基于此库，我们可以自由选择合适的组件并采用合适的组合来构建各种内核模式，形成灵活且适应性强的内核开发方法。</Translate>
            </p>
            <ul className="component-features">
              <li><Translate>语言级独立于操作系统的核心库</Translate></li>
              <li><Translate>独立于操作系统的组件库</Translate></li>
              <li><Translate>基于配置和静态分析的架构优化</Translate></li>
            </ul>
          </div>
          <div className="component-image">
            <img src={useBaseUrl("images/homepage/axvisor.module.png")} alt="Component Design" />
          </div>
        </div>
      </div>
    </section>
  );
}

function UseCasesSection() {
  return (
    <section className="usecases-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">
            <Translate>应用场景</Translate>
          </h2>
          <p className="section-subtitle">
            <Translate>适用于多种虚拟化应用场景</Translate>
          </p>
        </div>
        <div className="usecases-grid">
          <div className="usecase-card">
            <div className="usecase-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <h3 className="usecase-title">
              <Translate>嵌入式系统开发</Translate>
            </h3>
            <p className="usecase-description">
              <Translate>为嵌入式系统开发与测试提供高效的虚拟化环境，支持多系统并行开发和测试</Translate>
            </p>
          </div>
          <div className="usecase-card">
            <div className="usecase-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                <path d="M14.5 18.5a2.5 2.5 0 0 1-5 0"></path>
                <line x1="12" y1="9" x2="12.01" y2="9"></line>
              </svg>
            </div>
            <h3 className="usecase-title">
              <Translate>物联网设备</Translate>
            </h3>
            <p className="usecase-description">
              <Translate>为物联网设备提供多任务隔离环境，增强设备安全性和可靠性</Translate>
            </p>
          </div>
          <div className="usecase-card">
            <div className="usecase-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <h3 className="usecase-title">
              <Translate>安全关键系统</Translate>
            </h3>
            <p className="usecase-description">
              <Translate>实现安全关键系统的实时与非实时任务分离，提供强大的隔离机制</Translate>
            </p>
          </div>
          <div className="usecase-card">
            <div className="usecase-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <h3 className="usecase-title">
              <Translate>资源整合</Translate>
            </h3>
            <p className="usecase-description">
              <Translate>整合多操作系统环境的资源，提高硬件利用率和系统管理效率</Translate>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SupportedPlatforms() {
  return (
    <section className="platforms-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">
            <Translate>支持平台</Translate>
          </h2>
          <p className="section-subtitle">
            <Translate>已在多种硬件平台上验证</Translate>
          </p>
        </div>
        <div className="platforms-grid">
          <div className="platform-category">
            <h3 className="platform-category-title">
              <Translate>虚拟化平台</Translate>
            </h3>
            <div className="platform-list">
              <div className="platform-item">
                <div className="platform-icon">
                  <img src={useBaseUrl("images/homepage/arm.svg")} alt="ARM" />
                </div>
                <div className="platform-info">
                  <h4>QEMU AArch64</h4>
                  <p>完整的虚拟化功能支持</p>
                </div>
              </div>
              <div className="platform-item">
                <div className="platform-icon">
                  <img src={useBaseUrl("images/homepage/x86.svg")} alt="x86" />
                </div>
                <div className="platform-info">
                  <h4>QEMU x86_64</h4>
                  <p>完整的 x86_64 指令集支持</p>
                </div>
              </div>
            </div>
          </div>
          <div className="platform-category">
            <h3 className="platform-category-title">
              <Translate>物理硬件平台</Translate>
            </h3>
            <div className="platform-list">
              <div className="platform-item">
                <div className="platform-icon">
                  <img src={useBaseUrl("images/homepage/arm.svg")} alt="ARM" />
                </div>
                <div className="platform-info">
                  <h4>Rockchip RK3568/RK3588</h4>
                  <p>高性能 ARM 处理器支持</p>
                </div>
              </div>
              <div className="platform-item">
                <div className="platform-icon">
                  <img src={useBaseUrl("images/homepage/arm.svg")} alt="ARM" />
                </div>
                <div className="platform-info">
                  <h4>飞腾派</h4>
                  <p>国产化处理器架构支持</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="cta-section">
      <div className="container">
        <div className="cta-content">
          <h2 className="cta-title">
            <Translate>开始使用 AxVisor</Translate>
          </h2>
          <p className="cta-description">
            <Translate>探索新一代虚拟化技术，为您的项目提供强大的虚拟化支持</Translate>
          </p>
          <div className="cta-buttons">
            <a
              className="button button--primary button--lg"
              href={useBaseUrl("docs/introduction/overview")}>
              <Translate>查看文档</Translate>
            </a>
            <a
              className="button button--secondary button--lg"
              href="https://github.com/arceos-hypervisor/axvisor"
              target="_blank"
              rel="noopener noreferrer">
              <Translate>GitHub</Translate>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout 
      title={translate({message: 'AxVisor - 基于 ArceOS 的统一模块化虚拟机监视器'})} 
      description={translate({message: 'AxVisor 是一个基于 ArceOS 框架实现的 Hypervisor，支持多架构、多客户机，为嵌入式系统和企业应用提供高效、安全的虚拟化环境'})}>
      
      <HeroBanner />
      <FeaturesSection />
      <ArchitectureSection />
      <ComponentDesignSection />
      <UseCasesSection />
      <SupportedPlatforms />
      <CTASection />
      
    </Layout>
  );
}
