---
title: Setup
description: 'Install the .NET 10 SDK and VS Code + C# Dev Kit, learn the dotnet CLI, and run your first .NET program.'
---

# Setup

This section has one goal: **set up the .NET development environment and confirm that it works.** We’ll verify it by running a small program that prints the .NET version on your machine.

<<< @/../samples/00-setup/Program.cs{cs:line-numbers} [00-setup/Program.cs]

If you see output similar to this, you’re done:

```text
Hello, .NET!
.NET runtime version:10.0.12
Operating system:Microsoft Windows 10.0.26200
```

Let’s go step by step.

## What you need

| Tool | Purpose | Required? |
| --- | --- | --- |
| .NET 10 SDK | All the tools needed to compile and run C# programs | Yes |
| VS Code + C# Dev Kit extension | Editor with completion, error hints, and debugging | Recommended (other editors work too) |
| A terminal | Run `dotnet` commands | Yes |
| curl | Send HTTP requests from the terminal to verify endpoints | Recommended |

## Install the .NET 10 SDK

First, distinguish these two terms:

- **SDK** (Software Development Kit): for writing programs. It includes the compiler, the `dotnet` CLI, **and the runtime**.
- **Runtime**: only runs already-compiled programs and is typically installed on servers.

For development, installing the SDK is enough; you don’t need to install the runtime separately.

::: code-group

```powershell [Windows]
winget install Microsoft.DotNet.SDK.10
```

```bash [macOS]
brew install --cask dotnet-sdk
```

```bash [Linux]
# Installation varies by distribution. See the official documentation:
# https://learn.microsoft.com/dotnet/core/install/linux
```

:::

You can also download an installer from the [.NET downloads page](https://dotnet.microsoft.com/download/dotnet/10.0).

After installation, **open a new terminal** so the updated PATH takes effect, then run:

```bash
dotnet --version
```

You should see a version number beginning with `10.0`, for example:

```text
10.0.100
```

::: tip
If multiple SDK versions are installed, `dotnet --list-sdks` lists them all. Multiple versions can coexist without interfering with each other.
:::

### Why .NET 10?

.NET releases a major version every November. **Even-numbered versions are LTS** (Long Term Support) and receive three years of official support; odd-numbered versions are STS (Standard Term Support) and receive two years.

.NET 10 is the LTS release from November 2025 and is supported through November 2028. For learners, that means the code you learn now will remain current for the next few years. All code in this tutorial is based on .NET 10 and its included C# 14.

::: warning
Many ASP.NET Core tutorials online are based on .NET 5 or earlier and use patterns such as `Startup.cs` and `ConfigureServices`. These are older patterns and are no longer needed in .NET 10. Check when an article was published.
:::

## Install an editor

We recommend [VS Code](https://code.visualstudio.com/) with Microsoft’s official **C# Dev Kit** extension:

1. Install VS Code.
2. Open the Extensions panel (`Ctrl+Shift+X`, or `Cmd+Shift+X` on macOS), search for **C# Dev Kit**, and install it. It will also install the core C# extension.

Once installed, you’ll get member completion, type information on hover, live compile errors (red squiggles), and one-click debugging. We’ll rely on these features throughout the later chapters. **C# is statically typed, so the editor can catch many errors before you run the program.**

::: tip
Other options work well too: JetBrains Rider is free for personal, non-commercial use and has a full feature set; Windows users can also use Visual Studio 2026. This tutorial uses only the `dotnet` CLI and does not depend on a particular editor.
:::

## Get to know the dotnet CLI

`dotnet` is the unified entry point for .NET. Use it to create projects, add dependencies, compile, and run programs. These are the commands you’ll use throughout this tutorial:

| Command | Purpose |
| --- | --- |
| `dotnet new <template> -o <directory>` | Create a project from a template |
| `dotnet run` | Compile and run the project in the current directory |
| `dotnet watch` | Run the project and reload it automatically when code changes |
| `dotnet build` | Compile without running |
| `dotnet add package <package-name>` | Add a NuGet package dependency to the project |

::: fastapi FastAPI comparison
`dotnet` roughly combines the roles of `python`, `pip`, and `venv`: the project file `.csproj` is similar to `pyproject.toml`, and NuGet is similar to PyPI. You don’t need a virtual environment; each project declares its own dependencies in its `.csproj` file.
:::

## Run your first program

Create a project with the `console` template:

```bash
dotnet new console -o HelloDotnet
cd HelloDotnet
```

`-o HelloDotnet` writes the project to the `HelloDotnet` directory and uses that name for the project. Open the directory and you’ll see two files:

<<< @/../samples/00-setup/HelloDotnet.csproj{xml:line-numbers} [00-setup/HelloDotnet.csproj]

This is the **project file**, an XML description of what the project is and how to build it. For now, focus on these three lines:

- **Line 5**, `TargetFramework`: the target framework is `net10.0`, which means .NET 10.
- **Line 6**, `ImplicitUsings`: enables implicit using directives. Common namespaces such as `System` are imported automatically, so code can use `Console` without first writing `using System;`.
- **Line 7**, `Nullable`: enables nullable reference type checks so the compiler can help find potential null-reference errors. We’ll cover this in detail in the next chapter.

The other file is `Program.cs`. Replace its contents with the code at the top of this page, then run:

```bash
dotnet run
```

The first run compiles the program. After a few seconds, you should see:

```text
Hello, .NET!
.NET runtime version:10.0.12
Operating system:Microsoft Windows 10.0.26200
```

The version and operating system vary by machine. As long as the runtime version starts with `10.0`, you’re all set.

::: info Technical detail
You may have noticed that `Program.cs` has no `class` or `Main` method; execution starts at the first line. These are called **top-level statements**: the compiler generates a `Main` method and places this code inside it. This keeps small programs, including the Web APIs later in this tutorial, concise.

Line 1’s `using System.Runtime.InteropServices;` must be written manually because the namespace containing `RuntimeInformation` is not in the default implicit-using list.
:::

## Get ready to use curl

Starting in Chapter 02, we’ll use `curl` to send requests to the endpoints we build. Run `curl --version` to check whether it is installed. If the terminal can’t find the command, install curl with your system’s package manager.

::: warning
In **Windows PowerShell 5.1** (the blue PowerShell that comes with Windows), `curl` is an alias for `Invoke-WebRequest`, whose behavior is quite different from real curl. Write `curl.exe` in commands, or use PowerShell 7, Git Bash, or another shell in Windows Terminal.
:::

After completing Chapter 02, you can read the [optional appendix: Development Tools Practice](./development-tools) to practice compiler diagnostics and `dotnet watch`. You don’t need it yet.

## Summary

- Development machines need only the **.NET 10 SDK**, which includes the runtime. `dotnet --version` should print `10.0.x`.
- .NET 10 is an **LTS** release supported through November 2028. Tutorials using `Startup.cs` show an older pattern.
- We recommend **VS Code + C# Dev Kit**. Static typing lets the editor catch errors before you run the program.
- `dotnet new`, `dotnet run`, `dotnet watch`, and `dotnet add package` are four commands used throughout this tutorial.
- `.csproj` is the project file. `Program.cs` uses **top-level statements** that execute from the first line.

Your environment is ready. Next: [C# Tour](./csharp-tour), a quick look at the C# syntax used in this tutorial. If you already know a statically typed language such as Java or TypeScript, you can go straight to [First Steps](./first-steps).
