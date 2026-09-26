import test from 'node:test'
import assert from 'node:assert/strict'
import { applySeo, pagePath } from '../../docs/.vitepress/seo.mts'

test('canonical routes distinguish directory homepages from clean chapter URLs', () => {
  assert.equal(pagePath('index.md'), '/')
  assert.equal(pagePath('en/index.md'), '/en/')
  assert.equal(pagePath('zh/tutorial/index.md'), '/zh/tutorial/')
  assert.equal(pagePath('ja/index.md'), '/ja/')
  assert.equal(pagePath('en/tutorial/first-steps.md'), '/en/tutorial/first-steps')
})

test('untranslated pages do not advertise nonexistent language alternatives', () => {
  const page = { relativePath: 'zh/tutorial/new.md', title: '新章节', description: '章节说明', frontmatter: {} }
  applySeo(page, ['zh/tutorial/new.md'])
  const alternatives = page.frontmatter.head.filter(([tag, attrs]) => tag === 'link' && attrs.rel === 'alternate')
  assert.deepEqual(alternatives.map(([, attrs]) => attrs.hreflang), ['zh-CN'])
})

test('structured data safely escapes HTML while preserving the description', () => {
  const description = 'Example </script><script>alert(1)</script>'
  const page = { relativePath: 'en/about.md', title: 'About', description, frontmatter: {} }
  applySeo(page, ['zh/about.md', 'en/about.md', 'ja/about.md'])
  const json = page.frontmatter.head.find(([tag]) => tag === 'script')[2]
  assert.ok(!json.includes('</script>'))
  assert.equal(JSON.parse(json).description, description)
  assert.equal(JSON.parse(json).inLanguage, 'en')
})

test('three language variants have self canonicals and reciprocal alternatives', () => {
  const pages = ['zh/about.md', 'en/about.md', 'ja/about.md']
  for (const file of pages) {
    const page = { relativePath: file, title: 'About', description: 'Description', frontmatter: {} }
    applySeo(page, pages)
    const links = page.frontmatter.head.filter(([tag]) => tag === 'link').map(([, attrs]) => attrs)
    assert.ok(links.find(link => link.rel === 'canonical').href.endsWith('/' + file.replace('.md', '')))
    assert.deepEqual(links.filter(link => link.rel === 'alternate').map(link => link.hreflang), ['zh-CN', 'en', 'ja', 'x-default'])
    assert.ok(links.find(link => link.hreflang === 'x-default').href.endsWith('/en/about'))
  }
})

test('homepage x-default is the edge entry and the static fallback canonical is English', () => {
  const pages = ['index.md', 'zh/index.md', 'en/index.md', 'ja/index.md']
  for (const file of pages) {
    const page = { relativePath: file, title: 'Home', description: 'Description', frontmatter: {} }
    applySeo(page, pages)
    const links = page.frontmatter.head.filter(([tag]) => tag === 'link').map(([, attrs]) => attrs)
    assert.equal(new URL(links.find(link => link.hreflang === 'x-default').href).pathname, '/')
    if (file === 'index.md') assert.equal(new URL(links.find(link => link.rel === 'canonical').href).pathname, '/en/')
  }
})
