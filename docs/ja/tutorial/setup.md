---
title: 開発環境の準備
description: .NET 10 SDK と VS Code + C# Dev Kit をインストールし、dotnet CLI を確認して最初の .NET プログラムを実行します。
---

# 開発環境の準備

この節で行うことは一つだけです。**.NET の開発環境を整え、動作することを確認します。** 次の小さなプログラムを実行すると、マシン上の .NET バージョンが表示されます。

<<< @/../samples/00-setup/Program.cs{cs:line-numbers} [00-setup/Program.cs]

実行後に次のような出力が表示されれば、この節は完了です。

```text
Hello, .NET!
.NET runtime version: 10.0.12
Operating system: Microsoft Windows 10.0.26200
```

順番に進めていきましょう。

## 必要なもの

| ツール | 用途 | 必須かどうか |
| --- | --- | --- |
| .NET 10 SDK | C# プログラムのコンパイルと実行に必要なツール一式 | 必須 |
| VS Code + C# Dev Kit 拡張機能 | 補完、エラー表示、デバッグを備えたエディター | 推奨（ほかのエディターも使用できます） |
| ターミナル | `dotnet` コマンドの実行 | 必須 |
| curl | ターミナルから HTTP リクエストを送信し、API を確認 | 推奨 |

## .NET 10 SDK のインストール

まず、二つの用語を区別しましょう。

- **SDK**（Software Development Kit、ソフトウェア開発キット）：プログラムを書くためのものです。コンパイラーと `dotnet` CLI を含み、**ランタイムも含まれます**。
- **ランタイム**（Runtime）：コンパイル済みプログラムを実行するためのものです。通常はサーバーにインストールします。

開発用マシンには SDK をインストールすれば十分です。ランタイムを別途インストールする必要はありません。

::: code-group

```powershell [Windows]
winget install Microsoft.DotNet.SDK.10
```

```bash [macOS]
brew install --cask dotnet-sdk
```

```bash [Linux]
# ディストリビューションごとにインストール方法が異なります。公式ドキュメントを参照してください:
# https://learn.microsoft.com/dotnet/core/install/linux
```

:::

[.NET 公式ダウンロードページ](https://dotnet.microsoft.com/download/dotnet/10.0)からインストーラーをダウンロードする方法もあります。

インストール後、**新しいターミナルを開き直して**（新しい PATH を反映させてから）、次を実行します。

```bash
dotnet --version
```

次のように、`10.0` で始まるバージョン番号が表示されます。

```text
10.0.100
```

::: tip ヒント
マシンに複数の SDK バージョンがインストールされている場合、`dotnet --list-sdks` ですべて確認できます。複数のバージョンは共存でき、互いに影響しません。
:::

### .NET 10 を選ぶ理由

.NET は毎年 11 月にメジャーバージョンをリリースします。**偶数バージョンは LTS**（Long Term Support、長期サポート）で、3 年間公式サポートされます。奇数バージョンは STS（標準サポート期間）で、サポートは 2 年間です。

.NET 10 は 2025 年 11 月にリリースされた LTS バージョンで、2028 年 11 月までサポートされます。学習者にとっては、今学んだ書き方が今後数年間「現行の書き方」であり、すぐに古くならないということです。このチュートリアルのコードはすべて .NET 10 と付属の C# 14 を基準にしています。

::: warning 注意
Web 上には .NET 5 以前を基準にした ASP.NET Core のチュートリアルが多く、`Startup.cs` や `ConfigureServices` などの書き方が登場します。これらは古い方式で、.NET 10 では不要です。記事の公開時期に注意してください。
:::

## エディターのインストール

[VS Code](https://code.visualstudio.com/) と、Microsoft 公式の **C# Dev Kit** 拡張機能の組み合わせを推奨します。

1. VS Code をインストールします。
2. 拡張機能パネル（`Ctrl+Shift+X`、macOS では `Cmd+Shift+X`）を開き、**C# Dev Kit** を検索してインストールします。基本的な C# 拡張機能も一緒にインストールされます。

インストールすると、コード作成時にメンバー補完、ホバーによる型の表示、コンパイルエラーのリアルタイム表示（赤い波線）、ワンクリックデバッグを利用できます。後の章ではこれらの機能を多く使います。**C# は静的型付け言語なので、エディターはプログラムを実行する前に多くのエラーを見つけられます。**

::: tip ヒント
ほかの選択肢も使えます。JetBrains Rider は個人の非商用利用なら無料で、機能も充実しています。Windows では Visual Studio 2026 も利用できます。このチュートリアルは `dotnet` CLI のみを使い、特定のエディターには依存しません。
:::

## dotnet CLI を知る

`dotnet` は .NET の統一された入口です。プロジェクトの作成、依存関係の追加、コンパイル、実行はすべてこれを使います。このチュートリアルでは次のコマンドを繰り返し使います。

| コマンド | 用途 |
| --- | --- |
| `dotnet new <template> -o <directory>` | テンプレートから新しいプロジェクトを作成 |
| `dotnet run` | 現在のディレクトリのプロジェクトをコンパイルして実行 |
| `dotnet watch` | プロジェクトを実行し、コードの変更時に自動で再読み込み |
| `dotnet build` | 実行せずにコンパイル |
| `dotnet add package <package-name>` | NuGet 依存パッケージをプロジェクトに追加 |

::: fastapi FastAPI との比較
`dotnet` はおおよそ、`python`、`pip`、`venv` を一つにまとめたツールに相当します。プロジェクトファイル `.csproj` は `pyproject.toml` に、NuGet は PyPI に近い役割です。仮想環境は不要で、各プロジェクトの依存関係はそれぞれの `.csproj` に宣言します。
:::

## 最初のプログラムを実行する

`console`（コンソールアプリ）テンプレートでプロジェクトを作成します。

```bash
dotnet new console -o HelloDotnet
cd HelloDotnet
```

`-o HelloDotnet` は出力先を `HelloDotnet` ディレクトリに指定し、プロジェクト名も同じ名前にします。ディレクトリを開くと、二つのファイルがあります。

<<< @/../samples/00-setup/HelloDotnet.csproj{xml:line-numbers} [00-setup/HelloDotnet.csproj]

これは**プロジェクトファイル**です。XML で「このプロジェクトは何か、どのようにビルドするか」を記述します。ここでは次の三行を理解すれば十分です。

- **5 行目** `TargetFramework`：対象フレームワークは `net10.0`、つまり .NET 10 です。
- **6 行目** `ImplicitUsings`：暗黙的な using です。有効にすると、よく使う名前空間（`System` など）が自動で読み込まれるため、`using System;` を先に書かなくても `Console` を使えます。
- **7 行目** `Nullable`：nullable 参照型のチェックを有効にし、潜在的な null 参照エラーをコンパイラーが見つけられるようにします。次の章で詳しく説明します。

もう一つのファイルは `Program.cs` です。内容をこのページ冒頭のコードに置き換えて実行します。

```bash
dotnet run
```

初回はコンパイルが行われます。数秒待つと、次のように表示されます。

```text
Hello, .NET!
.NET runtime version: 10.0.12
Operating system: Microsoft Windows 10.0.26200
```

バージョン番号と OS はマシンによって異なります。ランタイムのバージョンが `10.0` で始まっていれば問題ありません。

::: info 技術詳細
`Program.cs` に `class` も `Main` メソッドもなく、コードが一行目から実行されることに気づいたかもしれません。これは**トップレベル ステートメント**（top-level statements）です。コンパイラーが `Main` メソッドを自動生成し、コードをそこに配置します。小さなプログラム（後の Web API も含む）を簡潔に書けます。

1 行目の `using System.Runtime.InteropServices;` は手動で記述する必要があります。`RuntimeInformation` の名前空間は暗黙的な using の既定リストに含まれていないためです。
:::

## curl の準備

第 02 章から、自分で作成した API に `curl` でリクエストを送ります。まず `curl --version` を実行し、インストール済みか確認してください。ターミナルでコマンドが見つからない場合は、OS のパッケージマネージャーから curl をインストールします。

::: warning 注意
**Windows PowerShell 5.1**（Windows 標準の青い PowerShell）では、`curl` は `Invoke-WebRequest` のエイリアスで、本来の curl とは動作が異なります。コマンドには `curl.exe` と記述するか、PowerShell 7、Git Bash、Windows Terminal 内の別のシェルを使ってください。
:::

第 02 章を終えたら、[任意の付録：開発ツールの練習](./development-tools)を読んで、コンパイル診断と `dotnet watch` を練習できます。今すぐ学ぶ必要はありません。

## まとめ

- 開発用マシンには **.NET 10 SDK** をインストールします。ランタイムも付属し、`dotnet --version` は `10.0.x` を表示します。
- .NET 10 は **LTS** バージョンで、2028 年 11 月までサポートされます。`Startup.cs` が登場するチュートリアルは古い方式です。
- **VS Code + C# Dev Kit** を推奨します。静的型付けにより、エディターは実行前にエラーを見つけられます。
- `dotnet new`、`dotnet run`、`dotnet watch`、`dotnet add package` はチュートリアル全体で使う四つのコマンドです。
- `.csproj` はプロジェクトファイルです。`Program.cs` は**トップレベル ステートメント**を使い、一行目から実行します。

環境が整いました。次の章は[C# の概要](./csharp-tour)です。このチュートリアルで使う C# の構文を簡単に見ていきます。Java、TypeScript などの静的型付け言語に慣れている場合は、[最初の一歩](./first-steps)に進んでもかまいません。
