---
title: EF Core 入門
description: 用 EF Core 和 SQLite 替換記憶體清單，理解 DbContext、實體與 SaveChangesAsync，並驗證重新啟動後的資料持久化。
---

# EF Core 入門

前面的 Todo 都儲存在記憶體裡，服務一重新啟動就消失。這一章改用 SQLite 資料庫儲存，透過 **Entity Framework Core（EF Core）** 用 C# 物件讀寫資料，由它產生 SQL。這類工具叫**物件關聯對應**（object-relational mapping，ORM）。

下面的處理常式直接接收資料庫上下文，不再經過 `ITodoStore`；參數驗證和錯誤處理沿用前面的做法。完整程式碼分成三個檔案：

<<< @/../samples/15-efcore-basics/Program.cs{2,10-12,25-30,32-46 cs:line-numbers} [15-efcore-basics/Program.cs]

<<< @/../samples/15-efcore-basics/Models.cs{3-8 cs:line-numbers} [15-efcore-basics/Models.cs]

<<< @/../samples/15-efcore-basics/TodoDbContext.cs{3-6 cs:line-numbers} [15-efcore-basics/TodoDbContext.cs]

## 執行與驗證

在儲存庫根目錄開啟終端：

```bash
cd samples/15-efcore-basics
dotnet run
```

專案檔案宣告了 SQLite 提供者，`dotnet run` 會先還原依賴，不需要單獨安裝 SQLite 服務：

<<< @/../samples/15-efcore-basics/EfCoreBasics.csproj{9 xml:line-numbers} [15-efcore-basics/EfCoreBasics.csproj]

資料庫位置來自設定檔案：

<<< @/../samples/15-efcore-basics/appsettings.json{2-4 json:line-numbers} [15-efcore-basics/appsettings.json]

首次啟動會在專案目錄建立 `todos-15.db`。下面的輸出基於一個新資料庫。另開終端，先查詢，再建立：

```bash
curl http://localhost:5080/todos
```

```json
[]
```

```bash
curl -i -X POST http://localhost:5080/todos -H "Content-Type: application/json" -d '{"title":"Buy milk"}'
```

回應摘錄（省略日期等通用回應標頭）：

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /todos/1

{"id":1,"title":"Buy milk","done":false}
```

回到執行服務的終端，按 `Ctrl+C`，再執行 `dotnet run`。重新查詢：

```bash
curl http://localhost:5080/todos/1
```

```json
{"id":1,"title":"Buy milk","done":false}
```

重新啟動後仍能讀到這條 Todo，說明資料已經寫進 SQLite 檔案。

::: tip 提示
每章使用獨立的資料庫檔案。重複練習時，已有資料和編號會保留；想使用新的空資料庫，可以停止服務後執行 `dotnet run -- --ConnectionStrings:Todos="Data Source=practice-15.db"`，選擇一個尚不存在的檔名，不必刪除舊資料。
:::

## 實體：資料庫中的一行

`Models.cs` 中的 `Todo` 是一個**實體**（entity），對應表中的一行。EF Core 按約定把 `Id` 識別為**主鍵**（primary key）；本例的整數主鍵由資料庫在插入時產生，不再需要 `_nextId`。

為什麼實體用 `class`，請求仍用 `record`？EF Core 要跟蹤具體的實體執行個體，並在更新時觀察屬性變化；普通可變類適合這項工作。`CreateTodo` 則描述用戶端可以提交的欄位，仍適合用簡潔的 record。用戶端不能透過這個請求模型指定 `Id` 或 `Done`。

`Title` 後面的 `= ""` 是屬性初始值，避免新建物件時出現未初始化的非空字串。輸入是否合格仍由 `CreateTodo` 上的 `[Required]`、`[StringLength]` 和 `AddValidation()` 檢查。

## 用 DbContext 讀寫資料

`TodoDbContext` 繼承 **DbContext（資料庫上下文）**。其中的 `DbSet<Todo>` 是查詢和寫入 Todo 的入口；它不是把整張表預先裝進記憶體的 `List<Todo>`。

`AddDbContext` 把上下文註冊到相依性注入容器，預設是 Scoped：在 Web 請求中，同一個作用域使用同一個執行個體，請求結束後由容器釋放。`UseSqlite` 選擇資料庫提供者，連線字串指定檔案位置。

::: warning 注意
`DbContext` 不是執行緒安全的。不要把它註冊成 Singleton，也不要用同一個執行個體同時執行多個查詢；先 `await` 目前操作完成，再進行下一步。[官方生命週期說明](https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/)
:::

啟動時還沒有請求作用域，所以第 26 行手動建立一個作用域，取出上下文初始化資料庫。`using` 會在離開程式碼塊時釋放這個作用域及其中的服務。

## 查詢與儲存是兩種動作

`GET /todos` 中，`OrderBy` 指定回傳順序，`ToListAsync()` 才執行資料庫查詢並取回清單。沒有排序時，不應依賴資料庫“碰巧”回傳的順序。`AsNoTracking()` 表示這些唯讀結果不需要加入**變更跟蹤**（change tracking），減少上下文維護的狀態。

`FindAsync(id)` 按主鍵查詢單個 Todo：目前上下文已經跟蹤它時可以直接回傳，否則查詢資料庫。找不到得到 `null`，處理常式回傳 404。

POST 中的三步需要分清：

1. `new Todo` 建立 C# 物件，此時還沒有寫入資料庫。
2. `db.Todos.Add(todo)` 把它標記為待插入。
3. `await db.SaveChangesAsync()` 執行插入，隨後 `todo.Id` 才包含資料庫產生的編號。

**為什麼不在 Add 時立即寫入？**上下文可以先收集一組修改，再統一儲存。忘記 `SaveChangesAsync()`，記憶體中的物件雖然存在，資料庫裡卻不會多出那一行。

`Task<Created<Todo>>` 表示等待非同步方法完成後，會得到一個 `Created<Todo>` 結果；`async` / `await` 的語法見「C# 速覽」。

::: info 技術細節
本例統一使用 EF Core 的非同步方法。不過，底層的 Microsoft.Data.Sqlite 不支援非同步 I/O，這些呼叫最終仍同步執行；換用其他資料庫提供者時則可能不同。[SQLite 非同步限制](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/async)
:::

## 建表不等於升級表結構

本例的 `EnsureCreatedAsync()` 適合獨立學習專案：資料庫沒有表時建立模型所需的表，已有表時不會替你升級結構。

::: warning 注意
修改實體後，`EnsureCreatedAsync()` 不會自動新增列。要升級已有資料庫，應使用**遷移**（migration）；它和 `EnsureCreated` 不能直接混用。本教學每章使用獨立檔案。需要保留並升級已有資料時，見 [資料庫遷移附錄](../advanced/efcore-migrations)。
:::

::: fastapi FastAPI 對照
EF Core 的角色接近 SQLAlchemy；`DbContext` 可類比一次工作範圍內的 Session，`SaveChangesAsync()` 寫入已跟蹤的變更。它們的 API 和事務細節不完全相同。
:::

::: tip 提示
想從 SQL 的角度理解查詢與儲存，可以查閱 [EF Core / LINQ ↔ PostgreSQL 速查](../efcore-sql-cheatsheet#execution)，附可執行的對照範例。
:::

## 總結

- EF Core 把實體物件對應到資料庫，SQLite 用檔案儲存資料，服務重新啟動後仍可讀取。
- `AddDbContext` 預設註冊 Scoped 上下文；同一個上下文不能並行使用。
- 查詢在 `ToListAsync()` 等執行方法處存取資料庫，唯讀查詢可以使用 `AsNoTracking()`。
- `Add` 標記待插入，`SaveChangesAsync()` 才儲存，主鍵由資料庫產生。
- `EnsureCreatedAsync()` 只用於本教學的獨立範例，不負責升級已有表結構。

下一章：[關聯與查詢](./relations-queries)——給 Todo 加上分類，並把篩選交給資料庫。上一章：[記錄](./logging)。
