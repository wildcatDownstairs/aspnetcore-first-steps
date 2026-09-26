---
title: EF Core 入門
description: EF Core と SQLite でメモリ内リストを置き換え、DbContext、エンティティ、SaveChangesAsync を理解します。再起動後もデータが保持されることを確認します。
---

# EF Core 入門

これまでの Todo はメモリに保存され、サービスを再起動すると消えていました。この章では SQLite データベースに保存します。**Entity Framework Core（EF Core）** を使うと、C# オブジェクトでデータを読み書きし、SQL は EF Core が生成します。この種のツールを**オブジェクト関係マッピング**（object-relational mapping、ORM）と呼びます。

以下のハンドラーは `ITodoStore` を介さず、データベースコンテキストを直接受け取ります。パラメーター検証とエラー処理はこれまでの方法を引き継ぎます。全コードは 3 つのファイルに分かれています。

<<< @/../samples/15-efcore-basics/Program.cs{2,10-12,25-30,32-46 cs:line-numbers} [15-efcore-basics/Program.cs]

<<< @/../samples/15-efcore-basics/Models.cs{3-8 cs:line-numbers} [15-efcore-basics/Models.cs]

<<< @/../samples/15-efcore-basics/TodoDbContext.cs{3-6 cs:line-numbers} [15-efcore-basics/TodoDbContext.cs]

## 実行して確認する

リポジトリのルートでターミナルを開きます。

```bash
cd samples/15-efcore-basics
dotnet run
```

プロジェクトファイルで SQLite プロバイダーを宣言しているため、`dotnet run` が依存関係を復元します。SQLite サービスを別途インストールする必要はありません。

<<< @/../samples/15-efcore-basics/EfCoreBasics.csproj{9 xml:line-numbers} [15-efcore-basics/EfCoreBasics.csproj]

データベースの保存先は構成ファイルにあります。

<<< @/../samples/15-efcore-basics/appsettings.json{2-4 json:line-numbers} [15-efcore-basics/appsettings.json]

初回起動時にプロジェクトディレクトリ内に `todos-15.db` が作成されます。以下の出力は新しいデータベースを使ったものです。別のターミナルを開き、最初に検索してから Todo を作成します。

```bash
curl http://localhost:5080/todos
```

```json
[]
```

```bash
curl -i -X POST http://localhost:5080/todos -H "Content-Type: application/json" -d '{"title":"Buy milk"}'
```

レスポンスの抜粋（一般的な日付などのヘッダーは省略）です。

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /todos/1

{"id":1,"title":"Buy milk","done":false}
```

サービスを実行しているターミナルに戻って `Ctrl+C` を押し、`dotnet run` を再実行します。もう一度検索します。

```bash
curl http://localhost:5080/todos/1
```

```json
{"id":1,"title":"Buy milk","done":false}
```

再起動後も Todo を取得できるため、データが SQLite ファイルに書き込まれたことが分かります。

::: tip ヒント
各章はそれぞれ別のデータベースファイルを使います。練習を繰り返しても、既存データと ID は保持されます。新しい空のデータベースを使う場合は、サービスを停止して `dotnet run -- --ConnectionStrings:Todos="Data Source=practice-15.db"` を実行します。まだ存在しないファイル名を指定してください。既存データを削除する必要はありません。
:::

## エンティティ：データベースの 1 行

`Models.cs` の `Todo` は**エンティティ**（entity）で、テーブルの 1 行に対応します。EF Core は規約により `Id` を**主キー**（primary key）として認識します。この例では整数の主キーをデータベースが挿入時に生成するため、`_nextId` は不要です。

エンティティには `class` を使い、リクエストでは引き続き `record` を使うのはなぜでしょうか。EF Core は特定のエンティティインスタンスを追跡し、更新時にプロパティの変更を検知するため、変更可能な通常のクラスが適しています。一方、`CreateTodo` はクライアントが送信できるフィールドを表すため、簡潔な record が適しています。このリクエストモデルから `Id` や `Done` を指定することはできません。

`Title` の `= ""` はプロパティの初期値で、新しくオブジェクトを作ったときに null 非許容文字列が未初期化になるのを防ぎます。入力の妥当性は引き続き `CreateTodo` の `[Required]`、`[StringLength]`、`AddValidation()` で検証します。

## DbContext でデータを読み書きする

`TodoDbContext` は **DbContext（データベースコンテキスト）** を継承します。`DbSet<Todo>` は Todo の検索と書き込みの入口です。テーブル全体をあらかじめ読み込む `List<Todo>` ではありません。

`AddDbContext` はコンテキストを依存性注入コンテナーに登録し、既定では Scoped にします。Web リクエスト内では同じスコープで同一インスタンスを使用し、リクエスト終了後にコンテナーが破棄します。`UseSqlite` でデータベースプロバイダーを選び、接続文字列でファイルの場所を指定します。

::: warning 注意
`DbContext` はスレッドセーフではありません。Singleton として登録したり、同じインスタンスで複数のクエリを同時に実行したりしないでください。現在の操作が完了するまで `await` してから次に進みます。[公式のライフタイム説明](https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/)
:::

起動時にはまだリクエストスコープがないため、26 行目でスコープを手動で作り、その中からコンテキストを取得してデータベースを初期化しています。`using` によりコードブロックを抜けると、そのスコープと内部のサービスが破棄されます。

## クエリと保存は別の処理

`GET /todos` では `OrderBy` で結果の順序を指定し、`ToListAsync()` で初めてデータベースクエリを実行してリストを取得します。並べ替えなしの場合、データベースが「たまたま」返す順序に依存してはいけません。`AsNoTracking()` は読み取り専用の結果を**変更追跡**（change tracking）の対象外にして、コンテキストが管理する状態を減らします。

`FindAsync(id)` は主キーで 1 件の Todo を検索します。現在のコンテキストが追跡中ならそのまま返し、そうでなければデータベースに問い合わせます。見つからない場合は `null` となり、ハンドラーは 404 を返します。

POST では次の 3 つの段階を区別してください。

1. `new Todo` で C# オブジェクトを作ります。この時点ではまだデータベースに書き込まれていません。
2. `db.Todos.Add(todo)` で挿入待ちとしてマークします。
3. `await db.SaveChangesAsync()` で挿入を実行します。その後に初めて `todo.Id` にデータベースが生成した番号が入ります。

**なぜ Add と同時に書き込まないのでしょうか。**コンテキストは変更をまとめてから一括保存できます。`SaveChangesAsync()` を忘れると、メモリ上にオブジェクトはあってもデータベースに行は追加されません。

`Task<Created<Todo>>` は、非同期メソッドの完了を待つと `Created<Todo>` の結果が得られることを表します。`async` / `await` の構文については「C# 概要」を参照してください。

::: info 技術詳細
この例では EF Core の非同期メソッドを統一して使用します。ただし、基盤の Microsoft.Data.Sqlite は非同期 I/O に対応していないため、呼び出しは最終的に同期実行されます。ほかのデータベースプロバイダーでは異なることがあります。[SQLite の非同期処理の制約](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/async)
:::

## テーブルの作成と構造の更新は別

この例の `EnsureCreatedAsync()` は独立した学習用プロジェクトに適しています。データベースにテーブルがなければモデルに必要なテーブルを作りますが、すでにテーブルがある場合に構造を更新することはありません。

::: warning 注意
エンティティを変更しても、`EnsureCreatedAsync()` は列を自動追加しません。既存データベースの構造を更新するには**マイグレーション**（migration）を使います。`EnsureCreated` と直接併用することはできません。このチュートリアルでは各章が独立したファイルを使います。既存データを保持して構造を更新する場合は[データベースマイグレーション付録](../advanced/efcore-migrations)を参照してください。
:::

::: fastapi FastAPI との比較
EF Core の役割は SQLAlchemy に近く、`DbContext` は一連の作業範囲における Session にたとえられます。`SaveChangesAsync()` は追跡中の変更を書き込みます。ただし、API とトランザクションの詳細は完全には同じではありません。
:::

::: tip ヒント
クエリと保存を SQL の観点から理解したい場合は、[EF Core / LINQ ↔ PostgreSQL クイックリファレンス](../efcore-sql-cheatsheet#execution)を参照してください。実行可能な比較例もあります。
:::

## まとめ

- EF Core はエンティティオブジェクトをデータベースにマッピングします。SQLite はファイルにデータを保存するため、サービス再起動後も読み取れます。
- `AddDbContext` は既定で Scoped コンテキストを登録します。同じコンテキストを同時に使うことはできません。
- `ToListAsync()` などの実行メソッドでデータベースに問い合わせます。読み取り専用クエリには `AsNoTracking()` を使えます。
- `Add` は挿入待ちとしてマークするだけです。`SaveChangesAsync()` で保存し、主キーはデータベースが生成します。
- `EnsureCreatedAsync()` はこのチュートリアルの独立した例に使うもので、既存テーブルの構造更新には使いません。

次章：[リレーションとクエリ](./relations-queries)——Todo にカテゴリを追加し、絞り込みをデータベースに任せます。前章：[ログ](./logging)。
