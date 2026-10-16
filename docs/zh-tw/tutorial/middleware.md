---
title: 中介軟體
description: 理解 ASP.NET Core 的請求處理管道：用 app.Use 編寫中介軟體，觀察請求"進入"與"離開"的順序、短路，以及為什麼中介軟體的註冊順序很重要。
---

# 中介軟體

同一個請求，既要記錄耗時，又要檢查是否處於維護模式。把這些程式碼複製進每個端點很麻煩，可以放到端點外統一處理。

這些處理環節叫**中介軟體**（middleware），按順序組成**請求管道**（request pipeline）。前面用過的例外狀況處理也是中介軟體；這一章自己寫三個，觀察它們如何呼叫下一步。

<<< @/../samples/13-middleware/Program.cs{16-48 cs:line-numbers} [13-middleware/Program.cs]

本節範例用 `Console.WriteLine` 輸出執行順序，這樣最直觀。下一章會介紹正式的做法：記錄。

## 執行與驗證

先停止上一章的服務，從儲存庫根目錄執行：

```bash
cd samples/13-middleware
dotnet run
```

另開一個終端，傳送請求：

```bash
curl -i http://localhost:5080/hello
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
X-Elapsed-Ms: 1

{"message":"Hello"}
```

回到執行服務的終端，會看到這樣的輸出：

```text
→ [1] Enter: GET /hello
→ [2] Enter: start timing
● Endpoint: handling request
← [2] Leave
← [1] Leave: 200
```

再加上 `?maintenance` 參數請求一次：

```bash
curl -i "http://localhost:5080/hello?maintenance"
```

```http
HTTP/1.1 503 Service Unavailable
Content-Length: 0
X-Elapsed-Ms: 1
```

```text
→ [1] Enter: GET /hello
→ [2] Enter: start timing
■ [3] Maintenance mode; request intercepted
← [2] Leave
← [1] Leave: 503
```

這次端點沒有執行。`X-Elapsed-Ms` 的值取決於機器速度，可能是 0 或其他數字。

## 管道模型

把第一次請求的輸出畫出來：

```text
请求 ──► [1] ──► [2] ──► [3] ──► 端点
                                   │
响应 ◄── [1] ◄── [2] ◄── [3] ◄─────┘
```

一箇中介軟體可以在呼叫下一步之前和之後分別執行程式碼。看第一個中介軟體：

<<< @/../samples/13-middleware/Program.cs{17-22 cs:line-numbers} [13-middleware/Program.cs]

- `context` 是 `HttpContext`，包含本次請求和回應的全部資訊；
- `next` 代表**管道中的下一個環節**；
- 第 20 行 `await next(context)` 把請求交給下一個環節，並**等待它執行完畢**。

第 19 行先執行，第 21 行等後續程式碼正常回傳後再執行，所以本例能記錄到 `200` 或 `503`。這不表示回應此時還沒傳送：端點可能已經寫出了回應本文。如果後續程式碼丟擲未處理的例外狀況，`await next(context)` 後面的普通陳述式也不會執行；必須執行的清理程式碼應放在 `finally` 中。

這樣寫，計時可以在 `next` 之前開始、之後結束；例外狀況處理可以用 `try/catch` 包住 `next`。兩部分程式碼放在一起，端點也不用重複做這些事。

::: fastapi FastAPI 對照
和 FastAPI 的 `@app.middleware("http")` 幾乎一模一樣：`response = await call_next(request)` 對應 `await next(context)`，它前面的程式碼處理請求，後面的程式碼處理回應。
:::

## 修改回應標頭

<<< @/../samples/13-middleware/Program.cs{25-36 cs:line-numbers} [13-middleware/Program.cs]

中介軟體 2 想在回應標頭裡寫入耗時。直覺上應該在 `await next(context)` 之後寫，但那時回應可能**已經開始傳送**了：HTTP 回應先傳送狀態行和回應標頭，再傳送回應本文。一旦端點開始寫回應本文，回應標頭就已經發出去了，再修改會丟擲例外狀況。

所以第 28～32 行用 `Response.OnStarting` 註冊回呼，在回應標頭即將傳送時寫入耗時。此時回應標頭還可以修改，回應本文卻不一定已經產生完，例如流式回應還會繼續產生內容。

::: info 技術細節
`X-Elapsed-Ms` 記錄的是從進入中介軟體 2 到開始傳送回應的時間，不是用戶端收完整個回應的耗時。
:::

## 短路

<<< @/../samples/13-middleware/Program.cs{39-48 cs:line-numbers} [13-middleware/Program.cs]

中介軟體 3 檢查查詢字串中是否有 `maintenance`。如果有，就設定狀態碼 503（服務不可用）並直接 `return`，**不呼叫 `next`**。

不呼叫 `next`，後面的環節就不會執行，這叫**短路**（short-circuit）。中介軟體 3 正常回傳後，前面的 1 和 2 繼續執行，所以仍能記錄 503 和耗時。

內建中介軟體也會短路：授權檢查發現受保護端點缺少有效身分時，可以回傳 401；CORS 中介軟體處理預檢後回傳；靜態檔案中介軟體找到檔案後回傳檔案內容。注意，JWT **身分驗證**負責驗證權杖、建立身分，不會僅因權杖無效就攔截所有請求；是否允許存取，還要看端點的授權要求。

## 為什麼順序很重要

你用 `app.Use...` 新增的中介軟體按呼叫順序排列。前面的中介軟體可以呼叫後面的，也可以直接回傳。

把本節的例子換一個順序想一想：

- 如果把中介軟體 3 放在最前面，維護模式下的請求在進入中介軟體 1 之前就被攔截了，中介軟體 1 根本不會記錄它們。
- 如果把中介軟體 2 放在最後，它測量的時間就不包括前面環節的耗時。

對於內建中介軟體，順序直接關聯到正確性和安全性：

| 中介軟體 | 放置位置 | 原因 |
| --- | --- | --- |
| `UseExceptionHandler` | 需要捕獲例外狀況的環節之前 | 只能捕獲後續環節丟擲的例外狀況 |
| `UseStatusCodePages` | 靠前 | 只能處理後面環節產生的空錯誤回應 |
| `UseCors` | 路由之後，身分驗證授權之前 | 先按 CORS 策略處理預檢，再對實際請求檢查身分和權限 |
| `UseAuthentication` | 授權之前 | 先知道"你是誰"，才能判斷"你能做什麼" |
| `UseAuthorization` | 端點之前 | 沒有權限的請求應該在執行端點之前被攔下 |

第 09 章把例外狀況處理放在靠前的位置，是為了捕獲後續處理中的例外狀況。身分驗證和授權的完整順序會在第 18～20 章用到。

::: warning 注意
順序寫錯不一定會在啟動時暴露。例如，放在例外狀況處理中介軟體之前的程式碼丟擲例外狀況，它就捕獲不到。新增內建中介軟體時，請對照[官方推薦順序](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/middleware/?view=aspnetcore-10.0#middleware-order)。
:::

::: info 技術細節
本例沒有顯式呼叫 `UseRouting()`，`WebApplication` 會把路由匹配安排在自定義中介軟體之前，把端點執行安排在它們之後。因此這裡可以透過 `context.GetEndpoint()` 讀取已匹配的端點；沒有匹配結果時得到 `null`。如果手動調整路由中介軟體的位置，就要重新考慮這一順序。
:::

## 總結

- **中介軟體**是請求處理管道中的環節，用 `app.Use(async (context, next) => { ... })` 編寫。
- `await next(context)` 呼叫後續環節；後續程式碼正常回傳後，才繼續執行它後面的陳述式。
- 回應標頭要在傳送之前修改，可以用 `Response.OnStarting` 註冊回呼。
- 不呼叫 `next` 就是**短路**：後續環節不再執行，前面的中介軟體照常完成回程。
- 自定義中介軟體按註冊順序排列；例外狀況處理放在要保護的程式碼之前，身分驗證在授權之前。

下一章：[記錄](./logging)——用 `ILogger` 代替 `Console.WriteLine`。上一章：[設定與 Options](./configuration)。
