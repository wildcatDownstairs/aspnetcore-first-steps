---
title: 路由參數
description: 在路由模板中宣告參數，讓 URL 的一部分自動轉換成強型別的處理常式參數；理解路由約束、路由優先順序和捕獲全部參數。
---

# 路由參數

上一章的端點只能回應一個固定的 URL。真實的 API 中，URL 裡經常帶著資料：`/users/42` 中的 `42` 是使用者編號，`/files/docs/report.pdf` 中的後半段是檔案路徑。本節的新概念是**路由參數**（route parameter）：把 URL 中的一段"挖空"，交給處理常式作為參數。

本節最終的完整程式碼，高亮部分是相對上一章新增的內容：

<<< @/../samples/03-path-params/Program.cs{15,17,19 cs:line-numbers} [03-path-params/Program.cs]

第 1～13 行與上一章完全相同，後面不再重複解釋。

## 執行與驗證

按上一章的方式建立專案（或者直接進入儲存庫的 `samples/03-path-params` 目錄），然後執行：

```bash
dotnet run
```

依次傳送下面幾個請求，對比你看到的結果：

```bash
curl http://localhost:5080/users/42
```

```json
{"id":42,"name":"User 42"}
```

```bash
curl http://localhost:5080/users/me
```

```json
{"id":0,"name":"Current user"}
```

```bash
curl http://localhost:5080/files/docs/2026/report.pdf
```

```json
{"path":"docs/2026/report.pdf"}
```

再試一個"不合法"的地址，加上 `-i` 檢視狀態碼：

```bash
curl -i http://localhost:5080/users/abc
```

```http
HTTP/1.1 404 Not Found
Content-Length: 0
Date: Sat, 26 Sep 2026 08:55:56 GMT
Server: Kestrel
```

四個結果都對上了，我們來看它們分別是怎麼產生的。

## 宣告路由參數

<<< @/../samples/03-path-params/Program.cs{15 cs:line-numbers} [03-path-params/Program.cs]

路由模板 `"/users/{id:int}"` 中，花括號包起來的部分就是路由參數。它和處理常式的參數 `int id` **同名**，框架就是靠名字把兩者對應起來的：請求 `/users/42` 時，`42` 被取出來，傳給參數 `id`。

這個過程叫**參數繫結**（parameter binding）。它是按約定工作的——你不需要寫任何註解來說明"`id` 來自路由"，名字一致就夠了。

### 字串自動變成 int

URL 本質上是一個字串，但處理常式拿到的 `id` 是 `int`。轉換是框架完成的：它會呼叫 `int.TryParse` 把 `"42"` 變成 `42`。

這意味著在處理常式內部，`id` **就是一個整數**，編譯器也按整數對待它：

- 寫 `id + 1` 得到的是 `43`，而不是字串拼接出的 `"421"`；
- 寫 `id.Length` 會直接編譯失敗，因為整數沒有長度：

```text
error CS1061: “int”未包含“Length”的定义，并且找不到可接受第一个“int”类型参数的可访问扩展方法“Length”(是否缺少 using 指令或程序集引用?)
```

**你在參數清單裡寫下的型別，就是對輸入格式的宣告。** 之後的程式碼可以放心地把它當整數用，不需要自己再做解析和判斷。除了 `int`，`long`、`Guid`、`DateTime`、`bool`、列舉等常見型別也都能直接作為參數型別。

::: fastapi FastAPI 對照
這和 FastAPI 中 `def get_user(id: int)` 的效果幾乎一樣：型別標註決定了轉換規則。區別在於 C# 的型別在編譯期就會被檢查，寫錯型別的用法根本無法透過編譯。
:::

### 型別也進入了文件

開啟 <http://localhost:5080/openapi/v1.json>，找到 `/users/{id}` 的部分：

```json
"parameters": [
  {
    "name": "id",
    "in": "path",
    "required": true,
    "schema": {
      "pattern": "^-?(?:0|[1-9]\\d*)$",
      "type": "integer",
      "format": "int32"
    }
  }
]
```

`"type": "integer"`、`"format": "int32"` 都來自程式碼中的 `int`。在 `/scalar` 頁面裡測試這個端點時，文件也會提示你這裡需要填一個整數。同一處型別宣告，同時決定了轉換規則、編譯檢查和 API 文件。

## 路由約束

模板中 `{id:int}` 的 `:int` 部分叫**路由約束**（route constraint）。它的作用是：**只有當這一段能解析為整數時，這個端點才算匹配。**

這就解釋了開頭 `/users/abc` 為什麼回傳 `404 Not Found`：`abc` 不滿足 `int` 約束，所以這個端點根本沒被選中，框架找不到能處理它的端點。

你可能會問：處理常式的參數已經是 `int` 了，為什麼還要在模板裡再寫一遍？我們去掉約束做個對比。如果模板是 `"/users/{id}"`，請求 `/users/abc` 會得到：

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Failed to bind parameter "int id" from "abc".
```

區別在於**檢查發生的時機**：

| | 發生在 | 失敗時 | 含義 |
| --- | --- | --- | --- |
| 路由約束 `{id:int}` | 匹配端點**之前** | 404 | "這個 URL 不匹配這個端點" |
| 參數型別 `int id` | 匹配端點**之後** | 400 | "匹配到了端點，但參數值無法轉換" |

那該用哪一種？微軟官方的建議很明確：**路由約束用來區分形狀相似的路由，而不是驗證輸入。**從用戶端的角度看，`/users/abc` 是"參數寫錯了"，400 加上錯誤說明比一個不帶任何資訊的 404 更有用。

所以，只有當同一個位置可能對應多個端點時，約束才真正派上用場。比如同時提供 `/users/{id:int}`（按編號查）和 `/users/{name}`（按使用者名稱查）：請求 `/users/42` 滿足 `int` 約束，走第一個；`/users/alice` 不滿足，自然落到第二個。沒有約束的話，這兩個路由就無法共存（下一節會看到後果）。

本節範例保留 `:int`，是為了讓你觀察約束的效果。如果在你的專案裡 `/users/{id}` 是唯一的同形路由，去掉約束、讓非法值回傳 400，對呼叫方更友好。

::: tip 提示
一個有趣的現象：`/users/99999999999` 同樣回傳 404。因為這個數字超出了 `int` 的範圍（約 ±21 億），不滿足 `int` 約束。如果你的編號可能很大，請使用 `long` 型別和 `{id:long}` 約束。
:::

常用的約束還有：

| 約束 | 範例 | 匹配 |
| --- | --- | --- |
| `int` / `long` | `{id:int}` | 整數 |
| `guid` | `{id:guid}` | GUID，例如 `0f8fad5b-d9cb-469f-a165-70867728950e` |
| `bool` | `{on:bool}` | `true` 或 `false` |
| `alpha` | `{name:alpha}` | 只含英文字母 |
| `min(1)` | `{page:min(1)}` | 大於等於 1 的整數 |
| `minlength(3)` | `{code:minlength(3)}` | 至少 3 個字元 |

多個約束可以串聯使用，例如 `{id:int:min(1)}`。

::: warning 注意
**不要用路由約束做輸入驗證。** 約束失敗回傳的是 404，用戶端只知道"地址不存在"，卻不知道錯在哪裡。約束的職責是**區分路由**；"參數格式正確但取值不合法"（比如年齡是負數）屬於輸入驗證，應該回傳 400 和清晰的錯誤資訊——這是「參數驗證」一章的內容。
:::

## 路由優先順序

<<< @/../samples/03-path-params/Program.cs{15,17 cs:line-numbers} [03-path-params/Program.cs]

注意註冊順序：第 15 行的 `/users/{id:int}` 寫在了第 17 行的 `/users/me` **前面**。但請求 `/users/me` 時，命中的是第 17 行。

這和註冊順序無關。即使去掉 `:int` 約束，讓 `/users/{id}` 在形式上也能匹配 `me`，`/users/me` 仍然會命中第 17 行（你可以自己試試）。ASP.NET Core 的路由系統**不是按註冊順序逐個嘗試**，而是先找出所有能匹配的候選端點，再按**優先順序**選出最具體的那個。粗略地說：

1. 字面量段（如 `me`）最優先；
2. 其次是帶約束的參數（如 `{id:int}`）；
3. 再次是不帶約束的參數（如 `{id}`）；
4. 捕獲全部參數（如 `{*path}`，下一節介紹）最後。

**為什麼這樣設計？** 因為在真實專案裡，端點往往分散在多個檔案中註冊（見「組織更大的專案」一章），註冊順序很難控制，也不應該影響程式的行為。基於優先順序的匹配讓你可以按任意順序註冊端點，結果都一樣。

::: fastapi FastAPI 對照
這是和 FastAPI 差別很大的一點。FastAPI 按宣告順序匹配路由，所以 `/users/me` 必須寫在 `/users/{user_id}` 之前；ASP.NET Core 中順序無關緊要。
:::

那如果一個請求能同時匹配兩個路由，而它們的優先順序又完全相同呢？比如同時註冊了 `/users/{id}` 和 `/users/{name}`（都沒有約束），請求 `/users/42` 時框架無從選擇，會回傳 `500` 錯誤和 `AmbiguousMatchException`（模糊匹配例外狀況）。

注意，衝突的前提是**能匹配同一個請求**。`/users/{id}` 和 `/posts/{id}` 優先順序相同，但永遠不會匹配同一個 URL，所以沒有問題。

對於上面這種衝突，編譯時就會收到警告：

```text
warning ASP0022: Route '/users/{id}' conflicts with another handler route. An HTTP request that matches multiple routes results in an ambiguous match error.
```

這是 ASP.NET Core 自帶的**分析器**（analyzer）在檢查你的程式碼——它不只檢查 C# 語法，還理解路由模板的含義。

::: warning 注意
不要把"編譯沒有警告"當成"路由沒有衝突"。為了避免誤報，ASP0022 刻意很保守：它只檢查**同一程式碼塊內**的重複路由，比如分別寫在 `if` 兩個分支裡的衝突路由就不會被報告。分析器能幫你發現常見錯誤，但不能替代測試。
:::

## 捕獲全部參數

<<< @/../samples/03-path-params/Program.cs{19 cs:line-numbers} [03-path-params/Program.cs]

普通的路由參數只匹配**一段**，也就是兩個 `/` 之間的內容。參數名前加上 `*`，就成了**捕獲全部參數**（catch-all parameter）：它會把剩餘的所有段，**包括中間的 `/`**，一起交給參數。

所以請求 `/files/docs/2026/report.pdf` 時，`path` 的值是 `docs/2026/report.pdf`。這種參數適合表示檔案路徑、多級分類之類層級不固定的資料。捕獲全部參數只能出現在模板的最後一段。

::: warning 注意
`path` 的型別是 `string`（不可為 null），所以它是**必填**的。請求 `/files/`（後面什麼都沒有）會得到 400 錯誤。如果希望允許為空，可以把參數型別改為 `string?`——問號表示"可以為 null"，這時 `path` 會收到 `null`。可空型別的說明可以回看[「C# 速覽」](./csharp-tour)。
:::

::: fastapi FastAPI 對照
`{*path}` 相當於 FastAPI 中的 `{file_path:path}` 路徑轉換器。
:::

## 名字對不上會怎樣

參數繫結是靠名字對應的，那麼名字寫錯會發生什麼？假設模板是 `"/users/{id}"`，而處理常式的參數寫成了 `(int userId)`。編譯能透過，但請求 `/users/5` 會得到：

```text
HTTP/1.1 400 Bad Request

Microsoft.AspNetCore.Http.BadHttpRequestException: Required parameter "int userId" was not provided from query string.
```

注意錯誤資訊的最後：框架去**查詢字串**（query string）裡找 `userId` 了。因為路由模板裡沒有叫 `userId` 的參數，框架就推斷它應該來自 URL 中 `?` 後面的部分。

這正好引出了下一章的主題。現在你只需要記住：**路由模板裡的名字和參數名必須一致**。

## 總結

- 在路由模板中用 `{name}` 宣告**路由參數**，處理常式中**同名**的參數會自動接收它的值。
- 參數型別（如 `int`）決定了字串到值的轉換規則；轉換後的值在編譯期按該型別檢查，並自動寫進 OpenAPI 文件。
- **路由約束**（如 `{id:int}`）在匹配端點之前生效，失敗回傳 404；參數型別轉換在匹配之後，失敗回傳 400。約束用於區分路由，不用於輸入驗證。
- 路由按**優先順序**而非註冊順序匹配：字面量 > 帶約束參數 > 普通參數 > 捕獲全部參數。能匹配同一請求、且優先順序相同的路由會導致模糊匹配錯誤，分析器 ASP0022 能在編譯期發現其中一部分。
- `{*path}` 是**捕獲全部參數**，能匹配包含 `/` 的剩餘路徑。

下一章：[查詢參數](./query-params)——處理 URL 中 `?` 後面的部分。上一章：[第一步](./first-steps)。
