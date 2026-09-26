import test from 'node:test'
import assert from 'node:assert/strict'
import { preferredLanguage, languageRedirect } from '../../docs/.vitepress/theme/locale-preference.mjs'

test('manual choice overrides browser language, while invalid saved values are ignored', () => {
  assert.equal(preferredLanguage(['zh-CN'], 'en'), 'en')
  assert.equal(preferredLanguage(['en-US'], 'zh-CN'), 'zh-CN')
  assert.equal(preferredLanguage(['zh-TW'], 'unsupported'), 'zh-CN')
})
test('browser languages keep their priority, with English as the fallback', () => {
  assert.equal(preferredLanguage(['en-US', 'zh-CN']), 'en')
  assert.equal(preferredLanguage(['zh-HK', 'en-US']), 'zh-CN')
  assert.equal(preferredLanguage(['fr-FR', 'zh-CN']), 'zh-CN')
  assert.equal(preferredLanguage(['de-DE']), 'en')
  assert.equal(preferredLanguage([]), 'en')
})
for (const base of ['/', '/aspnetcore-first-steps/']) {
test(`only the entry homepage redirects under ${base}; explicit language and chapter links remain intact`, () => {
  assert.equal(languageRedirect(base, base, 'en'), base + 'en/')
  assert.equal(languageRedirect(base + 'index.html', base, 'en'), base + 'en/')
  assert.equal(languageRedirect(base.slice(0, -1), base, 'en'), base + 'en/')
  assert.equal(languageRedirect(base, base, 'zh-CN'), null)
  assert.equal(languageRedirect(base + 'tutorial/testing', base, 'en'), null)
  assert.equal(languageRedirect(base + 'en/', base, 'zh-CN'), null)
  assert.equal(languageRedirect(base + 'en/tutorial/testing', base, 'zh-CN'), null)
})
}
