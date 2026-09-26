---
title: 路由分组
description: 用 MapGroup 把共享路由前缀的端点组织在一起，并在分组上统一添加元数据，例如 OpenAPI 标签。
---

# 路由分组

随着端点越来越多，你会发现同一类端点有很多重复：路径都以 `/api/todos` 开头，将来可能都需要登录才能访问，文档里也应该归在同一类下。本节的新概念是**路由分组**（route group）：把这些共同点写在一个地方。

<<< @/../samples/10-route-groups/Program.cs{19-23,25,31,38,41 cs:line-numbers} [10-route-groups/Program.cs]

本章以第 08 章的 CRUD 示例为基础演示路由分组，暂时省略第 06 章的参数校验和第 09 章的统一错误处理，让变化集中在端点是**挂在哪里**注册的。这些能力都可以与 `MapGroup` 组合使用；省略后，本章找不到资源的 404 响应仍然没有响应体。

## 运行与验证

```bash
dotnet run
```

所有待办事项端点现在都在 `/api/todos` 下：

```bash
curl http://localhost:5080/api/todos
```

```json
[{"id":1,"title":"Buy milk","done":false}]
```

```bash
curl http://localhost:5080/api/todos/1
```

```json
{"id":1,"title":"Buy milk","done":false}
```

```bash
curl -i -X POST http://localhost:5080/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Write report"}'
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /api/todos/2

{"id":2,"title":"Write report","done":false}
```

健康检查端点在 `/api/health`：

```bash
curl http://localhost:5080/api/health
```

```json
{"status":"ok"}
```

旧地址 `/todos` 已经不存在了，返回 `404`。

## 用 MapGroup 创建分组

<<< @/../samples/10-route-groups/Program.cs{19,21,23,25 cs:line-numbers} [10-route-groups/Program.cs]

**第 19 行** `app.MapGroup("/api")` 创建了一个分组，返回值 `api` 代表"所有以 `/api` 开头的路由"。

**第 21 行**在 `api` 上又调用了 `MapGroup("/todos")`，创建一个**嵌套分组**，它的完整前缀是 `/api/todos`。

之后在 `todosApi` 上调用 `MapGet`、`MapPost`，写的都是**相对路径**：

| 注册代码 | 实际路由 |
| --- | --- |
| `todosApi.MapGet("/", ...)` | `GET /api/todos` |
| `todosApi.MapGet("/{id:int}", ...)` | `GET /api/todos/{id}` |
| `todosApi.MapPost("/", ...)` | `POST /api/todos` |
| `todosApi.MapDelete("/{id:int}", ...)` | `DELETE /api/todos/{id}` |
| `api.MapGet("/health", ...)` | `GET /api/health` |

分组对象的用法和 `app` 几乎一样，`MapGet`、`MapPost`、`MapGroup` 都可以调用。这正是它好用的地方：**你不需要学新的 API，只是换了个对象来调用。**

**为什么不直接在每个路由里写完整路径？**因为前缀是一个**决策**，应该只出现一次。假如有一天 API 要升级到 `/api/v2`，使用分组只需要改第 19 行一处；如果前缀散落在每个端点中，就要逐个修改，漏掉一个就会出现不一致的 URL。

::: warning 注意
第 35 行 `Created` 的地址 `$"/api/todos/{todo.Id}"` 仍然是手写的完整路径，分组的前缀不会自动加到这里。如果修改了分组前缀，别忘了同步修改它。
:::

## 在分组上添加元数据

<<< @/../samples/10-route-groups/Program.cs{21,41 cs:line-numbers} [10-route-groups/Program.cs]

分组不只是路径前缀。第 21 行的 `.WithTags("待办事项")` 给分组加上了一个 OpenAPI **标签**，分组内的**所有端点**都会继承它。第 41 行则单独给健康检查端点加了"系统"标签。

打开 `/scalar` 页面，左侧的端点列表会按标签分成两组："待办事项"下有四个端点，"系统"下有一个。在 `/openapi/v1.json` 中，这四个待办事项端点的 `tags` 都是 `["待办事项"]`，`/api/health` 的是 `["系统"]`。

::: info 技术细节
之前的章节中没有设置标签，所以 Scalar 用项目名（例如 `FirstSteps`）作为所有端点的默认标签。
:::

像 `WithTags` 这样的调用，给端点附加的是**元数据**（metadata）：不改变处理逻辑，只是给端点"贴标签"，供框架的其他部分读取。在分组上添加的元数据会应用到组内的每个端点，这让分组成为统一配置的好地方。后面的章节会在分组上添加更多东西，例如：

- 「授权」一章：`todosApi.RequireAuthorization()`，让组内所有端点都需要登录；
- 「CORS」一章：为一组端点启用跨域访问。

**配置一次，整组生效**，新加入分组的端点也会自动获得这些配置，不会因为忘记添加而出现安全漏洞。

::: fastapi
`MapGroup` 相当于 FastAPI 的 `APIRouter(prefix="/todos", tags=["待办事项"])`。区别是 FastAPI 的 router 需要最后用 `app.include_router()` 挂载；ASP.NET Core 的分组从 `app.MapGroup()` 创建出来时就已经挂在应用上了，还可以像第 21 行这样继续嵌套。
:::

## 总结

- `app.MapGroup("/前缀")` 创建路由分组，在分组上注册的端点使用**相对路径**，实际路由自动加上前缀。
- 分组可以嵌套：`api.MapGroup("/todos")` 的前缀是 `/api/todos`。
- 在分组上添加的**元数据**（如 `WithTags`）会应用到组内所有端点；之后的授权、CORS 等配置也可以按组设置。
- 前缀和共享配置只写一次，修改时不会遗漏；但 `Created` 等处手写的完整地址需要自己同步。

本章是「请求与响应」阶段的最后一章。至此，你已经能写出一个参数完整、有校验、响应规范、结构清晰的 API。下一阶段「应用骨架」将从[依赖注入](./dependency-injection)开始，把示例中的内存列表换成真正的服务。上一章：[状态码与错误处理](./errors)。
