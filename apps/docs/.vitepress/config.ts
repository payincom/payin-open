import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'PayIn Open',
  description: 'Open-source stablecoin payment gateway for merchants',
  base: process.env.VITEPRESS_BASE || '/',

  // Favicon configuration
  head: [
    ['link', { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'manifest', href: '/site.webmanifest' }]
  ],

  // Ignore dead links during build (for pages that are referenced but not yet created)
  ignoreDeadLinks: true,

  // Multi-language support
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Guide', link: '/en/guide/quick-start-mcp' },
          { text: 'AI Agent', link: '/en/guide/ai-agent-deployment' },
          { text: 'API Reference', link: '/en/api/overview' },
          { text: 'Examples', link: '/en/examples/order-payment' }
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Getting Started',
              items: [
                { text: 'Introduction', link: '/en/guide/introduction' },
                { text: 'Quick Start with MCP', link: '/en/guide/quick-start-mcp' },
                { text: 'AI-Assisted Deployment', link: '/en/guide/ai-agent-deployment' },
                { text: 'Address Pool Setup', link: '/en/guide/address-pool-setup' }
              ]
            },
            {
              text: 'Core Concepts',
              items: [
                { text: 'Testnet vs Mainnet', link: '/en/guide/testnet-vs-mainnet' },
                { text: 'Supported Networks', link: '/en/guide/supported-networks' },
                { text: 'Supported Tokens', link: '/en/guide/supported-tokens' }
              ]
            },
            {
              text: 'Core Features',
              items: [
                { text: 'Order Payment Service', link: '/en/guide/order-payment' },
                { text: 'Deposit Service', link: '/en/guide/deposit-service' },
                { text: 'Payment Links', link: '/en/guide/payment-links' },
                { text: 'API Integration', link: '/en/guide/api-integration' }
              ]
            },
            {
              text: 'Advanced',
              items: [
                { text: 'Webhooks', link: '/en/guide/webhooks' },
                { text: 'Address Management', link: '/en/guide/address-management' },
                { text: 'Security', link: '/en/guide/security' }
              ]
            }
          ],
          '/en/api/': [
            {
              text: 'Getting Started',
              items: [
                { text: 'API Overview', link: '/en/api/overview' }
              ]
            },
            {
              text: 'Core APIs',
              items: [
                { text: 'Orders', link: '/en/api/orders' },
                { text: 'Deposits', link: '/en/api/deposits' }
              ]
            }
          ],
          '/en/examples/': [
            {
              text: 'Examples',
              items: [
                { text: 'Order Payment', link: '/en/examples/order-payment' }
              ]
            }
          ]
        }
      }
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      themeConfig: {
        nav: [
          { text: '首页', link: '/zh/' },
          { text: '指南', link: '/zh/guide/quick-start-mcp' },
          { text: 'AI Agent', link: '/zh/guide/ai-agent-deployment' },
          { text: 'API 参考', link: '/zh/api/overview' },
          { text: '示例', link: '/zh/examples/order-payment' }
        ],
        sidebar: {
          '/zh/guide/': [
            {
              text: '快速开始',
              items: [
                { text: '介绍', link: '/zh/guide/introduction' },
                { text: 'MCP 快速开始', link: '/zh/guide/quick-start-mcp' },
                { text: 'AI 辅助部署', link: '/zh/guide/ai-agent-deployment' },
                { text: '地址池设置', link: '/zh/guide/address-pool-setup' }
              ]
            },
            {
              text: '核心概念',
              items: [
                { text: '测试网 vs 主网', link: '/zh/guide/testnet-vs-mainnet' },
                { text: '支持的网络', link: '/zh/guide/supported-networks' },
                { text: '支持的代币', link: '/zh/guide/supported-tokens' }
              ]
            },
            {
              text: '核心功能',
              items: [
                { text: '订单支付服务', link: '/zh/guide/order-payment' },
                { text: '充值服务', link: '/zh/guide/deposit-service' },
                { text: '支付链接', link: '/zh/guide/payment-links' },
                { text: 'API 集成', link: '/zh/guide/api-integration' }
              ]
            },
            {
              text: '高级功能',
              items: [
                { text: 'Webhooks', link: '/zh/guide/webhooks' },
                { text: '地址管理', link: '/zh/guide/address-management' },
                { text: '安全指南', link: '/zh/guide/security' }
              ]
            }
          ],
          '/zh/api/': [
            {
              text: 'API 参考',
              items: [
                { text: '概览', link: '/zh/api/overview' }
              ]
            }
          ],
          '/zh/examples/': [
            {
              text: '示例',
              items: [
                { text: '订单支付', link: '/zh/examples/order-payment' }
              ]
            }
          ]
        },
        outlineTitle: '目录',
        returnToTopLabel: '返回顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '深色模式',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        docFooter: {
          prev: '上一页',
          next: '下一页'
        }
      }
    }
  },

  // Theme configuration
  themeConfig: {
    search: {
      provider: 'local'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 PayIn Team'
    }
  },

  // Build configuration
  srcDir: '.',
  outDir: '.vitepress/dist',
  cacheDir: '.vitepress/cache',

  // Markdown configuration
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true
  },

  // Vite configuration
  vite: {
    server: {
      port: 6173
    }
  }
});
