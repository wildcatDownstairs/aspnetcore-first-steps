---
title: 完全な CRUD
description: 既存のクエリ、検証、レスポンス型を組み合わせ、EF Core の変更追跡を使って Todo の作成、読み取り、更新、削除を行います。
---

# 完全な CRUD

前の 2 章では Todo の作成と検索を実装しました。この章では更新と削除を追加します。まずエンティティを読み込み、変更または削除対象としてマークしてから、`SaveChangesAsync()` で保存します。

**CRUD** は Create、Read、Update、Delete（作成、読み取り、更新、削除）の略です。検証、ルートグループ、エラー処理はこれまでの方法を引き継ぎます。書き込みに集中するため、この章の一覧はすべての Todo を返し、絞り込みとページ分割は行いません。カテゴリは Work（1）と Life（2）をあらかじめ用意し、カテゴリの追加・削除エンドポイントはありません。

<<< @/../samples/17-crud/Program.cs{50-85 cs:line-numbers} [17-crud/Program.cs]

<<< @/../samples/17-crud/Models.cs{19-28 cs:line-numbers} [17-crud/Models.cs]

<<< @/../samples/17-crud/TodoDbContext.cs{cs:line-numbers} [17-crud/TodoDbContext.cs]

## 実行して確認する

前章のサービスを停止し、リポジトリのルートから実行します。

```bash
cd samples/17-crud
dotnet run
```

この章では `todos-17.db` を使い、初回実行時の Todo テーブルは空です。以下の順で操作します。レスポンスは主なヘッダーだけを抜粋しています。データベースに既存のデータがある場合、ID は異なります。

タスクを作成します。

```bash
curl -i -X POST http://localhost:5080/todos -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

```http
HTTP/1.1 201 Created
Location: /todos/1
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Write report","done":false,"categoryId":1}
```

完了状態にして Life カテゴリへ移します。

```bash
curl -i -X PUT http://localhost:5080/todos/1 -H "Content-Type: application/json" -d '{"title":"Write report","done":true,"categoryId":2}'
```

```http
HTTP/1.1 204 No Content
```

204 レスポンスには本文がありません。保存後の内容を確認するには、もう一度読み取ります。

```bash
curl http://localhost:5080/todos/1
```

```json
{"id":1,"title":"Write report","done":true,"categoryId":2}
```

削除してから再検索します。

```bash
curl -i -X DELETE http://localhost:5080/todos/1
curl -i http://localhost:5080/todos/1
```

最初のレスポンスは 204、次は 404 です。レスポンス本文は次のとおりで、`traceId` の値はリクエストごとに異なります。

```json
{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"request-trace-id"}
```

## リクエストで変更できるフィールド

`CreateTodo` が受け付けるのは `Title` と `CategoryId` です。`ReplaceTodo` では `Done` も変更できます。`Id` は常にルートまたはデータベースから取得し、リクエスト本文で上書きしません。

**Todo を直接リクエストとして受け取らないのはなぜでしょうか。**将来エンティティに内部フィールドが増えたとき、エンティティ全体を直接受け取ると、クライアントにもそのフィールドを変更させてしまう可能性があります。リクエスト用の型を分けると、変更可能なフィールドを明確に制限できます。

入力に対する `[Required]`、`[StringLength]`、`[Range]` は第 06 章の方法を引き継ぎます。入力 record は `public` のままにして、.NET 10 の検証ジェネレーターで処理します。

この例で PUT は、クライアントが編集可能な状態全体を置き換えることを意味します。`title`、`done`、`categoryId` の 3 フィールドを送ってください。JSON に含まれたフィールドだけを更新する処理ではありません。たとえば `done` を省略すると、デシリアライズ後の値は `false` になり、現在の完了状態が false に置き換わります。

## 読み込み、変更、保存の順に処理する

PUT は次の順に処理します。

1. `FindAsync(id)` でエンティティを探します。なければ 404 を返します。
2. 移動先カテゴリの存在を確認します。なければ説明付きの 400 を返します。
3. 追跡中のエンティティのプロパティを変更します。
4. `SaveChangesAsync()` で変更を検出し、データベースに書き込みます。

`FindAsync` が返すエンティティは現在のコンテキストで追跡済みなので、ここで `Update(todo)` を改めて呼ぶ必要はありません。一覧で使った `AsNoTracking()` は読み取り専用向けです。追跡しないオブジェクトを取得してプロパティだけ変更しても、保存時に自動で書き戻されることはありません。[基本的な保存操作](https://learn.microsoft.com/en-us/ef/core/saving/basic)

削除も同じです。`Remove(todo)` はエンティティを削除待ちとしてマークし、`SaveChangesAsync()` で初めてデータベースから削除します。同じ ID を再検索すると 404 になります。

## 有効な ID でもカテゴリが存在するとは限らない

`[Range(1, int.MaxValue)]` で確認できるのは、ID が正数であることだけです。カテゴリ 99 が実在することまでは分かりません。カテゴリの存在確認にはデータベース検索が必要なので、ハンドラー内で行います。

```bash
curl -i -X POST http://localhost:5080/todos -H "Content-Type: application/json" -d '{"title":"Invalid","categoryId":99}'
```

400 と次の本文が返ります。

```json
{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"Category not found","status":400,"traceId":"request-trace-id"}
```

先に確認することで「カテゴリがありません」と明確に返しますが、無効な ID の保存を防ぐのは引き続きデータベースの外部キー制約です。この例ではカテゴリを削除できません。後で削除エンドポイントを追加する場合は、「確認時には存在したが、保存前に削除された」という状況も処理する必要があります。

`.ProducesProblem(400)` は、この種の 400 レスポンスを OpenAPI ドキュメントに追加します。理由は[第 09 章](./errors)を参照してください。

## リクエストの繰り返しと同時更新

同じ内容で PUT を繰り返すと最終状態は同じです。DELETE を複数回実行しても、リソースは存在しないままです。これを**冪等性**（idempotency）と呼びます。毎回同じステータスコードになる必要はないので、最初の DELETE が 204、次が 404 でも矛盾しません。一方、POST は毎回新しいリソースを作る可能性があります。

この章では同時更新をまだ検出しません。2 人が同じ Todo を読み、それぞれ変更すると、後から保存した値が先の変更を上書きすることがあります。次章ではまずアクセス権を制御し、誰がこれらの API を呼べるかを制限します。

::: fastapi FastAPI との比較
FastAPI のハンドラーで SQLAlchemy エンティティを検索し、プロパティを変更して Session をコミットする方法に似ています。DTO とデータベースエンティティを分ける点も、Pydantic の入力・出力モデルと ORM モデルがそれぞれ役割を持つ考え方に対応します。
:::

::: tip ヒント
INSERT、UPDATE、DELETE を比較したい場合は、[EF Core / LINQ ↔ PostgreSQL クイックリファレンス](../efcore-sql-cheatsheet#writes)を参照してください。実行可能な比較例があります。
:::

## まとめ

- CRUD は作成、読み取り、更新、削除を組み合わせます。操作に応じた HTTP メソッドとステータスコードを使います。
- リクエスト DTO は変更可能なフィールドを制限し、エンティティはデータベースのレコードに対応し、レスポンス DTO は返却項目を決めます。
- 追跡中のクエリで取得したエンティティは直接変更できます。`SaveChangesAsync()` が変更を検出して保存します。
- `Remove` は削除待ちとしてマークするだけで、保存後に反映されます。フィールド検証はデータベース上の存在確認の代わりにはなりません。
- この例の PUT は編集可能な状態全体を置き換えます。同時更新の競合にはまだ対応していません。

次章：[認証（JWT）](./authentication)——API が呼び出し元を確認できるようにします。前章：[リレーションとクエリ](./relations-queries)。
