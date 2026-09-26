---
title: 测试
description: 用 xUnit 和 WebApplicationFactory 把 Todo API 的手动检查变成集成测试，验证响应、数据与访问权限。
---

# 测试

每次改完代码，都手动发一遍 curl，很容易漏掉某个错误分支。这一章把“创建任务，再读回来核对”写成**集成测试**（integration test）：让一次请求经过路由、校验、认证、处理程序和 SQLite，然后检查结果。

先看第一个完整测试文件。API 沿用第 20 章，本章新增 `Tests` 项目：

<<< @/../samples/21-testing/Tests/CreateTodoTests.cs{6-19 cs:line-numbers} [Tests/CreateTodoTests.cs]

这个文件需要下面的测试工厂和项目配置，均已包含在仓库中。

:::: details 完整测试工厂与项目配置
::: code-group

<<< @/../samples/21-testing/Tests/TodoApiFactory.cs{16-20,26-43 cs:line-numbers} [Tests/TodoApiFactory.cs]

<<< @/../samples/21-testing/Tests/TodoApi.Tests.csproj{10-15 xml:line-numbers} [Tests/TodoApi.Tests.csproj]

<<< @/../samples/21-testing/global.json{json:line-numbers} [global.json]

<<< @/../samples/21-testing/TestAccess.cs{cs:line-numbers} [TestAccess.cs]

<<< @/../samples/21-testing/Testing.csproj{xml:line-numbers} [Testing.csproj]

:::
::::

## 运行与验证

从仓库根目录执行：

```bash
cd samples/21-testing
dotnet test --project Tests/TodoApi.Tests.csproj
```

不需要先 `dotnet run`，也不需要生成开发 JWT。摘要中的结果应为下面这样，耗时和完整路径因机器而异：

```text
测试运行摘要: 已通过!
  总计: 11
  失败: 0
  成功: 11
  已跳过: 0
```

示例使用 **xUnit** 测试框架，并在本章 `global.json` 中选择 .NET 10 的 **Microsoft Testing Platform（MTP）** 测试运行器。因此命令使用 `--project` 指定测试项目；请从本章目录执行，让 SDK 找到这份配置。xUnit 包名中的 `v3` 是产品系列名，与包版本号不必相同。[xUnit 入门](https://xunit.net/docs/getting-started/v3/getting-started)

## 一条测试检查什么

`[Fact]` 标出一条测试。方法名描述要验证的行为：创建成功后，可以读取保存的数据。方法分三步：

1. 创建测试应用，取得带 editor 身份的 `HttpClient`。
2. 向 `/todos` 发送 JSON 请求。
3. 用**断言**（assertion）核对状态码、Location，以及再次读取的任务内容。

`PostAsJsonAsync` 把对象序列化为 JSON，并设置请求的 Content-Type；`GetFromJsonAsync<TodoResponse>` 将响应反序列化为指定类型。这里使用前面已有的 DTO，不再手动解析 JSON 字符串。

为什么不只检查 `201`？处理程序可能返回了成功，却没有保存任务，或者 Location 指向了错误的编号。再读一次，才能确认客户端拿到的地址确实可用。

`TestContext.Current.CancellationToken` 来自测试运行器，取消测试时可以中止尚未完成的 HTTP 操作。`using` 和 `await using` 则在测试结束后释放客户端、测试应用及数据库连接。

## WebApplicationFactory 做了什么

`WebApplicationFactory<Program>` 创建测试宿主，用测试服务器处理 `HttpClient` 发出的请求，不占用真实的 5080 端口。`Program` 指应用入口；`TestAccess.cs` 中的公开部分声明让另一个项目能引用这个类型，不会新增 HTTP 端点。

`Microsoft.AspNetCore.Mvc.Testing` 虽然名字里有 Mvc，同样可以测试 Minimal API，不需要引入控制器。[ASP.NET Core 集成测试](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0)

测试工厂替换了两项配置：

| 配置 | 测试中的处理 | 原因 |
| --- | --- | --- |
| 数据库 | 每个工厂单独打开一个 SQLite 内存连接 | 不读写练习用的数据库文件，测试之间不会争抢编号 |
| JWT | 每个工厂生成随机签名密钥，创建短期测试令牌 | 不依赖本机 User Secrets，也不用连接外部身份服务 |

这里仍然使用真实的 SQLite 提供程序和 JWT 验证处理器。只是更换数据库位置和可信签发者配置，没有把“允许访问”写死。工厂里的签发代码仅属于测试项目，不是登录接口。

::: info 技术细节
SQLite 内存数据库在连接关闭时消失，所以工厂先打开连接，等测试应用释放后再关闭。还要移除旧的 `DbContextOptions` 及其配置注册，避免两套连接配置一起生效。同一个工厂中的请求共享这份测试库；本例每条测试创建自己的工厂，并顺序发送请求。
:::

## 错误分支也要检查

下面是其余测试的完整文件：

::: details 校验、认证、角色与更新删除测试
<<< @/../samples/21-testing/Tests/TodoApiTests.cs{cs:line-numbers} [Tests/TodoApiTests.cs]
:::

`[Theory]` 配合 `[InlineData]`，让同一段测试分别使用多组输入。空标题有两组，禁止写入有 POST、PUT、DELETE 三组，所以测试方法数与最终用例数不同。

这些测试检查的不只是状态码：

- 标题为空或分类不存在：返回 400，列表仍然为空。
- 编号不存在：返回 404。
- 没有令牌或令牌无效：返回 401。
- 普通读者尝试创建、修改、删除：返回 403，原任务和条数不变。
- 编辑者修改后重新读取，再删除并查询：依次确认保存成功和 404。

## 故意改错一次

在本章 `Program.cs` 的 POST 注册末尾，临时移除 `RequireAuthorization("CanWriteTodos")`，保留分组上的认证要求，再运行测试。

`Reader_cannot_write` 的 POST 用例应失败：预期是 `Forbidden`（403），实际却变成 `Created`（201）。这说明普通读者获得了写权限。把策略调用恢复，11 个用例应重新全部通过。

这样，第 22 章拆分文件时就有了检查依据：文件可以换位置，客户端看到的行为应保持一致。

::: warning 注意
这些是 API 集成测试，不会验证浏览器是否执行 CORS，也不会验证反向代理、TLS 或外部身份服务的登录流程。涉及浏览器和部署的行为仍要在相应环境检查。
:::

::: fastapi
这类似用 pytest 和 TestClient 调用 FastAPI 应用，再断言状态码和 JSON。这里由 WebApplicationFactory 创建测试应用，测试工厂负责替换数据库与认证配置。
:::

## 总结

- 集成测试通过请求验证多个组件一起工作的结果，不必手动启动 API。
- `[Fact]` 写单个案例，`[Theory]` 用同一段代码验证多组输入。
- 成功响应要检查内容和后续读取，拒绝写入还要检查数据没有被修改。
- 每条测试使用独立数据库和测试签名密钥，结果不依赖运行顺序。
- 重构前先跑通测试，改完再跑，及时发现响应和权限变化。

下一章：[按功能组织项目](./project-structure)——把同一功能的代码放在一起。上一章：[CORS](./cors)。
