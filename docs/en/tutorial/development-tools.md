---
title: Development tools practice
description: Practice diagnosing compiler errors and using dotnet watch Hot Reload with the complete example from Chapter 02.
prev: false
next: false
---

# Development tools practice

This optional appendix uses the same project to practice the edit, compile, and rerun cycle after you complete [First steps](./first-steps). Skipping it will not affect the later chapters.

The complete code used in this practice is below. Run the commands on this page from the `FirstSteps` project directory you created in Chapter 02. If you are using the repository example, go to `samples/02-first-steps`.

<<< @/../samples/02-first-steps/Program.cs{15 cs:line-numbers} [02-first-steps/Program.cs]

## Let the compiler check your code

C# is a statically typed language, so many errors are found before the program runs. Deliberately change `MapGet` on line 15 to `MapGt`; the editor will underline it in red right away. Running `dotnet build` will show:

```text
Program.cs(15,5): error CS1061: 'WebApplication' does not contain a definition for 'MapGt' and no accessible extension method 'MapGt' accepting a first argument of type 'WebApplication' could be found (are you missing a using directive or an assembly reference?)
```

The error tells you that `WebApplication` has no member named `MapGt` at line 15, column 5. The program never starts, so it cannot wait until a request arrives before crashing.

After the experiment, change `MapGt` back to `MapGet`, confirm `dotnet build` succeeds, then continue below. The diagnostic language depends on the SDK language setting.

Likewise, type `Map` after `app.` and the editor will list the available methods (`MapGet`, `MapPost`, `MapGroup`, and more) and show their parameter descriptions. Type information helps the editor complete your code and provides response shapes for OpenAPI, reducing duplicated maintenance.

## Use dotnet watch for automatic reloads

If the service you started earlier is still running, press `Ctrl+C` in its terminal to stop it. Then, from the same project directory, run:

```bash
dotnet watch
```

It runs the project and watches for file changes. After it starts, change the text on line 15 to `"Hello, Hot Reload!"` and save. The terminal will show:

```text
dotnet watch ⌚ File updated: .\Program.cs
dotnet watch 🔥 C# and Razor changes applied in 1029ms.
```

Make another request and the response will have changed, while the service **has not restarted**:

```bash
curl http://localhost:5080/
```

```json
{"message":"Hello, Hot Reload!"}
```

This is called **Hot Reload**: supported changes are applied directly to the running program. The elapsed time in the log varies by machine. Changes that cannot be applied live may prompt a restart. After changing service registrations or other startup configuration, press `Ctrl+R` in the `dotnet watch` terminal to restart and run the startup code again.

When you are done, change the greeting back to `"Hello, ASP.NET Core!"`, then press `Ctrl+C` to stop the service so it does not affect the output or ports used in later chapters.

::: fastapi FastAPI comparison
`dotnet watch` is similar to `fastapi dev` or `uvicorn --reload`. For changes that support Hot Reload, .NET can preserve the process and its in-memory state; a restart loses that state.
:::

## Summary

- Compiler errors identify the file and location. After fixing an error, use `dotnet build` to confirm the project builds.
- `dotnet watch` monitors code changes and applies supported changes without restarting the process.
- After changing startup configuration, restart with `Ctrl+R`; a restart loses in-memory state.

Back to [First steps](./first-steps). Continue with [Route parameters](./path-params).
