---
title: FastAPI ↔ ASP.NET Core 對照速查
description: 為有 FastAPI 經驗的開發者準備的概念對照表，幫你快速找到 ASP.NET Core Minimal API 中的等價寫法。
prev: false
next: false
pageClass: page-cheatsheet
---

# FastAPI ↔ ASP.NET Core 對照速查

如果你寫過 FastAPI，會發現 ASP.NET Core Minimal API 的很多想法是相通的：用函式定義端點、用型別宣告參數、自動產生 OpenAPI 文件。這張表幫你把已有的知識"翻譯"過來。

::: warning 注意
對照只是幫助理解的類比，並不代表兩者行為完全一致。表中標註了差異較大的地方，詳細內容請閱讀對應章節。
:::

## 專案與工具

| FastAPI / Python | ASP.NET Core / .NET | 說明 | 章節 |
| --- | --- | --- | --- |
| `python` + `pip` + `venv` | `dotnet` 命令列 | 一個工具覆蓋執行、相依套件管理和建置，無需虛擬環境 | [環境準備](/zh-tw/tutorial/setup) |
| `pyproject.toml` | `.csproj` 專案檔案 | 宣告目標框架與相依套件 | [環境準備](/zh-tw/tutorial/setup) |
| PyPI | NuGet | 套件儲存庫 | [環境準備](/zh-tw/tutorial/setup) |
| `pip install xxx` | `dotnet add package Xxx` | 新增相依套件 | [第一步](/zh-tw/tutorial/first-steps) |
| uvicorn | Kestrel | Web 伺服器；Kestrel 內建在程式中，無需單獨啟動 | [第一步](/zh-tw/tutorial/first-steps) |
| `fastapi dev` / `uvicorn --reload` | `dotnet watch` | 開發時自動重新載入；支援熱套用的改動無需重新啟動處理序 | [開發工具附錄](/zh-tw/tutorial/development-tools) |

## 定義端點

| FastAPI / Python | ASP.NET Core / .NET | 說明 | 章節 |
| --- | --- | --- | --- |
| `app = FastAPI()` | `builder` + `app = builder.Build()` | .NET 分為"註冊服務"和"處理請求"兩個階段 | [第一步](/zh-tw/tutorial/first-steps) |
| `@app.get("/")` | `app.MapGet("/", ...)` | 呼叫方法註冊端點，而不是用裝飾器 | [第一步](/zh-tw/tutorial/first-steps) |
| 回傳 `dict` | 回傳匿名型別 `new { ... }` 或 `record` | 自動序列化為 JSON，屬性名轉為 camelCase | [第一步](/zh-tw/tutorial/first-steps) |
| `/docs` | `/scalar`（Scalar.AspNetCore） | 互動式文件；.NET 中產生與展示分屬兩個套件 | [第一步](/zh-tw/tutorial/first-steps) |
| `/openapi.json` | `/openapi/v1.json` | OpenAPI 文件，.NET 10 預設產生 OpenAPI 3.1 | [第一步](/zh-tw/tutorial/first-steps) |

## 請求參數

| FastAPI / Python | ASP.NET Core / .NET | 說明 | 章節 |
| --- | --- | --- | --- |
| `/items/{item_id}` + `item_id: int` | `/items/{id:int}` + `int id` | 同名繫結、型別轉換 | [路由參數](/zh-tw/tutorial/path-params) |
| 按宣告順序匹配路由 | 按優先順序匹配路由 | **差異**：.NET 中註冊順序不影響匹配結果 | [路由參數](/zh-tw/tutorial/path-params) |
| `{file_path:path}` | `{*path}` | 匹配包含 `/` 的剩餘路徑 | [路由參數](/zh-tw/tutorial/path-params) |
| 查詢參數 `q: str \| None = None` | `string? q` | 可空型別表示可選參數 | [查詢參數](/zh-tw/tutorial/query-params) |
| Pydantic 模型作為請求本文 | `record` 作為請求本文 | JSON 自動繫結到強型別物件 | [請求本文](/zh-tw/tutorial/request-body) |
| `Field(ge=1)` 等驗證 | 資料註解 + .NET 10 內建驗證 | | [參數驗證](/zh-tw/tutorial/validation) |
| `Header()` / `Cookie()` | `[FromHeader]` / `HttpRequest.Cookies` | .NET 沒有 `[FromCookie]` 特性，Cookie 從請求物件讀取 | [Header 與 Cookie](/zh-tw/tutorial/headers-cookies) |

## 回應與錯誤

| FastAPI / Python | ASP.NET Core / .NET | 說明 | 章節 |
| --- | --- | --- | --- |
| `response_model` | `TypedResults` 與 `Results<T1, T2>` | 型別化結果約束處理常式回傳值並提供文件中繼資料，不等同於 Pydantic 的執行階段回應驗證與過濾 | [回應型別](/zh-tw/tutorial/response-types) |
| `HTTPException` | `TypedResults.NotFound()`、ProblemDetails | | [狀態碼與錯誤處理](/zh-tw/tutorial/errors) |
| `APIRouter` | `app.MapGroup(...)` | 路由群組、公共字首 | [路由群組](/zh-tw/tutorial/route-groups) |

## 應用程式骨架

| FastAPI / Python | ASP.NET Core / .NET | 說明 | 章節 |
| --- | --- | --- | --- |
| `Depends()` | 相依性注入容器 `builder.Services` | .NET 內建完整的 DI 容器，有三種生命週期 | [相依性注入](/zh-tw/tutorial/dependency-injection) |
| `pydantic-settings` | 設定系統 + Options 模式 | appsettings.json、環境變數、User Secrets | [設定與 Options](/zh-tw/tutorial/configuration) |
| `@app.middleware("http")` | `app.Use(...)` 中介軟體 | 管道模型，順序很重要 | [中介軟體](/zh-tw/tutorial/middleware) |
| `logging` | `ILogger<T>` | 結構化記錄 | [記錄](/zh-tw/tutorial/logging) |

## 資料、安全與上線

| FastAPI / Python | ASP.NET Core / .NET | 說明 | 章節 |
| --- | --- | --- | --- |
| SQLAlchemy / SQLModel | EF Core | ORM；`DbContext` 跟蹤並儲存實體變化 | [EF Core 入門](/zh-tw/tutorial/efcore-basics) |
| relationship / 查詢表示式 | 導航屬性、LINQ、`Include` | 區分關聯宣告、投影和關聯物件載入 | [關聯與查詢](/zh-tw/tutorial/relations-queries) |
| Session 中修改實體並提交 | 跟蹤實體 + `SaveChangesAsync()` | 輸入 DTO 與資料庫實體分開 | [完整 CRUD](/zh-tw/tutorial/crud) |
| Alembic | EF Core 遷移（`dotnet ef`） | 用於結構升級；第 23 章使用遷移管理升級 | [資料庫遷移](/zh-tw/advanced/efcore-migrations) |
| `OAuth2PasswordBearer` + JWT 驗證邏輯 | `AddJwtBearer` + `RequireAuthorization()` | FastAPI 的認證資訊提取不等於 JWT 驗證；本地權杖用 `dotnet user-jwts` 產生 | [身分驗證（JWT）](/zh-tw/tutorial/authentication) |
| `Security()` / 依賴中檢查權限 | 命名策略 + `RequireAuthorization()` | 本例按 editor 角色限制寫入 | [授權](/zh-tw/tutorial/authorization) |
| `CORSMiddleware` | `AddCors` + `UseCors` | 瀏覽器跨源許可，不代替身分驗證授權 | [CORS](/zh-tw/tutorial/cors) |
| `TestClient` | `WebApplicationFactory` | 在記憶體中啟動應用程式做整合測試 | [測試](/zh-tw/tutorial/testing) |

熟悉 SQL 的話，也可以檢視 [EF Core / LINQ ↔ PostgreSQL 速查](./efcore-sql-cheatsheet)，對照查詢、分頁、關聯和增刪改。
