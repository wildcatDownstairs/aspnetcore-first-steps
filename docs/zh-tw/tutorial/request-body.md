---
title: 請求本文
description: 用 record 宣告請求本文的結構，讓框架把 JSON 自動反序列化成強型別物件；理解輸入模型與資料模型為什麼要分開。
---

# 請求本文

路由參數和查詢參數適合傳遞少量的簡單值。要**建立**一個待辦事項，用戶端需要傳送一整塊結構化資料，這時就要用到**請求本文**（request body）：放在 HTTP 請求本文中的內容，Web API 中通常是 JSON。

本節的新概念：**用一個 record 宣告請求本文的結構，框架會把 JSON 自動轉換成這個型別的物件。**

<<< @/../samples/05-request-body/Program.cs{20-25,29 cs:line-numbers} [05-request-body/Program.cs]

從本章開始，範例會圍繞一個待辦事項（Todo）API 逐步擴充套件，到「完整 CRUD」一章時，它會成為一個連線資料庫的完整應用程式。

## 執行與驗證

```bash
dotnet run
```

用 `POST` 方法傳送一個 JSON 請求本文：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","priority":2}'
```

- `-X POST`：使用 POST 方法；
- `-H "Content-Type: application/json"`：告訴伺服器請求本文是 JSON；
- `-d '...'`：請求本文的內容。

預期回應：

```json
{"id":1,"title":"Buy milk","priority":2,"done":false}
```

再檢視清單，剛才建立的項已經在裡面了：

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Buy milk","priority":2,"done":false}]
```

::: tip 提示
Windows PowerShell 對引號和反斜槓換行的處理與 bash 不同，上面的多行指令可能無法直接執行。最省事的做法是開啟 `/scalar` 頁面，找到 `POST /todos`，在請求本文編輯框中填入 JSON 後點選傳送。Scalar 會根據 OpenAPI 文件自動產生一個請求本文模板。
:::

## 宣告請求本文的結構

<<< @/../samples/05-request-body/Program.cs{20,29 cs:line-numbers} [05-request-body/Program.cs]

第 29 行用一個 record 描述了"建立待辦事項時需要提供什麼"：一個字串 `Title` 和一個整數 `Priority`。第 20 行處理常式的參數型別就是 `CreateTodo`。

本例是 POST 端點，`CreateTodo` 是一個沒有註冊為服務、沒有自定義繫結的**複雜型別**（不是 `int`、`string` 這類簡單值），因此框架推斷它來自請求本文——這正是上一章參數來源表格中的第三條規則。然後它會讀取請求本文，用 **System.Text.Json**（.NET 內建的 JSON 庫）反序列化成 `CreateTodo` 物件。

進入處理常式時，`input` 已經是一個完整的、強型別的物件：`input.Title` 是 `string`，`input.Priority` 是 `int`。編輯器能補全這些屬性，拼錯屬性名會直接編譯失敗。

::: tip 提示
JSON 屬性名匹配**不區分大小寫**。傳送 `{"TITLE":"Case test","Priority":1}` 同樣能正確繫結。回應中的屬性名則統一是 camelCase，這是「第一步」中提到的 Web 預設設定。
:::

::: fastapi FastAPI 對照
這和 FastAPI 中用 Pydantic 模型作為參數型別一樣：`def create(todo: CreateTodo)`。不同之處是 record 只描述資料的形狀，預設不做驗證，下面馬上會看到它的後果。
:::

## 為什麼要單獨定義 CreateTodo

<<< @/../samples/05-request-body/Program.cs{22,29,31 cs:line-numbers} [05-request-body/Program.cs]

檔案裡有兩個 record：第 29 行的 `CreateTodo` 是**輸入模型**，描述用戶端能提交什麼；第 31 行的 `Todo` 是**資料模型**，描述系統裡儲存的是什麼。為什麼不直接用 `Todo` 作為參數型別？

因為 `Todo` 裡有 `Id` 和 `Done`，這兩個值不應該由用戶端決定：`Id` 由伺服器分配，新建的待辦事項一定是未完成的。如果直接接收 `Todo`，用戶端就可以自己指定 `id` 和 `done`。

用 `CreateTodo` 接收輸入後，用戶端**根本無法**設定這兩個欄位。試著多傳幾個屬性：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Extra","priority":1,"id":999,"done":true}'
```

```json
{"id":2,"title":"Extra","priority":1,"done":false}
```

`id` 和 `done` 被忽略了，因為 `CreateTodo` 裡沒有對應的屬性。第 22 行由伺服器決定這兩個值。這種把輸入和儲存分開的做法，能避免一類叫做**過度提交**（over-posting）的安全問題。

::: warning 注意
本章範例把資料存在一個記憶體中的 `List` 裡，程式重新啟動後資料就會消失；而且 `List` 和 `nextId++` 都**不是執行緒安全的**，多個請求同時寫入時可能出錯。這只是為了讓範例保持簡單，「EF Core 入門」一章會換成真正的資料庫。
:::

## 請求本文有問題時

### 格式錯誤

JSON 語法錯誤，或者值的型別對不上，框架會直接回傳 400，處理常式不會執行：

```bash
curl -i -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"x","priority":"high"}'
```

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Failed to read parameter "CreateTodo input" from the request body as JSON.
 ---> System.Text.Json.JsonException: The JSON value could not be converted to CreateTodo. Path: $.priority | LineNumber: 0 | BytePositionInLine: 30.
```

錯誤資訊指出了出問題的位置：`$.priority`，因為 `"high"` 不能轉換成 `int`。

### 忘了 Content-Type

本教學用 `Content-Type: application/json` 宣告 JSON 請求本文；框架也接受 `application/*+json` 這類帶 `+json` 字尾的媒體型別。如果攜帶請求本文，卻沒有提供受支援的 JSON 媒體型別，就會回傳 `415 Unsupported Media Type`（不支援的媒體型別）：

```http
HTTP/1.1 415 Unsupported Media Type
Content-Length: 0
```

框架只會把宣告為 JSON 的請求本文當作 JSON 解析。這是一個常見的坑：請求本文明明是正確的 JSON，卻因為少了請求標頭而失敗。

### 缺少欄位

最值得注意的是這種情況：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"priority":3}'
```

```json
{"id":3,"title":null,"priority":3,"done":false}
```

請求成功了，`title` 卻是 `null`——儘管 `CreateTodo` 中 `Title` 的型別是不可為 null 的 `string`。傳送空物件 `{}` 更離譜，會得到 `title` 為 `null`、`priority` 為 `0` 的待辦事項。

原因是：「C# 速覽」中提到，可空引用型別是**編譯期**檢查。JSON 反序列化發生在執行階段，缺少的字串屬性會被設為 `null`，缺少的數字會被設為 `0`，沒有任何報錯。

**反序列化只保證"格式對"，不保證"內容合理"。**標題不能為空、優先順序只能是 1 到 5，這些業務規則需要另外檢查，這就是下一章的主題。

::: info 技術細節
System.Text.Json 提供了 `RespectNullableAnnotations` 等選項，可以讓反序列化在遇到 `null` 時報錯。但它只能檢查"是否為 null"，表達不了"長度不超過 50"這類規則。下一章的驗證機制能統一處理這些情況，並回傳結構化的錯誤資訊。
:::

## 總結

- 在本章的 POST 端點中，普通的**複雜型別**參數（如 `CreateTodo`）預設從**請求本文**讀取 JSON；這項推斷不適用於 GET 等方法或已註冊為服務的型別。
- 攜帶 JSON 請求本文時，應提供受支援的 `Content-Type`，本教學使用 `application/json`；媒體型別不支援回傳 415，JSON 格式錯誤或型別不匹配回傳 400。
- 用單獨的**輸入模型**（`CreateTodo`）接收請求本文，與**資料模型**（`Todo`）分開，伺服器控制的欄位（如 `Id`）無法被用戶端篡改。
- 反序列化不檢查業務規則：缺少的欄位會變成 `null` 或 `0`，需要額外的驗證。

下一章：[參數驗證](./validation)——讓框架在處理常式執行前拒絕不合法的輸入。上一章：[查詢參數](./query-params)。
