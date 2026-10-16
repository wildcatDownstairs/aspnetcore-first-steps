---
title: 相依性注入
description: 把資料存取封裝成服務並註冊到容器，由框架在需要時建立和傳入；理解 Singleton、Scoped、Transient 三種生命週期，以及為什麼資料庫上下文是 Scoped。
---

# 相依性注入

前面的處理常式直接讀寫 `Program.cs` 中的清單。這一章把清單和讀寫操作放進 `InMemoryTodoStore`，再讓框架把這個物件傳給處理常式。

這種由外部提供所需物件的做法叫**相依性注入**（dependency injection，DI）。先看程式碼裡少了什麼：處理常式不再管理清單，也不用自己建立儲存物件，只要宣告一個 `ITodoStore` 參數。

<<< @/../samples/11-dependency-injection/Program.cs{7-10,22,24,30-38,46-75 cs:line-numbers} [11-dependency-injection/Program.cs]

## 執行與驗證

先停止上一章的服務，從儲存庫根目錄執行：

```bash
cd samples/11-dependency-injection
dotnet run
```

待辦事項 API 的用法和之前一樣：

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'
```

```json
{"id":1,"title":"Buy milk","done":false}
```

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Buy milk","done":false}]
```

另外有一個演示端點 `/lifetimes`，連續請求兩次：

```bash
curl http://localhost:5080/lifetimes
curl http://localhost:5080/lifetimes
```

```json
{"singleton":["91e834bc","91e834bc"],"scoped":["87edf2ac","87edf2ac"],"transient":["d4f30286","a151a3a5"]}
{"singleton":["91e834bc","91e834bc"],"scoped":["16f8e1fc","16f8e1fc"],"transient":["6e9ab485","c3b925ae"]}
```

每個編號代表一個物件執行個體，你看到的編號會不同，但**哪些相同、哪些不同**的規律是一樣的。這個規律是本節後半部分的重點。

## 把資料存取變成服務

<<< @/../samples/11-dependency-injection/Program.cs{46-75 cs:line-numbers} [11-dependency-injection/Program.cs]

第 46～50 行定義了一個**介面**（interface）`ITodoStore`，它只描述"能做什麼"：獲取全部、新增一項。第 52～75 行的 `InMemoryTodoStore` 是它的一個**實作**，用記憶體清單完成這些操作。按慣例，介面名稱以大寫字母 `I` 開頭。

這樣的類別在相依性注入中叫做**服務**（service）：一個為應用程式其他部分提供某種能力的物件。

## 註冊服務

<<< @/../samples/11-dependency-injection/Program.cs{7 cs:line-numbers} [11-dependency-injection/Program.cs]

「第一步」中說過，`builder.Services` 是"應用程式在執行階段需要用到的元件清單"。現在你自己往清單裡加了一項。第 7 行的意思是：

> 當有人需要 `ITodoStore` 時，提供一個 `InMemoryTodoStore`。

管理這份清單、負責建立物件的元件叫**相依性注入容器**（DI container）。`AddOpenApi()` 這類方法，內部做的也是同樣的事情：一次註冊若干個框架自己的服務。

## 使用服務

<<< @/../samples/11-dependency-injection/Program.cs{22,24-28 cs:line-numbers} [11-dependency-injection/Program.cs]

處理常式宣告一個 `ITodoStore` 參數。它沒有顯式指定繫結來源，而這個型別已經註冊為服務，框架就從容器取出執行個體傳進來，不從請求本文讀取。

服務參數不屬於 HTTP 請求的一部分，所以不會出現在 OpenAPI 文件中；`/scalar` 頁面裡，`GET /todos` 依然顯示為沒有參數。

如果在每次請求裡 `new InMemoryTodoStore()`，每次得到的都是空清單。交給容器後，我們可以透過註冊方式決定哪些請求共享物件，而不用在每個處理常式裡重複管理它。

`ITodoStore` 演示的是另一件事：處理常式只呼叫介面中的方法，因此可以換一個實作用於測試。**相依性注入並不要求每個類別都配一個介面**，也可以直接註冊具體類別。第 15 章會直接注入 `TodoDbContext`，讓你先看清資料庫操作，不再套一層儲存介面。

::: fastapi FastAPI 對照
這類似 FastAPI 的 `Depends(get_store)`：處理常式宣告所需物件，由框架提供。這裡按已註冊的型別查詢服務；是否共享同一個執行個體，取決於下面的生命週期設定。
:::

::: warning 注意
如果忘了第 7 行的註冊，編譯不會報錯，第一次請求 `GET /todos` 時會得到 500：

```text
System.InvalidOperationException: Body was inferred but the method does not allow inferred body parameters.
Below is the list of parameters that we found:

Parameter           | Source
---------------------------------------------------------------------------------
store               | Body (Inferred)


Did you mean to register the "Body (Inferred)" parameter(s) as a Service or apply the [FromServices] or [FromBody] attribute?
```

框架不認識 `ITodoStore`，就按規則把這個複雜型別當成了請求本文，而 GET 請求不允許有推斷出來的請求本文。錯誤資訊的最後一句已經給出了答案：把它註冊為服務。
:::

## 三種生命週期

<<< @/../samples/11-dependency-injection/Program.cs{8-10,30-38,77-86 cs:line-numbers} [11-dependency-injection/Program.cs]

第 77～86 行定義了三個幾乎一樣的"標記"類別，每個執行個體在建立時產生一個隨機編號。第 8～10 行用三種不同的方法註冊它們，第 30～38 行的處理常式把每種型別**各要了兩次**，回傳它們的編號。對照開頭的兩次請求結果：

| 註冊方法 | 生命週期 | 同一請求內兩次獲取 | 不同請求之間 |
| --- | --- | --- | --- |
| `AddSingleton` | **Singleton**（單例） | 同一個執行個體 | 同一個執行個體 |
| `AddScoped` | **Scoped**（作用域） | 同一個執行個體 | 不同執行個體 |
| `AddTransient` | **Transient**（瞬時） | 每次都是新執行個體 | 每次都是新執行個體 |

- **Singleton**：本例中所有請求共享一個執行個體，所以能保留記憶體清單。
- **Scoped**：每個作用域一個執行個體；在通常的 HTTP 請求中，同一個請求內共享，請求之間分開。
- **Transient**：每次向容器獲取時都新建一個執行個體。

`ITodoStore` 註冊為 Singleton，是因為資料必須在請求之間保留：如果註冊成 Scoped，每個請求拿到的都是一個新的空清單，剛建立的待辦事項下一次請求就消失了。

### Singleton 必須是執行緒安全的

同一時刻可能有多個請求在處理，它們拿到的是**同一個** Singleton 執行個體。所以 `InMemoryTodoStore` 用 `lock` 保護內部的清單（第 60、68 行）：同一時間只允許一個請求進入，避免兩個請求同時修改清單導致資料損壞。「請求本文」一章中那個"不是執行緒安全"的警告，在這裡解決了。

第 62 行回傳的是 `_todos.ToList()`，即清單的一份**副本**，而不是清單本身。否則呼叫方拿到清單後在鎖外讀取它，另一個請求可能正在修改。

::: info 技術細節
`Lock` 是 .NET 9 引入的專用鎖型別，本例用 C# 的 `lock` 陳述式進入和退出鎖。它保證同一時間只有一個執行緒執行受保護的程式碼段，不需要自己呼叫解鎖方法。
:::

## 為什麼 DbContext 是 Scoped

第 15 章會用到 EF Core 的 `DbContext`（資料庫上下文），它會記錄本次操作讀取和修改的物件。`AddDbContext` 預設用 Scoped 註冊：同一請求裡的程式碼可以共用它，請求結束後釋放，下一次請求重新開始。

它不是執行緒安全的，不能讓所有請求共享一個 Singleton。Scoped 也不會自動加鎖：即使在同一請求內，也不要用一個上下文同時執行多個資料庫操作。先記住這個限制，具體用法到第 15 章再看。

### 不要讓 Singleton 持有請求裡的 Scoped 服務

假如 `InMemoryTodoStore`（Singleton）的建構函式需要一個 `ScopedMarker`（Scoped），會怎樣？

Singleton 會一直持有建構時拿到的物件，原本應該按請求分開的 Scoped 服務就被長期留住了。如果它是 `DbContext`，多個請求還可能同時使用它。這種依賴被意外延長生命週期的情況叫**俘獲依賴**（captive dependency）。

在開發環境中，容器會在啟動時檢查這類錯誤，應用程式直接啟動失敗：

```text
Unhandled exception. System.AggregateException: Some services are not able to be constructed (Error while validating the service descriptor 'ServiceType: ITodoStore Lifetime: Singleton ImplementationType: InMemoryTodoStore': Cannot consume scoped service 'ScopedMarker' from singleton 'ITodoStore'.)
```

這裡要記住的是“不要直接把 Scoped 服務注入 Singleton”，不是“長生命週期一律不能依賴短生命週期”。例如 Singleton 可以接收 Transient，只是會長期持有當時建立的那一個執行個體；它不會在每次請求時自動換新。

::: warning 注意
預設的作用域檢查在開發環境開啟，在正式環境預設關閉。正式環境能啟動，不代表這組相依關係合理。[服務作用域檢查](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview#scope-validation)
:::

## 總結

- **相依性注入**：處理常式透過參數宣告需要的服務，由容器建立並傳入，而不是自己 `new`。
- 用 `builder.Services.AddSingleton<介面, 實作>()` 等方法註冊服務，也可以直接註冊具體類別，不必為每個服務建立介面。
- 已註冊的服務型別會被自動識別為"來自容器"的參數，不會出現在 OpenAPI 文件中；忘記註冊會被當成請求本文而報錯。
- 三種生命週期：**Singleton** 在同一容器中共享（必須執行緒安全），**Scoped** 每個作用域一個，**Transient** 每次獲取時新建。
- `AddDbContext` 預設用 Scoped 註冊資料庫上下文；不要直接把 Scoped 服務注入 Singleton，開發環境會檢查這類錯誤。

下一章：[設定與 Options](./configuration)——把可變的設定從程式碼中分離出來。上一章：[路由群組](./route-groups)。
