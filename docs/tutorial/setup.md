---
title: 环境准备
description: 安装 .NET 10 SDK 和 VS Code + C# Dev Kit，认识 dotnet 命令行，运行第一个 .NET 程序。
---

# 环境准备

本节只做一件事：**把 .NET 开发环境装好，并确认它能工作。** 验证的方式是运行下面这个小程序——它会打印出你机器上的 .NET 版本。

<<< @/../samples/00-setup/Program.cs{cs:line-numbers} [00-setup/Program.cs]

如果你运行它之后看到了类似下面的输出，这一节就完成了：

```text
你好，.NET！
.NET 运行时版本：10.0.12
操作系统：Microsoft Windows 10.0.26200
```

下面一步一步来。

## 你需要准备什么

| 工具 | 作用 | 是否必须 |
| --- | --- | --- |
| .NET 10 SDK | 编译、运行 C# 程序的全部工具 | 必须 |
| VS Code + C# Dev Kit 扩展 | 编辑器，提供补全、错误提示、调试 | 推荐（也可以用其他编辑器） |
| 一个终端 | 执行 `dotnet` 命令 | 必须 |
| curl | 在终端里发送 HTTP 请求，验证接口 | 推荐 |

## 安装 .NET 10 SDK

先分清两个词：

- **SDK**（Software Development Kit，软件开发工具包）：写程序用的。包含编译器、`dotnet` 命令行工具，**也包含运行时**。
- **运行时**（Runtime）：只负责运行已经编译好的程序，通常装在服务器上。

开发机上装 SDK 就够了，不需要另外装运行时。

::: code-group

```powershell [Windows]
winget install Microsoft.DotNet.SDK.10
```

```bash [macOS]
brew install --cask dotnet-sdk
```

```bash [Linux]
# 各发行版的安装方式不同，请参考官方文档：
# https://learn.microsoft.com/dotnet/core/install/linux
```

:::

也可以直接到 [.NET 官方下载页](https://dotnet.microsoft.com/download/dotnet/10.0) 下载安装包。

装好之后**重新打开一个终端**（让新的 PATH 生效），然后执行：

```bash
dotnet --version
```

预期输出是一个以 `10.0` 开头的版本号，例如：

```text
10.0.100
```

::: tip 提示
如果你的机器上装了多个版本的 SDK，`dotnet --list-sdks` 会把它们全部列出来。多个版本可以共存，互不影响。
:::

### 为什么选 .NET 10

.NET 每年 11 月发布一个大版本，**偶数版本是 LTS**（Long Term Support，长期支持版本），获得 3 年的官方支持；奇数版本是 STS（标准期限支持），只有 2 年。

.NET 10 是 2025 年 11 月发布的 LTS 版本，支持到 2028 年 11 月。对学习者来说，这意味着你现在学的写法在未来几年里都是"当前写法"，不会很快过时。本教程所有代码都基于 .NET 10 和它附带的 C# 14。

::: warning 注意
网上很多 ASP.NET Core 教程基于 .NET 5 或更早的版本，里面会有 `Startup.cs`、`ConfigureServices` 等写法。这些是旧模式，在 .NET 10 中已经不需要了。遇到时请留意文章的发布时间。
:::

## 安装编辑器

推荐 [VS Code](https://code.visualstudio.com/) 加上微软官方的 **C# Dev Kit** 扩展：

1. 安装 VS Code；
2. 打开扩展面板（`Ctrl+Shift+X`，macOS 为 `Cmd+Shift+X`），搜索 **C# Dev Kit** 并安装。它会顺带装上基础的 C# 扩展。

装好之后，你会在编写代码时获得：成员补全、悬停查看类型、实时的编译错误提示（红色波浪线）、一键调试。在后面的章节里，我们会大量依赖这些功能——**C# 是静态类型语言，编辑器能在你运行程序之前就发现大部分错误**。

::: tip 提示
其他选择也完全可以：JetBrains Rider（个人非商业用途免费）功能非常完整；Windows 用户也可以使用 Visual Studio 2026。本教程只使用 `dotnet` 命令行，不依赖任何特定编辑器。
:::

## 认识 dotnet 命令行

`dotnet` 是 .NET 的统一入口，创建项目、添加依赖、编译、运行都通过它完成。本教程会反复用到这几个命令：

| 命令 | 作用 |
| --- | --- |
| `dotnet new <模板> -o <目录>` | 用模板创建新项目 |
| `dotnet run` | 编译并运行当前目录的项目 |
| `dotnet watch` | 运行项目，并在代码变化时自动重新加载 |
| `dotnet build` | 只编译，不运行 |
| `dotnet add package <包名>` | 给项目添加一个 NuGet 依赖包 |

::: fastapi
`dotnet` 大致相当于把 `python`、`pip`、`venv` 合成了一个工具：项目文件 `.csproj` 的角色类似 `pyproject.toml`，NuGet 相当于 PyPI。不需要虚拟环境——每个项目的依赖由它自己的 `.csproj` 声明。
:::

## 运行第一个程序

用 `console`（控制台应用）模板创建一个项目：

```bash
dotnet new console -o HelloDotnet
cd HelloDotnet
```

`-o HelloDotnet` 表示输出到 `HelloDotnet` 目录，项目名也会取这个名字。打开目录，你会看到两个文件：

<<< @/../samples/00-setup/HelloDotnet.csproj{xml:line-numbers} [00-setup/HelloDotnet.csproj]

这是**项目文件**，用 XML 描述"这个项目是什么、怎么构建"。现在只需要看懂其中三行：

- **第 5 行** `TargetFramework`：目标框架是 `net10.0`，也就是 .NET 10。
- **第 6 行** `ImplicitUsings`：隐式 using。开启后，常用的命名空间（如 `System`）会被自动引入，所以代码里可以直接写 `Console`，而不用先写 `using System;`。
- **第 7 行** `Nullable`：启用可空引用类型检查，让编译器帮你发现潜在的空引用错误。下一章会详细介绍它。

另一个文件是 `Program.cs`。把它的内容替换成本页开头的代码，然后运行：

```bash
dotnet run
```

第一次运行会先编译，稍等几秒后看到：

```text
你好，.NET！
.NET 运行时版本：10.0.12
操作系统：Microsoft Windows 10.0.26200
```

版本号和操作系统会因机器而异，只要运行时版本以 `10.0` 开头就对了。

::: info 技术细节
你可能注意到 `Program.cs` 里没有 `class`，也没有 `Main` 方法，代码直接从第一行开始执行。这叫**顶级语句**（top-level statements）：编译器会自动帮你生成 `Main` 方法并把这些代码放进去。它让小程序（包括后面的 Web API）可以写得很简洁。

第 1 行的 `using System.Runtime.InteropServices;` 需要手动写，是因为 `RuntimeInformation` 所在的命名空间不在隐式 using 的默认列表里。
:::

## 准备好 curl

从第 02 章开始，我们会用 `curl` 向自己写的接口发请求。先执行 `curl --version` 确认它已经安装；如果终端提示找不到命令，请先通过系统的包管理器安装 curl。

::: warning 注意
在 **Windows PowerShell 5.1**（Windows 自带的蓝色 PowerShell）中，`curl` 是 `Invoke-WebRequest` 的别名，行为和真正的 curl 完全不同。请在命令中写成 `curl.exe`，或者改用 PowerShell 7、Git Bash、Windows Terminal 中的其他 shell。
:::

完成第 02 章后，可以阅读[可选附录：开发工具练习](./development-tools)，练习编译诊断和 `dotnet watch`，不必现在学习。

## 总结

- 开发机只需要安装 **.NET 10 SDK**，它自带运行时；`dotnet --version` 应输出 `10.0.x`。
- .NET 10 是 **LTS** 版本，支持到 2028 年 11 月；看到 `Startup.cs` 的教程说明是旧写法。
- 推荐 **VS Code + C# Dev Kit**，静态类型让编辑器能在运行前发现错误。
- `dotnet new`、`dotnet run`、`dotnet watch`、`dotnet add package` 是贯穿全教程的四个命令。
- `.csproj` 是项目文件，`Program.cs` 使用**顶级语句**，从第一行开始执行。

环境就绪。下一章：[C# 速览](./csharp-tour)——快速了解本教程会用到的 C# 语法。如果你已经熟悉 Java、TypeScript 等静态类型语言，也可以直接进入[第一步](./first-steps)。
