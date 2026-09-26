# ASP.NET Core 第一步

写给有编程经验者的中文 ASP.NET Core 渐进式教程：.NET 10 + Minimal API，从第一个接口到数据库、认证、测试与部署。

在线阅读：[ASP.NET Core 第一步](https://wildcatdownstairs.github.io/aspnetcore-first-steps/)

## 仓库结构

```
docs/                    教程 Markdown（VitePress 站点）
  .vitepress/config.mts  站点配置
  .vitepress/nav.ts      顶部导航 + 按学习阶段分组的侧边栏（章节唯一数据源）
  .vitepress/theme/      自定义主题：配色、动效、"FastAPI 对照"提示框等
  tutorial/              教程主线
samples/NN-章节名/        每章对应一个可独立运行的完整项目
.github/workflows/ci.yml 编译全部示例 → 构建站点 → 发布到 GitHub Pages
```

## 本地运行

```bash
npm install
npm run docs:dev      # 开发模式，http://localhost:5173/aspnetcore-first-steps/
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

推送到 `main` 分支后，GitHub Actions 会先编译全部示例（任何一个失败都会中止），再构建站点并发布到 GitHub Pages。首次使用需要在仓库 **Settings → Pages** 中把 Source 设为 **GitHub Actions**。
