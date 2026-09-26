import type { HeadConfig, PageData } from 'vitepress'
import { localeCodes, localeForPath, locales } from './locales.mts'

export const siteOrigin = 'https://aspnetcore-first-steps.pages.dev'

// 与 cleanUrls 保持一致：目录首页保留斜杠，章节页面不带 .html。
export function pagePath(relativePath: string) {
  return '/' + relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
}

export function applySeo(page: PageData, pages: string[]) {
  const code = localeForPath(page.relativePath)
  const locale = locales[code]
  const siteName = locale.title
  const entry = page.relativePath === 'index.md'
  const canonical = siteOrigin + (entry ? '/en/' : pagePath(page.relativePath))
  const source = page.relativePath.replace(/^(zh|en|ja)\//, '')
  const title = page.titleTemplate === false ? page.title
    : page.title === siteName && !page.titleTemplate ? siteName
    : `${page.title} | ${page.titleTemplate || siteName}`
  const lang = locale.lang
  const home = source === 'index.md'
  const head: HeadConfig[] = [
    ['link', { rel: 'canonical', href: canonical }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: siteName }],
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:description', content: page.description }],
    ['meta', { property: 'og:url', content: canonical }],
    ['meta', { property: 'og:locale', content: locale.og }],
    ['meta', { property: 'og:image', content: `${siteOrigin}/logo.png` }],
    ['meta', { property: 'og:image:alt', content: siteName }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: title }],
    ['meta', { name: 'twitter:description', content: page.description }],
    ['meta', { name: 'twitter:image', content: `${siteOrigin}/logo.png` }],
    ['meta', { name: 'twitter:image:alt', content: siteName }],
  ]
  // 只声明确实存在的翻译，避免以后新增单语言页面时生成无效链接。
  for (const alternative of localeCodes) {
    const file = `${alternative}/${source}`
    if (pages.includes(file)) {
      head.push(['link', { rel: 'alternate', hreflang: locales[alternative].lang, href: siteOrigin + pagePath(file) }])
      if (alternative !== code) head.push(['meta', { property: 'og:locale:alternate', content: locales[alternative].og }])
    }
  }
  // 首页的默认入口负责语言协商，章节的默认版本是对应英文页。
  if (home || pages.includes(`en/${source}`)) {
    head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: siteOrigin + (home ? '/' : pagePath(`en/${source}`)) }])
  }
  const website = `${siteOrigin}/${code}/`
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
