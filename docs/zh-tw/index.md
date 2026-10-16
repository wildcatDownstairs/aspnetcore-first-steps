---
layout: home
title: ASP.NET Core 第一步
titleTemplate: 繁體中文（台灣） ASP.NET Core 漸進式教學
description: 從零學習 C# 與 ASP.NET Core：基於 .NET 10 和 Minimal API，逐步掌握路由、EF Core 資料庫、JWT 身分驗證、測試與 Docker 部署，每章都有可執行範例。

hero:
  name: ASP.NET Core 第一步
  text: 從第一個 API 到上線
  tagline: 寫給有程式設計經驗、但沒碰過 C# 的你。基於 .NET 10 與 Minimal API，一步只學一個概念，每一章都是能直接 dotnet run 的完整專案。
  actions:
    - theme: brand
      text: 開始學習 →
      link: /zh-tw/tutorial/setup
    - theme: alt
      text: 檢視學習路線
      link: /zh-tw/tutorial/
    - theme: alt
      text: FastAPI 對照速查
      link: /zh-tw/fastapi-cheatsheet

features:
  - title: 一頁只學一個概念
    details: 每一頁開頭先給出最終的完整程式碼，再逐段拆解，並用行高亮標出本節新增的部分。不會一次塞給你十個新名詞。
  - title: 程式碼都能直接執行
    details: 教學中的每段程式碼都來自儲存庫裡真實的範例專案，CI 每次提交都會編譯全部範例。複製即可 dotnet run，沒有"此處省略"。
  - title: 講清"為什麼"
    details: 不止告訴你怎麼寫，也解釋框架為什麼這樣設計——為什麼要分 builder 和 app，為什麼路由不看註冊順序。
  - title: FastAPI 對照
    details: 如果你寫過 FastAPI，每個關鍵概念旁都有一兩句話的類比，幫你把已有經驗遷移過來。
  - title: 讓型別替你把關
    details: 充分利用 C# 的靜態型別：編輯器補全、編譯期報錯、自動產生的 OpenAPI 文件，都來自同一份程式碼。
  - title: 一路走到上線
    details: 路由、驗證、相依性注入、EF Core + SQLite、JWT 身分驗證、測試、Docker 部署——讀完能獨立寫出一個完整的 API。
---

<div class="home-section" data-reveal>

<p class="eyebrow">三十秒預覽</p>

## 一個完整的 Web API，只有 17 行

<p class="lead">這就是第 02 章結束時你會寫出的程式：一個回傳 JSON 的 API，外加自動產生的互動式 API 文件。沒有設定檔案要改，沒有樣板類別要繼承。</p>

<div class="home-grid">

<ol class="home-steps">
  <li><strong>建立專案</strong><span>一條 <code>dotnet new web</code> 指令得到一個最小的 Web 專案</span></li>
  <li><strong>宣告端點</strong><span><code>MapGet</code> 把 URL 和一個普通函式連起來，回傳值自動序列化為 JSON</span></li>
  <li><strong>執行</strong><span><code>dotnet watch</code> 啟動服務，改程式碼後自動熱重新載入</span></li>
  <li><strong>開啟文件</strong><span>存取 <code>/scalar</code>，在瀏覽器裡直接除錯你的 API</span></li>
</ol>

<<< @/../samples/02-first-steps/Program.cs{15 cs:line-numbers} [Program.cs]

</div>
</div>

<div class="home-section">

<p class="eyebrow">學習路線</p>

## 六個階段，一條主線

<p class="lead">後面的章節依賴前面的內容：EF Core 要用到相依性注入，身分驗證要用到中介軟體。所以教學是一條線性主線，建議按順序閱讀。</p>

<LearningPath />

</div>
