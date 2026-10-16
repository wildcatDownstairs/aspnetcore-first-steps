---
title: EF Core / LINQ ↔ PostgreSQL 速查
description: 用同一份 Todo 資料對照 LINQ 和 PostgreSQL SQL，弄清篩選、分頁、關聯、查詢執行時機與增刪改。
prev: false
next: false
---

# EF Core / LINQ ↔ PostgreSQL 速查

如果你能看懂 SQL，卻總記不住 LINQ 方法名，可以從這頁反查。範例沿用第 15～17 章的 Todo 和分類；這是一頁參考資料，不需要在繼續主線之前全部讀完。

`Where`、`Select`、`OrderBy` 屬於 **LINQ**（Language Integrated Query，語言整合查詢）。EF Core 的資料庫提供者負責把查詢翻譯成 SQL；SQLite 和 PostgreSQL 的翻譯結果可能不同。

::: info 技術細節
主線仍使用 SQLite。本頁預設執行也用 SQLite，另附 PostgreSQL 等價指令碼，以及 Npgsql 實際產生的查詢。等價指令碼便於閱讀，不代表 EF Core 會逐字產生同樣的 SQL。
:::

## 完整範例與執行

範例是一個控制檯程式，只觀察資料庫操作，不啟動 HTTP 服務。每次執行都建立新的記憶體資料庫，退出後消失，可以反覆執行。

:::: details 展開完整專案檔案

::: code-group

<<< @/../samples/efcore-sql-cheatsheet/Program.cs{13-17,37-64 cs:line-numbers} [Program.cs]

<<< @/../samples/efcore-sql-cheatsheet/Models.cs{19-23 cs:line-numbers} [Models.cs]

<<< @/../samples/efcore-sql-cheatsheet/EfCoreSqlCheatsheet.csproj{9-10 xml:line-numbers} [EfCoreSqlCheatsheet.csproj]

:::

::::

從儲存庫根目錄執行，不需要安裝資料庫服務：

```bash
cd samples/efcore-sql-cheatsheet
dotnet run
```

預期輸出：

<<< @/../samples/efcore-sql-cheatsheet/Output.txt{text} [執行結果]

初始資料與第 16 章一致：Work 分類有 Write report（未完成）、Review PR（已完成），Life 分類有 Buy milk（未完成），編號依次為 1、2、3。

## 常用查詢怎麼寫 {#queries}

下表針對 EF Core 的資料庫查詢。集合在 `ToListAsync()` 之後已經進入記憶體，再呼叫 `Where` 就是在 C# 中篩選，不會追加到之前的 SQL。

| 需求 | LINQ / EF Core | PostgreSQL 等價寫法 |
| --- | --- | --- |
| 未完成的任務 | `Where(t => !t.Done)` | `WHERE NOT "Done"` |
| 屬於某分類且未完成 | `Where(t => t.CategoryId == categoryId && !t.Done)` | `WHERE "CategoryId" = 1 AND NOT "Done"` |
| 只取標題 | `Select(t => t.Title)` | `SELECT "Title"` |
| 按標題升序，同名時按編號排序 | `OrderBy(t => t.Title).ThenBy(t => t.Id)` | `ORDER BY "Title", "Id"` |
| 按編號降序 | `OrderByDescending(t => t.Id)` | `ORDER BY "Id" DESC` |
| 每頁兩條，取第二頁 | `OrderBy(t => t.Id).Skip(2).Take(2)` | `ORDER BY "Id" LIMIT 2 OFFSET 2` |
| 統計未完成條數 | `CountAsync(t => !t.Done)` | `SELECT COUNT(*) FROM "Todos" WHERE NOT "Done"` |
| 是否存在未完成任務 | `AnyAsync(t => !t.Done)` | `SELECT EXISTS (SELECT 1 FROM "Todos" WHERE NOT "Done")` |

範例把篩選、排序、分頁、投影連起來，得到 Work 中未完成任務的編號、標題和分類名。`Skip` 在 C# 中寫在 `Take` 前面，對應 SQL 卻通常寫成 `LIMIT … OFFSET …`；按作用理解即可，不必照抄呼叫順序。

`ThenBy` 用來追加排序條件。連續呼叫兩個 `OrderBy` 會重新指定主要排序，不能用來表達“先按標題，再按編號”。分頁時用唯一的 `Id` 打破同名記錄的並列，避免順序不確定；翻頁期間資料發生變化，仍可能漏項或重複。[PostgreSQL 分頁說明](https://www.postgresql.org/docs/current/queries-limit.html)

::: tip 提示
只想知道有沒有資料，用 `AnyAsync()`，不用先 `ToListAsync()` 拉回全部記錄。需要多少條，再用 `CountAsync()`。
:::

## 取一條：First、Single 和 Find {#single}

下面的“找不到回傳 null”針對本例的實體物件；查詢整數等值型別時，`OrDefault` 回傳的是該型別的預設值。

| 方法 | 沒找到時 | 找到多條時 | 適用情況 |
| --- | --- | --- | --- |
| `FirstOrDefaultAsync()` | `null` | 取第一條 | 按明確順序取一條，不要求唯一 |
| `SingleOrDefaultAsync()` | `null` | 丟擲例外狀況 | 業務上應當最多匹配一條 |
| `SingleAsync()` | 丟擲例外狀況 | 丟擲例外狀況 | 確信必須恰好匹配一條，例如範例的固定分類 |
| `FindAsync(id)` | `null` | 按主鍵查詢，不會匹配多條 | 已知主鍵，允許複用上下文正在跟蹤的物件 |

`FirstOrDefaultAsync()` 常對應 `LIMIT 1`。`SingleOrDefaultAsync()` 需要識別“匹配了不止一條”，提供者通常最多取兩條，再檢查數量；不能把它當成另一種 `LIMIT 1`。

`FindAsync` 會先檢查目前上下文有沒有跟蹤該主鍵的實體，有就直接回傳，否則查詢資料庫。這也意味著它不是“強制從資料庫重新讀取”。[按主鍵查詢](https://learn.microsoft.com/en-us/ef/core/change-tracking/entity-entries#find-and-findasync)

## 關聯：Select 與 Include 的區別 {#relations}

範例有兩種不同的需求：

- **只需要分類名稱**：在 `Select` 中讀取 `t.Category.Name`，讓資料庫回傳需要的列，不必先 `Include` 分類物件。
- **需要分類及其任務物件**：用 `Include(c => c.Todos)` 載入任務集合，之後可以遍歷 `category.Todos`。

在單次查詢中，後者可以用 `LEFT JOIN` 取回分類與任務。但 SQL 回傳的是平面的行，EF Core 還要把多行組裝成一個 Category 和它的 Todos 集合；`Include` 描述的是載入關聯物件，不是一個固定的 SQL 關鍵字。

設定 `AsSplitQuery()` 後，集合載入還可以拆成多條 SQL，因此不能記成“一個 Include 就是一條 JOIN”。這屬於後續最佳化內容，先看懂本例的一次查詢即可。[單查詢與拆分查詢](https://learn.microsoft.com/en-us/ef/core/querying/single-split-queries)

## 哪一步真正執行 SQL {#execution}

| 操作 | 會立即存取資料庫嗎？ |
| --- | --- |
| `Where`、`Select`、`OrderBy`、`Skip`、`Take`、`Include` | 不會，只是在組合查詢 |
| `ToListAsync`、`FirstOrDefaultAsync`、`SingleOrDefaultAsync`、`AnyAsync`、`CountAsync` | 會執行查詢 |
| `FindAsync` | 目前上下文已跟蹤這個主鍵時，不需要查詢資料庫 |
| `AsNoTracking` | 不會；控制查詢結果是否加入變更跟蹤，沒有對應的 SQL 子句 |
| `ToQueryString` | 只產生用於檢視的 SQL，不執行 |
| 修改本例實體屬性、呼叫 `Add` 或 `Remove` | 不立即寫入，等待 `SaveChangesAsync` |

本例把 Todo 1 的 `Done` 改為 `true` 後，用 `Select(t => t.Done)` 再查資料庫，儲存前仍是 `false`，儲存後才是 `true`。這裡選擇單個布林值，是為了讀到資料庫中的值；直接再次查詢已跟蹤實體時，可能複用記憶體中的那個物件。[跟蹤查詢](https://learn.microsoft.com/en-us/ef/core/querying/tracking)

`AsNoTracking()` 適合唯讀查詢，但它不是資料庫權限，也不會禁止之後執行其他寫入。對不跟蹤的物件只修改屬性，然後呼叫 `SaveChangesAsync()`，EF Core 不會自動知道你改了什麼。

## 增刪改與 SaveChanges {#writes}

| C# 中的動作 | 儲存時的等價 SQL 操作 |
| --- | --- |
| `Add(created)`，然後儲存 | `INSERT INTO … RETURNING "Id"`，取得資料庫產生的編號 |
| 修改已跟蹤實體的 `Done`，然後儲存 | `UPDATE "Todos" SET "Done" = TRUE WHERE "Id" = 1` |
| `Remove(created)`，然後儲存 | `DELETE FROM "Todos" WHERE "Id" = 4` |

實際 SQL 還可能帶參數、回傳值或並行檢查條件。表裡只說明本例的操作效果。

`SaveChangesAsync()` 會儲存上下文中所有待儲存的變化，不只儲存剛剛修改的那一個物件。因此範例中 `Add` 之後查詢資料庫仍是 3 條，儲存後才變成 4 條。完整 API 的請求驗證和狀態碼見[第 17 章](./tutorial/crud)。

::: info 技術細節
EF Core 也提供 `ExecuteUpdateAsync()`、`ExecuteDeleteAsync()`，可以直接執行批次更新或刪除，無需先載入實體，也不等待 `SaveChangesAsync()`。它們不會同步更新上下文裡已經跟蹤的物件；本頁先使用第 17 章的跟蹤與儲存方式。[批次更新與刪除](https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete)
:::

## 看 Npgsql 實際產生的 SQL {#generated-sql}

專案也引用了 PostgreSQL 提供者 **Npgsql**。在同一目錄執行：

```bash
dotnet run -- --postgres-sql
```

這次使用 `UseNpgsql` 翻譯開頭的查詢，然後透過 `ToQueryString()` 輸出；程式不會連線 PostgreSQL，也不會建表。使用專案中固定的相依套件版本時，輸出為：

<<< @/../samples/efcore-sql-cheatsheet/PostgreSqlQuery.txt{sql} [Npgsql 查詢預覽]

你可以看到，提供者用了子查詢，並把分類編號和分頁值變成參數，而不是機械地照著上面的表拼接 SQL。

::: warning 注意
`ToQueryString()` 是除錯預覽。開頭的參數註釋不是 PostgreSQL 的變數宣告，不能把帶 `@categoryId` 的整段文字直接粘進 psql 執行；最終執行的指令應透過記錄觀察，見[第 16 章](./tutorial/relations-queries)。[ToQueryString 說明](https://learn.microsoft.com/en-us/dotnet/api/microsoft.entityframeworkcore.entityframeworkqueryableextensions.toquerystring?view=efcore-10.0)
:::

同名 C# 方法不保證在不同資料庫中採用相同翻譯。例如 PostgreSQL 的 `ILIKE` 可以透過 Npgsql 的 `EF.Functions.ILike` 使用，它不是本教學 SQLite 提供者的通用能力。[Npgsql 翻譯表](https://www.npgsql.org/efcore/mapping/translations.html)

## 在 PostgreSQL 中執行等價指令碼 {#postgres-script}

下面是獨立的 SQL 對照檔案：建立同樣的初始資料，依次查詢、更新、新增、刪除。它使用目前會話的臨時表，最後回滾，不改動已有業務表。

::: details 展開完整 PostgreSQL 指令碼
<<< @/../samples/efcore-sql-cheatsheet/PostgreSql.sql{21-27,52-65 sql:line-numbers} [PostgreSql.sql]
:::

如果已經安裝 PostgreSQL，從範例目錄執行。按自己的環境替換主機、賬號和資料庫名，密碼由 psql 提示輸入：

```bash
psql -X -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -f PostgreSql.sql
```

也可以在資料庫工具中用同一連線執行整個檔案。主要結果應當是：

| 操作 | 結果 |
| --- | --- |
| Work 中未完成的任務 | 1 / Write report / Work |
| 第二頁 | 3 / Buy milk |
| 未完成數量、是否存在 | 2、true（psql 顯示為 `t`） |
| 編號 99 | 零行；這是 EF 回傳 `null` 前的資料庫結果 |
| Work 與任務關聯 | 兩行，分別對應 Write report、Review PR |
| 修改後的 Done | true（`t`） |
| 新增任務 | 回傳編號 4，總條數變為 4 |
| 刪除新任務 | 總條數回到 3 |

指令碼中的雙引號保留 `Todos`、`CategoryId` 等大小寫，和本例的預設對應名稱一致。PostgreSQL 中不加引號的識別符號會摺疊為小寫，所以 `"Todos"` 與 `todos` 不應混用。[識別符號規則](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)

## 記住這五點

- LINQ 先組合查詢，取清單、單條或統計結果時才執行。
- 分頁先固定順序；`ThenBy` 追加排序，`OrderBy` 重新指定主要排序。
- 只取關聯欄位用投影；需要關聯物件時再考慮 `Include`。
- 跟蹤、`Add`、`Remove` 和儲存是不同步驟，修改記憶體物件不等於已經寫入資料庫。
- PostgreSQL 等價寫法幫助理解，實際翻譯用 Npgsql 檢視，執行結果用資料庫驗證。

回到教學：[15 EF Core 入門](./tutorial/efcore-basics) · [16 關聯與查詢](./tutorial/relations-queries) · [17 完整 CRUD](./tutorial/crud)。也可以檢視 [FastAPI ↔ ASP.NET Core 對照](./fastapi-cheatsheet)。
