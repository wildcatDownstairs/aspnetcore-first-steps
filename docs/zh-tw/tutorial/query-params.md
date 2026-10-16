---
title: 查詢參數
description: 用處理常式的普通參數接收 URL 查詢字串，理解必填與可選、預設值、陣列參數，以及框架如何推斷參數來源。
---

# 查詢參數

上一章結尾，我們看到一個名字對不上的路由參數被框架當成了"查詢字串"。本節就來正式認識它：**查詢參數**（query parameter），也就是 URL 中 `?` 後面的 `key=value` 部分，例如 `/todos?done=false&page=2`。

它們通常用來**篩選、排序、分頁**——不改變"存取的是哪個資源"，只改變"怎麼看這個資源"。

本節最終的完整程式碼：

<<< @/../samples/04-query-params/Program.cs{24-34 cs:line-numbers} [04-query-params/Program.cs]

第 15～22 行準備了一個記憶體中的待辦事項清單作為演示資料。它用了「C# 速覽」中介紹的集合表示式，`new(1, "Buy milk", false)` 省略了型別名，因為編譯器能從 `List<Todo>` 推斷出來。

## 執行與驗證

```bash
dotnet run
```

不帶任何參數時，使用預設的分頁設定（每頁 2 條）：

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Buy milk","done":false},{"id":2,"title":"Write weekly report","done":true}]
```

翻到第 2 頁：

```bash
curl "http://localhost:5080/todos?page=2"
```

```json
[{"id":3,"title":"Clean the litter box","done":false},{"id":4,"title":"Learn ASP.NET Core","done":false}]
```

只看未完成的，每頁 10 條：

```bash
curl "http://localhost:5080/todos?done=false&pageSize=10"
```

```json
[{"id":1,"title":"Buy milk","done":false},{"id":3,"title":"Clean the litter box","done":false},{"id":4,"title":"Learn ASP.NET Core","done":false}]
```

::: warning 注意
URL 中包含 `&` 時，一定要用引號把整個地址括起來。否則終端會把 `&` 當作"在背景執行"的指令分隔符，後面的參數就丟了。
:::

## 處理常式的參數就是查詢參數

<<< @/../samples/04-query-params/Program.cs{24 cs:line-numbers} [04-query-params/Program.cs]

路由模板 `"/todos"` 裡沒有任何花括號，但處理常式有三個參數：`done`、`page`、`pageSize`。框架發現這些名字**不在路由模板中**，就會去查詢字串裡找同名的值。

這就是上一章末尾那個現象的原因。對於本教學目前使用的普通參數——沒有顯式指定來源、沒有註冊為服務，也沒有自定義繫結——可以先按下面的規則理解：

| 參數 | 來源 |
| --- | --- |
| 簡單型別，且名字出現在路由模板中 | 路由 |
| 簡單型別（`int`、`string`、`bool`、`DateTime` 等），且不在路由模板中 | 查詢字串 |
| 複雜型別（比如下一章的 record），且 HTTP 方法允許隱式請求本文繫結 | 請求本文（下一章） |

::: warning 注意
`GET`、`HEAD`、`OPTIONS`、`DELETE` 不支援上表中的隱式請求本文繫結。不要直接把本章 GET 端點的普通參數改成一個複雜物件；下一章會在 POST 端點中接收 JSON。註冊為服務的型別和框架特殊型別也有其他繫結規則，在後續章節再介紹。
:::

這套推斷規則讓最常見的寫法最簡短。當推斷不符合你的意圖時，也可以用特性（attribute）顯式指定來源，比如 `[FromQuery]`、`[FromRoute]`，我們在「Header 與 Cookie」一章會用到同類的 `[FromHeader]`。

::: tip 提示
查詢參數的名字**不區分大小寫**：`?Done=true&PAGESIZE=1` 和 `?done=true&pageSize=1` 效果相同。
:::

## 必填與可選

同樣是查詢參數，`done`、`page`、`pageSize` 都是**可選**的，而下面這個端點的 `keyword` 是**必填**的：

<<< @/../samples/04-query-params/Program.cs{24,30-31 cs:line-numbers} [04-query-params/Program.cs]

區別完全來自參數的**型別宣告**：

| 宣告 | 含義 | 請求中沒有這個參數時 |
| --- | --- | --- |
| `string keyword` | 不可為 null，沒有預設值 | 回傳 400 |
| `bool? done` | 可為 null（`?`） | 收到 `null` |
| `int page = 1` | 有預設值 | 收到 `1` |

不帶 `keyword` 請求會得到：

```bash
curl -i http://localhost:5080/todos/search
```

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Required parameter "string keyword" was not provided from query string.
```

這正是「C# 速覽」中可空引用型別的用武之地：**`?` 不僅告訴編譯器"這裡可能是 null"，也告訴框架"這個參數可以不傳"。**你不需要再寫任何額外的標註。

第 26 行利用了 `done` 可為 null 這一點：`done is null` 時表示"不篩選"，回傳全部；否則只保留 `Done` 等於 `done` 的項。

::: info 技術細節
`int page = 1` 這種寫法是 Lambda 參數的**預設值**，從 C# 12 開始支援。ASP.NET Core 讀取到預設值後，會把參數視為可選，並把預設值寫進 OpenAPI 文件：`/openapi/v1.json` 中 `page` 參數的描述裡會出現 `"default": 1`，`keyword` 則帶有 `"required": true`。
:::

### 型別不對時

和路由參數一樣，查詢參數也會按宣告的型別轉換，轉換失敗就回傳 400：

```bash
curl -i "http://localhost:5080/todos?page=abc"
```

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Failed to bind parameter "int page" from "abc".
```

`done=yes` 也會得到類似的錯誤，因為 `bool` 只接受 `true` 和 `false`。

::: fastapi FastAPI 對照
和 FastAPI 幾乎完全一致：沒有預設值的參數是必填的，`Optional[bool] = None` 對應 C# 的 `bool? done`，`page: int = 1` 對應 `int page = 1`。
:::

## 陣列參數

<<< @/../samples/04-query-params/Program.cs{33-34 cs:line-numbers} [04-query-params/Program.cs]

把參數宣告為陣列 `int[] id`，同一個參數名就可以在查詢字串中出現多次：

```bash
curl "http://localhost:5080/todos/batch?id=1&id=3&id=5"
```

```json
[{"id":1,"title":"Buy milk","done":false},{"id":3,"title":"Clean the litter box","done":false},{"id":5,"title":"Schedule a checkup","done":true}]
```

一個 `id` 都不傳時，`id` 是一個空陣列，結果也是空的 `[]`。陣列參數總是可選的。

注意這裡的參數名用的是單數 `id` 而不是 `ids`，因為它決定了 URL 裡寫的是 `?id=1&id=3`。命名時要從呼叫方的角度考慮。

## 空格與 URL 編碼

搜尋帶空格的關鍵字時，需要先做 **URL 編碼**（URL encoding）：空格會編碼為 `%20`，所以 `ASP.NET Core` 在 URL 中寫作 `ASP.NET%20Core`：

```bash
curl "http://localhost:5080/todos/search?keyword=ASP.NET%20Core"
```

```json
[{"id":4,"title":"Learn ASP.NET Core","done":false}]
```

框架會在繫結參數前自動解碼，所以處理常式收到的 `keyword` 是 `"ASP.NET Core"`。瀏覽器和 Scalar 文件頁面會自動完成編碼，在 `/scalar` 中直接輸入帶空格的關鍵字即可測試。

::: warning 注意
本例中的關鍵字只包含 ASCII 字元和空格。空格必須按上面的形式寫成 `%20`；直接將空格放入 URL 可能導致解析錯誤。也可以在 `/scalar` 頁面中輸入原始關鍵字，讓瀏覽器處理編碼。
:::

## 總結

- 處理常式中**不在路由模板裡**的簡單型別參數，會自動從**查詢字串**繫結。
- 參數的型別宣告決定了它是必填還是可選：普通型別必填，可空型別（`bool?`）或帶預設值（`int page = 1`）的參數可選。缺少必填參數或型別轉換失敗都回傳 400。
- 陣列參數（`int[] id`）接收同名參數的多個值，形如 `?id=1&id=3`。
- 查詢參數名不區分大小寫；非 ASCII 字元需要 URL 編碼，框架會自動解碼。

下一章：[請求本文](./request-body)——用 record 接收 JSON 資料。上一章：[路由參數](./path-params)。
