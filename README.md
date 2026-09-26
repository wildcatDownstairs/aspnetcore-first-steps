# ASP.NET Core 第一步

写给有编程经验者的中文 ASP.NET Core 渐进式教程：.NET 10 + Minimal API，从第一个接口到数据库、认证、测试与部署。

在线阅读：[ASP.NET Core 第一步](https://aspnetcore-first-steps.pages.dev/)

## 仓库结构

```
docs/                    教程 Markdown（VitePress 站点）
  .vitepress/config.mts  站点配置
  .vitepress/nav.ts      顶部导航 + 按学习阶段分组的侧边栏（章节唯一数据源）
  .vitepress/theme/      自定义主题：配色、动效、"FastAPI 对照"提示框等
  tutorial/              教程主线
samples/NN-章节名/        每章对应一个可独立运行的完整项目
.github/workflows/ci.yml 编译与测试示例 → 验证容器持久化 → 构建站点
```

## 本地运行

```bash
npm install
npm run docs:dev      # 开发模式，http://localhost:5173/
npm run docs:build    # 生产构建，输出到 docs/.vitepress/dist
```

运行某个示例：

```bash
cd samples/02-first-steps
dotnet run
```

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
2. 在 `docs/tutorial/` 新建 Markdown；
3. 在 `docs/.vitepress/nav.ts` 中把对应章节的 `ready` 改为 `true`；
4. 自查：`dotnet build -warnaserror` 通过、只引入一个新概念、解释了"为什么"、给出了预期输出、末尾有总结。

## 部署

站点由 Cloudflare Pages 通过 Git 集成部署，推送到 `main` 分支后自动构建并发布。Pages 配置如下：

| 配置项 | 值 |
| --- | --- |
| 框架预设 | VitePress |
| 生产分支 | `main` |
| 构建命令 | `npm run docs:build` |
| 构建输出目录 | `docs/.vitepress/dist` |
| 根目录 | 留空（仓库根目录） |
| 环境变量 `NODE_VERSION` | `24` |
| 环境变量 `GITHUB_REPOSITORY` | `wildcatDownstairs/aspnetcore-first-steps` |

站点使用根路径 `/`，适用于 Pages 域名和自定义域名。`GITHUB_REPOSITORY` 用于生成仓库及页面编辑链接。

GitHub Actions 继续编译和测试示例、验证容器持久化、检查中英文同步并构建站点，不再发布 GitHub Pages。Cloudflare 的自动部署与 GitHub Actions 独立运行，不会等待这些检查完成。

## 中英文内容同步

中文 `docs/` 是内容基准，英文放在 `docs/en/`，路径逐页对应。两种语言共用 `samples/`：代码注释、示例数据和应用消息统一使用英文，两种正文引用同一份代码和预期输出。新增或更新中文页面时同步英文页面，导航只在 `nav.ts` 维护章节结构。提交前运行 `npm run docs:check-translations` 检查页面覆盖、代码引用、章节数量和语言链接，再运行站点构建；这些检查也已加入 CI。

首次访问入口首页时，浏览器首选语言为中文则显示中文，匹配到英文或无受支持语言时显示英文。手动选择保存在本机，优先于浏览器偏好；直接访问章节或 `/en/` 地址时尊重链接指定的语言。`npm run test:site` 验证语言选择与跳转规则。

第 21～23 章的测试从各章目录运行，例如：

```bash
cd samples/22-project-structure
dotnet test --project Tests/TodoApi.Tests.csproj -c Release -p:TreatWarningsAsErrors=true
```

章节内的 `global.json` 选择 Microsoft.Testing.Platform；不要在仓库根目录绕过这项配置运行这些测试。
