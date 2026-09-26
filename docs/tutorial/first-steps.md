---
title: 第一步
description: 用 dotnet new web 创建项目，用 MapGet 定义第一个端点，运行并验证它返回的 JSON。
---

# 第一步

本节的新概念只有一个：**端点**（endpoint）——"当某个 HTTP 请求到来时，执行哪段代码"。我们会写出一个返回 JSON 的端点，并顺带获得一份自动生成的交互式 API 文档。

这是本节最终的完整代码：

<<< @/../samples/02-first-steps/Program.cs{cs:line-numbers} [02-first-steps/Program.cs]

17 行，这就是一个完整的 Web API。本节重点理解第 15 行的端点；其余启动和文档配置先沿用这份代码，下面只解释运行它所需的要点。

## 创建项目

用 `web` 模板创建一个空的 Web 项目，然后添加两个依赖包：

```bash
dotnet new web -o FirstSteps
cd FirstSteps
dotnet add package Microsoft.AspNetCore.OpenApi
dotnet add package Scalar.AspNetCore
```

- `Microsoft.AspNetCore.OpenApi`：微软官方的包，负责根据你的代码**生成 OpenAPI 文档**（一份描述 API 的 JSON）。
- `Scalar.AspNetCore`：第三方开源包，把 OpenAPI 文档**渲染成可交互的网页**。

然后把 `Program.cs` 替换成上面的代码。项目文件现在是这样的：

<<< @/../samples/02-first-steps/FirstSteps.csproj{9-12 xml:line-numbers} [02-first-steps/FirstSteps.csproj]

高亮的 `ItemGroup` 就是 `dotnet add package` 帮你加上的两个依赖。

::: tip 提示
`dotnet add package` 不指定版本时，会安装与当前项目兼容的最新稳定版。你看到的版本号可能比上面更新，这没有关系。
:::

### 固定端口号

模板会在 `Properties/launchSettings.json` 里随机分配一个端口号。为了让你的输出和教程一致，本教程所有示例都把它改成了 `5080`：

<<< @/../samples/02-first-steps/Properties/launchSettings.json{8,10 json:line-numbers} [02-first-steps/Properties/launchSettings.json]

这个文件只在本机开发时生效（`dotnet run` 会读取它），部署时不会用到。第 10 行把运行环境设为 `Development`（开发环境），这一点在后面的逐行拆解中很重要。

::: info 技术细节
模板默认生成 `http` 和 `https` 两个配置。本教程只保留了 HTTP，避免你在一开始就处理本机开发证书的问题。生产环境中的 HTTPS 通常由反向代理或云平台负责，我们在「部署」一章再讨论。
:::

## 运行与验证

```bash
dotnet run
```

看到下面的输出，说明服务已经启动：

```text
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5080
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to shut down.
info: Microsoft.Hosting.Lifetime[0]
      Hosting environment: Development
info: Microsoft.Hosting.Lifetime[0]
      Content root path: /你的路径/FirstSteps
```

程序不会退出，它在等待请求。**另开一个终端**，发送一个请求：

```bash
curl -i http://localhost:5080/
```

`-i` 表示同时显示响应头。预期输出：

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Sat, 26 Sep 2026 08:56:22 GMT
Server: Kestrel
Transfer-Encoding: chunked

{"message":"你好，ASP.NET Core！"}
```

也可以直接在浏览器中打开 <http://localhost:5080/>。回到运行服务的终端，按 `Ctrl+C` 可以停止它。

:::: details 可选：查看交互式文档

服务运行时，打开 <http://localhost:5080/scalar>，你会看到一个 API 文档页面：左侧列出所有端点，点开 `GET /` 后可以直接点击 **Test Request** 发送请求并查看响应。

这个页面背后是一份 OpenAPI 文档，访问 <http://localhost:5080/openapi/v1.json> 可以看到原始内容，其中描述 `GET /` 的部分如下：

```json
"paths": {
  "/": {
    "get": {
      "tags": ["FirstSteps"],
      "responses": {
        "200": {
          "description": "OK",
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/AnonymousTypeOfstring" }
            }
          }
        }
      }
    }
  }
}
```

注意：**你没有写任何文档，也没有写任何注解。** 框架是从代码本身推断出来的——它知道这个端点响应 `GET /`，也知道返回的是一个包含 `message` 字符串属性的 JSON 对象。

::: fastapi
`/scalar` 页面相当于 FastAPI 自带的 `/docs`，`/openapi/v1.json` 相当于 `/openapi.json`。区别在于 ASP.NET Core 把"生成文档"和"展示文档"拆成了两个包，你可以自由选择展示工具。
:::

::::

## 逐行拆解

### 第 3～7 行：builder 与 app 两个阶段

<<< @/../samples/02-first-steps/Program.cs{3,5,7 cs:line-numbers} [02-first-steps/Program.cs]

**第 3 行** `WebApplication.CreateBuilder(args)` 创建一个**构建器**（builder），它预先准备好了 Web 应用需要的默认设置：读取配置文件、设置日志、准备好 Web 服务器等。`args` 是命令行参数，传进去之后你就可以在启动时通过命令行覆盖配置。

`var` 表示让编译器根据右边的表达式推断变量类型。在 VS Code 中把鼠标悬停在 `builder` 上，会显示它的真实类型是 `WebApplicationBuilder`。**类型是确定的，只是不用你手写。**

**第 5 行** `builder.Services` 是一个**服务集合**（service collection），可以理解为"应用在运行时需要用到的组件清单"。`AddOpenApi()` 往清单里加入了"生成 OpenAPI 文档"所需的组件。这里只是**登记**，并没有开始生成任何东西。服务如何被创建和使用，是「依赖注入」一章的主题，现在记住"`builder.Services.AddXxx()` = 登记一项能力"就够了。

**第 7 行** `Build()` 根据前面的配置和服务清单，构建出真正的应用对象 `app`（类型是 `WebApplication`）。

::: info 技术细节
为什么要分成两个阶段？`builder` 先准备配置和服务注册，`Build()` 再据此创建应用，之后用 `app` 定义如何处理请求。`Build()` 后服务注册集合变为只读，不能再增删注册；它不会冻结服务实例中的可变状态，也不保证服务实例的并发安全。服务的创建和生命周期会在[依赖注入](./dependency-injection)一章展开。
:::

::: warning 注意
`builder.Services.AddXxx()` 这类服务注册必须放在 `Build()` 之前，否则会抛出“服务集合为只读”的异常。
:::

### 第 9～13 行：只在开发环境中暴露文档

<<< @/../samples/02-first-steps/Program.cs{9-13 cs:line-numbers} [02-first-steps/Program.cs]

- `app.MapOpenApi()`：把 OpenAPI 文档发布在 `/openapi/v1.json`；
- `app.MapScalarApiReference()`：把 Scalar 文档页面发布在 `/scalar`。

它们被包在 `if (app.Environment.IsDevelopment())` 中。`app.Environment` 的值来自环境变量 `ASPNETCORE_ENVIRONMENT`，我们在 `launchSettings.json` 中把它设成了 `Development`。

**为什么只在开发环境开启？** API 文档会列出你所有的接口和数据结构，对攻击者来说是一份现成的地图。开发时它很方便，但在生产环境中默认不应公开。这是微软官方文档推荐的做法。

### 第 15 行：定义端点

<<< @/../samples/02-first-steps/Program.cs{15 cs:line-numbers} [02-first-steps/Program.cs]

这一行是本节的核心。一个**端点**由三部分组成：

| 组成部分 | 本例 | 含义 |
| --- | --- | --- |
| HTTP 方法 | `MapGet` 中的 **Get** | 只响应 GET 请求 |
| 路由模板（route template） | `"/"` | 只响应根路径 |
| 处理程序（handler） | `() => new { ... }` | 请求匹配时执行的代码 |

处理程序是一个 **Lambda 表达式**（lambda expression），也就是匿名函数：`()` 是参数列表（这里没有参数），`=>` 后面是返回值。同理还有 `MapPost`、`MapPut`、`MapDelete` 等方法，分别对应其他 HTTP 方法。

返回值 `new { Message = "..." }` 是一个**匿名类型**（anonymous type）的对象——不需要预先定义类，就能临时组合出一个有属性的对象。框架拿到返回的对象后，会自动把它**序列化**为 JSON，并设置 `Content-Type: application/json`。

你可能注意到了：代码里的属性名是大写开头的 `Message`，JSON 里却是小写开头的 `message`。**这是有意的设计**：C# 的命名惯例是属性用 PascalCase（大驼峰），而 JavaScript 等前端生态的惯例是 camelCase（小驼峰）。ASP.NET Core 默认在序列化时自动转换，让双方都能按自己的惯例写代码。

::: tip 提示
如果处理程序返回的是字符串（例如 `() => "Hello"`），框架会原样输出文本，`Content-Type` 是 `text/plain`；返回其他对象时才会序列化为 JSON。
:::

::: fastapi
第 15 行相当于 FastAPI 中用 `@app.get("/")` 装饰一个返回字典的函数。区别是 ASP.NET Core 不用装饰器，而是调用 `MapGet` 把处理函数"注册"进去。
:::

### 第 17 行：启动

最后一行 `app.Run()` 启动 Web 服务器并开始监听请求。它会一直阻塞，直到你按下 `Ctrl+C`，所以它总是 `Program.cs` 的最后一行。

::: info 技术细节
响应头中的 `Server: Kestrel` 表明处理请求的是 **Kestrel**——ASP.NET Core 内置的跨平台 Web 服务器。它随 ASP.NET Core 共享框架提供，在应用进程内运行，不需要另外启动一个 Web 服务器进程。
:::

需要练习编译错误诊断和热重载时，可以阅读[可选附录：开发工具练习](./development-tools)。它不影响本章对端点的理解。

## 总结

- `dotnet new web` 创建一个最小的 Web 项目，整个应用就写在 `Program.cs` 中。
- 启动代码先用 `builder` 准备服务，再用 `app` 注册端点；服务注册应放在 `Build()` 之前。
- **端点** = HTTP 方法 + 路由模板 + 处理程序，`app.MapGet("/", () => ...)` 定义了一个 GET 端点。返回对象会被自动序列化为 JSON，属性名转为 camelCase。
- `AddOpenApi` + `MapOpenApi` + `MapScalarApiReference` 根据代码自动生成交互式文档，出于安全考虑只在开发环境中开启。
- 用 `dotnet run` 启动服务，用 curl 验证响应；按 `Ctrl+C` 停止服务。

下一章：[路由参数](./path-params)——让 URL 中的一部分成为处理程序的参数。上一章：[C# 速览](./csharp-tour)。
