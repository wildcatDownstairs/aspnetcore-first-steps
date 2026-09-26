---
title: EF Core Basics
description: Replace the in-memory list with an EF Core and SQLite database. Understand DbContext, entities, and SaveChangesAsync, then verify that data persists across restarts.
---

# EF Core Basics

Earlier, Todos were stored in memory and disappeared whenever the service restarted. In this chapter, we use a SQLite database for storage and **Entity Framework Core (EF Core)** to read and write data as C# objects, generating SQL for us. Tools like this are called **object-relational mappers (ORMs)**.

The handlers below receive a database context directly instead of using `ITodoStore`; input validation and error handling follow the earlier examples. The complete code is split across three files:

<<< @/../samples/15-efcore-basics/Program.cs{2,10-12,25-30,32-46 cs:line-numbers} [15-efcore-basics/Program.cs]

<<< @/../samples/15-efcore-basics/Models.cs{3-8 cs:line-numbers} [15-efcore-basics/Models.cs]

<<< @/../samples/15-efcore-basics/TodoDbContext.cs{3-6 cs:line-numbers} [15-efcore-basics/TodoDbContext.cs]

## Run and verify

Open a terminal at the repository root:

```bash
cd samples/15-efcore-basics
dotnet run
```

The project file declares the SQLite provider. `dotnet run` restores dependencies first, so there is no need to install a separate SQLite service:

<<< @/../samples/15-efcore-basics/EfCoreBasics.csproj{9 xml:line-numbers} [15-efcore-basics/EfCoreBasics.csproj]

The database location comes from the configuration file:

<<< @/../samples/15-efcore-basics/appsettings.json{2-4 json:line-numbers} [15-efcore-basics/appsettings.json]

On first startup, the application creates `todos-15.db` in the project directory. The output below assumes a new database. Open another terminal and query first, then create a Todo:

```bash
curl http://localhost:5080/todos
```

```json
[]
```

```bash
curl -i -X POST http://localhost:5080/todos -H "Content-Type: application/json" -d '{"title":"Buy milk"}'
```

Response excerpt (common headers such as dates are omitted):

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /todos/1

{"id":1,"title":"Buy milk","done":false}
```

Return to the service terminal, press `Ctrl+C`, and run `dotnet run` again. Then retrieve the Todo:

```bash
curl http://localhost:5080/todos/1
```

```json
{"id":1,"title":"Buy milk","done":false}
```

The Todo is still there after restart, which shows that the data was written to the SQLite file.

::: tip Tip
Each chapter uses its own database file. Repeating an exercise keeps existing data and identifiers. To use a new, empty database, stop the service and run `dotnet run -- --ConnectionStrings:Todos="Data Source=practice-15.db"`, choosing a filename that does not exist yet; there is no need to delete the old data.
:::

## Entity: a row in the database

`Todo` in `Models.cs` is an **entity** that corresponds to a row in a table. By convention, EF Core recognizes `Id` as the **primary key**. In this example, the database generates the integer key when a row is inserted, so we no longer need `_nextId`.

Why is the entity a `class` while the request is still a `record`? EF Core tracks specific entity instances and observes property changes during updates, so an ordinary mutable class fits that work. `CreateTodo` describes the fields a client may submit and remains a concise record. The client cannot use this request model to set `Id` or `Done`.

The `= ""` after `Title` is an initial property value that avoids an uninitialized non-null string when an object is created. `[Required]`, `[StringLength]`, and `AddValidation()` on `CreateTodo` still check whether the input is valid.

## Read and write data with DbContext

`TodoDbContext` inherits from **DbContext**, the database context. Its `DbSet<Todo>` is the entry point for querying and writing Todos; it is not a `List<Todo>` that loads the entire table into memory in advance.

`AddDbContext` registers the context with the dependency injection container as Scoped by default: the same instance is used within a web request, and the container disposes it when the request ends. `UseSqlite` selects the database provider, and the connection string specifies the file location.

::: warning Note
`DbContext` is not thread-safe. Do not register it as a Singleton or run multiple queries concurrently on the same instance. Await the current operation before starting the next one. [Official lifetime guidance](https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/)
:::

There is no request scope during startup, so line 26 creates a scope manually and gets a context to initialize the database. `using` disposes the scope and the services it contains when execution leaves the block.

## Querying and saving are separate actions

In `GET /todos`, `OrderBy` specifies the result order, and `ToListAsync()` is what executes the database query and retrieves the list. Without sorting, do not rely on the database to return rows in an order that happens to look consistent. `AsNoTracking()` means these read-only results do not need **change tracking**, which reduces the state the context must maintain.

`FindAsync(id)` looks up one Todo by primary key. If the current context is already tracking it, the method can return it directly; otherwise, it queries the database. If nothing is found, it returns `null` and the handler responds with 404.

The three POST steps are worth distinguishing:

1. `new Todo` creates a C# object, but does not write it to the database.
2. `db.Todos.Add(todo)` marks it for insertion.
3. `await db.SaveChangesAsync()` performs the insert. Only afterward does `todo.Id` contain the identifier generated by the database.

**Why does Add not save immediately?** The context can collect a group of changes and save them together. If you forget `SaveChangesAsync()`, the object exists in memory, but no row is added to the database.

`Task<Created<Todo>>` means that after the asynchronous method finishes, it returns a `Created<Todo>` result. The syntax for `async` / `await` is covered in [C# Tour](./csharp-tour).

::: info Technical detail
This example consistently uses EF Core's asynchronous methods. However, the underlying Microsoft.Data.Sqlite does not support asynchronous I/O, so these calls ultimately run synchronously. Other database providers may behave differently. [SQLite asynchronous limitations](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/async)
:::

## Creating tables does not upgrade the schema

`EnsureCreatedAsync()` is suitable for a standalone learning project: it creates the tables required by the model when the database has no tables, but does not upgrade the schema when tables already exist.

::: warning Note
After an entity changes, `EnsureCreatedAsync()` does not automatically add columns. Use **migrations** to upgrade an existing database; migrations and `EnsureCreated` cannot be used together directly. Each chapter in this tutorial uses a separate file. To keep and upgrade existing data, see [EF Core migrations](/en/advanced/efcore-migrations).
:::

::: fastapi FastAPI comparison
EF Core has a role similar to SQLAlchemy. `DbContext` can be compared to a Session within a unit of work, and `SaveChangesAsync()` writes tracked changes. Their APIs and transaction details are not identical.
:::

::: tip Tip
For a SQL-oriented view of queries and saving, see [EF Core / LINQ ↔ PostgreSQL cheat sheet](/en/efcore-sql-cheatsheet#execution), which includes runnable comparisons.
:::

## Summary

- EF Core maps entity objects to a database. SQLite stores data in a file, so it remains available after the service restarts.
- `AddDbContext` registers a Scoped context by default. The same context cannot be used concurrently.
- Queries access the database at execution methods such as `ToListAsync()`; read-only queries can use `AsNoTracking()`.
- `Add` marks an entity for insertion. `SaveChangesAsync()` performs the save, and the database generates the primary key.
- `EnsureCreatedAsync()` is for this tutorial's standalone examples only; it does not upgrade an existing table schema.

Next: [Relations and Queries](./relations-queries)—add categories to Todos and let the database filter results. Previous: [Logging](./logging).
