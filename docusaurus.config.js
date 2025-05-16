// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */

export default {
  title: 'AxVisor',
  tagline: 'A unified modular hypervisor based on ArceOS',
  favicon: 'images/site/favicon.ico',

  // Set the production url of your site here
  url: 'https://arceos-hypervisor.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/axvisorbook',
  // Allow to customize the presence/absence of a trailing slash at the end of 
  // URLs/links, and how static HTML files are generated:
  // undefined (default): keeps URLs untouched, and emit /docs/myDoc/index.html for /docs/myDoc.md
  // true: add trailing slashes to URLs/links, and emit /docs/myDoc/index.html for /docs/myDoc.md
  // false: remove trailing slashes from URLs/links, and emit /docs/myDoc.html for /docs/myDoc.md
  trailingSlash: false,

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'arceos-hypervisor', // Usually your GitHub org/user name.
  projectName: 'axvisorbook', // Usually your repo name.
  deploymentBranch: 'gh-pages',
  // The behavior of Docusaurus when it detects any broken link.
  // he broken links detection is only available for a production build (docusaurus build).
  onBrokenLinks: 'throw',
  // The behavior of Docusaurus when it detects any broken Markdown link.
  // he broken links detection is only available for a production build (docusaurus build).
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    localeConfigs: {
      en: {
        label: 'English',
        direction: 'ltr',
        htmlLang: 'en-US',
        calendar: 'gregory',
        path: 'en',
      },
      zh: {
          label: '简体中文',
          direction: 'ltr',
          htmlLang: 'zh-CN',
          calendar: 'gregory',
          path: 'zh',
        },
    },
  },

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'community',
        path: 'community',
        routeBasePath: 'community',
        sidebarPath: './sidebars.community.js',
      },
    ],
  ],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.docs.js',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: 'https://github.com/arceos-hypervisor/axvisorbook',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: {
          blogSidebarTitle: 'All posts',
          blogSidebarCount: 'ALL',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:'https://github.com/arceos-hypervisor/axvisorbook',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        pages: {
          path: 'src/pages',
          routeBasePath: '',
          include: ['**/*.{js,jsx,ts,tsx,md,mdx}'],
          exclude: [
            '**/_*.{js,jsx,ts,tsx,md,mdx}',
            '**/_*/**',
            '**/*.test.{js,jsx,ts,tsx}',
            '**/__tests__/**',
          ],
          // mdxPageComponent: '@theme/MDXPage',
          // remarkPlugins: [require('./my-remark-plugin')],
          rehypePlugins: [],
          beforeDefaultRemarkPlugins: [],
          beforeDefaultRehypePlugins: [],
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      // Replace with your project's social card
      // image: 'images/site/docusaurus-social-card.jpg',
      algolia: {
        // The application ID provided by Algolia
        appId: 'Q13DYDY9IC',
  
        // Public API key: it is safe to commit it
        apiKey: 'ee7f03a0f69d593d77c99ce425b15a4b',
  
        indexName: 'arceos-hypervisorio',
  
        // Optional: see doc section below
        contextualSearch: true,
  
        // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
        // externalUrlRegex: 'external\\.com|domain\\.com',
  
        // Optional: Replace parts of the item URLs from Algolia. Useful when using the same search index for multiple deployments using a different baseUrl. You can use regexp or string in the `from` param. For example: localhost:3000 vs myCompany.com/docs
        // replaceSearchResultPathname: {
        //   from: '/docs/', // or as RegExp: /\/docs\//
        //   to: '/',
        // },
  
        // Optional: Algolia search parameters
        searchParameters: {},
  
        // Optional: path for search page that enabled by default (`false` to disable it)
        searchPagePath: 'search',
  
        // Optional: whether the insights feature is enabled or not on Docsearch (`false` by default)
        insights: false,
      },
      announcementBar: {
        id: 'tips',
        content:'💪💪💪Currently, the project is in its early stages, and the related source code and documentation are being gradually organized.💪💪💪',
        backgroundColor: '#fafbfc',
        textColor: '#091E42',
        isCloseable: true,
      },
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: true,
        },
      },
      navbar: {
        title: 'AxVisor',
        hideOnScroll: true,
        logo: {
          alt: 'AxVisor Logo',
          src: 'images/site/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docs',
            position: 'left',
            label: 'Document',
          },
          {
            to: '/blog', 
            activeBasePath: 'blog',
            label: 'Blog', 
            position: 'left'
          },
          {
            to: '/community/introduction',
            activeBasePath: 'community',
            label: 'Community',
            position: 'left'
          },
          {
            type: 'search',
            position: 'right',
          },
          {
            type: 'localeDropdown',
            position: 'right',
            dropdownItemsAfter: [
              {
                type: 'html',
                value: '<hr style="margin: 0.3rem 0;">',
              },
              {
                href: 'https://github.com/arceos-hypervisor/axvisorbook',
                label: 'Help Us Translate',
              },
            ],
          },
          {
            href: 'https://github.com/arceos-hypervisor/axvisor',
            position: 'right',
            className: 'header-github-link',
            'aria-label': 'GitHub repository',
          },
        ],
      },
      footer: {
        style: 'light',
        links: [
          {
            title: 'Document',
            items: [
              {
                label: 'Tutorial',
                to: '/docs/introduction',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'arceos-hypervisor',
                href: 'https://github.com/arceos-hypervisor',
              },
              {
                label: 'ArceOS',
                href: 'https://github.com/arceos-org',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'openEuler',
                href: 'https://www.openeuler.org/',
              },
              {
                label: 'Phytium',
                href: 'https://gitee.com/phytium_embedded',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} ArceOS team`,
      },
      prism: {
        aditionalLanguages: [
          'rust',
          'latex',
          'TOML',
          'Git',
          'C',
          'C++',
          'bash',
          'diff',
          'json',
          'scss',
        ],
        magicComments: [
          {
            className: 'theme-code-block-highlighted-line',
            line: 'highlight-next-line',
            block: {start: 'highlight-start', end: 'highlight-end'},
          },
          {
            className: 'code-block-error-line',
            line: 'This will error',
          },
        ],
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};
