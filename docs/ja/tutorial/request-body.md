---
title: リクエストボディ
description: record でリクエストボディの構造を宣言し、JSON を強い型のオブジェクトに自動でデシリアライズします。入力モデルとデータモデルを分ける理由も説明します。
---

# リクエストボディ

ルートパラメーターやクエリパラメーターは、少数の単純な値を渡すのに適しています。Todo を**作成**するには、クライアントからまとまった構造化データを送る必要があります。そこで使うのが**リクエストボディ**（request body）です。HTTP リクエスト本文に置くデータで、Web API では通常 JSON を使います。

この節の新しい概念は、**record でリクエストボディの構造を宣言すると、フレームワークが JSON をその型のオブジェクトに自動変換する**ことです。

<<< @/../samples/05-request-body/Program.cs{20-25,29 cs:line-numbers} [05-request-body/Program.cs]

この章から Todo API の例を少しずつ拡張し、「完全な CRUD」の章ではデータベースに接続するアプリになります。

## 実行と確認

```bash
dotnet run
```

`POST` メソッドで JSON のリクエストボディを送ります。

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","priority":2}'
```

- `-X POST`：POST メソッドを使います。
- `-H "Content-Type: application/json"`：リクエストボディが JSON であることをサーバーに伝えます。
- `-d '...'`：リクエストボディの内容です。

予想されるレスポンス：

```json
{"id":1,"title":"Buy milk","priority":2,"done":false}
```

一覧を取得すると、先ほど作成した項目が含まれています。

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Buy milk","priority":2,"done":false}]
```

::: tip ヒント
Windows PowerShell では、引用符やバックスラッシュによる改行の扱いが bash と異なり、上記の複数行コマンドをそのまま実行できない場合があります。最も簡単なのは `/scalar` ページを開き、`POST /todos` を選択して、リクエストボディ欄に JSON を入力して送信する方法です。Scalar は OpenAPI ドキュメントからリクエストボディのひな形を自動生成します。
:::

## リクエストボディの構造を宣言する

<<< @/../samples/05-request-body/Program.cs{20,29 cs:line-numbers} [05-request-body/Program.cs]

29 行目は「Todo の作成時に必要な情報」を record で記述しています。文字列の `Title` と整数の `Priority` です。20 行目のハンドラー引数の型は `CreateTodo` です。

この例は POST エンドポイントであり、`CreateTodo` はサービス登録もカスタムバインドもされていない**複雑型**（`int` や `string` のような単純な値ではない）なので、フレームワークはリクエストボディから取得すると推論します。これは前章の送信元一覧の三つ目の規則です。次にリクエスト本文を読み、.NET 組み込み JSON ライブラリの **System.Text.Json** を使って `CreateTodo` オブジェクトにデシリアライズします。

ハンドラーに入る時点で `input` は完全な強い型のオブジェクトです。`input.Title` は `string`、`input.Priority` は `int` です。エディターで各プロパティを補完でき、名前を間違えるとコンパイルエラーになります。

::: tip ヒント
JSON プロパティ名の照合では**大文字と小文字を区別しません**。`{"TITLE":"Case test","Priority":1}` を送っても正しくバインドされます。レスポンス内のプロパティ名は camelCase に統一されます。これは「最初の一歩」で説明した Web の既定設定です。
:::

::: fastapi FastAPI との比較
FastAPI で Pydantic モデルを引数の型にする `def create(todo: CreateTodo)` と同じ考え方です。異なるのは、record はデータの形を表すだけで、既定では検証を行わないことです。その結果を次に見ます。
:::

## CreateTodo を別に定義する理由

<<< @/../samples/05-request-body/Program.cs{22,29,31 cs:line-numbers} [05-request-body/Program.cs]

ファイルには二つの record があります。29 行目の `CreateTodo` は、クライアントが送信できる内容を表す**入力モデル**です。31 行目の `Todo` は、システムに保存する内容を表す**データモデル**です。なぜ `Todo` を直接引数として受け取らないのでしょうか。

`Todo` には `Id` と `Done` があり、この値をクライアントに決めさせるべきではないからです。`Id` はサーバーが割り当て、新しい Todo は必ず未完了です。`Todo` をそのまま受け取ると、クライアントが `id` と `done` を指定できてしまいます。

入力に `CreateTodo` を使えば、クライアントはこの二つのフィールドを**そもそも設定できません**。余分なプロパティも送ってみましょう。

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Extra","priority":1,"id":999,"done":true}'
```

```json
{"id":2,"title":"Extra","priority":1,"done":false}
```

`CreateTodo` に対応するプロパティがないため、`id` と `done` は無視されます。22 行目でこれらの値はサーバーが決めています。入力と保存モデルを分けることで、**過剰な割り当て**（over-posting）と呼ばれるセキュリティ問題を防げます。

::: warning 注意
この章の例はデータをメモリ内の `List` に保存するため、プログラムを再起動すると消えます。また `List` と `nextId++` は**スレッドセーフではなく**、複数のリクエストが同時に書き込むと問題が起こる場合があります。例を簡潔にするための実装であり、「EF Core の基礎」の章で実際のデータベースに置き換えます。
:::

## リクエストボディに問題がある場合

### 形式エラー

JSON の構文が誤っている場合や、値の型が合わない場合、フレームワークは 400 を返し、ハンドラーは実行されません。

```bash
curl -i -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"x","priority":"high"}'
```

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Failed to read parameter "CreateTodo input" from the request body as JSON.
 ---> System.Text.Json.JsonException: The JSON value could not be converted to CreateTodo. Path: $.priority | LineNumber: 0 | BytePositionInLine: 30.
```

エラーは問題の箇所 `$.priority` を示しています。`"high"` を `int` に変換できないためです。

### Content-Type を忘れた場合

このチュートリアルでは JSON リクエストボディを `Content-Type: application/json` で宣言します。`application/*+json` のように `+json` で終わるメディアタイプもフレームワークは受け入れます。リクエストボディを含むのにサポート対象の JSON メディアタイプを指定しないと、`415 Unsupported Media Type`（サポートされていないメディアタイプ）が返ります。

```http
HTTP/1.1 415 Unsupported Media Type
Content-Length: 0
```

フレームワークは JSON と宣言されたリクエストボディだけを JSON として解析します。JSON 自体は正しくても、ヘッダーが欠けていると失敗するのはよくある問題です。

### フィールドが足りない場合

特に注意が必要なのは次のケースです。

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"priority":3}'
```

```json
{"id":3,"title":null,"priority":3,"done":false}
```

リクエストは成功しましたが、`CreateTodo` の `Title` 型が null 不可の `string` であるにもかかわらず、`title` は `null` です。空のオブジェクト `{}` を送ると、さらに意外なことに `title` は `null`、`priority` は `0` の Todo ができます。

理由は「C# の概要」で説明しました。nullable 参照型のチェックは**コンパイル時**です。JSON のデシリアライズは実行時に行われるため、欠けている文字列プロパティは `null`、数値は `0` に設定され、エラーは発生しません。

**デシリアライズが保証するのは「形式が正しい」ことだけで、「内容が妥当」であることではありません。**タイトルが空でないこと、優先度が 1～5 であることなどの業務規則は別途検査する必要があります。次章のテーマです。

::: info 技術詳細
System.Text.Json には `RespectNullableAnnotations` などのオプションがあり、`null` に遭遇した際にデシリアライズを失敗させられます。ただし検査できるのは「null かどうか」だけで、「長さが 50 以下」などの規則は表現できません。次章の検証機能では、これらをまとめて扱い、構造化されたエラー情報を返せます。
:::

## まとめ

- この章の POST エンドポイントでは、通常の**複雑型**引数（`CreateTodo` など）は既定で**リクエストボディ**から JSON を読み取ります。この推論は GET などのメソッドや、サービス登録された型には適用されません。
- JSON リクエストボディには、サポートされる `Content-Type` を指定します。このチュートリアルでは `application/json` を使用します。非対応のメディアタイプは 415、JSON 形式エラーや型不一致は 400 です。
- 専用の**入力モデル**（`CreateTodo`）を使い、**データモデル**（`Todo`）と分けます。サーバー管理のフィールド（`Id` など）をクライアントが改変できません。
- デシリアライズは業務規則を検査しません。欠けたフィールドは `null` または `0` になり、別途検証が必要です。

次の章：[入力検証](./validation)——不正な入力をハンドラーの実行前にフレームワークが拒否するようにします。前の章：[クエリパラメーター](./query-params)。
