---
title: 配置与 Options
description: 用 appsettings.json、环境变量、命令行和 User Secrets 提供配置，理解它们的覆盖顺序；用 Options 模式把配置绑定到强类型的类并在启动时校验。
---

# 配置与 Options

假设开发环境每页显示 5 条 Todo，部署后要改成 20 条。这个值可以放在配置里，修改时就不必重新编译代码。

本章用 **Options 模式**（options pattern）把这组配置读进 `TodoOptions` 类，通过属性访问，并检查条数是否在允许范围内。

<<< @/../samples/12-configuration/Program.cs{8-11,21-30,34-45 cs:line-numbers} [12-configuration/Program.cs]

配置的值写在项目根目录的 `appsettings.json` 中，高亮部分是本节新增的 `Todo` 配置节：

<<< @/../samples/12-configuration/appsettings.json{9-12 json:line-numbers} [12-configuration/appsettings.json]

## 运行与验证

```bash
dotnet run
```

```bash
curl http://localhost:5080/settings
```

```json
{"welcomeMessage":"欢迎使用待办事项 API（开发环境）","maxItems":5,"adminKeyConfigured":false}
```

注意欢迎语后面多了"（开发环境）"，而 `appsettings.json` 里并没有这几个字。它来自另一个文件：

<<< @/../samples/12-configuration/appsettings.Development.json{8-10 json:line-numbers} [12-configuration/appsettings.Development.json]

## 配置从哪里来

ASP.NET Core 的配置由多个**配置源**（configuration source）叠加而成。`WebApplication.CreateBuilder` 默认按以下顺序加载，**后加载的覆盖先加载的**：

| 顺序 | 配置源 | 典型用途 |
| --- | --- | --- |
| 1 | `appsettings.json` | 所有环境共用的默认值，提交到代码仓库 |
| 2 | `appsettings.{环境名}.json` | 某个环境特有的值，例如 `appsettings.Development.json` |
| 3 | User Secrets（仅开发环境） | 开发者本机的密钥，不进代码仓库 |
| 4 | 环境变量 | 部署时由服务器、容器、云平台注入 |
| 5 | 命令行参数 | 临时覆盖，调试时方便 |

所以在开发环境中，`WelcomeMessage` 先从第 1 层读到"欢迎使用待办事项 API"，又被第 2 层覆盖了；`MaxItems` 只在第 1 层出现，保持为 5。

这样可以把默认值留在文件里，部署时用环境变量覆盖，临时实验再用命令行覆盖。不必为了改一个值而复制整份配置文件。

### 用环境变量覆盖

环境变量用**双下划线** `__` 表示层级（因为有些系统的环境变量名不允许冒号）：

::: code-group

```bash [macOS / Linux]
Todo__MaxItems=20 dotnet run
```

```powershell [Windows PowerShell]
$env:Todo__MaxItems = "20"; dotnet run
```

:::

```json
{"welcomeMessage":"欢迎使用待办事项 API（开发环境）","maxItems":20,"adminKeyConfigured":false}
```

### 用命令行覆盖

命令行参数用冒号表示层级，写在 `--` 之后。它的优先级比环境变量更高：

```bash
dotnet run -- --Todo:MaxItems=30
```

```json
{"welcomeMessage":"欢迎使用待办事项 API（开发环境）","maxItems":30,"adminKeyConfigured":false}
```

即使同时设置了环境变量 `Todo__MaxItems=20`，结果也是 30。

::: tip 提示
PowerShell 中设置的 `$env:` 变量会一直保留在当前终端窗口里，影响之后每一次 `dotnet run`。试验结束后用 `Remove-Item Env:Todo__MaxItems` 删除它。
:::

## 绑定到强类型的类

<<< @/../samples/12-configuration/Program.cs{8-11,34-45 cs:line-numbers} [12-configuration/Program.cs]

第 34～45 行的 `TodoOptions` 是一个普通的类，属性名和 `appsettings.json` 中 `Todo` 节里的键一一对应。第 8～11 行做了三件事：

1. `AddOptions<TodoOptions>()`：准备这个类型的 Options 服务，之后通过 `IOptions<TodoOptions>` 获取配置；
2. `BindConfiguration("Todo")`：把配置中 `Todo` 节的值**绑定**到这个类的属性上。第 36 行的常量 `SectionName` 让配置节的名字只出现一次；
3. `ValidateDataAnnotations()` 和 `ValidateOnStart()`：用第 38、41 行的数据注解校验配置，并且在**启动时**就执行校验。

使用时，处理程序声明一个 `IOptions<TodoOptions>` 参数（第 21 行），通过 `.Value` 取得绑定好的对象。

配置只有一两项时，也可以直接读取 `builder.Configuration["Todo:MaxItems"]`。这里把相关配置放进一个类，是为了统一转换类型和检查范围，使用时写 `settings.MaxItems` 就能得到整数。

编辑器能检查 C# 属性名，但检查不了 JSON 里的键名。配置键拼错可能让属性保留默认值，因此仍需要校验。

### 在启动时发现配置错误

如果配置的值不合法，比如把 `MaxItems` 设为 0：

```bash
dotnet run -- --Todo:MaxItems=0
```

应用**根本不会启动**：

```text
fail: Microsoft.Extensions.Hosting.Internal.Host[11]
      Hosting failed to start
      Microsoft.Extensions.Options.OptionsValidationException: DataAnnotation validation failed for 'TodoOptions' members: 'MaxItems' with the error: 'The field MaxItems must be between 1 and 100.'.
```

`ValidateOnStart()` 让配置错误在启动时暴露。去掉它，校验通常要等第一次读取 `.Value` 才执行，可能到某个请求进来时才发现配置有误。

::: info 技术细节
`IOptions<T>` 缓存配置对象，修改 JSON 后需要重启应用才能读到新值。需要动态更新时，还有 `IOptionsSnapshot<T>`（在每个作用域首次访问时创建快照）和 `IOptionsMonitor<T>`（支持配置变化通知）；本章先使用 `IOptions<T>`。
:::

::: fastapi
Options 模式相当于 pydantic-settings：用一个类声明配置项和类型，从文件和环境变量中读取，并做校验。FastAPI 中通常用 `Depends(get_settings)` 注入配置对象，这里则是注入 `IOptions<TodoOptions>`。
:::

## 用 User Secrets 保存密钥

`TodoOptions.AdminKey`（第 44 行）模拟第三方服务的密钥。不要把真实密钥写进会提交到仓库的 `appsettings.json`。

开发时的密钥应该用 **User Secrets**（用户机密）保存。先在项目目录下初始化：

```bash
dotnet user-secrets init
```

这个命令会在 `.csproj` 中加入一个 `<UserSecretsId>`，它是一个随机的 GUID，用来标识这个项目的机密存储。示例项目已经包含这一行，所以你可以跳过这一步。然后设置一个值：

```bash
dotnet user-secrets set "Todo:AdminKey" "s3cr3t-for-demo"
```

```text
Successfully saved Todo:AdminKey to the secret store.
```

重新运行后，`adminKeyConfigured` 变成了 `true`：

```json
{"welcomeMessage":"欢迎使用待办事项 API（开发环境）","maxItems":5,"adminKeyConfigured":true}
```

机密保存在用户目录中，不随项目提交到 Git。用 `dotnet user-secrets list` 查看；实验后用 `dotnet user-secrets remove "Todo:AdminKey"` 删除这一项，不影响其他密钥。

`/settings` 只返回是否配置了密钥，方便验证来源；不会把服务端密钥返回给客户端。

::: warning 注意
User Secrets 默认只在开发环境加载，而且以明文保存。本例切到生产环境后，如果没有从其他配置源提供 `AdminKey`，`adminKeyConfigured` 才是 `false`。部署时应从环境变量或密钥管理服务提供密钥。
:::

## 总结

- 配置由多个源叠加：`appsettings.json` → `appsettings.{环境}.json` → User Secrets（仅开发）→ 环境变量 → 命令行，**后面的覆盖前面的**。
- 环境变量用 `__` 表示层级（`Todo__MaxItems`），命令行用 `:`（`--Todo:MaxItems=30`）。
- **Options 模式**：`AddOptions<T>().BindConfiguration("节名")` 把配置绑定到强类型的类，处理程序注入 `IOptions<T>` 使用。
- 用数据注解加 `ValidateOnStart()` 校验配置，不合法的配置会让应用**启动失败**，而不是在运行中出错。
- 密钥不进代码仓库：开发时用 User Secrets，生产环境用环境变量或密钥管理服务。

下一章：[中间件](./middleware)——理解请求经过的处理管道。上一章：[依赖注入](./dependency-injection)。
