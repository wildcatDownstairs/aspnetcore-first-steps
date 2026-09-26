---
title: 按功能组织项目
description: 用 feature-first 组织 Todo API，让同一功能的实体、DTO、服务和端点放在一起，并用测试确认重构不改变接口行为。
---

# 按功能组织项目

现在 `Program.cs` 里有启动配置、认证和整套 CRUD。修改 Todo 时，要在这些不相关的代码之间来回找。这一章按功能拆分，也叫 **feature-first（按功能组织）**：同一功能的实体、DTO、服务和端点放在同一个目录。

这是一次**重构**（refactoring）：接口路径、请求字段、响应内容和权限都不变。拆分后的入口文件如下：

<<< @/../samples/22-project-structure/Program.cs{3-5,14-15,35-37 cs:line-numbers} [Program.cs]

其余完整文件按功能列在下面；示例可独立运行，不引用上一章的项目。

:::: details Todo 功能的完整文件
::: code-group

<<< @/../samples/22-project-structure/Features/Todos/TodoEndpoints.cs{7-14 cs:line-numbers} [Features/Todos/TodoEndpoints.cs]

<<< @/../samples/22-project-structure/Features/Todos/TodoService.cs{7-14,17-24 cs:line-numbers} [Features/Todos/TodoService.cs]

<<< @/../samples/22-project-structure/Features/Todos/TodoDtos.cs{cs:line-numbers} [Features/Todos/TodoDtos.cs]

<<< @/../samples/22-project-structure/Features/Todos/Todo.cs{cs:line-numbers} [Features/Todos/Todo.cs]

:::
::::

:::: details 认证与数据库的完整文件
::: code-group

<<< @/../samples/22-project-structure/Features/Auth/AuthConfiguration.cs{cs:line-numbers} [Features/Auth/AuthConfiguration.cs]

<<< @/../samples/22-project-structure/Features/Auth/AuthEndpoints.cs{cs:line-numbers} [Features/Auth/AuthEndpoints.cs]

<<< @/../samples/22-project-structure/Data/TodoDbContext.cs{cs:line-numbers} [Data/TodoDbContext.cs]

<<< @/../samples/22-project-structure/Data/TodoDatabase.cs{cs:line-numbers} [Data/TodoDatabase.cs]

:::
::::

## 先跑测试，再启动应用

从仓库根目录执行：

```bash
cd samples/22-project-structure
dotnet test --project Tests/TodoApi.Tests.csproj
```

仍然应是 **11 个通过、0 个失败、0 个跳过**。测试请求和断言与第 21 章相同；因为类型搬进了命名空间，测试只增加了导入：

<<< @/../samples/22-project-structure/Tests/GlobalUsings.cs{cs:line-numbers} [Tests/GlobalUsings.cs]

手动运行时，先停止其他章的服务，为本章生成开发令牌：

```bash
dotnet user-jwts create --name alice --role editor --valid-for 1h --output token
dotnet run
```

在另一个终端中，按[第 18 章](./authentication)的方式将完整令牌存入 `TOKEN` 变量，再请求：

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5080/todos
```

首次运行时，本章独立的 `todos-22.db` 没有任务，返回 `[]`。第 17～20 章的创建、修改、删除命令仍然适用。

## 先找功能，再找文件

主要代码的目录如下，配置和测试文件也保留在本章项目中：

```text
22-project-structure/
├── Program.cs
├── Features/
│   ├── Todos/
│   │   ├── Todo.cs
│   │   ├── TodoDtos.cs
│   │   ├── TodoService.cs
│   │   └── TodoEndpoints.cs
│   └── Auth/
│       ├── AuthConfiguration.cs
│       └── AuthEndpoints.cs
├── Data/
│   ├── TodoDbContext.cs
│   └── TodoDatabase.cs
└── Tests/
```

例如给 Todo 增加一个可编辑字段，先打开 `Features/Todos`，在这里找到存储属性、输入输出类型和处理逻辑。不要先到全局 Models 找实体，再到 Services 找服务，最后到 Endpoints 找路由。

组织方式参考 [mini-store-api](https://github.com/wildcatDownstairs/mini-store-api)：实体、DTO、Service、Endpoints 归所属功能，共享上下文留在 Data。这里的分类只有两个固定值，属于 Todo 功能，还不需要单独创建一个 Categories 模块。

## 每个文件负责什么

| 文件 | 放什么 | 修改示例 |
| --- | --- | --- |
| `Todo.cs` | Todo 和 Category 实体 | 增加要存入数据库的属性 |
| `TodoDtos.cs` | 请求、响应以及本功能的操作结果类型 | 调整客户端可以提交的字段 |
| `TodoService.cs` | 查询、分类存在性检查和保存操作 | 修改任务的业务规则 |
| `TodoEndpoints.cs` | 路由、权限、参数接收和 HTTP 结果 | 调整路径或写入权限 |
| `TodoDbContext.cs` | 共享的表入口和数据库映射 | 配置实体关系 |
| `Program.cs` | 注册服务、安排中间件、挂载功能 | 添加一个新的功能入口 |

`TodoService` 不接收 `HttpContext`，也不决定返回 400 还是 404。例如替换操作返回 `ReplaceOutcome`，端点再映射为 HTTP 结果。这里的 **enum（枚举）** 只是给“更新成功、任务不存在、分类不存在”三个结果起名字，避免用数字猜含义。

请求字段校验仍由端点上的内置校验完成；分类是否存在仍由服务查询数据库。移动文件没有改变这两项检查的职责。

## MapTodoEndpoints 怎样接回 Program

`TodoEndpoints` 是一个静态类。`MapTodoEndpoints` 的第一个参数写成 `this WebApplication app`，这是**扩展方法**（extension method）：于是入口可以写 `app.MapTodoEndpoints()`，里面仍然是熟悉的 `MapGroup`、`MapGet`、`MapPost`。

处理方法可以直接作为参数传给 `MapGet` 等方法，不必都写成长 lambda。第 11 行的 `GetAsync` 就是本文件里的方法名。[Minimal API 路由处理方法](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis/route-handlers?view=aspnetcore-10.0)

`namespace TodoApi.Features.Todos;` 是**命名空间**（namespace）声明，用来区分类型所属位置。入口通过 `using TodoApi.Features.Todos` 使用这些类型和扩展方法。目录与命名空间保持对应，便于查找；C# 不要求二者必须一致。

::: info 技术细节
C# 14 也支持扩展成员块。本章保留 `this` 参数的扩展方法写法，它仍然受支持，而且这里只需定义一个方法，不必额外引入新的语法结构。
:::

## 为什么共享 DbContext 留在 Data

业务实体归功能所有，但一个请求可能同时修改多个功能的数据。共享上下文让这些操作有机会在一次保存或同一个事务中完成。按功能分目录，并不要求一个目录配一个数据库。

`TodoService` 注册为 Scoped，和上下文的默认生命周期一致。当前项目只有一个实现，直接注入这个具体类即可；本章没有为它额外增加 `ITodoService` 或 Repository。

也不需要先建立一个空的 Common 目录。确实出现多个功能共用的代码时，再判断它是否适合提取。本章保留 CORS 配置在入口，是因为它服务于整个 API。

## 拆分是否值得

这个 Todo API 直接在端点里使用 DbContext 也能工作。这里提取 Service，是为了演示 mini-store-api 中“端点决定 HTTP 响应，服务完成业务操作”的组织方式；它不是 Minimal API 的硬性要求。

一个新功能只有两条简单查询时，可以先把端点和相关类型放在功能目录里。业务规则变多、需要复用时，再把操作提取到 Service。目录是为了缩小查找范围，不是要求每个功能必须凑齐相同数量的文件。

::: fastapi
这类似按业务包组织 router、schema 和业务函数，再在应用入口注册 router。ASP.NET Core 这里通过扩展方法挂载端点，通过依赖注入提供服务。
:::

## 总结

- feature-first 把同一功能的实体、DTO、服务和端点放在一起。
- 端点负责 HTTP 和权限，服务处理数据与业务规则，共享上下文留在 Data。
- 扩展方法把功能路由接回入口；Program.cs 保留启动配置和中间件顺序。
- 不为目录形式补空文件，也不强制给单个实现增加接口层。
- 用上一章相同的请求与断言验证重构，保持接口行为不变。

下一章：[发布与部署](./deployment)——把整理好的应用发布出去。上一章：[测试](./testing)。
