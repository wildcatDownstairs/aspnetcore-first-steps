export const supportedLanguages = ['en', 'zh', 'ja']
export const languageCookie = 'site_language'

export function savedLanguage(cookie = '') {
  for (const part of cookie.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === languageCookie && supportedLanguages.includes(value.join('='))) return value.join('=')
  }
}

// 按权重匹配已发布语言；地区变体归入对应语言，无匹配时默认英文。
export function preferredLanguage(header = '') {
  const ranges = header.split(',').flatMap((part, order) => {
    const match = part.trim().match(/^(\*|[a-z]{1,8}(?:-[a-z0-9]{1,8})*)(?:\s*;\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?$/i)
    return match ? [{ code: match[1].toLowerCase().split('-')[0], quality: Number(match[2] ?? 1), order }] : []
  })
  const explicit = new Set(ranges.map(range => range.code))
  for (const range of ranges.filter(range => range.quality > 0).sort((a, b) => b.quality - a.quality || a.order - b.order)) {
    if (supportedLanguages.includes(range.code)) return range.code
    if (range.code === '*') {
      const available = supportedLanguages.find(code => !explicit.has(code))
      if (available) return available
    }
  }
  return 'en'
}

export function languagePreferenceCookie(code, secure = true) {
  if (!supportedLanguages.includes(code)) throw new Error('Unsupported language')
  return `${languageCookie}=${code}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? '; Secure' : ''}`
}
