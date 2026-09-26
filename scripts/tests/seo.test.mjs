import test from 'node:test'
import assert from 'node:assert/strict'
import { applySeo, pagePath } from '../../docs/.vitepress/seo.mts'

test('canonical routes distinguish directory homepages from clean chapter URLs', () => {
  assert.equal(pagePath('index.md'), '/')
  assert.equal(pagePath('en/index.md'), '/en/')
  assert.equal(pagePath('tutorial/index.md'), '/tutorial/')
  assert.equal(pagePath('en/tutorial/first-steps.md'), '/en/tutorial/first-steps')
})

test('untranslated pages do not advertise nonexistent language alternatives', () => {
  const page = { relativePath: 'tutorial/new.md', title: '新章节', description: '章节说明', frontmatter: {} }
  applySeo(page, ['tutorial/new.md'])
  const alternatives = page.frontmatter.head.filter(([tag, attrs]) => tag === 'link' && attrs.rel === 'alternate')
  assert.deepEqual(alternatives.map(([, attrs]) => attrs.hreflang), ['zh-CN'])
})

test('structured data safely escapes HTML while preserving the description', () => {
  const description = 'Example </script><script>alert(1)</script>'
  const page = { relativePath: 'en/about.md', title: 'About', description, frontmatter: {} }
  applySeo(page, ['about.md', 'en/about.md'])
  const json = page.frontmatter.head.find(([tag]) => tag === 'script')[2]
  assert.ok(!json.includes('</script>'))
  assert.equal(JSON.parse(json).description, description)
  assert.equal(JSON.parse(json).inLanguage, 'en')
})
