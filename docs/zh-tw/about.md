---
title: 關於
description: 關於 ASP.NET Core 第一步教學：寫給誰、怎麼寫、如何參與。
prev: false
next: false
---

# 關於本教學

## 寫給誰

本教學寫給**有程式設計經驗、但沒寫過 C# 或 ASP.NET Core** 的開發者。你可能寫過 Python（FastAPI、Flask、Django）、Node.js，或者主要做前端。讀完主線之後，你應該能夠獨立寫出一個帶資料庫和身分驗證、可以部署上線的 Web API。

## 技術範圍

- **.NET 10（LTS）與 C# 14**：所有程式碼都基於 .NET 10 的寫法，不涉及 `Startup.cs` 等舊模式；
- **只講 Minimal API**：不講 MVC Controller、Razor Pages 和 Blazor，把篇幅集中在一條路線上；
- **EF Core + SQLite**：資料庫零安裝，克隆儲存庫就能執行；
- **內建 OpenAPI + Scalar**：每個範例都自帶互動式 API 文件。

## 寫作原則

- **一頁只引入一個新概念**。頁面開頭先給出完整程式碼，再逐段拆解。
- **程式碼都能直接執行**。教學中的程式碼全部引用自儲存庫 `samples/` 目錄下的真實專案，不在文件裡手寫；持續整合（CI）會在每次提交時編譯所有範例，任何一個編譯失敗都無法發佈。
- **解釋"為什麼"**，而不只是"怎麼用"。
- **給出預期輸出**，讓你能確認自己做對了。

本教學的結構和教學方法受到 FastAPI 官方教學的啟發，但所有文字與範例均為原創。

## 參與貢獻

發現錯誤、有不清楚的地方，或者希望增加某個主題，歡迎在 GitHub 儲存庫提交 Issue 或 Pull Request。每一頁底部都有"在 GitHub 上編輯此頁"的連結。
