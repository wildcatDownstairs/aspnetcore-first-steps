---
title: 回應型別
description: 用 TypedResults 回傳帶狀態碼的結果，用 Results<T1, T2> 約束處理常式主動回傳的結果，併為 OpenAPI 提供回應中繼資料。
---

# 回應型別

前幾章的 Todo 處理常式直接回傳物件時，框架把它序列化成 JSON，並使用 `200 OK`。但真實的 API 需要表達更多結果：找不到資源時回傳 `404`，建立成功時回傳 `201`，刪除成功時回傳 `204`。

本節的新概念：**用回傳型別約束處理常式主動回傳的結果。**

<<< @/../samples/08-response-types/Program.cs{1,19-33 cs:line-numbers} [08-response-types/Program.cs]

為了把注意力集中在回應上，本節的 `CreateTodo` 只保留了 `Title`，也沒有加驗證。

## 執行與驗證

```bash
dotnet run
```

查詢存在的待辦事項，回傳 `200`：

```bash
curl -i http://localhost:5080/todos/1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Buy milk","done":false}
```

查詢不存在的，回傳 `404`：

```bash
curl -i http://localhost:5080/todos/99
```

```http
HTTP/1.1 404 Not Found
Content-Length: 0
```

建立一個新的，回傳 `201 Created`，並在 `Location` 頭中給出新資源的地址：

```bash
curl -i -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Write report"}'
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /todos/2

{"id":2,"title":"Write report","done":false}
```

刪除，回傳 `204 No Content`（沒有回應本文）；再刪一次，已經不存在了，回傳 `404`：

```bash
curl -i -X DELETE http://localhost:5080/todos/1
curl -i -X DELETE http://localhost:5080/todos/1
```

```http
HTTP/1.1 204 No Content

HTTP/1.1 404 Not Found
Content-Length: 0
```

## TypedResults：帶狀態碼的回傳值

<<< @/../samples/08-response-types/Program.cs{25-30 cs:line-numbers} [08-response-types/Program.cs]

第 29 行回傳的不再是 `todo` 本身，而是 `TypedResults.Created(...)`。`TypedResults` 提供了一組方法，每個方法對應一種 HTTP 回應：

| 方法 | 狀態碼 | 回傳型別 |
| --- | --- | --- |
| `TypedResults.Ok(value)` | 200 | `Ok<T>` |
| `TypedResults.Created(uri, value)` | 201 | `Created<T>` |
| `TypedResults.NoContent()` | 204 | `NoContent` |
| `TypedResults.BadRequest()` | 400 | `BadRequest` |
| `TypedResults.NotFound()` | 404 | `NotFound` |
| `TypedResults.Conflict()` | 409 | `Conflict` |

每個方法都回傳一個**具體的型別**，這些型別定義在第 1 行引入的 `Microsoft.AspNetCore.Http.HttpResults` 命名空間中。`Created<Todo>` 這個型別本身就說明了"狀態碼是 201，回應本文是 `Todo`"。

第 25 行的 Lambda 在參數清單前寫了 `Created<Todo>`，這是 Lambda 的**顯式回傳型別**。對於只有一種回傳結果的端點，它可以省略；但寫出來能讓讀程式碼的人一眼看出這個端點的回應。

::: tip 提示
`Created` 的第一個參數是新資源的地址，框架會把它放進 `Location` 回應標頭。這是 HTTP 的約定：用戶端建立資源後，可以直接用這個地址存取它。
:::

## Results<T1, T2>：列出處理常式的回傳結果

<<< @/../samples/08-response-types/Program.cs{19-23 cs:line-numbers} [08-response-types/Program.cs]

查詢單個待辦事項有兩種結果：找到了（`Ok<Todo>`）或沒找到（`NotFound`）。這兩個型別毫無關聯，一個方法怎麼能回傳兩種型別？

答案是第 19 行的 `Results<Ok<Todo>, NotFound>`。它是一個**聯合型別**（union type）：值可以是 `Ok<Todo>`，也可以是 `NotFound`，但不能是別的。泛型參數最多可以列出 6 種結果。

第 22 行用條件運算子在兩者之間選擇。`TypedResults.NotFound()` 和 `TypedResults.Ok(todo)` 型別不同，但它們都能隱式轉換成 `Results<Ok<Todo>, NotFound>`，所以編譯能透過。

### 編譯器幫你守住約定

聯合型別是一份**約定**：這個處理常式的回傳值只能是這兩種結果。如果之後有人在處理常式裡加了一行 `return TypedResults.BadRequest();`，編譯會失敗：

```text
Program.cs(22,24): error CS0029: 无法将类型“Microsoft.AspNetCore.Http.HttpResults.BadRequest”隐式转换为“Microsoft.AspNetCore.Http.HttpResults.Results<Microsoft.AspNetCore.Http.HttpResults.Ok<Todo>, Microsoft.AspNetCore.Http.HttpResults.NotFound>”
```

要讓這個處理常式主動回傳 `BadRequest`，就必須把它加進回傳型別。編譯器會檢查處理常式的回傳值是否符合宣告。

::: warning 注意
這個約定不涵蓋整個請求處理過程：參數繫結、驗證、中介軟體和例外狀況處理還可能產生其他回應。例如本章 POST 處理常式宣告回傳 `Created<Todo>`，但傳送損壞的 JSON 時，框架會在呼叫它之前回傳 400。
:::

### 文件自動同步

開啟 `/openapi/v1.json`，本例中各處理常式的回傳型別提供了以下回應資訊：

| 端點 | 文件中的回應 |
| --- | --- |
| `GET /todos/{id}` | `200`（回應本文為 `Todo`）、`404` |
| `POST /todos` | `201`（回應本文為 `Todo`） |
| `DELETE /todos/{id}` | `204`、`404` |

這些資訊全部來自回傳型別，沒有寫任何額外的標註。在 `/scalar` 頁面中，每個端點下方會列出這些回應。它們不是框架可能產生的全部回應；需要對呼叫方明確承諾的其他回應，應額外補充文件描述，下一章會演示一個 409 的例子。

## 為什麼不用 Results

你可能會在其他資料中看到另一種寫法：`Results.Ok(todo)`、`Results.NotFound()`（注意是 `Results`，不是 `TypedResults`）。它們在執行階段的行為完全一樣，區別在於回傳型別：`Results` 的方法都回傳同一個介面 `IResult`。

做個實驗：刪掉第 19 行的回傳型別 `Results<Ok<Todo>, NotFound>`，再把第 22 行的兩個 `TypedResults` 都換成 `Results`。程式照樣能執行，但 OpenAPI 文件中 `GET /todos/{id}` 的回應只剩下：

```json
"responses": {
  "200": {
    "description": "OK"
  }
}
```

`404` 不見了，`200` 的回應本文結構也不見了。因為 `IResult` 只說明"會回傳某種結果"，框架和編譯器都無法知道具體是哪些。這就是本教學統一使用 `TypedResults` 的原因：**型別資訊越具體，編譯器能檢查的越多，文件也越準確。**

::: info 技術細節
`IResult` 是所有結果型別共同實作的介面，它只有一個方法：把自己寫入 HTTP 回應。`Ok<T>`、`NotFound` 這些型別除了實作 `IResult`，還實作了一個向 OpenAPI 提供中繼資料的介面，宣告自己的狀態碼和回應本文型別。框架在啟動時讀取回傳型別上的這些資訊，產生文件。
:::

::: fastapi FastAPI 對照
FastAPI 的 `response_model` 同時負責執行階段回應驗證、欄位過濾和文件產生，`responses` 補充其他回應說明。`TypedResults` 與 `Results<...>` 透過 C# 回傳型別約束處理常式的結果並提供回應中繼資料，不等同於 Pydantic 的執行階段回應驗證。
:::

## 總結

- `TypedResults` 的方法（`Ok`、`Created`、`NoContent`、`NotFound` 等）回傳帶狀態碼的**具體型別**，例如 `Created<Todo>`。
- 處理常式需要回傳多種結果時，用 `Results<T1, T2, ...>` 列出這些結果；主動回傳未列出的型別會**編譯失敗**。
- 具體結果型別能提供 OpenAPI 回應中繼資料；參數繫結、驗證、中介軟體等產生的額外回應，以及無法從型別確定的狀態碼，需要時應補充描述。
- `Results.Xxx()` 回傳籠統的 `IResult`，會丟失型別資訊，因此優先使用 `TypedResults`。

下一章：[狀態碼與錯誤處理](./errors)——用統一格式表達常見錯誤。上一章：[Header 與 Cookie](./headers-cookies)。
