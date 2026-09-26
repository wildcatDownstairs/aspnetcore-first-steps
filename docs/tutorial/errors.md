---
title: 状态码与错误处理
description: 用 Problem Details 表达业务错误，并为符合条件的空错误响应和未处理异常生成不泄露内部信息的错误说明。
---

# 状态码与错误处理

上一章的 `404` 响应没有任何内容，客户端只知道"出错了"，不知道为什么。前几章里各种错误的格式也五花八门：绑定失败是一段纯文本，校验失败是一个 JSON，找不到路由则什么都没有。

本节的新概念：**问题详情**（Problem Details）——一种标准的错误响应格式。我们会用它表达业务错误，并统一处理符合条件的空错误响应和未处理异常。下面先用 curl 的默认请求验证 JSON 响应，再说明它的适用条件。

<<< @/../samples/09-errors/Program.cs{7,11-12,28-49 cs:line-numbers} [09-errors/Program.cs]

## 运行与验证

```bash
dotnet run
```

把一个待办事项标记为完成，第一次成功：

```bash
curl -X POST http://localhost:5080/todos/1/complete
```

```json
{"id":1,"title":"Buy milk","done":true}
```

再标记一次，得到 `409 Conflict`（冲突）和一段有说明的错误：

```bash
curl -i -X POST http://localhost:5080/todos/1/complete
```

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.10","title":"待办事项已完成","status":409,"detail":"id 为 1 的待办事项已经是完成状态，不能重复完成。","traceId":"00-eb960df5537d54d0822d3270697c268f-9f6dbe4c8a52e820-00"}
```

`traceId` 每次请求都不同，你看到的值会不一样。

## Problem Details 格式

把上面的响应体格式化一下：

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.10",
  "title": "待办事项已完成",
  "status": 409,
  "detail": "id 为 1 的待办事项已经是完成状态，不能重复完成。",
  "traceId": "00-eb960df5537d54d0822d3270697c268f-9f6dbe4c8a52e820-00"
}
```

这是 **RFC 9457** 定义的 Problem Details 格式，`Content-Type` 是专用的 `application/problem+json`：

| 字段 | 含义 |
| --- | --- |
| `type` | 标识错误类型的 URI，默认指向 HTTP 规范中对应状态码的说明 |
| `title` | 简短的、给人看的错误概括，同一类错误应该相同 |
| `status` | HTTP 状态码，和响应行中的一致 |
| `detail` | 针对这一次错误的具体说明 |
| `traceId` | 请求的追踪编号，ASP.NET Core 自动添加的扩展字段 |

**为什么要用标准格式？**客户端可以复用**一套**逻辑处理 Problem Details 响应，读取其中的 `status`、`title`、`detail` 等字段。客户端仍应检查响应类型，并为非 JSON 响应保留兜底处理。很多 HTTP 客户端库和 API 工具也认识这个格式。「参数校验」一章中的校验错误其实也是这个格式的扩展，多了一个 `errors` 字段。

`traceId` 的用处是**定位问题**：用户报告错误时提供这个编号，你就能在服务器日志中找到对应的请求记录（「日志」一章会用到它）。

## 业务错误：TypedResults.Problem

<<< @/../samples/09-errors/Program.cs{28-44 cs:line-numbers} [09-errors/Program.cs]

第 35～41 行处理了一个业务规则：已经完成的待办事项不能再完成一次。`TypedResults.Problem(...)` 生成一个 Problem Details 响应，你可以指定状态码、`title` 和 `detail`。第 28 行的返回类型中相应地加入了 `ProblemHttpResult`。

第 44 行的 `ProducesProblem(StatusCodes.Status409Conflict)` 为 OpenAPI 补充了 409 响应描述。为什么需要它？`ProblemHttpResult` 的状态码是在调用 `Problem(...)` 时指定的，单靠返回类型无法确定它是 409。打开 `/openapi/v1.json`，这个 POST 端点的 `responses` 会列出 `200`、`404`、`409`；其中 409 的媒体类型是 `application/problem+json`。`ProducesProblem` 只补充文档元数据，不会改变实际响应，也不会替你检查业务规则。

**为什么是 409，而不是 400？**请求本身没有任何问题（格式正确、参数合法），是资源的**当前状态**不允许这个操作。`409 Conflict` 正是为这种情况准备的。选对状态码能让客户端不看 `detail` 就知道该怎么处理：400 表示"改改你的请求再试"，409 表示"资源状态变了，先刷新一下"。

常见的错误状态码：

| 状态码 | 含义 | 典型场景 |
| --- | --- | --- |
| `400 Bad Request` | 请求本身有问题 | 格式错误、校验失败 |
| `401 Unauthorized` | 没有登录（未认证） | 缺少或无效的令牌 |
| `403 Forbidden` | 登录了但没有权限 | 普通用户访问管理功能 |
| `404 Not Found` | 资源不存在 | id 不存在 |
| `409 Conflict` | 与资源当前状态冲突 | 重复操作、版本冲突 |
| `500 Internal Server Error` | 服务器内部错误 | 未处理的异常 |

::: tip 提示
`StatusCodes.Status409Conflict` 是框架提供的常量，和直接写 `409` 等价。用常量的好处是可读性更好，也不会写错数字。
:::

## 让空响应也有内容

<<< @/../samples/09-errors/Program.cs{7,12,22-26 cs:line-numbers} [09-errors/Program.cs]

第 22～26 行和上一章完全一样，找不到时返回 `TypedResults.NotFound()`，一个空的 404。但现在请求不存在的 id：

```bash
curl -i http://localhost:5080/todos/99
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"00-89e72e72b0724704260ef30ead4c62b0-7b0d90993376a8c3-00"}
```

响应体自动变成了 Problem Details。这是两行代码配合的结果：

- **第 7 行** `AddProblemDetails()`：注册生成 Problem Details 的服务，其他组件需要生成错误响应时会使用它；
- **第 12 行** `UseStatusCodePages()`：为符合条件的 400～599 响应补充内容；这里的空 404 会交给 Problem Details 服务处理。

::: info 技术细节
状态码页只处理响应尚未开始、状态码在 400～599 之间，而且未设置 `Content-Length` 和 `Content-Type` 的响应。仅仅“响应体为空”还不够：即使没有写入正文，设置了 `Content-Type` 或 `Content-Length: 0` 也会让它跳过。它不会改写端点已经生成的错误内容。
:::

它甚至对根本不存在的路由也有效：

```bash
curl -i http://localhost:5080/nothing-here
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"00-4d4857384b8d1dd421304c5d187d7a78-199a0d8a7972567f-00"}
```

**为什么不在每个处理程序里都写 `TypedResults.Problem(...)`？**对于"找不到"这类通用错误，状态码本身已经说清楚了，每次都手写一遍既啰嗦又容易不一致。让处理程序返回简单的 `NotFound()`，由统一的机制补全格式；只有需要额外说明的业务错误，才用 `Problem(...)` 写出具体的 `detail`。

## 未处理的异常

<<< @/../samples/09-errors/Program.cs{11,46-49 cs:line-numbers} [09-errors/Program.cs]

第 46～49 行的端点模拟了一个意外：代码抛出了异常，而且没有任何地方捕获它。

```bash
curl -i http://localhost:5080/crash
```

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Cache-Control: no-cache,no-store

{"type":"https://tools.ietf.org/html/rfc9110#section-15.6.1","title":"An error occurred while processing your request.","status":500,"traceId":"00-4a7b5bf94fc135b5b5c01580b95299c7-862cabea5a9180c8-00"}
```

**第 11 行** `UseExceptionHandler()` 捕获了这个异常，返回一个 500 的 Problem Details。注意响应里**没有**异常消息"数据库连接字符串未配置"，也没有堆栈信息。

**这是有意的安全设计。**异常消息和堆栈可能包含文件路径、数据库结构、配置项名称，这些对攻击者都是有价值的线索。客户端只需要知道"服务器出错了"和 `traceId`；详细信息写在服务器的日志里。看看运行 `dotnet run` 的终端：

```text
fail: Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware[1]
      An unhandled exception has occurred while executing the request.
      System.InvalidOperationException: 数据库连接字符串未配置
         at Program.<>c.<<Main>$>b__0_2() in /你的路径/09-errors/Program.cs:line 48
```

::: info 技术细节
你可能记得，前几章中绑定失败时，终端输出了一大段带堆栈的纯文本。那是**开发者异常页**（Developer Exception Page）：在开发环境中，如果你没有配置异常处理，框架会自动启用它，把异常详情直接返回给客户端，方便调试。

本节显式调用了 `UseExceptionHandler()`，它会先于开发者异常页捕获到异常，所以即使在开发环境下，你看到的也是生产环境的行为。这样你在开发时就能看到客户端最终会收到什么。想看详细信息，就去读终端日志。
:::

::: warning 注意
这两个中间件都依赖第 7 行的 `AddProblemDetails()`，漏掉它时的表现却不一样：

- `UseExceptionHandler()` 会让应用在**启动时**直接失败，错误信息提示你配置 `AddProblemDetails()`；
- `UseStatusCodePages()` 则**不会报错**，只是悄悄改用纯文本，空的 404 会变成 `Status Code: 404; Not Found`。

后者更隐蔽。如果发现错误响应不是 JSON，先检查是否注册了 `AddProblemDetails()`，再检查请求的 `Accept` 和响应是否满足状态码页的处理条件。
:::

::: info 技术细节
中间件生成 Problem Details 时，还需要写入器支持客户端在 `Accept` 请求头中声明的媒体类型。这叫**内容协商**（content negotiation）。上面的 curl 命令默认发送 `Accept: */*`，可以得到 JSON；如果改成 `Accept: text/html`，本例的 `/nothing-here` 会回退为纯文本 404，`/crash` 则返回没有响应体的 500。注册 `AddProblemDetails()` 并不保证每个错误都能生成 JSON，也不会在协商失败时泄露异常详情。
:::

`app.UseXxx()` 这类调用叫**中间件**（middleware），它们会依次处理每个请求和响应。为什么它们写在 `MapGet` 之前、顺序是否重要，是「中间件」一章的主题。现在只需要记住：错误处理相关的中间件写在最前面。

::: fastapi
`TypedResults.Problem(...)` 类似 FastAPI 中用 `raise HTTPException(...)` 表达业务错误，但这里通过返回结果表达，使用的响应格式也不同。未处理异常的全局处理类似 FastAPI 的 `@app.exception_handler(Exception)`。
:::

## 总结

- **Problem Details**（RFC 9457）是标准的错误响应格式，包含 `type`、`title`、`status`、`detail`，`Content-Type` 为 `application/problem+json`。
- 业务错误用 `TypedResults.Problem(statusCode, title, detail)` 返回，并选择恰当的状态码；用 `ProducesProblem` 为这类动态指定的状态码补充 OpenAPI 描述。
- `AddProblemDetails()` + `UseStatusCodePages()` 为符合条件的空错误响应补充 Problem Details；生成 JSON 还取决于请求的 `Accept`。
- `UseExceptionHandler()` 把未处理的异常转换成不含内部细节的 500 响应，异常详情只写进服务器日志，用 `traceId` 关联。
- 预期内的错误**返回**结果，意料之外的错误才交给异常处理。

下一章：[路由分组](./route-groups)——用 `MapGroup` 组织相关的端点。上一章：[响应类型](./response-types)。
