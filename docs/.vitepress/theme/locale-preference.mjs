export const languageStorageKey = 'aspnetcore-first-steps:language'

// A deliberate choice wins; otherwise use the first supported browser preference.
export function preferredLanguage(browserLanguages = [], savedLanguage) {
  if (savedLanguage === 'en' || savedLanguage === 'zh-CN') return savedLanguage
  for (const language of browserLanguages) {
    if (/^zh(?:-|$)/i.test(language)) return 'zh-CN'
    if (/^en(?:-|$)/i.test(language)) return 'en'
  }
  return 'en'
}

export function languageRedirect(pathname, base, language) {
  // Only the entry homepage negotiates language. Shared chapter URLs stay explicit.
  const isEntry = [base, base.slice(0, -1), `${base}index.html`].includes(pathname)
  return isEntry && language === 'en' ? `${base}en/` : null
}
