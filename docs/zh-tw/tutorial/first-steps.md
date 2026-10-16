---
title: 第一步
description: 用 dotnet new web 建立專案，用 MapGet 定義第一個端點，執行並驗證它回傳的 JSON。
---

# 第一步

本節的新概念只有一個：**端點**（endpoint）——"當某個 HTTP 請求到來時，執行哪段程式碼"。我們會寫出一個回傳 JSON 的端點，並順帶獲得一份自動產生的互動式 API 文件。

這是本節最終的完整程式碼：

<<< @/../samples/02-first-steps/Program.cs{cs:line-numbers} [02-first-steps/Program.cs]

17 行，這就是一個完整的 Web API。本節重點理解第 15 行的端點；其餘啟動和文件設定先沿用這份程式碼，下面只解釋執行它所需的要點。

## 建立專案

用 `web` 模板建立一個空的 Web 專案，然後新增兩個相依套件：

```bash
dotnet new web -o FirstSteps
cd FirstSteps
dotnet add package Microsoft.AspNetCore.OpenApi
dotnet add package Scalar.AspNetCore
```

- `Microsoft.AspNetCore.OpenApi`：微軟官方套件，負責根據你的程式碼**產生 OpenAPI 文件**（一份描述 API 的 JSON）。
- `Scalar.AspNetCore`：第三方開源套件，把 OpenAPI 文件**渲染成可互動的網頁**。

然後把 `Program.cs` 替換成上面的程式碼。專案檔案現在是這樣的：

<<< @/../samples/02-first-steps/FirstSteps.csproj{9-12 xml:line-numbers} [02-first-steps/FirstSteps.csproj]

高亮的 `ItemGroup` 就是 `dotnet add package` 幫你加上的兩個依賴。

::: tip 提示
`dotnet add package` 不指定版本時，會安裝與目前專案相容的最新穩定版。你看到的版本號可能比上面更新，這沒關係。
:::

### 固定連接埠號碼

模板會在 `Properties/launchSettings.json` 裡隨機分配一個連接埠號碼。為了讓你的輸出和教學一致，本教學所有範例都把它改成了 `5080`：

<<< @/../samples/02-first-steps/Properties/launchSettings.json{8,10 json:line-numbers} [02-first-steps/Properties/launchSettings.json]

這個檔案只在本機開發時生效（`dotnet run` 會讀取它），部署時不會用到。第 10 行把執行環境設為 `Development`（開發環境），這一點在後面的逐行拆解中很重要。

::: info 技術細節
模板預設產生 `http` 和 `https` 兩個設定。本教學只保留了 HTTP，避免你在一開始就處理本機開發證書的問題。正式環境中的 HTTPS 通常由反向代理或雲平臺負責，我們在「部署」一章再討論。
:::

## 執行與驗證

```bash
dotnet run
```

看到下面的輸出，說明服務已經啟動：

```text
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5080
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to shut down.
info: Microsoft.Hosting.Lifetime[0]
      Hosting environment: Development
info: Microsoft.Hosting.Lifetime[0]
      Content root path: /your/path/FirstSteps
```

程式不會退出，它在等待請求。**另開一個終端**，傳送一個請求：

```bash
curl -i http://localhost:5080/
```

`-i` 表示同時顯示回應標頭。預期輸出：

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Sat, 26 Sep 2026 08:56:22 GMT
Server: Kestrel
Transfer-Encoding: chunked

{"message":"Hello, ASP.NET Core!"}
```

也可以直接在瀏覽器中開啟 <http://localhost:5080/>。回到執行服務的終端，按 `Ctrl+C` 可以停止它。

:::: details 可選：檢視互動式文件

服務執行時，開啟 <http://localhost:5080/scalar>，你會看到一個 API 文件頁面：左側列出所有端點，點開 `GET /` 後可以直接點選 **Test Request** 傳送請求並檢視回應。

這個頁面背後是一份 OpenAPI 文件，存取 <http://localhost:5080/openapi/v1.json> 可以看到原始內容，其中描述 `GET /` 的部分如下：

```json
"paths": {
  "/": {
    "get": {
      "tags": ["FirstSteps"],
      "responses": {
        "200": {
          "description": "OK",
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/AnonymousTypeOfstring" }
            }
          }
        }
      }
    }
  }
}
```

注意：**你沒有寫任何文件，也沒有寫任何註解。** 框架是從程式碼本身推斷出來的——它知道這個端點回應 `GET /`，也知道回傳的是一個包含 `message` 字串屬性的 JSON 物件。

::: fastapi FastAPI 對照
`/scalar` 頁面相當於 FastAPI 自帶的 `/docs`，`/openapi/v1.json` 相當於 `/openapi.json`。區別在於 ASP.NET Core 把"產生文件"和"展示文件"拆成了兩個套件，你可以自由選擇展示工具。
:::

::::

## 逐行拆解

### 第 3～7 行：builder 與 app 兩個階段

<<< @/../samples/02-first-steps/Program.cs{3,5,7 cs:line-numbers} [02-first-steps/Program.cs]

**第 3 行** `WebApplication.CreateBuilder(args)` 建立一個**建置器**（builder），它預先準備好了 Web 應用程式需要的預設設定：讀取設定檔案、設定記錄、準備好 Web 伺服器等。`args` 是命令列參數，傳進去之後你就可以在啟動時透過命令列覆蓋設定。

`var` 表示讓編譯器根據右邊的表示式推斷變數型別。在 VS Code 中把滑鼠懸停在 `builder` 上，會顯示它的真實型別是 `WebApplicationBuilder`。**型別是確定的，只是不用你手寫。**

**第 5 行** `builder.Services` 是一個**服務集合**（service collection），可以理解為"應用程式在執行階段需要用到的元件清單"。`AddOpenApi()` 往清單裡加入了"產生 OpenAPI 文件"所需的元件。這裡只是**登記**，並沒有開始產生任何東西。服務如何被建立和使用，是「相依性注入」一章的主題，現在記住"`builder.Services.AddXxx()` = 登記一項能力"就夠了。

**第 7 行** `Build()` 根據前面的設定和服務清單，建置出真正的應用程式物件 `app`（型別是 `WebApplication`）。

::: info 技術細節
為什麼要分成兩個階段？`builder` 先準備設定和服務註冊，`Build()` 再據此建立應用程式，之後用 `app` 定義如何處理請求。`Build()` 後服務註冊集合變為唯讀，不能再增刪註冊；它不會凍結服務執行個體中的可變狀態，也不保證服務執行個體的並行安全。服務的建立和生命週期會在[相依性注入](./dependency-injection)一章展開。
:::

::: warning 注意
`builder.Services.AddXxx()` 這類服務註冊必須放在 `Build()` 之前，否則會丟擲“服務集合為唯讀”的例外狀況。
:::

### 第 9～13 行：只在開發環境中暴露文件

<<< @/../samples/02-first-steps/Program.cs{9-13 cs:line-numbers} [02-first-steps/Program.cs]

- `app.MapOpenApi()`：把 OpenAPI 文件發佈在 `/openapi/v1.json`；
- `app.MapScalarApiReference()`：把 Scalar 文件頁面發佈在 `/scalar`。

它們被包在 `if (app.Environment.IsDevelopment())` 中。`app.Environment` 的值來自環境變數 `ASPNETCORE_ENVIRONMENT`，我們在 `launchSettings.json` 中把它設成了 `Development`。

**為什麼只在開發環境開啟？** API 文件會列出你所有的 API 和資料結構，對攻擊者來說是一份現成的地圖。開發時它很方便，但在正式環境中預設不應公開。這是微軟官方文件推薦的做法。

### 第 15 行：定義端點

<<< @/../samples/02-first-steps/Program.cs{15 cs:line-numbers} [02-first-steps/Program.cs]

這一行是本節的核心。一個**端點**由三部群組成：

| 組成部分 | 本例 | 含義 |
| --- | --- | --- |
| HTTP 方法 | `MapGet` 中的 **Get** | 只回應 GET 請求 |
| 路由模板（route template） | `"/"` | 只回應根路徑 |
| 處理常式（handler） | `() => new { ... }` | 請求匹配時執行的程式碼 |

處理常式是一個 **Lambda 表示式**（lambda expression），也就是匿名函式：`()` 是參數清單（這裡沒有參數），`=>` 後面是回傳值。同理還有 `MapPost`、`MapPut`、`MapDelete` 等方法，分別對應其他 HTTP 方法。

回傳值 `new { Message = "..." }` 是一個**匿名型別**（anonymous type）的物件——不需要預先定義類別，就能臨時組合出一個有屬性的物件。框架拿到回傳的物件後，會自動把它**序列化**為 JSON，並設定 `Content-Type: application/json`。

你可能注意到了：程式碼裡的屬性名是大寫開頭的 `Message`，JSON 裡卻是小寫開頭的 `message`。**這是有意的設計**：C# 的命名慣例是屬性用 PascalCase（大駝峰），而 JavaScript 等前端生態的慣例是 camelCase（小駝峰）。ASP.NET Core 預設在序列化時自動轉換，讓雙方都能按自己的慣例寫程式碼。

::: tip 提示
如果處理常式回傳的是字串（例如 `() => "Hello"`），框架會原樣輸出文字，`Content-Type` 是 `text/plain`；回傳其他物件時才會序列化為 JSON。
:::

::: fastapi FastAPI 對照
第 15 行相當於 FastAPI 中用 `@app.get("/")` 裝飾一個回傳字典的函式。區別是 ASP.NET Core 不用裝飾器，而是呼叫 `MapGet` 把處理函式"註冊"進去。
:::

### 第 17 行：啟動

最後一行 `app.Run()` 啟動 Web 伺服器並開始監聽請求。它會一直阻塞，直到你按下 `Ctrl+C`，所以它總是 `Program.cs` 的最後一行。

::: info 技術細節
回應標頭中的 `Server: Kestrel` 表明處理請求的是 **Kestrel**——ASP.NET Core 內建的跨平臺 Web 伺服器。它隨 ASP.NET Core 共享框架提供，在應用程式處理序內執行，不需要另外啟動一個 Web 伺服器處理序。
:::

需要練習編譯錯誤診斷和熱重新載入時，可以閱讀[可選附錄：開發工具練習](./development-tools)。它不影響本章對端點的理解。

## 總結

- `dotnet new web` 建立一個最小的 Web 專案，整個應用程式就寫在 `Program.cs` 中。
- 啟動程式碼先用 `builder` 準備服務，再用 `app` 註冊端點；服務註冊應放在 `Build()` 之前。
- **端點** = HTTP 方法 + 路由模板 + 處理常式，`app.MapGet("/", () => ...)` 定義了一個 GET 端點。回傳物件會被自動序列化為 JSON，屬性名轉為 camelCase。
- `AddOpenApi` + `MapOpenApi` + `MapScalarApiReference` 根據程式碼自動產生互動式文件，出於安全考慮只在開發環境中開啟。
- 用 `dotnet run` 啟動服務，用 curl 驗證回應；按 `Ctrl+C` 停止服務。

下一章：[路由參數](./path-params)——讓 URL 中的一部分成為處理常式的參數。上一章：[C# 速覽](./csharp-tour)。
