---
title: 开发工具练习
description: 使用第 02 章的完整示例，练习编译错误诊断和 dotnet watch 热重载。
prev: false
next: false
---

# 开发工具练习

这是一份可选附录。完成[第一步](./first-steps)后，可以用同一个项目练习编辑、编译和重新运行的循环；跳过它不影响后续章节。

练习使用的完整代码如下。请在第 02 章创建的 `FirstSteps` 项目目录中执行本页命令；如果使用仓库示例，则进入 `samples/02-first-steps`。

<<< @/../samples/02-first-steps/Program.cs{15 cs:line-numbers} [02-first-steps/Program.cs]

## 让编译器帮你检查

C# 是静态类型语言，很多错误在运行之前就会被发现。试着把第 15 行的 `MapGet` 故意写错成 `MapGt`，编辑器会立即标出红色波浪线；执行 `dotnet build` 会看到：

```text
Program.cs(15,5): error CS1061: “WebApplication”未包含“MapGt”的定义，并且找不到可接受第一个“WebApplication”类型参数的可访问扩展方法“MapGt”(是否缺少 using 指令或程序集引用?)
```

错误信息告诉你：在第 15 行第 5 列，`WebApplication` 类型上没有 `MapGt` 这个成员。程序根本不会启动，更不会在某个请求到来时才崩溃。

实验后把 `MapGt` 改回 `MapGet`，确认 `dotnet build` 成功，再继续下面的操作。诊断信息的语言会随 SDK 的语言设置变化。

同样，在 `app.` 后面输入 `Map`，编辑器会列出所有可用的方法（`MapGet`、`MapPost`、`MapGroup`……）并显示它们的参数说明。类型信息能帮助编辑器补全代码，也能为 OpenAPI 提供响应结构，减少重复维护。

## 使用 dotnet watch 自动重载

如果之前启动的服务还在运行，先在它的终端按 `Ctrl+C` 停止。然后在同一个项目目录中改用：

```bash
dotnet watch
```

它会运行项目并监视文件变化。启动后把第 15 行的文字改成 `"你好，热重载！"` 并保存，终端里会出现：

```text
dotnet watch ⌚ File updated: .\Program.cs
dotnet watch 🔥 C# and Razor changes applied in 1029ms.
```

再次请求，内容已经变了，而且服务**没有重启**：

```bash
curl http://localhost:5080/
```

```json
{"message":"你好，热重载！"}
```

这叫**热重载**（Hot Reload）：修改被直接应用到正在运行的程序中，日志中的耗时会因机器而异。无法热应用的修改可能触发重启提示；修改服务注册等启动配置后，应在 `dotnet watch` 终端按 `Ctrl+R` 重启，确保已经执行过的启动代码重新运行。

验证完成后，将问候语改回 `"你好，ASP.NET Core！"`，再按 `Ctrl+C` 停止服务，避免影响后续章节的输出和端口。

::: fastapi
`dotnet watch` 相当于 `fastapi dev` 或 `uvicorn --reload`。对于支持热应用的改动，.NET 可以保留进程和内存状态；发生重启时，内存状态仍会丢失。
:::

## 总结

- 编译错误会指出文件和位置，修正后用 `dotnet build` 确认。
- `dotnet watch` 监视代码变化，支持的改动可以热应用，无需重启进程。
- 修改启动配置后，用 `Ctrl+R` 重启；重启会丢失内存状态。

返回：[第一步](./first-steps)。继续学习：[路由参数](./path-params)。
