---
title: 機能ごとにプロジェクトを整理する
description: feature-first で Todo API を構成し、同じ機能のエンティティ、DTO、サービス、エンドポイントをまとめ、テストでリファクタリング後も API の動作が変わらないことを確認します。
---

# 機能ごとにプロジェクトを整理する

現在の `Program.cs` には起動構成、認証、CRUD 全体が含まれています。Todo を変更するとき、関係のないコードの間を行き来して探す必要があります。この章では **feature-first（機能優先）**で分割し、同じ機能のエンティティ、DTO、サービス、エンドポイントを 1 つのディレクトリにまとめます。

これは**リファクタリング**（refactoring）です。エンドポイントのパス、リクエスト項目、レスポンス、権限は変わりません。分割後のエントリーファイルは次のとおりです。

<<< @/../samples/22-project-structure/Program.cs{3-5,14-15,35-37 cs:line-numbers} [Program.cs]

そのほかの全ファイルは機能ごとに以下に示します。この例は前章のプロジェクトを参照せず、単独で実行できます。

:::: details Todo 機能の全ファイル
::: code-group

<<< @/../samples/22-project-structure/Features/Todos/TodoEndpoints.cs{7-14 cs:line-numbers} [Features/Todos/TodoEndpoints.cs]

<<< @/../samples/22-project-structure/Features/Todos/TodoService.cs{7-14,17-24 cs:line-numbers} [Features/Todos/TodoService.cs]

<<< @/../samples/22-project-structure/Features/Todos/TodoDtos.cs{cs:line-numbers} [Features/Todos/TodoDtos.cs]

<<< @/../samples/22-project-structure/Features/Todos/Todo.cs{cs:line-numbers} [Features/Todos/Todo.cs]

:::
::::

:::: details 認証とデータベースの全ファイル
::: code-group

<<< @/../samples/22-project-structure/Features/Auth/AuthConfiguration.cs{cs:line-numbers} [Features/Auth/AuthConfiguration.cs]

<<< @/../samples/22-project-structure/Features/Auth/AuthEndpoints.cs{cs:line-numbers} [Features/Auth/AuthEndpoints.cs]

<<< @/../samples/22-project-structure/Data/TodoDbContext.cs{cs:line-numbers} [Data/TodoDbContext.cs]

<<< @/../samples/22-project-structure/Data/TodoDatabase.cs{cs:line-numbers} [Data/TodoDatabase.cs]

:::
::::

## アプリケーション起動前にテストする

リポジトリのルートから実行します。

```bash
cd samples/22-project-structure
dotnet test --project Tests/TodoApi.Tests.csproj
```

**11 件すべて成功、失敗 0 件、スキップ 0 件**となるはずです。テストのリクエストとアサーションは第 21 章と同じで、型を名前空間に移したため、テストにインポートを追加しただけです。

<<< @/../samples/22-project-structure/Tests/GlobalUsings.cs{cs:line-numbers} [Tests/GlobalUsings.cs]

手動で実行する場合は、ほかの章のサービスを停止してから、本章用の開発トークンを生成します。

```bash
dotnet user-jwts create --name alice --role editor --valid-for 1h --output token
dotnet run
```

別のターミナルで[第 18 章](./authentication)の方法を使い、完全なトークンを `TOKEN` 変数に保存してリクエストします。

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5080/todos
```

初回実行時、本章独自の `todos-22.db` にはタスクがないため `[]` が返ります。第 17～20 章の作成、更新、削除コマンドもそのまま使えます。

## まず機能を探し、次にファイルを探す

主要なコードは以下のディレクトリにあります。構成ファイルとテストも本章のプロジェクトに含まれています。

```text
22-project-structure/
├── Program.cs
├── Features/
│   ├── Todos/
│   │   ├── Todo.cs
│   │   ├── TodoDtos.cs
│   │   ├── TodoService.cs
│   │   └── TodoEndpoints.cs
│   └── Auth/
│       ├── AuthConfiguration.cs
│       └── AuthEndpoints.cs
├── Data/
│   ├── TodoDbContext.cs
│   └── TodoDatabase.cs
└── Tests/
```

たとえば Todo に編集可能なフィールドを追加する場合は、まず `Features/Todos` を開きます。保存用プロパティ、入出力型、処理ロジックがそこにあります。最初にグローバルな Models からエンティティを探し、次に Services でサービスを、最後に Endpoints でルートを探す必要はありません。

構成は [mini-store-api](https://github.com/wildcatDownstairs/mini-store-api) を参考にしています。エンティティ、DTO、Service、Endpoints はそれぞれの機能に置き、共有コンテキストは Data に残します。この例のカテゴリは固定値が 2 つだけで Todo 機能に属するため、Categories モジュールを別に作る必要はありません。

## ファイルごとの役割

| ファイル | 内容 | 変更例 |
| --- | --- | --- |
| `Todo.cs` | Todo と Category のエンティティ | データベースに保存するプロパティを追加する |
| `TodoDtos.cs` | リクエスト、レスポンス、本機能の操作結果型 | クライアントが送信できる項目を変更する |
| `TodoService.cs` | 検索、カテゴリの存在確認、保存処理 | タスクの業務ルールを変更する |
| `TodoEndpoints.cs` | ルート、権限、パラメーター受信、HTTP 結果 | パスや書き込み権限を調整する |
| `TodoDbContext.cs` | 共有テーブルの入口とデータベースマッピング | エンティティ間の関係を設定する |
| `Program.cs` | サービス登録、ミドルウェア配置、機能の登録 | 新しい機能の入口を追加する |

`TodoService` は `HttpContext` を受け取らず、400 と 404 のどちらを返すかも決めません。たとえば置き換え処理は `ReplaceOutcome` を返し、エンドポイントが HTTP 結果に変換します。ここでの **enum（列挙型）**は「更新成功」「タスクがない」「カテゴリがない」という 3 つの結果に名前を付け、数値から意味を推測しなくてもよいようにしています。

リクエスト項目の検証は引き続きエンドポイント上の組み込み機能で行い、カテゴリの存在確認は引き続きサービスがデータベースを検索します。ファイルの移動によって、この 2 つの責務は変わりません。

## MapTodoEndpoints で Program に接続する

`TodoEndpoints` は静的クラスです。`MapTodoEndpoints` の最初のパラメーターを `this WebApplication app` と書くのは**拡張メソッド**（extension method）です。これによりエントリーポイントから `app.MapTodoEndpoints()` と呼び出せます。内部ではおなじみの `MapGroup`、`MapGet`、`MapPost` を使います。

処理メソッドは長いラムダ式にせず、`MapGet` などにそのまま渡せます。11 行目の `GetAsync` はこのファイルにあるメソッド名です。[Minimal API のルートハンドラー](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis/route-handlers?view=aspnetcore-10.0)

`namespace TodoApi.Features.Todos;` は**名前空間**（namespace）宣言で、型の所属先を区別します。エントリーポイントでは `using TodoApi.Features.Todos` を使い、それらの型や拡張メソッドを利用します。検索しやすいようディレクトリと名前空間を対応させていますが、C# では両者を一致させる必要はありません。

::: info 技術詳細
C# 14 は拡張メンバーのブロックもサポートします。本章では `this` パラメーターを使う拡張メソッドの書き方を残しています。引き続きサポートされており、この例では 1 つのメソッドを定義するだけなので新しい構文を追加する必要がありません。
:::

## 共有 DbContext を Data に置く理由

業務エンティティは機能ごとに置きますが、1 つのリクエストが複数機能のデータを変更することがあります。共有コンテキストなら、複数の操作を 1 回の保存または同じトランザクションで完了できる可能性があります。機能ごとにディレクトリを作ることは、ディレクトリごとにデータベースを分けることを意味しません。

`TodoService` は Scoped として登録し、コンテキストの既定ライフタイムと合わせています。現在のプロジェクトでは実装が 1 つだけなので、具象クラスを直接注入できます。この章では `ITodoService` や Repository を追加していません。

空の Common ディレクトリを先に作る必要もありません。複数機能で共有するコードが実際に現れたとき、抽出するのが適切かを判断します。CORS 設定は API 全体に適用されるため、エントリーポイントに残しています。

## 分割する価値があるか

この Todo API は、エンドポイント内で DbContext を直接使っても動作します。ここでは mini-store-api の「エンドポイントが HTTP レスポンスを決め、サービスが業務処理を行う」という構成を示すため、Service を抽出しています。Minimal API に必須のルールではありません。

新しい機能に簡単な検索が 2 つだけなら、まず機能ディレクトリ内にエンドポイントと関連型を置けます。業務ルールが増えたり再利用が必要になったりしたときに、処理を Service に移します。ディレクトリは探す範囲を狭めるためのもので、すべての機能に同じ数のファイルを揃える要件ではありません。

::: fastapi FastAPI との比較
router、schema、業務関数を機能パッケージごとに整理し、アプリケーションの入口で router を登録する方法に似ています。ASP.NET Core では拡張メソッドでエンドポイントを追加し、依存性注入でサービスを提供します。
:::

## まとめ

- feature-first では同じ機能のエンティティ、DTO、サービス、エンドポイントをまとめます。
- エンドポイントは HTTP と権限を担当し、サービスはデータと業務ルールを処理し、共有コンテキストは Data に置きます。
- 拡張メソッドで機能のルートをエントリーポイントに接続します。Program.cs には起動構成とミドルウェアの順序を残します。
- ディレクトリの形を整えるためだけの空ファイルを作らず、単一実装のためにインターフェイス層を強制しません。
- 前章と同じリクエストとアサーションを使い、リファクタリング後も API の動作が変わらないことを確認します。

次章：[公開とデプロイ](./deployment)——整理したアプリケーションを公開します。前章：[テスト](./testing)。
