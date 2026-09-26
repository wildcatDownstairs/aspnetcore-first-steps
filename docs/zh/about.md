---
title: 关于
description: 关于 ASP.NET Core 第一步教程：写给谁、怎么写、如何参与。
prev: false
next: false
---

# 关于本教程

## 写给谁

本教程写给**有编程经验、但没写过 C# 或 ASP.NET Core** 的开发者。你可能写过 Python（FastAPI、Flask、Django）、Node.js，或者主要做前端。读完主线之后，你应该能够独立写出一个带数据库和认证、可以部署上线的 Web API。

## 技术范围

- **.NET 10（LTS）与 C# 14**：所有代码都基于 .NET 10 的写法，不涉及 `Startup.cs` 等旧模式；
- **只讲 Minimal API**：不讲 MVC Controller、Razor Pages 和 Blazor，把篇幅集中在一条路线上；
- **EF Core + SQLite**：数据库零安装，克隆仓库就能运行；
- **内置 OpenAPI + Scalar**：每个示例都自带交互式 API 文档。

## 写作原则

- **一页只引入一个新概念**。页面开头先给出完整代码，再逐段拆解。
- **代码都能直接运行**。教程中的代码全部引用自仓库 `samples/` 目录下的真实项目，不在文档里手写；持续集成（CI）会在每次提交时编译所有示例，任何一个编译失败都无法发布。
- **解释"为什么"**，而不只是"怎么用"。
- **给出预期输出**，让你能确认自己做对了。

本教程的结构和教学方法受到 FastAPI 官方教程的启发，但所有文字与示例均为原创。

## 参与贡献

发现错误、有不清楚的地方，或者希望增加某个主题，欢迎在 GitHub 仓库提交 Issue 或 Pull Request。每一页底部都有"在 GitHub 上编辑此页"的链接。
