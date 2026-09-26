---
title: 授权
description: 用命名策略区分 Todo 读写权限，理解身份声明、角色要求以及 401 与 403 的区别。
---

# 授权

上一章所有通过认证的人都能删任务。这一章用**授权策略**（authorization policy）规定谁可以修改数据。

规则是：**通过认证的人可以读取共享 Todo，带有 editor 角色的人才可以创建、修改、删除。** 模型、数据库操作、错误处理都沿用上一章。

<<< @/../samples/19-authorization/Program.cs{15-18,47,71,86,95 cs:line-numbers} [19-authorization/Program.cs]

<<< @/../samples/19-authorization/Models.cs{cs:line-numbers} [19-authorization/Models.cs]

<<< @/../samples/19-authorization/TodoDbContext.cs{cs:line-numbers} [19-authorization/TodoDbContext.cs]

## 为同一项目准备两种身份

先停止上一章服务，从仓库根目录进入本章项目：

```bash
cd samples/19-authorization
dotnet user-jwts create --name alice --valid-for 1h --output token
dotnet user-jwts create --name bob --role editor --valid-for 1h --output token
```

分别复制两条命令输出的完整令牌：alice 没有 editor 角色，bob 有。这里使用本章自己的 `UserSecretsId` 和测试密钥，请重新生成，不要直接搬用上一章令牌。

```bash
dotnet run
```

在另一个发请求的终端中设置变量：

::: code-group

```powershell [PowerShell 7]
$READER_TOKEN = "粘贴 alice 的令牌"
$EDITOR_TOKEN = "粘贴 bob 的令牌"
```

```bash [Bash / zsh]
READER_TOKEN="粘贴 alice 的令牌"
EDITOR_TOKEN="粘贴 bob 的令牌"
```

:::

## 运行与验证

alice 可以读取列表。首次运行使用新的 `todos-19.db`，结果是空数组：

```bash
curl -H "Authorization: Bearer $READER_TOKEN" http://localhost:5080/todos
```

```json
[]
```

但不能创建任务：

```bash
curl -i -X POST http://localhost:5080/todos -H "Authorization: Bearer $READER_TOKEN" -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

响应摘录，`traceId` 是动态值：

```http
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.4","title":"Forbidden","status":403,"traceId":"本次请求的追踪编号"}
```

把令牌换成 bob 的，其他请求内容保持一致：

```bash
curl -i -X POST http://localhost:5080/todos -H "Authorization: Bearer $EDITOR_TOKEN" -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

这次是 201，`Location: /todos/1`，响应体为：

```json
{"id":1,"title":"Write report","done":false,"categoryId":1}
```

alice 仍不能删除它，bob 可以：

```bash
curl -i -X DELETE http://localhost:5080/todos/1 -H "Authorization: Bearer $READER_TOKEN"
curl -i -X DELETE http://localhost:5080/todos/1 -H "Authorization: Bearer $EDITOR_TOKEN"
```

依次得到 **403** 和 **204**。第二次删除成功，没有响应体；第一个请求没有执行删除。

## 用同一条策略保护三个写入端点

第 17 行注册名为 `CanWriteTodos` 的策略。它要求身份已认证，并且包含 `editor` **角色**（role）。在这份 JWT 示例中，角色来自受信任令牌中的声明，不来自请求体或一个任意的 HTTP Header。

POST、PUT、DELETE 都调用 `RequireAuthorization("CanWriteTodos")`，授权系统会在处理程序执行前检查这条策略。这样以后调整写权限，只需改一处规则，不用分别修改三个处理程序。

新增写入端点时，也要附加这条策略；框架不会根据 POST、PUT 等方法名自动要求 editor 角色。

分组上的 `RequireAuthorization()` 没有被单个端点上的命名策略替换。这些要求会组合生效：组内端点先具有“需要认证”的要求，写入端点再增加 editor 角色要求。

## 401 和 403 分别告诉客户端什么

| 请求情况 | 结果 | 原因 |
| --- | --- | --- |
| 没有令牌，或者令牌无效 | 401 | 无法建立满足要求的认证身份 |
| 有效的 alice 令牌访问 GET | 200 | 已通过认证，允许读取 |
| 有效的 alice 令牌访问 POST / PUT / DELETE | 403 | 身份有效，但不满足写入策略 |
| 有效的 bob 令牌执行合法写入 | 对应的 201 或 204 | 身份与权限都满足要求 |

**403 不是重新登录就一定能解决的问题。**如果签发者没有给这个用户 editor 角色，再拿到一枚相同权限的令牌，结果仍然是 403。[角色授权说明](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/roles?view=aspnetcore-10.0)

角色名称要与策略一致，本例使用小写 `editor`。角色应由身份服务根据用户权限签发，不能直接相信客户端提交的 `role` 字段。

## 角色授权不等于数据归属检查

本章的 editor 可以修改共享列表中的任意任务。要实现“只能修改自己的 Todo”，需要给数据保存拥有者标识，并在查询或修改时核对当前用户；仅检查角色做不到这一点。

::: warning 注意
`--role editor` 只是本地测试工具提供的能力，生产客户端不能自行签发角色。用户权限变化后，旧令牌也不会自动更新；身份服务还需要处理令牌过期和撤销。
:::

::: fastapi
这类似把权限检查封装成可复用的依赖，再挂到需要写权限的操作上。ASP.NET Core 的命名策略由授权系统执行，处理程序只声明策略名称。
:::

## 总结

- 认证确认身份，授权策略决定这份身份能执行哪些操作。
- `CanWriteTodos` 集中声明写权限，POST、PUT、DELETE 显式使用它。
- 组级与端点级授权要求会组合生效，GET 仍继承组级认证要求。
- 未通过认证得到 401，身份有效但权限不足得到 403。
- 角色来自可信身份声明；共享列表的角色规则不能替代按资源的归属检查。

下一章：[CORS](./cors)——让另一个源的浏览器页面调用 API。上一章：[认证（JWT）](./authentication)。
