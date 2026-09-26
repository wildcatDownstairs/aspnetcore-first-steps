---
title: 请求体
description: 用 record 声明请求体的结构，让框架把 JSON 自动反序列化成强类型对象；理解输入模型与数据模型为什么要分开。
---

# 请求体

路由参数和查询参数适合传递少量的简单值。要**创建**一个待办事项，客户端需要发送一整块结构化数据，这时就要用到**请求体**（request body）：放在 HTTP 请求正文中的内容，Web API 中通常是 JSON。

本节的新概念：**用一个 record 声明请求体的结构，框架会把 JSON 自动转换成这个类型的对象。**

<<< @/../samples/05-request-body/Program.cs{20-25,29 cs:line-numbers} [05-request-body/Program.cs]

从本章开始，示例会围绕一个待办事项（Todo）API 逐步扩展，到「完整 CRUD」一章时，它会成为一个连接数据库的完整应用。

## 运行与验证

```bash
dotnet run
```

用 `POST` 方法发送一个 JSON 请求体：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","priority":2}'
```

- `-X POST`：使用 POST 方法；
- `-H "Content-Type: application/json"`：告诉服务器请求体是 JSON；
- `-d '...'`：请求体的内容。

预期响应：

```json
{"id":1,"title":"Buy milk","priority":2,"done":false}
```

再查看列表，刚才创建的项已经在里面了：

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Buy milk","priority":2,"done":false}]
```

::: tip 提示
Windows PowerShell 对引号和反斜杠换行的处理与 bash 不同，上面的多行命令可能无法直接运行。最省事的做法是打开 `/scalar` 页面，找到 `POST /todos`，在请求体编辑框中填入 JSON 后点击发送。Scalar 会根据 OpenAPI 文档自动生成一个请求体模板。
:::

## 声明请求体的结构

<<< @/../samples/05-request-body/Program.cs{20,29 cs:line-numbers} [05-request-body/Program.cs]

第 29 行用一个 record 描述了"创建待办事项时需要提供什么"：一个字符串 `Title` 和一个整数 `Priority`。第 20 行处理程序的参数类型就是 `CreateTodo`。

本例是 POST 端点，`CreateTodo` 是一个没有注册为服务、没有自定义绑定的**复杂类型**（不是 `int`、`string` 这类简单值），因此框架推断它来自请求体——这正是上一章参数来源表格中的第三条规则。然后它会读取请求正文，用 **System.Text.Json**（.NET 内置的 JSON 库）反序列化成 `CreateTodo` 对象。

进入处理程序时，`input` 已经是一个完整的、强类型的对象：`input.Title` 是 `string`，`input.Priority` 是 `int`。编辑器能补全这些属性，拼错属性名会直接编译失败。

::: tip 提示
JSON 属性名匹配**不区分大小写**。发送 `{"TITLE":"Case test","Priority":1}` 同样能正确绑定。响应中的属性名则统一是 camelCase，这是「第一步」中提到的 Web 默认设置。
:::

::: fastapi
这和 FastAPI 中用 Pydantic 模型作为参数类型一样：`def create(todo: CreateTodo)`。不同之处是 record 只描述数据的形状，默认不做校验，下面马上会看到它的后果。
:::

## 为什么要单独定义 CreateTodo

<<< @/../samples/05-request-body/Program.cs{22,29,31 cs:line-numbers} [05-request-body/Program.cs]

文件里有两个 record：第 29 行的 `CreateTodo` 是**输入模型**，描述客户端能提交什么；第 31 行的 `Todo` 是**数据模型**，描述系统里保存的是什么。为什么不直接用 `Todo` 作为参数类型？

因为 `Todo` 里有 `Id` 和 `Done`，这两个值不应该由客户端决定：`Id` 由服务器分配，新建的待办事项一定是未完成的。如果直接接收 `Todo`，客户端就可以自己指定 `id` 和 `done`。

用 `CreateTodo` 接收输入后，客户端**根本无法**设置这两个字段。试着多传几个属性：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Extra","priority":1,"id":999,"done":true}'
```

```json
{"id":2,"title":"Extra","priority":1,"done":false}
```

`id` 和 `done` 被忽略了，因为 `CreateTodo` 里没有对应的属性。第 22 行由服务器决定这两个值。这种把输入和存储分开的做法，能避免一类叫做**过度提交**（over-posting）的安全问题。

::: warning 注意
本章示例把数据存在一个内存中的 `List` 里，程序重启后数据就会消失；而且 `List` 和 `nextId++` 都**不是线程安全的**，多个请求同时写入时可能出错。这只是为了让示例保持简单，「EF Core 入门」一章会换成真正的数据库。
:::

## 请求体有问题时

### 格式错误

JSON 语法错误，或者值的类型对不上，框架会直接返回 400，处理程序不会执行：

```bash
curl -i -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"x","priority":"high"}'
```

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Failed to read parameter "CreateTodo input" from the request body as JSON.
 ---> System.Text.Json.JsonException: The JSON value could not be converted to CreateTodo. Path: $.priority | LineNumber: 0 | BytePositionInLine: 30.
```

错误信息指出了出问题的位置：`$.priority`，因为 `"high"` 不能转换成 `int`。

### 忘了 Content-Type

本教程用 `Content-Type: application/json` 声明 JSON 请求体；框架也接受 `application/*+json` 这类带 `+json` 后缀的媒体类型。如果携带请求体，却没有提供受支持的 JSON 媒体类型，就会返回 `415 Unsupported Media Type`（不支持的媒体类型）：

```http
HTTP/1.1 415 Unsupported Media Type
Content-Length: 0
```

框架只会把声明为 JSON 的请求体当作 JSON 解析。这是一个常见的坑：请求体明明是正确的 JSON，却因为少了请求头而失败。

### 缺少字段

最值得注意的是这种情况：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"priority":3}'
```

```json
{"id":3,"title":null,"priority":3,"done":false}
```

请求成功了，`title` 却是 `null`——尽管 `CreateTodo` 中 `Title` 的类型是不可为 null 的 `string`。发送空对象 `{}` 更离谱，会得到 `title` 为 `null`、`priority` 为 `0` 的待办事项。

原因是：「C# 速览」中提到，可空引用类型是**编译期**检查。JSON 反序列化发生在运行时，缺少的字符串属性会被设为 `null`，缺少的数字会被设为 `0`，没有任何报错。

**反序列化只保证"格式对"，不保证"内容合理"。**标题不能为空、优先级只能是 1 到 5，这些业务规则需要另外检查，这就是下一章的主题。

::: info 技术细节
System.Text.Json 提供了 `RespectNullableAnnotations` 等选项，可以让反序列化在遇到 `null` 时报错。但它只能检查"是否为 null"，表达不了"长度不超过 50"这类规则。下一章的校验机制能统一处理这些情况，并返回结构化的错误信息。
:::

## 总结

- 在本章的 POST 端点中，普通的**复杂类型**参数（如 `CreateTodo`）默认从**请求体**读取 JSON；这项推断不适用于 GET 等方法或已注册为服务的类型。
- 携带 JSON 请求体时，应提供受支持的 `Content-Type`，本教程使用 `application/json`；媒体类型不支持返回 415，JSON 格式错误或类型不匹配返回 400。
- 用单独的**输入模型**（`CreateTodo`）接收请求体，与**数据模型**（`Todo`）分开，服务器控制的字段（如 `Id`）无法被客户端篡改。
- 反序列化不检查业务规则：缺少的字段会变成 `null` 或 `0`，需要额外的校验。

下一章：[参数校验](./validation)——让框架在处理程序执行前拒绝不合法的输入。上一章：[查询参数](./query-params)。
