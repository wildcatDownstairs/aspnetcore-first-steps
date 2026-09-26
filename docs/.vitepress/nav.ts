import type { DefaultTheme } from 'vitepress'

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

export const nav: DefaultTheme.NavItem[] = [
  { text: '教程', link: '/tutorial/', activeMatch: '^/tutorial/' },
  { text: '进阶', link: '/advanced/', activeMatch: '^/advanced/' },
  {
    text: '对照速查',
    activeMatch: '^/(fastapi-cheatsheet|efcore-sql-cheatsheet)',
    items: [
      { text: 'FastAPI ↔ ASP.NET Core', link: '/fastapi-cheatsheet' },
      { text: 'EF Core / LINQ ↔ PostgreSQL', link: '/efcore-sql-cheatsheet' },
    ],
  },
  { text: '关于', link: '/about', activeMatch: '^/about' },
]

const label = (c: Chapter) =>
  `<span class="ch-num">${c.num}</span><span class="ch-title">${c.title}</span>` +
  (c.ready ? '' : '<span class="ch-soon">即将推出</span>')

export const tutorialSidebar: DefaultTheme.SidebarItem[] = [
  { text: '学习路线', link: '/tutorial/' },
  ...stages.map((s) => ({
    text: s.title,
    collapsed: false,
    items: s.chapters.map((c) =>
      c.ready ? { text: label(c), link: `/tutorial/${c.slug}` } : { text: label(c) },
    ),
  })),
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
export function stagesFor(language: string): Stage[] {
  if (language !== 'en') return stages
  return stages.map((stage, i) => ({
    ...stage, title: englishStages[i][0], summary: englishStages[i][1],
    chapters: stage.chapters.map(c => ({ ...c, title: englishChapters[c.slug] })),
  }))
}
export const englishSidebar: DefaultTheme.SidebarItem[] = [
  { text: 'Learning path', link: '/en/tutorial/' },
  ...stagesFor('en').map(stage => ({
    text: stage.title, collapsed: false,
    items: stage.chapters.map(c => ({
      text: label(c).replace('即将推出', 'Coming soon'),
      ...(c.ready ? { link: `/en/tutorial/${c.slug}` } : {}),
    })),
  })),
]
export const englishNav: DefaultTheme.NavItem[] = [
  { text: 'Tutorial', link: '/en/tutorial/', activeMatch: '^/en/tutorial/' },
  { text: 'Advanced', link: '/en/advanced/', activeMatch: '^/en/advanced/' },
  { text: 'Cheat sheets', activeMatch: '^/en/(fastapi-cheatsheet|efcore-sql-cheatsheet)', items: [
    { text: 'FastAPI ↔ ASP.NET Core', link: '/en/fastapi-cheatsheet' },
    { text: 'EF Core / LINQ ↔ PostgreSQL', link: '/en/efcore-sql-cheatsheet' },
  ] },
  { text: 'About', link: '/en/about', activeMatch: '^/en/about' },
]
