---
title: CORS
description: 為獨立前端設定精確的跨源策略，實際驗證預檢、Authorization 請求標頭和 Location 回應標頭，並區分 CORS 與授權。
---

# CORS

API 在 5080 連接埠，前端頁面在 5178 連接埠，瀏覽器預設不允許頁面讀取這個 API 的回應。這一章設定**跨源資源共享**（Cross-Origin Resource Sharing，CORS），允許本地前端呼叫 API 並讀取結果。

在上一章程式碼中新增 CORS 策略，完整檔案如下：

<<< @/../samples/20-cors/Program.cs{19-23,29-32 cs:line-numbers} [20-cors/Program.cs]

<<< @/../samples/20-cors/Models.cs{cs:line-numbers} [20-cors/Models.cs]

<<< @/../samples/20-cors/TodoDbContext.cs{cs:line-numbers} [20-cors/TodoDbContext.cs]

允許的前端地址來自設定：

<<< @/../samples/20-cors/appsettings.json{13-17 json:line-numbers} [20-cors/appsettings.json]

## 先分清什麼是源

**源**（origin）由協議、主機和連接埠共同決定：

| 地址 | 與 `http://localhost:5080` 是否同源 |
| --- | --- |
| `http://localhost:5080/todos` | 是，路徑不同不影響源 |
| `http://localhost:5178` | 否，連接埠不同 |
| `http://127.0.0.1:5080` | 否，主機不同 |
| `https://localhost:5080` | 否，協議不同 |

瀏覽器的**同源策略**（same-origin policy）限制指令碼讀取其他源的回應。設定 CORS 後，伺服器可以允許指定源的頁面讀取回應。

## 啟動 API

停止上一章服務，在儲存庫根目錄執行：

```bash
cd samples/20-cors
dotnet user-jwts create --name alice --role editor --valid-for 1h --output token
dotnet run
```

複製工具輸出的完整權杖備用。權杖必須在本章專案裡產生；資料庫使用新的 `todos-20.db`，初始 Todo 清單為空，分類仍為 Work（1）和 Life（2）。

## 用真正的瀏覽器頁面驗證

範例附帶一個 HTML 頁面，用 Node.js 提供本地存取地址，不需要安裝 npm 包：

<<< @/../samples/20-cors/browser/index.html{24-35 html:line-numbers} [20-cors/browser/index.html]

<<< @/../samples/20-cors/browser/serve.mjs{js:line-numbers} [20-cors/browser/serve.mjs]

另開終端，同樣進入 `samples/20-cors`，執行：

```bash
node browser/serve.mjs
```

預期輸出：

```text
Open http://localhost:5178/
```

必須透過這個 HTTP 地址開啟頁面，不要雙擊 HTML 以 `file://` 開啟。把權杖貼上到頁面的輸入框，點選“Read Todos”，首次執行得到：

```text
HTTP 200
Location: (none)
[]
```

再點選“Create Todo”，得到：

```text
HTTP 201
Location: /todos/1
{"id":1,"title":"Browser todo","done":false,"categoryId":1}
```

編號以新資料庫為前提；再次點選會建立新任務。權杖只保留在目前頁面記憶體中，不寫入 localStorage、Cookie 或伺服器檔案。

## 預檢：先問能不能發，再發實際請求

開啟瀏覽器開發者工具的 Network 面板，可以看到 **OPTIONS 預檢請求**（preflight request）。本例手動傳送 `Authorization`，POST 還使用 `application/json`，這些條件會觸發預檢；並非只有 POST 才會預檢。瀏覽器可能快取預檢結果，所以不一定每次點選都出現 OPTIONS。

用 curl 可以檢視預檢回應。下面的指令不帶 JWT，也不會建立 Todo：

```bash
curl -i -X OPTIONS http://localhost:5080/todos -H "Origin: http://localhost:5178" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type"
```

關鍵回應標頭如下：

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5178
Access-Control-Allow-Methods: GET,POST,PUT,DELETE
Access-Control-Allow-Headers: Authorization,Content-Type
```

預檢不攜帶實際請求的 Bearer 權杖，所以要在身分驗證和授權之前處理。本例先用 `UseRouting()` 確定端點，再由 `UseCors()` 處理預檢；實際的 GET、POST 仍需有效權杖，寫入仍要求 editor 角色。

## 策略中的四項設定

| 設定 | 作用 |
| --- | --- |
| `WithOrigins(...)` | 允許 `http://localhost:5178` 這個精確的源，不包含路徑或末尾斜槓 |
| `WithMethods(...)` | 允許前端使用 GET、POST、PUT、DELETE |
| `WithHeaders(...)` | 允許實際請求攜帶 Authorization、Content-Type |
| `WithExposedHeaders("Location")` | 允許前端 JavaScript 讀取回應中的 Location |

**為什麼請求標頭和回應標頭要分開設定？**允許傳送 Authorization，不代表可以讀取任意回應標頭。`Location` 不屬於預設向跨源指令碼暴露的回應標頭，因此需要額外宣告；否則網路面板裡可能看得到，但 `response.headers.get('Location')` 回傳 `null`。

本例手動傳送 Bearer 請求標頭，使用 `credentials: 'omit'` 避免瀏覽器附帶 Cookie，因此不需要 `AllowCredentials()`。如果以後改用 Cookie 登入，需要另外設定認證資訊，並防範**跨站請求偽造**（cross-site request forgery，CSRF）。[ASP.NET Core CORS 文件](https://learn.microsoft.com/en-us/aspnet/core/security/cors?view=aspnetcore-10.0)

## 不允許的源不一定得到 403

把預檢指令的 Origin 改成 `http://localhost:5179` 再執行。本例仍回傳 204，但**沒有 `Access-Control-Allow-Origin`**，瀏覽器因此不會批准後續的跨源請求。

curl 不執行瀏覽器的同源策略。帶著有效權杖，用 curl 直接傳送實際請求，即使偽造一個不允許的 Origin，伺服器端處理常式仍可能執行，只是回應沒有跨源許可頭。某些不需要預檢的瀏覽器請求也可能發到伺服器端，只是指令碼讀不到回應。

**CORS 不能替代身分驗證和授權。**本章阻止無權限寫入的是 JWT 和 `CanWriteTodos`；CORS 決定瀏覽器是否允許頁面讀取回應。[CORS 工作方式](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)

::: tip 提示
遇到“瀏覽器報 CORS 錯誤”，先檢查 Network 中的預檢和實際請求：API 是否啟動、Origin 是否完全一致、方法和請求標頭是否被允許，以及實際請求是不是 401/403。不要只看到瀏覽器報錯就修改業務權限。
:::

::: fastapi FastAPI 對照
這對應 FastAPI / Starlette 的 `CORSMiddleware`：分別設定允許的源、方法、請求標頭和可讀取的回應標頭。瀏覽器的預檢與同源規則不會因為伺服器端框架不同而改變。
:::

## 總結

- 源由協議、主機和連接埠決定；CORS 授權瀏覽器指令碼讀取指定的跨源回應。
- 精確設定源、方法和請求標頭；讀取 Location 等回應標頭時還要顯式暴露它們。
- 預檢檢查跨源許可，實際請求仍需身分驗證和授權；CORS 中介軟體放在身分驗證授權之前。
- 不允許的源可能仍得到 HTTP 回應，但沒有許可頭；curl 成功不能證明瀏覽器 CORS 設定正確。
- CORS 不提供使用者權限或資料隔離，也不能替代 CSRF 防護。

本章完成「安全」階段。下一章：[測試](./testing)，用自動化檢查保護這些行為。上一章：[授權](./authorization)。
