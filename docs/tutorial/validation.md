---
title: 参数校验
description: 使用 .NET 10 内置的 Minimal API 校验：在 record 和参数上用数据注解声明规则，不合法的请求在进入处理程序前就被拒绝。
---

# 参数校验

上一章留下了一个问题：请求体缺少 `title` 时，程序照样创建了一个标题为 `null` 的待办事项。本节的新概念是**声明式校验**（declarative validation）：在类型和参数上**声明**规则，由框架在调用处理程序**之前**统一检查，不合法的请求直接返回 400。

<<< @/../samples/06-validation/Program.cs{1,7,20,31-33 cs:line-numbers} [06-validation/Program.cs]

和上一章相比，只多了三处：第 7 行注册校验服务，第 31～33 行给 `CreateTodo` 的属性加上规则，第 20 行给查询参数加上规则。处理程序本身一行没改。

## 运行与验证

```bash
dotnet run
```

正常的请求不受影响：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","priority":2}'
```

```json
{"id":1,"title":"Buy milk","priority":2,"done":false}
```

再发送上一章那个缺少 `title` 的请求：

```bash
curl -i -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"priority":3}'
```

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{"title":"One or more validation errors occurred.","errors":{"Title":["The Title field is required."]}}
```

这次被拒绝了。多个字段同时出错时，所有错误会一次性返回：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"","priority":9}'
```

```json
{"title":"One or more validation errors occurred.","errors":{"Title":["The Title field is required."],"Priority":["The field Priority must be between 1 and 5."]}}
```

查询参数同样会被检查：

```bash
curl "http://localhost:5080/todos?pageSize=100"
```

```json
{"title":"One or more validation errors occurred.","errors":{"pageSize":["The field pageSize must be between 1 and 50."]}}
```

## 用特性声明规则

<<< @/../samples/06-validation/Program.cs{1,31-33 cs:line-numbers} [06-validation/Program.cs]

方括号中的 `[Required]`、`[StringLength(50)]`、`[Range(1, 5)]` 叫**特性**（attribute），是一种附加在代码上的元数据。这几个特性来自第 1 行引入的 `System.ComponentModel.DataAnnotations` 命名空间，统称**数据注解**（data annotations）：

| 特性 | 规则 |
| --- | --- |
| `[Required]` | 必须提供，不能是 `null`；对字符串来说也不能是空字符串 |
| `[StringLength(50)]` | 字符串长度不超过 50 |
| `[Range(1, 5)]` | 数值在 1 到 5 之间（含两端） |
| `[MinLength]`、`[MaxLength]` | 字符串或集合的最小、最大长度 |
| `[EmailAddress]`、`[Url]` | 邮箱、网址格式 |
| `[RegularExpression]` | 匹配正则表达式 |

多个特性可以写在同一对方括号里，用逗号分隔，比如 `[Required, StringLength(50)]`。

**为什么用声明式，而不是在处理程序里写 `if`？**

- **规则和数据放在一起**：看到 `CreateTodo` 就知道它的全部约束，不用翻遍所有处理程序。
- **处理程序保持干净**：进入处理程序时，`input` 一定是合法的，业务代码不需要再防御。
- **错误格式统一**：所有端点返回同样结构的错误，客户端只需要写一套处理逻辑。
- **进入文档**：规则会写进 OpenAPI 文档，比如 `pageSize` 参数的描述里会出现 `"minimum": 1` 和 `"maximum": 50`。

::: fastapi
这相当于 Pydantic 的 `Field(min_length=1, max_length=50)`、`Field(ge=1, le=5)`，以及查询参数上的 `Query(ge=1, le=50)`。区别在于 FastAPI 的校验是 Pydantic 内置的；ASP.NET Core 中数据模型（record）和校验机制是分开的，需要显式开启。
:::

::: warning 注意
**`CreateTodo` 必须声明为 `public`**（第 31 行）。.NET 10 的校验由**源代码生成器**（source generator）在编译时为参与校验的类型生成代码，而它只处理公开的类型。

如果去掉 `public`，写成 `record CreateTodo(...)`，项目照样能编译，请求体却**完全不会被校验**——没有错误，没有警告，也没有日志。这是很容易踩到的坑：如果你发现校验规则没有生效，首先检查类型是不是 `public`。
:::

## 开启校验

<<< @/../samples/06-validation/Program.cs{7 cs:line-numbers} [06-validation/Program.cs]

`AddValidation()` 把校验功能注册到应用中。之后，每个端点在调用处理程序之前，都会按照参数上的特性检查输入：

1. 路由、查询字符串、请求体等来源的值先完成绑定（上一章的内容）；
2. 按特性检查每个参数，以及参数对象的每个属性；
3. 有任何错误，就返回 400 和全部错误信息，处理程序不会被调用；
4. 全部通过，才调用处理程序。

注意第 2 步和上一章的区别：**绑定**负责"格式对不对"（`"high"` 能不能转成 `int`），**校验**负责"内容合不合理"（`9` 是否在 1 到 5 之间）。前者失败时，框架根本构造不出 `CreateTodo` 对象，也就轮不到校验。

::: info 技术细节
校验功能是 .NET 10 新增的，之前的版本中 Minimal API 没有内置校验，需要借助第三方库或手写代码。它在编译时通过源代码生成器分析端点的参数类型，生成校验代码，而不是在运行时用反射逐个检查属性。这样做的好处是运行时开销更小，也更适合原生 AOT 编译（在「进阶」部分介绍）这类不能依赖运行时反射的场景。
:::

## 校验查询参数

<<< @/../samples/06-validation/Program.cs{20 cs:line-numbers} [06-validation/Program.cs]

特性不只能用在 record 的属性上，也可以直接加在处理程序的参数上。`[Range(1, 50)]` 限制了每页最多 50 条，防止客户端一次请求过多数据。

路由参数、查询参数、请求头都可以这样校验。回忆「路由参数」一章的建议："取值不合法"应该返回带说明的 400，而不是用路由约束返回 404——这里就是实现它的地方。

## 错误响应的格式

校验失败的响应体结构如下：

```json
{
  "title": "One or more validation errors occurred.",
  "errors": {
    "Title": ["The Title field is required."],
    "Priority": ["The field Priority must be between 1 and 5."]
  }
}
```

`errors` 是一个字典：键是出错的字段名，值是该字段的所有错误消息。这个结构遵循一个名为 **Problem Details** 的标准格式，「状态码与错误处理」一章会详细介绍它，并让所有错误都使用这种格式。

::: tip 提示
默认的错误消息是英文的。每个特性都可以通过 `ErrorMessage` 自定义消息，例如 `[Range(1, 5, ErrorMessage = "优先级必须在 1 到 5 之间")]`。
:::

## 总结

- `builder.Services.AddValidation()` 开启 .NET 10 内置的校验，校验在处理程序执行**之前**进行。
- 在 record 的属性或处理程序的参数上用**数据注解**（`[Required]`、`[StringLength]`、`[Range]` 等）声明规则。
- 校验失败返回 400，响应体中的 `errors` 按字段列出所有错误；处理程序不会被调用。
- **绑定**检查格式，**校验**检查内容；规则会同时写进 OpenAPI 文档。
- 参与校验的类型必须是 `public`，否则校验会被静默跳过。

下一章：[Header 与 Cookie](./headers-cookies)——读取请求的其他部分。上一章：[请求体](./request-body)。
