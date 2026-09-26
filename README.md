# ASP.NET Core 第一步

写给有编程经验者的 ASP.NET Core 渐进式教程，基于 **.NET 10 + Minimal API**，从第一个接口到数据库、认证、测试与部署。以中文为内容基准，提供英文与日文译文，三种语言共用可运行的示例代码。

## 在线阅读

| 简体中文 | English | 日本語 |
| --- | --- | --- |
| [中文首页](https://aspnetcore-first-steps.pages.dev/zh/) | [English home](https://aspnetcore-first-steps.pages.dev/en/) | [日本語ホーム](https://aspnetcore-first-steps.pages.dev/ja/) |
| [开始学习](https://aspnetcore-first-steps.pages.dev/zh/tutorial/setup) | [Get started](https://aspnetcore-first-steps.pages.dev/en/tutorial/setup) | [学習を始める](https://aspnetcore-first-steps.pages.dev/ja/tutorial/setup) |

站点托管于 **Cloudflare Pages**。[统一入口](https://aspnetcore-first-steps.pages.dev/)优先使用手动选择的语言，其次匹配浏览器语言，未匹配时进入英文版。分享具体页面时建议使用带 `/zh/`、`/en/` 或 `/ja/` 的地址。

## 教程内容

- **入门**：环境准备、C# 速览、第一个 Minimal API。
- **请求与响应**：参数、请求体、校验、Cookie、响应类型、错误处理和路由分组。
- **应用骨架**：依赖注入、配置、Middleware 和日志。
- **数据访问**：EF Core、SQLite、关系与查询、完整 CRUD。
- **安全与上线**：JWT 认证、授权、CORS、集成测试、项目结构和容器部署。
- **补充资料**：EF Core 迁移，以及 FastAPI、SQL 对照速查。

## 仓库结构

```
docs/                    教程 Markdown（VitePress 站点）
  .vitepress/config.mts  站点配置
  .vitepress/nav.ts      顶部导航 + 按学习阶段分组的侧边栏（章节唯一数据源）
  .vitepress/theme/      自定义主题：配色、动效、"FastAPI 对照"提示框等
  zh/                    中文基准内容
  en/                    英文译文
  ja/                    日文译文
functions/index.js       Cloudflare Pages 根路径语言分流
shared/language.mjs      浏览器语言与手动选择解析
samples/NN-章节名/        每章对应一个可独立运行的完整项目
scripts/                 翻译、SEO 校验与站点单元测试
wrangler.jsonc           Cloudflare Pages 配置
.node-version            本地、Cloudflare 与 CI 共用的 Node.js 版本
.github/workflows/ci.yml 编译与测试示例 → 验证容器持久化 → 构建站点
```

## 本地运行

文档站点使用 Node.js 24 与 npm（版本见 `.node-version`）；运行教程示例需要 .NET 10 SDK。

```bash
npm ci
npm run docs:dev      # 开发模式，http://localhost:5173/
npm run docs:build    # 生产构建，输出到 docs/.vitepress/dist
```

运行某个示例：

```bash
cd samples/02-first-steps
dotnet run
```

第 21～23 章的测试从各章目录运行，例如：

```bash
cd samples/22-project-structure
dotnet test --project Tests/TodoApi.Tests.csproj -c Release -p:TreatWarningsAsErrors=true
```

章节内的 `global.json` 选择 Microsoft.Testing.Platform；不要在仓库根目录绕过这项配置运行这些测试。

## 写作约定

### 代码只从 samples 导入

文档中的 C# 代码一律引用 `samples/` 下的真实文件，不在 Markdown 里手写：

```md
<<< @/../samples/03-path-params/Program.cs{15,17,19 cs:line-numbers} [03-path-params/Program.cs]
```

- `{15,17,19 ...}` 高亮本节新增或变化的行；
- `cs:line-numbers` 指定语言并显示行号；
- `[...]` 是显示在代码块上方的文件名。

终端命令、预期输出（终端输出、HTTP 响应、JSON）可以直接写在 Markdown 中。

### 提示框（语义固定）

```md
::: tip 提示
实用技巧
:::

::: info 技术细节
可跳过的底层原理
:::

::: warning 注意
常见坑
:::

::: fastapi
一两句话对照 FastAPI 中的等价概念（没有合适对照就不写）
:::
```

### 新增一章

1. 在 `samples/NN-章节名/` 创建项目（`launchSettings.json` 统一使用 `http://localhost:5080`）；
2. 在 `docs/zh/tutorial/` 新建 Markdown，并同步英文和日文；
3. 在 `docs/.vitepress/nav.ts` 维护章节结构与两种译文标题，章节完成后设置 `ready: true`；
4. 执行 `dotnet build -warnaserror` 与 `npm run docs:build`，确认示例与文档检查通过；每章聚焦一个新概念，解释“为什么”，给出预期输出，并在末尾总结。

## Cloudflare Pages 部署

站点由 Cloudflare Pages 通过 Git 集成部署，推送到 `main` 分支后自动构建并发布。Pages 配置如下：

| 配置项 | 值 |
| --- | --- |
| 框架预设 | VitePress |
| 生产分支 | `main` |
| 构建命令 | `npm run docs:build` |
| 构建输出目录 | `docs/.vitepress/dist` |
| 根目录 | 留空（仓库根目录） |
| Node.js 版本 | 从仓库根目录 `.node-version` 读取；如设置 `NODE_VERSION`，需与文件保持一致 |
| 环境变量 `GITHUB_REPOSITORY` | `wildcatDownstairs/aspnetcore-first-steps`（可选，fork 时覆盖） |

站点使用根路径 `/`，适用于 Pages 域名和自定义域名。`GITHUB_REPOSITORY` 可覆盖仓库及页面编辑链接；未设置时默认使用 `wildcatDownstairs/aspnetcore-first-steps`，本地预览也会显示 GitHub 入口。

GitHub Actions 负责编译和测试示例、验证容器持久化、检查中英日同步并构建站点。Cloudflare 的自动部署与 GitHub Actions 独立运行，不会等待这些检查完成。

## 中英日内容同步

中文 `docs/zh/` 是内容基准，英文放在 `docs/en/`，日文放在 `docs/ja/`，路径逐页对应。三种语言共用 `samples/`：代码注释、示例数据和应用消息统一使用英文，正文引用同一份代码和预期输出。新增或更新中文页面时同步两种译文，导航只在 `nav.ts` 维护章节结构。

`npm run docs:check-translations` 检查页面覆盖、示例引用、章节数量和语言链接。`npm run docs:build` 会先运行翻译检查和站点单元测试，再构建并检查 HTML，因此 Cloudflare Git 构建也会执行这些检查。

## 语言 URL 与边缘分流

- 中文：`/zh/`，英文：`/en/`，日文：`/ja/`；正文沿用相同 slug，例如 `/ja/tutorial/first-steps`。
- 只有根路径 `/` 的 GET/HEAD 请求经过 Pages Function：有效的 `site_language` Cookie 优先，其次按 `Accept-Language` 的 q 权重匹配 zh/en/ja；无匹配或请求头缺失时默认英文。地区变体如 ja-JP、zh-TW 归入对应语言，当前中文内容为简体。
- 语言按钮切换到对应章节并保存手动选择一年。直接访问任何明确的语言 URL 都不会被改写，也不会因浏览器语言而跳转。没有 Cookie 时会重新按浏览器偏好判断，不使用 IP 国家识别。
- 个性化入口返回 302 和 `Cache-Control: private, no-store`，保留查询参数。不要用 CDN Cache Rules 强制缓存根入口，也不能只依赖 Vary 自动隔离缓存。
- 构建根据中文页面生成 `_redirects`，将旧的 `/tutorial/…`、`/advanced/…` 和速查页逐页 301 到 `/zh/…`；根地址保留给语言分流。
- `docs/public/_routes.json` 只让根路径调用 Functions，正文与资源直接由 Pages 提供。`wrangler.jsonc` 固定项目名称、构建目录与兼容日期，仓库根目录的 `functions/` 由 Pages Git 集成部署。

本地验证完整边缘行为：

```bash
npm run docs:build
npm run docs:edge       # http://127.0.0.1:5179/；包含 Functions 与旧地址重定向
```

`docs:dev` / `docs:preview` 只提供 VitePress 页面，不执行 Pages Functions 或旧 URL 重定向。根入口的静态备用页会默认跳到 `/en/`，三语言页面也可直接访问。

## 三语言 SEO

正式域名在 `docs/.vitepress/seo.mts` 中统一维护。每页生成本语言的独立标题和描述、自引用 canonical、中英日双向 hreflang、Open Graph / Twitter 分享信息及 WebSite / WebPage 结构化数据。首页的 x-default 指向根入口，章节指向对应英文版。根备用页 canonical 指向英文首页，不作为重复内容列入 sitemap。

构建生成 [sitemap.xml](https://aspnetcore-first-steps.pages.dev/sitemap.xml)（三种语言及已有 Git 更新时间）和 [robots.txt](https://aspnetcore-first-steps.pages.dev/robots.txt)，404 标记为不收录。更换正式域名时更新 `siteOrigin`、本文件站点链接和 GitHub 仓库 About 中的 Website。`npm run docs:check-seo` 检查全部页面的实际 HTML、语言对应关系、正文链接与锚点、站点地图、Function 路由范围和旧地址映射。

上线后可在 Google Search Console / Bing Webmaster Tools 验证站点并提交 `https://aspnetcore-first-steps.pages.dev/sitemap.xml`。生成元信息和站点地图不代表搜索引擎已经收录。
