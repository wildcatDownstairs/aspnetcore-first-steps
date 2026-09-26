---
title: FastAPI ↔ ASP.NET Core 対照表
description: FastAPI の経験がある開発者向けの概念対照表です。ASP.NET Core Minimal API での対応する書き方をすばやく確認できます。
prev: false
next: false
pageClass: page-cheatsheet
---

# FastAPI ↔ ASP.NET Core 対照表

FastAPI を使ったことがあれば、ASP.NET Core Minimal API にも共通する考え方が多いと気付くでしょう。関数でエンドポイントを定義し、型でパラメーターを宣言し、OpenAPI ドキュメントを自動生成します。この表では、すでに知っている知識を対応付けて整理します。

::: warning 注意
この対照表は理解を助けるための類推であり、両者の動作が完全に同じという意味ではありません。大きな違いがある箇所には明記しています。詳しくは各章を参照してください。
:::

## プロジェクトとツール

| FastAPI / Python | ASP.NET Core / .NET | 説明 | 章 |
| --- | --- | --- | --- |
| `python` + `pip` + `venv` | `dotnet` CLI | 実行、依存関係管理、ビルドを1つのツールで扱えます。仮想環境は不要です | [環境準備](/ja/tutorial/setup) |
| `pyproject.toml` | `.csproj` プロジェクトファイル | ターゲットフレームワークと依存パッケージを宣言します | [環境準備](/ja/tutorial/setup) |
| PyPI | NuGet | パッケージレジストリ | [環境準備](/ja/tutorial/setup) |
| `pip install xxx` | `dotnet add package Xxx` | 依存関係を追加します | [はじめの一歩](/ja/tutorial/first-steps) |
| uvicorn | Kestrel | Web サーバーです。Kestrel はアプリに組み込まれており、別途起動する必要はありません | [はじめの一歩](/ja/tutorial/first-steps) |
| `fastapi dev` / `uvicorn --reload` | `dotnet watch` | 開発中に自動で再読み込みします。ホットリロードに対応した変更ならプロセスの再起動は不要です | [開発ツールの練習](/ja/tutorial/development-tools) |

## エンドポイントの定義

| FastAPI / Python | ASP.NET Core / .NET | 説明 | 章 |
| --- | --- | --- | --- |
| `app = FastAPI()` | `builder` + `app = builder.Build()` | .NET では「サービスの登録」と「リクエストの処理」を2つの段階に分けます | [はじめの一歩](/ja/tutorial/first-steps) |
| `@app.get("/")` | `app.MapGet("/", ...)` | デコレーターではなくメソッド呼び出しでエンドポイントを登録します | [はじめの一歩](/ja/tutorial/first-steps) |
| `dict` を返す | 匿名型 `new { ... }` または `record` を返す | JSON に自動シリアライズされ、プロパティ名は camelCase に変換されます | [はじめの一歩](/ja/tutorial/first-steps) |
| `/docs` | `/scalar`（Scalar.AspNetCore） | 対話型ドキュメントです。.NET では生成と表示が別々のパッケージに分かれています | [はじめの一歩](/ja/tutorial/first-steps) |
| `/openapi.json` | `/openapi/v1.json` | OpenAPI ドキュメントです。.NET 10 は既定で OpenAPI 3.1 を生成します | [はじめの一歩](/ja/tutorial/first-steps) |

## リクエストパラメーター

| FastAPI / Python | ASP.NET Core / .NET | 説明 | 章 |
| --- | --- | --- | --- |
| `/items/{item_id}` + `item_id: int` | `/items/{id:int}` + `int id` | 名前によるバインドと型変換 | [ルートパラメーター](/ja/tutorial/path-params) |
| 宣言順にルートを照合 | 優先順位に基づいてルートを照合 | **違い**：.NET では登録順はマッチ結果に影響しません | [ルートパラメーター](/ja/tutorial/path-params) |
| `{file_path:path}` | `{*path}` | `/` を含む残りのパスに一致します | [ルートパラメーター](/ja/tutorial/path-params) |
| クエリパラメーター `q: str \| None = None` | `string? q` | nullable 型で省略可能なパラメーターを表します | [クエリパラメーター](/ja/tutorial/query-params) |
| リクエスト本文に Pydantic モデル | リクエスト本文に `record` | JSON を強い型付けのオブジェクトに自動バインドします | [リクエスト本文](/ja/tutorial/request-body) |
| `Field(ge=1)` などの検証 | Data Annotations と .NET 10 の組み込み検証 | | [パラメーター検証](/ja/tutorial/validation) |
| `Header()` / `Cookie()` | `[FromHeader]` / `HttpRequest.Cookies` | .NET に `[FromCookie]` 属性はありません。Cookie はリクエストオブジェクトから読み取ります | [ヘッダーと Cookie](/ja/tutorial/headers-cookies) |

## レスポンスとエラー

| FastAPI / Python | ASP.NET Core / .NET | 説明 | 章 |
| --- | --- | --- | --- |
| `response_model` | `TypedResults` と `Results<T1, T2>` | 型付き結果はハンドラーの戻り値を制約し、ドキュメント用メタデータを提供します。Pydantic の実行時レスポンス検証やフィルタリングと同じではありません | [レスポンス型](/ja/tutorial/response-types) |
| `HTTPException` | `TypedResults.NotFound()`、ProblemDetails | | [ステータスコードとエラー処理](/ja/tutorial/errors) |
| `APIRouter` | `app.MapGroup(...)` | ルートのグループ化と共通プレフィックス | [ルートグループ](/ja/tutorial/route-groups) |

## アプリケーションの骨格

| FastAPI / Python | ASP.NET Core / .NET | 説明 | 章 |
| --- | --- | --- | --- |
| `Depends()` | 依存性注入コンテナー `builder.Services` | .NET には組み込みの DI コンテナーがあり、3種類のライフタイムを指定できます | [依存性注入](/ja/tutorial/dependency-injection) |
| `pydantic-settings` | 構成システム + Options パターン | appsettings.json、環境変数、User Secrets を利用します | [構成と Options](/ja/tutorial/configuration) |
| `@app.middleware("http")` | `app.Use(...)` ミドルウェア | パイプライン方式で、実行順序が重要です | [ミドルウェア](/ja/tutorial/middleware) |
| `logging` | `ILogger<T>` | 構造化ログ | [ログ](/ja/tutorial/logging) |

## データ、セキュリティ、本番公開

| FastAPI / Python | ASP.NET Core / .NET | 説明 | 章 |
| --- | --- | --- | --- |
| SQLAlchemy / SQLModel | EF Core | ORM です。`DbContext` がエンティティの変更を追跡して保存します | [EF Core 入門](/ja/tutorial/efcore-basics) |
| relationship / クエリ式 | ナビゲーションプロパティ、LINQ、`Include` | リレーションの宣言、プロジェクション、関連オブジェクトの読み込みを区別します | [リレーションとクエリ](/ja/tutorial/relations-queries) |
| Session 内でエンティティを変更してコミット | 追跡対象のエンティティ + `SaveChangesAsync()` | 入力 DTO とデータベースのエンティティを分けます | [CRUD 全体](/ja/tutorial/crud) |
| Alembic | EF Core マイグレーション（`dotnet ef`） | スキーマの更新に使用します。第23章ではマイグレーションで更新を管理します | [データベースのマイグレーション](/ja/advanced/efcore-migrations) |
| `OAuth2PasswordBearer` + JWT 検証ロジック | `AddJwtBearer` + `RequireAuthorization()` | FastAPI の認証情報抽出は JWT 検証と同じではありません。ローカル用トークンは `dotnet user-jwts` で生成します | [認証（JWT）](/ja/tutorial/authentication) |
| `Security()` / 依存関係の中で権限を確認 | 名前付きポリシー + `RequireAuthorization()` | この例では editor ロールに書き込みを制限します | [認可](/ja/tutorial/authorization) |
| `CORSMiddleware` | `AddCors` + `UseCors` | ブラウザーのクロスオリジンアクセスを許可します。認証や認可の代わりにはなりません | [CORS](/ja/tutorial/cors) |
| `TestClient` | `WebApplicationFactory` | アプリをメモリ内で起動して統合テストを実行します | [テスト](/ja/tutorial/testing) |

SQL に慣れている方は、[EF Core / LINQ ↔ PostgreSQL 対照表](./efcore-sql-cheatsheet)もご覧ください。クエリ、ページング、リレーション、追加・更新・削除を比較できます。
