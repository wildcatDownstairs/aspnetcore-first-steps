---
title: 关系与查询
description: 为 Todo 建立分类的一对多关系，用 LINQ 组合筛选、排序、分页和投影，并区分导航属性与 Include。
---

# 关系与查询

现在给 Todo 加上分类：一条任务属于 Work 还是 Life？这一章建立分类与任务的关系，再用 LINQ 查询“Work 中未完成的任务”。

本章是只读查询示例，启动时准备少量固定数据；暂时不提供上一章的 POST，下一章再把关系与写入组合起来。下面是三个完整文件：

<<< @/../samples/16-relations-queries/Program.cs{30-35,39-56 cs:line-numbers} [16-relations-queries/Program.cs]

<<< @/../samples/16-relations-queries/Models.cs{8-9,12-20 cs:line-numbers} [16-relations-queries/Models.cs]

<<< @/../samples/16-relations-queries/TodoDbContext.cs{6 cs:line-numbers} [16-relations-queries/TodoDbContext.cs]

## 运行与验证

先停止上一章的服务，然后从仓库根目录执行：

```bash
cd samples/16-relations-queries
dotnet run
```

本章使用自己的 `todos-16.db`，依赖与上一章相同。首次启动插入两个分类：`Work`、`Life`，以及三条 Todo。启动代码只在分类表为空时插入，重启不会重复添加。

另开终端，查询第一页（每页两条）：

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Write report","done":false,"category":"Work"},{"id":2,"title":"Review PR","done":true,"category":"Work"}]
```

只看 Work 中未完成的任务：

```bash
curl "http://localhost:5080/todos?categoryId=1&done=false"
```

```json
[{"id":1,"title":"Write report","done":false,"category":"Work"}]
```

查询第二页：

```bash
curl "http://localhost:5080/todos?page=2"
```

```json
[{"id":3,"title":"Buy milk","done":false,"category":"Life"}]
```

查询整个分类及其任务：

```bash
curl http://localhost:5080/categories/1
```

```json
{"id":1,"name":"Work","todos":[{"id":1,"title":"Write report","done":false},{"id":2,"title":"Review PR","done":true}]}
```

## 外键和导航属性各负责什么

**一对多关系**（one-to-many relationship）表示一个分类可以有多条 Todo，每条 Todo 属于一个分类：

| 成员 | 作用 |
| --- | --- |
| `Todo.CategoryId` | **外键**（foreign key），保存关联分类的主键值 |
| `Todo.Category` | 从 Todo 访问分类对象的**导航属性**（navigation property） |
| `Category.Todos` | 从分类访问关联 Todo 的集合导航属性 |

EF Core 根据这些名称和类型识别关系。`CategoryId` 是不可空的 `int`，表示本例每条 Todo 都必须指向分类；数据库中的外键约束会阻止它引用不存在的分类。分类暂时不提供删除接口，不在这一节展开级联删除规则。

`Category = null!` 中的 `!` 只抑制编译器的可空警告，不会加载分类。查询没有加载它、也没有手动赋值时，这个属性仍可能是 `null`。

::: info 技术细节
初始化数据时，我们把 Todo 放进新分类的 `Todos` 集合，再保存整组对象。EF Core 会处理关联顺序，并把生成的分类主键写入 Todo 的外键；不需要先猜分类的编号。有关约定和必需关系，见 [EF Core 一对多关系](https://learn.microsoft.com/en-us/ef/core/modeling/relationships/one-to-many)。
:::

## 先组合查询，最后执行

`GET /todos` 中的 `query` 是 `IQueryable<Todo>`，表示一份尚未执行的查询。第 42、43 行根据查询参数追加条件，第 45 行追加排序和分页，最后才调用 `ToListAsync()`。

**为什么不先 ToList，再 Where？**先取回列表再筛选，意味着把数据库里的所有行传到应用内存中。本例先组合 LINQ 查询，让 SQLite 筛选、排序后只返回这一页的数据。

`Math.Clamp(page, 1, 10000)` 将页码限制在 1～10000：小于 1 按 1 处理，大于 10000 按 10000 处理。每页固定两条，便于观察 `Skip`（跳过）和 `Take`（取出）的效果。

分页前先按唯一的 `Id` 排序，确保同一份数据的顺序固定。不过，翻页期间如果有人增删数据，仍可能出现重复或漏项。

## Select：只查询需要的字段

第 46 行的 `Select` 叫**投影**（projection）：从实体中选出 `Id`、`Title`、`Done` 和分类名称，作为响应内容。

在这份尚未执行的查询里，`t.Category.Name` 会被 EF Core 翻译为访问关联表的 SQL；不需要先 `Include` 整个分类对象。这里不会先为每条 Todo 单独发一次分类查询。

**为什么不直接返回带双向导航属性的实体？**Todo 指向 Category，Category 又包含 Todo，直接序列化容易产生循环引用，也会把数据库模型与 HTTP 响应绑在一起。投影让响应字段明确，数据库多加一个属性也不会自动泄露到接口中。

## Include：需要关联对象时再加载

`GET /categories/{id}` 演示另一种需求：先拿到分类及其 Todo 对象，再整理输出。`Include(c => c.Todos)` 在查询时加载这个关联集合，称为**预先加载**（eager loading）；本例没有启用延迟加载。

`SingleOrDefaultAsync` 执行查询，找不到返回 `null`。这里按唯一主键查询，最多只有一个分类。返回前再构造 `CategoryResponse`，其中的 `TodoSummary` 不含指回分类的导航属性。

这类专门用于接收或返回数据的类型叫 **DTO**（Data Transfer Object，数据传输对象）。前面的请求 record 也是 DTO。数据库实体增加属性时，不必跟着改变接口的 JSON 字段。

::: tip 提示
想观察实际 SQL，可停止服务后运行 `dotnet run -- --Logging:LogLevel:Microsoft.EntityFrameworkCore.Database.Command=Information`，再发送查询。分页参数等会随请求变化，重点看筛选是否在 SQL 中、是否存在多余查询。[关联数据加载说明](https://learn.microsoft.com/en-us/ef/core/querying/related-data/eager)
:::

::: fastapi
这类似用 SQLAlchemy 的关系属性建立对象关联，再通过查询表达式筛选和选择列。`Include` 接近预先加载关系的思路，不代表访问任何导航属性都会自动执行 SQL。
:::

::: tip 提示
记不清 LINQ 方法时，可以查阅 [EF Core / LINQ ↔ PostgreSQL 速查](../efcore-sql-cheatsheet#queries)，附可运行的对照示例。
:::

## 总结

- 外键保存关联编号，导航属性表达对象之间的关系；声明导航属性不等于已经加载对象。
- 在 `IQueryable` 上组合条件、排序和分页，最后调用 `ToListAsync()` 等方法执行查询。
- `Select` 投影选择返回字段，避免直接序列化双向关系。
- 查询中只需要分类名称时可以直接投影；需要关联对象时再用 `Include`。
- 每页结果先按唯一键排序；本例的页码会被限制在 1～10000。

下一章：[完整 CRUD](./crud)——补齐 Todo 的创建、更新和删除。上一章：[EF Core 入门](./efcore-basics)。
