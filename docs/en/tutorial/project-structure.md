---
title: Organizing a project by feature
description: Organize the Todo API feature-first, keeping each feature's entities, DTOs, services, and endpoints together, and use tests to confirm the refactor preserves API behavior.
---

# Organizing a project by feature

`Program.cs` now contains startup configuration, authentication, and the entire CRUD API. When you change a Todo feature, you have to search through unrelated code. This chapter splits the project by feature, also called **feature-first organization**: keep a feature's entities, DTOs, services, and endpoints in the same directory.

This is a **refactor**: endpoint paths, request fields, response content, and permissions stay the same. Here is the new entry-point file:

<<< @/../samples/22-project-structure/Program.cs{3-5,14-15,35-37 cs:line-numbers} [Program.cs]

The other complete files are grouped by feature below. The example runs independently and does not reference the previous chapter's project.

:::: details Complete Todo feature files
::: code-group

<<< @/../samples/22-project-structure/Features/Todos/TodoEndpoints.cs{7-14 cs:line-numbers} [Features/Todos/TodoEndpoints.cs]

<<< @/../samples/22-project-structure/Features/Todos/TodoService.cs{7-14,17-24 cs:line-numbers} [Features/Todos/TodoService.cs]

<<< @/../samples/22-project-structure/Features/Todos/TodoDtos.cs{cs:line-numbers} [Features/Todos/TodoDtos.cs]

<<< @/../samples/22-project-structure/Features/Todos/Todo.cs{cs:line-numbers} [Features/Todos/Todo.cs]

:::
::::

:::: details Complete authentication and database files
::: code-group

<<< @/../samples/22-project-structure/Features/Auth/AuthConfiguration.cs{cs:line-numbers} [Features/Auth/AuthConfiguration.cs]

<<< @/../samples/22-project-structure/Features/Auth/AuthEndpoints.cs{cs:line-numbers} [Features/Auth/AuthEndpoints.cs]

<<< @/../samples/22-project-structure/Data/TodoDbContext.cs{cs:line-numbers} [Data/TodoDbContext.cs]

<<< @/../samples/22-project-structure/Data/TodoDatabase.cs{cs:line-numbers} [Data/TodoDatabase.cs]

:::
::::

## Run the tests before starting the app

Run from the repository root:

```bash
cd samples/22-project-structure
dotnet test --project Tests/TodoApi.Tests.csproj
```

You should still see **11 passed, 0 failed, 0 skipped**. The tests and assertions are the same as in Chapter 21; because the types have moved into a namespace, the test project only adds an import:

<<< @/../samples/22-project-structure/Tests/GlobalUsings.cs{cs:line-numbers} [Tests/GlobalUsings.cs]

For a manual run, first stop services from other chapters, then create a development token for this chapter:

```bash
dotnet user-jwts create --name alice --role editor --valid-for 1h --output token
dotnet run
```

In another terminal, store the full token in the `TOKEN` variable as described in [Chapter 18](./authentication), then make a request:

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5080/todos
```

On the first run, this chapter's separate `todos-22.db` contains no tasks, so the response is `[]`. The create, update, and delete commands from Chapters 17–20 still apply.

## Find the feature, then its files

The main code is organized as follows; configuration and test files are also part of this chapter's project:

```text
22-project-structure/
├── Program.cs
├── Features/
│   ├── Todos/
│   │   ├── Todo.cs
│   │   ├── TodoDtos.cs
│   │   ├── TodoService.cs
│   │   └── TodoEndpoints.cs
│   └── Auth/
│       ├── AuthConfiguration.cs
│       └── AuthEndpoints.cs
├── Data/
│   ├── TodoDbContext.cs
│   └── TodoDatabase.cs
└── Tests/
```

For example, to add an editable field to Todo, start in `Features/Todos` to find the stored properties, input and output types, and handling logic. Do not start by looking for the entity in a global Models folder, then the service in Services, and finally the route in Endpoints.

This organization follows [mini-store-api](https://github.com/wildcatDownstairs/mini-store-api): entities, DTOs, services, and endpoints belong to their feature, while the shared context stays in Data. The categories here have only two fixed values and belong to the Todo feature, so they do not need a separate Categories module yet.

## What belongs in each file?

| File | Contents | Example change |
| --- | --- | --- |
| `Todo.cs` | Todo and Category entities | Add a property to store in the database |
| `TodoDtos.cs` | Request, response, and feature operation result types | Change which fields clients can submit |
| `TodoService.cs` | Queries, category-existence checks, and save operations | Change a business rule for tasks |
| `TodoEndpoints.cs` | Routes, permissions, parameter binding, and HTTP results | Change a path or write permission |
| `TodoDbContext.cs` | Shared table access and database mappings | Configure an entity relationship |
| `Program.cs` | Register services, arrange middleware, and mount features | Add a new feature entry point |

`TodoService` does not accept `HttpContext` or decide whether to return 400 or 404. For example, the replacement operation returns `ReplaceOutcome`, which the endpoint maps to an HTTP result. The **enum** simply names the three outcomes “updated,” “task not found,” and “category not found,” rather than making you guess what a number means.

Request-field validation still happens through the built-in validation on the endpoint; the service still queries the database to check whether a category exists. Moving files has not changed the responsibility of either check.

## How MapTodoEndpoints connects back to Program

`TodoEndpoints` is a static class. Its `MapTodoEndpoints` method takes `this WebApplication app` as its first parameter. This is an **extension method**, so the entry point can call `app.MapTodoEndpoints()` while the implementation still uses familiar methods such as `MapGroup`, `MapGet`, and `MapPost`.

You can pass a handler method directly to methods such as `MapGet` instead of writing every handler as a long lambda. `GetAsync` on line 11 is a method in this file. See [Minimal API route handlers](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis/route-handlers?view=aspnetcore-10.0).

`namespace TodoApi.Features.Todos;` declares a **namespace** that identifies where a type belongs. The entry point uses `using TodoApi.Features.Todos` to access these types and extension methods. Keeping directories and namespaces aligned makes code easier to find, though C# does not require them to match.

::: info Technical detail
C# 14 also supports extension member blocks. This chapter keeps the supported extension-method syntax with a `this` parameter; only one method is needed here, so there is no reason to introduce another syntax structure.
:::

## Why keep the shared DbContext in Data?

Entities belong to a feature, but a request may change data in several features at once. A shared context gives those operations a chance to complete in one save or transaction. Organizing directories by feature does not require one database per directory.

`TodoService` is registered as Scoped, matching the context's default lifetime. This project has only one implementation, so inject the concrete class directly; this chapter does not add an `ITodoService` or Repository just for it.

There is no need to create an empty Common directory first. If code really becomes shared by several features, decide then whether it belongs in its own place. CORS configuration stays in the entry point because it applies to the whole API.

## When is splitting worthwhile?

This Todo API also works with DbContext used directly in its endpoints. The Service is extracted here to demonstrate the organization in mini-store-api, where “the endpoint chooses the HTTP response and the service performs the business operation.” This is not a Minimal API requirement.

If a new feature has only two simple queries, start with its endpoints and related types in a feature directory. Extract operations into a Service when business rules grow or need to be reused. Directories should make code easier to find; every feature does not need the same number of files.

::: fastapi FastAPI comparison
This is similar to organizing routers, schemas, and business functions by domain, then registering the routers at the application entry point. In ASP.NET Core, extension methods mount endpoints and dependency injection supplies services.
:::

## Summary

- Feature-first organization keeps a feature's entities, DTOs, service, and endpoints together.
- Endpoints handle HTTP and permissions; services handle data and business rules; the shared context stays in Data.
- Extension methods connect feature routes to the entry point, while Program.cs keeps startup configuration and middleware order.
- Do not add empty files to satisfy a folder convention or add an interface layer for a single implementation by default.
- Verify the refactor with the same requests and assertions from the previous chapter to preserve API behavior.

Next: [Publishing and deployment](./deployment)—publish the organized application. Previous: [Testing](./testing).
