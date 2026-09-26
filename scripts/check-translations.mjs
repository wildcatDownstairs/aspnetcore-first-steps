import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative, join } from 'node:path'

const root = resolve('docs')
async function pages(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(e => e.isDirectory() ? pages(join(directory, e.name)) : e.name.endsWith('.md') ? [join(directory, e.name)] : []))).flat()
}
const source = await pages(join(root, 'zh'))
const failures = []
const imports = text => [...text.matchAll(/^<<<\s+(\S+)/gm)].map(m => m[1])
const headings = text => [...text.matchAll(/^#{1,6} /gm)].length
for (const language of ['zh', 'en', 'ja']) {
  const translatedPages = await pages(join(root, language))
  for (const file of source) {
    const name = relative(join(root, 'zh'), file)
    const translated = join(root, language, name)
    if (!translatedPages.includes(translated)) { failures.push(`Missing ${language} page: ${name}`); continue }
    const [zh, text] = await Promise.all([readFile(file, 'utf8'), readFile(translated, 'utf8')])
    if (JSON.stringify(imports(zh)) !== JSON.stringify(imports(text))) failures.push(`Sample imports or highlights differ: ${language}/${name}`)
    if (headings(zh) !== headings(text)) failures.push(`Section count differs; check for omitted or duplicated sections: ${language}/${name}`)
    for (const match of text.matchAll(/(?:\]\(|\blink:\s*|\bhref=["'])(\/(?:zh\/|en\/|ja\/)?(?:tutorial|advanced|about|fastapi-cheatsheet|efcore-sql-cheatsheet)(?:[^\s)"']*))/g)) {
      if (!match[1].startsWith(`/${language}/`)) failures.push(`Link leaves its language: ${language}/${name}: ${match[1]}`)
    }
  }
  for (const file of translatedPages) {
    const name = relative(join(root, language), file)
    if (!source.includes(join(root, 'zh', name))) failures.push(`${language} page has no Chinese source: ${name}`)
  }
}
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else console.log(`Checked ${source.length} Chinese/English/Japanese page groups: coverage, sample imports, section counts, and locale links.`)
