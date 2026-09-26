import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pagePath } from './seo.mts'

// 从真实中文页面生成精确映射，避免通配符把拼错的地址重定向到不存在的页面。
export function legacyRedirects(pages: string[]) {
  return pages.filter(page => page.startsWith('zh/') && page !== 'zh/index.md').flatMap(page => {
    const oldFile = page.slice(3)
    const from = pagePath(oldFile)
    const to = pagePath(page)
    const aliases = [from, '/' + oldFile.replace(/\.md$/, '.html')]
    if (from.endsWith('/')) aliases.push(from.slice(0, -1))
    return aliases.map(alias => `${alias} ${to} 301`)
  }).sort()
}
export async function writeLegacyRedirects(outDir: string, pages: string[]) {
  await writeFile(join(outDir, '_redirects'), '# 旧中文地址永久迁移；根路径由 Pages Function 处理。\n' + legacyRedirects(pages).join('\n') + '\n')
}
