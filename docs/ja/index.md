---
layout: home
title: ASP.NET Core はじめの一歩
titleTemplate: 日本語版 ASP.NET Core ステップアップチュートリアル
description: C# と ASP.NET Core をゼロから学びます。.NET 10 と Minimal API を使い、ルーティング、EF Core データベース、JWT 認証、テスト、Docker デプロイを段階的に習得できます。各章には実行可能なサンプルがあります。

hero:
  name: ASP.NET Core はじめの一歩
  text: 最初のエンドポイントから本番公開まで
  tagline: プログラミング経験はあるけれど、C# は初めてという方へ。.NET 10 と Minimal API を使い、一度に一つの概念を学びます。各章はそのまま dotnet run できる完成したプロジェクトです。
  actions:
    - theme: brand
      text: 学習を始める →
      link: /ja/tutorial/setup
    - theme: alt
      text: 学習ロードマップを見る
      link: /ja/tutorial/
    - theme: alt
      text: FastAPI 対照表を見る
      link: /ja/fastapi-cheatsheet

features:
  - title: 1ページにつき1つの概念
    details: 各ページの冒頭で完成形のコードを示し、続けて部分ごとに解説します。この章で追加した箇所は行単位でハイライトするので、新しい用語を一度に詰め込みません。
  - title: コードはすべてそのまま実行可能
    details: チュートリアルのコードはすべて、リポジトリ内の実際のサンプルプロジェクトから引用しています。CI ではコミットのたびにすべてのサンプルをビルドします。コピーして dotnet run するだけで動き、「ここは省略」といった箇所はありません。
  - title: 「なぜ」まで説明
    details: 書き方だけでなく、フレームワークがそのように設計されている理由も解説します。なぜ builder と app が分かれているのか、なぜルートは登録順で判定されないのか、といった疑問に答えます。
  - title: FastAPI との対比
    details: FastAPI を使ったことがある方に向けて、重要な概念ごとに類似点を簡潔に説明し、これまでの経験を活かせるようにします。
  - title: 型システムを活用
    details: C# の静的型付けを活かして、エディター補完、コンパイル時のエラー検出、自動生成される OpenAPI ドキュメントを、同じコードから実現します。
  - title: 本番公開まで学べる
    details: ルーティング、検証、依存性注入、EF Core + SQLite、JWT 認証、テスト、Docker デプロイを学び、読み終えるころには API を一通り自力で作れるようになります。
---

<div class="home-section" data-reveal>

<p class="eyebrow">30秒でプレビュー</p>

## Web API の完成形はわずか17行

<p class="lead">これは第02章の終わりに作るプログラムです。JSON を返すエンドポイントと、自動生成される対話型 API ドキュメントが含まれます。変更が必要な設定ファイルも、継承するひな形クラスもありません。</p>

<div class="home-grid">

<ol class="home-steps">
  <li><strong>プロジェクトを作成</strong><span><code>dotnet new web</code> を1回実行するだけで、最小構成の Web プロジェクトができます</span></li>
  <li><strong>エンドポイントを宣言</strong><span><code>MapGet</code> で URL と通常の関数を結び付けます。戻り値は自動的に JSON にシリアライズされます</span></li>
  <li><strong>実行</strong><span><code>dotnet watch</code> でサーバーを起動します。コードを変更すると自動でホットリロードされます</span></li>
  <li><strong>ドキュメントを開く</strong><span><code>/scalar</code> にアクセスし、ブラウザーからエンドポイントを直接テストできます</span></li>
</ol>

<<< @/../samples/02-first-steps/Program.cs{15 cs:line-numbers} [Program.cs]

</div>
</div>

<div class="home-section">

<p class="eyebrow">学習ロードマップ</p>

## 6つの段階を一つの流れで

<p class="lead">後の章は前の章の内容を前提としています。たとえば EF Core では依存性注入を使い、認証ではミドルウェアを使います。そのため、チュートリアルは順序立てた構成です。順番に読むことをおすすめします。</p>

<LearningPath />

</div>
