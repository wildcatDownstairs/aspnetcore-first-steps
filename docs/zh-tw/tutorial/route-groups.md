---
title: 路由群組
description: 用 MapGroup 把共享路由字首的端點組織在一起，並在群組上統一新增中繼資料，例如 OpenAPI 標籤。
---

# 路由群組

隨著端點越來越多，你會發現同一類端點有很多重複：路徑都以 `/api/todos` 開頭，將來可能都需要登入才能存取，文件裡也應該歸在同一類下。本節的新概念是**路由群組**（route group）：把這些共同點寫在一個地方。

<<< @/../samples/10-route-groups/Program.cs{19-23,25,31,38,41 cs:line-numbers} [10-route-groups/Program.cs]

本章以第 08 章的 CRUD 範例為基礎演示路由群組，暫時省略第 06 章的參數驗證和第 09 章的統一錯誤處理，讓變化集中在端點是**掛在哪裡**註冊的。這些能力都可以與 `MapGroup` 組合使用；省略後，本章找不到資源的 404 回應仍然沒有回應本文。

## 執行與驗證

```bash
dotnet run
```

所有待辦事項端點現在都在 `/api/todos` 下：

```bash
curl http://localhost:5080/api/todos
```

```json
[{"id":1,"title":"Buy milk","done":false}]
```

```bash
curl http://localhost:5080/api/todos/1
```

```json
{"id":1,"title":"Buy milk","done":false}
```

```bash
curl -i -X POST http://localhost:5080/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Write report"}'
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /api/todos/2

{"id":2,"title":"Write report","done":false}
```

健康檢查端點在 `/api/health`：

```bash
curl http://localhost:5080/api/health
```

```json
{"status":"ok"}
```

舊地址 `/todos` 已經不存在了，回傳 `404`。

## 用 MapGroup 建立群組

<<< @/../samples/10-route-groups/Program.cs{19,21,23,25 cs:line-numbers} [10-route-groups/Program.cs]

**第 19 行** `app.MapGroup("/api")` 建立了一個群組，回傳值 `api` 代表"所有以 `/api` 開頭的路由"。

**第 21 行**在 `api` 上又呼叫了 `MapGroup("/todos")`，建立一個**巢狀群組**，它的完整字首是 `/api/todos`。

之後在 `todosApi` 上呼叫 `MapGet`、`MapPost`，寫的都是**相對路徑**：

| 註冊程式碼 | 實際路由 |
| --- | --- |
| `todosApi.MapGet("/", ...)` | `GET /api/todos` |
| `todosApi.MapGet("/{id:int}", ...)` | `GET /api/todos/{id}` |
| `todosApi.MapPost("/", ...)` | `POST /api/todos` |
| `todosApi.MapDelete("/{id:int}", ...)` | `DELETE /api/todos/{id}` |
| `api.MapGet("/health", ...)` | `GET /api/health` |

群組物件的用法和 `app` 幾乎一樣，`MapGet`、`MapPost`、`MapGroup` 都可以呼叫。這正是它好用的地方：**你不需要學新的 API，只是換了個物件來呼叫。**

**為什麼不直接在每個路由裡寫完整路徑？**因為字首是一個**決策**，應該只出現一次。假如有一天 API 要升級到 `/api/v2`，使用群組只需要改第 19 行一處；如果字首散落在每個端點中，就要逐個修改，漏掉一個就會出現不一致的 URL。

::: warning 注意
第 35 行 `Created` 的地址 `$"/api/todos/{todo.Id}"` 仍然是手寫的完整路徑，群組的字首不會自動加到這裡。如果修改了群組字首，別忘了同步修改它。
:::

## 在群組上新增中繼資料

<<< @/../samples/10-route-groups/Program.cs{21,41 cs:line-numbers} [10-route-groups/Program.cs]

群組不只是路徑字首。第 21 行的 `.WithTags("Todos")` 給群組加上了一個 OpenAPI **標籤**，群組內的**所有端點**都會繼承它。第 41 行則單獨給健康檢查端點加了"System"標籤。

開啟 `/scalar` 頁面，左側的端點清單會按標籤分成兩組："Todos"下有四個端點，"System"下有一個。在 `/openapi/v1.json` 中，這四個待辦事項端點的 `tags` 都是 `["Todos"]`，`/api/health` 的是 `["System"]`。

::: info 技術細節
之前的章節中沒有設定標籤，所以 Scalar 用專案名（例如 `FirstSteps`）作為所有端點的預設標籤。
:::

像 `WithTags` 這樣的呼叫，給端點附加的是**中繼資料**（metadata）：不改變處理邏輯，只是給端點"貼標籤"，供框架的其他部分讀取。在群組上新增的中繼資料會套用到組內的每個端點，這讓群組成為統一設定的好地方。後面的章節會在群組上新增更多東西，例如：

- 「授權」一章：`todosApi.RequireAuthorization()`，讓組內所有端點都需要登入；
- 「CORS」一章：為一組端點啟用跨域存取。

**設定一次，整組生效**，新加入群組的端點也會自動獲得這些設定，不會因為忘記新增而出現安全漏洞。

::: fastapi FastAPI 對照
`MapGroup` 相當於 FastAPI 的 `APIRouter(prefix="/todos", tags=["Todos"])`。區別是 FastAPI 的 router 需要最後用 `app.include_router()` 掛載；ASP.NET Core 的群組從 `app.MapGroup()` 建立出來時就已經掛在應用程式上了，還可以像第 21 行這樣繼續巢狀。
:::

## 總結

- `app.MapGroup("/字首")` 建立路由群組，在群組上註冊的端點使用**相對路徑**，實際路由自動加上字首。
- 群組可以巢狀：`api.MapGroup("/todos")` 的字首是 `/api/todos`。
- 在群組上新增的**中繼資料**（如 `WithTags`）會套用到組內所有端點；之後的授權、CORS 等設定也可以按組設定。
- 字首和共享設定只寫一次，修改時不會遺漏；但 `Created` 等處手寫的完整地址需要自己同步。

本章是「請求與回應」階段的最後一章。至此，你已經能寫出一個參數完整、有驗證、回應規範、結構清晰的 API。下一階段「應用程式骨架」將從[相依性注入](./dependency-injection)開始，把範例中的記憶體清單換成真正的服務。上一章：[狀態碼與錯誤處理](./errors)。
