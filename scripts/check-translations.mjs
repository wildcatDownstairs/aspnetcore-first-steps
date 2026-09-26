import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative, join } from 'node:path'

const root = resolve('docs')
async function pages(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.filter(e => !e.name.startsWith('.') && e.name !== 'public')
    .map(e => e.isDirectory() ? pages(join(directory, e.name)) : e.name.endsWith('.md') ? [join(directory, e.name)] : []))
  return files.flat()
}
const all = await pages(root)
const source = all.filter(p => !relative(root, p).replaceAll('\\', '/').startsWith('en/'))
const failures = []
const imports = text => [...text.matchAll(/^<<<\s+(\S+)/gm)].map(m => m[1])
const headings = text => [...text.matchAll(/^#{1,6} /gm)].length
for (const file of source) {
  const name = relative(root, file)
  const translated = join(root, 'en', name)
  if (!all.includes(translated)) { failures.push(`Missing English page: ${name}`); continue }
  const [zh, en] = await Promise.all([readFile(file, 'utf8'), readFile(translated, 'utf8')])
  if (JSON.stringify(imports(zh)) !== JSON.stringify(imports(en))) failures.push(`Sample imports or highlights differ: ${name}`)
  if (headings(zh) !== headings(en)) failures.push(`Section count differs; check for omitted or duplicated sections: ${name}`)
  for (const match of en.matchAll(/(?:\]\(|\blink:\s*|\bhref=["'])(\/(?:tutorial|advanced|about|fastapi-cheatsheet|efcore-sql-cheatsheet)(?:[^\s)"']*))/g)) {
    failures.push(`English link points to Chinese page: ${name}: ${match[1]}`)
  }
}
for (const file of all.filter(p => relative(root, p).replaceAll('\\', '/').startsWith('en/'))) {
  const name = relative(join(root, 'en'), file)
  if (!source.includes(join(root, name))) failures.push(`English page has no Chinese source: ${name}`)
}
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else console.log(`Checked ${source.length} Chinese/English page pairs: coverage, sample imports, section counts, and locale links.`)
