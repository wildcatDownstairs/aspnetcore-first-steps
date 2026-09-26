---
title: 認証（JWT）
description: JWT Bearer 認証で呼び出し元の ID を検証し、dotnet user-jwts でローカルテスト用トークンを作成します。トークン検証、ID の取得、エンドポイント保護を区別します。
---

# 認証（JWT）

前章までは誰でも Todo を変更できました。この章では**認証**（authentication）を追加します。呼び出し元の資格情報を検証して ID を確認し、Todo API へのアクセスに認証を必須とします。

第 17 章のコードに JWT Bearer 認証を追加します。モデルとコンテキストは変更せず、単独で実行しやすいように本章のプロジェクトにも含めています。

<<< @/../samples/18-authentication/Program.cs{1,14-15,21-22,42-44 cs:line-numbers} [18-authentication/Program.cs]

<<< @/../samples/18-authentication/Models.cs{cs:line-numbers} [18-authentication/Models.cs]

<<< @/../samples/18-authentication/TodoDbContext.cs{cs:line-numbers} [18-authentication/TodoDbContext.cs]

## ローカルテスト用トークンを準備する

**JWT**（JSON Web Token）はトークン形式の一つです。この例ではクライアントが `Authorization: Bearer <トークン>` で送信します。Bearer は資格情報を持つ人が使用できることを意味するため、トークンを URL やログに含めないでください。

SDK に付属する `dotnet user-jwts` で開発用トークンを生成し、API で検証します。まずエンドポイントの保護方法を学び、ログインやユーザー登録は扱いません。

前章のサービスを停止し、リポジトリのルートから本章のプロジェクトに移動します。

```bash
cd samples/18-authentication
dotnet user-jwts create --name alice --valid-for 1h --output token
```

ターミナルにピリオドで区切られた 3 つの部分からなるトークンが表示されます。生成のたびに内容が変わるため、全体をコピーして次の手順で使います。

プロジェクトにはトークン検証パッケージと、開発ツール用の `UserSecretsId` がすでに宣言されています。

<<< @/../samples/18-authentication/Authentication.csproj{6,12 xml:line-numbers} [18-authentication/Authentication.csproj]

`user-jwts` はローカルユーザー構成ディレクトリにテスト署名キーを保存し、開発環境の Bearer 構成を更新します。この例は `http://localhost:5080` だけで待ち受け、その構成は次のとおりです。

<<< @/../samples/18-authentication/appsettings.Development.json{2-11 json:line-numbers} [18-authentication/appsettings.Development.json]

`ValidIssuer` は許可する**発行者**（issuer）、`ValidAudiences` は許可する**対象者**（audience）、つまりトークンが対象とする API の識別子です。構成とテストキーは `AddJwtBearer()` の構成機構から読み取られます。ソースコードに固定の署名キーはありません。[ローカル JWT ツールの説明](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/jwt-authn?view=aspnetcore-10.0)

::: warning 注意
これらのトークンと署名キーはローカル開発専用です。User Secrets の内容は暗号化されずに保存され、リポジトリにコミットしてはいけません。詳しくは[第 12 章](./configuration)を参照してください。本番では信頼できる ID サービスを接続し、その説明に従ってトークン検証を構成し、HTTPS でトークンを送信してください。
:::

## 実行して確認する

先ほどのプロジェクトディレクトリで API を起動します。

```bash
dotnet run
```

別のターミナルを開き、トークンなしでリクエストします。

```bash
curl -i http://localhost:5080/todos
```

レスポンスの抜粋です。`traceId` は今回のリクエストで生成される動的な値をプレースホルダーで示しています。

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.2","title":"Unauthorized","status":401,"traceId":"request-trace-id"}
```

リクエストを送るターミナルで、先ほどコピーした完全なトークンを変数に設定します。使っているシェルに合わせてどちらか一方を実行します。

::: code-group

```powershell [PowerShell 7]
$TOKEN = "paste-the-complete-token-here"
```

```bash [Bash / zsh]
TOKEN="paste-the-complete-token-here"
```

:::

リクエストヘッダーを付け、現在のユーザーと一覧を取得します。

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5080/me
```

```json
{"name":"alice"}
```

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5080/todos
```

本章の新しいデータベース `todos-18.db` には Todo がないため、結果は `[]` です。次に作成します。

```bash
curl -i -X POST http://localhost:5080/todos -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

201 と `Location: /todos/1` が返り、JSON は次のとおりです。

```json
{"id":1,"title":"Write report","done":false,"categoryId":1}
```

リクエストヘッダーのトークンを `not-a-valid-token` に置き換えて `/todos` にリクエストすると、401 が返ります。無効なトークンではハンドラーが実行されず、データベースへの書き込みも行われません。

## 認証の登録は、すべてのエンドポイントの自動保護を意味しない

各設定の役割は異なります。

| 設定 | 役割 |
| --- | --- |
| `AddAuthentication("Bearer").AddJwtBearer()` | 既定の Bearer 認証スキームと JWT 検証ハンドラーを登録する |
| `UseAuthentication()` | リクエストのトークンを検証し、成功するとユーザー ID を設定する |
| `AddAuthorization()` / `UseAuthorization()` | アクセス規則を登録して実行する。この章では認証済みであることだけを要求する |
| `RequireAuthorization()` | 「認証が必須」という要件をエンドポイントまたはグループに付ける |

**設定を分ける理由は何でしょうか。**認証では「資格情報が有効か、誰に対応するか」を調べます。エンドポイントのアクセス規則では「ここで ID が必要か」を決めます。JWT サービスを登録しただけでは、エンドポイントに保護要件が追加されず、すべての API が自動的に非公開になるわけではありません。

この例では `/todos` グループ全体に要件を付け、すべての CRUD 操作を保護します。`/me` にも同じ要件を個別に付けます。`UseAuthentication()` を `UseAuthorization()` より前に置き、ID を設定してから規則を検査します。ドキュメントエンドポイントは引き続き開発環境でのみ公開します。

## サーバーがトークンの有効性を判断する仕組み

この例の JWT ペイロードは暗号化されていません。ユーザー名を読み取れることは、トークンが本物である証拠にはなりません。サーバーは署名、発行者、対象者、有効期限を検証する必要があります。Base64 をデコードしただけで信用してはいけません。

トークンが改ざんされていたり、発行者や対象者が一致しなかったりすると検証に失敗します。有効期限の確認には一定のクロックずれが許容されるため、期限後に短い猶予が生じる場合があります。[JWT Bearer の検証説明](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0)

`ClaimsPrincipal` は検証後に作られるユーザーオブジェクトです。その中の**クレーム**（claim）は ID を表すキーと値の情報です。ローカルツールが生成したユーザー名は、既定のマッピング後に `user.Identity?.Name` で取得できます。ID サービスによってクレーム名とマッピング規則は異なるため、すべての JWT に同じユーザー名フィールドがあると仮定してはいけません。

## この章では権限を細分化しない

現在は有効なトークンを持つ人なら誰でも、同じ Todo 一覧を読み書きできます。「自分の Todo だけを更新する」には、データに所有者 ID を保存し、検索または更新時に現在のユーザーと照合する必要があります。ロールの確認だけでは実現できません。

::: fastapi FastAPI との比較
FastAPI の `HTTPBearer` や `OAuth2PasswordBearer` はリクエストから Bearer 資格情報を抽出しますが、トークン検証ロジックとの組み合わせが必要です。ここでは `AddJwtBearer` が検証を行い、`RequireAuthorization` がエンドポイントにアクセス要件を課します。
:::

## まとめ

- JWT Bearer 認証はトークンを検証して ID を設定します。ペイロードをデコードしただけで信用してはいけません。
- `dotnet user-jwts` はローカルテスト用です。本番では信頼できる ID サービスと HTTPS を使います。
- 認証サービスの登録だけではエンドポイントは保護されません。エンドポイントまたはグループに `RequireAuthorization()` を指定します。
- トークンがない、または検証に失敗した状態で保護されたエンドポイントにアクセスすると 401 が返ります。
- `ClaimsPrincipal` は検証済みの ID を提供します。データを変更できるかどうかは次章の認可規則で決まります。

次章：[認可](./authorization)——有効な ID があっても書き込み権限があるとは限りません。前章：[完全な CRUD](./crud)。
