---
title: 認可
description: 名前付きポリシーで Todo の読み取りと書き込み権限を分け、ID クレーム、ロール要件、401 と 403 の違いを理解します。
---

# 認可

前章では、認証を通過した人なら誰でもタスクを削除できました。この章では**認可ポリシー**（authorization policy）を使って、誰がデータを変更できるかを定めます。

ルールは次のとおりです。**認証済みのユーザーは共有 Todo を読み取れますが、editor ロールを持つ人だけが作成、更新、削除できます。**モデル、データベース操作、エラー処理は前章のものを引き継ぎます。

<<< @/../samples/19-authorization/Program.cs{15-18,47,71,86,95 cs:line-numbers} [19-authorization/Program.cs]

<<< @/../samples/19-authorization/Models.cs{cs:line-numbers} [19-authorization/Models.cs]

<<< @/../samples/19-authorization/TodoDbContext.cs{cs:line-numbers} [19-authorization/TodoDbContext.cs]

## 同じプロジェクト用に 2 種類の ID を用意する

前章のサービスを停止し、リポジトリのルートから本章のプロジェクトに移動します。

```bash
cd samples/19-authorization
dotnet user-jwts create --name alice --valid-for 1h --output token
dotnet user-jwts create --name bob --role editor --valid-for 1h --output token
```

各コマンドが出力した完全なトークンをコピーします。alice には editor ロールがなく、bob にはあります。本章独自の `UserSecretsId` とテストキーを使うため、トークンを新しく生成してください。前章のものを流用しないでください。

```bash
dotnet run
```

リクエストを送る別のターミナルで、変数を設定します。

::: code-group

```powershell [PowerShell 7]
$READER_TOKEN = "paste-Alice-token-here"
$EDITOR_TOKEN = "paste-Bob-token-here"
```

```bash [Bash / zsh]
READER_TOKEN="paste-Alice-token-here"
EDITOR_TOKEN="paste-Bob-token-here"
```

:::

## 実行して確認する

alice は一覧を読み取れます。新しい `todos-19.db` で初めて実行すると、結果は空配列です。

```bash
curl -H "Authorization: Bearer $READER_TOKEN" http://localhost:5080/todos
```

```json
[]
```

ただしタスクは作成できません。

```bash
curl -i -X POST http://localhost:5080/todos -H "Authorization: Bearer $READER_TOKEN" -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

レスポンスを抜粋します。`traceId` は動的な値です。

```http
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.4","title":"Forbidden","status":403,"traceId":"request-trace-id"}
```

トークンを bob のものに替え、ほかのリクエスト内容はそのままにします。

```bash
curl -i -X POST http://localhost:5080/todos -H "Authorization: Bearer $EDITOR_TOKEN" -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

今回は 201 が返り、`Location: /todos/1` と次のレスポンス本文が得られます。

```json
{"id":1,"title":"Write report","done":false,"categoryId":1}
```

alice は引き続き削除できませんが、bob は削除できます。

```bash
curl -i -X DELETE http://localhost:5080/todos/1 -H "Authorization: Bearer $READER_TOKEN"
curl -i -X DELETE http://localhost:5080/todos/1 -H "Authorization: Bearer $EDITOR_TOKEN"
```

順に **403** と **204** が返ります。2 回目の削除は成功し、レスポンス本文はありません。最初のリクエストでは削除処理は実行されません。

## 3 つの書き込みエンドポイントを同じポリシーで保護する

17 行目では `CanWriteTodos` という名前のポリシーを登録します。このポリシーは認証済みであることと、`editor` **ロール**（role）を持つことを要求します。この JWT の例では、ロールは信頼されたトークン内のクレームから取得し、リクエスト本文や任意の HTTP ヘッダーからは取得しません。

POST、PUT、DELETE はすべて `RequireAuthorization("CanWriteTodos")` を呼び出します。認可システムはハンドラーを実行する前にこのポリシーを検査します。書き込み権限を調整するときも 1 か所だけ変更すればよく、3 つのハンドラーを個別に直す必要はありません。

書き込みエンドポイントを追加するときは、このポリシーも付けてください。POST や PUT などの HTTP メソッド名を見て、フレームワークが editor ロールを自動で要求することはありません。

グループの `RequireAuthorization()` は、個別エンドポイントの名前付きポリシーで置き換わるわけではありません。要件は組み合わされます。グループ内のエンドポイントは「認証が必要」という要件を引き継ぎ、書き込みエンドポイントではさらに editor ロールが必要になります。

## 401 と 403 がクライアントに伝えること

| リクエストの状態 | 結果 | 理由 |
| --- | --- | --- |
| トークンがない、または無効 | 401 | 要件を満たす認証 ID を確立できない |
| 有効な alice のトークンで GET | 200 | 認証済みで、読み取りが許可されている |
| 有効な alice のトークンで POST / PUT / DELETE | 403 | ID は有効だが、書き込みポリシーを満たしていない |
| 有効な bob のトークンで正当な書き込み | 対応する 201 または 204 | ID と権限の両方が要件を満たす |

**403 は、もう一度ログインすれば必ず解決するという意味ではありません。**ID サービスがユーザーに editor ロールを付与していない場合、同じ権限のトークンを取り直しても 403 のままです。[ロール認可の説明](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/roles?view=aspnetcore-10.0)

ロール名はポリシーと一致させます。この例では小文字の `editor` を使います。ロールは ID サービスがユーザー権限に基づいて発行し、クライアントから送信された `role` フィールドを信用してはいけません。

## ロール認可とデータ所有者の確認は別

この章では editor が共有一覧の任意のタスクを変更できます。「自分の Todo だけを変更できる」ようにするには、所有者 ID をデータに保存し、検索または変更時に現在のユーザーと照合します。ロールだけを確認しても実現できません。

::: warning 注意
`--role editor` はローカルテストツールの機能にすぎません。本番クライアントがロールを独自に発行することはできません。ユーザーの権限が変わっても、古いトークンが自動更新されるわけではありません。ID サービス側ではトークンの有効期限と失効も処理する必要があります。
:::

::: fastapi FastAPI との比較
権限チェックを再利用可能な依存関係にまとめ、書き込み権限が必要な操作に適用する方法に似ています。ASP.NET Core では認可システムが名前付きポリシーを実行し、ハンドラーにはポリシー名を宣言します。
:::

## まとめ

- 認証は ID を確認し、認可ポリシーはその ID で実行できる操作を決めます。
- `CanWriteTodos` に書き込み権限を集約し、POST、PUT、DELETE で明示的に使います。
- グループとエンドポイントの認可要件は組み合わされるため、GET にもグループの認証要件が適用されます。
- 認証されていなければ 401、ID は有効でも権限が足りなければ 403 が返ります。
- ロールは信頼できる ID クレームから取得します。共有リストに対するロール規則は、リソース所有者の確認の代わりにはなりません。

次章：[CORS](./cors)——別オリジンのブラウザページから API を呼び出せるようにします。前章：[認証（JWT）](./authentication)。
