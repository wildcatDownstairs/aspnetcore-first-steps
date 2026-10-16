---
title: 身分驗證（JWT）
description: 用 JWT Bearer 驗證呼叫者身分，透過 dotnet user-jwts 建立本地測試權杖，區分權杖驗證、身分讀取和 API 保護。
---

# 身分驗證（JWT）

上一章任何人都可以修改 Todo。這一章加入**身分驗證**（authentication）：驗證呼叫者的認證資訊，確認身分，並要求存取 Todo API 的人透過身分驗證。

下面在第 17 章的程式碼上加入 JWT Bearer 身分驗證。模型和上下文不變，仍附在本章專案中，方便獨立執行：

<<< @/../samples/18-authentication/Program.cs{1,14-15,21-22,42-44 cs:line-numbers} [18-authentication/Program.cs]

<<< @/../samples/18-authentication/Models.cs{cs:line-numbers} [18-authentication/Models.cs]

<<< @/../samples/18-authentication/TodoDbContext.cs{cs:line-numbers} [18-authentication/TodoDbContext.cs]

## 準備本地測試權杖

**JWT**（JSON Web Token）是一種權杖格式。本例用戶端透過 `Authorization: Bearer <權杖>` 提交它；Bearer 表示持有者可以使用這份認證資訊，因此不要把權杖放進 URL 或記錄。

先用 SDK 自帶的 `dotnet user-jwts` 產生開發權杖，再讓 API 驗證它。這樣可以先學會保護 API，暫不涉及登入和使用者註冊。

先停止上一章服務，在儲存庫根目錄執行：

```bash
cd samples/18-authentication
dotnet user-jwts create --name alice --valid-for 1h --output token
```

終端會輸出三段以點分隔的權杖。每次產生的內容不同，請完整複製，下一步會用到。

專案已經宣告驗證權杖的套件，以及供開發工具使用的 `UserSecretsId`：

<<< @/../samples/18-authentication/Authentication.csproj{6,12 xml:line-numbers} [18-authentication/Authentication.csproj]

`user-jwts` 會在本機使用者設定目錄儲存測試簽名金鑰，並更新開發環境的 Bearer 設定。本例只監聽 `http://localhost:5080`，對應的設定如下：

<<< @/../samples/18-authentication/appsettings.Development.json{2-11 json:line-numbers} [18-authentication/appsettings.Development.json]

`ValidIssuer` 是接受的**簽發者**（issuer），`ValidAudiences` 是接受的**受眾**（audience，即權杖面向的 API 標識）。設定和測試金鑰由 `AddJwtBearer()` 的設定機制讀取；原始碼裡沒有固定簽名金鑰。[本地 JWT 工具說明](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/jwt-authn?view=aspnetcore-10.0)

::: warning 注意
這些權杖和簽名金鑰只用於本地開發。User Secrets 不加密儲存的內容，也不要把它提交到儲存庫，詳見[第 12 章](./configuration)。上線時應接入可信身分服務，按其文件設定權杖驗證，並透過 HTTPS 傳輸權杖。
:::

## 執行與驗證

在剛才的專案目錄啟動 API：

```bash
dotnet run
```

另開終端，先不帶權杖：

```bash
curl -i http://localhost:5080/todos
```

回應摘錄，`traceId` 用佔位文字表示本次請求的動態值：

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.2","title":"Unauthorized","status":401,"traceId":"request-trace-id"}
```

在這個發請求的終端裡，把剛才複製的完整權杖放入變數。根據使用的 shell 選擇一種：

::: code-group

```powershell [PowerShell 7]
$TOKEN = "paste-the-complete-token-here"
```

```bash [Bash / zsh]
TOKEN="paste-the-complete-token-here"
```

:::

帶上請求標頭，再請求目前使用者和清單：

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5080/me
```

```json
{"name":"alice"}
```

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5080/todos
```

本章的新資料庫 `todos-18.db` 初始沒有任務，所以得到 `[]`。再建立一個：

```bash
curl -i -X POST http://localhost:5080/todos -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

回應是 201，`Location` 為 `/todos/1`，JSON 為：

```json
{"id":1,"title":"Write report","done":false,"categoryId":1}
```

把請求標頭裡的權杖換成 `not-a-valid-token` 再請求 `/todos`，得到 401。權杖無效時，處理常式不會執行，更不會寫入資料庫。

## 註冊身分驗證，不等於自動保護所有端點

這幾處設定各有職責：

| 設定 | 職責 |
| --- | --- |
| `AddAuthentication("Bearer").AddJwtBearer()` | 註冊預設的 Bearer 身分驗證方案和 JWT 驗證處理器 |
| `UseAuthentication()` | 驗證請求中的權杖，成功後建立使用者身分 |
| `AddAuthorization()` / `UseAuthorization()` | 註冊並執行存取規則；本章只要求已通過身分驗證 |
| `RequireAuthorization()` | 將“必須透過身分驗證”這個要求附加到端點或整個群組 |

**為什麼要分別設定？**身分驗證回答“認證資訊是否有效、對應誰”，端點的存取規則回答“這裡是否需要身分”。只註冊 JWT 服務，卻不為端點新增保護要求，不會自動讓所有 API 變成私有。

本例將要求加在整個 `/todos` 群組上，CRUD 都受保護；`/me` 單獨新增同樣的要求。`UseAuthentication()` 放在 `UseAuthorization()` 前面，先建立身分，再檢查規則。文件端點仍只在開發環境開放。

## 伺服器怎樣判斷權杖有效

本例的 JWT 載荷不是加密資料：能讀出其中的使用者名稱，不代表它是真的。伺服器端要驗證簽名、簽發者、受眾和有效期，不能只做 Base64 解碼就相信用戶端。

權杖被篡改、簽發者或受眾不符，都會驗證失敗。過期檢查還允許一定的時鐘偏差，所以到期後可能有短暫寬限。[JWT Bearer 驗證說明](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0)

`ClaimsPrincipal` 是驗證後建立的使用者物件，其中的**宣告**（claim）是描述身分的索引鍵和值資訊。本地工具產生的使用者名稱經過預設對應後，可以透過 `user.Identity?.Name` 讀取。不同身分服務的宣告名稱和對應規則可能不同，不能假設所有 JWT 都有相同的使用者名稱欄位。

## 本章還沒有細分權限

現在擁有有效權杖的人都能讀寫同一份 Todo 清單。下一章會區分“普通讀者”和“編輯者”；按使用者隔離任務還需要另外檢查資料歸屬。

::: fastapi FastAPI 對照
FastAPI 的 `HTTPBearer` 或 `OAuth2PasswordBearer` 可以提取請求中的 Bearer 認證資訊，但仍需配合權杖驗證邏輯。這裡的 `AddJwtBearer` 負責驗證，`RequireAuthorization` 負責要求端點透過存取檢查。
:::

## 總結

- JWT Bearer 身分驗證會驗證權杖並建立身分，不能只解碼載荷就信任它。
- `dotnet user-jwts` 僅提供本地測試權杖；正式環境接入可信身分服務並使用 HTTPS。
- 註冊身分驗證服務不等於保護端點，端點或群組還要宣告 `RequireAuthorization()`。
- 缺少或無法透過驗證的權杖存取受保護端點時得到 401。
- `ClaimsPrincipal` 提供驗證後的身分；是否能修改資料，要由下一章的授權規則決定。

下一章：[授權](./authorization)——有效身分也不一定有寫入權限。上一章：[完整 CRUD](./crud)。
