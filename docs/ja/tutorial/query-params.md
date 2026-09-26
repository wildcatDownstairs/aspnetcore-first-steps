---
title: クエリパラメーター
description: ハンドラーの通常の引数で URL クエリ文字列を受け取り、必須と任意、既定値、配列パラメーター、フレームワークによる引数の送信元推論を理解します。
---

# クエリパラメーター

前章の最後に、名前が一致しないルートパラメーターをフレームワークが「クエリ文字列」として扱う様子を見ました。この節では**クエリパラメーター**（query parameter）、つまり URL の `?` の後ろにある `key=value` 部分を正式に学びます。たとえば `/todos?done=false&page=2` です。

クエリパラメーターは通常、**絞り込み、並べ替え、ページング**に使います。「どのリソースにアクセスするか」は変えず、「そのリソースをどう見るか」を変えます。

この節の完成コードです。

<<< @/../samples/04-query-params/Program.cs{24-34 cs:line-numbers} [04-query-params/Program.cs]

15～22 行目では、デモ用にメモリ上の Todo リストを用意しています。「C# の概要」で紹介したコレクション式を使い、`List<Todo>` から型を推論できるため `new(1, "Buy milk", false)` の型名を省略しています。

## 実行と確認

```bash
dotnet run
```

引数を指定しない場合、既定のページ設定（1 ページあたり 2 件）が使われます。

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Buy milk","done":false},{"id":2,"title":"Write weekly report","done":true}]
```

2 ページ目を表示します。

```bash
curl "http://localhost:5080/todos?page=2"
```

```json
[{"id":3,"title":"Clean the litter box","done":false},{"id":4,"title":"Learn ASP.NET Core","done":false}]
```

未完了だけを、1 ページ 10 件で表示します。

```bash
curl "http://localhost:5080/todos?done=false&pageSize=10"
```

```json
[{"id":1,"title":"Buy milk","done":false},{"id":3,"title":"Clean the litter box","done":false},{"id":4,"title":"Learn ASP.NET Core","done":false}]
```

::: warning 注意
URL に `&` が含まれる場合は、URL 全体を必ず引用符で囲んでください。そうしないとターミナルが `&` を「バックグラウンド実行」の区切りとして解釈し、後ろのパラメーターが失われます。
:::

## ハンドラーの引数はクエリパラメーターになる

<<< @/../samples/04-query-params/Program.cs{24 cs:line-numbers} [04-query-params/Program.cs]

ルートテンプレート `"/todos"` に波括弧はありませんが、ハンドラーには `done`、`page`、`pageSize` の三つの引数があります。フレームワークはこれらの名前が**ルートテンプレートにない**と判断し、クエリ文字列から同じ名前の値を探します。

これが前章の最後に見た現象の理由です。このチュートリアルで使う通常の引数については、送信元を明示せず、サービスとして登録せず、カスタムバインドも使わない場合、次のルールを覚えておけばよいでしょう。

| 引数 | 送信元 |
| --- | --- |
| 単純型で、名前がルートテンプレートにある | ルート |
| 単純型（`int`、`string`、`bool`、`DateTime` など）で、ルートテンプレートにない | クエリ文字列 |
| 複雑型（次章の record など）で、HTTP メソッドが暗黙のリクエストボディバインドに対応 | リクエストボディ（次章） |

::: warning 注意
`GET`、`HEAD`、`OPTIONS`、`DELETE` は、上表の暗黙的なリクエストボディバインドに対応しません。この章の GET エンドポイントの通常引数を複雑型に置き換えないでください。次章では POST エンドポイントで JSON を受け取ります。サービスとして登録した型とフレームワークの特殊型には別のバインド規則があり、後の章で説明します。
:::

この推論規則により、最も一般的な書き方を簡潔にできます。推論が意図と異なる場合は、`[FromQuery]`、`[FromRoute]` などの属性（attribute）で送信元を明示できます。「Header と Cookie」の章では同じ種類の `[FromHeader]` を使います。

::: tip ヒント
クエリパラメーター名は**大文字と小文字を区別しません**。`?Done=true&PAGESIZE=1` と `?done=true&pageSize=1` は同じように動作します。
:::

## 必須と任意

クエリパラメーターでも、`done`、`page`、`pageSize` は**任意**ですが、次のエンドポイントの `keyword` は**必須**です。

<<< @/../samples/04-query-params/Program.cs{24,30-31 cs:line-numbers} [04-query-params/Program.cs]

違いは引数の**型宣言**だけです。

| 宣言 | 意味 | リクエストに引数がない場合 |
| --- | --- | --- |
| `string keyword` | null 不可、既定値なし | 400 を返す |
| `bool? done` | null 許容（`?`） | `null` を受け取る |
| `int page = 1` | 既定値あり | `1` を受け取る |

`keyword` を省略してリクエストすると、次のようになります。

```bash
curl -i http://localhost:5080/todos/search
```

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Required parameter "string keyword" was not provided from query string.
```

ここで「C# の概要」で学んだ nullable 参照型が役立ちます。**`?` は「null の可能性がある」とコンパイラーに知らせるだけでなく、「この引数を省略できる」とフレームワークにも伝えます。**ほかの注釈は不要です。

26 行目では `done` が null になり得ることを利用しています。`done is null` なら「絞り込まない」ためすべて返し、そうでなければ `Done` が `done` と等しい項目だけを残します。

::: info 技術詳細
`int page = 1` は Lambda 引数の**既定値**で、C# 12 からサポートされています。ASP.NET Core は既定値を読み取り、引数を任意として扱って OpenAPI ドキュメントにも記載します。`/openapi/v1.json` の `page` の説明には `"default": 1` が、`keyword` には `"required": true` が表示されます。
:::

### 型が合わない場合

ルートパラメーターと同様に、クエリパラメーターは宣言された型に変換されます。変換に失敗すると 400 が返ります。

```bash
curl -i "http://localhost:5080/todos?page=abc"
```

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Failed to bind parameter "int page" from "abc".
```

`bool` が受け付ける値は `true` と `false` だけなので、`done=yes` も同様のエラーになります。

::: fastapi FastAPI との比較
ほぼ同じです。既定値がない引数は必須で、`Optional[bool] = None` は C# の `bool? done` に、`page: int = 1` は `int page = 1` に対応します。
:::

## 配列パラメーター

<<< @/../samples/04-query-params/Program.cs{33-34 cs:line-numbers} [04-query-params/Program.cs]

引数を配列 `int[] id` と宣言すると、クエリ文字列に同じパラメーター名を複数回指定できます。

```bash
curl "http://localhost:5080/todos/batch?id=1&id=3&id=5"
```

```json
[{"id":1,"title":"Buy milk","done":false},{"id":3,"title":"Clean the litter box","done":false},{"id":5,"title":"Schedule a checkup","done":true}]
```

`id` を一つも送らなければ、`id` は空配列になり、結果も空の `[]` です。配列引数は常に任意です。

ここではパラメーター名に `ids` ではなく単数形の `id` を使っています。URL が `?id=1&id=3` になるためです。呼び出し側の視点で名前を考えましょう。

## 空白と URL エンコード

空白を含むキーワードで検索するには、**URL エンコード**（URL encoding）が必要です。空白は `%20` に変換されるため、URL 内では `ASP.NET Core` を `ASP.NET%20Core` と書きます。

```bash
curl "http://localhost:5080/todos/search?keyword=ASP.NET%20Core"
```

```json
[{"id":4,"title":"Learn ASP.NET Core","done":false}]
```

フレームワークはバインド前に自動でデコードするため、ハンドラーが受け取る `keyword` は `"ASP.NET Core"` です。ブラウザーや Scalar のドキュメントページは自動でエンコードします。`/scalar` では空白を含むキーワードを直接入力して試せます。

::: warning 注意
この例のキーワードに含まれるのは ASCII 文字と空白だけです。空白は上記のように `%20` と書く必要があります。URL に空白を直接含めると解析エラーになる場合があります。`/scalar` ページに未エンコードのキーワードを入力すれば、ブラウザーが処理できます。
:::

## まとめ

- ハンドラー内の、**ルートテンプレートにない**単純型引数は、自動的に**クエリ文字列**からバインドされます。
- 引数の型宣言で必須か任意かが決まります。通常の型は必須、nullable 型（`bool?`）または既定値付き（`int page = 1`）は任意です。必須引数の不足と型変換の失敗はどちらも 400 になります。
- 配列引数（`int[] id`）は `?id=1&id=3` のように、同名の複数の値を受け取ります。
- クエリパラメーター名は大文字と小文字を区別しません。ASCII 以外の文字には URL エンコードが必要で、フレームワークが自動でデコードします。

次の章：[リクエストボディ](./request-body)——record で JSON データを受け取ります。前の章：[ルートパラメーター](./path-params)。
