---
title: CORS
description: 独立したフロントエンドに正確なクロスオリジンポリシーを設定し、プリフライト、Authorization リクエストヘッダー、Location レスポンスヘッダーを実際に確認します。CORS と認可も区別します。
---

# CORS

API はポート 5080、フロントエンドページはポート 5178 で動作しています。ブラウザーは既定ではページから API のレスポンスを読み取らせません。この章では**クロスオリジンリソース共有**（Cross-Origin Resource Sharing、CORS）を設定し、ローカルフロントエンドから API を呼び出して結果を読み取れるようにします。

前章のコードに CORS ポリシーを追加します。関連ファイル全体は次のとおりです。

<<< @/../samples/20-cors/Program.cs{19-23,29-32 cs:line-numbers} [20-cors/Program.cs]

<<< @/../samples/20-cors/Models.cs{cs:line-numbers} [20-cors/Models.cs]

<<< @/../samples/20-cors/TodoDbContext.cs{cs:line-numbers} [20-cors/TodoDbContext.cs]

許可するフロントエンドの URL は構成から取得します。

<<< @/../samples/20-cors/appsettings.json{13-17 json:line-numbers} [20-cors/appsettings.json]

## まずオリジンを確認する

**オリジン**（origin）は、プロトコル、ホスト、ポートの組み合わせで決まります。

| URL | `http://localhost:5080` と同一オリジンか |
| --- | --- |
| `http://localhost:5080/todos` | はい。パスはオリジンに影響しない |
| `http://localhost:5178` | いいえ。ポートが異なる |
| `http://127.0.0.1:5080` | いいえ。ホストが異なる |
| `https://localhost:5080` | いいえ。プロトコルが異なる |

ブラウザーの**同一オリジンポリシー**（same-origin policy）は、スクリプトが別オリジンのレスポンスを読み取ることを制限します。CORS を設定すると、サーバーは指定したオリジンのページにレスポンスの読み取りを許可できます。

## API を起動する

前章のサービスを停止し、リポジトリのルートから実行します。

```bash
cd samples/20-cors
dotnet user-jwts create --name alice --role editor --valid-for 1h --output token
dotnet run
```

ツールが出力した完全なトークンをコピーします。トークンは本章のプロジェクトで生成してください。データベースは新しい `todos-20.db` を使うので、Todo 一覧は空で、カテゴリは Work（1）と Life（2）です。

## 実際のブラウザーページで確認する

サンプルには Node.js でローカルに配信する HTML ページが含まれており、npm パッケージは不要です。

<<< @/../samples/20-cors/browser/index.html{24-35 html:line-numbers} [20-cors/browser/index.html]

<<< @/../samples/20-cors/browser/serve.mjs{js:line-numbers} [20-cors/browser/serve.mjs]

別のターミナルでも `samples/20-cors` に移動して、次を実行します。

```bash
node browser/serve.mjs
```

次の出力が表示されます。

```text
Open http://localhost:5178/
```

HTML をダブルクリックして `file://` で開かず、この HTTP アドレスを使ってください。トークンをページの入力欄に貼り、「Read Todos」をクリックすると、初回は次のようになります。

```text
HTTP 200
Location: (none)
[]
```

続けて「Create Todo」をクリックします。

```text
HTTP 201
Location: /todos/1
{"id":1,"title":"Browser todo","done":false,"categoryId":1}
```

これは新しいデータベースを使った場合の ID です。もう一度クリックすると新しいタスクが作られます。トークンは現在のページのメモリ内だけにあり、localStorage、Cookie、サーバー側のファイルには保存されません。

## プリフライト：実際のリクエストの前に許可を確認する

ブラウザーの開発者ツールで Network パネルを開くと、**OPTIONS プリフライトリクエスト**（preflight request）を確認できます。この例では `Authorization` を手動で送信し、POST は `application/json` も使うため、プリフライトが発生します。POST だけがプリフライト対象というわけではありません。ブラウザーが結果をキャッシュするため、クリックのたびに OPTIONS が現れるとは限りません。

curl でもプリフライトのレスポンスを確認できます。このコマンドには JWT を含めず、Todo も作成しません。

```bash
curl -i -X OPTIONS http://localhost:5080/todos -H "Origin: http://localhost:5178" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type"
```

主なレスポンスヘッダーは次のとおりです。

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5178
Access-Control-Allow-Methods: GET,POST,PUT,DELETE
Access-Control-Allow-Headers: Authorization,Content-Type
```

プリフライトには実際のリクエストの Bearer トークンが含まれないため、認証と認可より前に処理する必要があります。この例ではまず `UseRouting()` でエンドポイントを決め、次に `UseCors()` でプリフライトを処理します。実際の GET と POST には引き続き有効なトークンが必要で、書き込みには editor ロールも必要です。

## ポリシーの 4 つの設定

| 設定 | 役割 |
| --- | --- |
| `WithOrigins(...)` | `http://localhost:5178` という正確なオリジンを許可する。パスや末尾のスラッシュは含めない |
| `WithMethods(...)` | GET、POST、PUT、DELETE をフロントエンドに許可する |
| `WithHeaders(...)` | 実際のリクエストで Authorization と Content-Type を送信できるようにする |
| `WithExposedHeaders("Location")` | フロントエンドの JavaScript がレスポンスの Location を読み取れるようにする |

**リクエストヘッダーとレスポンスヘッダーを分けて設定するのはなぜでしょうか。**Authorization を送信できても、任意のレスポンスヘッダーを読み取れるとは限りません。`Location` はクロスオリジンのスクリプトに既定では公開されないため、追加指定が必要です。指定がなければ Network パネルでは見えても、`response.headers.get('Location')` は `null` を返す場合があります。

この例では Bearer ヘッダーを手動で送信し、`credentials: 'omit'` でブラウザーが Cookie を付加しないようにしているため、`AllowCredentials()` は不要です。Cookie ログインに切り替える場合は、資格情報を別途設定し、**クロスサイトリクエストフォージェリ**（cross-site request forgery、CSRF）への対策が必要です。[ASP.NET Core CORS ドキュメント](https://learn.microsoft.com/en-us/aspnet/core/security/cors?view=aspnetcore-10.0)

## 許可されないオリジンに必ず 403 が返るわけではない

プリフライトコマンドの Origin を `http://localhost:5179` に変えて実行してみます。この例では引き続き 204 が返りますが、**`Access-Control-Allow-Origin` はありません**。そのためブラウザーは後続のクロスオリジンリクエストを許可しません。

curl はブラウザーの同一オリジンポリシーを実行しません。有効なトークンを使って許可されない Origin を偽装し、curl で実際のリクエストを送ると、レスポンスにクロスオリジン許可ヘッダーがなくてもサーバーのハンドラーが実行される場合があります。プリフライトを必要としないブラウザーリクエストもサーバーまで届くことがありますが、スクリプトからレスポンスを読み取れません。

**CORS は認証や認可の代わりにはなりません。**この章で権限のない書き込みを防ぐのは JWT と `CanWriteTodos` です。CORS はブラウザーがページにレスポンスの読み取りを許すかどうかを決めます。[CORS の仕組み](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)

::: tip ヒント
「ブラウザーで CORS エラー」と表示されたら、まず Network パネルのプリフライトと実際のリクエストを確認します。API が起動しているか、Origin が完全一致するか、メソッドとリクエストヘッダーが許可されているか、実際のリクエストが 401 / 403 ではないかを調べてください。ブラウザーのエラーだけを見て業務権限を変更しないでください。
:::

::: fastapi FastAPI との比較
FastAPI / Starlette の `CORSMiddleware` に対応し、許可するオリジン、メソッド、リクエストヘッダー、読み取り可能なレスポンスヘッダーをそれぞれ設定します。ブラウザーのプリフライトと同一オリジン規則はサーバーのフレームワークが変わっても同じです。
:::

## まとめ

- オリジンはプロトコル、ホスト、ポートで決まります。CORS は指定したクロスオリジンのレスポンスをブラウザースクリプトが読めるようにします。
- オリジン、メソッド、リクエストヘッダーを正確に設定します。Location などのレスポンスヘッダーを読むには、それらも明示的に公開します。
- プリフライトはクロスオリジンの許可を確認します。実際のリクエストには引き続き認証と認可が必要で、CORS ミドルウェアはその前に配置します。
- 許可されないオリジンにも HTTP レスポンスが返ることがありますが、許可ヘッダーはありません。curl の成功だけではブラウザーの CORS 設定が正しいとは証明できません。
- CORS はユーザー権限やデータ分離を提供せず、CSRF 対策の代わりにもなりません。

この章で「セキュリティ」段階は完了です。次章：[テスト](./testing)——これらの動作を自動テストで守ります。前章：[認可](./authorization)。
