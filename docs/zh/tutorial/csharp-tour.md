---
title: C# 速览
description: 只讲本教程会用到的 C#：静态类型与 var、字符串插值、可空引用类型、Lambda、record、LINQ、async/await、联合类型，以及 C# 15 的其他新语法。
---

# C# 速览

这一章不是完整的 C# 教程，只挑出**后面章节一定会用到**的语法，让你读代码时不卡壳。如果你写过 Java、TypeScript、Kotlin 之类的静态类型语言，大部分内容一眼就能看懂，可以快速浏览。

与其他章节不同，本章是一次"速览"，会一次介绍几个小语法点。它们有一个共同的主题：**C# 是静态类型语言，编译器在运行前就知道每个值的类型，并据此帮你检查代码。**后面所有章节都建立在这个前提上。

本章的完整代码是一个控制台程序：

<<< @/../samples/01-csharp-tour/Program.cs{cs:line-numbers} [01-csharp-tour/Program.cs]

运行它（在 `samples/01-csharp-tour` 目录下，或者按「环境准备」的方式用 `dotnet new console` 新建项目并替换 `Program.cs`）：

```bash
dotnet run
```

预期输出：

```text
Alex has 2 todo items
Nickname length: 0
Square of 5 is 25
Todo { Id = 1, Title = Buy milk, Done = False }
Todo { Id = 1, Title = Buy milk, Done = True }
Value equality: True
Pending: Buy milk
Async operation complete
Todo 3 not found
High priority: Due today
Distinct tags: 2
Visited 1
Visited 2
Visited 3
Found by title: Todo { Id = 2, Title = Write code, Done = True }
```

下面分五组来看。

## 类型、可空与 Lambda

<<< @/../samples/01-csharp-tour/Program.cs{2-3,6,9-10,13-14 cs:line-numbers} [01-csharp-tour/Program.cs]

### 静态类型与 var

**第 2 行**显式写出了类型 `int`。**第 3 行**用 `var` 让编译器根据右边的值**推断**类型——`owner` 的类型是 `string`，而且之后永远是 `string`。

`var` 不是"动态类型"。如果之后写 `owner = 42;`，编译会直接失败。它只是省去了重复书写类型名，类型本身在编译期就确定了。在 VS Code 里把鼠标悬停在变量上，就能看到推断出的类型。

::: fastapi
Python 的类型标注（type hints）是可选的，运行时也不检查；FastAPI 读取它们来做数据转换。C# 的类型是强制的：编译器检查每一处使用，类型不对就无法运行。后面你会看到 ASP.NET Core 同样读取这些类型来做参数绑定和生成文档。
:::

### 字符串插值

**第 6 行**的字符串前面有个 `$`，这叫**字符串插值**（string interpolation）：花括号里可以直接写变量或表达式，运行时替换成它的值。这和 Python 的 f-string、JavaScript 的模板字符串是一回事。

### 可空引用类型

**第 9 行**的 `string?` 表示"这个变量可能是 `null`"；不带问号的 `string` 表示"不应该是 `null`"。这个特性叫**可空引用类型**（nullable reference types），在项目文件中由 `<Nullable>enable</Nullable>` 开启，.NET 模板默认就是开启的。

**为什么需要它？**空引用错误（访问 `null` 的成员）是最常见的运行时崩溃之一。有了可空标注，编译器能提前发现隐患。比如把第 10 行改成直接访问 `nickname.Length`，编译时就会警告：

```text
Program.cs(10,19): warning CS8602: 解引用可能出现空引用。
```

第 10 行的正确写法用到了两个运算符：

- `?.`（空条件运算符）：`nickname` 为 `null` 时不访问 `.Length`，整个表达式的结果直接是 `null`；
- `??`（空合并运算符）：左边为 `null` 时使用右边的值，这里是 `0`。

::: warning 注意
可空标注是**编译期**检查，不会在运行时阻止 `null` 出现。比如从 JSON 反序列化出来的数据，即使类型写的是 `string`，缺少字段时仍然可能是 `null`。「请求体」一章会遇到这种情况，「参数校验」一章会解决它。
:::

### Lambda 表达式

**第 13 行**的 `x => x * x` 是一个 **Lambda 表达式**（匿名函数）：`=>` 左边是参数，右边是返回值。`Func<int, int>` 是它的类型，意思是"接收一个 `int`，返回一个 `int` 的函数"。

下一章「第一步」会用到它：`app.MapGet("/", () => ...)` 的第二个参数就是 Lambda。Lambda 的函数体也可以是一个用花括号包起来的代码块，里面用 `return` 返回结果，后面的章节会经常这样写。

::: fastapi
相当于 Python 的 `lambda x: x * x`，但 C# 的 Lambda 可以包含多行语句，所以端点的处理逻辑可以直接写在 Lambda 里。
:::

## record 与 LINQ

<<< @/../samples/01-csharp-tour/Program.cs{17-21,24-26,77 cs:line-numbers} [01-csharp-tour/Program.cs]

### record

**第 77 行**一行代码定义了一个类型 `Todo`：

- 圆括号中的 `int Id, string Title, bool Done` 既是构造函数的参数，也自动生成同名的 `init` 属性，只能在初始化时赋值；
- 编译器还自动生成了 `ToString()`（所以第 19 行能打印出 `Todo { Id = 1, ... }`）和基于值的相等比较。

这种类型叫 **record**（记录类型）。本例使用的是位置式 `record class`（`class` 关键字可以省略），适合表示"一组数据"，有两个方便的特性：

1. **值相等**：两个 record 的所有属性都相等，它们就相等。第 21 行 `milk == new Todo(1, "Buy milk", false)` 的结果是 `True`，即使它们是两个不同的对象。
2. **初始化后不能重新赋值**：本例自动生成的 `init` 属性只能在初始化时赋值。想要"修改"，就用 **第 18 行** 的 `with` 表达式复制一份并替换部分属性，原来的 `milk` 保持不变。

`record` 本身并不强制不可变：你仍然可以声明带 `set` 的属性。如果属性指向一个可变列表，`init` 也只限制替换这个列表，不会阻止修改列表中的元素。这叫**浅层不可变性**（shallow immutability）。

**为什么 Web API 偏爱 record？**请求和响应中的数据本质上就是"一组值"：它们从 JSON 来、到 JSON 去，中途不应该被意外修改。record 用最少的代码表达了这种意图。从「请求体」一章开始，所有的数据模型都会用 record 定义。

::: info 技术细节
在使用顶级语句的 `Program.cs` 中，类型定义（如 `record Todo`）必须写在所有语句的**后面**，所以你会在每个示例文件的末尾看到它们。第 32 行的 `static async Task<string> LoadMessageAsync()` 是一个**局部函数**，可以写在语句之间，也可以写在后面。
:::

::: fastapi
record 的角色类似 Pydantic 模型或 `@dataclass(frozen=True)`：用字段声明描述数据的形状。区别在于 record 本身不做校验，校验由 ASP.NET Core 在「参数校验」一章中另行完成。
:::

### 集合与 LINQ

**第 24 行**的方括号 `[milk, new Todo(2, "Write code", true)]` 是**集合表达式**（collection expression），用来创建一个 `List<Todo>`。`List<Todo>` 中的 `<Todo>` 叫**泛型参数**，表示"这是一个只能装 `Todo` 的列表"，往里放其他类型的东西会编译失败。

**第 25 行**是 **LINQ**（Language Integrated Query，语言集成查询）：

- `Where(t => !t.Done)`：筛选出未完成的项；
- `Select(t => t.Title)`：只取出标题。

两个方法都接收 Lambda 作为参数，可以像管道一样串联。LINQ 在后面会频繁出现：「查询参数」一章用它做筛选和分页，「EF Core 入门」一章会看到同样的写法被翻译成 SQL 查询数据库。

::: fastapi
第 25 行相当于 Python 的 `[t.title for t in todos if not t.done]`。
:::

## async / await

<<< @/../samples/01-csharp-tour/Program.cs{29,32-36 cs:line-numbers} [01-csharp-tour/Program.cs]

**第 32～36 行**定义了一个**异步方法**：

- `async` 表示方法内部可以使用 `await`；
- 返回类型 `Task<string>` 表示"一个将来会产生 `string` 的操作"；
- 第 34 行的 `await Task.Delay(100)` 等待 100 毫秒，但**不会阻塞线程**。

**第 29 行**用 `await` 等待这个方法完成，取出结果。按照惯例，异步方法的名字以 `Async` 结尾。

**为什么 Web 服务要用异步？**服务器处理请求时，大部分时间在等待：等数据库返回、等文件读完、等另一个服务响应。同步代码在等待期间会一直占着线程；异步代码在等待时把线程交还给服务器，让它去处理别的请求。结果是同样的机器能同时处理多得多的请求。从「EF Core 入门」开始，所有数据库操作都会是异步的。

::: fastapi
和 Python 的 `async def` / `await` 概念一致。区别是 ASP.NET Core 中同步和异步的处理程序可以混用，框架都能正确处理，不存在"在 async 函数里调用同步阻塞代码会卡住事件循环"这类问题——但阻塞调用仍会浪费线程，所以涉及 I/O 时仍应使用异步 API。
:::

## 联合类型

<<< @/../samples/01-csharp-tour/Program.cs{39-45,78-79 cs:line-numbers} [01-csharp-tour/Program.cs]

**第 79 行**用 `union` 声明了一个**联合类型**（union type）：`TodoResult` 的值要么是 `Todo`，要么是 `NotFound`，没有别的可能。这是 C# 15 新增的语法。

- **第 39 行**把一个 `NotFound` 直接赋给 `TodoResult` 变量，编译器自动完成转换；
- **第 40～44 行**的 `switch` 表达式按实际类型选择分支。`Todo todo =>` 的意思是"如果里面是 `Todo`，就把它取出来，命名为 `todo`"。

**编译器会检查分支是否写全。**删掉第 43 行再编译，会得到警告：

```text
Program.cs(40,22): warning CS8509: switch 表达式不处理其输入类型的所有可能的值(它不是穷举)。例如，模式“NotFound”未包含在内。
```

以后给 `TodoResult` 增加第三种情况时，所有没有更新的 `switch` 都会被这样指出来。

"找到了就返回数据，没找到就返回 404"是 Web API 里很常见的结果。「响应类型」一章会用 ASP.NET Core 自带的 `Results<Ok<Todo>, NotFound>` 表达同样的意思：它出现在 C# 有 `union` 之前，写法不同，思路一致。

::: fastapi
相当于 Python 类型标注里的 `Todo | NotFound`，`switch` 表达式对应 `match` 语句。区别是 C# 编译器会检查分支是否完整。
:::

## C# 15 的其他新语法

除了联合类型，C# 15 还增加了几种语法。后面的章节不依赖它们，但你在别处读代码时会遇到。

<<< @/../samples/01-csharp-tour/Program.cs{48-54,57,62,68,75,80-82,86-89 cs:line-numbers} [01-csharp-tour/Program.cs]

### 封闭层次结构

**第 80 行**的 `closed` 表示：只有同一个**程序集**（assembly，可以先理解为"同一个项目"）里的类型可以继承 `Priority`。第 81、82 行就是它全部的派生类型。`closed` 类型本身不能直接创建实例。

派生类型是固定的，所以**第 49～53 行**的 `switch` 表达式列出 `Low` 和 `High` 之后，编译器就知道分支已经写全，不需要再写一个兜底分支。漏掉一个分支时，会得到和联合类型相同的 CS8509 警告。

联合类型和封闭层次结构怎么选？几种情况是互不相关的现成类型（如 `Todo` 和 `NotFound`）时用 `union`；几种情况本来就有共同的基类型时用 `closed`。

### 集合表达式参数

**第 57 行**方括号里的第一项 `with(...)` 不是集合的元素，而是传给集合构造函数的参数。这里传入 `StringComparer.OrdinalIgnoreCase`，让 `HashSet<string>` 比较时忽略大小写，所以 `"home"` 和 `"Home"` 算同一个元素，程序输出 `Distinct tags: 2`。

在 C# 15 之前，需要传构造函数参数时不能用方括号写法，只能写成 `new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ... }`。

### 带标签的 break 与 continue

**第 62 行**在外层循环前写了标签 `outer:`。**第 68 行**的 `break outer;` 直接跳出这个外层循环；不带标签的 `break` 只能跳出最内层的循环。所以输出停在 `Visited 3`，后面的 5 和 6 不会被访问。

`continue outer;` 的用法相同，表示直接进入外层循环的下一轮。

### 扩展索引器

**第 86～89 行**是一个**扩展块**（extension block）：`extension(List<Todo> todos)` 表示"给 `List<Todo>` 添加成员"，不需要修改 `List<T>` 本身。扩展块是 C# 14 引入的，C# 15 允许在里面声明**索引器**（indexer，即 `this[...]`，它决定用方括号访问时的行为）。

于是**第 75 行**可以写 `todos["Write code"]`，按标题查找待办。`List<T>` 自带的按位置访问（如 `todos[0]`）不受影响。返回类型是 `Todo?`，找不到时结果为 `null`。

## 总结

- C# 是**静态类型**语言，`var` 只是让编译器推断类型，类型本身在编译期确定。
- `$"..."` 是**字符串插值**；`string?` 表示**可为空**，配合 `?.` 和 `??` 安全地处理 `null`。可空检查只发生在编译期。
- **Lambda** 表达式 `x => ...` 是匿名函数，`MapGet` 等方法用它作为处理程序。
- **位置式 record** 能简洁地定义数据类型，自带值相等和 `with` 复制；本例的属性使用 `init`，但 `record` 并不强制所有成员不可变。
- **联合类型** `union` 列出一个值可能的几种类型，`switch` 表达式漏掉分支时编译器会警告。
- C# 15 还新增了 `closed` 封闭层次结构、集合表达式参数 `with(...)`、带标签的 `break` / `continue` 和扩展索引器。
- **LINQ** 用 `Where`、`Select` 等方法链式处理集合；**async/await** 让等待 I/O 时不占用线程。

下一章：[第一步](./first-steps)——写出你的第一个 Web API。上一章：[环境准备](./setup)。
