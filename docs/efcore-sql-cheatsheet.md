---
title: EF Core / LINQ ↔ PostgreSQL 速查
description: 用同一份 Todo 数据对照 LINQ 和 PostgreSQL SQL，弄清筛选、分页、关联、查询执行时机与增删改。
prev: false
next: false
---

# EF Core / LINQ ↔ PostgreSQL 速查

如果你能看懂 SQL，却总记不住 LINQ 方法名，可以从这页反查。示例沿用第 15～17 章的 Todo 和分类；这是一页参考资料，不需要在继续主线之前全部读完。

`Where`、`Select`、`OrderBy` 属于 **LINQ**（Language Integrated Query，语言集成查询）。EF Core 的数据库提供程序负责把查询翻译成 SQL；SQLite 和 PostgreSQL 的翻译结果可能不同。

::: info 技术细节
主线仍使用 SQLite。本页默认运行也用 SQLite，另附 PostgreSQL 等价脚本，以及 Npgsql 实际生成的查询。等价脚本便于阅读，不代表 EF Core 会逐字生成同样的 SQL。
:::

## 完整示例与运行

示例是一个控制台程序，只观察数据库操作，不启动 HTTP 服务。每次运行都创建新的内存数据库，退出后消失，可以反复执行。

:::: details 展开完整项目文件

::: code-group

<<< @/../samples/efcore-sql-cheatsheet/Program.cs{13-17,37-64 cs:line-numbers} [Program.cs]

<<< @/../samples/efcore-sql-cheatsheet/Models.cs{19-23 cs:line-numbers} [Models.cs]

<<< @/../samples/efcore-sql-cheatsheet/EfCoreSqlCheatsheet.csproj{9-10 xml:line-numbers} [EfCoreSqlCheatsheet.csproj]

:::

::::

从仓库根目录执行，不需要安装数据库服务：

```bash
cd samples/efcore-sql-cheatsheet
dotnet run
```

预期输出：

<<< @/../samples/efcore-sql-cheatsheet/Output.txt{text} [运行结果]

初始数据与第 16 章一致：Work 分类有 Write report（未完成）、Review PR（已完成），Life 分类有 Buy milk（未完成），编号依次为 1、2、3。

## 常用查询怎么写 {#queries}

下表针对 EF Core 的数据库查询。集合在 `ToListAsync()` 之后已经进入内存，再调用 `Where` 就是在 C# 中筛选，不会追加到之前的 SQL。

| 需求 | LINQ / EF Core | PostgreSQL 等价写法 |
| --- | --- | --- |
| 未完成的任务 | `Where(t => !t.Done)` | `WHERE NOT "Done"` |
| 属于某分类且未完成 | `Where(t => t.CategoryId == categoryId && !t.Done)` | `WHERE "CategoryId" = 1 AND NOT "Done"` |
| 只取标题 | `Select(t => t.Title)` | `SELECT "Title"` |
| 按标题升序，同名时按编号排序 | `OrderBy(t => t.Title).ThenBy(t => t.Id)` | `ORDER BY "Title", "Id"` |
| 按编号降序 | `OrderByDescending(t => t.Id)` | `ORDER BY "Id" DESC` |
| 每页两条，取第二页 | `OrderBy(t => t.Id).Skip(2).Take(2)` | `ORDER BY "Id" LIMIT 2 OFFSET 2` |
| 统计未完成条数 | `CountAsync(t => !t.Done)` | `SELECT COUNT(*) FROM "Todos" WHERE NOT "Done"` |
| 是否存在未完成任务 | `AnyAsync(t => !t.Done)` | `SELECT EXISTS (SELECT 1 FROM "Todos" WHERE NOT "Done")` |

示例把筛选、排序、分页、投影连起来，得到 Work 中未完成任务的编号、标题和分类名。`Skip` 在 C# 中写在 `Take` 前面，对应 SQL 却通常写成 `LIMIT … OFFSET …`；按作用理解即可，不必照抄调用顺序。

`ThenBy` 用来追加排序条件。连续调用两个 `OrderBy` 会重新指定主要排序，不能用来表达“先按标题，再按编号”。分页时用唯一的 `Id` 打破同名记录的并列，避免顺序不确定；翻页期间数据发生变化，仍可能漏项或重复。[PostgreSQL 分页说明](https://www.postgresql.org/docs/current/queries-limit.html)

::: tip 提示
只想知道有没有数据，用 `AnyAsync()`，不用先 `ToListAsync()` 拉回全部记录。需要多少条，再用 `CountAsync()`。
:::

## 取一条：First、Single 和 Find {#single}

下面的“找不到返回 null”针对本例的实体对象；查询整数等值类型时，`OrDefault` 返回的是该类型的默认值。

| 方法 | 没找到时 | 找到多条时 | 适用情况 |
| --- | --- | --- | --- |
| `FirstOrDefaultAsync()` | `null` | 取第一条 | 按明确顺序取一条，不要求唯一 |
| `SingleOrDefaultAsync()` | `null` | 抛出异常 | 业务上应当最多匹配一条 |
| `SingleAsync()` | 抛出异常 | 抛出异常 | 确信必须恰好匹配一条，例如示例的固定分类 |
| `FindAsync(id)` | `null` | 按主键查找，不会匹配多条 | 已知主键，允许复用上下文正在跟踪的对象 |

`FirstOrDefaultAsync()` 常对应 `LIMIT 1`。`SingleOrDefaultAsync()` 需要识别“匹配了不止一条”，提供程序通常最多取两条，再检查数量；不能把它当成另一种 `LIMIT 1`。

`FindAsync` 会先检查当前上下文有没有跟踪该主键的实体，有就直接返回，否则查询数据库。这也意味着它不是“强制从数据库重新读取”。[按主键查找](https://learn.microsoft.com/en-us/ef/core/change-tracking/entity-entries#find-and-findasync)

## 关联：Select 与 Include 的区别 {#relations}

示例有两种不同的需求：

- **只需要分类名称**：在 `Select` 中读取 `t.Category.Name`，让数据库返回需要的列，不必先 `Include` 分类对象。
- **需要分类及其任务对象**：用 `Include(c => c.Todos)` 加载任务集合，之后可以遍历 `category.Todos`。

在单次查询中，后者可以用 `LEFT JOIN` 取回分类与任务。但 SQL 返回的是平面的行，EF Core 还要把多行组装成一个 Category 和它的 Todos 集合；`Include` 描述的是加载关联对象，不是一个固定的 SQL 关键字。

配置 `AsSplitQuery()` 后，集合加载还可以拆成多条 SQL，因此不能记成“一个 Include 就是一条 JOIN”。这属于后续优化内容，先看懂本例的一次查询即可。[单查询与拆分查询](https://learn.microsoft.com/en-us/ef/core/querying/single-split-queries)

## 哪一步真正执行 SQL {#execution}

| 操作 | 会立即访问数据库吗？ |
| --- | --- |
| `Where`、`Select`、`OrderBy`、`Skip`、`Take`、`Include` | 不会，只是在组合查询 |
| `ToListAsync`、`FirstOrDefaultAsync`、`SingleOrDefaultAsync`、`AnyAsync`、`CountAsync` | 会执行查询 |
| `FindAsync` | 当前上下文已跟踪这个主键时，不需要查询数据库 |
| `AsNoTracking` | 不会；控制查询结果是否加入变更跟踪，没有对应的 SQL 子句 |
| `ToQueryString` | 只生成用于查看的 SQL，不执行 |
| 修改本例实体属性、调用 `Add` 或 `Remove` | 不立即写入，等待 `SaveChangesAsync` |

本例把 Todo 1 的 `Done` 改为 `true` 后，用 `Select(t => t.Done)` 再查数据库，保存前仍是 `false`，保存后才是 `true`。这里选择单个布尔值，是为了读到数据库中的值；直接再次查询已跟踪实体时，可能复用内存中的那个对象。[跟踪查询](https://learn.microsoft.com/en-us/ef/core/querying/tracking)

`AsNoTracking()` 适合只读查询，但它不是数据库权限，也不会禁止之后执行其他写入。对不跟踪的对象只修改属性，然后调用 `SaveChangesAsync()`，EF Core 不会自动知道你改了什么。

## 增删改与 SaveChanges {#writes}

| C# 中的动作 | 保存时的等价 SQL 操作 |
| --- | --- |
| `Add(created)`，然后保存 | `INSERT INTO … RETURNING "Id"`，取得数据库生成的编号 |
| 修改已跟踪实体的 `Done`，然后保存 | `UPDATE "Todos" SET "Done" = TRUE WHERE "Id" = 1` |
| `Remove(created)`，然后保存 | `DELETE FROM "Todos" WHERE "Id" = 4` |

实际 SQL 还可能带参数、返回值或并发检查条件。表里只说明本例的操作效果。

`SaveChangesAsync()` 会保存上下文中所有待保存的变化，不只保存刚刚修改的那一个对象。因此示例中 `Add` 之后查询数据库仍是 3 条，保存后才变成 4 条。完整 API 的请求校验和状态码见[第 17 章](./tutorial/crud)。

::: info 技术细节
EF Core 也提供 `ExecuteUpdateAsync()`、`ExecuteDeleteAsync()`，可以直接执行批量更新或删除，无需先加载实体，也不等待 `SaveChangesAsync()`。它们不会同步更新上下文里已经跟踪的对象；本页先使用第 17 章的跟踪与保存方式。[批量更新与删除](https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete)
:::

## 看 Npgsql 实际生成的 SQL {#generated-sql}

项目也引用了 PostgreSQL 提供程序 **Npgsql**。在同一目录运行：

```bash
dotnet run -- --postgres-sql
```

这次使用 `UseNpgsql` 翻译开头的查询，然后通过 `ToQueryString()` 输出；程序不会连接 PostgreSQL，也不会建表。使用项目中固定的依赖版本时，输出为：

<<< @/../samples/efcore-sql-cheatsheet/PostgreSqlQuery.txt{sql} [Npgsql 查询预览]

你可以看到，提供程序用了子查询，并把分类编号和分页值变成参数，而不是机械地照着上面的表拼接 SQL。

::: warning 注意
`ToQueryString()` 是调试预览。开头的参数注释不是 PostgreSQL 的变量声明，不能把带 `@categoryId` 的整段文本直接粘进 psql 执行；最终执行的命令应通过日志观察，见[第 16 章](./tutorial/relations-queries)。[ToQueryString 说明](https://learn.microsoft.com/en-us/dotnet/api/microsoft.entityframeworkcore.entityframeworkqueryableextensions.toquerystring?view=efcore-10.0)
:::

同名 C# 方法不保证在不同数据库中采用相同翻译。例如 PostgreSQL 的 `ILIKE` 可以通过 Npgsql 的 `EF.Functions.ILike` 使用，它不是本教程 SQLite 提供程序的通用能力。[Npgsql 翻译表](https://www.npgsql.org/efcore/mapping/translations.html)

## 在 PostgreSQL 中运行等价脚本 {#postgres-script}

下面是独立的 SQL 对照文件：建立同样的初始数据，依次查询、更新、新增、删除。它使用当前会话的临时表，最后回滚，不改动已有业务表。

::: details 展开完整 PostgreSQL 脚本
<<< @/../samples/efcore-sql-cheatsheet/PostgreSql.sql{21-27,52-65 sql:line-numbers} [PostgreSql.sql]
:::

如果已经安装 PostgreSQL，从示例目录运行。按自己的环境替换主机、账号和数据库名，密码由 psql 提示输入：

```bash
psql -X -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -f PostgreSql.sql
```

也可以在数据库工具中用同一连接执行整个文件。主要结果应当是：

| 操作 | 结果 |
| --- | --- |
| Work 中未完成的任务 | 1 / Write report / Work |
| 第二页 | 3 / Buy milk |
| 未完成数量、是否存在 | 2、true（psql 显示为 `t`） |
| 编号 99 | 零行；这是 EF 返回 `null` 前的数据库结果 |
| Work 与任务关联 | 两行，分别对应 Write report、Review PR |
| 修改后的 Done | true（`t`） |
| 新增任务 | 返回编号 4，总条数变为 4 |
| 删除新任务 | 总条数回到 3 |

脚本中的双引号保留 `Todos`、`CategoryId` 等大小写，和本例的默认映射名称一致。PostgreSQL 中不加引号的标识符会折叠为小写，所以 `"Todos"` 与 `todos` 不应混用。[标识符规则](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)

## 记住这五点

- LINQ 先组合查询，取列表、单条或统计结果时才执行。
- 分页先固定顺序；`ThenBy` 追加排序，`OrderBy` 重新指定主要排序。
- 只取关联字段用投影；需要关联对象时再考虑 `Include`。
- 跟踪、`Add`、`Remove` 和保存是不同步骤，修改内存对象不等于已经写入数据库。
- PostgreSQL 等价写法帮助理解，实际翻译用 Npgsql 查看，运行结果用数据库验证。

回到教程：[15 EF Core 入门](./tutorial/efcore-basics) · [16 关系与查询](./tutorial/relations-queries) · [17 完整 CRUD](./tutorial/crud)。也可以查看 [FastAPI ↔ ASP.NET Core 对照](./fastapi-cheatsheet)。
