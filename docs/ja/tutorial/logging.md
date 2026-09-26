---
title: ログ
description: 依存性注入で ILogger<T> を取得し、メッセージテンプレートで構造化ログを出力します。ログレベルとカテゴリを理解し、構成でカテゴリごとの出力を制御します。
---

# ログ

前章では `Console.WriteLine` で実行順を確認しました。ログが増えると、特定のクラスの出力だけを見たり、一時的にデバッグ情報を有効にしたりしたくなります。こうした処理には `ILogger` を使えます。

この章では Todo の ID を独立したフィールドとして保持し、ログツールから直接検索できるようにします。これを**構造化ログ**（structured logging）と呼びます。

<<< @/../samples/14-logging/Program.cs{19,24,48,58,71 cs:line-numbers} [14-logging/Program.cs]

この例では「依存性の注入」の章で使った `ITodoStore` を再利用し、ハンドラーとストレージサービスの両方でログを記録します。開発環境の構成ファイルには次の 1 行を追加しています。

<<< @/../samples/14-logging/appsettings.Development.json{6 json:line-numbers} [14-logging/appsettings.Development.json]

## 実行して確認する

前章のサービスを停止し、リポジトリのルートから実行します。

```bash
cd samples/14-logging
dotnet run
```

Todo を作成し、取得し、存在しない ID も検索します。

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'
curl http://localhost:5080/todos/1
curl http://localhost:5080/todos/99
```

サービスを実行しているターミナルには、起動情報の後に次のログが表示されます。

```text
info: InMemoryTodoStore[0]
      Created Todo 1 with title: Buy milk
dbug: InMemoryTodoStore[0]
      Looking up Todo 1; 1 item(s) currently exist
dbug: InMemoryTodoStore[0]
      Looking up Todo 99; 1 item(s) currently exist
warn: Program[0]
      Todo 99 not found
```

各ログの 1 行目は 3 つの部分からなります。`info` / `dbug` / `warn` は**レベル**、`InMemoryTodoStore` と `Program` は**カテゴリ**、角括弧内の `0` はイベント ID です（この節では使いません）。2 行目がログメッセージです。

## ILogger を取得する

<<< @/../samples/14-logging/Program.cs{19,48 cs:line-numbers} [14-logging/Program.cs]

ロガーはサービスであり、「依存性の注入」の章と同じ方法で取得できます。

- 19 行目ではハンドラーが `ILogger<Program>` パラメーターを宣言します。
- 48 行目では `InMemoryTodoStore` がコンストラクターに `ILogger<InMemoryTodoStore>` を宣言します。クラス名の後にある括弧は C# 12 で導入された**プライマリコンストラクター**（primary constructor）です。`logger` パラメーターはクラス全体で使えます。

ログサービスはフレームワークがあらかじめ登録しているため、`AddXxx()` を呼び出す必要はありません。

山括弧内の型によってログの**カテゴリ**（category）が決まります。この例では `Program` と `InMemoryTodoStore` です。カテゴリから発生元を区別し、出力レベルを個別に調整できます。`Program` はトップレベルステートメント用にコンパイラーが生成するクラス名です。

## ログレベル

.NET のログレベルは、低いものから高いものへ 6 段階あります。

| レベル | メソッド | 用途 |
| --- | --- | --- |
| Trace | `LogTrace` | 最も詳細なトレース情報。特定の問題を調査するときだけ有効にする |
| Debug | `LogDebug` | 開発時のデバッグに役立つ情報 |
| Information | `LogInformation` | Todo の作成など、アプリケーションの通常動作における重要なイベント |
| Warning | `LogWarning` | 動作には影響しないが通常とは異なる状況。要求されたリソースが見つからない場合など |
| Error | `LogError` | 未処理の例外など、現在の処理が失敗した場合 |
| Critical | `LogCritical` | ディスク容量の枯渇など、アプリケーション全体が停止しかねない場合 |

この例では出力の比較をしやすくするため、作成を Information、検索過程を Debug、見つからない場合を Warning として記録します。実際のプロジェクトでは、通常の「リソースがない」という状況は警告に値しない場合もあり、より低いレベルを使えます。本番環境で業務上の動きを把握するため、Information を残すこともよくあります。Warning 以上だけに限定する必要はありません。

## カテゴリごとに出力を制御する

`appsettings.json` の `Logging:LogLevel` では、カテゴリごとに**最低レベル**を設定します。それより低いログは破棄されます。

| キー | 値 | 意味 |
| --- | --- | --- |
| `Default` | `Information` | 個別設定のないカテゴリは Information 以上を出力する |
| `Microsoft.AspNetCore` | `Warning` | フレームワーク内部のログは Warning 以上にして大量出力を避ける |
| `InMemoryTodoStore` | `Debug` | この節で開発環境の構成に追加し、ストレージサービスの Debug ログを出す |

カテゴリは前方一致で照合され、複数に一致する場合はより具体的なプレフィックスが優先されます。`Microsoft.AspNetCore` は Routing など配下のカテゴリの既定レベルに使え、より具体的なカテゴリで上書きできます。

これが Debug ログが開発環境でのみ表示される理由です。本番環境で実行すると（`appsettings.Development.json` は読み込まれないため）、同じ 3 つのリクエストでも次のログだけが表示されます。

```text
info: InMemoryTodoStore[0]
      Created Todo 1 with title: Buy milk
warn: Program[0]
      Todo 99 not found
```

問題を調べるときは、コードを変更せずに環境変数で出力レベルを上書きできます。たとえば `Logging__LogLevel__Default=Debug` は既定ルールを変更しますが、より具体的なカテゴリのルールは上書きしません。環境変数を変更した後、新しい値を読み込むにはプロセスを再起動します。

## メッセージテンプレート

<<< @/../samples/14-logging/Program.cs{24,71 cs:line-numbers} [14-logging/Program.cs]

ログメッセージの書き方に注目してください。`"Todo {TodoId} not found"` の後に `id` を引数として渡しています。これは文字列補間（先頭に `$` がありません）ではなく、**メッセージテンプレート**（message template）です。波括弧内が**プレースホルダー名**で、引数が順番に割り当てられます。

通常のコンソール出力ではフィールドが保持されているか分かりません。サービスを停止し、JSON 形式で起動して同じログを確認します。

```bash
dotnet run -- --Logging:Console:FormatterName=json --Logging:Console:FormatterOptions:JsonWriterOptions:Indented=true
```

`/todos/99` にリクエストすると、次の Warning ログが出ます。

```json
{
  "EventId": 0,
  "LogLevel": "Warning",
  "Category": "Program",
  "Message": "Todo 99 not found",
  "State": {
    "TodoId": 99,
    "{OriginalFormat}": "Todo {TodoId} not found"
  }
}
```

`State.TodoId` は数値 `99` なので、ログ基盤でフィールドを使って検索できます。先に `$"Todo {id} not found"` で文字列を組み立ててしまうと、ログシステムに渡るのは文全体だけになり、ID を取り出すには別途解析が必要です。

::: warning 注意
ここでは `id` をログメソッドの独立した引数として渡し、`TodoId` フィールドを保持します。文字列補間では事前に文字列を組み立てるため、そのログが最終的にフィルターで破棄される場合でも処理が発生します。
:::

::: tip ヒント
プレースホルダー名は PascalCase にし、アプリケーション全体で統一してください。たとえば Todo ID に関するログでは常に `{TodoId}` を使うと、ログ基盤で 1 つのフィールド名から関連する記録をすべて検索できます。
:::

::: fastapi FastAPI との比較
Python の `logging` モジュールで `logger.warning("Todo %s not found", id)` と書く方法も遅延フォーマットですが、既定では構造化フィールドを保持しません。ASP.NET Core の `ILogger` は最初から構造化ログに対応しており、追加ライブラリは不要です。
:::

::: info 技術詳細
頻繁に呼び出すログでは、`[LoggerMessage]` 属性とソースジェネレーターを使い、コンパイル時に高性能なログメソッドを生成できます。ボックス化やテンプレート解析の負荷をさらに減らせます。このチュートリアルの規模なら `LogInformation` などを直接呼び出せば十分です。
:::

## まとめ

- 依存性注入で `ILogger<T>` を取得します。`T` がログの**カテゴリ**を決め、ログサービスはフレームワークによってあらかじめ登録されています。
- 6 つの**レベル**は Trace から Critical まであり、詳細な追跡、デバッグ情報、通常のイベント、重大度の異なるエラーに使います。
- `Logging:LogLevel` でカテゴリごとの最低出力レベルを設定します。プレフィックスで照合され、環境別の構成ファイルで開発時は詳細に、本番時は簡潔にできます。
- 文字列補間ではなく、**メッセージテンプレート**（`"… {TodoId}", id`）を使います。プレースホルダーは検索可能な構造化フィールドになります。

この章は「アプリケーションの骨組み」段階の最終章です。次章：[EF Core 入門](./efcore-basics)——メモリ内ストアを SQLite データベースに置き換え、再起動後もデータを保持します。前章：[ミドルウェア](./middleware)。
