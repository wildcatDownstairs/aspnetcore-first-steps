---
title: 依赖注入
description: 把数据存取封装成服务并注册到容器，由框架在需要时创建和传入；理解 Singleton、Scoped、Transient 三种生命周期，以及为什么数据库上下文是 Scoped。
---

# 依赖注入

前面的处理程序直接读写 `Program.cs` 中的列表。这一章把列表和读写操作放进 `InMemoryTodoStore`，再让框架把这个对象传给处理程序。

这种由外部提供所需对象的做法叫**依赖注入**（dependency injection，DI）。先看代码里少了什么：处理程序不再管理列表，也不用自己创建存储对象，只要声明一个 `ITodoStore` 参数。

<<< @/../samples/11-dependency-injection/Program.cs{7-10,22,24,30-38,46-75 cs:line-numbers} [11-dependency-injection/Program.cs]

## 运行与验证

```bash
dotnet run
```

待办事项接口的用法和之前一样：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'
```

```json
{"id":1,"title":"Buy milk","done":false}
```

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Buy milk","done":false}]
```

另外有一个演示端点 `/lifetimes`，连续请求两次：

```bash
curl http://localhost:5080/lifetimes
curl http://localhost:5080/lifetimes
```

```json
{"singleton":["91e834bc","91e834bc"],"scoped":["87edf2ac","87edf2ac"],"transient":["d4f30286","a151a3a5"]}
{"singleton":["91e834bc","91e834bc"],"scoped":["16f8e1fc","16f8e1fc"],"transient":["6e9ab485","c3b925ae"]}
```

每个编号代表一个对象实例，你看到的编号会不同，但**哪些相同、哪些不同**的规律是一样的。这个规律是本节后半部分的重点。

## 把数据存取变成服务

<<< @/../samples/11-dependency-injection/Program.cs{46-75 cs:line-numbers} [11-dependency-injection/Program.cs]

第 46～50 行定义了一个**接口**（interface）`ITodoStore`，它只描述"能做什么"：获取全部、添加一项。第 52～75 行的 `InMemoryTodoStore` 是它的一个**实现**，用内存列表完成这些操作。按惯例，接口名以大写字母 `I` 开头。

这样的类在依赖注入中叫做**服务**（service）：一个为应用其他部分提供某种能力的对象。

## 注册服务

<<< @/../samples/11-dependency-injection/Program.cs{7 cs:line-numbers} [11-dependency-injection/Program.cs]

「第一步」中说过，`builder.Services` 是"应用在运行时需要用到的组件清单"。现在你自己往清单里加了一项。第 7 行的意思是：

> 当有人需要 `ITodoStore` 时，提供一个 `InMemoryTodoStore`。

管理这份清单、负责创建对象的组件叫**依赖注入容器**（DI container）。`AddOpenApi()` 这类方法，内部做的也是同样的事情：一次注册若干个框架自己的服务。

## 使用服务

<<< @/../samples/11-dependency-injection/Program.cs{22,24-28 cs:line-numbers} [11-dependency-injection/Program.cs]

处理程序声明一个 `ITodoStore` 参数。它没有显式指定绑定来源，而这个类型已经注册为服务，框架就从容器取出实例传进来，不从请求体读取。

服务参数不属于 HTTP 请求的一部分，所以不会出现在 OpenAPI 文档中；`/scalar` 页面里，`GET /todos` 依然显示为没有参数。

如果在每次请求里 `new InMemoryTodoStore()`，每次得到的都是空列表。交给容器后，我们可以通过注册方式决定哪些请求共享对象，而不用在每个处理程序里重复管理它。

`ITodoStore` 演示的是另一件事：处理程序只调用接口中的方法，因此可以换一个实现用于测试。**依赖注入并不要求每个类都配一个接口**，也可以直接注册具体类。第 15 章会直接注入 `TodoDbContext`，让你先看清数据库操作，不再套一层存储接口。

::: fastapi
这类似 FastAPI 的 `Depends(get_store)`：处理程序声明所需对象，由框架提供。这里按已注册的类型查找服务；是否共享同一个实例，取决于下面的生命周期设置。
:::

::: warning 注意
如果忘了第 7 行的注册，编译不会报错，第一次请求 `GET /todos` 时会得到 500：

```text
System.InvalidOperationException: Body was inferred but the method does not allow inferred body parameters.
Below is the list of parameters that we found:

Parameter           | Source
---------------------------------------------------------------------------------
store               | Body (Inferred)


Did you mean to register the "Body (Inferred)" parameter(s) as a Service or apply the [FromServices] or [FromBody] attribute?
```

框架不认识 `ITodoStore`，就按规则把这个复杂类型当成了请求体，而 GET 请求不允许有推断出来的请求体。错误信息的最后一句已经给出了答案：把它注册为服务。
:::

## 三种生命周期

<<< @/../samples/11-dependency-injection/Program.cs{8-10,30-38,77-86 cs:line-numbers} [11-dependency-injection/Program.cs]

第 77～86 行定义了三个几乎一样的"标记"类，每个实例在创建时生成一个随机编号。第 8～10 行用三种不同的方法注册它们，第 30～38 行的处理程序把每种类型**各要了两次**，返回它们的编号。对照开头的两次请求结果：

| 注册方法 | 生命周期 | 同一请求内两次获取 | 不同请求之间 |
| --- | --- | --- | --- |
| `AddSingleton` | **Singleton**（单例） | 同一个实例 | 同一个实例 |
| `AddScoped` | **Scoped**（作用域） | 同一个实例 | 不同实例 |
| `AddTransient` | **Transient**（瞬时） | 每次都是新实例 | 每次都是新实例 |

- **Singleton**：本例中所有请求共享一个实例，所以能保留内存列表。
- **Scoped**：每个作用域一个实例；在通常的 HTTP 请求中，同一个请求内共享，请求之间分开。
- **Transient**：每次向容器获取时都新建一个实例。

`ITodoStore` 注册为 Singleton，是因为数据必须在请求之间保留：如果注册成 Scoped，每个请求拿到的都是一个新的空列表，刚创建的待办事项下一次请求就消失了。

### Singleton 必须是线程安全的

同一时刻可能有多个请求在处理，它们拿到的是**同一个** Singleton 实例。所以 `InMemoryTodoStore` 用 `lock` 保护内部的列表（第 60、68 行）：同一时间只允许一个请求进入，避免两个请求同时修改列表导致数据损坏。「请求体」一章中那个"不是线程安全"的警告，在这里解决了。

第 62 行返回的是 `_todos.ToList()`，即列表的一份**副本**，而不是列表本身。否则调用方拿到列表后在锁外读取它，另一个请求可能正在修改。

::: info 技术细节
`Lock` 是 .NET 9 引入的专用锁类型，本例用 C# 的 `lock` 语句进入和退出锁。它保证同一时间只有一个线程执行受保护的代码段，不需要自己调用解锁方法。
:::

## 为什么 DbContext 是 Scoped

第 15 章会用到 EF Core 的 `DbContext`（数据库上下文），它会记录本次操作读取和修改的对象。`AddDbContext` 默认用 Scoped 注册：同一请求里的代码可以共用它，请求结束后释放，下一次请求重新开始。

它不是线程安全的，不能让所有请求共享一个 Singleton。Scoped 也不会自动加锁：即使在同一请求内，也不要用一个上下文同时执行多个数据库操作。先记住这个限制，具体用法到第 15 章再看。

### 不要让 Singleton 持有请求里的 Scoped 服务

假如 `InMemoryTodoStore`（Singleton）的构造函数需要一个 `ScopedMarker`（Scoped），会怎样？

Singleton 会一直持有构造时拿到的对象，原本应该按请求分开的 Scoped 服务就被长期留住了。如果它是 `DbContext`，多个请求还可能同时使用它。这种依赖被意外延长生命周期的情况叫**俘获依赖**（captive dependency）。

在开发环境中，容器会在启动时检查这类错误，应用直接启动失败：

```text
Unhandled exception. System.AggregateException: Some services are not able to be constructed (Error while validating the service descriptor 'ServiceType: ITodoStore Lifetime: Singleton ImplementationType: InMemoryTodoStore': Cannot consume scoped service 'ScopedMarker' from singleton 'ITodoStore'.)
```

这里要记住的是“不要直接把 Scoped 服务注入 Singleton”，不是“长生命周期一律不能依赖短生命周期”。例如 Singleton 可以接收 Transient，只是会长期持有当时创建的那一个实例；它不会在每次请求时自动换新。

::: warning 注意
默认的作用域检查在开发环境开启，在生产环境默认关闭。生产环境能启动，不代表这组依赖关系合理。[服务作用域检查](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview#scope-validation)
:::

## 总结

- **依赖注入**：处理程序通过参数声明需要的服务，由容器创建并传入，而不是自己 `new`。
- 用 `builder.Services.AddSingleton<接口, 实现>()` 等方法注册服务，也可以直接注册具体类，不必为每个服务创建接口。
- 已注册的服务类型会被自动识别为"来自容器"的参数，不会出现在 OpenAPI 文档中；忘记注册会被当成请求体而报错。
- 三种生命周期：**Singleton** 全局一个（必须线程安全），**Scoped** 每个请求一个，**Transient** 每次新建。
- `AddDbContext` 默认用 Scoped 注册数据库上下文；不要直接把 Scoped 服务注入 Singleton，开发环境会检查这类错误。

下一章：[配置与 Options](./configuration)——把可变的设置从代码中分离出来。上一章：[路由分组](./route-groups)。
