import React, { useState, useEffect } from 'react';
import './styles.css';

const PageNavigator = ({ sections }) => {
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 2;

      // 查找当前活动的section
      const sectionElements = sections.map(section => 
        document.getElementById(section.id)
      ).filter(Boolean);

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const section = sectionElements[i];
        if (section && scrollPosition >= section.offsetTop) {
          setActiveSection(i);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // 初始化调用

    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="page-navigator" aria-label="页面导航">
      <div className="navigator-line"></div>
      <ul className="navigator-dots">
        {sections.map((section, index) => (
          <li key={section.id} className="navigator-item">
            <button
              className={`navigator-dot ${activeSection === index ? 'active' : ''}`}
              onClick={() => scrollToSection(section.id)}
              aria-label={section.label}
              title={section.label}
            >
              <span className="dot-inner"></span>
            </button>
            <span className="navigator-label">{section.label}</span>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default PageNavigator;
