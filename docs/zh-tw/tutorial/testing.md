---
title: 測試
description: 用 xUnit 和 WebApplicationFactory 把 Todo API 的手動檢查變成整合測試，驗證回應、資料與存取權限。
---

# 測試

每次改完程式碼，都手動發一遍 curl，很容易漏掉某個錯誤分支。這一章把“建立任務，再讀回來核對”寫成**整合測試**（integration test）：讓一次請求經過路由、驗證、身分驗證、處理常式和 SQLite，然後檢查結果。

先看第一個完整測試檔案。API 沿用第 20 章，本章新增 `Tests` 專案：

<<< @/../samples/21-testing/Tests/CreateTodoTests.cs{6-19 cs:line-numbers} [Tests/CreateTodoTests.cs]

這個檔案需要下面的測試工廠和專案設定，均已包含在儲存庫中。

:::: details 完整測試工廠與專案設定
::: code-group

<<< @/../samples/21-testing/Tests/TodoApiFactory.cs{16-20,26-43 cs:line-numbers} [Tests/TodoApiFactory.cs]

<<< @/../samples/21-testing/Tests/TodoApi.Tests.csproj{10-15 xml:line-numbers} [Tests/TodoApi.Tests.csproj]

<<< @/../samples/21-testing/global.json{json:line-numbers} [global.json]

<<< @/../samples/21-testing/TestAccess.cs{cs:line-numbers} [TestAccess.cs]

<<< @/../samples/21-testing/Testing.csproj{xml:line-numbers} [Testing.csproj]

:::
::::

## 執行與驗證

從儲存庫根目錄執行：

```bash
cd samples/21-testing
dotnet test --project Tests/TodoApi.Tests.csproj
```

不需要先 `dotnet run`，也不需要產生開發 JWT。摘要中的結果應為下面這樣，耗時和完整路徑因機器而異：

```text
测试运行摘要: 已通过!
  总计: 11
  失败: 0
  成功: 11
  已跳过: 0
```

範例使用 **xUnit** 測試框架，並在本章 `global.json` 中選擇 .NET 10 的 **Microsoft Testing Platform（MTP）** 測試執行器。因此指令使用 `--project` 指定測試專案；請從本章目錄執行，讓 SDK 找到這份設定。xUnit 套件名稱中的 `v3` 是產品系列名，與套件版本號不必相同。[xUnit 入門](https://xunit.net/docs/getting-started/v3/getting-started)

## 一條測試檢查什麼

`[Fact]` 標出一條測試。方法名描述要驗證的行為：建立成功後，可以讀取儲存的資料。方法分三步：

1. 建立測試應用程式，取得帶 editor 身分的 `HttpClient`。
2. 向 `/todos` 傳送 JSON 請求。
3. 用**斷言**（assertion）核對狀態碼、Location，以及再次讀取的任務內容。

`PostAsJsonAsync` 把物件序列化為 JSON，並設定請求的 Content-Type；`GetFromJsonAsync<TodoResponse>` 將回應反序列化為指定型別。這裡使用前面已有的 DTO，不再手動解析 JSON 字串。

為什麼不只檢查 `201`？處理常式可能回傳了成功，卻沒有儲存任務，或者 Location 指向了錯誤的編號。再讀一次，才能確認用戶端拿到的地址確實可用。

`TestContext.Current.CancellationToken` 來自測試執行器，取消測試時可以中止尚未完成的 HTTP 操作。`using` 和 `await using` 則在測試結束後釋放用戶端、測試應用程式及資料庫連線。

## WebApplicationFactory 做了什麼

`WebApplicationFactory<Program>` 建立測試宿主，用測試伺服器處理 `HttpClient` 發出的請求，不佔用真實的 5080 連接埠。`Program` 指應用程式入口；`TestAccess.cs` 中的公開部分宣告讓另一個專案能引用這個型別，不會新增 HTTP 端點。

`Microsoft.AspNetCore.Mvc.Testing` 雖然名字裡有 Mvc，同樣可以測試 Minimal API，不需要引入控制器。[ASP.NET Core 整合測試](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0)

測試工廠替換了兩項設定：

| 設定 | 測試中的處理 | 原因 |
| --- | --- | --- |
| 資料庫 | 每個工廠單獨開啟一個 SQLite 記憶體連線 | 不讀寫練習用的資料庫檔案，測試之間不會爭搶編號 |
| JWT | 每個工廠產生隨機簽名金鑰，建立短期測試權杖 | 不依賴本機 User Secrets，也不用連線外部身分服務 |

這裡仍然使用真實的 SQLite 提供者和 JWT 驗證處理器。只是更換資料庫位置和可信簽發者設定，沒有把“允許存取”寫死。工廠裡的簽發程式碼僅屬於測試專案，不是登入 API。

::: info 技術細節
SQLite 記憶體資料庫在連線關閉時消失，所以工廠先開啟連線，等測試應用程式釋放後再關閉。還要移除舊的 `DbContextOptions` 及其設定註冊，避免兩套連線設定一起生效。同一個工廠中的請求共享這份測試庫；本例每條測試建立自己的工廠，並順序傳送請求。
:::

## 錯誤分支也要檢查

下面是其餘測試的完整檔案：

::: details 驗證、身分驗證、角色與更新刪除測試
<<< @/../samples/21-testing/Tests/TodoApiTests.cs{cs:line-numbers} [Tests/TodoApiTests.cs]
:::

`[Theory]` 配合 `[InlineData]`，讓同一段測試分別使用多組輸入。空標題有兩組，禁止寫入有 POST、PUT、DELETE 三組，所以測試方法數與最終用例數不同。

這些測試檢查的不只是狀態碼：

- 標題為空或分類不存在：回傳 400，清單仍然為空。
- 編號不存在：回傳 404。
- 沒有權杖或權杖無效：回傳 401。
- 普通讀者嘗試建立、修改、刪除：回傳 403，原任務和條數不變。
- 編輯者修改後重新讀取，再刪除並查詢：依次確認儲存成功和 404。

## 故意改錯一次

在本章 `Program.cs` 的 POST 註冊末尾，臨時移除 `RequireAuthorization("CanWriteTodos")`，保留群組上的身分驗證要求，再執行測試。

`Reader_cannot_write` 的 POST 用例應失敗：預期是 `Forbidden`（403），實際卻變成 `Created`（201）。這說明普通讀者獲得了寫權限。把策略呼叫恢復，11 個用例應重新全部透過。

這樣，第 22 章拆分檔案時就有了檢查依據：檔案可以換位置，用戶端看到的行為應保持一致。

::: warning 注意
這些是 API 整合測試，不會驗證瀏覽器是否執行 CORS，也不會驗證反向代理、TLS 或外部身分服務的登入流程。涉及瀏覽器和部署的行為仍要在相應環境檢查。
:::

::: fastapi FastAPI 對照
這類似用 pytest 和 TestClient 呼叫 FastAPI 應用程式，再斷言狀態碼和 JSON。這裡由 WebApplicationFactory 建立測試應用程式，測試工廠負責替換資料庫與身分驗證設定。
:::

## 總結

- 整合測試透過請求驗證多個元件一起工作的結果，不必手動啟動 API。
- `[Fact]` 寫單個案例，`[Theory]` 用同一段程式碼驗證多組輸入。
- 成功回應要檢查內容和後續讀取，拒絕寫入還要檢查資料沒有被修改。
- 每條測試使用獨立資料庫和測試簽名金鑰，結果不依賴執行順序。
- 重構前先跑通測試，改完再跑，及時發現回應和權限變化。

下一章：[依功能組織專案](./project-structure)——把同一功能的程式碼放在一起。上一章：[CORS](./cors)。
