import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'
import { locales, type Locale } from './locales.mts'
import { navFor, sidebarFor } from './nav'

const ui = {
  'zh-tw': {
    outline: '本頁目錄', prev: '上一頁', next: '下一頁', updated: '最後更新於', edit: '在 GitHub 上編輯此頁',
    appearance: '外觀', light: '切換至淺色模式', dark: '切換至深色模式', contents: '目錄', top: '回到頂端', language: '語言',
    missing: '找不到頁面', quote: '這個網址沒有對應的頁面，可能章節尚未完成，或是連結有誤。', home: '返回首頁',
    footer: '採用 .NET 10 與 Minimal API · 所有範例皆可直接 <code>dotnet run</code>', copyright: '文字與範例程式碼皆為原創',
  },
  zh: {
    outline: '本页目录', prev: '上一页', next: '下一页', updated: '最后更新于', edit: '在 GitHub 上编辑此页',
    appearance: '外观', light: '切换到浅色模式', dark: '切换到深色模式', contents: '目录', top: '回到顶部', language: '语言',
    missing: '页面不存在', quote: '这个地址没有对应的页面，可能章节还没写完，或者链接有误。', home: '返回首页',
    footer: '基于 .NET 10 与 Minimal API · 所有示例均可直接 <code>dotnet run</code>', copyright: '文字与示例代码均为原创',
  },
  en: {
    outline: 'On this page', prev: 'Previous page', next: 'Next page', updated: 'Last updated', edit: 'Edit this page on GitHub',
    appearance: 'Appearance', light: 'Switch to light theme', dark: 'Switch to dark theme', contents: 'Contents', top: 'Back to top', language: 'Change language',
    missing: 'Page not found', quote: 'This page may have moved, or the address may be incorrect.', home: 'Go home',
    footer: 'Built with .NET 10 and Minimal APIs · Runnable examples in every chapter', copyright: 'Original writing and sample code',
  },
  ja: {
    outline: 'このページの内容', prev: '前のページ', next: '次のページ', updated: '最終更新', edit: 'GitHub でこのページを編集',
    appearance: '表示設定', light: 'ライトモードに切り替え', dark: 'ダークモードに切り替え', contents: '目次', top: 'ページの先頭へ', language: '言語を変更',
    missing: 'ページが見つかりません', quote: 'ページが移動したか、URL が間違っている可能性があります。', home: 'ホームへ戻る',
    footer: '.NET 10 と Minimal API を使用 · 各章に実行可能なサンプルを用意', copyright: '本文とサンプルコードはオリジナルです',
  },
}
export function localeConfig(code: Locale, repoUrl: string): LocaleSpecificConfig<DefaultTheme.Config> & { label: string; link: string } {
  const locale = locales[code]
  const text = ui[code]
  return {
    label: locale.label, lang: locale.lang, title: locale.title, description: locale.description, link: `/${code}/`,
    themeConfig: {
      nav: navFor(code), sidebar: { [`/${code}/tutorial/`]: sidebarFor(code) },
      outline: { level: [2, 3], label: text.outline },
      docFooter: { prev: text.prev, next: text.next }, lastUpdated: { text: text.updated },
      editLink: repoUrl ? { pattern: `${repoUrl}/edit/main/docs/:path`, text: text.edit } : undefined,
      darkModeSwitchLabel: text.appearance, lightModeSwitchTitle: text.light, darkModeSwitchTitle: text.dark,
      sidebarMenuLabel: text.contents, returnToTopLabel: text.top, langMenuLabel: text.language,
      skipToContentLabel: { zh: '跳到正文', 'zh-tw': '跳至主要內容', en: 'Skip to content', ja: '本文へスキップ' }[code],
      notFound: { title: text.missing, quote: text.quote, linkLabel: text.home, linkText: text.home },
      footer: { message: text.footer, copyright: text.copyright },
    },
  }
}
export const searchTranslations = {
  'zh-tw': {
    button: { buttonText: '搜尋教學…', buttonAriaLabel: '搜尋教學' },
    modal: { displayDetails: '顯示詳細清單', resetButtonTitle: '清除搜尋', backButtonTitle: '關閉搜尋', noResultsText: '找不到相關結果',
      footer: { selectText: '選取', navigateText: '切換', closeText: '關閉' } },
  },
  zh: {
    button: { buttonText: '搜索教程…', buttonAriaLabel: '搜索' },
    modal: { displayDetails: '显示详细列表', resetButtonTitle: '清除', backButtonTitle: '关闭搜索', noResultsText: '没有找到相关结果',
      footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' } },
  },
  en: {
    button: { buttonText: 'Search tutorials…', buttonAriaLabel: 'Search tutorials' },
    modal: { displayDetails: 'Display detailed list', resetButtonTitle: 'Clear search', backButtonTitle: 'Close search', noResultsText: 'No results found',
      footer: { selectText: 'Select', navigateText: 'Navigate', closeText: 'Close' } },
  },
  ja: {
    button: { buttonText: 'チュートリアルを検索…', buttonAriaLabel: '検索' },
    modal: { displayDetails: '詳細を表示', resetButtonTitle: '検索をクリア', backButtonTitle: '検索を閉じる', noResultsText: '検索結果が見つかりません',
      footer: { selectText: '選択', navigateText: '移動', closeText: '閉じる' } },
  },
}
