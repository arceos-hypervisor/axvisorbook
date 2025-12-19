import React, { useState } from 'react';
import clsx from 'clsx';
import Translate from '@docusaurus/Translate';
import styles from './styles.module.css';

// 下载链接数据
const downloadLinks = {
  qemu: {
    name: "QEMU 模拟环境",
    baidu: {
      link: "https://pan.baidu.com/e/1MlKooeGsEWHIkcQ_CpOFkg",
      password: "ce74",
      description: "QEMU 模拟环境完整镜像"
    },
    other: {
      link: "https://github.com/axvisor/axvisor/releases/latest",
      description: "GitHub 发布页面"
    }
  },
  phytiumpi: {
    name: "飞腾派",
    baidu: {
      link: "https://pan.baidu.com/s/1dLQegazeEllMDQ6KyK8_Xg",
      password: "73fn",
      description: "飞腾派预编译镜像"
    },
    other: {
      link: "https://github.com/axvisor/axvisor/releases/latest",
      description: "GitHub 发布页面"
    }
  },
  roc3568: {
    name: "ROC-RK3568-PC",
    baidu: {
      link: "https://pan.baidu.com/s/1amD3GkQqaXqV8YFf89ow6Q",
      password: "3bx3",
      description: "ROC-RK3568-PC 预编译镜像"
    },
    other: {
      link: "https://github.com/axvisor/axvisor/releases/latest",
      description: "GitHub 发布页面"
    }
  }
};

export default function DownloadModal({ isOpen, onClose, platformId }) {
  const [copySuccess, setCopySuccess] = useState(false);
  
  if (!isOpen) return null;
  
  const platformData = downloadLinks[platformId];
  if (!platformData) return null;
  
  // 复制链接到剪贴板
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };
  
  // 处理链接点击
  const handleLinkClick = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            下载 {platformData.name}
          </h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        
        <div className={styles.modalBody}>
          <div className={styles.downloadSection}>
            <h3 className={styles.sectionTitle}>
              百度网盘下载
            </h3>
            <div className={styles.downloadCard}>
              <div className={styles.downloadInfo}>
                <p className={styles.downloadDescription}>
                  {platformData.baidu.description}
                </p>
                <div className={styles.linkContainer}>
                  <input 
                    type="text" 
                    readOnly 
                    value={platformData.baidu.link} 
                    className={styles.linkInput}
                  />
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard(platformData.baidu.link)}
                  >
                    {copySuccess ?
                      "已复制" :
                      "复制链接"
                    }
                  </button>
                </div>
                <div className={styles.passwordContainer}>
                  <span className={styles.passwordLabel}>
                    提取码:
                  </span>
                  <span className={styles.passwordValue}>{platformData.baidu.password}</span>
                  <button 
                    className={styles.copyPasswordButton}
                    onClick={() => copyToClipboard(platformData.baidu.password)}
                  >
                    {copySuccess ?
                      "已复制" :
                      "复制"
                    }
                  </button>
                </div>
              </div>
              <button
                className={styles.downloadButton}
                onClick={() => handleLinkClick(platformData.baidu.link)}
              >
                前往百度网盘
              </button>
            </div>
          </div>
          
          <div className={styles.downloadSection}>
            <h3 className={styles.sectionTitle}>
              其他下载方式
            </h3>
            <div className={styles.downloadCard}>
              <div className={styles.downloadInfo}>
                <p className={styles.downloadDescription}>
                  {platformData.other.description}
                </p>
                <div className={styles.linkContainer}>
                  <input 
                    type="text" 
                    readOnly 
                    value={platformData.other.link} 
                    className={styles.linkInput}
                  />
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard(platformData.other.link)}
                  >
                    {copySuccess ?
                      "已复制" :
                      "复制链接"
                    }
                  </button>
                </div>
              </div>
              <button
                className={styles.downloadButton}
                onClick={() => handleLinkClick(platformData.other.link)}
              >
                前往下载页面
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}