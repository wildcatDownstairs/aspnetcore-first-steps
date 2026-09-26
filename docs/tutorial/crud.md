---
title: 完整 CRUD
description: 将已有的查询、校验和响应类型组合起来，用 EF Core 变更跟踪完成 Todo 的创建、读取、更新和删除。
---

# 完整 CRUD

前两章已经能创建和查询 Todo，这一章补上更新与删除：先读取实体，再修改或标记删除，最后调用 `SaveChangesAsync()` 保存。

**CRUD** 是 Create、Read、Update、Delete 的缩写，也就是创建、读取、更新、删除。校验、路由分组和错误处理沿用前面的做法。为集中讲解写入，本章列表返回全部 Todo，不保留筛选分页；分类预置 Work（1）和 Life（2），暂不提供增删接口。

<<< @/../samples/17-crud/Program.cs{50-85 cs:line-numbers} [17-crud/Program.cs]

<<< @/../samples/17-crud/Models.cs{19-28 cs:line-numbers} [17-crud/Models.cs]

<<< @/../samples/17-crud/TodoDbContext.cs{cs:line-numbers} [17-crud/TodoDbContext.cs]

## 运行与验证

停止上一章服务，在仓库根目录执行：

```bash
cd samples/17-crud
dotnet run
```

本章使用 `todos-17.db`，首次运行时 Todo 表为空。下面按顺序操作，响应只摘录关键响应头；数据库已有数据时，编号会不同。

创建任务：

```bash
curl -i -X POST http://localhost:5080/todos -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

```http
HTTP/1.1 201 Created
Location: /todos/1
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Write report","done":false,"categoryId":1}
```

把它改为已完成，并移到 Life 分类：

```bash
curl -i -X PUT http://localhost:5080/todos/1 -H "Content-Type: application/json" -d '{"title":"Write report","done":true,"categoryId":2}'
```

```http
HTTP/1.1 204 No Content
```

204 没有响应体。重新读取，才能看到保存后的内容：

```bash
curl http://localhost:5080/todos/1
```

```json
{"id":1,"title":"Write report","done":true,"categoryId":2}
```

删除并再次查询：

```bash
curl -i -X DELETE http://localhost:5080/todos/1
curl -i http://localhost:5080/todos/1
```

前一个响应是 204；后一个是 404，响应体如下，`traceId` 的值每次不同：

```json
{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"本次请求的追踪编号"}
```

## 请求中允许修改哪些字段

`CreateTodo` 只允许输入 `Title`、`CategoryId`；`ReplaceTodo` 还允许修改 `Done`。`Id` 始终来自路由或数据库，不从请求体覆盖。

**为什么不用 Todo 直接接收请求？**如果将来实体增加内部字段，直接接收整个实体可能让客户端也能修改它。单独定义请求类型，就能明确限制可修改的字段。

输入上的 `[Required]`、`[StringLength]`、`[Range]` 沿用第 06 章的机制。输入 record 保持 `public`，让 .NET 10 校验生成器处理它。

PUT 在这里表示替换客户端可编辑的完整状态，请发送 `title`、`done`、`categoryId` 三个字段。它不是“只修改 JSON 中出现的字段”：例如省略 `done`，反序列化后的值是 `false`，就会把当前完成状态替换成 false。

## 先读取，再修改，再保存

PUT 的步骤是：

1. `FindAsync(id)` 找到实体；不存在就返回 404。
2. 查询目标分类是否存在；不存在返回带说明的 400。
3. 修改跟踪中的实体属性。
4. `SaveChangesAsync()` 检测变化并写入数据库。

这里不需要再调用 `Update(todo)`，因为 `FindAsync` 返回的实体已经由当前上下文跟踪。列表上的 `AsNoTracking()` 则用于只读场景；如果取回不跟踪的对象后只修改属性，直接保存不会自动写回它。[基本保存操作](https://learn.microsoft.com/en-us/ef/core/saving/basic)

删除同理：`Remove(todo)` 标记实体待删除，`SaveChangesAsync()` 才真正删除数据库中的记录。删除后再查同一编号，得到 404。

## 编号合法，不代表分类存在

`[Range(1, int.MaxValue)]` 只能检查编号是正数，不能证明分类 99 确实存在。分类存在性需要查询数据库，所以它放在处理程序里：

```bash
curl -i -X POST http://localhost:5080/todos -H "Content-Type: application/json" -d '{"title":"Invalid","categoryId":99}'
```

响应为 400，正文如下：

```json
{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"分类不存在","status":400,"traceId":"本次请求的追踪编号"}
```

先查询是为了返回明确的“分类不存在”，数据库的外键约束仍会阻止写入无效编号。本例不能删除分类；以后若加上删除接口，还要处理“检查时存在，保存前被删掉”的情况。

`.ProducesProblem(400)` 将这类 400 响应补充到 OpenAPI 文档中，原因见[第 09 章](./errors)。

## 重复请求与同时修改

重复 PUT 相同内容，最终状态相同；DELETE 多次后，资源仍是不存在的。这叫**幂等性**（idempotency），不要求每次状态码都相同，所以第一次 DELETE 的 204 和后一次的 404 并不矛盾。POST 则可能每次创建新资源。

本章还没有检查并发更新：如果两个人读到同一条 Todo 后各自修改，后保存的值可能覆盖前一次修改。下一章先解决访问权限，限制谁可以调用这些接口。

::: fastapi
这类似在 FastAPI 处理函数中查出 SQLAlchemy 实体、修改属性，然后提交 Session。DTO 与数据库实体分开，也对应 Pydantic 输入/输出模型与 ORM 模型各自负责一件事。
:::

## 总结

- CRUD 组合创建、读取、更新、删除；不同操作使用相应的 HTTP 方法和状态码。
- 请求 DTO 限定可修改字段，实体对应数据库记录，响应 DTO 决定返回字段。
- 跟踪查询后的实体可以直接修改，`SaveChangesAsync()` 检测并保存变化。
- `Remove` 只标记删除，保存后才生效；字段校验不能替代数据库存在性检查。
- 本例 PUT 替换完整可编辑状态，尚未处理并发更新冲突。

下一章：[认证（JWT）](./authentication)——让 API 先确认调用者是谁。上一章：[关系与查询](./relations-queries)。
