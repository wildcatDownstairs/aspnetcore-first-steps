---
title: Logging
description: Get ILogger<T> through dependency injection, write structured logs with message templates, understand log levels and categories, and control output by category in configuration.
---

# Logging

In the previous chapter, we used `Console.WriteLine` to observe execution order. As logs grow, we may want to see output from only one class or temporarily enable debug details. `ILogger` can handle this for us.

This chapter also keeps the Todo identifier as a separate field, so logging tools can search directly by that identifier. This is called **structured logging**.

<<< @/../samples/14-logging/Program.cs{19,24,48,58,71 cs:line-numbers} [14-logging/Program.cs]

The example reuses `ITodoStore` from “Dependency Injection” and writes logs in both the handler and the storage service. The development configuration file adds one line:

<<< @/../samples/14-logging/appsettings.Development.json{6 json:line-numbers} [14-logging/appsettings.Development.json]

## Run and verify

Stop the service from the previous chapter, then run this from the repository root:

```bash
cd samples/14-logging
dotnet run
```

Create a Todo, retrieve it, then request one that does not exist:

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'
curl http://localhost:5080/todos/1
curl http://localhost:5080/todos/99
```

After the startup messages, the service terminal shows:

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

The first line of each log has three parts: `info` / `dbug` / `warn` is the **level**, `InMemoryTodoStore` or `Program` is the **category**, and the `[0]` in brackets is the event ID (unused in this chapter). The second line is the log message.

## Get an ILogger

<<< @/../samples/14-logging/Program.cs{19,48 cs:line-numbers} [14-logging/Program.cs]

A logger is a service, and we get it in exactly the same way as in “Dependency Injection”:

- On line 19, the handler declares an `ILogger<Program>` parameter.
- On line 48, `InMemoryTodoStore` declares `ILogger<InMemoryTodoStore>` in its constructor. The parentheses after the class name use a **primary constructor**, introduced in C# 12. Its `logger` parameter is available throughout the class.

The framework has already registered the logging services; you do not need to call an `AddXxx()` method.

The type in angle brackets determines the log **category**. In this example, the categories are `Program` and `InMemoryTodoStore`; we can use them to tell where a message came from and adjust their output levels separately. `Program` is the class name the compiler generates for top-level statements.

## Log levels

.NET logging has six levels, from lowest to highest:

| Level | Method | Use |
| --- | --- | --- |
| Trace | `LogTrace` | The most detailed tracing information, usually enabled only to investigate a specific problem |
| Debug | `LogDebug` | Useful information during development and debugging |
| Information | `LogInformation` | Important events during normal operation, such as “a Todo was created” |
| Warning | `LogWarning` | An unusual situation that does not stop the application, such as “the requested resource was not found” |
| Error | `LogError` | The current operation failed, for example because of an unhandled exception |
| Critical | `LogCritical` | The application as a whole is at risk of failing, for example because the disk is full |

This example logs creation at Information, lookups at Debug, and missing items at Warning so that we can compare the output. A missing resource may not deserve a warning in a typical application; you can choose a lower level. Production systems often need Information logs to observe business activity, so it is not always necessary to keep only Warning and above.

## Control output by category

`Logging:LogLevel` in `appsettings.json` sets the **minimum level** for each category. Logs below that level are discarded:

| Key | Value | Meaning |
| --- | --- | --- |
| `Default` | `Information` | For categories without a specific setting, output Information and above |
| `Microsoft.AspNetCore` | `Warning` | Output only Warning and above for framework logs, avoiding excessive noise |
| `InMemoryTodoStore` | `Debug` | Added to the development configuration in this chapter so the store outputs Debug logs |

Categories are matched by prefix. When more than one prefix matches, the more specific one takes precedence. `Microsoft.AspNetCore` can set a default level for categories such as Routing beneath it, with a more specific category overriding that value.

That is why Debug logs appear only in the development environment. When running with the production environment (which does not load `appsettings.Development.json`), the same three requests produce only:

```text
info: InMemoryTodoStore[0]
      Created Todo 1 with title: Buy milk
warn: Program[0]
      Todo 99 not found
```

To investigate a problem, you can override the level with an environment variable before starting the application, without changing code. For example, `Logging__LogLevel__Default=Debug` changes the default rule but does not override a more specific category rule. Restart the process after changing an environment variable so the new value is read.

## Message templates

<<< @/../samples/14-logging/Program.cs{24,71 cs:line-numbers} [14-logging/Program.cs]

Notice the log message format: `"Todo {TodoId} not found"`, followed by the `id` argument. This is **not** string interpolation (there is no `$` prefix). It is a **message template**: the braces contain a **placeholder name**, and the argument values fill the placeholders in order.

Ordinary console output does not show whether the fields were preserved. Stop the current service, start it with JSON formatting, and inspect the same log:

```bash
dotnet run -- --Logging:Console:FormatterName=json --Logging:Console:FormatterOptions:JsonWriterOptions:Indented=true
```

After requesting `/todos/99`, the Warning log looks like this:

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

`State.TodoId` is the number `99`, which a logging platform can search as a field. If we first build a string with `$"Todo {id} not found"`, the logging system receives only the complete sentence; it would need to parse the sentence to extract the identifier.

::: warning Note
Pass `id` as a separate argument to the logging method so the `TodoId` field is preserved. String interpolation builds the text in advance, even if that log is ultimately filtered out.
:::

::: tip Tip
Use PascalCase for placeholder names and keep them consistent across the application. For example, use `{TodoId}` for every Todo identifier so logging tools can search all related entries under one field name.
:::

::: fastapi FastAPI comparison
Python's `logging` module also supports deferred formatting with `logger.warning("Todo %s not found", id)`, but does not preserve structured fields by default. ASP.NET Core's `ILogger` is structured from the start and needs no additional library.
:::

::: info Technical detail
For very frequent log calls, the `[LoggerMessage]` attribute and source generator can generate high-performance logging methods at compile time, further avoiding boxing and template parsing costs. For a tutorial of this size, calling methods such as `LogInformation` directly is sufficient.
:::

## Summary

- Get `ILogger<T>` through dependency injection. `T` determines the log **category**, and the framework registers the logging service for you.
- The six **levels** run from Trace to Critical and cover detailed tracing, debugging, normal events, and errors of increasing severity.
- `Logging:LogLevel` sets the minimum output level by category and matches prefixes. Configuration files for different environments let development output be more detailed and production output more concise.
- Use **message templates** (`"… {TodoId}", id`) instead of string interpolation so placeholders become searchable structured fields.

This is the final chapter in the “Application Structure” stage. Next: [EF Core Basics](./efcore-basics)—replace in-memory storage with a SQLite database so data survives a restart. Previous: [Middleware](./middleware).
