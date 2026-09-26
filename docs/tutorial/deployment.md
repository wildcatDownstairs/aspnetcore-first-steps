---
title: 发布与部署
description: 用 .NET SDK 发布 Todo API，通过 Docker Compose 配置生产环境、执行数据库迁移并持久保存 SQLite 数据。
---

# 发布与部署

本章把第 22 章的 Todo API 变成可以在另一台机器上运行的程序。核心问题是：**代码发布后，配置和数据放在哪里？** 镜像负责携带程序，环境变量提供配置，数据卷保存数据库。

先看完整入口。端点和按功能组织的目录继续沿用上一章；新增的是独立的迁移命令与存活检查：

<<< @/../samples/23-deployment/Program.cs{7,16,36-43 cs:line-numbers} [Program.cs]

:::: details 发布配置与数据库初始化
::: code-group

<<< @/../samples/23-deployment/Deployment.csproj{xml:line-numbers} [Deployment.csproj]

<<< @/../samples/23-deployment/Features/Auth/AuthConfiguration.cs{8-15 cs:line-numbers} [Features/Auth/AuthConfiguration.cs]

<<< @/../samples/23-deployment/Data/TodoDatabase.cs{cs:line-numbers} [Data/TodoDatabase.cs]

<<< @/../samples/23-deployment/Data/TodoDbContext.cs{cs:line-numbers} [Data/TodoDbContext.cs]

:::
::::

## 先在本机运行

从仓库根目录执行：

```bash
cd samples/23-deployment
dotnet run -- --migrate
dotnet user-jwts create --name alice --role editor
dotnet run
```

第一条运行命令执行迁移后退出，最后一行是 `Database migration complete.`。随后生成的开发令牌用于本机调试，服务地址仍是 `http://localhost:5080`。

另开终端：

```bash
curl http://localhost:5080/health
```

```json
{"status":"ok"}
```

`/health` 只确认进程能够响应 HTTP，**没有检查数据库和身份服务**。需要检查这些依赖时，可以进一步使用 ASP.NET Core 健康检查功能。

::: warning 使用本章自己的数据库
本章从新的 `todos-23.db` 开始，使用迁移创建表。不要把第 15～22 章通过 `EnsureCreated` 创建的数据库直接拿来执行迁移；这两种建表方式不能直接混用。有旧数据需要升级时，先读[数据库迁移](../advanced/efcore-migrations)。
:::

## 发布程序与创建镜像

**发布**（publish）会收集运行应用需要的程序集和配置；**容器镜像**（container image）还包含运行时与操作系统基础文件。容器从镜像启动，数据另外保存。

普通发布可以这样做：

```bash
dotnet publish -c Release -o ./publish
```

输出目录中的 `Deployment.dll` 可以在安装了相应 ASP.NET Core 运行时的机器上通过 `dotnet Deployment.dll` 启动。发布产物不会自动使用 `launchSettings.json` 的开发环境设置，正式运行前要提供下文的认证配置。

本章用 .NET SDK 直接创建 Linux x64 镜像，无需另外维护 Dockerfile：

```bash
dotnet publish -c Release --os linux --arch x64 /t:PublishContainer
```

这条命令默认把 `todo-api:chapter23` 写入本机容器运行时。后续步骤需要已启动的 Docker，并使用 Linux 容器。目标机器是 ARM64 时，把 `x64` 改成 `arm64`，在相应机器上运行。

镜像基于 `mcr.microsoft.com/dotnet/aspnet:10.0`，应用以非 root 用户运行。本示例使用的默认用户 ID 是 `1654`。SDK 也支持直接推送到镜像仓库或生成归档，见[官方容器发布说明](https://learn.microsoft.com/en-us/dotnet/core/containers/sdk-publish)。

## 配置生产环境

完整 Compose 配置如下。**Docker Compose** 用一个文件描述要启动的容器、环境变量和数据卷：

<<< @/../samples/23-deployment/compose.yaml{yaml:line-numbers} [compose.yaml]

其中三个服务各有一个任务：`init-data` 准备数据目录权限，`migrate` 升级数据库后退出，`api` 持续提供 HTTP 服务。

复制环境变量模板：

::: code-group

```powershell [PowerShell]
Copy-Item .env.example .env
```

```bash [Bash]
cp .env.example .env
```

:::

<<< @/../samples/23-deployment/.env.example{dotenv:line-numbers} [.env.example]

把 `.env` 中的占位值换成自己的配置：

| 配置 | 填什么 |
| --- | --- |
| `Authority` | 可信身份服务的 HTTPS 地址，它需要提供 JWT 验证所需的元数据和公钥 |
| `Audience` | 身份服务为这个 API 配置的受众标识 |
| `Cors__Origins__0` | 允许读取 API 的前端源，例如 `https://todo.example.com`，末尾不加 `/` |

环境变量里的双下划线对应配置路径的冒号。数据库连接字符串由 Compose 单独设置为 `/data/todos.db`，不依赖容器的工作目录。

::: warning 开发令牌不能拿去正式上线
`dotnet user-jwts` 用于本机开发。本章的生产配置改为信任身份服务签发的访问令牌。你需要从该服务获取面向此 API 的令牌；写入操作还要求服务端识别到 `editor` 角色。不同服务的角色 claim 可能不同，要按其格式配置角色映射。

保留模板中的占位地址可以检查 `/health` 和匿名请求的 401，但不能完成有效令牌的认证。这不代表身份服务已经接通。
:::

生产环境如果没有 HTTPS `Authority` 或没有 `Audience`，示例会拒绝启动并提示缺少配置。这个检查只验证配置是否齐全，不证明远端身份服务可用。

## 创建数据库，再启动 API

仍在 `samples/23-deployment` 目录执行：

```bash
docker compose run --rm init-data
docker compose run --rm migrate
docker compose up -d api
```

`init-data` 只以 root 身份调整数据目录的所有权；迁移和 API 都用普通用户运行。迁移成功后，再启动 API，避免用户请求碰到还没更新完的表。

迁移使用 `MigrateAsync()` 应用尚未执行的变更，已执行过的迁移不会重复执行。本章仓库已包含两个迁移：创建初始表，再给 Todo 增加可空的 `Note` 列。这个列用于演示升级，暂未加入 HTTP 请求和响应。迁移文件与升级验证见[数据库迁移](../advanced/efcore-migrations)。

检查运行结果：

```bash
curl http://localhost:5080/health
curl -i http://localhost:5080/todos
curl -i http://localhost:5080/openapi/v1.json
curl -i http://localhost:5080/scalar
```

| 请求 | 预期 |
| --- | --- |
| `/health` | 200，响应体为 `{"status":"ok"}` |
| `/todos`，不带令牌 | 401 |
| `/openapi/v1.json` | 404 |
| `/scalar` | 404 |

OpenAPI 和 Scalar 只在 Development 环境注册。Production 环境仍保留错误处理中间件，不会把开发者异常页暴露给调用方。

## 让数据跟着应用升级保留下来

Compose 把命名数据卷 `todo-data` 挂载到 `/data`。替换容器时，数据库留在卷里，新的容器继续使用它。

用身份服务签发的 `editor` 令牌调用上一章的创建接口，记下返回的任务 ID。然后重建容器：

```bash
docker compose up -d --force-recreate api
```

再带令牌查询 `/todos/{id}`，应能读到之前的任务。`docker compose down` 停止并移除容器，但默认保留命名卷；**不要给它加 `--volumes` 或 `-v`，除非确定要删除数据。**

升级程序时，先备份数据库，再重新发布镜像；停止 API 后执行迁移，最后重新创建 API 容器。本例只有一个 API 实例，这会造成短暂不可用。SQLite 备份需要覆盖一致的数据状态，可以停止写入后备份，也可以使用 SQLite 的备份机制，不能在写入时随手复制单个 `.db` 文件就认为备份完成。

## 从本机验证到公网运行

这里的端口映射是 `127.0.0.1:5080:8080`，只允许宿主机访问。把镜像和 Compose 配置放到有 Docker 的服务器后，在同一台机器的反向代理上配置域名与 HTTPS，再把请求转发到 `127.0.0.1:5080`。前端的实际源也要加入 CORS 配置。

如果代理改变了请求的协议、主机名或客户端地址，应用需要按[代理与转发头文档](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0)配置受信任的代理。不要无条件信任公网发来的转发头。

GitHub Pages 托管的是本教程生成的静态网页，不能运行这个 ASP.NET Core API。API 需要能运行 .NET 或容器的主机。

排查启动问题可以用：

```bash
docker compose ps
docker compose logs --tail 100 api
docker compose logs --tail 100 migrate
```

| 现象 | 先检查 |
| --- | --- |
| API 启动时报告认证配置缺失 | `.env` 是否存在，Authority 与 Audience 是否填写 |
| SQLite 无法打开文件或只读 | 数据卷挂载路径，以及 `init-data` 是否成功 |
| 带令牌仍是 401 | 签发者、受众、签名、有效期和身份服务元数据是否匹配 |
| 可以查询，但写入返回 403 | 令牌里的角色能否映射为 `editor` |

## 自动验证发布前的行为

```bash
dotnet test --project Tests/TodoApi.Tests.csproj -c Release -p:TreatWarningsAsErrors=true
```

本章共 13 个测试用例：上一章的 11 个，再加生产环境行为和保留旧数据的迁移测试。CI 还会创建镜像、启动 Compose、重建容器，并确认数据库中的记录没有丢失。

::: fastapi
这和把 FastAPI 应用放进容器类似：程序在镜像里，环境配置在外部，持久数据放在数据卷中。容器不会替你完成认证配置和数据库升级。
:::

## 总结

- 发布产物携带程序，生产配置通过环境变量提供；开发启动配置不会自动用于正式运行。
- .NET SDK 可以直接创建容器镜像，应用用普通用户运行。
- 先执行数据库迁移，再启动 API；升级前备份真实数据。
- SQLite 文件放在数据卷中，重建容器后仍然保留。
- 存活检查成功只是第一步，还要验证认证、授权、数据持久化和公网 HTTPS。

上一章：[按功能组织项目](./project-structure)。主线到这里结束，下一步可以按需要阅读[进阶主题](../advanced/)。
