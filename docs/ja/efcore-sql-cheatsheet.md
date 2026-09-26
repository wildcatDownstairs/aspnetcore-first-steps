---
title: EF Core / LINQ ↔ PostgreSQL 対照表
description: 同じ Todo データを使って LINQ と PostgreSQL SQL を比較し、絞り込み、ページング、リレーション、クエリの実行タイミング、追加・更新・削除を理解します。
prev: false
next: false
---

# EF Core / LINQ ↔ PostgreSQL 対照表

SQL は読めても LINQ のメソッド名をなかなか覚えられない場合は、このページから逆引きできます。サンプルでは第15～17章の Todo とカテゴリーを使います。ここはリファレンスなので、メインの学習ルートを続ける前にすべて読む必要はありません。

`Where`、`Select`、`OrderBy` は **LINQ**（Language Integrated Query、統合言語クエリ）のメソッドです。EF Core のデータベースプロバイダーがクエリを SQL に変換します。SQLite と PostgreSQL では変換結果が異なる場合があります。

::: info 技術詳細
メインの学習ルートでは引き続き SQLite を使用します。このページの既定の実行例も SQLite を使います。PostgreSQL の同等スクリプトと、Npgsql が実際に生成するクエリも掲載しています。同等スクリプトは読みやすさのための例であり、EF Core がまったく同じ SQL を生成するという意味ではありません。
:::

## サンプル全体と実行方法

このサンプルはコンソールアプリで、データベース操作だけを確認します。HTTP サービスは起動しません。実行するたびに新しいインメモリデータベースが作成され、終了すると消えるので、何度でも実行できます。

:::: details プロジェクトの全ファイルを表示

::: code-group

<<< @/../samples/efcore-sql-cheatsheet/Program.cs{13-17,37-64 cs:line-numbers} [Program.cs]

<<< @/../samples/efcore-sql-cheatsheet/Models.cs{19-23 cs:line-numbers} [Models.cs]

<<< @/../samples/efcore-sql-cheatsheet/EfCoreSqlCheatsheet.csproj{9-10 xml:line-numbers} [EfCoreSqlCheatsheet.csproj]

:::

::::

データベースサービスをインストールせずに、リポジトリのルートから実行します。

```bash
cd samples/efcore-sql-cheatsheet
dotnet run
```

期待される出力：

<<< @/../samples/efcore-sql-cheatsheet/Output.txt{text} [実行結果]

初期データは第16章と同じです。Work カテゴリーには Write report（未完了）と Review PR（完了）、Life カテゴリーには Buy milk（未完了）があり、ID は順に 1、2、3 です。

## よく使うクエリ {#queries}

次の表は EF Core によるデータベースクエリを対象としています。`ToListAsync()` を呼び出した後のコレクションはすでにメモリ上にあるため、その後の `Where` は C# で絞り込まれ、先ほどの SQL に追加されることはありません。

| 要件 | LINQ / EF Core | PostgreSQL での同等の書き方 |
| --- | --- | --- |
| 未完了のタスク | `Where(t => !t.Done)` | `WHERE NOT "Done"` |
| 特定カテゴリーに属する未完了タスク | `Where(t => t.CategoryId == categoryId && !t.Done)` | `WHERE "CategoryId" = 1 AND NOT "Done"` |
| タイトルだけを取得 | `Select(t => t.Title)` | `SELECT "Title"` |
| タイトルの昇順。同じ場合は ID 順 | `OrderBy(t => t.Title).ThenBy(t => t.Id)` | `ORDER BY "Title", "Id"` |
| ID の降順 | `OrderByDescending(t => t.Id)` | `ORDER BY "Id" DESC` |
| 1ページ2件で2ページ目を取得 | `OrderBy(t => t.Id).Skip(2).Take(2)` | `ORDER BY "Id" LIMIT 2 OFFSET 2` |
| 未完了の件数を数える | `CountAsync(t => !t.Done)` | `SELECT COUNT(*) FROM "Todos" WHERE NOT "Done"` |
| 未完了のタスクがあるか確認 | `AnyAsync(t => !t.Done)` | `SELECT EXISTS (SELECT 1 FROM "Todos" WHERE NOT "Done")` |

このサンプルでは絞り込み、並べ替え、ページング、プロジェクションを組み合わせ、Work カテゴリー内の未完了タスクについて、ID、タイトル、カテゴリー名を取得します。C# では `Skip` を `Take` より前に書きますが、SQL では通常 `LIMIT … OFFSET …` の順になります。各操作の意味を理解すれば十分で、呼び出し順をそのまま暗記する必要はありません。

`ThenBy` は追加の並べ替え条件を加えます。`OrderBy` を続けて2回呼び出すと、主要な並べ替え条件が上書きされるため、「まずタイトル、次に ID」という指定には使えません。ページングでは一意な `Id` を最後の条件にして同名レコードの順序を決め、結果が不定にならないようにします。ただし、ページをめくる間にデータが変わると、項目の抜けや重複が起きる可能性は残ります。[PostgreSQL のページングに関する説明](https://www.postgresql.org/docs/current/queries-limit.html)

::: tip ヒント
データがあるかだけ確認する場合は、すべてのレコードを `ToListAsync()` で取得せず、`AnyAsync()` を使います。件数が必要な場合は `CountAsync()` を使います。
:::

## 1件を取得する：First、Single、Find {#single}

次の表にある「見つからない場合は null」は、この例のエンティティオブジェクトを対象とします。整数などの値型を問い合わせる場合、`OrDefault` はその型の既定値を返します。

| メソッド | 見つからない場合 | 複数見つかった場合 | 用途 |
| --- | --- | --- | --- |
| `FirstOrDefaultAsync()` | `null` | 先頭の1件を取得 | 一意である必要はなく、明確な順序に従って1件取得する |
| `SingleOrDefaultAsync()` | `null` | 例外をスロー | ビジネス上、最大1件に一致するはずの場合 |
| `SingleAsync()` | 例外をスロー | 例外をスロー | サンプル内の固定カテゴリーのように、必ず1件だけ一致するはずの場合 |
| `FindAsync(id)` | `null` | 主キーで検索するため、複数には一致しない | 主キーが分かっており、コンテキストが追跡中のオブジェクトを再利用してよい場合 |

`FirstOrDefaultAsync()` はよく `LIMIT 1` に対応します。`SingleOrDefaultAsync()` は「複数一致したかどうか」を判定する必要があるため、プロバイダーは通常最大2件を取得して件数を確認します。別の `LIMIT 1` として扱うことはできません。

`FindAsync` はまず現在のコンテキストがその主キーのエンティティを追跡しているかを確認します。追跡中ならそのオブジェクトを直接返し、そうでなければデータベースを検索します。そのため、「必ずデータベースから読み直す」メソッドではありません。[主キーによる検索](https://learn.microsoft.com/en-us/ef/core/change-tracking/entity-entries#find-and-findasync)

## リレーション：Select と Include の違い {#relations}

このサンプルには、次の2つの異なる要件があります。

- **カテゴリー名だけが必要**：`Select` 内で `t.Category.Name` を参照すると、必要な列だけをデータベースから取得できます。先にカテゴリーオブジェクトを `Include` する必要はありません。
- **カテゴリーとそのタスクオブジェクトが必要**：`Include(c => c.Todos)` でタスクのコレクションを読み込み、その後 `category.Todos` を列挙できます。

1回のクエリで後者を実行すると、`LEFT JOIN` によってカテゴリーとタスクを取得できます。ただし、SQL の結果は平坦な行で返されるため、EF Core が複数行を1つの Category とその Todos コレクションに組み立てます。`Include` は関連オブジェクトを読み込む指定であり、固定の SQL キーワードを意味するものではありません。

`AsSplitQuery()` を設定すると、コレクションの読み込みは複数の SQL に分割できます。そのため、「`Include` 1回につき `JOIN` 1回」と覚えてはいけません。これは後の最適化で扱う内容です。まずはこの例の単一クエリを理解してください。[単一クエリと分割クエリ](https://learn.microsoft.com/en-us/ef/core/querying/single-split-queries)

## SQL が実行されるタイミング {#execution}

| 操作 | その場でデータベースにアクセスするか |
| --- | --- |
| `Where`、`Select`、`OrderBy`、`Skip`、`Take`、`Include` | しない。クエリを組み立てるだけ |
| `ToListAsync`、`FirstOrDefaultAsync`、`SingleOrDefaultAsync`、`AnyAsync`、`CountAsync` | する。クエリを実行する |
| `FindAsync` | 現在のコンテキストがこの主キーを追跡していれば、データベースへのクエリは不要 |
| `AsNoTracking` | しない。クエリ結果を変更追跡に加えるかどうかを制御するもので、対応する SQL 句はない |
| `ToQueryString` | 確認用の SQL を生成するだけで、実行しない |
| この例のエンティティのプロパティ変更、`Add`、`Remove` | すぐには書き込まず、`SaveChangesAsync` まで待つ |

この例では Todo 1 の `Done` を `true` に変更した後、`Select(t => t.Done)` でデータベースを再度問い合わせます。保存前の結果は `false` のままで、保存後に `true` になります。データベース上の値を読み取るために、ここでは単一の真偽値を選択しています。追跡中のエンティティをそのまま再検索すると、メモリ上のオブジェクトが再利用されることがあります。[追跡クエリ](https://learn.microsoft.com/en-us/ef/core/querying/tracking)

`AsNoTracking()` は読み取り専用クエリに適していますが、データベースの権限設定ではなく、その後の書き込みを禁止するものでもありません。追跡されていないオブジェクトのプロパティだけを変更して `SaveChangesAsync()` を呼び出しても、EF Core は変更を自動的には認識しません。

## 追加・削除・更新と SaveChanges {#writes}

| C# での操作 | 保存時に対応する SQL 操作 |
| --- | --- |
| `Add(created)` を呼んで保存 | `INSERT INTO … RETURNING "Id"`。データベースが生成した ID を取得 |
| 追跡中のエンティティの `Done` を変更して保存 | `UPDATE "Todos" SET "Done" = TRUE WHERE "Id" = 1` |
| `Remove(created)` を呼んで保存 | `DELETE FROM "Todos" WHERE "Id" = 4` |

実際に生成される SQL には、パラメーターや戻り値、同時実行性の確認条件が含まれる場合もあります。表では、この例での操作結果だけを示しています。

`SaveChangesAsync()` は、コンテキストにある保存待ちの変更をすべて保存します。直前に変更したオブジェクトだけを保存するわけではありません。そのため、この例では `Add` の後にデータベースを問い合わせても3件のままで、保存後に4件になります。API 全体のリクエスト検証とステータスコードについては[第17章](./tutorial/crud)を参照してください。

::: info 技術詳細
EF Core には `ExecuteUpdateAsync()` と `ExecuteDeleteAsync()` もあり、エンティティを先に読み込まず、`SaveChangesAsync()` を待たずに一括更新や削除を実行できます。これらはコンテキスト内ですでに追跡されているオブジェクトを同期しません。このページでは第17章で使う追跡と保存の方法を扱います。[一括更新と削除](https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete)
:::

## Npgsql が実際に生成する SQL {#generated-sql}

このプロジェクトは PostgreSQL プロバイダーの **Npgsql** も参照しています。同じディレクトリで次を実行してください。

```bash
dotnet run -- --postgres-sql
```

`UseNpgsql` を使って冒頭のクエリを SQL に変換し、`ToQueryString()` で出力します。プログラムは PostgreSQL に接続せず、テーブルも作成しません。プロジェクトで固定されている依存パッケージのバージョンでは、次のように出力されます。

<<< @/../samples/efcore-sql-cheatsheet/PostgreSqlQuery.txt{sql} [Npgsql クエリのプレビュー]

プロバイダーがサブクエリを使い、カテゴリー ID やページングの値をパラメーターにしていることが分かります。上の表にある SQL を機械的に組み合わせているわけではありません。

::: warning 注意
`ToQueryString()` の結果はデバッグ用プレビューです。冒頭のパラメーターコメントは PostgreSQL の変数宣言ではありません。`@categoryId` を含むテキスト全体を psql に貼り付けて実行することはできません。実際に実行されたコマンドはログで確認してください。詳しくは[第16章](./tutorial/relations-queries)を参照してください。[ToQueryString の説明](https://learn.microsoft.com/en-us/dotnet/api/microsoft.entityframeworkcore.entityframeworkqueryableextensions.toquerystring?view=efcore-10.0)
:::

同じ名前の C# メソッドでも、異なるデータベースで同じ変換が行われるとは限りません。たとえば PostgreSQL の `ILIKE` は、Npgsql の `EF.Functions.ILike` で利用できますが、このチュートリアルで使う SQLite プロバイダー共通の機能ではありません。[Npgsql の変換一覧](https://www.npgsql.org/efcore/mapping/translations.html)

## PostgreSQL で同等のスクリプトを実行する {#postgres-script}

次は独立した SQL の対照用ファイルです。同じ初期データを作り、順に検索、更新、追加、削除を行います。現在のセッションに一時テーブルを作成し、最後にロールバックするため、既存の業務テーブルは変更しません。

::: details PostgreSQL スクリプト全体を表示
<<< @/../samples/efcore-sql-cheatsheet/PostgreSql.sql{21-27,52-65 sql:line-numbers} [PostgreSql.sql]
:::

PostgreSQL をインストール済みの場合は、サンプルのディレクトリから実行してください。ホスト、ユーザー、データベース名は環境に合わせて変更します。パスワードは psql のプロンプトで入力します。

```bash
psql -X -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -f PostgreSql.sql
```

データベースツールで同じ接続を使ってファイル全体を実行することもできます。主な結果は次のとおりです。

| 操作 | 結果 |
| --- | --- |
| Work の未完了タスク | 1 / Write report / Work |
| 2ページ目 | 3 / Buy milk |
| 未完了の件数、存在するか | 2、true（psql では `t` と表示） |
| ID 99 | 0行。これは EF が `null` を返す前のデータベース上の結果です |
| Work とタスクのリレーション | 2行。Write report と Review PR に対応 |
| 更新後の Done | true（`t`） |
| タスクの追加 | ID 4 を返し、合計件数は4 |
| 追加したタスクの削除 | 合計件数は3に戻る |

スクリプトの二重引用符は `Todos` や `CategoryId` などの大文字小文字を保持しており、この例の既定のマッピング名と一致します。PostgreSQL では引用符なしの識別子は小文字に変換されるため、`"Todos"` と `todos` を混在させないでください。[識別子の規則](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)

## 覚えておきたい5つのポイント

- LINQ はまずクエリを組み立て、一覧、単一項目、集計結果を取得する段階で実行します。
- ページングでは先に順序を固定します。`ThenBy` は条件を追加し、`OrderBy` は主要な並べ替えを指定し直します。
- 関連するフィールドだけが必要ならプロジェクションを使い、関連オブジェクトが必要な場合に `Include` を検討します。
- 変更追跡、`Add`、`Remove`、保存はそれぞれ別の段階です。メモリ上のオブジェクトを変更しただけでは、データベースには書き込まれません。
- PostgreSQL の同等例は理解の助けになります。実際の変換は Npgsql で確認し、実行結果はデータベースで検証します。

チュートリアルに戻る：[15 EF Core 入門](./tutorial/efcore-basics) · [16 リレーションとクエリ](./tutorial/relations-queries) · [17 CRUD 全体](./tutorial/crud)。[FastAPI ↔ ASP.NET Core 対照表](./fastapi-cheatsheet)も参照できます。
