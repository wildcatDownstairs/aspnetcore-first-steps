---
title: 環境準備
description: 安裝 .NET 10 SDK 和 VS Code + C# Dev Kit，認識 dotnet 命令列，執行第一個 .NET 程式。
---

# 環境準備

本節只做一件事：**把 .NET 開發環境裝好，並確認它能工作。** 驗證的方式是執行下面這個小程式——它會列印出你機器上的 .NET 版本。

<<< @/../samples/00-setup/Program.cs{cs:line-numbers} [00-setup/Program.cs]

如果你執行它之後看到了類似下面的輸出，這一節就完成了：

```text
Hello, .NET!
.NET runtime version: 10.0.12
Operating system: Microsoft Windows 10.0.26200
```

下面一步一步來。

## 你需要準備什麼

| 工具 | 作用 | 是否必須 |
| --- | --- | --- |
| .NET 10 SDK | 編譯、執行 C# 程式的全部工具 | 必須 |
| VS Code + C# Dev Kit 擴充套件 | 編輯器，提供補全、錯誤提示、除錯 | 推薦（也可以用其他編輯器） |
| 一個終端 | 執行 `dotnet` 指令 | 必須 |
| curl | 在終端裡傳送 HTTP 請求，驗證 API | 推薦 |

## 安裝 .NET 10 SDK

先分清兩個詞：

- **SDK**（Software Development Kit，軟體開發工具組）：寫程式用的。包含編譯器、`dotnet` 命令列工具，**也包含執行階段**。
- **執行階段**（Runtime）：只負責執行已經編譯好的程式，通常裝在伺服器上。

開發機上裝 SDK 就夠了，不需要另外裝執行階段。

::: code-group

```powershell [Windows]
winget install Microsoft.DotNet.SDK.10
```

```bash [macOS]
brew install --cask dotnet-sdk
```

```bash [Linux]
# 各发行版的安装方式不同，请参考官方文档：
# https://learn.microsoft.com/dotnet/core/install/linux
```

:::

也可以直接到 [.NET 官方下載頁](https://dotnet.microsoft.com/download/dotnet/10.0) 下載安裝套件。

裝好之後**重新開啟一個終端**（讓新的 PATH 生效），然後執行：

```bash
dotnet --version
```

預期輸出是一個以 `10.0` 開頭的版本號，例如：

```text
10.0.100
```

::: tip 提示
如果你的機器上裝了多個版本的 SDK，`dotnet --list-sdks` 會把它們全部列出來。多個版本可以共存，互不影響。
:::

### 為什麼選 .NET 10

.NET 每年 11 月發佈一個大版本，**偶數版本是 LTS**（Long Term Support，長期支援版本），獲得 3 年的官方支援；奇數版本是 STS（標準期限支援），只有 2 年。

.NET 10 是 2025 年 11 月發佈的 LTS 版本，支援到 2028 年 11 月。對學習者來說，這意味著你現在學的寫法在未來幾年裡都是"目前寫法"，不會很快過時。本教學所有程式碼都基於 .NET 10 和它附帶的 C# 14。

::: warning 注意
網上很多 ASP.NET Core 教學基於 .NET 5 或更早的版本，裡面會有 `Startup.cs`、`ConfigureServices` 等寫法。這些是舊模式，在 .NET 10 中已經不需要了。遇到時請留意文章的發佈時間。
:::

## 安裝編輯器

推薦 [VS Code](https://code.visualstudio.com/) 加上微軟官方的 **C# Dev Kit** 擴充套件：

1. 安裝 VS Code；
2. 開啟擴充套件面板（`Ctrl+Shift+X`，macOS 為 `Cmd+Shift+X`），搜尋 **C# Dev Kit** 並安裝。它會順帶裝上基礎的 C# 擴充套件。

裝好之後，你會在編寫程式碼時獲得：成員補全、懸停檢視型別、即時的編譯錯誤提示（紅色波浪線）、一鍵除錯。在後面的章節裡，我們會大量依賴這些功能——**C# 是靜態型別語言，編輯器能在你執行程式之前就發現大部分錯誤**。

::: tip 提示
其他選擇也完全可以：JetBrains Rider（個人非商業用途免費）功能非常完整；Windows 使用者也可以使用 Visual Studio 2026。本教學只使用 `dotnet` 命令列，不依賴任何特定編輯器。
:::

## 認識 dotnet 命令列

`dotnet` 是 .NET 的統一入口，建立專案、新增相依套件、編譯、執行都透過它完成。本教學會反覆用到這幾個指令：

| 指令 | 作用 |
| --- | --- |
| `dotnet new <模板> -o <目錄>` | 用模板建立新專案 |
| `dotnet run` | 編譯並執行目前目錄的專案 |
| `dotnet watch` | 執行專案，並在程式碼變化時自動重新載入 |
| `dotnet build` | 只編譯，不執行 |
| `dotnet add package <套件名稱>` | 給專案新增一個 NuGet 相依套件 |

::: fastapi FastAPI 對照
`dotnet` 大致相當於把 `python`、`pip`、`venv` 合成了一個工具：專案檔案 `.csproj` 的角色類似 `pyproject.toml`，NuGet 相當於 PyPI。不需要虛擬環境——每個專案的相依套件由它自己的 `.csproj` 宣告。
:::

## 執行第一個程式

用 `console`（控制檯應用程式）模板建立一個專案：

```bash
dotnet new console -o HelloDotnet
cd HelloDotnet
```

`-o HelloDotnet` 表示輸出到 `HelloDotnet` 目錄，專案名也會取這個名字。開啟目錄，你會看到兩個檔案：

<<< @/../samples/00-setup/HelloDotnet.csproj{xml:line-numbers} [00-setup/HelloDotnet.csproj]

這是**專案檔案**，用 XML 描述"這個專案是什麼、怎麼建置"。現在只需要看懂其中三行：

- **第 5 行** `TargetFramework`：目標框架是 `net10.0`，也就是 .NET 10。
- **第 6 行** `ImplicitUsings`：隱式 using。開啟後，常用的命名空間（如 `System`）會被自動引入，所以程式碼裡可以直接寫 `Console`，而不用先寫 `using System;`。
- **第 7 行** `Nullable`：啟用可空引用型別檢查，讓編譯器幫你發現潛在的空引用錯誤。下一章會詳細介紹它。

另一個檔案是 `Program.cs`。把它的內容替換成本頁開頭的程式碼，然後執行：

```bash
dotnet run
```

第一次執行會先編譯，稍等幾秒後看到：

```text
Hello, .NET!
.NET runtime version: 10.0.12
Operating system: Microsoft Windows 10.0.26200
```

版本號和作業系統會因機器而異，只要執行階段版本以 `10.0` 開頭就對了。

::: info 技術細節
你可能注意到 `Program.cs` 裡沒有 `class`，也沒有 `Main` 方法，程式碼直接從第一行開始執行。這叫**最上層陳述式**（top-level statements）：編譯器會自動幫你產生 `Main` 方法並把這些程式碼放進去。它讓小程式（包括後面的 Web API）可以寫得很簡潔。

第 1 行的 `using System.Runtime.InteropServices;` 需要手動寫，是因為 `RuntimeInformation` 所在的命名空間不在隱式 using 的預設清單裡。
:::

## 準備好 curl

從第 02 章開始，我們會用 `curl` 向自己寫的 API 發請求。先執行 `curl --version` 確認它已經安裝；如果終端提示找不到指令，請先透過系統的套件管理器安裝 curl。

::: warning 注意
在 **Windows PowerShell 5.1**（Windows 自帶的藍色 PowerShell）中，`curl` 是 `Invoke-WebRequest` 的別名，行為和真正的 curl 完全不同。請在指令中寫成 `curl.exe`，或者改用 PowerShell 7、Git Bash、Windows Terminal 中的其他 shell。
:::

完成第 02 章後，可以閱讀[可選附錄：開發工具練習](./development-tools)，練習編譯診斷和 `dotnet watch`，不必現在學習。

## 總結

- 開發機只需要安裝 **.NET 10 SDK**，它自帶執行階段；`dotnet --version` 應輸出 `10.0.x`。
- .NET 10 是 **LTS** 版本，支援到 2028 年 11 月；看到 `Startup.cs` 的教學說明是舊寫法。
- 推薦 **VS Code + C# Dev Kit**，靜態型別讓編輯器能在執行前發現錯誤。
- `dotnet new`、`dotnet run`、`dotnet watch`、`dotnet add package` 是貫穿全教學的四個指令。
- `.csproj` 是專案檔案，`Program.cs` 使用**最上層陳述式**，從第一行開始執行。

環境就緒。下一章：[C# 速覽](./csharp-tour)——快速瞭解本教學會用到的 C# 語法。如果你已經熟悉 Java、TypeScript 等靜態型別語言，也可以直接進入[第一步](./first-steps)。
