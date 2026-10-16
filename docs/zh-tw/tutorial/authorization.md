---
title: 授權
description: 用命名策略區分 Todo 讀寫權限，理解身分宣告、角色要求以及 401 與 403 的區別。
---

# 授權

上一章所有透過身分驗證的人都能刪任務。這一章用**授權策略**（authorization policy）規定誰可以修改資料。

規則是：**透過身分驗證的人可以讀取共享 Todo，帶有 editor 角色的人才可以建立、修改、刪除。** 模型、資料庫操作、錯誤處理都沿用上一章。

<<< @/../samples/19-authorization/Program.cs{15-18,47,71,86,95 cs:line-numbers} [19-authorization/Program.cs]

<<< @/../samples/19-authorization/Models.cs{cs:line-numbers} [19-authorization/Models.cs]

<<< @/../samples/19-authorization/TodoDbContext.cs{cs:line-numbers} [19-authorization/TodoDbContext.cs]

## 為同一專案準備兩種身分

先停止上一章服務，從儲存庫根目錄進入本章專案：

```bash
cd samples/19-authorization
dotnet user-jwts create --name alice --valid-for 1h --output token
dotnet user-jwts create --name bob --role editor --valid-for 1h --output token
```

分別複製兩條指令輸出的完整權杖：alice 沒有 editor 角色，bob 有。這裡使用本章自己的 `UserSecretsId` 和測試金鑰，請重新產生，不要直接搬用上一章權杖。

```bash
dotnet run
```

在另一個發請求的終端中設定變數：

::: code-group

```powershell [PowerShell 7]
$READER_TOKEN = "paste-Alice-token-here"
$EDITOR_TOKEN = "paste-Bob-token-here"
```

```bash [Bash / zsh]
READER_TOKEN="paste-Alice-token-here"
EDITOR_TOKEN="paste-Bob-token-here"
```

:::

## 執行與驗證

alice 可以讀取清單。首次執行使用新的 `todos-19.db`，結果是空陣列：

```bash
curl -H "Authorization: Bearer $READER_TOKEN" http://localhost:5080/todos
```

```json
[]
```

但不能建立任務：

```bash
curl -i -X POST http://localhost:5080/todos -H "Authorization: Bearer $READER_TOKEN" -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

回應摘錄，`traceId` 是動態值：

```http
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.4","title":"Forbidden","status":403,"traceId":"request-trace-id"}
```

把權杖換成 bob 的，其他請求內容保持一致：

```bash
curl -i -X POST http://localhost:5080/todos -H "Authorization: Bearer $EDITOR_TOKEN" -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

這次是 201，`Location: /todos/1`，回應本文為：

```json
{"id":1,"title":"Write report","done":false,"categoryId":1}
```

alice 仍不能刪除它，bob 可以：

```bash
curl -i -X DELETE http://localhost:5080/todos/1 -H "Authorization: Bearer $READER_TOKEN"
curl -i -X DELETE http://localhost:5080/todos/1 -H "Authorization: Bearer $EDITOR_TOKEN"
```

依次得到 **403** 和 **204**。第二次刪除成功，沒有回應本文；第一個請求沒有執行刪除。

## 用同一條策略保護三個寫入端點

第 17 行註冊名為 `CanWriteTodos` 的策略。它要求身分已通過身分驗證，並且包含 `editor` **角色**（role）。在這份 JWT 範例中，角色來自受信任權杖中的宣告，不來自請求本文或一個任意的 HTTP Header。

POST、PUT、DELETE 都呼叫 `RequireAuthorization("CanWriteTodos")`，授權系統會在處理常式執行前檢查這條策略。這樣以後調整寫權限，只需改一處規則，不用分別修改三個處理常式。

新增寫入端點時，也要附加這條策略；框架不會根據 POST、PUT 等方法名自動要求 editor 角色。

群組上的 `RequireAuthorization()` 沒有被單個端點上的命名策略替換。這些要求會組合生效：組內端點先具有“需要身分驗證”的要求，寫入端點再增加 editor 角色要求。

## 401 和 403 分別告訴用戶端什麼

| 請求情況 | 結果 | 原因 |
| --- | --- | --- |
| 沒有權杖，或者權杖無效 | 401 | 無法建立滿足要求的身分驗證身分 |
| 有效的 alice 權杖存取 GET | 200 | 已透過身分驗證，允許讀取 |
| 有效的 alice 權杖存取 POST / PUT / DELETE | 403 | 身分有效，但不滿足寫入策略 |
| 有效的 bob 權杖執行合法寫入 | 對應的 201 或 204 | 身分與權限都滿足要求 |

**403 不是重新登入就一定能解決的問題。**如果簽發者沒有給這個使用者 editor 角色，再拿到一枚相同權限的權杖，結果仍然是 403。[角色授權說明](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/roles?view=aspnetcore-10.0)

角色名稱要與策略一致，本例使用小寫 `editor`。角色應由身分服務根據使用者權限簽發，不能直接相信用戶端提交的 `role` 欄位。

## 角色授權不等於資料歸屬檢查

本章的 editor 可以修改共享清單中的任意任務。要實作“只能修改自己的 Todo”，需要給資料儲存擁有者標識，並在查詢或修改時核對目前使用者；僅檢查角色做不到這一點。

::: warning 注意
`--role editor` 只是本地測試工具提供的能力，生產用戶端不能自行簽發角色。使用者權限變化後，舊權杖也不會自動更新；身分服務還需要處理權杖過期和撤銷。
:::

::: fastapi FastAPI 對照
這類似把權限檢查封裝成可複用的依賴，再掛到需要寫權限的操作上。ASP.NET Core 的命名策略由授權系統執行，處理常式只宣告策略名稱。
:::

## 總結

- 身分驗證確認身分，授權策略決定這份身分能執行哪些操作。
- `CanWriteTodos` 集中宣告寫權限，POST、PUT、DELETE 顯式使用它。
- 組級與端點級授權要求會組合生效，GET 仍繼承組級身分驗證要求。
- 未透過身分驗證得到 401，身分有效但權限不足得到 403。
- 角色來自可信身分宣告；共享清單的角色規則不能替代按資源的歸屬檢查。

下一章：[CORS](./cors)——讓另一個源的瀏覽器頁面呼叫 API。上一章：[身分驗證（JWT）](./authentication)。
