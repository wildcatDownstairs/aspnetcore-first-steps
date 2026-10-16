---
title: 依功能組織專案
description: 用 feature-first 組織 Todo API，讓同一功能的實體、DTO、服務和端點放在一起，並用測試確認重構不改變 API 行為。
---

# 依功能組織專案

現在 `Program.cs` 裡有啟動設定、身分驗證和整套 CRUD。修改 Todo 時，要在這些不相關的程式碼之間來回找。這一章按功能拆分，也叫 **feature-first（依功能組織）**：同一功能的實體、DTO、服務和端點放在同一個目錄。

這是一次**重構**（refactoring）：API 路徑、請求欄位、回應內容和權限都不變。拆分後的入口檔案如下：

<<< @/../samples/22-project-structure/Program.cs{3-5,14-15,35-37 cs:line-numbers} [Program.cs]

其餘完整檔案按功能列在下面；範例可獨立執行，不引用上一章的專案。

:::: details Todo 功能的完整檔案
::: code-group

<<< @/../samples/22-project-structure/Features/Todos/TodoEndpoints.cs{7-14 cs:line-numbers} [Features/Todos/TodoEndpoints.cs]

<<< @/../samples/22-project-structure/Features/Todos/TodoService.cs{7-14,17-24 cs:line-numbers} [Features/Todos/TodoService.cs]

<<< @/../samples/22-project-structure/Features/Todos/TodoDtos.cs{cs:line-numbers} [Features/Todos/TodoDtos.cs]

<<< @/../samples/22-project-structure/Features/Todos/Todo.cs{cs:line-numbers} [Features/Todos/Todo.cs]

:::
::::

:::: details 身分驗證與資料庫的完整檔案
::: code-group

<<< @/../samples/22-project-structure/Features/Auth/AuthConfiguration.cs{cs:line-numbers} [Features/Auth/AuthConfiguration.cs]

<<< @/../samples/22-project-structure/Features/Auth/AuthEndpoints.cs{cs:line-numbers} [Features/Auth/AuthEndpoints.cs]

<<< @/../samples/22-project-structure/Data/TodoDbContext.cs{cs:line-numbers} [Data/TodoDbContext.cs]

<<< @/../samples/22-project-structure/Data/TodoDatabase.cs{cs:line-numbers} [Data/TodoDatabase.cs]

:::
::::

## 先跑測試，再啟動應用程式

從儲存庫根目錄執行：

```bash
cd samples/22-project-structure
dotnet test --project Tests/TodoApi.Tests.csproj
```

仍然應是 **11 個透過、0 個失敗、0 個跳過**。測試請求和斷言與第 21 章相同；因為型別搬進了命名空間，測試只增加了匯入：

<<< @/../samples/22-project-structure/Tests/GlobalUsings.cs{cs:line-numbers} [Tests/GlobalUsings.cs]

手動執行階段，先停止其他章的服務，為本章產生開發權杖：

```bash
dotnet user-jwts create --name alice --role editor --valid-for 1h --output token
dotnet run
```

在另一個終端中，按[第 18 章](./authentication)的方式將完整權杖存入 `TOKEN` 變數，再請求：

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5080/todos
```

首次執行階段，本章獨立的 `todos-22.db` 沒有任務，回傳 `[]`。第 17～20 章的建立、修改、刪除指令仍然適用。

## 先找功能，再找檔案

主要程式碼的目錄如下，設定和測試檔案也保留在本章專案中：

```text
22-project-structure/
├── Program.cs
├── Features/
│   ├── Todos/
│   │   ├── Todo.cs
│   │   ├── TodoDtos.cs
│   │   ├── TodoService.cs
│   │   └── TodoEndpoints.cs
│   └── Auth/
│       ├── AuthConfiguration.cs
│       └── AuthEndpoints.cs
├── Data/
│   ├── TodoDbContext.cs
│   └── TodoDatabase.cs
└── Tests/
```

例如給 Todo 增加一個可編輯欄位，先開啟 `Features/Todos`，在這裡找到儲存屬性、輸入輸出型別和處理邏輯。不要先到全域性 Models 找實體，再到 Services 找服務，最後到 Endpoints 找路由。

組織方式參考 [mini-store-api](https://github.com/wildcatDownstairs/mini-store-api)：實體、DTO、Service、Endpoints 歸所屬功能，共享上下文留在 Data。這裡的分類只有兩個固定值，屬於 Todo 功能，還不需要單獨建立一個 Categories 模組。

## 每個檔案負責什麼

| 檔案 | 放什麼 | 修改範例 |
| --- | --- | --- |
| `Todo.cs` | Todo 和 Category 實體 | 增加要存入資料庫的屬性 |
| `TodoDtos.cs` | 請求、回應以及本功能的操作結果型別 | 調整用戶端可以提交的欄位 |
| `TodoService.cs` | 查詢、分類存在性檢查和儲存操作 | 修改任務的業務規則 |
| `TodoEndpoints.cs` | 路由、權限、參數接收和 HTTP 結果 | 調整路徑或寫入權限 |
| `TodoDbContext.cs` | 共享的表入口和資料庫對應 | 設定實體關聯 |
| `Program.cs` | 註冊服務、安排中介軟體、掛載功能 | 新增一個新的功能入口 |

`TodoService` 不接收 `HttpContext`，也不決定回傳 400 還是 404。例如替換操作回傳 `ReplaceOutcome`，端點再對應為 HTTP 結果。這裡的 **enum（列舉）** 只是給“更新成功、任務不存在、分類不存在”三個結果起名字，避免用數字猜含義。

請求欄位驗證仍由端點上的內建驗證完成；分類是否存在仍由服務查詢資料庫。移動檔案沒有改變這兩項檢查的職責。

## MapTodoEndpoints 怎樣接回 Program

`TodoEndpoints` 是一個靜態類別。`MapTodoEndpoints` 的第一個參數寫成 `this WebApplication app`，這是**擴充方法**（extension method）：於是入口可以寫 `app.MapTodoEndpoints()`，裡面仍然是熟悉的 `MapGroup`、`MapGet`、`MapPost`。

處理方法可以直接作為參數傳給 `MapGet` 等方法，不必都寫成長 lambda。第 11 行的 `GetAsync` 就是本檔案裡的方法名。[Minimal API 路由處理方法](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis/route-handlers?view=aspnetcore-10.0)

`namespace TodoApi.Features.Todos;` 是**命名空間**（namespace）宣告，用來區分型別所屬位置。入口透過 `using TodoApi.Features.Todos` 使用這些型別和擴充方法。目錄與命名空間保持對應，便於查詢；C# 不要求二者必須一致。

::: info 技術細節
C# 14 也支援擴充成員塊。本章保留 `this` 參數的擴充方法寫法，它仍然受支援，而且這裡只需定義一個方法，不必額外引入新的語法結構。
:::

## 為什麼共享 DbContext 留在 Data

業務實體歸功能所有，但一個請求可能同時修改多個功能的資料。共享上下文讓這些操作有機會在一次儲存或同一個事務中完成。按功能分目錄，並不要求一個目錄配一個資料庫。

`TodoService` 註冊為 Scoped，和上下文的預設生命週期一致。目前專案只有一個實作，直接注入這個具體類別即可；本章沒有為它額外增加 `ITodoService` 或 Repository。

也不需要先建立一個空的 Common 目錄。確實出現多個功能共用的程式碼時，再判斷它是否適合提取。本章保留 CORS 設定在入口，是因為它服務於整個 API。

## 拆分是否值得

這個 Todo API 直接在端點裡使用 DbContext 也能工作。這裡提取 Service，是為了演示 mini-store-api 中“端點決定 HTTP 回應，服務完成業務操作”的組織方式；它不是 Minimal API 的硬性要求。

一個新功能只有兩條簡單查詢時，可以先把端點和相關型別放在功能目錄裡。業務規則變多、需要複用時，再把操作提取到 Service。目錄是為了縮小查詢範圍，不是要求每個功能必須湊齊相同數量的檔案。

::: fastapi FastAPI 對照
這類似按業務套件組織 router、schema 和業務函式，再在應用程式入口註冊 router。ASP.NET Core 這裡透過擴充方法掛載端點，透過相依性注入提供服務。
:::

## 總結

- feature-first 把同一功能的實體、DTO、服務和端點放在一起。
- 端點負責 HTTP 和權限，服務處理資料與業務規則，共享上下文留在 Data。
- 擴充方法把功能路由接回入口；Program.cs 保留啟動設定和中介軟體順序。
- 不為目錄形式補空檔案，也不強制給單個實作增加介面層。
- 用上一章相同的請求與斷言驗證重構，保持 API 行為不變。

下一章：[發佈與部署](./deployment)——把整理好的應用程式發佈出去。上一章：[測試](./testing)。
