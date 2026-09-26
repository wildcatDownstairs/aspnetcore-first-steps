import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { siteOrigin as origin } from '../docs/.vitepress/seo.mts'
import { localeCodes, localeForPath, locales } from '../docs/.vitepress/locales.mts'

// 检查最终 HTML，而非仅检查配置，覆盖 SSR、语言合并与站点地图。
const root = resolve('docs/.vitepress/dist')
async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? htmlFiles(join(dir, entry.name)) : entry.name.endsWith('.html') ? [join(dir, entry.name)] : []))).flat()
}
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]))
const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8')
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1])
const canonicals = []
const titles = new Set()
const descriptions = new Set()
const documents = new Map()
for (const file of await htmlFiles(root)) {
  const name = relative(root, file).replaceAll('\\', '/')
  const html = await readFile(file, 'utf8')
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1]
  assert.ok(head, `${name}: missing head`)
  const tags = [...head.matchAll(/<(?:link|meta)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/g)].map(m => attributes(m[0]))
  if (name === '404.html') {
    assert.ok(tags.some(t => t.name === 'robots' && t.content.includes('noindex')), '404 must not be indexed')
    continue
  }
  const one = (key, value, attr = 'content') => {
    const found = tags.filter(t => t[key] === value)
    assert.equal(found.length, 1, `${name}: expected exactly one ${value}`)
    assert.ok(found[0][attr], `${name}: empty ${value}`)
    return found[0][attr]
  }
  if (name === 'index.html') {
    assert.equal(one('rel', 'canonical', 'href'), origin + '/en/')
    assert.equal(one('http-equiv', 'refresh'), '0;url=/en/')
    continue
  }
  const code = localeForPath(name)
  const locale = locales[code]
  const path = '/' + name.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '')
  const url = origin + path
  assert.equal(one('rel', 'canonical', 'href'), url, `${name}: canonical`)
  canonicals.push(url)
  assert.equal(html.match(/<html[^>]*lang="([^"]+)"/)?.[1], locale.lang, `${name}: lang`)
  const title = decode(head.match(/<title>(.*?)<\/title>/s)?.[1] || '')
  const description = decode(one('name', 'description'))
  assert.ok(title && !titles.has(title), `${name}: missing or duplicate title`)
  assert.ok(description && !descriptions.has(description), `${name}: missing or duplicate description`)
  titles.add(title)
  descriptions.add(description)
  const sourcePath = path.replace(/^\/(zh|en|ja)\//, '/')
  for (const alternative of localeCodes) assert.equal(one('hreflang', locales[alternative].lang, 'href'), origin + '/' + alternative + sourcePath)
  assert.equal(one('hreflang', 'x-default', 'href'), origin + (sourcePath === '/' ? '/' : '/en' + sourcePath))
  assert.equal(decode(one('property', 'og:title')), title)
  assert.equal(decode(one('property', 'og:description')), description)
  assert.equal(one('property', 'og:url'), url)
  assert.equal(one('property', 'og:locale'), locale.og)
  assert.equal(decode(one('name', 'twitter:title')), title)
  assert.equal(decode(one('name', 'twitter:description')), description)
  assert.ok(!tags.some(t => t.name === 'robots' && t.content.includes('noindex')), `${name}: unexpected noindex`)
  const data = JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || 'null')
  assert.equal(data?.url, url, `${name}: structured data URL`)
  assert.equal(data?.inLanguage, locale.lang)
  assert.equal(data?.description, description)
  assert.ok(!html.includes('href="/aspnetcore-first-steps/'), `${name}: old deployment prefix`)
  documents.set(path, { html, name, ids: new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => decode(m[1]))) })
}
assert.ok(canonicals.length > 0, 'No pages checked')
assert.deepEqual([...sitemapUrls].sort(), [...canonicals].sort(), 'Sitemap must match all indexable canonical URLs')
for (const entry of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  for (const lang of ['zh-CN', 'en', 'ja', 'x-default']) {
    assert.equal([...entry[1].matchAll(new RegExp(`hreflang="${lang}"`, 'g'))].length, 1, `sitemap: ${lang} must occur once`)
  }
}
// 检查正文、导航、语言切换的内部页面和锚点，捕获翻译后标题变化引起的死链。
for (const [path, doc] of documents) {
  for (const match of doc.html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    const url = new URL(decode(match[1]), origin + path)
    if (url.origin !== origin || url.pathname === '/') continue
    if (!/^\/(zh|en|ja)(\/|$)/.test(url.pathname)) {
      assert.ok(!/^\/(tutorial|advanced|about|fastapi-cheatsheet|efcore-sql-cheatsheet)(\/|$)/.test(url.pathname), `${doc.name}: old Chinese link ${url.pathname}`)
      continue
    }
    const target = documents.get(url.pathname) || documents.get(url.pathname + '/')
    assert.ok(target, `${doc.name}: missing target ${url.pathname}`)
    if (url.hash) assert.ok(target.ids.has(decodeURIComponent(url.hash.slice(1))), `${doc.name}: missing anchor ${url.pathname}${url.hash}`)
  }
}
const robots = await readFile(join(root, 'robots.txt'), 'utf8')
assert.match(robots, /User-agent: \*\nAllow: \/\n/)
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`))
const routes = JSON.parse(await readFile(join(root, '_routes.json'), 'utf8'))
assert.deepEqual(routes, { version: 1, include: ['/'], exclude: [] })
const redirects = await readFile(join(root, '_redirects'), 'utf8')
for (const path of documents.keys()) {
  if (!path.startsWith('/zh/') || path === '/zh/') continue
  assert.ok(redirects.includes(`${path.slice(3)} ${path} 301`), `Missing legacy redirect for ${path}`)
}
console.log(`Checked SEO and internal links for ${canonicals.length} pages: metadata, language alternatives, anchors, sitemap, robots, root-only Functions and legacy redirects.`)
