---
title: 路由参数
description: 在路由模板中声明参数，让 URL 的一部分自动转换成强类型的处理程序参数；理解路由约束、路由优先级和捕获全部参数。
---

# 路由参数

上一章的端点只能响应一个固定的 URL。真实的 API 中，URL 里经常带着数据：`/users/42` 中的 `42` 是用户编号，`/files/docs/report.pdf` 中的后半段是文件路径。本节的新概念是**路由参数**（route parameter）：把 URL 中的一段"挖空"，交给处理程序作为参数。

本节最终的完整代码，高亮部分是相对上一章新增的内容：

<<< @/../samples/03-path-params/Program.cs{15,17,19 cs:line-numbers} [03-path-params/Program.cs]

第 1～13 行与上一章完全相同，后面不再重复解释。

## 运行与验证

按上一章的方式创建项目（或者直接进入仓库的 `samples/03-path-params` 目录），然后运行：

```bash
dotnet run
```

依次发送下面几个请求，对比你看到的结果：

```bash
curl http://localhost:5080/users/42
```

```json
{"id":42,"name":"用户 42"}
```

```bash
curl http://localhost:5080/users/me
```

```json
{"id":0,"name":"当前登录用户"}
```

```bash
curl http://localhost:5080/files/docs/2026/report.pdf
```

```json
{"path":"docs/2026/report.pdf"}
```

再试一个"不合法"的地址，加上 `-i` 查看状态码：

```bash
curl -i http://localhost:5080/users/abc
```

```http
HTTP/1.1 404 Not Found
Content-Length: 0
Date: Sat, 26 Sep 2026 08:55:56 GMT
Server: Kestrel
```

四个结果都对上了，我们来看它们分别是怎么产生的。

## 声明路由参数

<<< @/../samples/03-path-params/Program.cs{15 cs:line-numbers} [03-path-params/Program.cs]

路由模板 `"/users/{id:int}"` 中，花括号包起来的部分就是路由参数。它和处理程序的参数 `int id` **同名**，框架就是靠名字把两者对应起来的：请求 `/users/42` 时，`42` 被取出来，传给参数 `id`。

这个过程叫**参数绑定**（parameter binding）。它是按约定工作的——你不需要写任何注解来说明"`id` 来自路由"，名字一致就够了。

### 字符串自动变成 int

URL 本质上是一个字符串，但处理程序拿到的 `id` 是 `int`。转换是框架完成的：它会调用 `int.TryParse` 把 `"42"` 变成 `42`。

这意味着在处理程序内部，`id` **就是一个整数**，编译器也按整数对待它：

- 写 `id + 1` 得到的是 `43`，而不是字符串拼接出的 `"421"`；
- 写 `id.Length` 会直接编译失败，因为整数没有长度：

```text
error CS1061: “int”未包含“Length”的定义，并且找不到可接受第一个“int”类型参数的可访问扩展方法“Length”(是否缺少 using 指令或程序集引用?)
```

**你在参数列表里写下的类型，就是对输入格式的声明。** 之后的代码可以放心地把它当整数用，不需要自己再做解析和判断。除了 `int`，`long`、`Guid`、`DateTime`、`bool`、枚举等常见类型也都能直接作为参数类型。

::: fastapi
这和 FastAPI 中 `def get_user(id: int)` 的效果几乎一样：类型标注决定了转换规则。区别在于 C# 的类型在编译期就会被检查，写错类型的用法根本无法通过编译。
:::

### 类型也进入了文档

打开 <http://localhost:5080/openapi/v1.json>，找到 `/users/{id}` 的部分：

```json
"parameters": [
  {
    "name": "id",
    "in": "path",
    "required": true,
    "schema": {
      "pattern": "^-?(?:0|[1-9]\\d*)$",
      "type": "integer",
      "format": "int32"
    }
  }
]
```

`"type": "integer"`、`"format": "int32"` 都来自代码中的 `int`。在 `/scalar` 页面里测试这个端点时，文档也会提示你这里需要填一个整数。同一处类型声明，同时决定了转换规则、编译检查和 API 文档。

## 路由约束

模板中 `{id:int}` 的 `:int` 部分叫**路由约束**（route constraint）。它的作用是：**只有当这一段能解析为整数时，这个端点才算匹配。**

这就解释了开头 `/users/abc` 为什么返回 `404 Not Found`：`abc` 不满足 `int` 约束，所以这个端点根本没被选中，框架找不到能处理它的端点。

你可能会问：处理程序的参数已经是 `int` 了，为什么还要在模板里再写一遍？我们去掉约束做个对比。如果模板是 `"/users/{id}"`，请求 `/users/abc` 会得到：

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Failed to bind parameter "int id" from "abc".
```

区别在于**检查发生的时机**：

| | 发生在 | 失败时 | 含义 |
| --- | --- | --- | --- |
| 路由约束 `{id:int}` | 匹配端点**之前** | 404 | "这个 URL 不匹配这个端点" |
| 参数类型 `int id` | 匹配端点**之后** | 400 | "匹配到了端点，但参数值无法转换" |

那该用哪一种？微软官方的建议很明确：**路由约束用来区分形状相似的路由，而不是校验输入。**从客户端的角度看，`/users/abc` 是"参数写错了"，400 加上错误说明比一个不带任何信息的 404 更有用。

所以，只有当同一个位置可能对应多个端点时，约束才真正派上用场。比如同时提供 `/users/{id:int}`（按编号查）和 `/users/{name}`（按用户名查）：请求 `/users/42` 满足 `int` 约束，走第一个；`/users/alice` 不满足，自然落到第二个。没有约束的话，这两个路由就无法共存（下一节会看到后果）。

本节示例保留 `:int`，是为了让你观察约束的效果。如果在你的项目里 `/users/{id}` 是唯一的同形路由，去掉约束、让非法值返回 400，对调用方更友好。

::: tip 提示
一个有趣的现象：`/users/99999999999` 同样返回 404。因为这个数字超出了 `int` 的范围（约 ±21 亿），不满足 `int` 约束。如果你的编号可能很大，请使用 `long` 类型和 `{id:long}` 约束。
:::

常用的约束还有：

| 约束 | 示例 | 匹配 |
| --- | --- | --- |
| `int` / `long` | `{id:int}` | 整数 |
| `guid` | `{id:guid}` | GUID，例如 `0f8fad5b-d9cb-469f-a165-70867728950e` |
| `bool` | `{on:bool}` | `true` 或 `false` |
| `alpha` | `{name:alpha}` | 只含英文字母 |
| `min(1)` | `{page:min(1)}` | 大于等于 1 的整数 |
| `minlength(3)` | `{code:minlength(3)}` | 至少 3 个字符 |

多个约束可以串联使用，例如 `{id:int:min(1)}`。

::: warning 注意
**不要用路由约束做输入校验。** 约束失败返回的是 404，客户端只知道"地址不存在"，却不知道错在哪里。约束的职责是**区分路由**；"参数格式正确但取值不合法"（比如年龄是负数）属于输入校验，应该返回 400 和清晰的错误信息——这是「参数校验」一章的内容。
:::

## 路由优先级

<<< @/../samples/03-path-params/Program.cs{15,17 cs:line-numbers} [03-path-params/Program.cs]

注意注册顺序：第 15 行的 `/users/{id:int}` 写在了第 17 行的 `/users/me` **前面**。但请求 `/users/me` 时，命中的是第 17 行。

这和注册顺序无关。即使去掉 `:int` 约束，让 `/users/{id}` 在形式上也能匹配 `me`，`/users/me` 仍然会命中第 17 行（你可以自己试试）。ASP.NET Core 的路由系统**不是按注册顺序逐个尝试**，而是先找出所有能匹配的候选端点，再按**优先级**选出最具体的那个。粗略地说：

1. 字面量段（如 `me`）最优先；
2. 其次是带约束的参数（如 `{id:int}`）；
3. 再次是不带约束的参数（如 `{id}`）；
4. 捕获全部参数（如 `{*path}`，下一节介绍）最后。

**为什么这样设计？** 因为在真实项目里，端点往往分散在多个文件中注册（见「组织更大的项目」一章），注册顺序很难控制，也不应该影响程序的行为。基于优先级的匹配让你可以按任意顺序注册端点，结果都一样。

::: fastapi
这是和 FastAPI 差别很大的一点。FastAPI 按声明顺序匹配路由，所以 `/users/me` 必须写在 `/users/{user_id}` 之前；ASP.NET Core 中顺序无关紧要。
:::

那如果一个请求能同时匹配两个路由，而它们的优先级又完全相同呢？比如同时注册了 `/users/{id}` 和 `/users/{name}`（都没有约束），请求 `/users/42` 时框架无从选择，会返回 `500` 错误和 `AmbiguousMatchException`（模糊匹配异常）。

注意，冲突的前提是**能匹配同一个请求**。`/users/{id}` 和 `/posts/{id}` 优先级相同，但永远不会匹配同一个 URL，所以没有问题。

对于上面这种冲突，编译时就会收到警告：

```text
warning ASP0022: Route '/users/{id}' conflicts with another handler route. An HTTP request that matches multiple routes results in an ambiguous match error.
```

这是 ASP.NET Core 自带的**分析器**（analyzer）在检查你的代码——它不只检查 C# 语法，还理解路由模板的含义。

::: warning 注意
不要把"编译没有警告"当成"路由没有冲突"。为了避免误报，ASP0022 刻意很保守：它只检查**同一代码块内**的重复路由，比如分别写在 `if` 两个分支里的冲突路由就不会被报告。分析器能帮你发现常见错误，但不能替代测试。
:::

## 捕获全部参数

<<< @/../samples/03-path-params/Program.cs{19 cs:line-numbers} [03-path-params/Program.cs]

普通的路由参数只匹配**一段**，也就是两个 `/` 之间的内容。参数名前加上 `*`，就成了**捕获全部参数**（catch-all parameter）：它会把剩余的所有段，**包括中间的 `/`**，一起交给参数。

所以请求 `/files/docs/2026/report.pdf` 时，`path` 的值是 `docs/2026/report.pdf`。这种参数适合表示文件路径、多级分类之类层级不固定的数据。捕获全部参数只能出现在模板的最后一段。

::: warning 注意
`path` 的类型是 `string`（不可为 null），所以它是**必填**的。请求 `/files/`（后面什么都没有）会得到 400 错误。如果希望允许为空，可以把参数类型改为 `string?`——问号表示"可以为 null"，这时 `path` 会收到 `null`。可空类型的说明可以回看[「C# 速览」](./csharp-tour)。
:::

::: fastapi
`{*path}` 相当于 FastAPI 中的 `{file_path:path}` 路径转换器。
:::

## 名字对不上会怎样

参数绑定是靠名字对应的，那么名字写错会发生什么？假设模板是 `"/users/{id}"`，而处理程序的参数写成了 `(int userId)`。编译能通过，但请求 `/users/5` 会得到：

```text
HTTP/1.1 400 Bad Request

Microsoft.AspNetCore.Http.BadHttpRequestException: Required parameter "int userId" was not provided from query string.
```

注意错误信息的最后：框架去**查询字符串**（query string）里找 `userId` 了。因为路由模板里没有叫 `userId` 的参数，框架就推断它应该来自 URL 中 `?` 后面的部分。

这正好引出了下一章的主题。现在你只需要记住：**路由模板里的名字和参数名必须一致**。

## 总结

- 在路由模板中用 `{name}` 声明**路由参数**，处理程序中**同名**的参数会自动接收它的值。
- 参数类型（如 `int`）决定了字符串到值的转换规则；转换后的值在编译期按该类型检查，并自动写进 OpenAPI 文档。
- **路由约束**（如 `{id:int}`）在匹配端点之前生效，失败返回 404；参数类型转换在匹配之后，失败返回 400。约束用于区分路由，不用于输入校验。
- 路由按**优先级**而非注册顺序匹配：字面量 > 带约束参数 > 普通参数 > 捕获全部参数。能匹配同一请求、且优先级相同的路由会导致模糊匹配错误，分析器 ASP0022 能在编译期发现其中一部分。
- `{*path}` 是**捕获全部参数**，能匹配包含 `/` 的剩余路径。

下一章：[查询参数](./query-params)——处理 URL 中 `?` 后面的部分。上一章：[第一步](./first-steps)。
