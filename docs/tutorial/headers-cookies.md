---
title: Header 与 Cookie
description: 用 [FromHeader] 读取请求头，通过 HttpRequest 读取 Cookie、HttpResponse 写入 Cookie，理解显式指定参数来源的时机。
---

# Header 与 Cookie

到目前为止，我们从 URL（路由、查询字符串）和请求正文里取数据。HTTP 请求还有一个部分：**请求头**（header）。客户端版本号、语言偏好、认证令牌都放在这里；**Cookie** 本质上也是一个名为 `Cookie` 的请求头。

本节的新概念：**当参数来源无法从名字和类型推断时，显式告诉框架去哪里找。**

<<< @/../samples/07-headers-cookies/Program.cs{1,16-33 cs:line-numbers} [07-headers-cookies/Program.cs]

## 运行与验证

```bash
dotnet run
```

curl 默认会发送 `User-Agent` 请求头：

```bash
curl http://localhost:5080/whoami
```

```json
{"userAgent":"curl/8.21.0","clientVersion":"未提供"}
```

用 `-H` 自己设置请求头：

```bash
curl http://localhost:5080/whoami -H "X-Client-Version: 2.1.0" -H "User-Agent: MyApp/1.0"
```

```json
{"userAgent":"MyApp/1.0","clientVersion":"2.1.0"}
```

`userAgent` 中的 curl 版本号会因你的环境而不同。

## 读取请求头

<<< @/../samples/07-headers-cookies/Program.cs{1,16-19 cs:line-numbers} [07-headers-cookies/Program.cs]

「查询参数」一章说过，不在路由模板中的简单类型参数默认来自查询字符串。所以要读取请求头，必须用 `[FromHeader]` **显式指定来源**。它来自第 1 行引入的 `Microsoft.AspNetCore.Mvc` 命名空间。

`Name = "User-Agent"` 指定了请求头的名字。**为什么需要单独写名字？**请求头的名字通常包含连字符（`User-Agent`、`X-Client-Version`），而 C# 的参数名里不能有连字符。`Name` 让你在 C# 中使用合法、符合惯例的参数名，同时对应到 HTTP 中的实际名字。请求头的名字不区分大小写。

必填和可选的规则和查询参数完全一样：

- `string userAgent` 不可为 null，是必填的。发送一个空的 `User-Agent` 时（`curl -H "User-Agent:"` 会去掉这个请求头），会得到 400：

  ```text
  Microsoft.AspNetCore.Http.BadHttpRequestException: Required parameter "string userAgent" was not provided from header.
  ```

- `string? clientVersion` 可为 null，不传时收到 `null`，第 19 行用 `??` 给出了默认显示值。

::: tip 提示
自定义请求头过去常用 `X-` 前缀（如 `X-Client-Version`）。现在的规范已经不再推荐这个前缀，但它在实际项目中仍然很常见，两种写法框架都能处理。
:::

::: fastapi
`[FromHeader(Name = "X-Client-Version")] string? clientVersion` 相当于 FastAPI 的 `x_client_version: str | None = Header(default=None)`。FastAPI 会自动把下划线转换成连字符；ASP.NET Core 则用 `Name` 显式指定。
:::

## 写入 Cookie

<<< @/../samples/07-headers-cookies/Program.cs{21-30 cs:line-numbers} [07-headers-cookies/Program.cs]

**Cookie** 是服务器让浏览器保存的一小段数据。浏览器之后每次访问同一个站点，都会自动把它带回来。常见用途是保存用户偏好、登录会话。

写入 Cookie 需要修改**响应头**，所以处理程序要拿到代表响应的对象。第 21 行的参数 `HttpResponse response` 就是它。`HttpResponse` 是框架认识的**特殊类型**：看到这个类型，框架不会去路由、查询字符串或请求体里找值，而是直接把当前请求的响应对象传进来。`HttpRequest`、`HttpContext`、`CancellationToken` 也是这样的特殊类型。

第 23～28 行的 `Cookies.Append` 会在响应中加入一个 `Set-Cookie` 头。用 `-i` 看看：

```bash
curl -i -X POST http://localhost:5080/preferences/theme/dark -c cookies.txt
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Set-Cookie: theme=dark; max-age=2592000; path=/; samesite=lax; httponly

{"saved":"dark"}
```

`-c cookies.txt` 让 curl 像浏览器一样把收到的 Cookie 保存到文件。`CookieOptions` 中的三个选项都有明确的用意：

| 选项 | 作用 | 为什么 |
| --- | --- | --- |
| `HttpOnly = true` | 页面中的 JavaScript 无法读取这个 Cookie | 即使网站被注入了恶意脚本，也偷不走它 |
| `SameSite = Lax` | 从其他网站发起的跨站请求（除了普通的链接跳转）不会携带它 | 防御跨站请求伪造（CSRF）攻击 |
| `MaxAge = 30 天` | 30 天后过期 | 不设置的话，关闭浏览器就会被删除 |

::: warning 注意
Cookie 保存在客户端，用户可以随意修改它的值。**不要在 Cookie 里存放可信的数据**，比如"当前用户是管理员"。身份认证需要使用加密签名的令牌，这是「认证」一章的内容。
:::

## 读取 Cookie

<<< @/../samples/07-headers-cookies/Program.cs{32-33 cs:line-numbers} [07-headers-cookies/Program.cs]

读取时用的是 `HttpRequest`，它的 `Cookies` 属性可以按名字取值，不存在时返回 `null`。

带上刚才保存的 Cookie 请求（`-b` 表示发送文件中的 Cookie）：

```bash
curl http://localhost:5080/preferences -b cookies.txt
```

```json
{"theme":"dark"}
```

不带 Cookie 时返回默认值：

```bash
curl http://localhost:5080/preferences
```

```json
{"theme":"light"}
```

你可能注意到了，读取请求头用的是 `[FromHeader]` 参数，读取 Cookie 却要通过 `HttpRequest`。这是因为 Minimal API **没有** `[FromCookie]` 这样的特性。Cookie 在 Web API 中不如请求头常用，框架选择不为它提供专门的绑定方式。

::: fastapi
FastAPI 的 `Cookie()` 参数在这里没有直接的对应，需要通过 `HttpRequest.Cookies` 读取；设置 Cookie 时的 `response.set_cookie(...)` 对应 `response.Cookies.Append(...)`。
:::

## 什么时候用 HttpRequest

既然 `HttpRequest` 能拿到请求的一切，为什么不总是用它，还要费心声明 `[FromHeader]` 参数？

因为**参数声明是给人和工具看的"接口说明"**：

- 读处理程序的签名，就知道它需要哪些输入、哪些是必填的；
- 缺少必填值时，框架会自动返回 400，不需要自己检查；
- OpenAPI 文档会列出这些请求头，Scalar 页面会给出对应的输入框。

直接读取 `HttpRequest` 时，这些信息都藏在处理程序内部，文档里看不到，缺值也需要自己处理。所以能用参数声明的，优先用参数声明；`HttpRequest` 留给没有专门绑定方式的场景，比如本节的 Cookie。

## 总结

- 请求头需要用 `[FromHeader(Name = "...")]` **显式指定来源**；`Name` 用来对应含连字符的 HTTP 名字。
- 必填和可选依然由类型决定：`string` 必填，`string?` 可选。
- `HttpRequest`、`HttpResponse`、`HttpContext` 是**特殊类型**，框架会直接传入当前请求或响应的对象。
- 用 `response.Cookies.Append` 写 Cookie，并设置 `HttpOnly`、`SameSite` 等安全选项；用 `request.Cookies["名字"]` 读 Cookie。Minimal API 没有 `[FromCookie]`。
- 优先用参数声明输入，因为它同时是接口说明、自动检查和文档来源。

下一章：[响应类型](./response-types)——让返回值同时描述所有可能的结果。上一章：[参数校验](./validation)。
