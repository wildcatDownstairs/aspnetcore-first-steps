import { defineConfig } from 'vitepress'
import container from 'markdown-it-container'
import cjkFriendly from 'markdown-it-cjk-friendly'
import { nav, tutorialSidebar, englishNav, englishSidebar } from './nav'

// CI 中由 GitHub Actions 自动提供（owner/repo），本地开发时为空，相关链接会隐藏
const repo = process.env.GITHUB_REPOSITORY
const repoUrl = repo ? `https://github.com/${repo}` : ''

// 中文分词：MiniSearch 默认按空白切词，对中文几乎无效，改用 Intl.Segmenter。
// 注意：VitePress 会把这个函数按源码序列化到浏览器端，所以它不能引用外部变量。
function tokenize(text: string): string[] {
  const g = globalThis as any
  g.__zhSegmenter ??= new Intl.Segmenter('zh-CN', { granularity: 'word' })
  const out: string[] = []
  for (const s of g.__zhSegmenter.segment(text)) if (s.isWordLike) out.push(s.segment)
  return out
}

export default defineConfig({
  lang: 'zh-CN',
  title: 'ASP.NET Core 第一步',
  description: '写给有编程经验者的中文 ASP.NET Core 渐进式教程：.NET 10 + Minimal API，从第一个接口到数据库、认证、测试与部署。',
  base: '/aspnetcore-first-steps/',
  cleanUrls: true,
  locales: {
    root: { label: '简体中文', lang: 'zh-CN' },
    en: {
      label: 'English', lang: 'en', title: 'ASP.NET Core First Steps',
      description: 'A step-by-step ASP.NET Core tutorial for developers new to C#: .NET 10, Minimal APIs, EF Core, authentication, testing, and deployment.',
      head: [['meta', { property: 'og:locale', content: 'en_US' }]],
      themeConfig: {
        nav: englishNav,
        sidebar: { '/en/tutorial/': englishSidebar },
        outline: { level: [2, 3], label: 'On this page' },
        docFooter: { prev: 'Previous page', next: 'Next page' },
        lastUpdated: { text: 'Last updated' },
        editLink: repoUrl ? { pattern: `${repoUrl}/edit/main/docs/:path`, text: 'Edit this page on GitHub' } : undefined,
        darkModeSwitchLabel: 'Appearance', lightModeSwitchTitle: 'Switch to light theme',
        darkModeSwitchTitle: 'Switch to dark theme', sidebarMenuLabel: 'Contents',
        returnToTopLabel: 'Back to top', langMenuLabel: 'Change language',
        notFound: { title: 'Page not found', quote: 'This page may have moved, or the address may be incorrect.', linkLabel: 'Go home', linkText: 'Go home' },
        footer: { message: 'Built with .NET 10 and Minimal APIs · Runnable examples in every chapter', copyright: 'Original writing and sample code' },
      },
    },
  },
  lastUpdated: true,
  srcExclude: ['README.md'],
  // 教程里有大量 http://localhost:5080 链接，它们只在读者本机运行示例时有效
  ignoreDeadLinks: 'localhostLinks',

  // 开发服务器端口：优先使用环境变量 PORT（便于工具分配空闲端口），否则用 Vite 默认值
  vite: {
    server: { port: process.env.PORT ? Number(process.env.PORT) : undefined },
  },

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/aspnetcore-first-steps/logo.png' }],
    ['meta', { name: 'theme-color', content: '#512bd4' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
  ],

  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
    config(md) {
      // 让 **加粗** 在中文标点旁也能正确闭合，例如 **为什么？**因为……
      // （CommonMark 原规则要求闭合的 ** 后面是空格或标点，中文正文通常不满足）
      md.use(cjkFriendly)

      // 独立代码块（不在 code-group 中）也显示文件名标题：
      // VitePress 默认只在 code-group 的标签页上显示 [title]
      const fence = md.renderer.rules.fence!
      md.renderer.rules.fence = (tokens, idx, ...rest) => {
        const title = tokens[idx].info.match(/\[(.+)\]/)?.[1]
        let depth = 0
        for (let i = idx - 1; i >= 0; i--) {
          if (tokens[i].type === 'container_code-group_close') depth--
          if (tokens[i].type === 'container_code-group_open' && ++depth > 0) break
        }
        const html = fence(tokens, idx, ...rest)
        if (!title || depth > 0) return html
        return `<div class="code-titled"><div class="code-title">${md.utils.escapeHtml(title)}</div>${html}</div>`
      }

      // "FastAPI 对照"提示框：::: fastapi [可选标题]
      md.use(container, 'fastapi', {
        render(tokens: any[], idx: number) {
          const token = tokens[idx]
          if (token.nesting === 1) {
            const title = token.info.trim().slice('fastapi'.length).trim() || 'FastAPI 对照'
            return `<div class="fastapi custom-block"><p class="custom-block-title">${md.utils.escapeHtml(title)}</p>\n`
          }
          return '</div>\n'
        },
      })
    },
  },

  themeConfig: {
    logo: '/logo.png',
    nav,
    sidebar: {
      '/tutorial/': tutorialSidebar,
    },

    socialLinks: repoUrl ? [{ icon: 'github', link: repoUrl }] : [],
    editLink: repoUrl
      ? { pattern: `${repoUrl}/edit/main/docs/:path`, text: '在 GitHub 上编辑此页' }
      : undefined,

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdated: { text: '最后更新于' },
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    langMenuLabel: '语言',
    notFound: {
      title: '页面不存在',
      quote: '这个地址没有对应的页面，可能章节还没写完，或者链接有误。',
      linkLabel: '返回首页',
      linkText: '返回首页',
    },

    footer: {
      message: '基于 .NET 10 与 Minimal API · 所有示例均可直接 <code>dotnet run</code>',
      copyright: '文字与示例代码均为原创',
    },

    search: {
      provider: 'local',
      options: {
        locales: {
          en: { translations: {
            button: { buttonText: 'Search tutorials…', buttonAriaLabel: 'Search tutorials' },
            modal: {
              displayDetails: 'Display detailed list', resetButtonTitle: 'Clear search',
              backButtonTitle: 'Close search', noResultsText: 'No results found',
              footer: { selectText: 'Select', navigateText: 'Navigate', closeText: 'Close' },
            },
          } },
        },
        miniSearch: {
          options: { tokenize },
          searchOptions: { fuzzy: 0.1, prefix: true, combineWith: 'AND', tokenize },
        },
        translations: {
          button: { buttonText: '搜索教程…', buttonAriaLabel: '搜索' },
          modal: {
            displayDetails: '显示详细列表',
            resetButtonTitle: '清除',
            backButtonTitle: '关闭搜索',
            noResultsText: '没有找到相关结果',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭',
            },
          },
        },
      },
    },
  },
})
