// URL、SEO 与界面共用语言定义；中文始终是翻译基准。
export const locales = {
  zh: { lang: 'zh-CN', label: '简体中文', short: '中文', title: 'ASP.NET Core 第一步', og: 'zh_CN', description: '写给有编程经验者的中文 ASP.NET Core 渐进式教程：.NET 10 + Minimal API，从第一个接口到数据库、认证、测试与部署。' },
  en: { lang: 'en', label: 'English', short: 'EN', title: 'ASP.NET Core First Steps', og: 'en_US', description: 'A step-by-step ASP.NET Core tutorial for developers new to C#: .NET 10, Minimal APIs, EF Core, authentication, testing, and deployment.' },
  ja: { lang: 'ja', label: '日本語', short: '日本語', title: 'ASP.NET Core はじめの一歩', og: 'ja_JP', description: 'プログラミング経験者のための ASP.NET Core 入門。.NET 10 と Minimal API を使い、最初のエンドポイントからデータベース、認証、テスト、デプロイまで段階的に学びます。' },
} as const

export type Locale = keyof typeof locales
export const localeCodes = Object.keys(locales) as Locale[]
export function localeForPath(path: string): Locale {
  const prefix = path.replace(/^\//, '').split('/')[0]
  return localeCodes.includes(prefix as Locale) ? prefix as Locale : 'en'
}
export function localeForLang(lang: string): Locale {
  return localeCodes.find(code => locales[code].lang === lang) || 'en'
}
