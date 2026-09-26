import type { HeadConfig, PageData } from 'vitepress'

export const siteOrigin = 'https://aspnetcore-first-steps.pages.dev'

// 与 cleanUrls 保持一致：目录首页保留斜杠，章节页面不带 .html。
export function pagePath(relativePath: string) {
  return '/' + relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
}

export function applySeo(page: PageData, pages: string[]) {
  const english = page.relativePath.startsWith('en/')
  const siteName = english ? 'ASP.NET Core First Steps' : 'ASP.NET Core 第一步'
  const canonical = siteOrigin + pagePath(page.relativePath)
  const source = page.relativePath.replace(/^en\//, '')
  const title = page.titleTemplate === false ? page.title
    : page.title === siteName && !page.titleTemplate ? siteName
    : `${page.title} | ${page.titleTemplate || siteName}`
  const lang = english ? 'en' : 'zh-CN'
  const home = source === 'index.md'
  const head: HeadConfig[] = [
    ['link', { rel: 'canonical', href: canonical }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: siteName }],
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:description', content: page.description }],
    ['meta', { property: 'og:url', content: canonical }],
    ['meta', { property: 'og:locale', content: english ? 'en_US' : 'zh_CN' }],
    ['meta', { property: 'og:locale:alternate', content: english ? 'zh_CN' : 'en_US' }],
    ['meta', { property: 'og:image', content: `${siteOrigin}/logo.png` }],
    ['meta', { property: 'og:image:alt', content: siteName }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: title }],
    ['meta', { name: 'twitter:description', content: page.description }],
    ['meta', { name: 'twitter:image', content: `${siteOrigin}/logo.png` }],
    ['meta', { name: 'twitter:image:alt', content: siteName }],
  ]
  // 只声明确实存在的翻译，避免以后新增单语言页面时生成无效链接。
  for (const [hreflang, file] of [['zh-CN', source], ['en', `en/${source}`]]) {
    if (pages.includes(file)) {
      head.push(['link', { rel: 'alternate', hreflang, href: siteOrigin + pagePath(file) }])
    }
  }
  const website = siteOrigin + (english ? '/en/' : '/')
  head.push(['script', { type: 'application/ld+json' }, JSON.stringify({
    '@context': 'https://schema.org',
    '@type': home ? 'WebSite' : 'WebPage',
    '@id': canonical + (home ? '#website' : '#webpage'),
    url: canonical,
    name: home ? siteName : title,
    description: page.description,
    inLanguage: lang,
    ...(home ? {} : { isPartOf: { '@id': website + '#website' } }),
  }).replace(/</g, '\\u003c')])
  // 放进页面数据，使客户端路由切换时也会更新 canonical 和分享元信息。
  page.frontmatter.head = [...(page.frontmatter.head || []), ...head]
}
