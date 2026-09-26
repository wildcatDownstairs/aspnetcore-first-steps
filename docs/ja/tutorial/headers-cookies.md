---
title: Header と Cookie
description: "[FromHeader] でリクエストヘッダーを読み、HttpRequest で Cookie を読み取り、HttpResponse で Cookie を書き込みます。引数の送信元を明示するタイミングを理解します。"
---

# Header と Cookie

これまでは URL（ルート、クエリ文字列）とリクエスト本文からデータを取得しました。HTTP リクエストにはもう一つ、**リクエストヘッダー**（header）があります。クライアントのバージョン、言語設定、認証トークンなどをここに格納します。**Cookie も本質的には `Cookie` という名前のリクエストヘッダーです。**

この節の新しい概念は、**引数の名前や型だけでは送信元を推論できない場合、フレームワークに取得場所を明示する**ことです。

<<< @/../samples/07-headers-cookies/Program.cs{1,16-33 cs:line-numbers} [07-headers-cookies/Program.cs]

## 実行と確認

```bash
dotnet run
```

curl は既定で `User-Agent` リクエストヘッダーを送信します。

```bash
curl http://localhost:5080/whoami
```

```json
{"userAgent":"curl/8.21.0","clientVersion":"Not provided"}
```

`-H` を使って自分でヘッダーを指定します。

```bash
curl http://localhost:5080/whoami -H "X-Client-Version: 2.1.0" -H "User-Agent: MyApp/1.0"
```

```json
{"userAgent":"MyApp/1.0","clientVersion":"2.1.0"}
```

`userAgent` に含まれる curl のバージョン番号は、環境によって異なります。

## リクエストヘッダーを読む

<<< @/../samples/07-headers-cookies/Program.cs{1,16-19 cs:line-numbers} [07-headers-cookies/Program.cs]

「クエリパラメーター」の章で説明したように、ルートテンプレートにない単純型引数は、既定でクエリ文字列から取得します。そのためリクエストヘッダーを読むには、`[FromHeader]` で送信元を**明示的に指定**する必要があります。これは 1 行目で読み込む `Microsoft.AspNetCore.Mvc` 名前空間にあります。

`Name = "User-Agent"` はヘッダー名を指定します。**なぜ名前を別に書くのでしょうか。**リクエストヘッダー名にはハイフンがよく含まれます（`User-Agent`、`X-Client-Version`）が、C# の引数名にハイフンは使えません。`Name` を使うと、C# では有効で慣例に沿った引数名を使いながら、HTTP の実際の名前に対応させられます。ヘッダー名は大文字と小文字を区別しません。

必須か任意かの規則はクエリパラメーターと同じです。

- `string userAgent` は null 不可で必須です。空の `User-Agent` を送信した場合（`curl -H "User-Agent:"` はこのヘッダーを取り除きます）、400 になります。

  ```text
  Microsoft.AspNetCore.Http.BadHttpRequestException: Required parameter "string userAgent" was not provided from header.
  ```

- `string? clientVersion` は null を許容し、省略時には `null` を受け取ります。19 行目では `??` を使い、表示用の既定値 `"Not provided"` を設定しています。

::: tip ヒント
以前はカスタムヘッダーに `X-` 接頭辞（`X-Client-Version` など）を付けることが一般的でした。現在の仕様では推奨されていませんが、実際のプロジェクトでは今も広く使われており、どちらの書き方もフレームワークで扱えます。
:::

::: fastapi FastAPI との比較
`[FromHeader(Name = "X-Client-Version")] string? clientVersion` は、FastAPI の `x_client_version: str | None = Header(default=None)` に相当します。FastAPI はアンダースコアをハイフンに自動変換しますが、ASP.NET Core は `Name` で明示します。
:::

## Cookie を書き込む

<<< @/../samples/07-headers-cookies/Program.cs{21-30 cs:line-numbers} [07-headers-cookies/Program.cs]

**Cookie**は、サーバーがブラウザーに保存させる小さなデータです。ブラウザーは同じサイトへアクセスするたびに自動で送り返します。ユーザー設定やログインセッションの保存によく使います。

Cookie を書き込むには**レスポンスヘッダー**を変更するので、ハンドラーはレスポンスを表すオブジェクトを受け取る必要があります。21 行目の引数 `HttpResponse response` がそれです。`HttpResponse` はフレームワークが認識する**特殊型**です。この型を見つけると、ルート、クエリ文字列、リクエストボディから値を探さず、現在のリクエストのレスポンスオブジェクトを直接渡します。`HttpRequest`、`HttpContext`、`CancellationToken` も同様の特殊型です。

23～28 行目の `Cookies.Append` は、レスポンスに `Set-Cookie` ヘッダーを加えます。`-i` で確認します。

```bash
curl -i -X POST http://localhost:5080/preferences/theme/dark -c cookies.txt
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Set-Cookie: theme=dark; max-age=2592000; path=/; samesite=lax; httponly

{"saved":"dark"}
```

`-c cookies.txt` は、ブラウザーと同様に curl が受け取った Cookie をファイルへ保存する指定です。`CookieOptions` の三つの設定には、それぞれ意図があります。

| オプション | 動作 | 理由 |
| --- | --- | --- |
| `HttpOnly = true` | ページの JavaScript から Cookie を読めない | サイトに悪意あるスクリプトを注入されても盗まれないようにする |
| `SameSite = Lax` | 同一サイトのリクエストで送信。サイトをまたぐ場合も、リンクのクリックや GET フォーム送信など安全なメソッドを使うトップレベル遷移では送信 | 一部のクロスサイトリクエストフォージェリ（CSRF）のリスクを下げる。完全な CSRF 対策の代わりにはならない |
| `MaxAge = 30 日` | 30 日後に失効 | `MaxAge` と `Expires` をどちらも設定しないと、ブラウザーが有効期間を管理するセッション Cookie になる。セッション復元によってブラウザー再起動後も残る場合がある |

::: warning 注意
Cookie はクライアントに保存され、ユーザーが自由に値を変更できます。「現在のユーザーは管理者」のような、**信頼すべきデータを Cookie に保存しないでください。**認証には暗号署名付きトークンを使います。「認証」の章で説明します。
:::

## Cookie を読む

<<< @/../samples/07-headers-cookies/Program.cs{32-33 cs:line-numbers} [07-headers-cookies/Program.cs]

読み取りには `HttpRequest` を使い、その `Cookies` プロパティから名前で値を取得します。Cookie がなければ `null` が返ります。

先ほど保存した Cookie を付けてリクエストします（`-b` はファイル内の Cookie を送る指定です）。

```bash
curl http://localhost:5080/preferences -b cookies.txt
```

```json
{"theme":"dark"}
```

Cookie を付けない場合は既定値が返ります。

```bash
curl http://localhost:5080/preferences
```

```json
{"theme":"light"}
```

リクエストヘッダーは `[FromHeader]` 引数で読めるのに、Cookie は `HttpRequest` を使うことに気づいたかもしれません。Minimal API には `[FromCookie]` のような属性が**ありません**。Web API での Cookie の利用頻度はリクエストヘッダーほど高くないため、専用バインド方式を提供しない設計です。

::: fastapi FastAPI との比較
FastAPI の `Cookie()` 引数に直接対応するものはありません。`HttpRequest.Cookies` で読み取ります。Cookie の設定では、FastAPI の `response.set_cookie(...)` が `response.Cookies.Append(...)` に相当します。
:::

## HttpRequest を使う場面

`HttpRequest` からリクエストのすべてを取得できるなら、なぜ常にそれを使わず、`[FromHeader]` 引数を宣言するのでしょうか。

**引数宣言は、人とツールに向けた「インターフェイスの説明」だからです。**

- ハンドラーのシグネチャを見れば、必要な入力と必須かどうかが分かります。
- 必須値がない場合、フレームワークが自動で 400 を返すため、自分で確認する必要がありません。
- OpenAPI ドキュメントにヘッダーが記載され、Scalar ページに対応する入力欄が表示されます。

`HttpRequest` から直接読むと、これらの情報はハンドラーの中に隠れてドキュメントに表示されず、値がない場合も自分で処理する必要があります。引数宣言で表せる入力は、まず引数宣言を使いましょう。`HttpRequest` はこの節の Cookie のように専用バインド方式がない場面で使います。

## まとめ

- リクエストヘッダーは `[FromHeader(Name = "...")]` で送信元を**明示**します。`Name` はハイフンを含む HTTP 名に対応させます。
- 必須か任意かは引き続き型で決まり、`string` は必須、`string?` は任意です。
- `HttpRequest`、`HttpResponse`、`HttpContext` は**特殊型**で、フレームワークから現在のリクエストまたはレスポンスのオブジェクトを直接受け取ります。
- `response.Cookies.Append` で Cookie を書き込み、`HttpOnly`、`SameSite` などのセキュリティ設定を行います。`request.Cookies["name"]` で読み取ります。Minimal API に `[FromCookie]` はありません。
- 入力の宣言には引数宣言を優先します。インターフェイスの説明、自動検査、ドキュメント生成を兼ねます。

次の章：[レスポンス型](./response-types)——戻り値で考えられるすべての結果を表します。前の章：[入力検証](./validation)。
