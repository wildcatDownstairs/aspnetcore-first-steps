---
title: EF Core 入门
description: 用 EF Core 和 SQLite 替换内存列表，理解 DbContext、实体与 SaveChangesAsync，并验证重启后的数据持久化。
---

# EF Core 入门

前面的 Todo 都保存在内存里，服务一重启就消失。这一章改用 SQLite 数据库保存，通过 **Entity Framework Core（EF Core）** 用 C# 对象读写数据，由它生成 SQL。这类工具叫**对象关系映射**（object-relational mapping，ORM）。

下面的处理程序直接接收数据库上下文，不再经过 `ITodoStore`；参数校验和错误处理沿用前面的做法。完整代码分成三个文件：

<<< @/../samples/15-efcore-basics/Program.cs{2,10-12,25-30,32-46 cs:line-numbers} [15-efcore-basics/Program.cs]

<<< @/../samples/15-efcore-basics/Models.cs{3-8 cs:line-numbers} [15-efcore-basics/Models.cs]

<<< @/../samples/15-efcore-basics/TodoDbContext.cs{3-6 cs:line-numbers} [15-efcore-basics/TodoDbContext.cs]

## 运行与验证

在仓库根目录打开终端：

```bash
cd samples/15-efcore-basics
dotnet run
```

项目文件声明了 SQLite 提供程序，`dotnet run` 会先还原依赖，不需要单独安装 SQLite 服务：

<<< @/../samples/15-efcore-basics/EfCoreBasics.csproj{9 xml:line-numbers} [15-efcore-basics/EfCoreBasics.csproj]

数据库位置来自配置文件：

<<< @/../samples/15-efcore-basics/appsettings.json{2-4 json:line-numbers} [15-efcore-basics/appsettings.json]

首次启动会在项目目录创建 `todos-15.db`。下面的输出基于一个新数据库。另开终端，先查询，再创建：

```bash
curl http://localhost:5080/todos
```

```json
[]
```

```bash
curl -i -X POST http://localhost:5080/todos -H "Content-Type: application/json" -d '{"title":"Buy milk"}'
```

响应摘录（省略日期等通用响应头）：

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /todos/1

{"id":1,"title":"Buy milk","done":false}
```

回到运行服务的终端，按 `Ctrl+C`，再执行 `dotnet run`。重新查询：

```bash
curl http://localhost:5080/todos/1
```

```json
{"id":1,"title":"Buy milk","done":false}
```

重启后仍能读到这条 Todo，说明数据已经写进 SQLite 文件。

::: tip 提示
每章使用独立的数据库文件。重复练习时，已有数据和编号会保留；想使用新的空数据库，可以停止服务后运行 `dotnet run -- --ConnectionStrings:Todos="Data Source=practice-15.db"`，选择一个尚不存在的文件名，不必删除旧数据。
:::

## 实体：数据库中的一行

`Models.cs` 中的 `Todo` 是一个**实体**（entity），对应表中的一行。EF Core 按约定把 `Id` 识别为**主键**（primary key）；本例的整数主键由数据库在插入时生成，不再需要 `_nextId`。

为什么实体用 `class`，请求仍用 `record`？EF Core 要跟踪具体的实体实例，并在更新时观察属性变化；普通可变类适合这项工作。`CreateTodo` 则描述客户端可以提交的字段，仍适合用简洁的 record。客户端不能通过这个请求模型指定 `Id` 或 `Done`。

`Title` 后面的 `= ""` 是属性初始值，避免新建对象时出现未初始化的非空字符串。输入是否合格仍由 `CreateTodo` 上的 `[Required]`、`[StringLength]` 和 `AddValidation()` 检查。

## 用 DbContext 读写数据

`TodoDbContext` 继承 **DbContext（数据库上下文）**。其中的 `DbSet<Todo>` 是查询和写入 Todo 的入口；它不是把整张表预先装进内存的 `List<Todo>`。

`AddDbContext` 把上下文注册到依赖注入容器，默认是 Scoped：在 Web 请求中，同一个作用域使用同一个实例，请求结束后由容器释放。`UseSqlite` 选择数据库提供程序，连接字符串指定文件位置。

::: warning 注意
`DbContext` 不是线程安全的。不要把它注册成 Singleton，也不要用同一个实例同时执行多个查询；先 `await` 当前操作完成，再进行下一步。[官方生命周期说明](https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/)
:::

启动时还没有请求作用域，所以第 26 行手动创建一个作用域，取出上下文初始化数据库。`using` 会在离开代码块时释放这个作用域及其中的服务。

## 查询与保存是两种动作

`GET /todos` 中，`OrderBy` 指定返回顺序，`ToListAsync()` 才执行数据库查询并取回列表。没有排序时，不应依赖数据库“碰巧”返回的顺序。`AsNoTracking()` 表示这些只读结果不需要加入**变更跟踪**（change tracking），减少上下文维护的状态。

`FindAsync(id)` 按主键查找单个 Todo：当前上下文已经跟踪它时可以直接返回，否则查询数据库。找不到得到 `null`，处理程序返回 404。

POST 中的三步需要分清：

1. `new Todo` 创建 C# 对象，此时还没有写入数据库。
2. `db.Todos.Add(todo)` 把它标记为待插入。
3. `await db.SaveChangesAsync()` 执行插入，随后 `todo.Id` 才包含数据库生成的编号。

**为什么不在 Add 时立即写入？**上下文可以先收集一组修改，再统一保存。忘记 `SaveChangesAsync()`，内存中的对象虽然存在，数据库里却不会多出那一行。

`Task<Created<Todo>>` 表示等待异步方法完成后，会得到一个 `Created<Todo>` 结果；`async` / `await` 的语法见「C# 速览」。

::: info 技术细节
本例统一使用 EF Core 的异步方法。不过，底层的 Microsoft.Data.Sqlite 不支持异步 I/O，这些调用最终仍同步执行；换用其他数据库提供程序时则可能不同。[SQLite 异步限制](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/async)
:::

## 建表不等于升级表结构

本例的 `EnsureCreatedAsync()` 适合独立学习项目：数据库没有表时创建模型所需的表，已有表时不会替你升级结构。

::: warning 注意
修改实体后，`EnsureCreatedAsync()` 不会自动添加列。要升级已有数据库，应使用**迁移**（migration）；它和 `EnsureCreated` 不能直接混用。本教程每章使用独立文件。需要保留并升级已有数据时，见 [数据库迁移附录](../advanced/efcore-migrations)。
:::

::: fastapi
EF Core 的角色接近 SQLAlchemy；`DbContext` 可类比一次工作范围内的 Session，`SaveChangesAsync()` 写入已跟踪的变更。它们的 API 和事务细节不完全相同。
:::

::: tip 提示
想从 SQL 的角度理解查询与保存，可以查阅 [EF Core / LINQ ↔ PostgreSQL 速查](../efcore-sql-cheatsheet#execution)，附可运行的对照示例。
:::

## 总结

- EF Core 把实体对象映射到数据库，SQLite 用文件保存数据，服务重启后仍可读取。
- `AddDbContext` 默认注册 Scoped 上下文；同一个上下文不能并发使用。
- 查询在 `ToListAsync()` 等执行方法处访问数据库，只读查询可以使用 `AsNoTracking()`。
- `Add` 标记待插入，`SaveChangesAsync()` 才保存，主键由数据库生成。
- `EnsureCreatedAsync()` 只用于本教程的独立示例，不负责升级已有表结构。

下一章：[关系与查询](./relations-queries)——给 Todo 加上分类，并把筛选交给数据库。上一章：[日志](./logging)。
