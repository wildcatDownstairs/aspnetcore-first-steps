---
title: C# 速覽
description: 只講本教學會用到的 C#：靜態型別與 var、字串插值、可空引用型別、Lambda、record、LINQ、async/await。
---

# C# 速覽

這一章不是完整的 C# 教學，只挑出**後面章節一定會用到**的語法，讓你讀程式碼時不卡殼。如果你寫過 Java、TypeScript、Kotlin 之類的靜態型別語言，大部分內容一眼就能看懂，可以快速瀏覽。

與其他章節不同，本章是一次"速覽"，會一次介紹幾個小語法點。它們有一個共同的主題：**C# 是靜態型別語言，編譯器在執行前就知道每個值的型別，並據此幫你檢查程式碼。**後面所有章節都建立在這個前提上。

本章的完整程式碼是一個控制檯程式：

<<< @/../samples/01-csharp-tour/Program.cs{cs:line-numbers} [01-csharp-tour/Program.cs]

執行它（在 `samples/01-csharp-tour` 目錄下，或者按「環境準備」的方式用 `dotnet new console` 新建專案並替換 `Program.cs`）：

```bash
dotnet run
```

預期輸出：

```text
Alex has 2 todo items
Nickname length: 0
Square of 5 is 25
Todo { Id = 1, Title = Buy milk, Done = False }
Todo { Id = 1, Title = Buy milk, Done = True }
Value equality: True
Pending: Buy milk
Async operation complete
```

下面分三組來看。

## 型別、可空與 Lambda

<<< @/../samples/01-csharp-tour/Program.cs{2-3,6,9-10,13-14 cs:line-numbers} [01-csharp-tour/Program.cs]

### 靜態型別與 var

**第 2 行**顯式寫出了型別 `int`。**第 3 行**用 `var` 讓編譯器根據右邊的值**推斷**型別——`owner` 的型別是 `string`，而且之後永遠是 `string`。

`var` 不是"動態型別"。如果之後寫 `owner = 42;`，編譯會直接失敗。它只是省去了重複書寫型別名，型別本身在編譯期就確定了。在 VS Code 裡把滑鼠懸停在變數上，就能看到推斷出的型別。

::: fastapi FastAPI 對照
Python 的型別標註（type hints）是可選的，執行階段也不檢查；FastAPI 讀取它們來做資料轉換。C# 的型別是強制的：編譯器檢查每一處使用，型別不對就無法執行。後面你會看到 ASP.NET Core 同樣讀取這些型別來做參數繫結和產生文件。
:::

### 字串插值

**第 6 行**的字串前面有個 `$`，這叫**字串插值**（string interpolation）：花括號裡可以直接寫變數或表示式，執行階段替換成它的值。這和 Python 的 f-string、JavaScript 的模板字串是一回事。

### 可空引用型別

**第 9 行**的 `string?` 表示"這個變數可能是 `null`"；不帶問號的 `string` 表示"不應該是 `null`"。這個特性叫**可空引用型別**（nullable reference types），在專案檔案中由 `<Nullable>enable</Nullable>` 開啟，.NET 模板預設就是開啟的。

**為什麼需要它？**空引用錯誤（存取 `null` 的成員）是最常見的執行階段崩潰之一。有了可空標註，編譯器能提前發現隱患。比如把第 10 行改成直接存取 `nickname.Length`，編譯時就會警告：

```text
Program.cs(10,19): warning CS8602: 解引用可能出现空引用。
```

第 10 行的正確寫法用到了兩個運算子：

- `?.`（空條件運算子）：`nickname` 為 `null` 時不存取 `.Length`，整個表示式的結果直接是 `null`；
- `??`（空合併運算子）：左邊為 `null` 時使用右邊的值，這裡是 `0`。

::: warning 注意
可空標註是**編譯期**檢查，不會在執行階段阻止 `null` 出現。比如從 JSON 反序列化出來的資料，即使型別寫的是 `string`，缺少欄位時仍然可能是 `null`。「請求本文」一章會遇到這種情況，「參數驗證」一章會解決它。
:::

### Lambda 表示式

**第 13 行**的 `x => x * x` 是一個 **Lambda 表示式**（匿名函式）：`=>` 左邊是參數，右邊是回傳值。`Func<int, int>` 是它的型別，意思是"接收一個 `int`，回傳一個 `int` 的函式"。

下一章「第一步」會用到它：`app.MapGet("/", () => ...)` 的第二個參數就是 Lambda。Lambda 的函式體也可以是一個用花括號包起來的程式碼塊，裡面用 `return` 回傳結果，後面的章節會經常這樣寫。

::: fastapi FastAPI 對照
相當於 Python 的 `lambda x: x * x`，但 C# 的 Lambda 可以包含多行陳述式，所以端點的處理邏輯可以直接寫在 Lambda 裡。
:::

## record 與 LINQ

<<< @/../samples/01-csharp-tour/Program.cs{17-21,24-26,38 cs:line-numbers} [01-csharp-tour/Program.cs]

### record

**第 38 行**一行程式碼定義了一個型別 `Todo`：

- 圓括號中的 `int Id, string Title, bool Done` 既是建構函式的參數，也自動產生同名的 `init` 屬性，只能在初始化時賦值；
- 編譯器還自動產生了 `ToString()`（所以第 19 行能列印出 `Todo { Id = 1, ... }`）和基於值的相等比較。

這種型別叫 **record**（記錄型別）。本例使用的是位置式 `record class`（`class` 關鍵字可以省略），適合表示"一組資料"，有兩個方便的特性：

1. **值相等**：兩個 record 的所有屬性都相等，它們就相等。第 21 行 `milk == new Todo(1, "Buy milk", false)` 的結果是 `True`，即使它們是兩個不同的物件。
2. **初始化後不能重新賦值**：本例自動產生的 `init` 屬性只能在初始化時賦值。想要"修改"，就用 **第 18 行** 的 `with` 表示式複製一份並替換部分屬性，原來的 `milk` 保持不變。

`record` 本身並不強制不可變：你仍然可以宣告帶 `set` 的屬性。如果屬性指向一個可變清單，`init` 也只限制替換這個清單，不會阻止修改清單中的元素。這叫**淺層不可變性**（shallow immutability）。

**為什麼 Web API 偏愛 record？**請求和回應中的資料本質上就是"一組值"：它們從 JSON 來、到 JSON 去，中途不應該被意外修改。record 用最少的程式碼表達了這種意圖。從「請求本文」一章開始，所有的資料模型都會用 record 定義。

::: info 技術細節
在使用最上層陳述式的 `Program.cs` 中，型別定義（如 `record Todo`）必須寫在所有陳述式的**後面**，所以你會在每個範例檔案的末尾看到它們。第 32 行的 `static async Task<string> LoadMessageAsync()` 是一個**區域性函式**，可以寫在陳述式之間，也可以寫在後面。
:::

::: fastapi FastAPI 對照
record 的角色類似 Pydantic 模型或 `@dataclass(frozen=True)`：用欄位宣告描述資料的形狀。區別在於 record 本身不做驗證，驗證由 ASP.NET Core 在「參數驗證」一章中另行完成。
:::

### 集合與 LINQ

**第 24 行**的方括號 `[milk, new Todo(2, "Write code", true)]` 是**集合表示式**（collection expression），用來建立一個 `List<Todo>`。`List<Todo>` 中的 `<Todo>` 叫**泛型參數**，表示"這是一個只能裝 `Todo` 的清單"，往裡放其他型別的東西會編譯失敗。

**第 25 行**是 **LINQ**（Language Integrated Query，語言整合查詢）：

- `Where(t => !t.Done)`：篩選出未完成的項；
- `Select(t => t.Title)`：只取出標題。

兩個方法都接收 Lambda 作為參數，可以像管道一樣串聯。LINQ 在後面會頻繁出現：「查詢參數」一章用它做篩選和分頁，「EF Core 入門」一章會看到同樣的寫法被翻譯成 SQL 查詢資料庫。

::: fastapi FastAPI 對照
第 25 行相當於 Python 的 `[t.title for t in todos if not t.done]`。
:::

## async / await

<<< @/../samples/01-csharp-tour/Program.cs{29,32-36 cs:line-numbers} [01-csharp-tour/Program.cs]

**第 32～36 行**定義了一個**非同步方法**：

- `async` 表示方法內部可以使用 `await`；
- 回傳型別 `Task<string>` 表示"一個將來會產生 `string` 的操作"；
- 第 34 行的 `await Task.Delay(100)` 等待 100 毫秒，但**不會阻塞執行緒**。

**第 29 行**用 `await` 等待這個方法完成，取出結果。按照慣例，非同步方法的名字以 `Async` 結尾。

**為什麼 Web 服務要用非同步？**伺服器處理請求時，大部分時間在等待：等資料庫回傳、等檔案讀完、等另一個服務回應。同步程式碼在等待期間會一直佔著執行緒；非同步程式碼在等待時把執行緒交還給伺服器，讓它去處理別的請求。結果是同樣的機器能同時處理多得多的請求。從「EF Core 入門」開始，所有資料庫操作都會是非同步的。

::: fastapi FastAPI 對照
和 Python 的 `async def` / `await` 概念一致。區別是 ASP.NET Core 中同步和非同步的處理常式可以混用，框架都能正確處理，不存在"在 async 函式裡呼叫同步阻塞程式碼會卡住事件迴圈"這類問題——但阻塞呼叫仍會浪費執行緒，所以涉及 I/O 時仍應使用非同步 API。
:::

## 總結

- C# 是**靜態型別**語言，`var` 只是讓編譯器推斷型別，型別本身在編譯期確定。
- `$"..."` 是**字串插值**；`string?` 表示**可為空**，配合 `?.` 和 `??` 安全地處理 `null`。可空檢查只發生在編譯期。
- **Lambda** 表示式 `x => ...` 是匿名函式，`MapGet` 等方法用它作為處理常式。
- **位置式 record** 能簡潔地定義資料型別，自帶值相等和 `with` 複製；本例的屬性使用 `init`，但 `record` 並不強制所有成員不可變。
- **LINQ** 用 `Where`、`Select` 等方法鏈式處理集合；**async/await** 讓等待 I/O 時不佔用執行緒。

下一章：[第一步](./first-steps)——寫出你的第一個 Web API。上一章：[環境準備](./setup)。
