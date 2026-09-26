---
title: リレーションとクエリ
description: Todo とカテゴリの一対多リレーションを定義し、LINQ で絞り込み、並べ替え、ページ分割、射影を組み合わせます。ナビゲーションプロパティと Include の違いも確認します。
---

# リレーションとクエリ

Todo にカテゴリを追加しましょう。タスクは Work と Life のどちらに属するでしょうか。この章ではカテゴリとタスクの関係を定義し、LINQ で「Work の未完了タスク」を検索します。

この章は読み取り専用のクエリ例で、起動時に少量の固定データを用意します。前章の POST は一時的に提供せず、次章でリレーションと書き込みを組み合わせます。以下が 3 つの全ファイルです。

<<< @/../samples/16-relations-queries/Program.cs{30-35,39-56 cs:line-numbers} [16-relations-queries/Program.cs]

<<< @/../samples/16-relations-queries/Models.cs{8-9,12-20 cs:line-numbers} [16-relations-queries/Models.cs]

<<< @/../samples/16-relations-queries/TodoDbContext.cs{6 cs:line-numbers} [16-relations-queries/TodoDbContext.cs]

## 実行して確認する

前章のサービスを停止し、リポジトリのルートから実行します。

```bash
cd samples/16-relations-queries
dotnet run
```

この章は前章と同じ依存関係を使いますが、データベースは独自の `todos-16.db` です。初回起動時に `Work` と `Life` の 2 カテゴリと、3 件の Todo を挿入します。起動コードはカテゴリテーブルが空の場合だけデータを追加するため、再起動しても重複しません。

別のターミナルで 1 ページ目（1 ページあたり 2 件）を検索します。

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Write report","done":false,"category":"Work"},{"id":2,"title":"Review PR","done":true,"category":"Work"}]
```

Work の未完了タスクだけを表示します。

```bash
curl "http://localhost:5080/todos?categoryId=1&done=false"
```

```json
[{"id":1,"title":"Write report","done":false,"category":"Work"}]
```

2 ページ目を検索します。

```bash
curl "http://localhost:5080/todos?page=2"
```

```json
[{"id":3,"title":"Buy milk","done":false,"category":"Life"}]
```

カテゴリとそのタスク全体を検索します。

```bash
curl http://localhost:5080/categories/1
```

```json
{"id":1,"name":"Work","todos":[{"id":1,"title":"Write report","done":false},{"id":2,"title":"Review PR","done":true}]}
```

## 外部キーとナビゲーションプロパティの役割

**一対多リレーション**（one-to-many relationship）では、1 つのカテゴリに複数の Todo が属し、各 Todo は 1 つのカテゴリに属します。

| メンバー | 役割 |
| --- | --- |
| `Todo.CategoryId` | **外部キー**（foreign key）。関連カテゴリの主キー値を保持する |
| `Todo.Category` | Todo からカテゴリオブジェクトへアクセスする**ナビゲーションプロパティ**（navigation property） |
| `Category.Todos` | カテゴリから関連 Todo のコレクションへアクセスするナビゲーションプロパティ |

EF Core は名前と型に基づいてリレーションを認識します。`CategoryId` は null 非許容の `int` なので、この例では各 Todo にカテゴリが必要です。データベースの外部キー制約により、存在しないカテゴリを参照できません。カテゴリを削除するエンドポイントはまだないため、カスケード削除の規則はここでは扱いません。

`Category = null!` の `!` はコンパイラーの null 許容警告を抑制するだけで、カテゴリを読み込むものではありません。クエリで読み込まず、手動でも値を設定しなければ、このプロパティは `null` のままの場合があります。

::: info 技術詳細
初期データでは Todo を新しいカテゴリの `Todos` コレクションに追加してから、オブジェクト全体を保存します。EF Core が関連の保存順序を処理し、生成されたカテゴリの主キーを Todo の外部キーに設定します。カテゴリの ID を先に推測する必要はありません。規約と必須リレーションについては[EF Core の一対多リレーション](https://learn.microsoft.com/en-us/ef/core/modeling/relationships/one-to-many)を参照してください。
:::

## クエリを組み立ててから実行する

`GET /todos` の `query` は `IQueryable<Todo>` で、まだ実行されていないクエリを表します。42、43 行目ではクエリパラメーターに応じて条件を追加し、45 行目で並べ替えとページ分割を追加してから、最後に `ToListAsync()` を呼び出します。

**先に ToList してから Where で絞り込まないのはなぜでしょうか。**リストを取得してから絞り込むと、データベースのすべての行をアプリケーションのメモリへ転送することになります。この例では LINQ クエリを組み立ててから SQLite に絞り込みと並べ替えを行わせ、現在のページだけを返します。

`Math.Clamp(page, 1, 10000)` はページ番号を 1～10000 に制限します。1 未満は 1、大きすぎる値は 10000 として処理します。1 ページを 2 件に固定しているので、`Skip`（スキップ）と `Take`（取得）の動きが分かりやすくなっています。

ページ分割の前に一意な `Id` で並べ替え、同じデータの順序を固定します。ただしページを切り替えている間にデータが追加または削除されると、重複や欠落が起こる可能性は残ります。

## Select：必要なフィールドだけを検索する

46 行目の `Select` は**射影**（projection）と呼ばれ、エンティティから `Id`、`Title`、`Done`、カテゴリ名を選び、レスポンスとして返します。

未実行のこのクエリでは、`t.Category.Name` は EF Core によって関連テーブルを参照する SQL に変換されます。カテゴリ全体を先に `Include` する必要はありません。また、Todo ごとにカテゴリを個別検索することもありません。

**双方向のナビゲーションプロパティを持つエンティティをそのまま返さないのはなぜでしょうか。**Todo は Category を参照し、Category は Todo を含みます。そのままシリアライズすると循環参照が起きやすく、データベースモデルが HTTP レスポンスと密結合になります。射影でレスポンス項目を明示しておけば、データベースにプロパティが増えても API に自動公開されません。

## Include：関連オブジェクトが必要な場合に読み込む

`GET /categories/{id}` は別の要件を示します。カテゴリとその Todo オブジェクトを取得してから、レスポンスを整えます。`Include(c => c.Todos)` はクエリ時に関連コレクションを読み込むもので、**Eager Loading（事前読み込み）**と呼ばれます。この例では遅延読み込みを有効にしていません。

`SingleOrDefaultAsync` がクエリを実行し、見つからない場合は `null` を返します。ここでは一意な主キーで検索するため、カテゴリは最大 1 件です。返す前に `CategoryResponse` を作り、その中の `TodoSummary` にはカテゴリを指すナビゲーションプロパティを含めません。

データの受け渡し専用に使う型を **DTO**（Data Transfer Object、データ転送オブジェクト）と呼びます。前章までのリクエスト record も DTO です。データベースエンティティにプロパティを追加しても、API の JSON 項目まで変更する必要はありません。

::: tip ヒント
実際の SQL を確認するには、サービスを停止して `dotnet run -- --Logging:LogLevel:Microsoft.EntityFrameworkCore.Database.Command=Information` を実行し、検索を送ります。ページ番号などはリクエストごとに変わるので、絞り込みが SQL 内で行われているか、余計なクエリがないかを確認しましょう。[関連データ読み込みの説明](https://learn.microsoft.com/en-us/ef/core/querying/related-data/eager)
:::

::: fastapi FastAPI との比較
SQLAlchemy のリレーションプロパティでオブジェクト間の関連を定義し、クエリ式で絞り込みや列の選択をする方法に似ています。`Include` はリレーションを事前読み込みする考え方に近いものの、ナビゲーションプロパティにアクセスするたびに SQL が自動実行されるわけではありません。
:::

::: tip ヒント
LINQ のメソッドを確認したい場合は、[EF Core / LINQ ↔ PostgreSQL クイックリファレンス](../efcore-sql-cheatsheet#queries)を参照してください。実行可能な比較例があります。
:::

## まとめ

- 外部キーは関連 ID を保持し、ナビゲーションプロパティはオブジェクト間の関係を表します。ナビゲーションプロパティの宣言は、オブジェクトの読み込みを意味しません。
- `IQueryable` 上で条件、並べ替え、ページ分割を組み立て、最後に `ToListAsync()` などでクエリを実行します。
- `Select` で射影する項目を選び、双方向のリレーションを直接シリアライズしないようにします。
- カテゴリ名だけが必要なら直接射影し、関連オブジェクトが必要な場合に `Include` を使います。
- 各ページの結果は一意キーで並べ替えます。この例ではページ番号を 1～10000 に制限しています。

次章：[完全な CRUD](./crud)——Todo の作成、更新、削除を実装します。前章：[EF Core 入門](./efcore-basics)。
