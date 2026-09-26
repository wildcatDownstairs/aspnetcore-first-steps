---
title: テスト
description: xUnit と WebApplicationFactory を使い、Todo API の手動確認を統合テストに置き換えて、レスポンス、データ、アクセス権を検証します。
---

# テスト

コードを変更するたびに curl を手動で送ると、エラーケースを見落としやすくなります。この章では「タスクを作成し、読み直して確かめる」操作を**統合テスト**（integration test）にします。リクエストをルーティング、検証、認証、ハンドラー、SQLite に通し、結果を確認します。

まず、最初のテストファイル全体を見ます。API は第 20 章のものを引き継ぎ、本章で `Tests` プロジェクトを追加します。

<<< @/../samples/21-testing/Tests/CreateTodoTests.cs{6-19 cs:line-numbers} [Tests/CreateTodoTests.cs]

このファイルが必要とするテストファクトリーとプロジェクト構成は、リポジトリに含まれています。

:::: details テストファクトリーとプロジェクト構成の全体
::: code-group

<<< @/../samples/21-testing/Tests/TodoApiFactory.cs{16-20,26-43 cs:line-numbers} [Tests/TodoApiFactory.cs]

<<< @/../samples/21-testing/Tests/TodoApi.Tests.csproj{10-15 xml:line-numbers} [Tests/TodoApi.Tests.csproj]

<<< @/../samples/21-testing/global.json{json:line-numbers} [global.json]

<<< @/../samples/21-testing/TestAccess.cs{cs:line-numbers} [TestAccess.cs]

<<< @/../samples/21-testing/Testing.csproj{xml:line-numbers} [Testing.csproj]

:::
::::

## 実行して確認する

リポジトリのルートから実行します。

```bash
cd samples/21-testing
dotnet test --project Tests/TodoApi.Tests.csproj
```

事前に `dotnet run` したり、開発用 JWT を生成したりする必要はありません。概要には次のような結果が表示されます。実行時間と完全なパスは環境によって異なります。CLI の表示言語によって文言も変わります。以下は英語表示の例です。

```text
Test run summary: Passed!
  total: 11
  failed: 0
  succeeded: 11
  skipped: 0
```

この例では **xUnit** テストフレームワークを使い、本章の `global.json` で .NET 10 の **Microsoft Testing Platform（MTP）** テストランナーを選んでいます。そのため `--project` でテストプロジェクトを指定します。SDK がこの構成を見つけられるよう、本章のディレクトリから実行してください。xUnit パッケージ名の `v3` は製品シリーズ名で、パッケージのバージョン番号と必ずしも同じではありません。[xUnit の入門](https://xunit.net/docs/getting-started/v3/getting-started)

## 1 つのテストで何を確認するか

`[Fact]` は 1 つのテストを表します。メソッド名で確認対象の動作を示しています。作成が成功すると、保存されたデータを読み取れることです。メソッドは次の 3 段階で構成されています。

1. テストアプリを作り、editor ID を持つ `HttpClient` を取得します。
2. `/todos` に JSON リクエストを送ります。
3. **アサーション**（assertion）でステータスコード、Location、再取得したタスクの内容を確認します。

`PostAsJsonAsync` はオブジェクトを JSON にシリアライズし、リクエストの Content-Type を設定します。`GetFromJsonAsync<TodoResponse>` はレスポンスを指定型にデシリアライズします。ここでは既存の DTO を使うため、JSON 文字列を手動で解析する必要はありません。

`201` だけを確認しないのはなぜでしょうか。ハンドラーが成功を返していても、タスクを保存していなかったり、Location が間違った ID を指していたりする可能性があります。再び読み取ることで、クライアントが受け取った URL が実際に使えることを確かめます。

`TestContext.Current.CancellationToken` はテストランナーから渡され、テストがキャンセルされたときに未完了の HTTP 操作を中断できます。`using` と `await using` はテスト終了後にクライアント、テストアプリ、データベース接続を解放します。

## WebApplicationFactory の役割

`WebApplicationFactory<Program>` はテストホストを作り、`HttpClient` のリクエストをテストサーバーで処理します。実際のポート 5080 は使用しません。`Program` はアプリケーションのエントリーポイントを表します。`TestAccess.cs` で宣言した公開部分により、HTTP エンドポイントを増やさずに別プロジェクトからこの型を参照できます。

名前に Mvc が含まれる `Microsoft.AspNetCore.Mvc.Testing` は Minimal API のテストにも使え、コントローラーを追加する必要はありません。[ASP.NET Core の統合テスト](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0)

テストファクトリーでは 2 つの構成を差し替えます。

| 構成 | テストでの扱い | 理由 |
| --- | --- | --- |
| データベース | ファクトリーごとに別の SQLite インメモリ接続を開く | 練習用データベースファイルを読み書きせず、テスト間で ID が競合しないようにする |
| JWT | ファクトリーごとにランダム署名キーを生成し、短期テストトークンを作る | ローカルの User Secrets や外部 ID サービスに依存しない |

SQLite の実際のプロバイダーと JWT の検証ハンドラーはそのまま使います。データベースの場所と信頼する発行者の構成だけを変え、「アクセス許可」を固定しているわけではありません。ファクトリー内のトークン発行コードはテストプロジェクトにだけあり、ログイン API ではありません。

::: info 技術詳細
SQLite のインメモリデータベースは接続が閉じると消えるため、ファクトリーは最初に接続を開き、テストアプリを解放してから閉じます。古い `DbContextOptions` とその構成登録も削除し、2 種類の接続構成が同時に有効にならないようにする必要があります。同じファクトリー内のリクエストはこのテスト DB を共有します。この例では各テストが個別のファクトリーを作り、順番にリクエストを送ります。
:::

## エラーケースも確認する

残りのテストを含むファイル全体は次のとおりです。

::: details 検証、認証、ロール、更新・削除のテスト
<<< @/../samples/21-testing/Tests/TodoApiTests.cs{cs:line-numbers} [Tests/TodoApiTests.cs]
:::

`[Theory]` と `[InlineData]` を組み合わせると、同じテストコードで複数の入力を検証できます。空のタイトルには 2 ケースがあり、書き込み禁止の確認には POST、PUT、DELETE の 3 ケースがあります。そのためテストメソッド数と最終ケース数は一致しません。

これらのテストはステータスコードだけではなく、次の内容も調べます。

- タイトルが空、またはカテゴリが存在しない場合は 400 が返り、一覧は空のままです。
- 存在しない ID には 404 が返ります。
- トークンがない、または無効な場合は 401 が返ります。
- 読み取り専用ユーザーが作成、更新、削除を試みると 403 が返り、タスクと件数は変わりません。
- editor が更新した後に再取得し、削除してから再検索することで、保存の成功と 404 を順番に確認します。

## 故意に誤りを入れてみる

本章の `Program.cs` で POST の登録から `RequireAuthorization("CanWriteTodos")` を一時的に外し、グループの認証要件は残してテストを実行します。

`Reader_cannot_write` の POST ケースは失敗するはずです。期待値は `Forbidden`（403）ですが、実際は `Created`（201）になります。これで読み取りユーザーに書き込み権限が与えられたことが分かります。ポリシーの呼び出しを戻すと、11 ケースすべてが再び成功します。

この確認があれば、第 22 章でファイルを分割するときに判断できます。ファイルの場所を変えても、クライアントから見た動作は維持されるべきです。

::: warning 注意
これは API の統合テストであり、ブラウザーが CORS を実行するか、リバースプロキシ、TLS、外部 ID サービスのログイン手順が正しく動くかは検証しません。ブラウザーやデプロイ環境に関わる動作は、それぞれの環境で確認してください。
:::

::: fastapi FastAPI との比較
pytest と TestClient で FastAPI アプリを呼び出し、ステータスコードと JSON をアサートする方法に似ています。ここでは WebApplicationFactory がテストアプリを作り、テストファクトリーがデータベースと認証の構成を置き換えます。
:::

## まとめ

- 統合テストは複数のコンポーネントを通したリクエストを検証します。API を手動で起動する必要はありません。
- `[Fact]` は単一ケース、`[Theory]` は同じコードで複数の入力を検証します。
- 成功レスポンスでは内容と再取得結果を確認し、書き込みの拒否ではデータが変わっていないことも確認します。
- 各テストで独立したデータベースと署名キーを使うため、実行順に依存しません。
- リファクタリング前後でテストを実行し、レスポンスと権限の変化をすぐに検出します。

次章：[機能ごとにプロジェクトを整理する](./project-structure)——同じ機能のコードをまとめます。前章：[CORS](./cors)。
