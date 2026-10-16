---
title: 發佈與部署
description: 用 .NET SDK 發佈 Todo API，透過 Docker Compose 設定正式環境、執行資料庫遷移並持久儲存 SQLite 資料。
---

# 發佈與部署

本章把第 22 章的 Todo API 變成可以在另一臺機器上執行的程式。核心問題是：**程式碼發佈後，設定和資料放在哪裡？** 映象負責攜帶程式，環境變數提供設定，資料卷儲存資料庫。

先看完整入口。端點和依功能組織的目錄繼續沿用上一章；新增的是獨立的遷移指令與存活檢查：

<<< @/../samples/23-deployment/Program.cs{7,16,36-43 cs:line-numbers} [Program.cs]

:::: details 發佈設定與資料庫初始化
::: code-group

<<< @/../samples/23-deployment/Deployment.csproj{xml:line-numbers} [Deployment.csproj]

<<< @/../samples/23-deployment/Features/Auth/AuthConfiguration.cs{8-15 cs:line-numbers} [Features/Auth/AuthConfiguration.cs]

<<< @/../samples/23-deployment/Data/TodoDatabase.cs{cs:line-numbers} [Data/TodoDatabase.cs]

<<< @/../samples/23-deployment/Data/TodoDbContext.cs{cs:line-numbers} [Data/TodoDbContext.cs]

:::
::::

## 先在本機執行

從儲存庫根目錄執行：

```bash
cd samples/23-deployment
dotnet run -- --migrate
dotnet user-jwts create --name alice --role editor
dotnet run
```

第一條執行指令執行遷移後退出，最後一行是 `Database migration complete.`。隨後產生的開發權杖用於本機除錯，服務地址仍是 `http://localhost:5080`。

另開終端：

```bash
curl http://localhost:5080/health
```

```json
{"status":"ok"}
```

`/health` 只確認處理序能夠回應 HTTP，**沒有檢查資料庫和身分服務**。需要檢查這些依賴時，可以進一步使用 ASP.NET Core 健康檢查功能。

::: warning 使用本章自己的資料庫
本章從新的 `todos-23.db` 開始，使用遷移建立表。不要把第 15～22 章透過 `EnsureCreated` 建立的資料庫直接拿來執行遷移；這兩種建表方式不能直接混用。有舊資料需要升級時，先讀[資料庫遷移](../advanced/efcore-migrations)。
:::

## 發佈程式與建立映象

**發佈**（publish）會收集執行應用程式需要的程式集和設定；**容器映象**（container image）還包含執行階段與作業系統基礎檔案。容器從映象啟動，資料另外儲存。

普通發佈可以這樣做：

```bash
dotnet publish -c Release -o ./publish
```

輸出目錄中的 `Deployment.dll` 可以在安裝了相應 ASP.NET Core 執行階段的機器上透過 `dotnet Deployment.dll` 啟動。發佈產物不會自動使用 `launchSettings.json` 的開發環境設定，正式執行前要提供下文的身分驗證設定。

本章用 .NET SDK 直接建立 Linux x64 映象，無需另外維護 Dockerfile：

```bash
dotnet publish -c Release --os linux --arch x64 /t:PublishContainer
```

這條指令預設把 `todo-api:chapter23` 寫入本機容器執行階段。後續步驟需要已啟動的 Docker，並使用 Linux 容器。目標機器是 ARM64 時，把 `x64` 改成 `arm64`，在相應機器上執行。

映象基於 `mcr.microsoft.com/dotnet/aspnet:10.0`，應用程式以非 root 使用者執行。本範例使用的預設使用者 ID 是 `1654`。SDK 也支援直接推送到映象儲存庫或產生歸檔，見[官方容器發佈說明](https://learn.microsoft.com/en-us/dotnet/core/containers/sdk-publish)。

## 設定正式環境

完整 Compose 設定如下。**Docker Compose** 用一個檔案描述要啟動的容器、環境變數和資料卷：

<<< @/../samples/23-deployment/compose.yaml{yaml:line-numbers} [compose.yaml]

其中三個服務各有一個任務：`init-data` 準備資料目錄權限，`migrate` 升級資料庫後退出，`api` 持續提供 HTTP 服務。

複製環境變數模板：

::: code-group

```powershell [PowerShell]
Copy-Item .env.example .env
```

```bash [Bash]
cp .env.example .env
```

:::

<<< @/../samples/23-deployment/.env.example{dotenv:line-numbers} [.env.example]

把 `.env` 中的佔位值換成自己的設定：

| 設定 | 填什麼 |
| --- | --- |
| `Authority` | 可信身分服務的 HTTPS 地址，它需要提供 JWT 驗證所需的中繼資料和公鑰 |
| `Audience` | 身分服務為這個 API 設定的受眾標識 |
| `Cors__Origins__0` | 允許讀取 API 的前端源，例如 `https://todo.example.com`，末尾不加 `/` |

環境變數裡的雙下劃線對應設定路徑的冒號。資料庫連線字串由 Compose 單獨設定為 `/data/todos.db`，不依賴容器的工作目錄。

::: warning 開發權杖不能拿去正式上線
`dotnet user-jwts` 用於本機開發。本章的生產設定改為信任身分服務簽發的存取權杖。你需要從該服務獲取面向此 API 的權杖；寫入操作還要求伺服器端識別到 `editor` 角色。不同服務的角色 claim 可能不同，要按其格式設定角色對應。

保留模板中的佔位地址可以檢查 `/health` 和匿名請求的 401，但不能完成有效權杖的身分驗證。這不代表身分服務已經接通。
:::

正式環境如果沒有 HTTPS `Authority` 或沒有 `Audience`，範例會拒絕啟動並提示缺少設定。這個檢查只驗證設定是否齊全，不證明遠端身分服務可用。

## 建立資料庫，再啟動 API

仍在 `samples/23-deployment` 目錄執行：

```bash
docker compose run --rm init-data
docker compose run --rm migrate
docker compose up -d api
```

`init-data` 只以 root 身分調整資料目錄的所有權；遷移和 API 都用普通使用者執行。遷移成功後，再啟動 API，避免使用者請求碰到還沒更新完的表。

遷移使用 `MigrateAsync()` 應用程式尚未執行的變更，已執行過的遷移不會重複執行。本章儲存庫已包含兩個遷移：建立初始表，再給 Todo 增加可空的 `Note` 列。這個列用於演示升級，暫未加入 HTTP 請求和回應。遷移檔案與升級驗證見[資料庫遷移](../advanced/efcore-migrations)。

檢查執行結果：

```bash
curl http://localhost:5080/health
curl -i http://localhost:5080/todos
curl -i http://localhost:5080/openapi/v1.json
curl -i http://localhost:5080/scalar
```

| 請求 | 預期 |
| --- | --- |
| `/health` | 200，回應本文為 `{"status":"ok"}` |
| `/todos`，不帶權杖 | 401 |
| `/openapi/v1.json` | 404 |
| `/scalar` | 404 |

OpenAPI 和 Scalar 只在 Development 環境註冊。Production 環境仍保留錯誤處理中介軟體，不會把開發者例外狀況頁暴露給呼叫方。

## 讓資料跟著應用程式升級保留下來

Compose 把命名資料卷 `todo-data` 掛載到 `/data`。替換容器時，資料庫留在卷裡，新的容器繼續使用它。

用身分服務簽發的 `editor` 權杖呼叫上一章的建立 API，記下回傳的任務 ID。然後重建容器：

```bash
docker compose up -d --force-recreate api
```

再帶權杖查詢 `/todos/{id}`，應能讀到之前的任務。`docker compose down` 停止並移除容器，但預設保留命名卷；**不要給它加 `--volumes` 或 `-v`，除非確定要刪除資料。**

升級程式時，先備份資料庫，再重新發佈映象；停止 API 後執行遷移，最後重新建立 API 容器。本例只有一個 API 執行個體，這會造成短暫不可用。SQLite 備份需要覆蓋一致的資料狀態，可以停止寫入後備份，也可以使用 SQLite 的備份機制，不能在寫入時隨手複製單個 `.db` 檔案就認為備份完成。

## 從本機驗證到公網執行

這裡的連接埠對應是 `127.0.0.1:5080:8080`，只允許宿主機存取。把映象和 Compose 設定放到有 Docker 的伺服器後，在同一臺機器的反向代理上設定域名與 HTTPS，再把請求轉發到 `127.0.0.1:5080`。前端的實際源也要加入 CORS 設定。

如果代理改變了請求的協議、主機名或用戶端地址，應用程式需要按[代理與轉發頭文件](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0)設定受信任的代理。不要無條件信任公網發來的轉發頭。

Cloudflare Pages 託管的是本教學產生的靜態網頁，不能直接執行這個 ASP.NET Core API。API 需要能執行 .NET 或容器的主機。

排查啟動問題可以用：

```bash
docker compose ps
docker compose logs --tail 100 api
docker compose logs --tail 100 migrate
```

| 現象 | 先檢查 |
| --- | --- |
| API 啟動時報告身分驗證設定缺失 | `.env` 是否存在，Authority 與 Audience 是否填寫 |
| SQLite 無法開啟檔案或唯讀 | 資料卷掛載路徑，以及 `init-data` 是否成功 |
| 帶權杖仍是 401 | 簽發者、受眾、簽名、有效期和身分服務中繼資料是否匹配 |
| 可以查詢，但寫入回傳 403 | 權杖裡的角色能否對應為 `editor` |

## 自動驗證發佈前的行為

```bash
dotnet test --project Tests/TodoApi.Tests.csproj -c Release -p:TreatWarningsAsErrors=true
```

本章共 13 個測試用例：上一章的 11 個，再加正式環境行為和保留舊資料的遷移測試。CI 還會建立映象、啟動 Compose、重建容器，並確認資料庫中的記錄沒有丟失。

::: fastapi FastAPI 對照
這和把 FastAPI 應用程式放進容器類似：程式在映象裡，環境設定在外部，持久資料放在資料卷中。容器不會替你完成身分驗證設定和資料庫升級。
:::

## 總結

- 發佈產物攜帶程式，生產設定透過環境變數提供；開發啟動設定不會自動用於正式執行。
- .NET SDK 可以直接建立容器映象，應用程式用普通使用者執行。
- 先執行資料庫遷移，再啟動 API；升級前備份真實資料。
- SQLite 檔案放在資料卷中，重建容器後仍然保留。
- 存活檢查成功只是第一步，還要驗證身分驗證、授權、資料持久化和公網 HTTPS。

上一章：[依功能組織專案](./project-structure)。主線到這裡結束，下一步可以按需要閱讀[進階主題](../advanced/)。
