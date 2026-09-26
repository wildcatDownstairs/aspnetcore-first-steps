import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { siteOrigin as origin } from '../docs/.vitepress/seo.mts'

// 检查最终 HTML，而非仅检查配置，防止 SSR、语言合并和标题模板造成重复或缺失。
const root = resolve('docs/.vitepress/dist')
async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? htmlFiles(join(dir, entry.name))
    : entry.name.endsWith('.html') ? [join(dir, entry.name)] : []))).flat()
}
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]))
const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8')
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1])
const canonicals = []
const titles = new Set()
const descriptions = new Set()
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
  const english = name.startsWith('en/')
  const path = '/' + name.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '')
  const url = origin + path
  assert.equal(one('rel', 'canonical', 'href'), url, `${name}: canonical`)
  canonicals.push(url)
  assert.equal(html.match(/<html[^>]*lang="([^"]+)"/)?.[1], english ? 'en' : 'zh-CN', `${name}: lang`)
  const title = decode(head.match(/<title>(.*?)<\/title>/s)?.[1] || '')
  const description = decode(one('name', 'description'))
  assert.ok(title && !titles.has(title), `${name}: missing or duplicate title`)
  assert.ok(description && !descriptions.has(description), `${name}: missing or duplicate description`)
  titles.add(title)
  descriptions.add(description)
  const sourcePath = path.replace(/^\/en\//, '/')
  assert.equal(one('hreflang', 'zh-CN', 'href'), origin + sourcePath)
  assert.equal(one('hreflang', 'en', 'href'), origin + '/en' + sourcePath)
  assert.equal(decode(one('property', 'og:title')), title)
  assert.equal(decode(one('property', 'og:description')), description)
  assert.equal(one('property', 'og:url'), url)
  assert.equal(one('property', 'og:locale'), english ? 'en_US' : 'zh_CN')
  assert.equal(decode(one('name', 'twitter:title')), title)
  assert.equal(decode(one('name', 'twitter:description')), description)
  assert.ok(!tags.some(t => t.name === 'robots' && t.content.includes('noindex')), `${name}: unexpected noindex`)
  const data = JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || 'null')
  assert.equal(data?.url, url, `${name}: structured data URL`)
  assert.equal(data?.inLanguage, english ? 'en' : 'zh-CN')
  assert.equal(data?.description, description)
  assert.ok(!html.includes('href="/aspnetcore-first-steps/'), `${name}: old deployment prefix`)
}
assert.ok(canonicals.length > 0, 'No pages checked')
assert.deepEqual([...sitemapUrls].sort(), [...canonicals].sort(), 'Sitemap must match all indexable canonical URLs')
for (const entry of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  assert.match(entry[1], /hreflang="zh-CN"/)
  assert.match(entry[1], /hreflang="en"/)
}
const robots = await readFile(join(root, 'robots.txt'), 'utf8')
assert.match(robots, /User-agent: \*\nAllow: \/\n/)
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`))
console.log(`Checked SEO for ${canonicals.length} pages: unique titles/descriptions, canonical, language alternatives, sharing metadata, structured data, sitemap and robots.txt.`)
