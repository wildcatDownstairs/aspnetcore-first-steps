---
title: 狀態碼與錯誤處理
description: 用 Problem Details 表達業務錯誤，併為符合條件的空錯誤回應和未處理例外狀況產生不洩露內部資訊的錯誤說明。
---

# 狀態碼與錯誤處理

上一章的 `404` 回應沒有任何內容，用戶端只知道"出錯了"，不知道為什麼。前幾章裡各種錯誤的格式也五花八門：繫結失敗是一段純文字，驗證失敗是一個 JSON，找不到路由則什麼都沒有。

本節的新概念：**問題詳情**（Problem Details）——一種標準的錯誤回應格式。我們會用它表達業務錯誤，並統一處理符合條件的空錯誤回應和未處理例外狀況。下面先用 curl 的預設請求驗證 JSON 回應，再說明它的適用條件。

<<< @/../samples/09-errors/Program.cs{7,11-12,28-49 cs:line-numbers} [09-errors/Program.cs]

## 執行與驗證

```bash
dotnet run
```

把一個待辦事項標記為完成，第一次成功：

```bash
curl -X POST http://localhost:5080/todos/1/complete
```

```json
{"id":1,"title":"Buy milk","done":true}
```

再標記一次，得到 `409 Conflict`（衝突）和一段有說明的錯誤：

```bash
curl -i -X POST http://localhost:5080/todos/1/complete
```

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.10","title":"Todo is already completed","status":409,"detail":"Todo with id 1 is already complete and cannot be completed again.","traceId":"00-eb960df5537d54d0822d3270697c268f-9f6dbe4c8a52e820-00"}
```

`traceId` 每次請求都不同，你看到的值會不一樣。

## Problem Details 格式

把上面的回應本文格式化一下：

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.10",
  "title": "Todo is already completed",
  "status": 409,
  "detail": "Todo with id 1 is already complete and cannot be completed again.",
  "traceId": "00-eb960df5537d54d0822d3270697c268f-9f6dbe4c8a52e820-00"
}
```

這是 **RFC 9457** 定義的 Problem Details 格式，`Content-Type` 是專用的 `application/problem+json`：

| 欄位 | 含義 |
| --- | --- |
| `type` | 標識錯誤型別的 URI，預設指向 HTTP 規範中對應狀態碼的說明 |
| `title` | 簡短的、給人看的錯誤概括，同一類錯誤應該相同 |
| `status` | HTTP 狀態碼，和回應行中的一致 |
| `detail` | 針對這一次錯誤的具體說明 |
| `traceId` | 請求的追蹤編號，ASP.NET Core 自動新增的擴充套件欄位 |

**為什麼要用標準格式？**用戶端可以複用**一套**邏輯處理 Problem Details 回應，讀取其中的 `status`、`title`、`detail` 等欄位。用戶端仍應檢查回應型別，併為非 JSON 回應保留兜底處理。很多 HTTP 用戶端庫和 API 工具也認識這個格式。「參數驗證」一章中的驗證錯誤其實也是這個格式的擴充套件，多了一個 `errors` 欄位。

`traceId` 的用處是**定位問題**：使用者報告錯誤時提供這個編號，你就能在伺服器記錄中找到對應的請求記錄（「記錄」一章會用到它）。

## 業務錯誤：TypedResults.Problem

<<< @/../samples/09-errors/Program.cs{28-44 cs:line-numbers} [09-errors/Program.cs]

第 35～41 行處理了一個業務規則：已經完成的待辦事項不能再完成一次。`TypedResults.Problem(...)` 產生一個 Problem Details 回應，你可以指定狀態碼、`title` 和 `detail`。第 28 行的回傳型別中相應地加入了 `ProblemHttpResult`。

第 44 行的 `ProducesProblem(StatusCodes.Status409Conflict)` 為 OpenAPI 補充了 409 回應描述。為什麼需要它？`ProblemHttpResult` 的狀態碼是在呼叫 `Problem(...)` 時指定的，單靠回傳型別無法確定它是 409。開啟 `/openapi/v1.json`，這個 POST 端點的 `responses` 會列出 `200`、`404`、`409`；其中 409 的媒體型別是 `application/problem+json`。`ProducesProblem` 只補充文件中繼資料，不會改變實際回應，也不會替你檢查業務規則。

**為什麼是 409，而不是 400？**請求本身沒有任何問題（格式正確、參數合法），是資源的**目前狀態**不允許這個操作。`409 Conflict` 正是為這種情況準備的。選對狀態碼能讓用戶端不看 `detail` 就知道該怎麼處理：400 表示"改改你的請求再試"，409 表示"資源狀態變了，先重新整理一下"。

常見的錯誤狀態碼：

| 狀態碼 | 含義 | 典型場景 |
| --- | --- | --- |
| `400 Bad Request` | 請求本身有問題 | 格式錯誤、驗證失敗 |
| `401 Unauthorized` | 沒有登入（未身分驗證） | 缺少或無效的權杖 |
| `403 Forbidden` | 登入了但沒有權限 | 普通使用者存取管理功能 |
| `404 Not Found` | 資源不存在 | id 不存在 |
| `409 Conflict` | 與資源目前狀態衝突 | 重複操作、版本衝突 |
| `500 Internal Server Error` | 伺服器內部錯誤 | 未處理的例外狀況 |

::: tip 提示
`StatusCodes.Status409Conflict` 是框架提供的常數，和直接寫 `409` 等價。用常數的好處是可讀性更好，也不會寫錯數字。
:::

## 讓空回應也有內容

<<< @/../samples/09-errors/Program.cs{7,12,22-26 cs:line-numbers} [09-errors/Program.cs]

第 22～26 行和上一章完全一樣，找不到時回傳 `TypedResults.NotFound()`，一個空的 404。但現在請求不存在的 id：

```bash
curl -i http://localhost:5080/todos/99
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"00-89e72e72b0724704260ef30ead4c62b0-7b0d90993376a8c3-00"}
```

回應本文自動變成了 Problem Details。這是兩行程式碼配合的結果：

- **第 7 行** `AddProblemDetails()`：註冊產生 Problem Details 的服務，其他元件需要產生錯誤回應時會使用它；
- **第 12 行** `UseStatusCodePages()`：為符合條件的 400～599 回應補充內容；這裡的空 404 會交給 Problem Details 服務處理。

::: info 技術細節
狀態碼頁只處理回應尚未開始、狀態碼在 400～599 之間，而且未設定 `Content-Length` 和 `Content-Type` 的回應。僅僅“回應本文為空”還不夠：即使沒有寫入正文，設定了 `Content-Type` 或 `Content-Length: 0` 也會讓它跳過。它不會改寫端點已經產生的錯誤內容。
:::

它甚至對根本不存在的路由也有效：

```bash
curl -i http://localhost:5080/nothing-here
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"00-4d4857384b8d1dd421304c5d187d7a78-199a0d8a7972567f-00"}
```

**為什麼不在每個處理常式裡都寫 `TypedResults.Problem(...)`？**對於"找不到"這類通用錯誤，狀態碼本身已經說清楚了，每次都手寫一遍既囉嗦又容易不一致。讓處理常式回傳簡單的 `NotFound()`，由統一的機制補全格式；只有需要額外說明的業務錯誤，才用 `Problem(...)` 寫出具體的 `detail`。

## 未處理的例外狀況

<<< @/../samples/09-errors/Program.cs{11,46-49 cs:line-numbers} [09-errors/Program.cs]

第 46～49 行的端點模擬了一個意外：程式碼丟擲了例外狀況，而且沒有任何地方捕獲它。

```bash
curl -i http://localhost:5080/crash
```

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Cache-Control: no-cache,no-store

{"type":"https://tools.ietf.org/html/rfc9110#section-15.6.1","title":"An error occurred while processing your request.","status":500,"traceId":"00-4a7b5bf94fc135b5b5c01580b95299c7-862cabea5a9180c8-00"}
```

**第 11 行** `UseExceptionHandler()` 捕獲了這個例外狀況，回傳一個 500 的 Problem Details。注意回應裡**沒有**例外狀況訊息"Database connection string is not configured"，也沒有堆疊資訊。

**這是有意的安全設計。**例外狀況訊息和堆疊可能包含檔案路徑、資料庫結構、設定項名稱，這些對攻擊者都是有價值的線索。用戶端只需要知道"伺服器出錯了"和 `traceId`；詳細資訊寫在伺服器的記錄裡。看看執行 `dotnet run` 的終端：

```text
fail: Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware[1]
      An unhandled exception has occurred while executing the request.
      System.InvalidOperationException: Database connection string is not configured
         at Program.<>c.<<Main>$>b__0_2() in /your/path/09-errors/Program.cs:line 48
```

::: info 技術細節
你可能記得，前幾章中繫結失敗時，終端輸出了一大段帶堆疊的純文字。那是**開發者例外狀況頁**（Developer Exception Page）：在開發環境中，如果你沒有設定例外狀況處理，框架會自動啟用它，把例外狀況詳情直接回傳給用戶端，方便除錯。

本節顯式呼叫了 `UseExceptionHandler()`，它會先於開發者例外狀況頁捕獲到例外狀況，所以即使在開發環境下，你看到的也是正式環境的行為。這樣你在開發時就能看到用戶端最終會收到什麼。想看詳細資訊，就去讀終端記錄。
:::

::: warning 注意
這兩個中介軟體都依賴第 7 行的 `AddProblemDetails()`，漏掉它時的表現卻不一樣：

- `UseExceptionHandler()` 會讓應用程式在**啟動時**直接失敗，錯誤資訊提示你設定 `AddProblemDetails()`；
- `UseStatusCodePages()` 則**不會報錯**，只是悄悄改用純文字，空的 404 會變成 `Status Code: 404; Not Found`。

後者更隱蔽。如果發現錯誤回應不是 JSON，先檢查是否註冊了 `AddProblemDetails()`，再檢查請求的 `Accept` 和回應是否滿足狀態碼頁的處理條件。
:::

::: info 技術細節
中介軟體產生 Problem Details 時，還需要寫入器支援用戶端在 `Accept` 請求標頭中宣告的媒體型別。這叫**內容協商**（content negotiation）。上面的 curl 指令預設傳送 `Accept: */*`，可以得到 JSON；如果改成 `Accept: text/html`，本例的 `/nothing-here` 會回退為純文字 404，`/crash` 則回傳沒有回應本文的 500。註冊 `AddProblemDetails()` 並不保證每個錯誤都能產生 JSON，也不會在協商失敗時洩露例外狀況詳情。
:::

`app.UseXxx()` 這類呼叫叫**中介軟體**（middleware），它們會依次處理每個請求和回應。為什麼它們寫在 `MapGet` 之前、順序是否重要，是「中介軟體」一章的主題。現在只需要記住：錯誤處理相關的中介軟體寫在最前面。

::: fastapi FastAPI 對照
`TypedResults.Problem(...)` 類似 FastAPI 中用 `raise HTTPException(...)` 表達業務錯誤，但這裡透過回傳結果表達，使用的回應格式也不同。未處理例外狀況的全域性處理類似 FastAPI 的 `@app.exception_handler(Exception)`。
:::

## 總結

- **Problem Details**（RFC 9457）是標準的錯誤回應格式，包含 `type`、`title`、`status`、`detail`，`Content-Type` 為 `application/problem+json`。
- 業務錯誤用 `TypedResults.Problem(statusCode, title, detail)` 回傳，並選擇恰當的狀態碼；用 `ProducesProblem` 為這類動態指定的狀態碼補充 OpenAPI 描述。
- `AddProblemDetails()` + `UseStatusCodePages()` 為符合條件的空錯誤回應補充 Problem Details；產生 JSON 還取決於請求的 `Accept`。
- `UseExceptionHandler()` 把未處理的例外狀況轉換成不含內部細節的 500 回應，例外狀況詳情只寫進伺服器記錄，用 `traceId` 關聯。
- 預期內的錯誤**回傳**結果，意料之外的錯誤才交給例外狀況處理。

下一章：[路由群組](./route-groups)——用 `MapGroup` 組織相關的端點。上一章：[回應型別](./response-types)。
