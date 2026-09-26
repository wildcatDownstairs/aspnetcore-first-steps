---
title: 構成と Options
description: appsettings.json、環境変数、コマンドライン、User Secrets から構成を読み込み、値が上書きされる順序を理解します。Options パターンで構成を型安全なクラスにバインドし、起動時に検証します。
---

# 構成と Options

開発環境では 1 ページに Todo を 5 件表示し、デプロイ後は 20 件に変更したいとします。この値を構成に置けば、変更のたびにコードを再コンパイルする必要がありません。

この章では **Options パターン**（options pattern）を使って構成を `TodoOptions` クラスに読み込み、プロパティからアクセスします。また、件数が許容範囲内にあるか検証します。

<<< @/../samples/12-configuration/Program.cs{8-11,21-30,34-45 cs:line-numbers} [12-configuration/Program.cs]

値はプロジェクトルートの `appsettings.json` に書かれています。強調部分はこの節で追加した `Todo` 構成セクションです。

<<< @/../samples/12-configuration/appsettings.json{9-12 json:line-numbers} [12-configuration/appsettings.json]

## 実行して確認する

前章のサービスを停止し、リポジトリのルートから実行します。

```bash
cd samples/12-configuration
dotnet run
```

```bash
curl http://localhost:5080/settings
```

```json
{"welcomeMessage":"Welcome to the Todo API (Development)","maxItems":5,"adminKeyConfigured":false}
```

ウェルカムメッセージの末尾に `(Development)` が追加されていますが、`appsettings.json` にはこの文字列はありません。別のファイルから読み込まれています。

<<< @/../samples/12-configuration/appsettings.Development.json{8-10 json:line-numbers} [12-configuration/appsettings.Development.json]

## 構成の取得元

ASP.NET Core の構成は複数の**構成プロバイダー**（configuration source）を重ねて作られます。`WebApplication.CreateBuilder` は既定で次の順に読み込みます。**後から読み込まれた値が先の値を上書きします**。

| 順序 | 構成プロバイダー | 代表的な用途 |
| --- | --- | --- |
| 1 | `appsettings.json` | すべての環境で共通の既定値。コードリポジトリにコミットする |
| 2 | `appsettings.{環境名}.json` | `appsettings.Development.json` など、特定の環境向けの値 |
| 3 | User Secrets（開発環境のみ） | 開発者のローカルに置く秘密情報。リポジトリに含めない |
| 4 | 環境変数 | デプロイ時にサーバー、コンテナー、クラウドから渡す |
| 5 | コマンドライン引数 | 一時的な上書き。デバッグ時に便利 |

そのため開発環境では、`WelcomeMessage` はまず 1 番目のソースから「Welcome to the Todo API」として読み込まれ、その後 2 番目のソースで上書きされます。`MaxItems` は 1 番目にだけあるため、5 のままです。

既定値はファイルに置き、デプロイ時には環境変数で上書きし、一時的な実験ではさらにコマンドラインで上書きできます。値を 1 つ変えるために構成ファイル全体を複製する必要はありません。

### 環境変数で上書きする

起動引数を切り替えるたびに `Ctrl+C` でサービスを停止し、再起動してから別のターミナルで `/settings` にリクエストしてください。

環境変数では階層を**二重アンダースコア** `__` で表します（環境によっては変数名にコロンを使えないためです）。

::: code-group

```bash [macOS / Linux]
Todo__MaxItems=20 dotnet run
```

```powershell [Windows PowerShell]
$env:Todo__MaxItems = "20"; dotnet run
```

:::

```json
{"welcomeMessage":"Welcome to the Todo API (Development)","maxItems":20,"adminKeyConfigured":false}
```

### コマンドラインで上書きする

コマンドライン引数では階層をコロンで表し、`--` の後に指定します。優先順位は環境変数より高くなります。

```bash
dotnet run -- --Todo:MaxItems=30
```

```json
{"welcomeMessage":"Welcome to the Todo API (Development)","maxItems":30,"adminKeyConfigured":false}
```

環境変数 `Todo__MaxItems=20` も同時に設定されていても、結果は 30 です。

::: tip ヒント
PowerShell で設定した `$env:` 変数は、現在のターミナルウィンドウで保持され、以降の `dotnet run` に影響します。実験後に `Remove-Item Env:Todo__MaxItems` で削除してください。
:::

## 設定を型安全なクラスにバインドする

<<< @/../samples/12-configuration/Program.cs{8-11,34-45 cs:line-numbers} [12-configuration/Program.cs]

34～45 行目の `TodoOptions` は通常のクラスです。プロパティ名は `appsettings.json` の `Todo` セクション内のキーに対応します。8～11 行目では 3 つの処理を行います。

1. `AddOptions<TodoOptions>()`：この型の Options サービスを準備します。以降は `IOptions<TodoOptions>` から構成を取得できます。
2. `BindConfiguration("Todo")`：構成の `Todo` セクションの値をクラスのプロパティに**バインド**します。36 行目の定数 `SectionName` によって、セクション名の記述を 1 か所にまとめています。
3. `ValidateDataAnnotations()` と `ValidateOnStart()`：38 行目のデータ注釈を使って構成を検証し、**アプリケーションの起動時**に検証を実行します。

使用するときはハンドラーが `IOptions<TodoOptions>` パラメーターを宣言し（21 行目）、`.Value` でバインド済みオブジェクトを取得します。

構成項目が 1、2 個なら、`builder.Configuration["Todo:MaxItems"]` で直接読み取る方法もあります。ここでは関連する設定をクラスにまとめ、型変換と範囲の検証を統一しています。利用側では `settings.MaxItems` と書くだけで整数を得られます。

エディターは C# のプロパティ名を検査できますが、JSON のキー名は検査できません。構成キーを誤記するとプロパティは既定値のままになることがあるため、検証が必要です。

### 起動時に構成エラーを見つける

たとえば `MaxItems` を 0 にするなど、無効な値を構成した場合を見てみましょう。

```bash
dotnet run -- --Todo:MaxItems=0
```

アプリケーションは**起動しません**。

```text
fail: Microsoft.Extensions.Hosting.Internal.Host[11]
      Hosting failed to start
      Microsoft.Extensions.Options.OptionsValidationException: DataAnnotation validation failed for 'TodoOptions' members: 'MaxItems' with the error: 'The field MaxItems must be between 1 and 100.'.
```

`ValidateOnStart()` により構成の誤りが起動時に明らかになります。これを省略すると、通常は `.Value` を初めて読み取るまで検証されず、リクエストが来てから構成エラーに気付く可能性があります。

::: info 技術詳細
`IOptions<T>` は構成オブジェクトをキャッシュします。JSON を変更した場合、新しい値を読み込むにはアプリケーションを再起動する必要があります。動的な更新が必要なら、スコープごとの初回アクセス時にスナップショットを作成する `IOptionsSnapshot<T>` や、構成変更の通知に対応する `IOptionsMonitor<T>` を使えます。この章では `IOptions<T>` を使います。
:::

::: fastapi FastAPI との比較
Options パターンは pydantic-settings に相当します。クラスで構成項目と型を宣言し、ファイルや環境変数から読み込んで検証します。FastAPI では通常 `Depends(get_settings)` で構成オブジェクトを注入しますが、ここでは `IOptions<TodoOptions>` を注入します。
:::

## User Secrets に秘密情報を保存する

`TodoOptions.AdminKey`（44 行目）は、サードパーティーサービスのキーを想定した値です。リポジトリにコミットされる `appsettings.json` に実際のキーを書いてはいけません。

開発時の秘密情報は **User Secrets**（ユーザーシークレット）に保存します。まずプロジェクトディレクトリで初期化します。

```bash
dotnet user-secrets init
```

このコマンドは `.csproj` に `<UserSecretsId>` を追加します。これはプロジェクトのシークレットストアを特定するランダムな GUID です。サンプルプロジェクトにはすでにこの行があるので、この手順は省略できます。続けて値を設定します。

```bash
dotnet user-secrets set "Todo:AdminKey" "s3cr3t-for-demo"
```

```text
Successfully saved Todo:AdminKey to the secret store.
```

再実行すると `adminKeyConfigured` が `true` になります。

```json
{"welcomeMessage":"Welcome to the Todo API (Development)","maxItems":5,"adminKeyConfigured":true}
```

秘密情報はユーザーディレクトリに保存され、プロジェクトと一緒に Git にコミットされることはありません。`dotnet user-secrets list` で確認できます。実験後は `dotnet user-secrets remove "Todo:AdminKey"` でこの項目だけを削除できます。ほかのキーには影響しません。

`/settings` が返すのはキーが設定されているかどうかだけで、確認に使えます。サーバー側の秘密情報そのものをクライアントに返すことはありません。

::: warning 注意
User Secrets は既定で開発環境でのみ読み込まれ、値は暗号化されずに保存されます。この例を本番環境で実行し、ほかの構成ソースから `AdminKey` を渡していない場合に限り、`adminKeyConfigured` は `false` になります。デプロイ時には環境変数またはシークレット管理サービスからキーを提供してください。
:::

## まとめ

- 構成は複数のソースを重ねて作られます。`appsettings.json` → `appsettings.{環境}.json` → User Secrets（開発環境のみ）→ 環境変数 → コマンドラインの順に読み込まれ、**後の値が前の値を上書きします**。
- 環境変数では階層を `__`（`Todo__MaxItems`）、コマンドラインでは `:`（`--Todo:MaxItems=30`）で表します。
- **Options パターン**：`AddOptions<T>().BindConfiguration("セクション名")` で構成を型安全なクラスにバインドし、ハンドラーで `IOptions<T>` を注入して使います。
- データ注釈と `ValidateOnStart()` で構成を検証します。値が無効なら実行中のエラーではなく、アプリケーションの**起動失敗**になります。
- 秘密情報をリポジトリに含めないでください。開発時は User Secrets、本番環境では環境変数またはシークレット管理サービスを使います。

次章：[ミドルウェア](./middleware)——リクエストが通る処理パイプラインを理解します。前章：[依存性の注入](./dependency-injection)。
