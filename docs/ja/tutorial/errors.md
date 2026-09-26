---
title: ステータスコードとエラー処理
description: Problem Details で業務エラーを表し、条件を満たす空のエラーレスポンスや未処理例外に、内部情報を漏らさない説明を生成します。
---

# ステータスコードとエラー処理

前章の `404` レスポンスは内容がなく、クライアントには「エラーになった」ことしか分かりません。前の章で見たエラー形式もばらばらでした。バインド失敗はプレーンテキスト、検証失敗は JSON、ルートが見つからない場合は何も返しません。

この節の新しい概念は**Problem Details**（問題の詳細）です。業務エラーを標準的なレスポンス形式で表し、条件を満たす空のエラーレスポンスと未処理例外を統一して扱います。まず curl の既定設定で JSON レスポンスを確認し、その後に適用条件を説明します。

<<< @/../samples/09-errors/Program.cs{7,11-12,28-49 cs:line-numbers} [09-errors/Program.cs]

## 実行と確認

```bash
dotnet run
```

Todo を完了済みにすると、最初は成功します。

```bash
curl -X POST http://localhost:5080/todos/1/complete
```

```json
{"id":1,"title":"Buy milk","done":true}
```

もう一度実行すると `409 Conflict` と、説明付きエラーが返ります。

```bash
curl -i -X POST http://localhost:5080/todos/1/complete
```

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.10","title":"Todo is already completed","status":409,"detail":"Todo with id 1 is already complete and cannot be completed again.","traceId":"00-eb960df5537d54d0822d3270697c268f-9f6dbe4c8a52e820-00"}
```

`traceId` はリクエストごとに変わるため、表示される値は異なります。

## Problem Details の形式

上記のレスポンスボディを整形すると次のようになります。

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.10",
  "title": "Todo is already completed",
  "status": 409,
  "detail": "Todo with id 1 is already complete and cannot be completed again.",
  "traceId": "00-eb960df5537d54d0822d3270697c268f-9f6dbe4c8a52e820-00"
}
```

これは **RFC 9457** で定義された Problem Details 形式で、`Content-Type` には専用の `application/problem+json` を使います。

| フィールド | 意味 |
| --- | --- |
| `type` | エラーの種類を示す URI。既定では HTTP 仕様の該当ステータスコードの説明を指します |
| `title` | 人が読める短いエラーの概要。同じ種類のエラーでは同じ内容にします |
| `status` | HTTP ステータスコード。レスポンス行の値と一致します |
| `detail` | 今回のエラーに固有の具体的な説明 |
| `traceId` | リクエストの追跡 ID。ASP.NET Core が自動で付加する拡張フィールド |

**標準形式を使う理由は何でしょうか。**クライアントは Problem Details レスポンスに対して**一つの**共通処理を再利用でき、`status`、`title`、`detail` などを読み取れます。ただし、レスポンスの種類は確認し、JSON 以外のレスポンス用にフォールバック処理も用意してください。多くの HTTP クライアントライブラリや API ツールもこの形式を認識します。「入力検証」の章で見た検証エラーも、この形式を拡張し、`errors` フィールドを加えたものです。

`traceId` は**問題の調査**に使います。ユーザーからエラーの報告があったとき、この ID を受け取れば、サーバーログから対応するリクエスト記録を探せます（「ログ」の章で使用します）。

## 業務エラー：TypedResults.Problem

<<< @/../samples/09-errors/Program.cs{28-44 cs:line-numbers} [09-errors/Program.cs]

35～41 行目では、完了済みの Todo を再度完了にはできないという業務規則を処理しています。`TypedResults.Problem(...)` は Problem Details レスポンスを生成し、ステータスコード、`title`、`detail` を指定できます。28 行目の戻り値の型にも `ProblemHttpResult` を追加しています。

44 行目の `ProducesProblem(StatusCodes.Status409Conflict)` は、OpenAPI に 409 レスポンスの説明を補います。なぜ必要なのでしょうか。`ProblemHttpResult` のステータスコードは `Problem(...)` の呼び出し時に指定されるので、戻り値の型だけでは 409 と特定できません。`/openapi/v1.json` を開くと、この POST エンドポイントの `responses` に `200`、`404`、`409` が並び、409 のメディアタイプは `application/problem+json` になります。`ProducesProblem` はドキュメントのメタデータだけを追加し、実際のレスポンスは変更せず、業務規則の検査もしません。

**なぜ 400 ではなく 409 なのでしょうか。**リクエスト自体に問題はありません（形式は正しく、引数も有効です）。リソースの**現在の状態**がこの操作を許可していないのです。`409 Conflict` はこのような状況に使います。適切なステータスコードを選べば、クライアントは `detail` を読まなくても対処を判断できます。400 は「リクエストを直して再試行」、409 は「リソースの状態が変わったので、先に更新」という意味です。

よく使うエラーステータスコード：

| ステータスコード | 意味 | 典型的な状況 |
| --- | --- | --- |
| `400 Bad Request` | リクエスト自体に問題がある | 形式エラー、検証失敗 |
| `401 Unauthorized` | ログインしていない（未認証） | トークンがない、または無効 |
| `403 Forbidden` | ログイン済みだが権限がない | 一般ユーザーが管理機能にアクセス |
| `404 Not Found` | リソースが存在しない | 指定された ID がない |
| `409 Conflict` | リソースの現在状態と競合 | 操作の重複、バージョン競合 |
| `500 Internal Server Error` | サーバー内部のエラー | 未処理例外 |

::: tip ヒント
`StatusCodes.Status409Conflict` はフレームワークが提供する定数で、`409` を直接書くのと同じです。定数を使うと読みやすく、数字を書き間違える心配もありません。
:::

## 空のレスポンスにも内容を付ける

<<< @/../samples/09-errors/Program.cs{7,12,22-26 cs:line-numbers} [09-errors/Program.cs]

22～26 行目は前章と同じで、見つからない場合は空の 404 である `TypedResults.NotFound()` を返します。しかし今、存在しない ID をリクエストすると次のようになります。

```bash
curl -i http://localhost:5080/todos/99
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"00-89e72e72b0724704260ef30ead4c62b0-7b0d90993376a8c3-00"}
```

レスポンスボディは自動的に Problem Details になりました。二行のコードが連携した結果です。

- **7 行目**の `AddProblemDetails()`：Problem Details を生成するサービスを登録します。ほかのコンポーネントがエラーレスポンスを生成するときに使います。
- **12 行目**の `UseStatusCodePages()`：条件を満たす 400～599 のレスポンスに内容を付けます。ここでは空の 404 を Problem Details サービスが処理します。

::: info 技術詳細
ステータスコードページが処理するのは、レスポンスがまだ開始されておらず、ステータスコードが 400～599 で、`Content-Length` と `Content-Type` が設定されていない場合だけです。「レスポンスボディが空」だけでは条件を満たしません。本文を書いていなくても `Content-Type` や `Content-Length: 0` を設定すると、対象外になります。エンドポイントがすでに生成したエラー内容を書き換えることもありません。
:::

存在しないルートにも有効です。

```bash
curl -i http://localhost:5080/nothing-here
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"00-4d4857384b8d1dd421304c5d187d7a78-199a0d8a7972567f-00"}
```

**すべてのハンドラーで `TypedResults.Problem(...)` を書かないのはなぜでしょうか。**「見つからない」のような一般的なエラーでは、ステータスコードだけで意味が伝わります。毎回手書きすると冗長になり、内容も不統一になりがちです。ハンドラーは簡潔な `NotFound()` を返し、共通の仕組みで形式を補完します。追加の説明が必要な業務エラーの場合だけ `Problem(...)` で具体的な `detail` を記述します。

## 未処理例外

<<< @/../samples/09-errors/Program.cs{11,46-49 cs:line-numbers} [09-errors/Program.cs]

46～49 行目のエンドポイントは、コードが例外をスローし、どこでも捕捉されない状況を再現します。

```bash
curl -i http://localhost:5080/crash
```

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Cache-Control: no-cache,no-store

{"type":"https://tools.ietf.org/html/rfc9110#section-15.6.1","title":"An error occurred while processing your request.","status":500,"traceId":"00-4a7b5bf94fc135b5b5c01580b95299c7-862cabea5a9180c8-00"}
```

**11 行目**の `UseExceptionHandler()` は例外を捕捉し、Problem Details の 500 を返します。レスポンスに例外メッセージ `Database connection string is not configured` もスタック情報も**含まれていない**点に注意してください。

**これは意図的なセキュリティ設計です。**例外メッセージやスタックには、ファイルパス、データベース構造、設定項目名など、攻撃者にとって価値のある手掛かりが含まれる場合があります。クライアントに必要なのは「サーバーでエラーが起きた」ことと `traceId` だけです。詳しい情報はサーバーログに記録します。`dotnet run` を実行しているターミナルを確認してください。

```text
fail: Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware[1]
      An unhandled exception has occurred while executing the request.
      System.InvalidOperationException: Database connection string is not configured
         at Program.<>c.<<Main>$>b__0_2() in /your/path/09-errors/Program.cs:line 48
```

::: info 技術詳細
前の章で、バインド失敗時にスタック付きの長いプレーンテキストがターミナルに出たのを覚えているかもしれません。あれは**開発者例外ページ**（Developer Exception Page）です。開発環境で例外処理を設定していない場合にフレームワークが自動で有効にし、デバッグを助けるため詳細をクライアントに返します。

この節では `UseExceptionHandler()` を明示的に呼び出しています。開発者例外ページより先に例外を捕捉するため、開発環境でも本番環境と同じ動作が見られます。詳細を確認する場合はターミナルのログを読みます。
:::

::: warning 注意
この二つのミドルウェアはどちらも 7 行目の `AddProblemDetails()` に依存しますが、登録を忘れたときの挙動は異なります。

- `UseExceptionHandler()` は**アプリ起動時に**失敗し、`AddProblemDetails()` の設定を促すエラーを表示します。
- `UseStatusCodePages()` は**エラーを出さず**、プレーンテキストに切り替えます。空の 404 は `Status Code: 404; Not Found` になります。

後者は見落としやすい問題です。エラーレスポンスが JSON でない場合は、まず `AddProblemDetails()` が登録されているか、その後にリクエストの `Accept` とレスポンスがステータスコードページの条件を満たすかを確認してください。
:::

::: info 技術詳細
Problem Details を生成するミドルウェアには、クライアントが `Accept` リクエストヘッダーで要求したメディアタイプに対応する writer も必要です。これは**コンテンツネゴシエーション**（content negotiation）と呼ばれます。上記の curl コマンドは既定で `Accept: */*` を送信するため、JSON を取得できます。`Accept: text/html` に変更すると、この例の `/nothing-here` はプレーンテキストの 404 に、`/crash` はレスポンスボディのない 500 になります。`AddProblemDetails()` を登録しても、すべてのエラーが必ず JSON になるわけではなく、ネゴシエーションに失敗した際に例外の詳細が漏れることもありません。
:::

`app.UseXxx()` の呼び出しは**ミドルウェア**（middleware）と呼ばれ、各リクエストとレスポンスを順番に処理します。`MapGet` より前に書く理由や、順序が重要かどうかは「ミドルウェア」の章で扱います。ここではエラー処理のミドルウェアを先に書くと覚えておきましょう。

::: fastapi FastAPI との比較
`TypedResults.Problem(...)` は FastAPI の `raise HTTPException(...)` による業務エラー表現に近いですが、こちらは結果を返して表現し、レスポンス形式も異なります。未処理例外の全体処理は FastAPI の `@app.exception_handler(Exception)` に相当します。
:::

## まとめ

- **Problem Details**（RFC 9457）は `type`、`title`、`status`、`detail` を含む標準エラー形式で、`Content-Type` は `application/problem+json` です。
- 業務エラーは `TypedResults.Problem(statusCode, title, detail)` で返し、適切なステータスコードを選びます。動的に指定するステータスコードの OpenAPI 説明は `ProducesProblem` で補います。
- `AddProblemDetails()` と `UseStatusCodePages()` の組み合わせで、条件を満たす空のエラーレスポンスに Problem Details を付けます。JSON が生成されるかはリクエストの `Accept` にも依存します。
- `UseExceptionHandler()` は未処理例外を内部情報を含まない 500 に変換します。例外の詳細はサーバーログにのみ記録し、`traceId` で関連付けます。
- 想定内のエラーは結果を**返し**、予期しないエラーだけを例外処理に任せます。

次の章：[ルートグループ](./route-groups)——`MapGroup` で関連するエンドポイントを整理します。前の章：[レスポンス型](./response-types)。
