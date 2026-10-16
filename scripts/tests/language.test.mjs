import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequest } from '../../functions/index.js'
import { preferredLanguage, savedLanguage, languagePreferenceCookie, supportedLanguages } from '../../shared/language.mjs'
import { legacyRedirects } from '../../docs/.vitepress/redirects.mts'
import { localeCodes, locales } from '../../docs/.vitepress/locales.mts'

test('browser language routes and published locale definitions stay in sync', () => {
  assert.deepEqual([...supportedLanguages].sort(), [...localeCodes].sort())
  assert.equal(locales['zh-tw'].lang, 'zh-TW')
})

test('language negotiation handles regions, weights, stable ties and unsupported languages', () => {
  for (const [header, expected] of [
    ['', 'en'], ['de-DE,fr;q=0.9', 'en'], ['ja-JP, en;q=0.8', 'ja'],
    ['en;q=0.5,zh-CN;q=0.9,ja;q=0.7', 'zh'], ['JA-jp', 'ja'],
    ['zh-TW,zh;q=0.9', 'zh-tw'], ['ja;q=0.8,en;q=0.8', 'ja'],
    ['ZH-tw', 'zh-tw'], ['zh-Hant', 'zh-tw'], ['zh-Hant-TW', 'zh-tw'],
    ['zh-HK', 'zh-tw'], ['zh-MO', 'zh-tw'], ['zh-Hant-CN', 'zh-tw'],
    ['zh', 'zh'], ['zh-CN', 'zh'], ['zh-SG', 'zh'], ['zh-Hans', 'zh'],
    ['zh-Hans-TW', 'zh'], ['en;q=0.8,zh-TW;q=0.9', 'zh-tw'],
    ['zh-TW;q=0,zh-CN;q=0.9', 'zh'], ['zh-CN;q=0,zh-TW;q=0.9', 'zh-tw'],
    ['en;q=0,zh;q=0,*;q=0.8', 'zh-tw'],
    ['ja;q=0,en;q=0.5', 'en'], ['en;q=0,*;q=0.8', 'zh'],
    ['fr;q=1,ja;q=0.6', 'ja'], ['ja;q=2,zh;q=0.5', 'zh'],
    ['ja;q=oops,en;q=0.5', 'en'], ['not-a-language, *', 'en'],
  ]) assert.equal(preferredLanguage(header), expected, header)
})
test('only a validated exact preference cookie is accepted', () => {
  assert.equal(savedLanguage('session=x; site_language=ja; other=y'), 'ja')
  assert.equal(savedLanguage('site_language=zh-tw'), 'zh-tw')
  assert.equal(savedLanguage('not_site_language=zh'), undefined)
  assert.equal(savedLanguage('site_language=https://example.org'), undefined)
  assert.equal(savedLanguage('site_language=%E0%A4%A'), undefined)
  assert.equal(savedLanguage('site_language=fr; site_language=en'), 'en')
  assert.match(languagePreferenceCookie('zh'), /Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/)
  assert.match(languagePreferenceCookie('zh-tw'), /^site_language=zh-tw;/)
  assert.ok(!languagePreferenceCookie('ja', false).includes('Secure'))
  assert.throws(() => languagePreferenceCookie('fr'))
})
test('root redirects temporarily, preserves query, defaults to English and cannot be publicly cached', async () => {
  for (const method of ['GET', 'HEAD']) {
    const response = await onRequest({ request: new Request('https://example.com/?utm_source=test', { method }) })
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), 'https://example.com/en/?utm_source=test')
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    assert.equal(response.headers.get('Vary'), 'Accept-Language, Cookie')
    assert.match(response.headers.get('Link'), /hreflang="x-default"/)
    assert.match(response.headers.get('Link'), /<https:\/\/example.com\/zh-tw\/>; rel="alternate"; hreflang="zh-TW"/)
    assert.equal(await response.text(), '')
  }
})
test('manual preference beats browser language; inferred language is not saved as a manual choice', async () => {
  const request = new Request('https://example.com/', { headers: { Cookie: 'site_language=zh', 'Accept-Language': 'ja' } })
  const response = await onRequest({ request })
  assert.equal(response.headers.get('Location'), 'https://example.com/zh/')
  assert.equal(response.headers.get('Set-Cookie'), null)
  const japanese = await onRequest({ request: new Request('https://example.com/', { headers: { 'Accept-Language': 'ja-JP' } }) })
  assert.equal(japanese.headers.get('Location'), 'https://example.com/ja/')
  const taiwan = await onRequest({ request: new Request('https://example.com/?source=test', { headers: { 'Accept-Language': 'zh-TW' } }) })
  assert.equal(taiwan.headers.get('Location'), 'https://example.com/zh-tw/?source=test')
  const manual = await onRequest({ request: new Request('https://example.com/', { headers: { Cookie: 'site_language=zh-tw', 'Accept-Language': 'en' } }) })
  assert.equal(manual.headers.get('Location'), 'https://example.com/zh-tw/')
})
test('explicit URLs, static assets and non-navigation methods are never language redirected', async () => {
  for (const [path, method] of [['/en/', 'GET'], ['/ja/tutorial/first-steps', 'GET'], ['/zh/', 'GET'], ['/zh-tw/', 'GET'], ['/zh-tw/tutorial/first-steps', 'GET'], ['/logo.png', 'GET'], ['/', 'POST'], ['/', 'OPTIONS']]) {
    const sentinel = new Response('static', { status: 200 })
    const result = await onRequest({ request: new Request('https://example.com' + path, { method, headers: { 'Accept-Language': 'ja', Cookie: 'site_language=zh' } }), next: () => sentinel })
    assert.equal(result, sentinel)
  }
})
test('legacy redirects map real Chinese pages to their exact new counterparts', () => {
  const redirects = legacyRedirects(['index.md', 'zh/index.md', 'zh/tutorial/index.md', 'zh/tutorial/first-steps.md', 'en/tutorial/first-steps.md'])
  assert.ok(redirects.includes('/tutorial/first-steps /zh/tutorial/first-steps 301'))
  assert.ok(redirects.includes('/tutorial/first-steps.html /zh/tutorial/first-steps 301'))
  assert.ok(redirects.includes('/tutorial /zh/tutorial/ 301'))
  assert.ok(redirects.includes('/tutorial/ /zh/tutorial/ 301'))
  assert.ok(!redirects.some(line => line.startsWith('/ ') || line.startsWith('/en/') || line.includes('*')))
})
