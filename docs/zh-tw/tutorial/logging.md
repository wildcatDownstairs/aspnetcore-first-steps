---
title: 記錄
description: 透過相依性注入獲取 ILogger<T>，用訊息模板寫出結構化記錄；理解記錄級別和類別，並在設定中按類別控制輸出。
---

# 記錄

上一章用 `Console.WriteLine` 看執行順序。記錄一多，我們就會想只看某個類的輸出，或者暫時開啟除錯資訊。這些事可以交給 `ILogger`。

本章還會把 Todo 編號作為獨立欄位保留下來，讓記錄工具能直接按編號搜尋。這叫**結構化記錄**（structured logging）。

<<< @/../samples/14-logging/Program.cs{19,24,48,58,71 cs:line-numbers} [14-logging/Program.cs]

範例沿用了「相依性注入」一章的 `ITodoStore`，並且在處理常式和儲存服務中都寫了記錄。開發環境的設定檔案中加了一行：

<<< @/../samples/14-logging/appsettings.Development.json{6 json:line-numbers} [14-logging/appsettings.Development.json]

## 執行與驗證

先停止上一章的服務，從儲存庫根目錄執行：

```bash
cd samples/14-logging
dotnet run
```

建立一個待辦事項，查詢它，再查詢一個不存在的：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'
curl http://localhost:5080/todos/1
curl http://localhost:5080/todos/99
```

執行服務的終端中，啟動資訊之後會出現：

```text
info: InMemoryTodoStore[0]
      Created Todo 1 with title: Buy milk
dbug: InMemoryTodoStore[0]
      Looking up Todo 1; 1 item(s) currently exist
dbug: InMemoryTodoStore[0]
      Looking up Todo 99; 1 item(s) currently exist
warn: Program[0]
      Todo 99 not found
```

每條記錄的第一行由三部群組成：`info` / `dbug` / `warn` 是**級別**，`InMemoryTodoStore`、`Program` 是**類別**，方括號裡的 `0` 是事件編號（本節沒有用到）。第二行是記錄訊息。

## 獲取 ILogger

<<< @/../samples/14-logging/Program.cs{19,48 cs:line-numbers} [14-logging/Program.cs]

記錄記錄器是一個服務，獲取方式和「相依性注入」一章完全一樣：

- 第 19 行，處理常式宣告了一個 `ILogger<Program>` 參數；
- 第 48 行，`InMemoryTodoStore` 在建構函式中宣告了 `ILogger<InMemoryTodoStore>`。類名後面的括號是 C# 12 引入的**主建構函式**（primary constructor），參數 `logger` 在整個類中都可以使用。

記錄服務由框架預先註冊好，你不需要呼叫任何 `AddXxx()`。

尖括號中的型別決定記錄的**類別**（category）。本例中就是 `Program` 和 `InMemoryTodoStore`，可以據此分辨來源、單獨調整輸出級別。`Program` 是編譯器為最上層陳述式產生的類名。

## 記錄級別

.NET 的記錄分為六個級別，從低到高：

| 級別 | 方法 | 用途 |
| --- | --- | --- |
| Trace | `LogTrace` | 最詳細的跟蹤資訊，通常只在排查特定問題時開啟 |
| Debug | `LogDebug` | 開發除錯時有用的資訊 |
| Information | `LogInformation` | 應用程式正常執行中的重要事件，比如"建立了一個待辦事項" |
| Warning | `LogWarning` | 不正常但不影響執行的情況，比如"找不到請求的資源" |
| Error | `LogError` | 目前操作失敗了，比如未處理的例外狀況 |
| Critical | `LogCritical` | 整個應用程式面臨崩潰，比如磁碟寫滿 |

本例把建立記為 Information、查詢過程記為 Debug、找不到記為 Warning，方便比較輸出。普通的“資源不存在”未必值得警告，實際專案可以用更低階別。正式環境也常需要 Information 來觀察業務活動，不必一律只保留 Warning。

## 按類別控制輸出

`appsettings.json` 中的 `Logging:LogLevel` 為每個類別設定了**最低階別**，低於它的記錄會被丟棄：

| 鍵 | 值 | 含義 |
| --- | --- | --- |
| `Default` | `Information` | 沒有單獨設定的類別，只輸出 Information 及以上 |
| `Microsoft.AspNetCore` | `Warning` | 框架內部的記錄只輸出 Warning 及以上，避免刷屏 |
| `InMemoryTodoStore` | `Debug` | 本節加在開發環境設定中，讓儲存服務輸出 Debug 記錄 |

類別按字首匹配；有多個匹配時，更具體的字首優先。`Microsoft.AspNetCore` 可以為它下面的 Routing 等類別設定預設級別，再用更具體的類別覆蓋。

這就是為什麼 Debug 記錄只在開發環境中出現。以正式環境執行階段（沒有載入 `appsettings.Development.json`），同樣的三個請求只會輸出：

```text
info: InMemoryTodoStore[0]
      Created Todo 1 with title: Buy milk
warn: Program[0]
      Todo 99 not found
```

排查問題時，可以在啟動應用程式前用環境變數覆蓋級別，不必修改程式碼。例如 `Logging__LogLevel__Default=Debug` 會改變預設規則，但不會覆蓋更具體的類別規則。修改環境變數後，需要重新啟動處理序才能讀到新值。

## 訊息模板

<<< @/../samples/14-logging/Program.cs{24,71 cs:line-numbers} [14-logging/Program.cs]

注意記錄訊息的寫法：`"Todo {TodoId} not found"`，後面跟著參數 `id`。它**不是**字串插值（前面沒有 `$`），而是一個**訊息模板**（message template）：花括號裡是**佔位符的名字**，參數按順序填入。

普通控制檯輸出看不出欄位有沒有保留。停止目前服務，改用 JSON 格式啟動，再檢視同一條記錄：

```bash
dotnet run -- --Logging:Console:FormatterName=json --Logging:Console:FormatterOptions:JsonWriterOptions:Indented=true
```

請求 `/todos/99` 後，Warning 記錄如下：

```json
{
  "EventId": 0,
  "LogLevel": "Warning",
  "Category": "Program",
  "Message": "Todo 99 not found",
  "State": {
    "TodoId": 99,
    "{OriginalFormat}": "Todo {TodoId} not found"
  }
}
```

`State.TodoId` 是數字 `99`，可以交給記錄平臺按欄位檢索。若先用 `$"Todo {id} not found"` 拼好字串，記錄系統拿到的就只有整句話，需要另外解析才能提取編號。

::: warning 注意
這裡應把 `id` 作為單獨參數傳給記錄方法，保留 `TodoId` 欄位。字串插值會提前拼接文字，即使這條記錄最終被過濾掉，也已經做了這一步工作。
:::

::: tip 提示
佔位符的名字用 PascalCase，並且在整個應用程式中保持一致。例如所有涉及待辦事項編號的記錄都用 `{TodoId}`，這樣在記錄平臺裡用一個欄位名就能查到全部相關記錄。
:::

::: fastapi FastAPI 對照
Python 的 `logging` 模組中 `logger.warning("Todo %s not found", id)` 也是延遲格式化，但預設不保留結構化欄位。ASP.NET Core 的 `ILogger` 從一開始就是結構化的，不需要額外的庫。
:::

::: info 技術細節
對於呼叫非常頻繁的記錄，可以使用 `[LoggerMessage]` 特性配合原始碼產生器，在編譯時產生高效能的記錄方法，進一步避免裝箱和解析模板的開銷。對於本教學的規模，直接呼叫 `LogInformation` 等方法已經足夠。
:::

## 總結

- 透過相依性注入獲取 `ILogger<T>`，`T` 決定記錄的**類別**，記錄服務由框架預先註冊。
- 六個**級別**從 Trace 到 Critical，分別用於詳細跟蹤、除錯資訊、正常事件和不同程度的錯誤。
- `Logging:LogLevel` 為每個類別設定最低輸出級別，按字首匹配；不同環境的設定檔案讓開發時更詳細、生產時更簡潔。
- 使用**訊息模板**（`"… {TodoId}", id`）而不是字串插值，佔位符會成為可查詢的結構化欄位。

本章是「應用程式骨架」階段的最後一章。下一章：[EF Core 入門](./efcore-basics)——把記憶體儲存換成 SQLite 資料庫，重新啟動後資料仍然保留。上一章：[中介軟體](./middleware)。
