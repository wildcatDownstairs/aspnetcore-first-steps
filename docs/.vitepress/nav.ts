import type { DefaultTheme } from 'vitepress'
import type { Locale } from './locales.mts'

/**
 * 教程主线：按"学习阶段"分组，组内顺序就是阅读顺序（后面的章节依赖前面的）。
 * ready 为 false 的章节尚未完成：侧边栏里显示为灰色的"即将推出"，不参与上一页/下一页。
 */
interface Chapter {
  num: string
  slug: string
  title: string
  ready: boolean
}

interface Stage {
  title: string
  summary: string
  chapters: Chapter[]
}

export const stages: Stage[] = [
  {
    title: '入门',
    summary: '装好工具，认识 C#，跑起第一个接口',
    chapters: [
      { num: '00', slug: 'setup', title: '环境准备', ready: true },
      { num: '01', slug: 'csharp-tour', title: 'C# 速览', ready: true },
      { num: '02', slug: 'first-steps', title: '第一步', ready: true },
    ],
  },
  {
    title: '请求与响应',
    summary: '从 HTTP 请求里取数据，再把结果正确地返回',
    chapters: [
      { num: '03', slug: 'path-params', title: '路由参数', ready: true },
      { num: '04', slug: 'query-params', title: '查询参数', ready: true },
      { num: '05', slug: 'request-body', title: '请求体', ready: true },
      { num: '06', slug: 'validation', title: '参数校验', ready: true },
      { num: '07', slug: 'headers-cookies', title: 'Header 与 Cookie', ready: true },
      { num: '08', slug: 'response-types', title: '响应类型', ready: true },
      { num: '09', slug: 'errors', title: '状态码与错误处理', ready: true },
      { num: '10', slug: 'route-groups', title: '路由分组', ready: true },
    ],
  },
  {
    title: '应用骨架',
    summary: '让应用可配置、可观测，组件之间松耦合',
    chapters: [
      { num: '11', slug: 'dependency-injection', title: '依赖注入', ready: true },
      { num: '12', slug: 'configuration', title: '配置与 Options', ready: true },
      { num: '13', slug: 'middleware', title: '中间件', ready: true },
      { num: '14', slug: 'logging', title: '日志', ready: true },
    ],
  },
  {
    title: '数据访问',
    summary: '用 EF Core 把数据存进 SQLite，组合成完整的 API',
    chapters: [
      { num: '15', slug: 'efcore-basics', title: 'EF Core 入门', ready: true },
      { num: '16', slug: 'relations-queries', title: '关系与查询', ready: true },
      { num: '17', slug: 'crud', title: '完整 CRUD', ready: true },
    ],
  },
  {
    title: '安全',
    summary: '先确认"你是谁"，再决定"你能做什么"',
    chapters: [
      { num: '18', slug: 'authentication', title: '认证（JWT）', ready: true },
      { num: '19', slug: 'authorization', title: '授权', ready: true },
      { num: '20', slug: 'cors', title: 'CORS', ready: true },
    ],
  },
  {
    title: '上线',
    summary: '测试、整理代码结构，然后发布出去',
    chapters: [
      { num: '21', slug: 'testing', title: '测试', ready: true },
      { num: '22', slug: 'project-structure', title: '按功能组织项目', ready: true },
      { num: '23', slug: 'deployment', title: '发布与部署', ready: true },
    ],
  },
]

// 英文只提供文案映射，章节编号、顺序和发布状态仍由 stages 决定。
const englishChapters: Record<string, string> = {
  setup: 'Environment setup', 'csharp-tour': 'A quick tour of C#',
  'first-steps': 'First steps', 'path-params': 'Path parameters',
  'query-params': 'Query parameters', 'request-body': 'Request bodies',
  validation: 'Validation', 'headers-cookies': 'Headers and cookies',
  'response-types': 'Response types', errors: 'Status codes and errors',
  'route-groups': 'Route groups', 'dependency-injection': 'Dependency injection',
  configuration: 'Configuration and options', middleware: 'Middleware', logging: 'Logging',
  'efcore-basics': 'EF Core basics', 'relations-queries': 'Relationships and queries',
  crud: 'A complete CRUD API', authentication: 'Authentication (JWT)',
  authorization: 'Authorization', cors: 'CORS', testing: 'Testing',
  'project-structure': 'Organizing by feature', deployment: 'Publishing and deployment',
}
const englishStages = [
  ['Getting started', 'Set up your tools, meet C#, and run your first endpoint'],
  ['Requests and responses', 'Read request data and return useful responses'],
  ['Application foundations', 'Connect services, manage configuration, and understand the pipeline'],
  ['Data access', 'Store data in SQLite with EF Core and build a complete API'],
  ['Security', 'Identify callers and decide what they can do'],
  ['Going live', 'Test your API, organize its code, and deploy it'],
]
const japaneseChapters: Record<string, string> = {
  setup: '環境構築', 'csharp-tour': 'C# の基礎', 'first-steps': 'はじめの一歩',
  'path-params': 'ルートパラメーター', 'query-params': 'クエリパラメーター',
  'request-body': 'リクエストボディ', validation: '入力検証',
  'headers-cookies': 'ヘッダーと Cookie', 'response-types': 'レスポンスの型',
  errors: 'ステータスコードとエラー処理', 'route-groups': 'ルートグループ',
  'dependency-injection': '依存性の注入', configuration: '構成と Options',
  middleware: 'ミドルウェア', logging: 'ログ', 'efcore-basics': 'EF Core 入門',
  'relations-queries': 'リレーションシップとクエリ', crud: 'CRUD API の実装',
  authentication: '認証（JWT）', authorization: '認可', cors: 'CORS', testing: 'テスト',
  'project-structure': '機能別のプロジェクト構成', deployment: '発行とデプロイ',
}
const japaneseStages = [
  ['入門', 'ツールを整え、C# に触れ、最初のエンドポイントを動かす'],
  ['リクエストとレスポンス', 'HTTP リクエストからデータを取得し、適切なレスポンスを返す'],
  ['アプリケーションの基盤', '構成、ログ、疎結合なコンポーネントを整える'],
  ['データアクセス', 'EF Core で SQLite に保存し、API を組み立てる'],
  ['セキュリティ', '呼び出し元を識別し、許可する操作を決める'],
  ['公開に向けて', 'テストし、コードを整理してデプロイする'],
]
export function stagesFor(language: string): Stage[] {
  if (language === 'zh' || language === 'zh-CN') return stages
  const translatedStages = language === 'ja' ? japaneseStages : englishStages
  const chapters = language === 'ja' ? japaneseChapters : englishChapters
  return stages.map((stage, i) => ({
    ...stage, title: translatedStages[i][0], summary: translatedStages[i][1],
    chapters: stage.chapters.map(c => ({ ...c, title: chapters[c.slug] })),
  }))
}
const labels = {
  zh: ['教程', '进阶', '对照速查', '关于', '学习路线', '即将推出'],
  en: ['Tutorial', 'Advanced', 'Cheat sheets', 'About', 'Learning path', 'Coming soon'],
  ja: ['チュートリアル', '応用', '早見表', '概要', '学習ロードマップ', '近日公開'],
}
export function navFor(locale: Locale): DefaultTheme.NavItem[] {
  const [tutorial, advanced, cheatsheets, about] = labels[locale]
  const prefix = `/${locale}`
  return [
    { text: tutorial, link: `${prefix}/tutorial/`, activeMatch: `^${prefix}/tutorial/` },
    { text: advanced, link: `${prefix}/advanced/`, activeMatch: `^${prefix}/advanced/` },
    { text: cheatsheets, activeMatch: `^${prefix}/(fastapi-cheatsheet|efcore-sql-cheatsheet)`, items: [
      { text: 'FastAPI ↔ ASP.NET Core', link: `${prefix}/fastapi-cheatsheet` },
      { text: 'EF Core / LINQ ↔ PostgreSQL', link: `${prefix}/efcore-sql-cheatsheet` },
    ] },
    { text: about, link: `${prefix}/about`, activeMatch: `^${prefix}/about` },
  ]
}
export function sidebarFor(locale: Locale): DefaultTheme.SidebarItem[] {
  return [
    { text: labels[locale][4], link: `/${locale}/tutorial/` },
    ...stagesFor(locale).map(stage => ({
      text: stage.title, collapsed: false,
      items: stage.chapters.map(c => ({
        text: `<span class="ch-num">${c.num}</span><span class="ch-title">${c.title}</span>` +
          (c.ready ? '' : `<span class="ch-soon">${labels[locale][5]}</span>`),
        ...(c.ready ? { link: `/${locale}/tutorial/${c.slug}` } : {}),
      })),
    })),
  ]
}
