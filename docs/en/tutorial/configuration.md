---
title: Configuration and Options
description: Supply configuration through appsettings.json, environment variables, the command line, and User Secrets; understand their precedence, then bind configuration to a strongly typed class with the Options pattern and validate it at startup.
---

# Configuration and Options

Suppose the development environment should show 5 Todos per page, while a deployment should show 20. We can put this value in configuration so it can be changed without recompiling the code.

In this chapter, we use the **Options pattern** to read these settings into a `TodoOptions` class, access them through properties, and check that the item count is within the allowed range.

<<< @/../samples/12-configuration/Program.cs{8-11,21-30,34-45 cs:line-numbers} [12-configuration/Program.cs]

The values are in `appsettings.json` at the project root. The highlighted section is the new `Todo` configuration for this chapter:

<<< @/../samples/12-configuration/appsettings.json{9-12 json:line-numbers} [12-configuration/appsettings.json]

## Run and verify

Stop the service from the previous chapter, then run this from the repository root:

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

Notice that the welcome message ends with “(Development),” even though those characters are not in `appsettings.json`. They come from another file:

<<< @/../samples/12-configuration/appsettings.Development.json{8-10 json:line-numbers} [12-configuration/appsettings.Development.json]

## Where configuration comes from

ASP.NET Core configuration combines multiple **configuration sources**. By default, `WebApplication.CreateBuilder` loads them in this order, with **later sources overriding earlier ones**:

| Order | Configuration source | Typical use |
| --- | --- | --- |
| 1 | `appsettings.json` | Default values shared by all environments and committed to the repository |
| 2 | `appsettings.{Environment}.json` | Values specific to an environment, such as `appsettings.Development.json` |
| 3 | User Secrets (development only) | Developer-local secrets kept out of the repository |
| 4 | Environment variables | Values supplied during deployment by a server, container, or cloud platform |
| 5 | Command-line arguments | Temporary overrides, useful for debugging |

So in development, `WelcomeMessage` is first read as “Welcome to the Todo API” from the first source, then overridden by the second. `MaxItems` appears only in the first source, so it remains 5.

This lets us keep defaults in files, override them with environment variables during deployment, and use command-line arguments for temporary experiments. There is no need to copy the entire configuration file just to change one value.

### Override a value with an environment variable

Each time you change the startup arguments below, stop the service with `Ctrl+C`, restart it, and then request `/settings` from another terminal.

Use a **double underscore** `__` in environment variable names to represent a hierarchy, because some systems do not allow colons in variable names:

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

### Override a value with a command-line argument

Command-line arguments use a colon for hierarchy and go after `--`. They have higher precedence than environment variables:

```bash
dotnet run -- --Todo:MaxItems=30
```

```json
{"welcomeMessage":"Welcome to the Todo API (Development)","maxItems":30,"adminKeyConfigured":false}
```

The result is still 30 even if the environment variable `Todo__MaxItems=20` is also set.

::: tip Tip
An `$env:` variable set in PowerShell remains in that terminal window and affects every later `dotnet run`. After experimenting, remove it with `Remove-Item Env:Todo__MaxItems`.
:::

## Bind configuration to a strongly typed class

<<< @/../samples/12-configuration/Program.cs{8-11,34-45 cs:line-numbers} [12-configuration/Program.cs]

`TodoOptions` on lines 34–45 is an ordinary class. Its property names correspond to the keys in the `Todo` section of `appsettings.json`. Lines 8–11 do three things:

1. `AddOptions<TodoOptions>()`: prepares the Options service for this type, so we can get the configuration through `IOptions<TodoOptions>`.
2. `BindConfiguration("Todo")`: **binds** the values in the `Todo` configuration section to this class's properties. The `SectionName` constant on line 36 ensures the section name appears only once.
3. `ValidateDataAnnotations()` and `ValidateOnStart()`: validate the configuration using the data annotations on lines 38 and 41, and run validation **at startup**.

The handler declares an `IOptions<TodoOptions>` parameter (line 21) and uses `.Value` to get the bound object.

For only one or two settings, we could read `builder.Configuration["Todo:MaxItems"]` directly. Putting related settings in a class gives us one place to convert types and check ranges; code can then use `settings.MaxItems` as an integer.

The editor can check C# property names, but it cannot check keys in JSON. A misspelled configuration key may leave a property at its default value, so validation is still needed.

### Find configuration errors at startup

If a value is invalid, for example if `MaxItems` is set to 0:

```bash
dotnet run -- --Todo:MaxItems=0
```

The application **does not start**:

```text
fail: Microsoft.Extensions.Hosting.Internal.Host[11]
      Hosting failed to start
      Microsoft.Extensions.Options.OptionsValidationException: DataAnnotation validation failed for 'TodoOptions' members: 'MaxItems' with the error: 'The field MaxItems must be between 1 and 100.'.
```

`ValidateOnStart()` exposes configuration errors during startup. Without it, validation usually waits until `.Value` is first read, so the bad configuration may not be discovered until a request arrives.

::: info Technical detail
`IOptions<T>` caches the configuration object. Restart the application after changing JSON to read the new value. For dynamic updates, there are also `IOptionsSnapshot<T>` (creates a snapshot on first access in each scope) and `IOptionsMonitor<T>` (supports notifications when configuration changes). This chapter uses `IOptions<T>`.
:::

::: fastapi FastAPI comparison
The Options pattern is similar to pydantic-settings: declare settings and their types in a class, read them from files and environment variables, and validate them. In FastAPI, settings are commonly injected with `Depends(get_settings)`; here, we inject `IOptions<TodoOptions>`.
:::

## Store secrets with User Secrets

`TodoOptions.AdminKey` (line 44) represents a third-party service key. Do not put a real secret in `appsettings.json`, which is committed to the repository.

During development, store secrets with **User Secrets**. Initialize it in the project directory:

```bash
dotnet user-secrets init
```

This command adds a `<UserSecretsId>` to the `.csproj`. It is a random GUID that identifies the project's secret store. The sample project already has this line, so you can skip this step. Then set a value:

```bash
dotnet user-secrets set "Todo:AdminKey" "s3cr3t-for-demo"
```

```text
Successfully saved Todo:AdminKey to the secret store.
```

After restarting the application, `adminKeyConfigured` becomes `true`:

```json
{"welcomeMessage":"Welcome to the Todo API (Development)","maxItems":5,"adminKeyConfigured":true}
```

Secrets are stored in the user directory and are not committed to Git with the project. Run `dotnet user-secrets list` to view them. After experimenting, run `dotnet user-secrets remove "Todo:AdminKey"` to remove this entry without affecting other secrets.

`/settings` returns only whether a key is configured; it does not return the server's secret to the client.

::: warning Note
User Secrets are loaded only in development by default, and their values are stored as plain text. If you switch this example to production without supplying `AdminKey` from another configuration source, `adminKeyConfigured` is `false`. During deployment, supply secrets through environment variables or a secret management service.
:::

## Summary

- Configuration combines sources: `appsettings.json` → `appsettings.{Environment}.json` → User Secrets (development only) → environment variables → command line. **Later sources override earlier ones.**
- Environment variables use `__` for hierarchy (`Todo__MaxItems`); command-line arguments use `:` (`--Todo:MaxItems=30`).
- **Options pattern**: `AddOptions<T>().BindConfiguration("section name")` binds configuration to a strongly typed class, which a handler can use through injected `IOptions<T>`.
- Use data annotations and `ValidateOnStart()` to validate configuration. Invalid settings make the application **fail at startup**, rather than fail during a request.
- Keep secrets out of the repository: use User Secrets during development and environment variables or a secret management service in production.

Next: [Middleware](./middleware)—understand the request processing pipeline. Previous: [Dependency Injection](./dependency-injection).
