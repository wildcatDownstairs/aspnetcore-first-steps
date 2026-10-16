export const supportedLanguages = ['en', 'zh', 'zh-tw', 'ja']
export const languageCookie = 'site_language'

export function savedLanguage(cookie = '') {
  for (const part of cookie.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === languageCookie && supportedLanguages.includes(value.join('='))) return value.join('=')
  }
}

// 按权重匹配已发布语言；繁体字形或台港澳地区使用台湾版，无匹配时默认英文。
export function preferredLanguage(header = '') {
  const ranges = header.split(',').flatMap((part, order) => {
    const match = part.trim().match(/^(\*|[a-z]{1,8}(?:-[a-z0-9]{1,8})*)(?:\s*;\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?$/i)
    if (!match) return []
    const parts = match[1].toLowerCase().split('-')
    const traditional = parts.includes('hant') || (!parts.includes('hans') && parts.some(part => ['tw', 'hk', 'mo'].includes(part)))
    const code = parts[0] === 'zh' && traditional ? 'zh-tw' : parts[0]
    return [{ code, quality: Number(match[2] ?? 1), order }]
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
