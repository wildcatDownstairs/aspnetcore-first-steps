---
title: 設定與 Options
description: 用 appsettings.json、環境變數、命令列和 User Secrets 提供設定，理解它們的覆蓋順序；用 Options 模式把設定繫結到強型別的類別並在啟動時驗證。
---

# 設定與 Options

假設開發環境每頁顯示 5 條 Todo，部署後要改成 20 條。這個值可以放在設定裡，修改時就不必重新編譯程式碼。

本章用 **Options 模式**（options pattern）把這組設定讀進 `TodoOptions` 類別，透過屬性存取，並檢查條數是否在允許範圍內。

<<< @/../samples/12-configuration/Program.cs{8-11,21-30,34-45 cs:line-numbers} [12-configuration/Program.cs]

設定的值寫在專案根目錄的 `appsettings.json` 中，高亮部分是本節新增的 `Todo` 設定節：

<<< @/../samples/12-configuration/appsettings.json{9-12 json:line-numbers} [12-configuration/appsettings.json]

## 執行與驗證

先停止上一章的服務，從儲存庫根目錄執行：

```bash
cd samples/12-configuration
dotnet run
```

```bash
curl http://localhost:5080/settings
```

```json
{"welcomeMessage":"Welcome to the Todo API (Development)","maxItems":5,"adminKeyConfigured":false}
```

注意歡迎語後面多了"(Development)"，而 `appsettings.json` 裡並沒有這幾個字。它來自另一個檔案：

<<< @/../samples/12-configuration/appsettings.Development.json{8-10 json:line-numbers} [12-configuration/appsettings.Development.json]

## 設定從哪裡來

ASP.NET Core 的設定由多個**設定源**（configuration source）疊加而成。`WebApplication.CreateBuilder` 預設按以下順序載入，**後載入的覆蓋先載入的**：

| 順序 | 設定源 | 典型用途 |
| --- | --- | --- |
| 1 | `appsettings.json` | 所有環境共用的預設值，提交到程式碼儲存庫 |
| 2 | `appsettings.{環境名}.json` | 某個環境特有的值，例如 `appsettings.Development.json` |
| 3 | User Secrets（僅開發環境） | 開發者本機的金鑰，不進程式碼儲存庫 |
| 4 | 環境變數 | 部署時由伺服器、容器、雲平臺注入 |
| 5 | 命令列參數 | 臨時覆蓋，除錯時方便 |

所以在開發環境中，`WelcomeMessage` 先從第 1 層讀到"Welcome to the Todo API"，又被第 2 層覆蓋了；`MaxItems` 只在第 1 層出現，保持為 5。

這樣可以把預設值留在檔案裡，部署時用環境變數覆蓋，臨時實驗再用命令列覆蓋。不必為了改一個值而複製整份設定檔案。

### 用環境變數覆蓋

下面每次切換啟動參數，都先按 `Ctrl+C` 停止服務，重新啟動後再用另一個終端請求 `/settings`。

環境變數用**雙下劃線** `__` 表示層級（因為有些系統的環境變數名不允許冒號）：

::: code-group

```bash [macOS / Linux]
Todo__MaxItems=20 dotnet run
```

```powershell [Windows PowerShell]
$env:Todo__MaxItems = "20"; dotnet run
```

:::

```json
{"welcomeMessage":"Welcome to the Todo API (Development)","maxItems":20,"adminKeyConfigured":false}
```

### 用命令列覆蓋

命令列參數用冒號表示層級，寫在 `--` 之後。它的優先順序比環境變數更高：

```bash
dotnet run -- --Todo:MaxItems=30
```

```json
{"welcomeMessage":"Welcome to the Todo API (Development)","maxItems":30,"adminKeyConfigured":false}
```

即使同時設定了環境變數 `Todo__MaxItems=20`，結果也是 30。

::: tip 提示
PowerShell 中設定的 `$env:` 變數會一直保留在目前終端視窗裡，影響之後每一次 `dotnet run`。試驗結束後用 `Remove-Item Env:Todo__MaxItems` 刪除它。
:::

## 繫結到強型別的類別

<<< @/../samples/12-configuration/Program.cs{8-11,34-45 cs:line-numbers} [12-configuration/Program.cs]

第 34～45 行的 `TodoOptions` 是一個一般類別，屬性名和 `appsettings.json` 中 `Todo` 節裡的鍵一一對應。第 8～11 行做了三件事：

1. `AddOptions<TodoOptions>()`：準備這個型別的 Options 服務，之後透過 `IOptions<TodoOptions>` 獲取設定；
2. `BindConfiguration("Todo")`：把設定中 `Todo` 節的值**繫結**到這個類別的屬性上。第 36 行的常數 `SectionName` 讓設定節的名字只出現一次；
3. `ValidateDataAnnotations()` 和 `ValidateOnStart()`：用第 38、41 行的資料註解驗證設定，並且在**啟動時**就執行驗證。

使用時，處理常式宣告一個 `IOptions<TodoOptions>` 參數（第 21 行），透過 `.Value` 取得繫結好的物件。

設定只有一兩項時，也可以直接讀取 `builder.Configuration["Todo:MaxItems"]`。這裡把相關設定放進一個類別，是為了統一轉換型別和檢查範圍，使用時寫 `settings.MaxItems` 就能得到整數。

編輯器能檢查 C# 屬性名，但檢查不了 JSON 裡的鍵名。設定鍵拼錯可能讓屬性保留預設值，因此仍需要驗證。

### 在啟動時發現設定錯誤

如果設定的值不合法，比如把 `MaxItems` 設為 0：

```bash
dotnet run -- --Todo:MaxItems=0
```

應用程式**根本不會啟動**：

```text
fail: Microsoft.Extensions.Hosting.Internal.Host[11]
      Hosting failed to start
      Microsoft.Extensions.Options.OptionsValidationException: DataAnnotation validation failed for 'TodoOptions' members: 'MaxItems' with the error: 'The field MaxItems must be between 1 and 100.'.
```

`ValidateOnStart()` 讓設定錯誤在啟動時暴露。去掉它，驗證通常要等第一次讀取 `.Value` 才執行，可能到某個請求進來時才發現設定有誤。

::: info 技術細節
`IOptions<T>` 快取設定物件，修改 JSON 後需要重新啟動應用程式才能讀到新值。需要動態更新時，還有 `IOptionsSnapshot<T>`（在每個作用域首次存取時建立快照）和 `IOptionsMonitor<T>`（支援設定變化通知）；本章先使用 `IOptions<T>`。
:::

::: fastapi FastAPI 對照
Options 模式相當於 pydantic-settings：用一個類別宣告設定項和型別，從檔案和環境變數中讀取，並做驗證。FastAPI 中通常用 `Depends(get_settings)` 注入設定物件，這裡則是注入 `IOptions<TodoOptions>`。
:::

## 用 User Secrets 儲存金鑰

`TodoOptions.AdminKey`（第 44 行）模擬第三方服務的金鑰。不要把真實金鑰寫進會提交到儲存庫的 `appsettings.json`。

開發時的金鑰應該用 **User Secrets**（使用者機密）儲存。先在專案目錄下初始化：

```bash
dotnet user-secrets init
```

這個指令會在 `.csproj` 中加入一個 `<UserSecretsId>`，它是一個隨機的 GUID，用來標識這個專案的機密儲存。範例專案已經包含這一行，所以你可以跳過這一步。然後設定一個值：

```bash
dotnet user-secrets set "Todo:AdminKey" "s3cr3t-for-demo"
```

```text
Successfully saved Todo:AdminKey to the secret store.
```

重新執行後，`adminKeyConfigured` 變成了 `true`：

```json
{"welcomeMessage":"Welcome to the Todo API (Development)","maxItems":5,"adminKeyConfigured":true}
```

機密儲存在使用者目錄中，不隨專案提交到 Git。用 `dotnet user-secrets list` 檢視；實驗後用 `dotnet user-secrets remove "Todo:AdminKey"` 刪除這一項，不影響其他金鑰。

`/settings` 只回傳是否設定了金鑰，方便驗證來源；不會把伺服器端金鑰回傳給用戶端。

::: warning 注意
User Secrets 預設只在開發環境載入，而且以明文儲存。本例切到正式環境後，如果沒有從其他設定源提供 `AdminKey`，`adminKeyConfigured` 才是 `false`。部署時應從環境變數或金鑰管理服務提供金鑰。
:::

## 總結

- 設定由多個源疊加：`appsettings.json` → `appsettings.{環境}.json` → User Secrets（僅開發）→ 環境變數 → 命令列，**後面的覆蓋前面的**。
- 環境變數用 `__` 表示層級（`Todo__MaxItems`），命令列用 `:`（`--Todo:MaxItems=30`）。
- **Options 模式**：`AddOptions<T>().BindConfiguration("節名")` 把設定繫結到強型別的類別，處理常式注入 `IOptions<T>` 使用。
- 用資料註解加 `ValidateOnStart()` 驗證設定，不合法的設定會讓應用程式**啟動失敗**，而不是在執行中出錯。
- 金鑰不進程式碼儲存庫：開發時用 User Secrets，正式環境用環境變數或金鑰管理服務。

下一章：[中介軟體](./middleware)——理解請求經過的處理管道。上一章：[相依性注入](./dependency-injection)。
