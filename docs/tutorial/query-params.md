---
title: 查询参数
description: 用处理程序的普通参数接收 URL 查询字符串，理解必填与可选、默认值、数组参数，以及框架如何推断参数来源。
---

# 查询参数

上一章结尾，我们看到一个名字对不上的路由参数被框架当成了"查询字符串"。本节就来正式认识它：**查询参数**（query parameter），也就是 URL 中 `?` 后面的 `key=value` 部分，例如 `/todos?done=false&page=2`。

它们通常用来**筛选、排序、分页**——不改变"访问的是哪个资源"，只改变"怎么看这个资源"。

本节最终的完整代码：

<<< @/../samples/04-query-params/Program.cs{24-34 cs:line-numbers} [04-query-params/Program.cs]

第 15～22 行准备了一个内存中的待办事项列表作为演示数据。它用了「C# 速览」中介绍的集合表达式，`new(1, "买牛奶", false)` 省略了类型名，因为编译器能从 `List<Todo>` 推断出来。

## 运行与验证

```bash
dotnet run
```

不带任何参数时，使用默认的分页设置（每页 2 条）：

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"买牛奶","done":false},{"id":2,"title":"写周报","done":true}]
```

翻到第 2 页：

```bash
curl "http://localhost:5080/todos?page=2"
```

```json
[{"id":3,"title":"给猫铲屎","done":false},{"id":4,"title":"学习 ASP.NET Core","done":false}]
```

只看未完成的，每页 10 条：

```bash
curl "http://localhost:5080/todos?done=false&pageSize=10"
```

```json
[{"id":1,"title":"买牛奶","done":false},{"id":3,"title":"给猫铲屎","done":false},{"id":4,"title":"学习 ASP.NET Core","done":false}]
```

::: warning 注意
URL 中包含 `&` 时，一定要用引号把整个地址括起来。否则终端会把 `&` 当作"在后台运行"的命令分隔符，后面的参数就丢了。
:::

## 处理程序的参数就是查询参数

<<< @/../samples/04-query-params/Program.cs{24 cs:line-numbers} [04-query-params/Program.cs]

路由模板 `"/todos"` 里没有任何花括号，但处理程序有三个参数：`done`、`page`、`pageSize`。框架发现这些名字**不在路由模板中**，就会去查询字符串里找同名的值。

这就是上一章末尾那个现象的原因。框架决定参数来源的规则可以粗略概括为：

| 参数 | 来源 |
| --- | --- |
| 名字出现在路由模板中 | 路由 |
| 简单类型（`int`、`string`、`bool`、`DateTime` 等），且不在路由模板中 | 查询字符串 |
| 复杂类型（比如 record） | 请求体（下一章） |

这套推断规则让最常见的写法最简短。当推断不符合你的意图时，也可以用特性（attribute）显式指定来源，比如 `[FromQuery]`、`[FromRoute]`，我们在「Header 与 Cookie」一章会用到同类的 `[FromHeader]`。

::: tip 提示
查询参数的名字**不区分大小写**：`?Done=true&PAGESIZE=1` 和 `?done=true&pageSize=1` 效果相同。
:::

## 必填与可选

同样是查询参数，`done`、`page`、`pageSize` 都是**可选**的，而下面这个端点的 `keyword` 是**必填**的：

<<< @/../samples/04-query-params/Program.cs{24,30-31 cs:line-numbers} [04-query-params/Program.cs]

区别完全来自参数的**类型声明**：

| 声明 | 含义 | 请求中没有这个参数时 |
| --- | --- | --- |
| `string keyword` | 不可为 null，没有默认值 | 返回 400 |
| `bool? done` | 可为 null（`?`） | 收到 `null` |
| `int page = 1` | 有默认值 | 收到 `1` |

不带 `keyword` 请求会得到：

```bash
curl -i http://localhost:5080/todos/search
```

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Required parameter "string keyword" was not provided from query string.
```

这正是「C# 速览」中可空引用类型的用武之地：**`?` 不仅告诉编译器"这里可能是 null"，也告诉框架"这个参数可以不传"。**你不需要再写任何额外的标注。

第 26 行利用了 `done` 可为 null 这一点：`done is null` 时表示"不筛选"，返回全部；否则只保留 `Done` 等于 `done` 的项。

::: info 技术细节
`int page = 1` 这种写法是 Lambda 参数的**默认值**，从 C# 12 开始支持。ASP.NET Core 读取到默认值后，会把参数视为可选，并把默认值写进 OpenAPI 文档：`/openapi/v1.json` 中 `page` 参数的描述里会出现 `"default": 1`，`keyword` 则带有 `"required": true`。
:::

### 类型不对时

和路由参数一样，查询参数也会按声明的类型转换，转换失败就返回 400：

```bash
curl -i "http://localhost:5080/todos?page=abc"
```

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Failed to bind parameter "int page" from "abc".
```

`done=yes` 也会得到类似的错误，因为 `bool` 只接受 `true` 和 `false`。

::: fastapi
和 FastAPI 几乎完全一致：没有默认值的参数是必填的，`Optional[bool] = None` 对应 C# 的 `bool? done`，`page: int = 1` 对应 `int page = 1`。
:::

## 数组参数

<<< @/../samples/04-query-params/Program.cs{33-34 cs:line-numbers} [04-query-params/Program.cs]

把参数声明为数组 `int[] id`，同一个参数名就可以在查询字符串中出现多次：

```bash
curl "http://localhost:5080/todos/batch?id=1&id=3&id=5"
```

```json
[{"id":1,"title":"买牛奶","done":false},{"id":3,"title":"给猫铲屎","done":false},{"id":5,"title":"预约体检","done":true}]
```

一个 `id` 都不传时，`id` 是一个空数组，结果也是空的 `[]`。数组参数总是可选的。

注意这里的参数名用的是单数 `id` 而不是 `ids`，因为它决定了 URL 里写的是 `?id=1&id=3`。命名时要从调用方的角度考虑。

## 中文与特殊字符

搜索中文关键字时，需要先对它做 **URL 编码**（URL encoding）：URL 只允许有限的 ASCII 字符，其他字符要转成 `%` 加十六进制的形式。"猫"编码后是 `%E7%8C%AB`：

```bash
curl "http://localhost:5080/todos/search?keyword=%E7%8C%AB"
```

```json
[{"id":3,"title":"给猫铲屎","done":false}]
```

框架在绑定参数前会自动解码，所以处理程序收到的 `keyword` 就是 `"猫"`。浏览器和 Scalar 文档页面会自动完成编码，直接在 `/scalar` 里输入中文测试最方便。

::: warning 注意
在 Windows 的终端里直接写 `keyword=猫`，中文可能在传给 curl 之前就被转换成了错误的编码，结果搜不到任何东西。遇到这种情况，请使用上面的编码形式，或者在 `/scalar` 页面中测试。
:::

## 总结

- 处理程序中**不在路由模板里**的简单类型参数，会自动从**查询字符串**绑定。
- 参数的类型声明决定了它是必填还是可选：普通类型必填，可空类型（`bool?`）或带默认值（`int page = 1`）的参数可选。缺少必填参数或类型转换失败都返回 400。
- 数组参数（`int[] id`）接收同名参数的多个值，形如 `?id=1&id=3`。
- 查询参数名不区分大小写；非 ASCII 字符需要 URL 编码，框架会自动解码。

下一章：[请求体](./request-body)——用 record 接收 JSON 数据。上一章：[路由参数](./path-params)。
