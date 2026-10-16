---
title: 參數驗證
description: 使用 .NET 10 內建的 Minimal API 驗證：在 record 和參數上用資料註解宣告規則，不合法的請求在進入處理常式前就被拒絕。
---

# 參數驗證

上一章留下了一個問題：請求本文缺少 `title` 時，程式照樣建立了一個標題為 `null` 的待辦事項。本節的新概念是**宣告式驗證**（declarative validation）：在型別和參數上**宣告**規則，由框架在呼叫處理常式**之前**統一檢查，不合法的請求直接回傳 400。

<<< @/../samples/06-validation/Program.cs{1,7,20,31-33 cs:line-numbers} [06-validation/Program.cs]

和上一章相比，只多了三處：第 7 行註冊驗證服務，第 31～33 行給 `CreateTodo` 的屬性加上規則，第 20 行給查詢參數加上規則。處理常式本身一行沒改。

## 執行與驗證

```bash
dotnet run
```

正常的請求不受影響：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","priority":2}'
```

```json
{"id":1,"title":"Buy milk","priority":2,"done":false}
```

再傳送上一章那個缺少 `title` 的請求：

```bash
curl -i -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"priority":3}'
```

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{"title":"One or more validation errors occurred.","errors":{"Title":["The Title field is required."]}}
```

這次被拒絕了。多個欄位同時出錯時，所有錯誤會一次性回傳：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"","priority":9}'
```

```json
{"title":"One or more validation errors occurred.","errors":{"Title":["The Title field is required."],"Priority":["The field Priority must be between 1 and 5."]}}
```

查詢參數同樣會被檢查：

```bash
curl "http://localhost:5080/todos?pageSize=100"
```

```json
{"title":"One or more validation errors occurred.","errors":{"pageSize":["The field pageSize must be between 1 and 50."]}}
```

## 用特性宣告規則

<<< @/../samples/06-validation/Program.cs{1,31-33 cs:line-numbers} [06-validation/Program.cs]

方括號中的 `[Required]`、`[StringLength(50)]`、`[Range(1, 5)]` 叫**特性**（attribute），是一種附加在程式碼上的中繼資料。這幾個特性來自第 1 行引入的 `System.ComponentModel.DataAnnotations` 命名空間，統稱**資料註解**（data annotations）：

| 特性 | 規則 |
| --- | --- |
| `[Required]` | 必須提供，不能是 `null`；對字串來說也不能是空字串 |
| `[StringLength(50)]` | 字串長度不超過 50 |
| `[Range(1, 5)]` | 數值在 1 到 5 之間（含兩端） |
| `[MinLength]`、`[MaxLength]` | 字串或集合的最小、最大長度 |
| `[EmailAddress]`、`[Url]` | 郵箱、網址格式 |
| `[RegularExpression]` | 匹配正規表示式 |

多個特性可以寫在同一對方括號裡，用逗號分隔，比如 `[Required, StringLength(50)]`。

**為什麼用宣告式，而不是在處理常式裡寫 `if`？**

- **規則和資料放在一起**：看到 `CreateTodo` 就知道它的全部約束，不用翻遍所有處理常式。
- **處理常式保持乾淨**：進入處理常式時，`input` 一定是合法的，業務程式碼不需要再防禦。
- **錯誤格式統一**：所有端點回傳同樣結構的錯誤，用戶端只需要寫一套處理邏輯。
- **進入文件**：規則會寫進 OpenAPI 文件，比如 `pageSize` 參數的描述裡會出現 `"minimum": 1` 和 `"maximum": 50`。

::: fastapi FastAPI 對照
這相當於 Pydantic 的 `Field(min_length=1, max_length=50)`、`Field(ge=1, le=5)`，以及查詢參數上的 `Query(ge=1, le=50)`。區別在於 FastAPI 的驗證是 Pydantic 內建的；ASP.NET Core 中資料模型（record）和驗證機制是分開的，需要顯式開啟。
:::

::: warning 注意
**`CreateTodo` 必須宣告為 `public`**（第 31 行）。.NET 10 的驗證由**原始碼產生器**（source generator）在編譯時為參與驗證的型別產生程式碼，而它只處理公開的型別。

如果去掉 `public`，寫成 `record CreateTodo(...)`，專案照樣能編譯，請求本文卻**完全不會被驗證**——沒有錯誤，沒有警告，也沒有記錄。這是很容易踩到的坑：如果你發現驗證規則沒有生效，首先檢查型別是不是 `public`。
:::

## 開啟驗證

<<< @/../samples/06-validation/Program.cs{7 cs:line-numbers} [06-validation/Program.cs]

`AddValidation()` 把驗證功能註冊到應用程式中。之後，每個端點在呼叫處理常式之前，都會按照參數上的特性檢查輸入：

1. 路由、查詢字串、請求本文等來源的值先完成繫結（上一章的內容）；
2. 按特性檢查每個參數，以及參數物件的每個屬性；
3. 有任何錯誤，就回傳 400 和全部錯誤資訊，處理常式不會被呼叫；
4. 全部透過，才呼叫處理常式。

注意第 2 步和上一章的區別：**繫結**負責"格式對不對"（`"high"` 能不能轉成 `int`），**驗證**負責"內容合不合理"（`9` 是否在 1 到 5 之間）。前者失敗時，框架根本建構不出 `CreateTodo` 物件，也就輪不到驗證。

::: info 技術細節
這套內建驗證功能是 .NET 10 新增的，之前的版本需要藉助第三方庫或手寫程式碼。原始碼產生器在編譯期發現可驗證型別並產生相關中繼資料，執行階段由驗證元件執行規則。實作仍會透過**反射**（reflection，在執行階段讀取型別、屬性等資訊）獲取屬性和驗證特性，並非完全沒有反射。產生的中繼資料和裁剪支援讓它可以用於原生 AOT（提前編譯為本機程式碼，在「進階」部分介紹）；AOT 不等於完全不能使用反射。
:::

## 驗證查詢參數

<<< @/../samples/06-validation/Program.cs{20 cs:line-numbers} [06-validation/Program.cs]

特性不只能用在 record 的屬性上，也可以直接加在處理常式的參數上。`[Range(1, 50)]` 限制了每頁最多 50 條，防止用戶端一次請求過多資料。

路由參數、查詢參數、請求標頭都可以這樣驗證。回憶「路由參數」一章的建議："取值不合法"應該回傳帶說明的 400，而不是用路由約束回傳 404——這裡就是實作它的地方。

## 錯誤回應的格式

驗證失敗的回應本文結構如下：

```json
{
  "title": "One or more validation errors occurred.",
  "errors": {
    "Title": ["The Title field is required."],
    "Priority": ["The field Priority must be between 1 and 5."]
  }
}
```

`errors` 是一個字典：鍵是出錯的欄位名，值是該欄位的所有錯誤訊息。這個結構遵循一個名為 **Problem Details** 的標準格式，「狀態碼與錯誤處理」一章會詳細介紹它，並用它統一常見錯誤回應。

::: tip 提示
預設的錯誤訊息是英文的。每個特性都可以透過 `ErrorMessage` 自定義訊息，例如 `[Range(1, 5, ErrorMessage = "Priority must be between 1 and 5")]`。
:::

## 總結

- `builder.Services.AddValidation()` 開啟 .NET 10 內建的驗證，驗證在處理常式執行**之前**進行。
- 在 record 的屬性或處理常式的參數上用**資料註解**（`[Required]`、`[StringLength]`、`[Range]` 等）宣告規則。
- 驗證失敗回傳 400，回應本文中的 `errors` 按欄位列出所有錯誤；處理常式不會被呼叫。
- **繫結**檢查格式，**驗證**檢查內容；規則會同時寫進 OpenAPI 文件。
- 參與驗證的型別必須是 `public`，否則驗證會被靜默跳過。

下一章：[Header 與 Cookie](./headers-cookies)——讀取請求的其他部分。上一章：[請求本文](./request-body)。
