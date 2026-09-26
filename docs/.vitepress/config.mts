import { defineConfig, type HeadConfig } from 'vitepress'
import container from 'markdown-it-container'
import cjkFriendly from 'markdown-it-cjk-friendly'
import { localeConfig, searchTranslations } from './locale-config.mts'
import { localeCodes, locales } from './locales.mts'
import { writeLegacyRedirects } from './redirects.mts'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { applySeo, siteOrigin } from './seo.mts'

// 本地预览与 Pages 未配置环境变量时也显示仓库入口；fork 可通过环境变量覆盖。
const repo = process.env.GITHUB_REPOSITORY?.trim() || 'wildcatDownstairs/aspnetcore-first-steps'
const repoUrl = `https://github.com/${repo}`

// 中日文不能只按空白分词；Intl.Segmenter 同时处理 CJK 与英文。
// 注意：VitePress 会把这个函数按源码序列化到浏览器端，所以它不能引用外部变量。
function tokenize(text: string): string[] {
  const g = globalThis as any
  g.__cjkSegmenter ??= new Intl.Segmenter('ja', { granularity: 'word' })
  const out: string[] = []
  for (const s of g.__cjkSegmenter.segment(text)) if (s.isWordLike) out.push(s.segment)
  return out
}

export default defineConfig({
  lang: locales.en.lang,
  title: locales.en.title,
  description: locales.en.description,
  base: '/',
  cleanUrls: true,
  sitemap: {
    hostname: siteOrigin,
    transformItems: items => items.filter(item => /^(zh|en|ja)\//.test(item.url)).map(item => ({
      ...item,
      // VitePress 会把根入口也归为英文；剔除该重复项后补上 x-default。
      links: [
        ...(item.links || []).filter(link => /^(zh|en|ja)\//.test(link.url)),
        { lang: 'x-default', url: /^(zh|en|ja)\/$/.test(item.url) ? '/' : item.url.replace(/^(zh|ja)\//, 'en/') },
      ],
    })),
  },
  transformPageData(pageData, { siteConfig }) {
    applySeo(pageData, siteConfig.pages)
  },
  transformHead({ page, description }) {
    // VitePress 1.x 的默认描述直接插入 HTML；经 head 序列化才能正确转义引号。
    const head: HeadConfig[] = [['meta', { name: 'description', content: description }]]
    if (page === '404.md') head.push(['meta', { name: 'robots', content: 'noindex, follow' }])
    return head
  },
  async buildEnd({ outDir, pages }) {
    await writeLegacyRedirects(outDir, pages)
    await writeFile(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin}/sitemap.xml\n`)
  },
  locales: {
    root: localeConfig('en', repoUrl),
    ...Object.fromEntries(localeCodes.map(code => [code, localeConfig(code, repoUrl)])),
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
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#512bd4' }],
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
    ...localeConfig('en', repoUrl).themeConfig,
    logo: '/logo.png',
    socialLinks: [{ icon: 'github', link: repoUrl }],
    search: {
      provider: 'local',
      options: {
        translations: searchTranslations.en,
        locales: Object.fromEntries(localeCodes.map(code => [code, { translations: searchTranslations[code] }])),
        miniSearch: {
          options: { tokenize },
          searchOptions: { fuzzy: 0.1, prefix: true, combineWith: 'AND', tokenize },
        },
      },
    },
  },
})
