---
title: 响应类型
description: 用 TypedResults 返回带状态码的结果，用 Results<T1, T2> 在返回类型中列出所有可能的响应，让编译器和 OpenAPI 文档都知道端点会返回什么。
---

# 响应类型

到目前为止，处理程序都是直接返回一个对象，框架把它序列化成 JSON，状态码永远是 `200 OK`。但真实的 API 需要表达更多结果：找不到资源时返回 `404`，创建成功时返回 `201`，删除成功时返回 `204`。

本节的新概念：**把"所有可能的响应"写进处理程序的返回类型。**

<<< @/../samples/08-response-types/Program.cs{1,19-33 cs:line-numbers} [08-response-types/Program.cs]

为了把注意力集中在响应上，本节的 `CreateTodo` 只保留了 `Title`，也没有加校验。

## 运行与验证

```bash
dotnet run
```

查询存在的待办事项，返回 `200`：

```bash
curl -i http://localhost:5080/todos/1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Buy milk","done":false}
```

查询不存在的，返回 `404`：

```bash
curl -i http://localhost:5080/todos/99
```

```http
HTTP/1.1 404 Not Found
Content-Length: 0
```

创建一个新的，返回 `201 Created`，并在 `Location` 头中给出新资源的地址：

```bash
curl -i -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Write report"}'
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /todos/2

{"id":2,"title":"Write report","done":false}
```

删除，返回 `204 No Content`（没有响应体）；再删一次，已经不存在了，返回 `404`：

```bash
curl -i -X DELETE http://localhost:5080/todos/1
curl -i -X DELETE http://localhost:5080/todos/1
```

```http
HTTP/1.1 204 No Content

HTTP/1.1 404 Not Found
Content-Length: 0
```

## TypedResults：带状态码的返回值

<<< @/../samples/08-response-types/Program.cs{25-30 cs:line-numbers} [08-response-types/Program.cs]

第 29 行返回的不再是 `todo` 本身，而是 `TypedResults.Created(...)`。`TypedResults` 提供了一组方法，每个方法对应一种 HTTP 响应：

| 方法 | 状态码 | 返回类型 |
| --- | --- | --- |
| `TypedResults.Ok(value)` | 200 | `Ok<T>` |
| `TypedResults.Created(uri, value)` | 201 | `Created<T>` |
| `TypedResults.NoContent()` | 204 | `NoContent` |
| `TypedResults.BadRequest()` | 400 | `BadRequest` |
| `TypedResults.NotFound()` | 404 | `NotFound` |
| `TypedResults.Conflict()` | 409 | `Conflict` |

每个方法都返回一个**具体的类型**，这些类型定义在第 1 行引入的 `Microsoft.AspNetCore.Http.HttpResults` 命名空间中。`Created<Todo>` 这个类型本身就说明了"状态码是 201，响应体是 `Todo`"。

第 25 行的 Lambda 在参数列表前写了 `Created<Todo>`，这是 Lambda 的**显式返回类型**。对于只有一种返回结果的端点，它可以省略；但写出来能让读代码的人一眼看出这个端点的响应。

::: tip 提示
`Created` 的第一个参数是新资源的地址，框架会把它放进 `Location` 响应头。这是 HTTP 的约定：客户端创建资源后，可以直接用这个地址访问它。
:::

## Results<T1, T2>：列出所有可能

<<< @/../samples/08-response-types/Program.cs{19-23 cs:line-numbers} [08-response-types/Program.cs]

查询单个待办事项有两种结果：找到了（`Ok<Todo>`）或没找到（`NotFound`）。这两个类型毫无关系，一个方法怎么能返回两种类型？

答案是第 19 行的 `Results<Ok<Todo>, NotFound>`。它是一个**联合类型**（union type）：值可以是 `Ok<Todo>`，也可以是 `NotFound`，但不能是别的。泛型参数最多可以列出 6 种结果。

第 22 行用条件运算符在两者之间选择。`TypedResults.NotFound()` 和 `TypedResults.Ok(todo)` 类型不同，但它们都能隐式转换成 `Results<Ok<Todo>, NotFound>`，所以编译能通过。

### 编译器帮你守住约定

联合类型是一份**约定**：这个端点只会返回这两种结果。如果之后有人在处理程序里加了一行 `return TypedResults.BadRequest();`，编译会失败：

```text
Program.cs(22,24): error CS0029: 无法将类型“Microsoft.AspNetCore.Http.HttpResults.BadRequest”隐式转换为“Microsoft.AspNetCore.Http.HttpResults.Results<Microsoft.AspNetCore.Http.HttpResults.Ok<Todo>, Microsoft.AspNetCore.Http.HttpResults.NotFound>”
```

要返回 400，就必须把 `BadRequest` 加进返回类型。**端点能返回什么，永远写在它的签名上**，不会因为某次修改而悄悄变化。

### 文档自动同步

打开 `/openapi/v1.json`，每个端点的 `responses` 都和返回类型一一对应：

| 端点 | 文档中的响应 |
| --- | --- |
| `GET /todos/{id}` | `200`（响应体为 `Todo`）、`404` |
| `POST /todos` | `201`（响应体为 `Todo`） |
| `DELETE /todos/{id}` | `204`、`404` |

这些信息全部来自返回类型，没有写任何额外的标注。在 `/scalar` 页面中，每个端点下方会列出这些可能的响应。

## 为什么不用 Results

你可能会在其他资料中看到另一种写法：`Results.Ok(todo)`、`Results.NotFound()`（注意是 `Results`，不是 `TypedResults`）。它们在运行时的行为完全一样，区别在于返回类型：`Results` 的方法都返回同一个接口 `IResult`。

做个实验：删掉第 19 行的返回类型 `Results<Ok<Todo>, NotFound>`，再把第 22 行的两个 `TypedResults` 都换成 `Results`。程序照样能运行，但 OpenAPI 文档中 `GET /todos/{id}` 的响应只剩下：

```json
"responses": {
  "200": {
    "description": "OK"
  }
}
```

`404` 不见了，`200` 的响应体结构也不见了。因为 `IResult` 只说明"会返回某种结果"，框架和编译器都无法知道具体是哪些。这就是本教程统一使用 `TypedResults` 的原因：**类型信息越具体，编译器能检查的越多，文档也越准确。**

::: info 技术细节
`IResult` 是所有结果类型共同实现的接口，它只有一个方法：把自己写入 HTTP 响应。`Ok<T>`、`NotFound` 这些类型除了实现 `IResult`，还实现了一个向 OpenAPI 提供元数据的接口，声明自己的状态码和响应体类型。框架在启动时读取返回类型上的这些信息，生成文档。
:::

::: fastapi
FastAPI 用 `response_model` 和 `responses={404: {...}}` 在装饰器里描述响应，这些描述与函数实际返回什么是分开的，可能不一致。`Results<Ok<Todo>, NotFound>` 把描述和实现合二为一：写错了编译不过。
:::

## 总结

- `TypedResults` 的方法（`Ok`、`Created`、`NoContent`、`NotFound` 等）返回带状态码的**具体类型**，例如 `Created<Todo>`。
- 有多种可能结果时，用 `Results<T1, T2, ...>` 作为返回类型，列出全部可能；返回未列出的类型会**编译失败**。
- OpenAPI 文档中的响应列表直接来自返回类型，代码和文档始终一致。
- `Results.Xxx()` 返回笼统的 `IResult`，会丢失类型信息，因此优先使用 `TypedResults`。

下一章：[状态码与错误处理](./errors)——让所有错误都有统一、有用的格式。上一章：[Header 与 Cookie](./headers-cookies)。
