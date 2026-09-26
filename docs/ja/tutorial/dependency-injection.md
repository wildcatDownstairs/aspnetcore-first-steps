---
title: 依存性の注入
description: データアクセスをサービスとしてカプセル化してコンテナーに登録し、必要なときにフレームワークから生成・受け渡しできるようにします。Singleton、Scoped、Transient の各ライフタイムと、データベースコンテキストが Scoped である理由を学びます。
---

# 依存性の注入

これまではハンドラーから `Program.cs` 内のリストを直接読み書きしていました。この章ではリストと読み書きの処理を `InMemoryTodoStore` に移し、フレームワークからハンドラーへオブジェクトを渡すようにします。

必要なオブジェクトを外部から提供する方法を**依存性の注入**（dependency injection、DI）と呼びます。コードから何がなくなるか見てみましょう。ハンドラーはリストを管理せず、自分でストアを生成する必要もありません。`ITodoStore` パラメーターを宣言するだけです。

<<< @/../samples/11-dependency-injection/Program.cs{7-10,22,24,30-38,46-75 cs:line-numbers} [11-dependency-injection/Program.cs]

## 実行して確認する

前章のサービスを停止し、リポジトリのルートから実行します。

```bash
cd samples/11-dependency-injection
dotnet run
```

Todo エンドポイントの使い方はこれまでと同じです。

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'
```

```json
{"id":1,"title":"Buy milk","done":false}
```

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Buy milk","done":false}]
```

デモ用エンドポイント `/lifetimes` もあります。続けて 2 回リクエストします。

```bash
curl http://localhost:5080/lifetimes
curl http://localhost:5080/lifetimes
```

```json
{"singleton":["91e834bc","91e834bc"],"scoped":["87edf2ac","87edf2ac"],"transient":["d4f30286","a151a3a5"]}
{"singleton":["91e834bc","91e834bc"],"scoped":["16f8e1fc","16f8e1fc"],"transient":["6e9ab485","c3b925ae"]}
```

各番号はオブジェクトのインスタンスを表します。表示される番号は異なりますが、**同じになるものと異なるもの**の規則は同じです。この規則が本節後半のテーマです。

## データアクセスをサービスにする

<<< @/../samples/11-dependency-injection/Program.cs{46-75 cs:line-numbers} [11-dependency-injection/Program.cs]

46～50 行目では**インターフェイス**（interface）`ITodoStore` を定義しています。インターフェイスは「何ができるか」だけを記述し、すべての項目の取得と項目の追加を定めます。52～75 行目の `InMemoryTodoStore` はその**実装**で、メモリ上のリストを使って処理します。慣例として、インターフェイス名の先頭には大文字の `I` を付けます。

このようなクラスは DI における**サービス**（service）と呼ばれます。アプリケーションのほかの部分に機能を提供するオブジェクトです。

## サービスを登録する

<<< @/../samples/11-dependency-injection/Program.cs{7 cs:line-numbers} [11-dependency-injection/Program.cs]

「最初のステップ」で説明したように、`builder.Services` は「アプリケーションの実行時に必要となるコンポーネントの一覧」です。ここに自分で項目を追加しました。7 行目の意味は次のとおりです。

> `ITodoStore` が必要になったら、`InMemoryTodoStore` を提供する。

この一覧を管理し、オブジェクトの生成を担うコンポーネントを**依存性注入コンテナー**（DI container）と呼びます。`AddOpenApi()` などのメソッドも同じ仕組みで、フレームワークのサービスをまとめて登録しています。

## サービスを使う

<<< @/../samples/11-dependency-injection/Program.cs{22,24-28 cs:line-numbers} [11-dependency-injection/Program.cs]

ハンドラーは `ITodoStore` パラメーターを宣言します。バインド元を明示していませんが、この型はサービスとして登録済みなので、フレームワークはコンテナーからインスタンスを取り出して渡します。リクエスト本文から読み取ることはありません。

サービスのパラメーターは HTTP リクエストの一部ではないため、OpenAPI ドキュメントには表示されません。`/scalar` ページでも `GET /todos` にパラメーターはありません。

リクエストのたびに `new InMemoryTodoStore()` を実行すると、毎回空のリストが作られます。コンテナーに任せれば、登録方法によってどのリクエスト間でオブジェクトを共有するかを決められ、ハンドラーごとに管理処理を繰り返す必要もありません。

`ITodoStore` は、ハンドラーがインターフェイスのメソッドだけを呼び出すため、テスト用の実装に差し替えられることも示しています。**依存性の注入では、すべてのクラスにインターフェイスを用意する必要はありません**。具象クラスを直接登録することもできます。第 15 章ではストアのインターフェイスを挟まずに `TodoDbContext` を直接注入し、データベース操作を分かりやすく見ていきます。

::: fastapi FastAPI との比較
FastAPI の `Depends(get_store)` に似ています。ハンドラーが必要なオブジェクトを宣言し、フレームワークが提供します。ここでは登録済みの型を使ってサービスを検索します。同じインスタンスを共有するかどうかは、次に説明するライフタイムの設定で決まります。
:::

::: warning 注意
7 行目の登録を忘れてもコンパイルエラーにはならず、最初の `GET /todos` が 500 を返します。

```text
System.InvalidOperationException: Body was inferred but the method does not allow inferred body parameters.
Below is the list of parameters that we found:

Parameter           | Source
---------------------------------------------------------------------------------
store               | Body (Inferred)


Did you mean to register the "Body (Inferred)" parameter(s) as a Service or apply the [FromServices] or [FromBody] attribute?
```

フレームワークは `ITodoStore` を認識できず、規則に従ってこの複合型をリクエスト本文とみなします。しかし GET リクエストでは推論されたリクエスト本文を使えません。エラーメッセージの最後に解決方法があります。サービスとして登録してください。
:::

## 3 種類のライフタイム

<<< @/../samples/11-dependency-injection/Program.cs{8-10,30-38,77-86 cs:line-numbers} [11-dependency-injection/Program.cs]

77～86 行目には、ほぼ同じ「マーカー」クラスが 3 つ定義されています。各インスタンスは生成時にランダムな番号を作ります。8～10 行目ではそれぞれ異なる方法で登録し、30～38 行目のハンドラーは各型を**2 回ずつ取得して**番号を返します。冒頭で 2 回リクエストした結果を比べましょう。

| 登録メソッド | ライフタイム | 同一リクエスト内で 2 回取得 | リクエスト間 |
| --- | --- | --- | --- |
| `AddSingleton` | **Singleton**（シングルトン） | 同じインスタンス | 同じインスタンス |
| `AddScoped` | **Scoped**（スコープ） | 同じインスタンス | 別のインスタンス |
| `AddTransient` | **Transient**（一時的） | 取得ごとに新しいインスタンス | 取得ごとに新しいインスタンス |

- **Singleton**：この例ではすべてのリクエストが 1 つのインスタンスを共有するため、メモリ上のリストを保持できます。
- **Scoped**：スコープごとに 1 つのインスタンスです。通常の HTTP リクエストでは、同一リクエスト内で共有され、リクエスト間では分かれます。
- **Transient**：コンテナーから取得するたびに新しいインスタンスが作られます。

`ITodoStore` を Singleton として登録するのは、リクエストをまたいでデータを保持する必要があるためです。Scoped にすると各リクエストに新しい空のリストが渡され、作成した Todo が次のリクエストでは消えてしまいます。

### Singleton はスレッドセーフにする

複数のリクエストが同時に処理されることがあり、それらは**同じ** Singleton インスタンスを取得します。そのため `InMemoryTodoStore` は内部のリストを `lock` で保護しています（60、68 行目）。一度に 1 つのリクエストだけが入れるようにして、複数リクエストによる同時変更でデータが壊れるのを防ぎます。「リクエスト本文」の章にあった「スレッドセーフではない」という注意点をここで解決しています。

62 行目では `_todos.ToList()` を返します。これはリストそのものではなく**コピー**です。元のリストを返すと、呼び出し側がロックの外で読み取っている間に、別のリクエストがリストを変更する可能性があります。

::: info 技術詳細
`Lock` は .NET 9 で導入された専用のロック型です。この例では C# の `lock` ステートメントでロックに入り、終了します。ロック解除メソッドを自分で呼ばなくても、保護されたコードを一度に 1 つのスレッドだけが実行することを保証します。
:::

## DbContext が Scoped である理由

第 15 章で使う EF Core の `DbContext`（データベースコンテキスト）は、この処理で読み込んだり変更したりするオブジェクトを記録します。`AddDbContext` は既定で Scoped として登録します。同一リクエスト内のコードで共有でき、リクエストの終了時に破棄され、次のリクエストでは新しく作られます。

`DbContext` はスレッドセーフではないため、すべてのリクエストで共有する Singleton にしてはいけません。Scoped でも自動的にロックされるわけではありません。同一リクエスト内であっても、1 つのコンテキストを使って複数のデータベース操作を同時に実行しないでください。この制約を覚えておき、詳しい使い方は第 15 章で扱います。

### Singleton にリクエストスコープの Scoped サービスを保持させない

`InMemoryTodoStore`（Singleton）のコンストラクターが `ScopedMarker`（Scoped）を必要とすると、どうなるでしょうか。

Singleton は生成時に受け取ったオブジェクトを保持し続けます。本来リクエストごとに分かれる Scoped サービスが長期間保持されることになります。それが `DbContext` なら、複数リクエストが同時に使用する可能性もあります。このように依存先のライフタイムが意図せず延長される状態を**依存関係の捕捉**（captive dependency）と呼びます。

開発環境ではコンテナーが起動時にこの種の誤りを検証し、アプリケーションは起動に失敗します。

```text
Unhandled exception. System.AggregateException: Some services are not able to be constructed (Error while validating the service descriptor 'ServiceType: ITodoStore Lifetime: Singleton ImplementationType: InMemoryTodoStore': Cannot consume scoped service 'ScopedMarker' from singleton 'ITodoStore'.)
```

ここで覚えるのは「Scoped サービスを Singleton に直接注入しない」ということです。「長いライフタイムのサービスは、短いライフタイムのサービスに一切依存できない」という意味ではありません。たとえば Singleton は Transient を受け取れますが、その場合、生成時に作られた 1 つのインスタンスを長く保持します。リクエストごとに自動で新しくなるわけではありません。

::: warning 注意
既定では開発環境でスコープ検証が有効になり、本番環境では無効です。本番環境で起動できたからといって、この依存関係が適切とは限りません。[サービススコープの検証](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview#scope-validation)
:::

## まとめ

- **依存性の注入**：ハンドラーはパラメーターで必要なサービスを宣言し、コンテナーが生成して渡します。自分で `new` する必要はありません。
- `builder.Services.AddSingleton<インターフェイス, 実装>()` などでサービスを登録します。具象クラスを直接登録することもでき、すべてのサービスにインターフェイスを作る必要はありません。
- 登録済みのサービス型はコンテナーから渡されるパラメーターとして自動認識され、OpenAPI ドキュメントには表示されません。登録を忘れるとリクエスト本文とみなされてエラーになります。
- 3 種類のライフタイム：**Singleton** は同一コンテナー内で共有する（スレッドセーフである必要がある）、**Scoped** はスコープごとに 1 つ、**Transient** は取得ごとに新しく作る。
- `AddDbContext` はデータベースコンテキストを既定で Scoped として登録します。Scoped サービスを Singleton に直接注入しないでください。開発環境ではこの種の誤りが検証されます。

次章：[構成と Options](./configuration)——変更可能な設定をコードから分離します。前章：[ルートグループ](./route-groups)。
