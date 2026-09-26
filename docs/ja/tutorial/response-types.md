---
title: レスポンス型
description: TypedResults でステータスコード付きの結果を返し、Results<T1, T2> でハンドラーが返せる結果を制約し、OpenAPI にレスポンスメタデータを提供します。
---

# レスポンス型

これまでの Todo ハンドラーはオブジェクトを直接返し、フレームワークが JSON にシリアライズして `200 OK` を使いました。実際の API では、リソースがない場合は `404`、作成に成功したら `201`、削除に成功したら `204` など、もっと多くの結果を表す必要があります。

この節の新しい概念は、**戻り値の型でハンドラーが明示的に返す結果を制約する**ことです。

<<< @/../samples/08-response-types/Program.cs{1,19-33 cs:line-numbers} [08-response-types/Program.cs]

レスポンスに注目できるよう、この節の `CreateTodo` は `Title` だけを持ち、検証も追加していません。

## 実行と確認

```bash
dotnet run
```

存在する Todo を取得すると `200` が返ります。

```bash
curl -i http://localhost:5080/todos/1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Buy milk","done":false}
```

存在しない Todo を取得すると `404` が返ります。

```bash
curl -i http://localhost:5080/todos/99
```

```http
HTTP/1.1 404 Not Found
Content-Length: 0
```

新しい Todo を作成すると `201 Created` が返り、`Location` ヘッダーに新しいリソースのアドレスが入ります。

```bash
curl -i -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Write report"}'
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /todos/2

{"id":2,"title":"Write report","done":false}
```

削除すると `204 No Content`（レスポンスボディなし）が返ります。もう一度削除すると、すでに存在しないため `404` になります。

```bash
curl -i -X DELETE http://localhost:5080/todos/1
curl -i -X DELETE http://localhost:5080/todos/1
```

```http
HTTP/1.1 204 No Content

HTTP/1.1 404 Not Found
Content-Length: 0
```

## TypedResults：ステータスコード付きの戻り値

<<< @/../samples/08-response-types/Program.cs{25-30 cs:line-numbers} [08-response-types/Program.cs]

29 行目では Todo 自体ではなく `TypedResults.Created(...)` を返しています。`TypedResults` には HTTP レスポンスに対応したメソッドが用意されています。

| メソッド | ステータスコード | 戻り値の型 |
| --- | --- | --- |
| `TypedResults.Ok(value)` | 200 | `Ok<T>` |
| `TypedResults.Created(uri, value)` | 201 | `Created<T>` |
| `TypedResults.NoContent()` | 204 | `NoContent` |
| `TypedResults.BadRequest()` | 400 | `BadRequest` |
| `TypedResults.NotFound()` | 404 | `NotFound` |
| `TypedResults.Conflict()` | 409 | `Conflict` |

各メソッドは**具体的な型**を返します。これらの型は、1 行目で読み込んでいる `Microsoft.AspNetCore.Http.HttpResults` 名前空間に定義されています。`Created<Todo>` という型自体が、「ステータスコードは 201 で、レスポンスボディは `Todo`」と示します。

25 行目では Lambda の引数一覧の前に `Created<Todo>` と書いています。これは Lambda の**明示的な戻り値の型**です。一種類の結果だけを返すエンドポイントなら省略できますが、書いておけば、読む人はレスポンスをすぐに把握できます。

::: tip ヒント
`Created` の最初の引数は新しいリソースのアドレスです。フレームワークはこれを `Location` レスポンスヘッダーに入れます。これは HTTP の慣例で、リソースを作成したクライアントは、このアドレスを使ってすぐにアクセスできます。
:::

## Results<T1, T2>：ハンドラーが返せる結果を列挙する

<<< @/../samples/08-response-types/Program.cs{19-23 cs:line-numbers} [08-response-types/Program.cs]

一つの Todo を検索する場合、結果は見つかった（`Ok<Todo>`）か見つからなかった（`NotFound`）の二通りです。関係のない二つの型を一つのメソッドからどう返すのでしょうか。

その答えが 19 行目の `Results<Ok<Todo>, NotFound>` です。これは**ユニオン型**（union type）で、値は `Ok<Todo>` または `NotFound` のどちらかになり、それ以外にはなりません。ジェネリック引数には最大 6 種類の結果を列挙できます。

22 行目では条件演算子で二つの結果を選んでいます。`TypedResults.NotFound()` と `TypedResults.Ok(todo)` の型は異なりますが、どちらも暗黙的に `Results<Ok<Todo>, NotFound>` に変換できるため、コンパイルが通ります。

### コンパイラーが宣言を守る

ユニオン型は「このハンドラーの戻り値は二種類のどちらかに限る」という**契約**です。ハンドラーに `return TypedResults.BadRequest();` を追加すると、コンパイルエラーになります。

```text
Program.cs(22,24): error CS0029: 无法将类型“Microsoft.AspNetCore.Http.HttpResults.BadRequest”隐式转换为“Microsoft.AspNetCore.Http.HttpResults.Results<Microsoft.AspNetCore.Http.HttpResults.Ok<Todo>, Microsoft.AspNetCore.Http.HttpResults.NotFound>”
```

このハンドラーから `BadRequest` を明示的に返すには、戻り値の型に追加する必要があります。コンパイラーが、ハンドラーの戻り値が宣言に沿っているか確認します。

::: warning 注意
この契約がリクエスト処理のすべてを網羅するわけではありません。引数バインド、検証、ミドルウェア、例外処理などから別のレスポンスが発生することもあります。たとえばこの章の POST ハンドラーは `Created<Todo>` を返すと宣言していますが、不正な JSON を送ると、フレームワークはハンドラーの呼び出し前に 400 を返します。
:::

### ドキュメントも自動で同期される

`/openapi/v1.json` を開くと、この例ではハンドラーの戻り値の型から次のレスポンス情報が提供されています。

| エンドポイント | ドキュメントに記載されるレスポンス |
| --- | --- |
| `GET /todos/{id}` | `200`（ボディは `Todo`）、`404` |
| `POST /todos` | `201`（ボディは `Todo`） |
| `DELETE /todos/{id}` | `204`、`404` |

これらはすべて戻り値の型から取得され、追加の注釈は不要です。`/scalar` ページでは各エンドポイントの下にレスポンスが表示されます。フレームワークが生成し得るレスポンスをすべて示すものではありません。呼び出し側に約束する必要があるほかのレスポンスは、別途ドキュメントに追加します。次章では 409 の例を扱います。

## Results を使わない理由

ほかの資料では、`Results.Ok(todo)`、`Results.NotFound()` のような書き方（`TypedResults` ではなく `Results`）を見るかもしれません。実行時の動作は同じですが、戻り値の型が異なります。`Results` のメソッドはすべて同じインターフェイス `IResult` を返します。

実験として、19 行目の戻り値 `Results<Ok<Todo>, NotFound>` を削除し、22 行目の二つの `TypedResults` を `Results` に置き換えてみてください。プログラムは動きますが、OpenAPI ドキュメントで `GET /todos/{id}` のレスポンスは次だけになります。

```json
"responses": {
  "200": {
    "description": "OK"
  }
}
```

`404` と `200` のレスポンスボディ構造が消えました。`IResult` は「何らかの結果を返す」ことだけを示すため、フレームワークもコンパイラーも具体的な結果を特定できないからです。このチュートリアルで一貫して `TypedResults` を使う理由はここにあります。**型情報が具体的であるほど、コンパイラーの検査が増え、ドキュメントも正確になります。**

::: info 技術詳細
`IResult` はすべての結果型が実装するインターフェイスで、HTTP レスポンスに書き込むメソッドを一つだけ持ちます。`Ok<T>` や `NotFound` などは `IResult` に加え、ステータスコードとレスポンスボディの型を宣言して OpenAPI にメタデータを渡すインターフェイスも実装します。フレームワークは起動時に戻り値の型にあるこの情報を読み取り、ドキュメントを生成します。
:::

::: fastapi FastAPI との比較
FastAPI の `response_model` は実行時レスポンス検証、フィールドのフィルタリング、ドキュメント生成をまとめて行い、`responses` で別のレスポンス説明を追加します。`TypedResults` と `Results<...>` は C# の戻り値の型でハンドラーの結果を制約し、レスポンスメタデータを提供します。Pydantic の実行時レスポンス検証と同じ機能ではありません。
:::

## まとめ

- `TypedResults` の `Ok`、`Created`、`NoContent`、`NotFound` などのメソッドは、`Created<Todo>` のようにステータスコードを表す**具体的な型**を返します。
- 複数の結果を返すハンドラーは `Results<T1, T2, ...>` で列挙します。列挙していない型を明示的に返すと**コンパイルエラー**になります。
- 具体的な結果型は OpenAPI のレスポンスメタデータを提供します。引数バインド、検証、ミドルウェアなどが追加で生成するレスポンスや、型から特定できないステータスコードは必要に応じて説明を追加します。
- `Results.Xxx()` は汎用的な `IResult` を返して型情報を失うため、`TypedResults` を優先します。

次の章：[ステータスコードとエラー処理](./errors)——よくあるエラーを統一形式で表します。前の章：[Header と Cookie](./headers-cookies)。
