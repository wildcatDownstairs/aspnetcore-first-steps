---
title: 完整 CRUD
description: 將已有的查詢、驗證和回應型別組合起來，用 EF Core 變更跟蹤完成 Todo 的建立、讀取、更新和刪除。
---

# 完整 CRUD

前兩章已經能建立和查詢 Todo，這一章補上更新與刪除：先讀取實體，再修改或標記刪除，最後呼叫 `SaveChangesAsync()` 儲存。

**CRUD** 是 Create、Read、Update、Delete 的縮寫，也就是建立、讀取、更新、刪除。驗證、路由群組和錯誤處理沿用前面的做法。為集中講解寫入，本章清單回傳全部 Todo，不保留篩選分頁；分類預置 Work（1）和 Life（2），暫不提供增刪 API。

<<< @/../samples/17-crud/Program.cs{50-85 cs:line-numbers} [17-crud/Program.cs]

<<< @/../samples/17-crud/Models.cs{19-28 cs:line-numbers} [17-crud/Models.cs]

<<< @/../samples/17-crud/TodoDbContext.cs{cs:line-numbers} [17-crud/TodoDbContext.cs]

## 執行與驗證

停止上一章服務，在儲存庫根目錄執行：

```bash
cd samples/17-crud
dotnet run
```

本章使用 `todos-17.db`，首次執行階段 Todo 表為空。下面按順序操作，回應只摘錄關鍵回應標頭；資料庫已有資料時，編號會不同。

建立任務：

```bash
curl -i -X POST http://localhost:5080/todos -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

```http
HTTP/1.1 201 Created
Location: /todos/1
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Write report","done":false,"categoryId":1}
```

把它改為已完成，並移到 Life 分類：

```bash
curl -i -X PUT http://localhost:5080/todos/1 -H "Content-Type: application/json" -d '{"title":"Write report","done":true,"categoryId":2}'
```

```http
HTTP/1.1 204 No Content
```

204 沒有回應本文。重新讀取，才能看到儲存後的內容：

```bash
curl http://localhost:5080/todos/1
```

```json
{"id":1,"title":"Write report","done":true,"categoryId":2}
```

刪除並再次查詢：

```bash
curl -i -X DELETE http://localhost:5080/todos/1
curl -i http://localhost:5080/todos/1
```

前一個回應是 204；後一個是 404，回應本文如下，`traceId` 的值每次不同：

```json
{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"request-trace-id"}
```

## 請求中允許修改哪些欄位

`CreateTodo` 只允許輸入 `Title`、`CategoryId`；`ReplaceTodo` 還允許修改 `Done`。`Id` 始終來自路由或資料庫，不從請求本文覆蓋。

**為什麼不用 Todo 直接接收請求？**如果將來實體增加內部欄位，直接接收整個實體可能讓用戶端也能修改它。單獨定義請求型別，就能明確限制可修改的欄位。

輸入上的 `[Required]`、`[StringLength]`、`[Range]` 沿用第 06 章的機制。輸入 record 保持 `public`，讓 .NET 10 驗證產生器處理它。

PUT 在這裡表示替換用戶端可編輯的完整狀態，請傳送 `title`、`done`、`categoryId` 三個欄位。它不是“只修改 JSON 中出現的欄位”：例如省略 `done`，反序列化後的值是 `false`，就會把目前完成狀態替換成 false。

## 先讀取，再修改，再儲存

PUT 的步驟是：

1. `FindAsync(id)` 找到實體；不存在就回傳 404。
2. 查詢目標分類是否存在；不存在回傳帶說明的 400。
3. 修改跟蹤中的實體屬性。
4. `SaveChangesAsync()` 檢測變化並寫入資料庫。

這裡不需要再呼叫 `Update(todo)`，因為 `FindAsync` 回傳的實體已經由目前上下文跟蹤。清單上的 `AsNoTracking()` 則用於唯讀場景；如果取回不跟蹤的物件後只修改屬性，直接儲存不會自動寫回它。[基本儲存操作](https://learn.microsoft.com/en-us/ef/core/saving/basic)

刪除同理：`Remove(todo)` 標記實體待刪除，`SaveChangesAsync()` 才真正刪除資料庫中的記錄。刪除後再查同一編號，得到 404。

## 編號合法，不代表分類存在

`[Range(1, int.MaxValue)]` 只能檢查編號是正數，不能證明分類 99 確實存在。分類存在性需要查詢資料庫，所以它放在處理常式裡：

```bash
curl -i -X POST http://localhost:5080/todos -H "Content-Type: application/json" -d '{"title":"Invalid","categoryId":99}'
```

回應為 400，正文如下：

```json
{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"Category not found","status":400,"traceId":"request-trace-id"}
```

先查詢是為了回傳明確的“分類不存在”，資料庫的外來鍵約束仍會阻止寫入無效編號。本例不能刪除分類；以後若加上刪除 API，還要處理“檢查時存在，儲存前被刪掉”的情況。

`.ProducesProblem(400)` 將這類 400 回應補充到 OpenAPI 文件中，原因見[第 09 章](./errors)。

## 重複請求與同時修改

重複 PUT 相同內容，最終狀態相同；DELETE 多次後，資源仍是不存在的。這叫**冪等性**（idempotency），不要求每次狀態碼都相同，所以第一次 DELETE 的 204 和後一次的 404 並不矛盾。POST 則可能每次建立新資源。

本章還沒有檢查並行更新：如果兩個人讀到同一條 Todo 後各自修改，後儲存的值可能覆蓋前一次修改。下一章先解決存取權限，限制誰可以呼叫這些 API。

::: fastapi FastAPI 對照
這類似在 FastAPI 處理函式中查出 SQLAlchemy 實體、修改屬性，然後提交 Session。DTO 與資料庫實體分開，也對應 Pydantic 輸入/輸出模型與 ORM 模型各自負責一件事。
:::

::: tip 提示
想對照 INSERT、UPDATE、DELETE，可以查閱 [EF Core / LINQ ↔ PostgreSQL 速查](../efcore-sql-cheatsheet#writes)，附可執行的對照範例。
:::

## 總結

- CRUD 組合建立、讀取、更新、刪除；不同操作使用相應的 HTTP 方法和狀態碼。
- 請求 DTO 限定可修改欄位，實體對應資料庫記錄，回應 DTO 決定回傳欄位。
- 跟蹤查詢後的實體可以直接修改，`SaveChangesAsync()` 檢測並儲存變化。
- `Remove` 只標記刪除，儲存後才生效；欄位驗證不能替代資料庫存在性檢查。
- 本例 PUT 替換完整可編輯狀態，尚未處理並行更新衝突。

下一章：[身分驗證（JWT）](./authentication)——讓 API 先確認呼叫者是誰。上一章：[關聯與查詢](./relations-queries)。
