---
title: 公開とデプロイ
description: .NET SDK で Todo API を公開し、Docker Compose で本番環境を構成して、データベースのマイグレーションを実行し、SQLite のデータを永続化します。
---

# 公開とデプロイ

この章では第 22 章の Todo API を、別のマシンでも実行できるアプリケーションにします。主な問いは**コード公開後、構成とデータをどこに置くか**です。イメージにプログラムを含め、環境変数で構成を渡し、データボリュームにデータベースを保存します。

まずエントリーポイント全体を見ます。エンドポイントと機能別ディレクトリは前章のものを引き継ぎ、新たに独立したマイグレーションコマンドと稼働確認を追加しています。

<<< @/../samples/23-deployment/Program.cs{7,16,36-43 cs:line-numbers} [Program.cs]

:::: details 公開設定とデータベース初期化
::: code-group

<<< @/../samples/23-deployment/Deployment.csproj{xml:line-numbers} [Deployment.csproj]

<<< @/../samples/23-deployment/Features/Auth/AuthConfiguration.cs{8-15 cs:line-numbers} [Features/Auth/AuthConfiguration.cs]

<<< @/../samples/23-deployment/Data/TodoDatabase.cs{cs:line-numbers} [Data/TodoDatabase.cs]

<<< @/../samples/23-deployment/Data/TodoDbContext.cs{cs:line-numbers} [Data/TodoDbContext.cs]

:::
::::

## まずローカルで実行する

リポジトリのルートから実行します。

```bash
cd samples/23-deployment
dotnet run -- --migrate
dotnet user-jwts create --name alice --role editor
dotnet run
```

最初の実行コマンドはマイグレーションを適用して終了します。最後に `Database migration complete.` が表示されます。次に生成した開発用トークンでローカルデバッグし、サービスは引き続き `http://localhost:5080` で待ち受けます。

別のターミナルを開きます。

```bash
curl http://localhost:5080/health
```

```json
{"status":"ok"}
```

`/health` が確認するのは、プロセスが HTTP に応答できることだけで、**データベースや ID サービスの状態は確認しません**。それらの依存関係も検査するには、ASP.NET Core のヘルスチェック機能を使います。

::: warning 本章専用のデータベースを使う
本章では新しい `todos-23.db` を使い、マイグレーションでテーブルを作成します。第 15～22 章で `EnsureCreated` によって作ったデータベースを、そのままマイグレーションに使わないでください。この 2 つのテーブル作成方法は直接併用できません。既存データの更新が必要な場合は、先に[データベースマイグレーション](../advanced/efcore-migrations)を読んでください。
:::

## プログラムを公開し、イメージを作る

**公開**（publish）ではアプリケーションの実行に必要なアセンブリや構成を集めます。**コンテナーイメージ**（container image）にはさらにランタイムと OS の基本ファイルが含まれます。コンテナーはイメージから起動し、データは別に保存します。

通常の公開は次のように行えます。

```bash
dotnet publish -c Release -o ./publish
```

出力ディレクトリの `Deployment.dll` は、対応する ASP.NET Core ランタイムをインストールしたマシンで `dotnet Deployment.dll` として起動できます。公開物では `launchSettings.json` の開発環境設定は自動適用されません。本番起動の前に、後述する認証構成を指定してください。

この章では Dockerfile を別途管理せず、.NET SDK から Linux x64 のイメージを直接作成します。

```bash
dotnet publish -c Release --os linux --arch x64 /t:PublishContainer
```

既定では `todo-api:chapter23` がローカルのコンテナーランタイムに作られます。以降の手順では起動済みの Docker と Linux コンテナーを使います。対象マシンが ARM64 なら `x64` を `arm64` に替え、対応するマシンで実行してください。

イメージは `mcr.microsoft.com/dotnet/aspnet:10.0` をベースにし、アプリケーションは root 以外のユーザーで実行されます。この例で使う既定のユーザー ID は `1654` です。SDK からイメージレジストリに直接 push したり、アーカイブを作成したりすることもできます。[公式のコンテナー公開手順](https://learn.microsoft.com/en-us/dotnet/core/containers/sdk-publish)

## 本番環境を構成する

Docker Compose の設定全体は次のとおりです。**Docker Compose** では、起動するコンテナー、環境変数、データボリュームを 1 つのファイルに記述します。

<<< @/../samples/23-deployment/compose.yaml{yaml:line-numbers} [compose.yaml]

3 つのサービスにはそれぞれ役割があります。`init-data` はデータディレクトリの権限を準備し、`migrate` はデータベースを更新して終了し、`api` は HTTP サービスを継続して提供します。

環境変数のテンプレートをコピーします。

::: code-group

```powershell [PowerShell]
Copy-Item .env.example .env
```

```bash [Bash]
cp .env.example .env
```

:::

<<< @/../samples/23-deployment/.env.example{dotenv:line-numbers} [.env.example]

`.env` のプレースホルダー値を実際の構成に置き換えます。

| 構成 | 指定する値 |
| --- | --- |
| `Authority` | 信頼する ID サービスの HTTPS アドレス。JWT 検証に必要なメタデータと公開鍵を提供する必要がある |
| `Audience` | この API 向けに ID サービスで設定された対象者 ID |
| `Cors__Origins__0` | API の読み取りを許可するフロントエンドのオリジン。例：`https://todo.example.com`。末尾に `/` を付けない |

環境変数の二重アンダースコアは、構成パスのコロンに対応します。データベース接続文字列は Compose で個別に `/data/todos.db` に設定され、コンテナーの作業ディレクトリには依存しません。

::: warning 開発用トークンを本番で使わない
`dotnet user-jwts` はローカル開発用です。本章の本番構成は ID サービスが発行したアクセス トークンを信頼するように変更されています。この API を対象としたトークンをそのサービスから取得してください。書き込みにはサーバーが `editor` ロールを認識することも必要です。サービスによってロールのクレーム形式が異なるため、その形式に合わせてロールマッピングを設定します。

テンプレートのプレースホルダーアドレスを残したままでも `/health` と匿名アクセスの 401 は確認できますが、有効なトークンの認証はできません。ID サービスが接続済みである証明にはなりません。
:::

本番環境で HTTPS の `Authority` または `Audience` がない場合、この例は必要な構成がないことを示して起動を拒否します。この確認は構成が揃っているかを検証するだけで、リモート ID サービスの稼働を証明するものではありません。

## データベースを作成し、API を起動する

引き続き `samples/23-deployment` ディレクトリで実行します。

```bash
docker compose run --rm init-data
docker compose run --rm migrate
docker compose up -d api
```

`init-data` だけは root ユーザーでデータディレクトリの所有権を調整します。マイグレーションと API は一般ユーザーで実行します。ユーザーからのリクエストが更新中のテーブルに当たらないよう、マイグレーション成功後に API を起動します。

マイグレーションは `MigrateAsync()` で未適用の変更を反映し、適用済みのものは繰り返しません。本章のリポジトリには 2 つのマイグレーションが含まれます。最初に初期テーブルを作成し、次に Todo に null 許容の `Note` 列を追加します。この列は更新例のためのもので、HTTP リクエストやレスポンスにはまだ含まれていません。マイグレーションファイルと更新の確認は[データベースマイグレーション](../advanced/efcore-migrations)を参照してください。

実行結果を確認します。

```bash
curl http://localhost:5080/health
curl -i http://localhost:5080/todos
curl -i http://localhost:5080/openapi/v1.json
curl -i http://localhost:5080/scalar
```

| リクエスト | 期待する結果 |
| --- | --- |
| `/health` | 200、本文は `{"status":"ok"}` |
| `/todos`（トークンなし） | 401 |
| `/openapi/v1.json` | 404 |
| `/scalar` | 404 |

OpenAPI と Scalar は Development 環境でのみ登録されます。Production 環境にもエラー処理ミドルウェアはありますが、開発者向け例外ページを呼び出し元に公開しません。

## アプリケーションを更新してもデータを保持する

Compose は名前付きデータボリューム `todo-data` を `/data` にマウントします。コンテナーを置き換えてもデータベースはボリュームに残り、新しいコンテナーが引き続き使用できます。

ID サービスが発行した `editor` トークンで前章の作成 API を呼び出し、返されたタスク ID を控えます。その後コンテナーを作り直します。

```bash
docker compose up -d --force-recreate api
```

トークンを付けて `/todos/{id}` を再検索すると、先ほどのタスクを取得できます。`docker compose down` はコンテナーを停止して削除しますが、既定では名前付きボリュームを残します。データを削除すると確認できている場合を除き、`--volumes` や `-v` を付けないでください。

アプリケーションを更新するときは、まずデータベースをバックアップしてから新しいイメージを公開します。API を停止し、マイグレーションを実行してから API コンテナーを再作成します。この例は API が 1 インスタンスだけなので、その間は一時的にサービスを利用できません。SQLite のバックアップでは一貫した状態を取得してください。書き込み中に `.db` ファイルを単純にコピーするだけでバックアップが完了したと思ってはいけません。書き込みを停止してからコピーするか、SQLite のバックアップ機能を使います。

## ローカル検証からインターネット公開へ

ここでのポートマッピング `127.0.0.1:5080:8080` はホストマシンからのアクセスに限られます。Docker があるサーバーにイメージと Compose 構成を置き、同じマシンのリバースプロキシでドメインと HTTPS を設定して、`127.0.0.1:5080` に転送します。実際のフロントエンドオリジンも CORS 構成に追加してください。

プロキシによってリクエストのプロトコル、ホスト名、クライアントアドレスが変わる場合は、[プロキシと転送ヘッダーのドキュメント](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0)に従って信頼するプロキシを設定します。インターネットから届いた転送ヘッダーを無条件に信頼しないでください。

Cloudflare Pages はこのチュートリアルで作った静的ページのホスティング向けで、ASP.NET Core API を直接実行することはできません。API には .NET またはコンテナーを実行できるホストが必要です。

起動時の問題は次のコマンドで調べられます。

```bash
docker compose ps
docker compose logs --tail 100 api
docker compose logs --tail 100 migrate
```

| 状況 | まず確認する項目 |
| --- | --- |
| API 起動時に認証構成不足が報告される | `.env` が存在するか、Authority と Audience が設定されているか |
| SQLite ファイルを開けない、または読み取り専用と表示される | データボリュームのマウント先と `init-data` の成功 |
| トークンを付けても 401 | 発行者、対象者、署名、有効期限、ID サービスのメタデータが一致するか |
| 検索はできるが書き込みが 403 | トークンのロールが `editor` にマッピングされるか |

## 公開前の動作を自動検証する

```bash
dotnet test --project Tests/TodoApi.Tests.csproj -c Release -p:TreatWarningsAsErrors=true
```

この章には合計 13 のテストケースがあります。前章の 11 件に、本番環境の動作確認と既存データを保持するマイグレーションテストを追加しています。CI ではさらにイメージを作成し、Compose を起動してコンテナーを再作成した後もデータベースの記録が失われないことを確認します。

::: fastapi FastAPI との比較
FastAPI アプリケーションをコンテナーに入れる方法に似ています。プログラムはイメージに、環境構成は外部に、永続データはデータボリュームに置きます。コンテナーが認証構成やデータベース更新を自動的に済ませてくれるわけではありません。
:::

## まとめ

- 公開物にプログラムをまとめ、本番構成は環境変数で渡します。開発起動用の設定は正式環境には自動適用されません。
- .NET SDK からコンテナーイメージを直接作成でき、アプリケーションは一般ユーザーとして実行されます。
- データベースマイグレーションを実行してから API を起動します。既存データを更新する前にバックアップしてください。
- SQLite ファイルはデータボリュームに置き、コンテナーを作り直した後も保持します。
- 稼働確認の成功は最初の確認にすぎません。認証、認可、データの永続化、公開環境の HTTPS も検証してください。

前章：[機能ごとにプロジェクトを整理する](./project-structure)。主なチュートリアルはここで完了です。続けて必要に応じて[応用トピック](../advanced/)を参照してください。
