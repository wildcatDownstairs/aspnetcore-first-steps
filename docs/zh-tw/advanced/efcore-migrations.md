---
title: 資料庫遷移
description: 透過 EF Core 遷移給已有的 Todo 表增加欄位，並驗證升級保留舊資料。
---

# 資料庫遷移

第 15 章用 `EnsureCreated()` 快速建立練習資料庫。等應用程式已有資料，再給實體增加屬性時，它不會替你修改現有表。這時需要**遷移**（migration）：把一次表結構變化記錄為可以審查、提交和執行的程式碼。

第 23 章已經包含完整範例。這裡是給 `Todos` 表增加 `Note` 列的遷移檔案，由 EF Core 工具產生：

<<< @/../samples/23-deployment/Data/Migrations/20260926115641_AddTodoNote.cs{cs:line-numbers} [AddTodoNote.cs]

對應的實體完整檔案：

<<< @/../samples/23-deployment/Features/Todos/Todo.cs{cs:line-numbers} [Features/Todos/Todo.cs]

`Up` 描述升級，`Down` 描述撤銷。本次增加可空列，因此已有任務的 `Note` 是 `null`。撤銷這個遷移會刪掉整列，已經寫入的備註也會丟失；回退結構不等於恢復資料。

## 執行儲存庫中的遷移

從儲存庫根目錄執行：

```bash
cd samples/23-deployment
dotnet tool restore
dotnet ef migrations list
dotnet ef database update
```

本章用本地工具清單固定 `dotnet-ef` 的版本。第一次更新新的 `todos-23.db` 時會執行 `InitialCreate` 和 `AddTodoNote` 兩個遷移，建立類別和任務表，並加入兩個固定類別。再次執行不會重複建表。

工具輸出帶時間戳的遷移名稱；完整名稱以 `Data/Migrations` 中的檔案為準。資料庫中的 `__EFMigrationsHistory` 表記錄哪些遷移已經成功應用程式。

::: warning 不要重複產生儲存庫裡已有的遷移
`InitialCreate` 和 `AddTodoNote` 已經提交在範例中，直接執行即可。只有你再次修改實體結構時，才需要使用 `dotnet ef migrations add` 產生新的遷移，然後審查產生的檔案。
:::

工具透過設計時工廠建立上下文，不需要先啟動 API 或設定生產身分服務：

<<< @/../samples/23-deployment/Data/TodoDbContextFactory.cs{cs:line-numbers} [Data/TodoDbContextFactory.cs]

這裡的**設計時**（design time）指執行 EF 指令產生或應用程式遷移的階段。正常處理 HTTP 請求時，應用程式仍從相依性注入容器取得上下文。

## 怎麼確認舊資料還在

不能只看到遷移指令成功，就認為升級沒有影響資料。下面的完整測試先建立舊錶、插入任務，再執行新增列的遷移：

<<< @/../samples/23-deployment/Tests/MigrationTests.cs{18-26 cs:line-numbers} [Tests/MigrationTests.cs]

從本章範例目錄執行：

```bash
dotnet test --project Tests/TodoApi.Tests.csproj -c Release -p:TreatWarningsAsErrors=true
```

總計 13 個測試應全部透過。遷移測試確認舊任務和類別仍然存在、新列初始為 `null`；隨後寫入備註，再次執行遷移，確認不會重複建立記錄或清掉備註。

## 後續修改資料庫的順序

1. 修改實體或模型設定，讓它表達新的結構。
2. 用 `dotnet ef migrations add` 加上描述本次變化的名稱，產生遷移。
3. 審查 `Up`、`Down` 和模型快照，再在測試資料庫上驗證。工具看到“舊列消失、新列出現”時，產生的操作不一定就是你想要的重新命名。
4. 把遷移檔案與應用程式程式碼一起提交；正式執行前備份資料，安排升級時機。

模型快照儲存上次遷移後的模型，工具透過比較它與目前模型產生下一次變更。不要手動刪除快照來“修復”不一致。

第 23 章用獨立的 `--migrate` 指令執行升級，成功後才啟動服務。真實系統還可以審查 SQL 指令碼或使用遷移 bundle；部署方式和資料庫提供者會影響可選方案，參見[官方遷移應用程式說明](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying)。

## 已有 EnsureCreated 資料庫怎麼辦

`EnsureCreated()` 不建立遷移歷史。直接對這樣的資料庫執行 `InitialCreate`，通常會因為表已存在而失敗。

本教學讓第 23 章使用獨立的新檔案，不會覆蓋前面章節的資料。如果舊庫有需要保留的內容，先備份，再製定資料匯入或建立遷移基線的方案，並在副本上演練；不要靠刪除舊庫、偽造遷移記錄來跳過這一步。兩者的適用範圍見[官方建表說明](https://learn.microsoft.com/en-us/ef/core/managing-schemas/ensure-created)。

## 總結

- 遷移記錄表結構如何變化；`EnsureCreated` 只適合不需要遷移的建庫場景。
- 修改模型後產生遷移，審查後再執行，遷移和快照要一起提交。
- 用已有記錄驗證升級，不能只測試空資料庫。
- 新增可空列可以保留舊行，但刪除列等操作仍會丟資料。
- 正式升級前備份，並把升級安排在應用程式開始使用新結構之前。

回傳：[發佈與部署](../tutorial/deployment)。繼續閱讀：[進階主題](./)。
