---
title: 中间件
description: 理解 ASP.NET Core 的请求处理管道：用 app.Use 编写中间件，观察请求"进入"与"离开"的顺序、短路，以及为什么中间件的注册顺序很重要。
---

# 中间件

同一个请求，既要记录耗时，又要检查是否处于维护模式。把这些代码复制进每个端点很麻烦，可以放到端点外统一处理。

这些处理环节叫**中间件**（middleware），按顺序组成**请求管道**（request pipeline）。前面用过的异常处理也是中间件；这一章自己写三个，观察它们如何调用下一步。

<<< @/../samples/13-middleware/Program.cs{16-48 cs:line-numbers} [13-middleware/Program.cs]

本节示例用 `Console.WriteLine` 输出执行顺序，这样最直观。下一章会介绍正式的做法：日志。

## 运行与验证

```bash
dotnet run
```

另开一个终端，发送请求：

```bash
curl -i http://localhost:5080/hello
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
X-Elapsed-Ms: 1

{"message":"你好"}
```

回到运行服务的终端，会看到这样的输出：

```text
→ [1] 进入：GET /hello
→ [2] 进入：开始计时
● 端点：处理请求
← [2] 离开
← [1] 离开：200
```

再加上 `?maintenance` 参数请求一次：

```bash
curl -i "http://localhost:5080/hello?maintenance"
```

```http
HTTP/1.1 503 Service Unavailable
Content-Length: 0
X-Elapsed-Ms: 1
```

```text
→ [1] 进入：GET /hello
→ [2] 进入：开始计时
■ [3] 维护中，请求被拦截
← [2] 离开
← [1] 离开：503
```

这次端点没有执行。`X-Elapsed-Ms` 的值取决于机器速度，可能是 0 或其他数字。

## 管道模型

把第一次请求的输出画出来：

```text
请求 ──► [1] ──► [2] ──► [3] ──► 端点
                                   │
响应 ◄── [1] ◄── [2] ◄── [3] ◄─────┘
```

一个中间件可以在调用下一步之前和之后分别执行代码。看第一个中间件：

<<< @/../samples/13-middleware/Program.cs{17-22 cs:line-numbers} [13-middleware/Program.cs]

- `context` 是 `HttpContext`，包含本次请求和响应的全部信息；
- `next` 代表**管道中的下一个环节**；
- 第 20 行 `await next(context)` 把请求交给下一个环节，并**等待它执行完毕**。

第 19 行先执行，第 21 行等后续代码正常返回后再执行，所以本例能记录到 `200` 或 `503`。这不表示响应此时还没发送：端点可能已经写出了响应体。如果后续代码抛出未处理的异常，`await next(context)` 后面的普通语句也不会执行；必须执行的清理代码应放在 `finally` 中。

这样写，计时可以在 `next` 之前开始、之后结束；异常处理可以用 `try/catch` 包住 `next`。两部分代码放在一起，端点也不用重复做这些事。

::: fastapi
和 FastAPI 的 `@app.middleware("http")` 几乎一模一样：`response = await call_next(request)` 对应 `await next(context)`，它前面的代码处理请求，后面的代码处理响应。
:::

## 修改响应头

<<< @/../samples/13-middleware/Program.cs{25-36 cs:line-numbers} [13-middleware/Program.cs]

中间件 2 想在响应头里写入耗时。直觉上应该在 `await next(context)` 之后写，但那时响应可能**已经开始发送**了：HTTP 响应先发送状态行和响应头，再发送响应体。一旦端点开始写响应体，响应头就已经发出去了，再修改会抛出异常。

所以第 28～32 行用 `Response.OnStarting` 注册回调，在响应头即将发送时写入耗时。此时响应头还可以修改，响应体却不一定已经生成完，例如流式响应还会继续产生内容。

::: info 技术细节
`X-Elapsed-Ms` 记录的是从进入中间件 2 到开始发送响应的时间，不是客户端收完整个响应的耗时。
:::

## 短路

<<< @/../samples/13-middleware/Program.cs{39-48 cs:line-numbers} [13-middleware/Program.cs]

中间件 3 检查查询字符串中是否有 `maintenance`。如果有，就设置状态码 503（服务不可用）并直接 `return`，**不调用 `next`**。

不调用 `next`，后面的环节就不会执行，这叫**短路**（short-circuit）。中间件 3 正常返回后，前面的 1 和 2 继续执行，所以仍能记录 503 和耗时。

内置中间件也会短路：授权检查发现受保护端点缺少有效身份时，可以返回 401；CORS 中间件处理预检后返回；静态文件中间件找到文件后返回文件内容。注意，JWT **认证**负责验证令牌、建立身份，不会仅因令牌无效就拦截所有请求；是否允许访问，还要看端点的授权要求。

## 为什么顺序很重要

你用 `app.Use...` 添加的中间件按调用顺序排列。前面的中间件可以调用后面的，也可以直接返回。

把本节的例子换一个顺序想一想：

- 如果把中间件 3 放在最前面，维护模式下的请求在进入中间件 1 之前就被拦截了，中间件 1 根本不会记录它们。
- 如果把中间件 2 放在最后，它测量的时间就不包括前面环节的耗时。

对于内置中间件，顺序直接关系到正确性和安全性：

| 中间件 | 放置位置 | 原因 |
| --- | --- | --- |
| `UseExceptionHandler` | 需要捕获异常的环节之前 | 只能捕获后续环节抛出的异常 |
| `UseStatusCodePages` | 靠前 | 只能处理后面环节产生的空错误响应 |
| `UseCors` | 路由之后，认证授权之前 | 先按 CORS 策略处理预检，再对实际请求检查身份和权限 |
| `UseAuthentication` | 授权之前 | 先知道"你是谁"，才能判断"你能做什么" |
| `UseAuthorization` | 端点之前 | 没有权限的请求应该在执行端点之前被拦下 |

第 09 章把异常处理放在靠前的位置，是为了捕获后续处理中的异常。认证和授权的完整顺序会在第 18～20 章用到。

::: warning 注意
顺序写错不一定会在启动时暴露。例如，放在异常处理中间件之前的代码抛出异常，它就捕获不到。添加内置中间件时，请对照[官方推荐顺序](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/middleware/?view=aspnetcore-10.0#middleware-order)。
:::

::: info 技术细节
本例没有显式调用 `UseRouting()`，`WebApplication` 会把路由匹配安排在自定义中间件之前，把端点执行安排在它们之后。因此这里可以通过 `context.GetEndpoint()` 读取已匹配的端点；没有匹配结果时得到 `null`。如果手动调整路由中间件的位置，就要重新考虑这一顺序。
:::

## 总结

- **中间件**是请求处理管道中的环节，用 `app.Use(async (context, next) => { ... })` 编写。
- `await next(context)` 调用后续环节；后续代码正常返回后，才继续执行它后面的语句。
- 响应头要在发送之前修改，可以用 `Response.OnStarting` 注册回调。
- 不调用 `next` 就是**短路**：后续环节不再执行，前面的中间件照常完成回程。
- 自定义中间件按注册顺序排列；异常处理放在要保护的代码之前，认证在授权之前。

下一章：[日志](./logging)——用 `ILogger` 代替 `Console.WriteLine`。上一章：[配置与 Options](./configuration)。
