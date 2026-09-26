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
      { num: '11', slug: 'dependency-injection', title: '依赖注入', ready: false },
      { num: '12', slug: 'configuration', title: '配置与 Options', ready: false },
      { num: '13', slug: 'middleware', title: '中间件', ready: false },
      { num: '14', slug: 'logging', title: '日志', ready: false },
    ],
  },
  {
    title: '数据访问',
    summary: '用 EF Core 把数据存进 SQLite，组合成完整的 API',
    chapters: [
      { num: '15', slug: 'efcore-basics', title: 'EF Core 入门', ready: false },
      { num: '16', slug: 'relations-queries', title: '关系与查询', ready: false },
      { num: '17', slug: 'crud', title: '完整 CRUD', ready: false },
    ],
  },
  {
    title: '安全',
    summary: '先确认"你是谁"，再决定"你能做什么"',
    chapters: [
      { num: '18', slug: 'authentication', title: '认证（JWT）', ready: false },
      { num: '19', slug: 'authorization', title: '授权', ready: false },
      { num: '20', slug: 'cors', title: 'CORS', ready: false },
    ],
  },
  {
    title: '上线',
    summary: '测试、整理代码结构，然后发布出去',
    chapters: [
      { num: '21', slug: 'testing', title: '测试', ready: false },
      { num: '22', slug: 'project-structure', title: '组织更大的项目', ready: false },
      { num: '23', slug: 'deployment', title: '部署', ready: false },
    ],
  },
]

export const nav: DefaultTheme.NavItem[] = [
  { text: '教程', link: '/tutorial/', activeMatch: '^/tutorial/' },
  { text: '进阶', link: '/advanced/', activeMatch: '^/advanced/' },
  { text: '对照速查', link: '/fastapi-cheatsheet', activeMatch: '^/fastapi-cheatsheet' },
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
