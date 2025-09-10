import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import Translate, { translate } from '@docusaurus/Translate';
import "./index.css";

function HomepageBanner() {
  return (
    <div className="axvisor-banner-container">
      <div className="axvisor-banner-left">
        <div className="axvisor-banner-title" >
        <Translate>AxVisor</Translate>
        </div>
        <div className="axvisor-banner-description">
          <Translate>A unified modular hypervisor based on ArceOS</Translate>
        </div>

        <div className="axvisor-banner-feature">
          <ul>
            <li><Translate>Component-based design</Translate></li>
            <li><Translate>Features multiple kernel architecture forms</Translate></li>
            <li><Translate>Support for multiple application scenarios</Translate></li>
            <li><Translate>Developed using the Rust programming language</Translate></li>
            <li><Translate>Supports RTOS, BareMetal, and Linux as subsystems</Translate></li>
            <li><Translate>Adopted the MIT permissive open-source license</Translate></li>
          </ul>
        </div>

        <div className="axvisor-banner-support">
          <p className="axvisor-banner-support-title"><Translate>Multi-architecture support, verified on the following architectures</Translate></p>
          <div className="axvisor-banner-support-icons">
            <span>
              <img src="images/homepage/arm.svg"></img>
            </span>
            <span>
              <img src="images/homepage/x86.svg"></img>
            </span>
          </div>
        </div>

        <div className="axvisor-banner-button">
          <Link className="axvisor-banner-explore-button" to={useBaseUrl("docs/overview")}>
            <Translate>Quick Start</Translate>
          </Link>

          <Link className="axvisor-banner-download-button" to={useBaseUrl("docs/overview")}>
            <Translate>Get Started</Translate>
          </Link>
        </div>
      </div>

      <div className="axvisor-banner-right">
        <img className="axvisor-banner-content-image" src="images/homepage/axvisor.arch.png"></img>
      </div>
    </div>
  );
}

function HomepageForm() {
  return (
    <div className="axvisor-form-container">
      <h1 className="text--center axvisor-form-title"><Translate>Multiple kernel architecture forms</Translate></h1>
      <p className="text--center axvisor-form-description"><Translate>It allows flexible combination of various kernel architecture forms</Translate></p>
      <div className="axvisor-form-content">
        <div className="axvisor-form-content-left">
          <img className="axvisor-form-content-image" src="images/homepage/axvisor.form.png"></img>
        </div>
        <div className="axvisor-form-content-right">
          <h2 className="text--center axvisor-form-content-right-title"><Translate>Refine kernel module attributes to form unidirectional dependencies, creating standalone kernel modules</Translate></h2>
          <ul className="axvisor-form-feature">
            <li><Translate>Language-level core libraries independent of the operating system</Translate></li>
            <li><Translate>Operating System-independent component library</Translate></li>
            <li><Translate>Architecture optimization based on configuration and static analysis</Translate></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function HomepageModule() {
  return (
    <div className="axvisor-module-container">
      <h1 className="text--center axvisor-module-title"><Translate>Component-based design</Translate></h1>
      <p className="text--center axvisor-module-description"><Translate>Through the analysis of existing typical OS kernels and our practical experience with multiple kernel modes, we have found that by extracting common functionalities and encapsulating them as independent components, we can create a component repository. Based on this repository, we can freely select the appropriate components and adopt suitable combinations to build various kernel modes, forming a flexible and adaptable approach to kernel development</Translate></p>
      <div className="axvisor-module-content">
        <div className="axvisor-module-content-left">
          <img className="axvisor-module-content-image" src="images/homepage/axvisor.module.png"></img>
        </div>
        <div className="axvisor-module-content-right">
          <h2 className="text--center axvisor-module-content-right-title"><Translate>The component-based design approach will significantly improve kernel development efficiency, kernel product reliability, and more. It also facilitates collaboration among kernel developers based on components</Translate></h2>
          <ul className="axvisor-module-feature">
            <li><Translate>Language-level core libraries independent of the operating system</Translate></li>
            <li><Translate>Operating System-independent component library</Translate></li>
            <li><Translate>Architecture optimization based on configuration and static analysis</Translate></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function HomepageTarget() {
  return (
    <div className="axvisor-target-container">
      <h1 className="text--center axvisor-target-title"><Translate>Multiple application scenarios</Translate></h1>
      <p className="text--center axvisor-target-description"><Translate>Multiple application scenarios. Multiple application scenarios. Multiple application scenarios. Multiple application scenarios. Multiple application scenarios. Multiple application scenarios. Multiple application scenarios</Translate></p>
      <div className="axvisor-target-content">
        <div className="axvisor-target-content-left">
          <h2 className="text--center axvisor-target-content-left-title"><Translate>This is a description of a key feature.</Translate></h2>
          <ul className="axvisor-target-feature">
            <li><Translate>feature 1</Translate></li>
            <li><Translate>feature 2</Translate></li>
            <li><Translate>feature 3</Translate></li>
            <li><Translate>feature 4</Translate></li>
          </ul>
        </div>
        <div className="axvisor-target-content-middle">
          <img className="axvisor-target-content-image" src="images/homepage/axvisor.target.png"></img>
        </div>
        <div className="axvisor-target-content-right">
          <h2 className="text--center axvisor-target-content-right-title"><Translate>By freely combining modules, a kernel can be created that is suitable for different application scenarios. Through the flexible combination of modules, a kernel tailored to various application environments can be formed</Translate></h2>
          <ul className="axvisor-target-feature">
            <li><Translate>feature 1</Translate></li>
            <li><Translate>feature 2</Translate></li>
            <li><Translate>feature 3</Translate></li>
            <li><Translate>feature 4</Translate></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Layout 
      title={translate({message: 'A unified modular hypervisor based on ArceOS'})} 
      description={translate({message: 'A unified modular hypervisor based on ArceOS'})}>

      <HomepageBanner />

      <HomepageForm />

      <HomepageModule />

      <HomepageTarget />

    </Layout>
  );
}
