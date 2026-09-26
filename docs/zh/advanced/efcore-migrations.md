---
title: 数据库迁移
description: 通过 EF Core 迁移给已有的 Todo 表增加字段，并验证升级保留旧数据。
---

# 数据库迁移

第 15 章用 `EnsureCreated()` 快速创建练习数据库。等应用已有数据，再给实体增加属性时，它不会替你修改现有表。这时需要**迁移**（migration）：把一次表结构变化记录为可以审查、提交和执行的代码。

第 23 章已经包含完整示例。这里是给 `Todos` 表增加 `Note` 列的迁移文件，由 EF Core 工具生成：

<<< @/../samples/23-deployment/Data/Migrations/20260926115641_AddTodoNote.cs{cs:line-numbers} [AddTodoNote.cs]

对应的实体完整文件：

<<< @/../samples/23-deployment/Features/Todos/Todo.cs{cs:line-numbers} [Features/Todos/Todo.cs]

`Up` 描述升级，`Down` 描述撤销。本次增加可空列，因此已有任务的 `Note` 是 `null`。撤销这个迁移会删掉整列，已经写入的备注也会丢失；回退结构不等于恢复数据。

## 运行仓库中的迁移

从仓库根目录执行：

```bash
cd samples/23-deployment
dotnet tool restore
dotnet ef migrations list
dotnet ef database update
```

本章用本地工具清单固定 `dotnet-ef` 的版本。第一次更新新的 `todos-23.db` 时会执行 `InitialCreate` 和 `AddTodoNote` 两个迁移，创建类别和任务表，并加入两个固定类别。再次执行不会重复建表。

工具输出带时间戳的迁移名称；完整名称以 `Data/Migrations` 中的文件为准。数据库中的 `__EFMigrationsHistory` 表记录哪些迁移已经成功应用。

::: warning 不要重复生成仓库里已有的迁移
`InitialCreate` 和 `AddTodoNote` 已经提交在示例中，直接执行即可。只有你再次修改实体结构时，才需要使用 `dotnet ef migrations add` 生成新的迁移，然后审查生成的文件。
:::

工具通过设计时工厂创建上下文，不需要先启动 API 或配置生产身份服务：

<<< @/../samples/23-deployment/Data/TodoDbContextFactory.cs{cs:line-numbers} [Data/TodoDbContextFactory.cs]

这里的**设计时**（design time）指运行 EF 命令生成或应用迁移的阶段。正常处理 HTTP 请求时，应用仍从依赖注入容器取得上下文。

## 怎么确认旧数据还在

不能只看到迁移命令成功，就认为升级没有影响数据。下面的完整测试先创建旧表、插入任务，再执行新增列的迁移：

<<< @/../samples/23-deployment/Tests/MigrationTests.cs{18-26 cs:line-numbers} [Tests/MigrationTests.cs]

从本章示例目录执行：

```bash
dotnet test --project Tests/TodoApi.Tests.csproj -c Release -p:TreatWarningsAsErrors=true
```

总计 13 个测试应全部通过。迁移测试确认旧任务和类别仍然存在、新列初始为 `null`；随后写入备注，再次执行迁移，确认不会重复创建记录或清掉备注。

## 后续修改数据库的顺序

1. 修改实体或模型配置，让它表达新的结构。
2. 用 `dotnet ef migrations add` 加上描述本次变化的名称，生成迁移。
3. 审查 `Up`、`Down` 和模型快照，再在测试数据库上验证。工具看到“旧列消失、新列出现”时，生成的操作不一定就是你想要的重命名。
4. 把迁移文件与应用代码一起提交；正式执行前备份数据，安排升级时机。

模型快照保存上次迁移后的模型，工具通过比较它与当前模型生成下一次变更。不要手动删除快照来“修复”不一致。

第 23 章用独立的 `--migrate` 命令执行升级，成功后才启动服务。真实系统还可以审查 SQL 脚本或使用迁移 bundle；部署方式和数据库提供程序会影响可选方案，参见[官方迁移应用说明](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying)。

## 已有 EnsureCreated 数据库怎么办

`EnsureCreated()` 不建立迁移历史。直接对这样的数据库执行 `InitialCreate`，通常会因为表已存在而失败。

本教程让第 23 章使用独立的新文件，不会覆盖前面章节的数据。如果旧库有需要保留的内容，先备份，再制定数据导入或建立迁移基线的方案，并在副本上演练；不要靠删除旧库、伪造迁移记录来跳过这一步。两者的适用范围见[官方建表说明](https://learn.microsoft.com/en-us/ef/core/managing-schemas/ensure-created)。

## 总结

- 迁移记录表结构如何变化；`EnsureCreated` 只适合不需要迁移的建库场景。
- 修改模型后生成迁移，审查后再执行，迁移和快照要一起提交。
- 用已有记录验证升级，不能只测试空数据库。
- 新增可空列可以保留旧行，但删除列等操作仍会丢数据。
- 正式升级前备份，并把升级安排在应用开始使用新结构之前。

返回：[发布与部署](../tutorial/deployment)。继续阅读：[进阶主题](./)。
