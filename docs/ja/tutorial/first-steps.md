---
title: 最初の一歩
description: dotnet new web でプロジェクトを作成し、MapGet で最初のエンドポイントを定義して、JSON レスポンスを実行・確認します。
---

# 最初の一歩

この節で学ぶ新しい概念は**エンドポイント**（endpoint）だけです。「特定の HTTP リクエストが届いたとき、どのコードを実行するか」を表します。JSON を返すエンドポイントを作り、自動生成される対話型 API ドキュメントも確認します。

この節で完成するコードです。

<<< @/../samples/02-first-steps/Program.cs{cs:line-numbers} [02-first-steps/Program.cs]

17 行で完全な Web API になります。この節では 15 行目のエンドポイントを理解することに集中します。起動処理とドキュメント設定はこのコードを使い、以下では実行に必要な要点だけを説明します。

## プロジェクトの作成

`web` テンプレートから空の Web プロジェクトを作り、依存パッケージを二つ追加します。

```bash
dotnet new web -o FirstSteps
cd FirstSteps
dotnet add package Microsoft.AspNetCore.OpenApi
dotnet add package Scalar.AspNetCore
```

- `Microsoft.AspNetCore.OpenApi`：コードから**OpenAPI ドキュメント**（API を記述した JSON）を生成する Microsoft 公式パッケージです。
- `Scalar.AspNetCore`：OpenAPI ドキュメントを**対話型 Web ページに描画する**オープンソースのサードパーティーパッケージです。

`Program.cs` を上記のコードに置き換えます。プロジェクトファイルは次のようになります。

<<< @/../samples/02-first-steps/FirstSteps.csproj{9-12 xml:line-numbers} [02-first-steps/FirstSteps.csproj]

ハイライトされた `ItemGroup` が `dotnet add package` によって追加された二つの依存関係です。

::: tip ヒント
バージョンを指定せず `dotnet add package` を実行すると、現在のプロジェクトと互換性のある最新の安定版がインストールされます。表示されるバージョン番号がここより新しくても問題ありません。
:::

### ポート番号を固定する

テンプレートは `Properties/launchSettings.json` でランダムなポート番号を割り当てます。チュートリアルの出力とそろえるため、すべての例で `5080` に変更しています。

<<< @/../samples/02-first-steps/Properties/launchSettings.json{8,10 json:line-numbers} [02-first-steps/Properties/launchSettings.json]

このファイルはローカル開発時（`dotnet run` が読み込みます）にだけ有効で、デプロイ時には使いません。10 行目では実行環境を `Development`（開発環境）に設定しています。後のコードを一行ずつ見るときに重要になります。

::: info 技術詳細
テンプレートは既定で `http` と `https` の二つの設定を生成します。このチュートリアルでは HTTP だけを残し、最初からローカル開発用証明書を扱わずに済むようにしています。本番環境の HTTPS は通常リバースプロキシまたはクラウドプラットフォームが処理します。「デプロイ」の章で説明します。
:::

## 実行と確認

```bash
dotnet run
```

次の出力が表示されたら、サーバーは起動しています。

```text
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5080
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to shut down.
info: Microsoft.Hosting.Lifetime[0]
      Hosting environment: Development
info: Microsoft.Hosting.Lifetime[0]
      Content root path: /your/path/FirstSteps
```

プログラムは終了せず、リクエストを待ち続けます。**別のターミナルを開いて**リクエストを送ります。

```bash
curl -i http://localhost:5080/
```

`-i` はレスポンスヘッダーも表示する指定です。出力例：

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Sat, 26 Sep 2026 08:56:22 GMT
Server: Kestrel
Transfer-Encoding: chunked

{"message":"Hello, ASP.NET Core!"}
```

ブラウザーで <http://localhost:5080/> を開いても確認できます。サービスを実行しているターミナルに戻り、`Ctrl+C` を押すと停止します。

:::: details 任意：対話型ドキュメントを確認する

サービスの実行中に <http://localhost:5080/scalar> を開くと、API ドキュメントのページが表示されます。左側にエンドポイントが並び、`GET /` を開くと **Test Request** をクリックしてリクエストを送信し、レスポンスを確認できます。

このページの元になるのは OpenAPI ドキュメントです。<http://localhost:5080/openapi/v1.json> を開くと生の内容を確認でき、`GET /` の記述は次のようになります。

```json
"paths": {
  "/": {
    "get": {
      "tags": ["FirstSteps"],
      "responses": {
        "200": {
          "description": "OK",
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/AnonymousTypeOfstring" }
            }
          }
        }
      }
    }
  }
}
```

**ドキュメントも注釈も書いていない**ことに注目してください。フレームワークがコードから推測しています。エンドポイントが `GET /` に応答することも、返り値が `message` という文字列プロパティを含む JSON オブジェクトであることも認識します。

::: fastapi FastAPI との比較
`/scalar` ページは FastAPI 標準の `/docs` に、`/openapi/v1.json` は `/openapi.json` に相当します。ASP.NET Core では「ドキュメントの生成」と「表示」を別々のパッケージが担うため、表示ツールを自由に選べます。
:::

::::

## コードを一行ずつ見る

### 3～7 行目：builder と app の二つの段階

<<< @/../samples/02-first-steps/Program.cs{3,5,7 cs:line-numbers} [02-first-steps/Program.cs]

**3 行目**の `WebApplication.CreateBuilder(args)` は**ビルダー**（builder）を作成します。Web アプリに必要な既定の設定、設定ファイルの読み込み、ログの設定、Web サーバーの準備などを行います。`args` はコマンドライン引数です。渡しておくと、起動時にコマンドラインから設定を上書きできます。

`var` は右辺の式からコンパイラーに変数の型を推論させます。VS Code で `builder` にマウスを合わせると、実際の型 `WebApplicationBuilder` が表示されます。**型は決まっていますが、自分で書かなくてよいのです。**

**5 行目**の `builder.Services` は**サービスコレクション**です。「実行時にアプリが必要とするコンポーネントの一覧」と考えてください。`AddOpenApi()` は OpenAPI ドキュメント生成に必要なコンポーネントを一覧に追加します。この時点では**登録するだけ**で、まだ何も生成しません。サービスの作成と利用は「依存性注入」の章で扱います。今は `builder.Services.AddXxx()` が「機能を登録する」書き方だと覚えておきましょう。

**7 行目**の `Build()` は、それまでの設定とサービス一覧からアプリ本体 `app`（型は `WebApplication`）を構築します。

::: info 技術詳細
二段階に分けるのはなぜでしょうか。先に `builder` で設定やサービスを登録し、その内容を使って `Build()` がアプリを作ります。その後、`app` でリクエストの処理を定義します。`Build()` の後、サービス登録コレクションは読み取り専用になり、登録の追加や削除ができません。ただし、サービスインスタンス内の可変状態を凍結するわけではなく、サービスインスタンスの並行実行安全性も保証しません。サービスの作成とライフサイクルは[依存性注入](./dependency-injection)の章で説明します。
:::

::: warning 注意
`builder.Services.AddXxx()` によるサービス登録は `Build()` より前に行う必要があります。後に行うと「サービスコレクションは読み取り専用」という例外が発生します。
:::

### 9～13 行目：開発環境だけでドキュメントを公開する

<<< @/../samples/02-first-steps/Program.cs{9-13 cs:line-numbers} [02-first-steps/Program.cs]

- `app.MapOpenApi()`：OpenAPI ドキュメントを `/openapi/v1.json` で公開します。
- `app.MapScalarApiReference()`：Scalar のドキュメントページを `/scalar` で公開します。

これらは `if (app.Environment.IsDevelopment())` の内側にあります。`app.Environment` の値は環境変数 `ASPNETCORE_ENVIRONMENT` から取得します。`launchSettings.json` では `Development` に設定しました。

**開発環境だけで有効にする理由は何でしょうか。** API ドキュメントにはすべての API とデータ構造が掲載され、攻撃者にとって格好の見取り図になり得ます。開発中は便利ですが、本番環境では既定で公開すべきではありません。これは Microsoft 公式ドキュメントが推奨する方法です。

### 15 行目：エンドポイントを定義する

<<< @/../samples/02-first-steps/Program.cs{15 cs:line-numbers} [02-first-steps/Program.cs]

この一行がこの節の中心です。**エンドポイント**は三つの要素から成ります。

| 要素 | この例 | 意味 |
| --- | --- | --- |
| HTTP メソッド | `MapGet` の **Get** | GET リクエストだけに応答 |
| ルートテンプレート（route template） | `"/"` | ルートパスだけに応答 |
| ハンドラー（handler） | `() => new { ... }` | リクエストが一致したときに実行するコード |

ハンドラーは **Lambda 式**（lambda expression）、つまり無名関数です。`()` はパラメーター一覧（ここでは引数なし）で、`=>` の後ろが戻り値です。同様に `MapPost`、`MapPut`、`MapDelete` など、別の HTTP メソッドに対応するメソッドもあります。

戻り値 `new { Message = "..." }` は**匿名型**（anonymous type）のオブジェクトです。事前にクラスを定義せず、一時的なオブジェクトを組み立てられます。フレームワークはこのオブジェクトを受け取ると、自動的に JSON に**シリアライズ**し、`Content-Type: application/json` を設定します。

コードではプロパティ名が大文字始まりの `Message` なのに、JSON では小文字始まりの `message` になっています。**これは意図した動作です。** C# ではプロパティに PascalCase（パスカルケース）を、JavaScript などのフロントエンドでは camelCase（キャメルケース）を使うのが慣例です。ASP.NET Core はシリアライズ時に既定で変換し、双方の慣例に合わせます。

::: tip ヒント
ハンドラーが文字列（たとえば `() => "Hello"`）を返す場合、フレームワークは文字列をそのまま出力し、`Content-Type` は `text/plain` になります。ほかのオブジェクトを返すと JSON にシリアライズされます。
:::

::: fastapi FastAPI との比較
15 行目は、FastAPI で `@app.get("/")` を使い、辞書を返す関数を装飾する書き方に相当します。ASP.NET Core はデコレーターを使わず、`MapGet` を呼び出して処理関数を「登録」します。
:::

### 17 行目：起動する

最後の `app.Run()` は Web サーバーを起動し、リクエストの待ち受けを開始します。`Ctrl+C` を押すまでブロックするため、通常は `Program.cs` の最後に置きます。

::: info 技術詳細
レスポンスヘッダーの `Server: Kestrel` は、リクエストを **Kestrel** が処理していることを示します。Kestrel は ASP.NET Core に組み込まれたクロスプラットフォーム Web サーバーです。ASP.NET Core 共有フレームワークの一部としてアプリケーションプロセス内で動作するため、別の Web サーバープロセスを起動する必要はありません。
:::

コンパイルエラーの診断やホットリロードを練習する場合は、[任意の付録：開発ツールの練習](./development-tools)を読んでください。この章でエンドポイントを理解するために必要な内容ではありません。

## まとめ

- `dotnet new web` は最小構成の Web プロジェクトを作成し、アプリ全体は `Program.cs` に記述します。
- 起動コードでは `builder` でサービスを準備し、`app` でエンドポイントを登録します。サービス登録は `Build()` より前に行います。
- **エンドポイント** ＝ HTTP メソッド + ルートテンプレート + ハンドラーです。`app.MapGet("/", () => ...)` は GET エンドポイントを定義します。返したオブジェクトは自動で JSON にシリアライズされ、プロパティ名は camelCase に変換されます。
- `AddOpenApi` + `MapOpenApi` + `MapScalarApiReference` はコードから対話型ドキュメントを自動生成します。安全のため、開発環境だけで有効にします。
- `dotnet run` でサービスを起動し、curl でレスポンスを確認します。`Ctrl+C` で停止します。

次の章：[ルートパラメーター](./path-params)——URL の一部をハンドラーのパラメーターとして扱います。前の章：[C# の概要](./csharp-tour)。
