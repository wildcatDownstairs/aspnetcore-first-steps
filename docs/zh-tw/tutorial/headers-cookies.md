---
title: Header 與 Cookie
description: 用 [FromHeader] 讀取請求標頭，透過 HttpRequest 讀取 Cookie、HttpResponse 寫入 Cookie，理解顯式指定參數來源的時機。
---

# Header 與 Cookie

到目前為止，我們從 URL（路由、查詢字串）和請求本文裡取資料。HTTP 請求還有一個部分：**請求標頭**（header）。用戶端版本號、語言偏好、身分驗證權杖都放在這裡；**Cookie** 本質上也是一個名為 `Cookie` 的請求標頭。

本節的新概念：**當參數來源無法從名字和型別推斷時，顯式告訴框架去哪裡找。**

<<< @/../samples/07-headers-cookies/Program.cs{1,16-33 cs:line-numbers} [07-headers-cookies/Program.cs]

## 執行與驗證

```bash
dotnet run
```

curl 預設會傳送 `User-Agent` 請求標頭：

```bash
curl http://localhost:5080/whoami
```

```json
{"userAgent":"curl/8.21.0","clientVersion":"Not provided"}
```

用 `-H` 自己設定請求標頭：

```bash
curl http://localhost:5080/whoami -H "X-Client-Version: 2.1.0" -H "User-Agent: MyApp/1.0"
```

```json
{"userAgent":"MyApp/1.0","clientVersion":"2.1.0"}
```

`userAgent` 中的 curl 版本號會因你的環境而不同。

## 讀取請求標頭

<<< @/../samples/07-headers-cookies/Program.cs{1,16-19 cs:line-numbers} [07-headers-cookies/Program.cs]

「查詢參數」一章說過，不在路由模板中的簡單型別參數預設來自查詢字串。所以要讀取請求標頭，必須用 `[FromHeader]` **顯式指定來源**。它來自第 1 行引入的 `Microsoft.AspNetCore.Mvc` 命名空間。

`Name = "User-Agent"` 指定了請求標頭的名字。**為什麼需要單獨寫名字？**請求標頭的名字通常包含連字元（`User-Agent`、`X-Client-Version`），而 C# 的參數名裡不能有連字元。`Name` 讓你在 C# 中使用合法、符合慣例的參數名，同時對應到 HTTP 中的實際名字。請求標頭的名字不區分大小寫。

必填和可選的規則和查詢參數完全一樣：

- `string userAgent` 不可為 null，是必填的。傳送一個空的 `User-Agent` 時（`curl -H "User-Agent:"` 會去掉這個請求標頭），會得到 400：

  ```text
  Microsoft.AspNetCore.Http.BadHttpRequestException: Required parameter "string userAgent" was not provided from header.
  ```

- `string? clientVersion` 可為 null，不傳時收到 `null`，第 19 行用 `??` 給出了預設顯示值 `"Not provided"`。

::: tip 提示
自定義請求標頭過去常用 `X-` 字首（如 `X-Client-Version`）。現在的規範已經不再推薦這個字首，但它在實際專案中仍然很常見，兩種寫法框架都能處理。
:::

::: fastapi FastAPI 對照
`[FromHeader(Name = "X-Client-Version")] string? clientVersion` 相當於 FastAPI 的 `x_client_version: str | None = Header(default=None)`。FastAPI 會自動把下劃線轉換成連字元；ASP.NET Core 則用 `Name` 顯式指定。
:::

## 寫入 Cookie

<<< @/../samples/07-headers-cookies/Program.cs{21-30 cs:line-numbers} [07-headers-cookies/Program.cs]

**Cookie** 是伺服器讓瀏覽器儲存的一小段資料。瀏覽器之後每次存取同一個站點，都會自動把它帶回來。常見用途是儲存使用者偏好、登入會話。

寫入 Cookie 需要修改**回應標頭**，所以處理常式要拿到代表回應的物件。第 21 行的參數 `HttpResponse response` 就是它。`HttpResponse` 是框架認識的**特殊型別**：看到這個型別，框架不會去路由、查詢字串或請求本文裡找值，而是直接把目前請求的回應物件傳進來。`HttpRequest`、`HttpContext`、`CancellationToken` 也是這樣的特殊型別。

第 23～28 行的 `Cookies.Append` 會在回應中加入一個 `Set-Cookie` 頭。用 `-i` 看看：

```bash
curl -i -X POST http://localhost:5080/preferences/theme/dark -c cookies.txt
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Set-Cookie: theme=dark; max-age=2592000; path=/; samesite=lax; httponly

{"saved":"dark"}
```

`-c cookies.txt` 讓 curl 像瀏覽器一樣把收到的 Cookie 儲存到檔案。`CookieOptions` 中的三個選項都有明確的用意：

| 選項 | 作用 | 為什麼 |
| --- | --- | --- |
| `HttpOnly = true` | 頁面中的 JavaScript 無法讀取這個 Cookie | 即使網站被注入了惡意指令碼，也偷不走它 |
| `SameSite = Lax` | 同站請求傳送；跨站時，使用 GET 等安全方法的頂層導航也可以傳送，例如點選連結或提交 GET 表單 | 降低部分跨站請求偽造（CSRF）風險，不能替代完整的 CSRF 防護 |
| `MaxAge = 30 天` | 30 天后過期 | 如果既不設定 `MaxAge` 也不設定 `Expires`，就是由瀏覽器管理生命週期的會話 Cookie；會話恢復可能在重新啟動瀏覽器後保留它 |

::: warning 注意
Cookie 儲存在用戶端，使用者可以隨意修改它的值。**不要在 Cookie 裡存放可信的資料**，比如"目前使用者是管理員"。身分身分驗證需要使用加密簽名的權杖，這是「身分驗證」一章的內容。
:::

## 讀取 Cookie

<<< @/../samples/07-headers-cookies/Program.cs{32-33 cs:line-numbers} [07-headers-cookies/Program.cs]

讀取時用的是 `HttpRequest`，它的 `Cookies` 屬性可以按名字取值，不存在時回傳 `null`。

帶上剛才儲存的 Cookie 請求（`-b` 表示傳送檔案中的 Cookie）：

```bash
curl http://localhost:5080/preferences -b cookies.txt
```

```json
{"theme":"dark"}
```

不帶 Cookie 時回傳預設值：

```bash
curl http://localhost:5080/preferences
```

```json
{"theme":"light"}
```

你可能注意到了，讀取請求標頭用的是 `[FromHeader]` 參數，讀取 Cookie 卻要透過 `HttpRequest`。這是因為 Minimal API **沒有** `[FromCookie]` 這樣的特性。Cookie 在 Web API 中不如請求標頭常用，框架選擇不為它提供專門的繫結方式。

::: fastapi FastAPI 對照
FastAPI 的 `Cookie()` 參數在這裡沒有直接的對應，需要透過 `HttpRequest.Cookies` 讀取；設定 Cookie 時的 `response.set_cookie(...)` 對應 `response.Cookies.Append(...)`。
:::

## 什麼時候用 HttpRequest

既然 `HttpRequest` 能拿到請求的一切，為什麼不總是用它，還要費心宣告 `[FromHeader]` 參數？

因為**參數宣告是給人和工具看的"API 說明"**：

- 讀處理常式的簽名，就知道它需要哪些輸入、哪些是必填的；
- 缺少必填值時，框架會自動回傳 400，不需要自己檢查；
- OpenAPI 文件會列出這些請求標頭，Scalar 頁面會給出對應的輸入框。

直接讀取 `HttpRequest` 時，這些資訊都藏在處理常式內部，文件裡看不到，缺值也需要自己處理。所以能用參數宣告的，優先用參數宣告；`HttpRequest` 留給沒有專門繫結方式的場景，比如本節的 Cookie。

## 總結

- 請求標頭需要用 `[FromHeader(Name = "...")]` **顯式指定來源**；`Name` 用來對應含連字元的 HTTP 名字。
- 必填和可選依然由型別決定：`string` 必填，`string?` 可選。
- `HttpRequest`、`HttpResponse`、`HttpContext` 是**特殊型別**，框架會直接傳入目前請求或回應的物件。
- 用 `response.Cookies.Append` 寫 Cookie，並設定 `HttpOnly`、`SameSite` 等安全選項；用 `request.Cookies["名字"]` 讀 Cookie。Minimal API 沒有 `[FromCookie]`。
- 優先用參數宣告輸入，因為它同時是 API 說明、自動檢查和文件來源。

下一章：[回應型別](./response-types)——讓回傳值同時描述所有可能的結果。上一章：[參數驗證](./validation)。
