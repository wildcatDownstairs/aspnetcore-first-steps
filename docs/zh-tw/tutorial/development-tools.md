---
title: 開發工具練習
description: 使用第 02 章的完整範例，練習編譯錯誤診斷和 dotnet watch 熱重新載入。
prev: false
next: false
---

# 開發工具練習

這是一份可選附錄。完成[第一步](./first-steps)後，可以用同一個專案練習編輯、編譯和重新執行的迴圈；跳過它不影響後續章節。

練習使用的完整程式碼如下。請在第 02 章建立的 `FirstSteps` 專案目錄中執行本頁指令；如果使用儲存庫範例，則進入 `samples/02-first-steps`。

<<< @/../samples/02-first-steps/Program.cs{15 cs:line-numbers} [02-first-steps/Program.cs]

## 讓編譯器幫你檢查

C# 是靜態型別語言，很多錯誤在執行之前就會被發現。試著把第 15 行的 `MapGet` 故意寫錯成 `MapGt`，編輯器會立即標出紅色波浪線；執行 `dotnet build` 會看到：

```text
Program.cs(15,5): error CS1061: “WebApplication”未包含“MapGt”的定义，并且找不到可接受第一个“WebApplication”类型参数的可访问扩展方法“MapGt”(是否缺少 using 指令或程序集引用?)
```

錯誤資訊告訴你：在第 15 行第 5 列，`WebApplication` 型別上沒有 `MapGt` 這個成員。程式根本不會啟動，更不會在某個請求到來時才崩潰。

實驗後把 `MapGt` 改回 `MapGet`，確認 `dotnet build` 成功，再繼續下面的操作。診斷資訊的語言會隨 SDK 的語言設定變化。

同樣，在 `app.` 後面輸入 `Map`，編輯器會列出所有可用的方法（`MapGet`、`MapPost`、`MapGroup`……）並顯示它們的參數說明。型別資訊能幫助編輯器補全程式碼，也能為 OpenAPI 提供回應結構，減少重複維護。

## 使用 dotnet watch 自動重新載入

如果之前啟動的服務還在執行，先在它的終端按 `Ctrl+C` 停止。然後在同一個專案目錄中改用：

```bash
dotnet watch
```

它會執行專案並監視檔案變化。啟動後把第 15 行的文字改成 `"Hello, Hot Reload!"` 並儲存，終端裡會出現：

```text
dotnet watch ⌚ File updated: .\Program.cs
dotnet watch 🔥 C# and Razor changes applied in 1029ms.
```

再次請求，內容已經變了，而且服務**沒有重新啟動**：

```bash
curl http://localhost:5080/
```

```json
{"message":"Hello, Hot Reload!"}
```

這叫**熱重新載入**（Hot Reload）：修改被直接套用到正在執行的程式中，記錄中的耗時會因機器而異。無法熱套用的修改可能觸發重新啟動提示；修改服務註冊等啟動設定後，應在 `dotnet watch` 終端按 `Ctrl+R` 重新啟動，確保已經執行過的啟動程式碼重新執行。

驗證完成後，將問候語改回 `"Hello, ASP.NET Core!"`，再按 `Ctrl+C` 停止服務，避免影響後續章節的輸出和連接埠。

::: fastapi FastAPI 對照
`dotnet watch` 相當於 `fastapi dev` 或 `uvicorn --reload`。對於支援熱套用的改動，.NET 可以保留處理序和記憶體狀態；發生重新啟動時，記憶體狀態仍會丟失。
:::

## 總結

- 編譯錯誤會指出檔案和位置，修正後用 `dotnet build` 確認。
- `dotnet watch` 監視程式碼變化，支援的改動可以熱套用，無需重新啟動處理序。
- 修改啟動設定後，用 `Ctrl+R` 重新啟動；重新啟動會丟失記憶體狀態。

回傳：[第一步](./first-steps)。繼續學習：[路由參數](./path-params)。
