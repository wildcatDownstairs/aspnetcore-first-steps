---
title: 日志
description: 通过依赖注入获取 ILogger<T>，用消息模板写出结构化日志；理解日志级别和类别，并在配置中按类别控制输出。
---

# 日志

上一章用 `Console.WriteLine` 看执行顺序。日志一多，我们就会想只看某个类的输出，或者暂时打开调试信息。这些事可以交给 `ILogger`。

本章还会把 Todo 编号作为独立字段保留下来，让日志工具能直接按编号搜索。这叫**结构化日志**（structured logging）。

<<< @/../samples/14-logging/Program.cs{19,24,48,58,71 cs:line-numbers} [14-logging/Program.cs]

示例沿用了「依赖注入」一章的 `ITodoStore`，并且在处理程序和存储服务中都写了日志。开发环境的配置文件中加了一行：

<<< @/../samples/14-logging/appsettings.Development.json{6 json:line-numbers} [14-logging/appsettings.Development.json]

## 运行与验证

先停止上一章的服务，从仓库根目录执行：

```bash
cd samples/14-logging
dotnet run
```

创建一个待办事项，查询它，再查询一个不存在的：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'
curl http://localhost:5080/todos/1
curl http://localhost:5080/todos/99
```

运行服务的终端中，启动信息之后会出现：

```text
info: InMemoryTodoStore[0]
      Created Todo 1 with title: Buy milk
dbug: InMemoryTodoStore[0]
      Looking up Todo 1; 1 item(s) currently exist
dbug: InMemoryTodoStore[0]
      Looking up Todo 99; 1 item(s) currently exist
warn: Program[0]
      Todo 99 not found
```

每条日志的第一行由三部分组成：`info` / `dbug` / `warn` 是**级别**，`InMemoryTodoStore`、`Program` 是**类别**，方括号里的 `0` 是事件编号（本节没有用到）。第二行是日志消息。

## 获取 ILogger

<<< @/../samples/14-logging/Program.cs{19,48 cs:line-numbers} [14-logging/Program.cs]

日志记录器是一个服务，获取方式和「依赖注入」一章完全一样：

- 第 19 行，处理程序声明了一个 `ILogger<Program>` 参数；
- 第 48 行，`InMemoryTodoStore` 在构造函数中声明了 `ILogger<InMemoryTodoStore>`。类名后面的括号是 C# 12 引入的**主构造函数**（primary constructor），参数 `logger` 在整个类中都可以使用。

日志服务由框架预先注册好，你不需要调用任何 `AddXxx()`。

尖括号中的类型决定日志的**类别**（category）。本例中就是 `Program` 和 `InMemoryTodoStore`，可以据此分辨来源、单独调整输出级别。`Program` 是编译器为顶级语句生成的类名。

## 日志级别

.NET 的日志分为六个级别，从低到高：

| 级别 | 方法 | 用途 |
| --- | --- | --- |
| Trace | `LogTrace` | 最详细的跟踪信息，通常只在排查特定问题时打开 |
| Debug | `LogDebug` | 开发调试时有用的信息 |
| Information | `LogInformation` | 应用正常运行中的重要事件，比如"创建了一个待办事项" |
| Warning | `LogWarning` | 不正常但不影响运行的情况，比如"找不到请求的资源" |
| Error | `LogError` | 当前操作失败了，比如未处理的异常 |
| Critical | `LogCritical` | 整个应用面临崩溃，比如磁盘写满 |

本例把创建记为 Information、查找过程记为 Debug、找不到记为 Warning，方便比较输出。普通的“资源不存在”未必值得警告，实际项目可以用更低级别。生产环境也常需要 Information 来观察业务活动，不必一律只保留 Warning。

## 按类别控制输出

`appsettings.json` 中的 `Logging:LogLevel` 为每个类别设置了**最低级别**，低于它的日志会被丢弃：

| 键 | 值 | 含义 |
| --- | --- | --- |
| `Default` | `Information` | 没有单独设置的类别，只输出 Information 及以上 |
| `Microsoft.AspNetCore` | `Warning` | 框架内部的日志只输出 Warning 及以上，避免刷屏 |
| `InMemoryTodoStore` | `Debug` | 本节加在开发环境配置中，让存储服务输出 Debug 日志 |

类别按前缀匹配；有多个匹配时，更具体的前缀优先。`Microsoft.AspNetCore` 可以为它下面的 Routing 等类别设置默认级别，再用更具体的类别覆盖。

这就是为什么 Debug 日志只在开发环境中出现。以生产环境运行时（没有加载 `appsettings.Development.json`），同样的三个请求只会输出：

```text
info: InMemoryTodoStore[0]
      Created Todo 1 with title: Buy milk
warn: Program[0]
      Todo 99 not found
```

排查问题时，可以在启动应用前用环境变量覆盖级别，不必修改代码。例如 `Logging__LogLevel__Default=Debug` 会改变默认规则，但不会覆盖更具体的类别规则。修改环境变量后，需要重启进程才能读到新值。

## 消息模板

<<< @/../samples/14-logging/Program.cs{24,71 cs:line-numbers} [14-logging/Program.cs]

注意日志消息的写法：`"Todo {TodoId} not found"`，后面跟着参数 `id`。它**不是**字符串插值（前面没有 `$`），而是一个**消息模板**（message template）：花括号里是**占位符的名字**，参数按顺序填入。

普通控制台输出看不出字段有没有保留。停止当前服务，改用 JSON 格式启动，再查看同一条日志：

```bash
dotnet run -- --Logging:Console:FormatterName=json --Logging:Console:FormatterOptions:JsonWriterOptions:Indented=true
```

请求 `/todos/99` 后，Warning 日志如下：

```json
{
  "EventId": 0,
  "LogLevel": "Warning",
  "Category": "Program",
  "Message": "Todo 99 not found",
  "State": {
    "TodoId": 99,
    "{OriginalFormat}": "Todo {TodoId} not found"
  }
}
```

`State.TodoId` 是数字 `99`，可以交给日志平台按字段检索。若先用 `$"Todo {id} not found"` 拼好字符串，日志系统拿到的就只有整句话，需要另外解析才能提取编号。

::: warning 注意
这里应把 `id` 作为单独参数传给日志方法，保留 `TodoId` 字段。字符串插值会提前拼接文本，即使这条日志最终被过滤掉，也已经做了这一步工作。
:::

::: tip 提示
占位符的名字用 PascalCase，并且在整个应用中保持一致。例如所有涉及待办事项编号的日志都用 `{TodoId}`，这样在日志平台里用一个字段名就能查到全部相关记录。
:::

::: fastapi
Python 的 `logging` 模块中 `logger.warning("Todo %s not found", id)` 也是延迟格式化，但默认不保留结构化字段。ASP.NET Core 的 `ILogger` 从一开始就是结构化的，不需要额外的库。
:::

::: info 技术细节
对于调用非常频繁的日志，可以使用 `[LoggerMessage]` 特性配合源代码生成器，在编译时生成高性能的日志方法，进一步避免装箱和解析模板的开销。对于本教程的规模，直接调用 `LogInformation` 等方法已经足够。
:::

## 总结

- 通过依赖注入获取 `ILogger<T>`，`T` 决定日志的**类别**，日志服务由框架预先注册。
- 六个**级别**从 Trace 到 Critical，分别用于详细跟踪、调试信息、正常事件和不同程度的错误。
- `Logging:LogLevel` 为每个类别设置最低输出级别，按前缀匹配；不同环境的配置文件让开发时更详细、生产时更简洁。
- 使用**消息模板**（`"… {TodoId}", id`）而不是字符串插值，占位符会成为可查询的结构化字段。

本章是「应用骨架」阶段的最后一章。下一章：[EF Core 入门](./efcore-basics)——把内存存储换成 SQLite 数据库，重启后数据仍然保留。上一章：[中间件](./middleware)。
