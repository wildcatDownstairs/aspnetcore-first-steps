---
title: ルートグループ
description: MapGroup で共通のルートプレフィックスを持つエンドポイントをまとめ、OpenAPI タグなどのメタデータをグループに一括で追加します。
---

# ルートグループ

エンドポイントが増えると、同じ種類のエンドポイントに重複が多いことに気づきます。パスがすべて `/api/todos` で始まる、今後ログイン必須にする、ドキュメント上でも同じカテゴリにまとめる、などです。この節の新しい概念は**ルートグループ**（route group）で、共通点を一か所にまとめられます。

<<< @/../samples/10-route-groups/Program.cs{19-23,25,31,38,41 cs:line-numbers} [10-route-groups/Program.cs]

この章では第 08 章の CRUD の例を基にルートグループを説明します。第 06 章の入力検証と第 09 章の共通エラー処理はいったん省き、エンドポイントの**登録先**の変化に集中します。これらの機能は `MapGroup` と組み合わせられます。省略しているため、この章でリソースが見つからない場合の 404 レスポンスには本文がありません。

## 実行と確認

```bash
dotnet run
```

Todo のエンドポイントはすべて `/api/todos` の下になります。

```bash
curl http://localhost:5080/api/todos
```

```json
[{"id":1,"title":"Buy milk","done":false}]
```

```bash
curl http://localhost:5080/api/todos/1
```

```json
{"id":1,"title":"Buy milk","done":false}
```

```bash
curl -i -X POST http://localhost:5080/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Write report"}'
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /api/todos/2

{"id":2,"title":"Write report","done":false}
```

ヘルスチェックのエンドポイントは `/api/health` です。

```bash
curl http://localhost:5080/api/health
```

```json
{"status":"ok"}
```

古いアドレス `/todos` はもう存在せず、`404` を返します。

## MapGroup でグループを作る

<<< @/../samples/10-route-groups/Program.cs{19,21,23,25 cs:line-numbers} [10-route-groups/Program.cs]

**19 行目**の `app.MapGroup("/api")` はグループを作成します。戻り値の `api` は「`/api` で始まるすべてのルート」を表します。

**21 行目**では `api` にさらに `MapGroup("/todos")` を呼び、**入れ子グループ**を作成します。完全なプレフィックスは `/api/todos` です。

その後 `todosApi` で `MapGet` や `MapPost` を呼ぶときは、**相対パス**を記述します。

| 登録コード | 実際のルート |
| --- | --- |
| `todosApi.MapGet("/", ...)` | `GET /api/todos` |
| `todosApi.MapGet("/{id:int}", ...)` | `GET /api/todos/{id}` |
| `todosApi.MapPost("/", ...)` | `POST /api/todos` |
| `todosApi.MapDelete("/{id:int}", ...)` | `DELETE /api/todos/{id}` |
| `api.MapGet("/health", ...)` | `GET /api/health` |

グループオブジェクトの使い方は `app` とほとんど同じで、`MapGet`、`MapPost`、`MapGroup` などを呼び出せます。これが便利な点です。**新しい API を覚える必要はなく、呼び出す対象を変えるだけです。**

**各ルートに完全なパスを直接書かないのはなぜでしょうか。**プレフィックスは一つの**決定事項**であり、一度だけ書くべきです。API を `/api/v2` に変更する場合、グループを使えば 19 行目の一か所だけを直せば済みます。プレフィックスが各エンドポイントに散らばっていると、一つずつ変更しなければならず、修正漏れで URL が不統一になる可能性があります。

::: warning 注意
35 行目の `Created` のアドレス `$"/api/todos/{todo.Id}"` は、完全なパスを引き続き手動で指定しています。グループのプレフィックスは自動でここに追加されません。プレフィックスを変更するときは、このアドレスも忘れずに変更してください。
:::

## グループにメタデータを追加する

<<< @/../samples/10-route-groups/Program.cs{21,41 cs:line-numbers} [10-route-groups/Program.cs]

グループの役割はパスプレフィックスだけではありません。21 行目の `.WithTags("Todos")` は OpenAPI の**タグ**をグループに加えます。グループ内の**すべてのエンドポイント**がタグを引き継ぎます。41 行目ではヘルスチェックのエンドポイントだけに「System」タグを追加しています。

`/scalar` ページを開くと、左側のエンドポイント一覧がタグごとに二つに分かれます。「Todos」には四つ、「System」には一つ表示されます。`/openapi/v1.json` では、四つの Todo エンドポイントの `tags` が `["Todos"]`、`/api/health` が `["System"]` になります。

::: info 技術詳細
前の章ではタグを設定していなかったため、Scalar はプロジェクト名（例：`FirstSteps`）をすべてのエンドポイントの既定タグとして使っていました。
:::

`WithTags` のような呼び出しは、エンドポイントに**メタデータ**（metadata）を付けます。処理ロジックを変更せず、フレームワークの別の部分が読み取る「タグ」を付け加えます。グループに追加したメタデータは、そのグループ内のすべてのエンドポイントに適用されます。このためグループは設定を一括するのに適しています。後の章では、次のような設定をグループに追加します。

- 「認可」の章：`todosApi.RequireAuthorization()` でグループ内のすべてのエンドポイントをログイン必須にします。
- 「CORS」の章：エンドポイントのグループにクロスオリジンアクセスを許可します。

**一度の設定でグループ全体に適用**され、新しく追加したエンドポイントも自動で設定を引き継ぎます。追加を忘れてセキュリティホールが生まれるのを防げます。

::: fastapi FastAPI との比較
`MapGroup` は FastAPI の `APIRouter(prefix="/todos", tags=["Todos"])` に相当します。FastAPI では最後に `app.include_router()` で router を登録する必要があります。ASP.NET Core のグループは `app.MapGroup()` で作成した時点でアプリに登録され、21 行目のようにさらに入れ子にできます。
:::

## まとめ

- `app.MapGroup("/prefix")` でルートグループを作ります。グループに登録するエンドポイントは**相対パス**を使い、実際のルートにはプレフィックスが自動で追加されます。
- グループは入れ子にできます。`api.MapGroup("/todos")` のプレフィックスは `/api/todos` です。
- `WithTags` などの**メタデータ**をグループに追加すると、その中のすべてのエンドポイントに適用されます。認可や CORS などもグループ単位で設定できます。
- プレフィックスと共通設定を一度だけ書けば、変更時の漏れを防げます。ただし `Created` などで手書きした完全アドレスは自分で同期する必要があります。

この章は「リクエストとレスポンス」段階の最後です。これで、引数を完全に扱い、検証を行い、適切なレスポンスを返し、構造を整理した API を作れるようになりました。次の「アプリケーションの骨格」段階は[依存性注入](./dependency-injection)から始め、例のメモリ内リストを実際のサービスに置き換えます。前の章：[ステータスコードとエラー処理](./errors)。
