---
title: CORS
description: 为独立前端配置精确的跨源策略，实际验证预检、Authorization 请求头和 Location 响应头，并区分 CORS 与授权。
---

# CORS

API 在 5080 端口，前端页面在 5178 端口，浏览器默认不允许页面读取这个 API 的响应。这一章配置**跨源资源共享**（Cross-Origin Resource Sharing，CORS），允许本地前端调用 API 并读取结果。

在上一章代码中添加 CORS 策略，完整文件如下：

<<< @/../samples/20-cors/Program.cs{19-23,29-32 cs:line-numbers} [20-cors/Program.cs]

<<< @/../samples/20-cors/Models.cs{cs:line-numbers} [20-cors/Models.cs]

<<< @/../samples/20-cors/TodoDbContext.cs{cs:line-numbers} [20-cors/TodoDbContext.cs]

允许的前端地址来自配置：

<<< @/../samples/20-cors/appsettings.json{13-17 json:line-numbers} [20-cors/appsettings.json]

## 先分清什么是源

**源**（origin）由协议、主机和端口共同决定：

| 地址 | 与 `http://localhost:5080` 是否同源 |
| --- | --- |
| `http://localhost:5080/todos` | 是，路径不同不影响源 |
| `http://localhost:5178` | 否，端口不同 |
| `http://127.0.0.1:5080` | 否，主机不同 |
| `https://localhost:5080` | 否，协议不同 |

浏览器的**同源策略**（same-origin policy）限制脚本读取其他源的响应。配置 CORS 后，服务器可以允许指定源的页面读取响应。

## 启动 API

停止上一章服务，在仓库根目录执行：

```bash
cd samples/20-cors
dotnet user-jwts create --name alice --role editor --valid-for 1h --output token
dotnet run
```

复制工具输出的完整令牌备用。令牌必须在本章项目里生成；数据库使用新的 `todos-20.db`，初始 Todo 列表为空，分类仍为 Work（1）和 Life（2）。

## 用真正的浏览器页面验证

示例附带一个 HTML 页面，用 Node.js 提供本地访问地址，不需要安装 npm 包：

<<< @/../samples/20-cors/browser/index.html{24-35 html:line-numbers} [20-cors/browser/index.html]

<<< @/../samples/20-cors/browser/serve.mjs{js:line-numbers} [20-cors/browser/serve.mjs]

另开终端，同样进入 `samples/20-cors`，执行：

```bash
node browser/serve.mjs
```

预期输出：

```text
打开 http://localhost:5178/
```

必须通过这个 HTTP 地址打开页面，不要双击 HTML 以 `file://` 打开。把令牌粘贴到页面的输入框，点击“读取 Todo”，首次运行得到：

```text
HTTP 200
Location: (无)
[]
```

再点击“创建 Todo”，得到：

```text
HTTP 201
Location: /todos/1
{"id":1,"title":"Browser todo","done":false,"categoryId":1}
```

编号以新数据库为前提；再次点击会创建新任务。令牌只保留在当前页面内存中，不写入 localStorage、Cookie 或服务器文件。

## 预检：先问能不能发，再发实际请求

打开浏览器开发者工具的 Network 面板，可以看到 **OPTIONS 预检请求**（preflight request）。本例手动发送 `Authorization`，POST 还使用 `application/json`，这些条件会触发预检；并非只有 POST 才会预检。浏览器可能缓存预检结果，所以不一定每次点击都出现 OPTIONS。

用 curl 可以查看预检响应。下面的命令不带 JWT，也不会创建 Todo：

```bash
curl -i -X OPTIONS http://localhost:5080/todos -H "Origin: http://localhost:5178" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type"
```

关键响应头如下：

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5178
Access-Control-Allow-Methods: GET,POST,PUT,DELETE
Access-Control-Allow-Headers: Authorization,Content-Type
```

预检不携带实际请求的 Bearer 令牌，所以要在认证和授权之前处理。本例先用 `UseRouting()` 确定端点，再由 `UseCors()` 处理预检；实际的 GET、POST 仍需有效令牌，写入仍要求 editor 角色。

## 策略中的四项设置

| 设置 | 作用 |
| --- | --- |
| `WithOrigins(...)` | 允许 `http://localhost:5178` 这个精确的源，不包含路径或末尾斜杠 |
| `WithMethods(...)` | 允许前端使用 GET、POST、PUT、DELETE |
| `WithHeaders(...)` | 允许实际请求携带 Authorization、Content-Type |
| `WithExposedHeaders("Location")` | 允许前端 JavaScript 读取响应中的 Location |

**为什么请求头和响应头要分开配置？**允许发送 Authorization，不代表可以读取任意响应头。`Location` 不属于默认向跨源脚本暴露的响应头，因此需要额外声明；否则网络面板里可能看得到，但 `response.headers.get('Location')` 返回 `null`。

本例手动发送 Bearer 请求头，使用 `credentials: 'omit'` 避免浏览器附带 Cookie，因此不需要 `AllowCredentials()`。如果以后改用 Cookie 登录，需要另外配置凭据和 CSRF 防护。[ASP.NET Core CORS 文档](https://learn.microsoft.com/en-us/aspnet/core/security/cors?view=aspnetcore-10.0)

## 不允许的源不一定得到 403

把预检命令的 Origin 改成 `http://localhost:5179` 再执行。本例仍返回 204，但**没有 `Access-Control-Allow-Origin`**，浏览器因此不会批准后续的跨源请求。

curl 不执行浏览器的同源策略。带着有效令牌，用 curl 直接发送实际请求，即使伪造一个不允许的 Origin，服务端处理程序仍可能执行，只是响应没有跨源许可头。某些不需要预检的浏览器请求也可能发到服务端，只是脚本读不到响应。

**CORS 不能替代认证和授权。**本章阻止无权限写入的是 JWT 和 `CanWriteTodos`；CORS 决定浏览器是否允许页面读取响应。[CORS 工作方式](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)

::: tip 提示
遇到“浏览器报 CORS 错误”，先检查 Network 中的预检和实际请求：API 是否启动、Origin 是否完全一致、方法和请求头是否被允许，以及实际请求是不是 401/403。不要只看到浏览器报错就修改业务权限。
:::

::: fastapi
这对应 FastAPI / Starlette 的 `CORSMiddleware`：分别配置允许的源、方法、请求头和可读取的响应头。浏览器的预检与同源规则不会因为服务端框架不同而改变。
:::

## 总结

- 源由协议、主机和端口决定；CORS 授权浏览器脚本读取指定的跨源响应。
- 精确配置源、方法和请求头；读取 Location 等响应头时还要显式暴露它们。
- 预检检查跨源许可，实际请求仍需认证和授权；CORS 中间件放在认证授权之前。
- 不允许的源可能仍得到 HTTP 响应，但没有许可头；curl 成功不能证明浏览器 CORS 配置正确。
- CORS 不提供用户权限或数据隔离，也不能替代 CSRF 防护。

本章完成「安全」阶段。下一阶段将从「测试」（即将推出）开始，用自动化检查保护这些行为。上一章：[授权](./authorization)。
