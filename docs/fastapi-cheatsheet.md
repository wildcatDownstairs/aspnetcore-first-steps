---
title: FastAPI ↔ ASP.NET Core 对照速查
description: 为有 FastAPI 经验的开发者准备的概念对照表，帮你快速找到 ASP.NET Core Minimal API 中的等价写法。
prev: false
next: false
---

# FastAPI ↔ ASP.NET Core 对照速查

如果你写过 FastAPI，会发现 ASP.NET Core Minimal API 的很多想法是相通的：用函数定义端点、用类型声明参数、自动生成 OpenAPI 文档。这张表帮你把已有的知识"翻译"过来。

::: warning 注意
对照只是帮助理解的类比，并不代表两者行为完全一致。表中标注了差异较大的地方，详细内容请阅读对应章节。
:::

## 项目与工具

| FastAPI / Python | ASP.NET Core / .NET | 说明 | 章节 |
| --- | --- | --- | --- |
| `python` + `pip` + `venv` | `dotnet` 命令行 | 一个工具覆盖运行、依赖管理和构建，无需虚拟环境 | [环境准备](/tutorial/setup) |
| `pyproject.toml` | `.csproj` 项目文件 | 声明目标框架与依赖包 | [环境准备](/tutorial/setup) |
| PyPI | NuGet | 包仓库 | [环境准备](/tutorial/setup) |
| `pip install xxx` | `dotnet add package Xxx` | 添加依赖 | [第一步](/tutorial/first-steps) |
| uvicorn | Kestrel | Web 服务器；Kestrel 内置在程序中，无需单独启动 | [第一步](/tutorial/first-steps) |
| `fastapi dev` / `uvicorn --reload` | `dotnet watch` | 开发时自动重载；.NET 多数修改无需重启进程 | [第一步](/tutorial/first-steps) |

## 定义端点

| FastAPI / Python | ASP.NET Core / .NET | 说明 | 章节 |
| --- | --- | --- | --- |
| `app = FastAPI()` | `builder` + `app = builder.Build()` | .NET 分为"注册服务"和"处理请求"两个阶段 | [第一步](/tutorial/first-steps) |
| `@app.get("/")` | `app.MapGet("/", ...)` | 调用方法注册端点，而不是用装饰器 | [第一步](/tutorial/first-steps) |
| 返回 `dict` | 返回匿名类型 `new { ... }` 或 `record` | 自动序列化为 JSON，属性名转为 camelCase | [第一步](/tutorial/first-steps) |
| `/docs` | `/scalar`（Scalar.AspNetCore） | 交互式文档；.NET 中生成与展示分属两个包 | [第一步](/tutorial/first-steps) |
| `/openapi.json` | `/openapi/v1.json` | OpenAPI 文档，.NET 10 默认生成 OpenAPI 3.1 | [第一步](/tutorial/first-steps) |

## 请求参数

| FastAPI / Python | ASP.NET Core / .NET | 说明 | 章节 |
| --- | --- | --- | --- |
| `/items/{item_id}` + `item_id: int` | `/items/{id:int}` + `int id` | 同名绑定、类型转换 | [路由参数](/tutorial/path-params) |
| 按声明顺序匹配路由 | 按优先级匹配路由 | **差异**：.NET 中注册顺序不影响匹配结果 | [路由参数](/tutorial/path-params) |
| `{file_path:path}` | `{*path}` | 匹配包含 `/` 的剩余路径 | [路由参数](/tutorial/path-params) |
| 查询参数 `q: str \| None = None` | `string? q` | 可空类型表示可选参数 | [查询参数](/tutorial/query-params) |
| Pydantic 模型作为请求体 | `record` 作为请求体 | JSON 自动绑定到强类型对象 | [请求体](/tutorial/request-body) |
| `Field(ge=1)` 等校验 | 数据注解 + .NET 10 内置校验 | | [参数校验](/tutorial/validation) |
| `Header()` / `Cookie()` | `[FromHeader]` / `HttpRequest.Cookies` | .NET 没有 `[FromCookie]` 特性，Cookie 从请求对象读取 | [Header 与 Cookie](/tutorial/headers-cookies) |

## 响应与错误

| FastAPI / Python | ASP.NET Core / .NET | 说明 | 章节 |
| --- | --- | --- | --- |
| `response_model` | `TypedResults` 与 `Results<T1, T2>` | 返回类型即文档 | [响应类型](/tutorial/response-types) |
| `HTTPException` | `TypedResults.NotFound()`、ProblemDetails | | [状态码与错误处理](/tutorial/errors) |
| `APIRouter` | `app.MapGroup(...)` | 路由分组、公共前缀 | [路由分组](/tutorial/route-groups) |

## 应用骨架

| FastAPI / Python | ASP.NET Core / .NET | 说明 | 章节 |
| --- | --- | --- | --- |
| `Depends()` | 依赖注入容器 `builder.Services` | .NET 内置完整的 DI 容器，有三种生命周期 | 依赖注入（编写中） |
| `pydantic-settings` | 配置系统 + Options 模式 | appsettings.json、环境变量、User Secrets | 配置与 Options（编写中） |
| `@app.middleware("http")` | `app.Use(...)` 中间件 | 管道模型，顺序很重要 | 中间件（编写中） |
| `logging` | `ILogger<T>` | 结构化日志 | 日志（编写中） |

## 数据、安全与上线

| FastAPI / Python | ASP.NET Core / .NET | 说明 | 章节 |
| --- | --- | --- | --- |
| SQLAlchemy / SQLModel | EF Core | ORM | EF Core 入门（编写中） |
| Alembic | EF Core 迁移（`dotnet ef`） | 数据库结构迁移 | EF Core 入门（编写中） |
| `OAuth2PasswordBearer` + JWT | JWT Bearer 认证 | | 认证（编写中） |
| `Security()` / 依赖中检查权限 | 授权策略 + `RequireAuthorization()` | | 授权（编写中） |
| `CORSMiddleware` | `AddCors` + `UseCors` | | CORS（编写中） |
| `TestClient` | `WebApplicationFactory` | 在内存中启动应用做集成测试 | 测试（编写中） |
