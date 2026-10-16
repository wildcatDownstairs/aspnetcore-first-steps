---
title: 關聯與查詢
description: 為 Todo 建立分類的一對多關聯，用 LINQ 組合篩選、排序、分頁和投影，並區分導航屬性與 Include。
---

# 關聯與查詢

現在給 Todo 加上分類：一條任務屬於 Work 還是 Life？這一章建立分類與任務的關聯，再用 LINQ 查詢“Work 中未完成的任務”。

本章是唯讀查詢範例，啟動時準備少量固定資料；暫時不提供上一章的 POST，下一章再把關聯與寫入組合起來。下面是三個完整檔案：

<<< @/../samples/16-relations-queries/Program.cs{30-35,39-56 cs:line-numbers} [16-relations-queries/Program.cs]

<<< @/../samples/16-relations-queries/Models.cs{8-9,12-20 cs:line-numbers} [16-relations-queries/Models.cs]

<<< @/../samples/16-relations-queries/TodoDbContext.cs{6 cs:line-numbers} [16-relations-queries/TodoDbContext.cs]

## 執行與驗證

先停止上一章的服務，然後從儲存庫根目錄執行：

```bash
cd samples/16-relations-queries
dotnet run
```

本章使用自己的 `todos-16.db`，相依套件與上一章相同。首次啟動插入兩個分類：`Work`、`Life`，以及三條 Todo。啟動程式碼只在分類表為空時插入，重新啟動不會重複新增。

另開終端，查詢第一頁（每頁兩條）：

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Write report","done":false,"category":"Work"},{"id":2,"title":"Review PR","done":true,"category":"Work"}]
```

只看 Work 中未完成的任務：

```bash
curl "http://localhost:5080/todos?categoryId=1&done=false"
```

```json
[{"id":1,"title":"Write report","done":false,"category":"Work"}]
```

查詢第二頁：

```bash
curl "http://localhost:5080/todos?page=2"
```

```json
[{"id":3,"title":"Buy milk","done":false,"category":"Life"}]
```

查詢整個分類及其任務：

```bash
curl http://localhost:5080/categories/1
```

```json
{"id":1,"name":"Work","todos":[{"id":1,"title":"Write report","done":false},{"id":2,"title":"Review PR","done":true}]}
```

## 外來鍵和導航屬性各負責什麼

**一對多關聯**（one-to-many relationship）表示一個分類可以有多條 Todo，每條 Todo 屬於一個分類：

| 成員 | 作用 |
| --- | --- |
| `Todo.CategoryId` | **外來鍵**（foreign key），儲存關聯分類的主索引鍵和值 |
| `Todo.Category` | 從 Todo 存取分類物件的**導航屬性**（navigation property） |
| `Category.Todos` | 從分類存取關聯 Todo 的集合導航屬性 |

EF Core 根據這些名稱和型別識別關聯。`CategoryId` 是不可空的 `int`，表示本例每條 Todo 都必須指向分類；資料庫中的外來鍵約束會阻止它引用不存在的分類。分類暫時不提供刪除 API，不在這一節展開級聯刪除規則。

`Category = null!` 中的 `!` 只抑制編譯器的可空警告，不會載入分類。查詢沒有載入它、也沒有手動賦值時，這個屬性仍可能是 `null`。

::: info 技術細節
初始化資料時，我們把 Todo 放進新分類的 `Todos` 集合，再儲存整組物件。EF Core 會處理關聯順序，並把產生的分類主鍵寫入 Todo 的外來鍵；不需要先猜分類的編號。有關約定和必需關聯，見 [EF Core 一對多關聯](https://learn.microsoft.com/en-us/ef/core/modeling/relationships/one-to-many)。
:::

## 先組合查詢，最後執行

`GET /todos` 中的 `query` 是 `IQueryable<Todo>`，表示一份尚未執行的查詢。第 42、43 行根據查詢參數追加條件，第 45 行追加排序和分頁，最後才呼叫 `ToListAsync()`。

**為什麼不先 ToList，再 Where？**先取回清單再篩選，意味著把資料庫裡的所有行傳到應用程式記憶體中。本例先組合 LINQ 查詢，讓 SQLite 篩選、排序後只回傳這一頁的資料。

`Math.Clamp(page, 1, 10000)` 將頁碼限制在 1～10000：小於 1 按 1 處理，大於 10000 按 10000 處理。每頁固定兩條，便於觀察 `Skip`（跳過）和 `Take`（取出）的效果。

分頁前先按唯一的 `Id` 排序，確保同一份資料的順序固定。不過，翻頁期間如果有人增刪資料，仍可能出現重複或漏項。

## Select：只查詢需要的欄位

第 46 行的 `Select` 叫**投影**（projection）：從實體中選出 `Id`、`Title`、`Done` 和分類名稱，作為回應內容。

在這份尚未執行的查詢裡，`t.Category.Name` 會被 EF Core 翻譯為存取關聯表的 SQL；不需要先 `Include` 整個分類物件。這裡不會先為每條 Todo 單獨發一次分類查詢。

**為什麼不直接回傳帶雙向導航屬性的實體？**Todo 指向 Category，Category 又包含 Todo，直接序列化容易產生迴圈引用，也會把資料庫模型與 HTTP 回應綁在一起。投影讓回應欄位明確，資料庫多加一個屬性也不會自動洩露到 API 中。

## Include：需要關聯物件時再載入

`GET /categories/{id}` 演示另一種需求：先拿到分類及其 Todo 物件，再整理輸出。`Include(c => c.Todos)` 在查詢時載入這個關聯集合，稱為**預先載入**（eager loading）；本例沒有啟用延遲載入。

`SingleOrDefaultAsync` 執行查詢，找不到回傳 `null`。這裡按唯一主鍵查詢，最多隻有一個分類。回傳前再建構 `CategoryResponse`，其中的 `TodoSummary` 不含指回分類的導航屬性。

這類專門用於接收或回傳資料的型別叫 **DTO**（Data Transfer Object，資料傳輸物件）。前面的請求 record 也是 DTO。資料庫實體增加屬性時，不必跟著改變 API 的 JSON 欄位。

::: tip 提示
想觀察實際 SQL，可停止服務後執行 `dotnet run -- --Logging:LogLevel:Microsoft.EntityFrameworkCore.Database.Command=Information`，再傳送查詢。分頁參數等會隨請求變化，重點看篩選是否在 SQL 中、是否存在多餘查詢。[關聯資料載入說明](https://learn.microsoft.com/en-us/ef/core/querying/related-data/eager)
:::

::: fastapi FastAPI 對照
這類似用 SQLAlchemy 的關聯屬性建立物件關聯，再透過查詢表示式篩選和選擇列。`Include` 接近預先載入關聯的思路，不代表存取任何導航屬性都會自動執行 SQL。
:::

::: tip 提示
記不清 LINQ 方法時，可以查閱 [EF Core / LINQ ↔ PostgreSQL 速查](../efcore-sql-cheatsheet#queries)，附可執行的對照範例。
:::

## 總結

- 外來鍵儲存關聯編號，導航屬性表達物件之間的關聯；宣告導航屬性不等於已經載入物件。
- 在 `IQueryable` 上組合條件、排序和分頁，最後呼叫 `ToListAsync()` 等方法執行查詢。
- `Select` 投影選擇回傳欄位，避免直接序列化雙向關聯。
- 查詢中只需要分類名稱時可以直接投影；需要關聯物件時再用 `Include`。
- 每頁結果先按唯一鍵排序；本例的頁碼會被限制在 1～10000。

下一章：[完整 CRUD](./crud)——補齊 Todo 的建立、更新和刪除。上一章：[EF Core 入門](./efcore-basics)。
