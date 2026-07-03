// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'xnew',
  tagline: 'xnew is cool',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://mulsense.github.io/',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/xnew/',

  staticDirectories: ['static', '../examples'],

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'mulsense', // Usually your GitHub org/user name.
  projectName: 'xnew', // Usually your repo name.

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'ja',
    locales: ['ja', 'en'],
    localeConfigs: {
      ja: { label: '日本語', htmlLang: 'ja' },
      en: { label: 'English', htmlLang: 'en' },
    },
  },

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [
          { from: '/docs/category/document', to: '/docs/manual' },
          { from: '/docs/category/manual', to: '/docs/manual/core' },
          { from: '/docs/category/addons', to: '/docs/manual/addons' },
          { from: '/docs/category/examples', to: '/docs/examples' },
        ],
        createRedirects(existingPath) {
          const aliases = [];

          const explicitFroms = [
            '/docs/category/document',
            '/docs/category/manual',
            '/docs/category/addons',
            '/docs/category/examples',
          ];
          if (existingPath.startsWith('/docs/')) {
            const withCategory = existingPath.replace('/docs/', '/docs/category/');
            if (!explicitFroms.includes(withCategory)) {
              aliases.push(withCategory);
            }
          }

          if (existingPath.startsWith('/docs/examples/games/')) {
            aliases.push(existingPath.replace('/docs/examples/games/', '/docs/examples/game/'));
          }

          return aliases.length > 0 ? aliases : undefined;
        },
      },
    ],
  ],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          
          // editUrl:
          //   'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        // blog: {
        //   showReadingTime: true,
        //   feedOptions: {
        //     type: ['rss', 'atom'],
        //     xslt: true,
        //   },
        //   // Please change this to your repo.
        //   // Remove this to remove the "edit this page" links.
        //   editUrl:
        //     'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        //   // Useful options to enforce blogging best practices
        //   onInlineTags: 'warn',
        //   onInlineAuthors: 'warn',
        //   onUntruncatedBlogPosts: 'warn',
        // },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      navbar: {
        title: 'xnew',
        logo: {
          alt: '',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'manual',
          },
          {
            type: 'docSidebar',
            sidebarId: 'examplesSidebar',
            position: 'left',
            label: 'examples',
          },
          // {to: '/blog', label: 'Blog', position: 'left'},
          {
            href: 'https://github.com/mulsense/xnew',
            label: 'GitHub',
            position: 'right',
          },
          {
            type: 'localeDropdown',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'manual',
                to: '/docs/manual/getstarted',
              },
              {
                label: 'examples',
                to: '/docs/examples/basics/element',
              },
            ],
          },
          // {
          //   title: 'Community',
          //   items: [
          //     {
          //       label: 'Stack Overflow',
          //       href: 'https://stackoverflow.com/questions/tagged/docusaurus',
          //     },
          //     {
          //       label: 'Discord',
          //       href: 'https://discordapp.com/invite/docusaurus',
          //     },
          //     {
          //       label: 'X',
          //       href: 'https://x.com/docusaurus',
          //     },
          //   ],
          // },
          {
            title: 'More',
            items: [
              // {
              //   label: 'Blog',
              //   to: '/blog',
              // },
              {
                label: 'GitHub',
                href: 'https://mulsense.github.io/xnew/',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} xnew, mulsense.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
      // Declare some <meta> tags
      metadata: [
        {name: 'google-site-verification', content: 'VMIri0b4029DpITL33uK7B8pH6GckEqTC2uy7bSGIOE'},
      ],
    }),
};

export default config;
