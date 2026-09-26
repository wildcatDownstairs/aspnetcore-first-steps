---
title: 入力検証
description: .NET 10 の Minimal API 組み込み検証を使います。record と引数にデータ注釈でルールを宣言し、不正なリクエストをハンドラーの実行前に拒否します。
---

# 入力検証

前章には、リクエストボディに `title` がない場合でも、`null` のタイトルを持つ Todo が作成される問題が残りました。この節の新しい概念は**宣言的検証**（declarative validation）です。型や引数にルールを**宣言**し、フレームワークがハンドラーを呼び出す**前に**まとめて検査します。不正なリクエストは直接 400 で拒否します。

<<< @/../samples/06-validation/Program.cs{1,7,20,31-33 cs:line-numbers} [06-validation/Program.cs]

前章から三か所だけが増えています。7 行目で検証サービスを登録し、31～33 行目で `CreateTodo` のプロパティに規則を追加し、20 行目でクエリパラメーターに規則を追加しています。ハンドラー自体は変更していません。

## 実行と確認

```bash
dotnet run
```

正しいリクエストはこれまでどおり処理されます。

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","priority":2}'
```

```json
{"id":1,"title":"Buy milk","priority":2,"done":false}
```

次に前章で `title` が欠けていたリクエストを送ります。

```bash
curl -i -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"priority":3}'
```

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{"title":"One or more validation errors occurred.","errors":{"Title":["The Title field is required."]}}
```

今度は拒否されました。複数のフィールドに問題があれば、すべてのエラーが一度に返ります。

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"","priority":9}'
```

```json
{"title":"One or more validation errors occurred.","errors":{"Title":["The Title field is required."],"Priority":["The field Priority must be between 1 and 5."]}}
```

クエリパラメーターも検査されます。

```bash
curl "http://localhost:5080/todos?pageSize=100"
```

```json
{"title":"One or more validation errors occurred.","errors":{"pageSize":["The field pageSize must be between 1 and 50."]}}
```

## 属性でルールを宣言する

<<< @/../samples/06-validation/Program.cs{1,31-33 cs:line-numbers} [06-validation/Program.cs]

角括弧の `[Required]`、`[StringLength(50)]`、`[Range(1, 5)]` は**属性**（attribute）と呼ばれ、コードに付加するメタデータです。これらは 1 行目で読み込んだ `System.ComponentModel.DataAnnotations` 名前空間に属し、まとめて**データ注釈**（data annotations）と呼びます。

| 属性 | 規則 |
| --- | --- |
| `[Required]` | 必須で null 不可。文字列の場合は空文字列も不可 |
| `[StringLength(50)]` | 文字列の長さは 50 以下 |
| `[Range(1, 5)]` | 数値は 1～5（両端を含む） |
| `[MinLength]`、`[MaxLength]` | 文字列またはコレクションの最小・最大長 |
| `[EmailAddress]`、`[Url]` | メールアドレス、URL の形式 |
| `[RegularExpression]` | 正規表現に一致 |

同じ角括弧内に複数の属性をカンマで区切って書けます。例：`[Required, StringLength(50)]`。

**ハンドラー内に `if` を書くのではなく、宣言的にする理由は何でしょうか。**

- **規則とデータを一緒に置けます**：`CreateTodo` を見ればすべての制約が分かり、ハンドラーを探し回る必要がありません。
- **ハンドラーを簡潔にできます**：ハンドラーに入る時点で `input` は有効なので、業務コードで再確認する必要がありません。
- **エラー形式を統一できます**：すべてのエンドポイントが同じ構造のエラーを返し、クライアントは一つの処理を実装すれば済みます。
- **ドキュメントに反映されます**：たとえば `pageSize` の説明には `"minimum": 1` と `"maximum": 50` が OpenAPI に記載されます。

::: fastapi FastAPI との比較
Pydantic の `Field(min_length=1, max_length=50)`、`Field(ge=1, le=5)`、クエリ引数の `Query(ge=1, le=50)` に相当します。FastAPI では検証が Pydantic に組み込まれています。ASP.NET Core ではデータモデル（record）と検証機能が分かれているため、明示的に有効にする必要があります。
:::

::: warning 注意
`CreateTodo` は **public として宣言する必要があります**（31 行目）。.NET 10 の検証は、検証対象型のコードをコンパイル時に生成する**ソースジェネレーター**（source generator）によって実装され、公開型だけを処理するためです。

`public` を外して `record CreateTodo(...)` と書いてもプロジェクトはコンパイルできますが、リクエストボディは**まったく検証されません**。エラー、警告、ログも出ません。見落としやすい問題なので、規則が効かない場合はまず型が `public` か確認してください。
:::

## 検証を有効にする

<<< @/../samples/06-validation/Program.cs{7 cs:line-numbers} [06-validation/Program.cs]

`AddValidation()` はアプリに検証機能を登録します。以後、すべてのエンドポイントはハンドラーを呼び出す前に、引数の属性に従って入力を検査します。

1. ルート、クエリ文字列、リクエストボディなどの送信元から値をバインドします（前章の内容）。
2. 属性に従い、各引数と引数オブジェクトの各プロパティを検査します。
3. エラーが一つでもあれば、全エラー情報を付けて 400 を返し、ハンドラーは呼び出しません。
4. すべて通過した場合だけ、ハンドラーを呼び出します。

2 段階目は前章と異なります。**バインド**は「形式が合うか」（`"high"` を `int` に変換できるか）を確認し、**検証**は「内容が妥当か」（`9` が 1～5 の範囲内か）を確認します。バインドに失敗すると、フレームワークは `CreateTodo` オブジェクト自体を構築できず、検証には進みません。

::: info 技術詳細
この組み込み検証機能は .NET 10 で追加されました。それ以前のバージョンではサードパーティーライブラリか独自コードが必要でした。ソースジェネレーターがコンパイル時に検証対象型を見つけ、関連メタデータを生成し、実行時には検証コンポーネントが規則を実行します。プロパティや検証属性の取得には**リフレクション**（実行時に型やプロパティなどの情報を読み取る仕組み）も使われ、完全にリフレクションなしで動くわけではありません。生成メタデータとトリミング対応により Native AOT（ネイティブコードへの事前コンパイル、「応用」の章で紹介）でも利用できます。AOT はリフレクションが一切使えないという意味ではありません。
:::

## クエリパラメーターを検証する

<<< @/../samples/06-validation/Program.cs{20 cs:line-numbers} [06-validation/Program.cs]

属性は record のプロパティだけでなく、ハンドラー引数に直接付けることもできます。`[Range(1, 50)]` は 1 ページの最大件数を 50 に制限し、クライアントが一度に大量のデータを要求するのを防ぎます。

ルートパラメーター、クエリパラメーター、リクエストヘッダーにも同じ方法で検証を適用できます。「ルートパラメーター」の章では「値が不正なら、ルート制約で 404 にするのではなく、説明付きの 400 を返すべき」と説明しました。ここでそれを実現できます。

## エラーレスポンスの形式

検証エラーのレスポンスボディは次の構造です。

```json
{
  "title": "One or more validation errors occurred.",
  "errors": {
    "Title": ["The Title field is required."],
    "Priority": ["The field Priority must be between 1 and 5."]
  }
}
```

`errors` は辞書です。キーはエラーのあるフィールド名で、値はそのフィールドに対するすべてのエラーメッセージです。この構造は **Problem Details** という標準形式に沿っています。「ステータスコードとエラー処理」の章で詳しく説明し、よくあるエラーレスポンスを統一します。

::: tip ヒント
既定のエラーメッセージは英語です。各属性の `ErrorMessage` を指定すれば、独自のメッセージに変更できます。例：`[Range(1, 5, ErrorMessage = "Priority must be between 1 and 5")]`。
:::

## まとめ

- `builder.Services.AddValidation()` は .NET 10 の組み込み検証を有効にし、検証はハンドラー実行**前**に行われます。
- record のプロパティやハンドラー引数に**データ注釈**（`[Required]`、`[StringLength]`、`[Range]` など）を付けて規則を宣言します。
- 検証に失敗すると 400 が返り、レスポンスの `errors` にフィールドごとのエラーが列挙されます。ハンドラーは呼び出されません。
- **バインド**は形式を、**検証**は内容を調べます。規則は OpenAPI ドキュメントにも記載されます。
- 検証対象の型は `public` である必要があります。そうでなければ検証は何も通知せずに省略されます。

次の章：[Header と Cookie](./headers-cookies)——リクエストの別の部分を読み取ります。前の章：[リクエストボディ](./request-body)。
