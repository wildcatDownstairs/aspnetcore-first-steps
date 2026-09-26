---
title: Relations and Queries
description: Set up a one-to-many relationship between categories and Todos. Use LINQ to compose filters, sorting, pagination, and projections, and distinguish navigation properties from Include.
---

# Relations and Queries

Now we will add categories to Todos: does a task belong to Work or Life? In this chapter, we establish the relationship between categories and tasks, then use LINQ to query “unfinished tasks in Work.”

This chapter focuses on read-only queries and seeds a small, fixed dataset at startup. It does not yet include the POST endpoint from the previous chapter; the next chapter combines relationships with writes. Here are the three complete files:

<<< @/../samples/16-relations-queries/Program.cs{30-35,39-56 cs:line-numbers} [16-relations-queries/Program.cs]

<<< @/../samples/16-relations-queries/Models.cs{8-9,12-20 cs:line-numbers} [16-relations-queries/Models.cs]

<<< @/../samples/16-relations-queries/TodoDbContext.cs{6 cs:line-numbers} [16-relations-queries/TodoDbContext.cs]

## Run and verify

Stop the service from the previous chapter, then run this from the repository root:

```bash
cd samples/16-relations-queries
dotnet run
```

This chapter uses its own `todos-16.db` and the same dependencies as the previous chapter. On first startup, it inserts two categories, `Work` and `Life`, along with three Todos. Startup code inserts them only when the category table is empty, so restarting does not add duplicates.

Open another terminal and request the first page (two items per page):

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Write report","done":false,"category":"Work"},{"id":2,"title":"Review PR","done":true,"category":"Work"}]
```

Show only unfinished items in Work:

```bash
curl "http://localhost:5080/todos?categoryId=1&done=false"
```

```json
[{"id":1,"title":"Write report","done":false,"category":"Work"}]
```

Request the second page:

```bash
curl "http://localhost:5080/todos?page=2"
```

```json
[{"id":3,"title":"Buy milk","done":false,"category":"Life"}]
```

Request a category and its Todos:

```bash
curl http://localhost:5080/categories/1
```

```json
{"id":1,"name":"Work","todos":[{"id":1,"title":"Write report","done":false},{"id":2,"title":"Review PR","done":true}]}
```

## What foreign keys and navigation properties do

A **one-to-many relationship** means that a category can have many Todos, and each Todo belongs to one category:

| Member | Purpose |
| --- | --- |
| `Todo.CategoryId` | A **foreign key** that stores the primary key of the related category |
| `Todo.Category` | A **navigation property** to access the category object from a Todo |
| `Category.Todos` | A collection navigation property to access related Todos from a category |

EF Core recognizes the relationship from these names and types. `CategoryId` is a non-nullable `int`, which means each Todo in this example must point to a category. The database's foreign key constraint prevents it from referring to a category that does not exist. There is no category deletion endpoint yet, so cascade-delete rules are outside the scope of this section.

In `Category = null!`, `!` only suppresses the compiler's nullable warning; it does not load the category. If a query does not load it and we do not assign it manually, the property may still be `null`.

::: info Technical detail
When seeding data, we put Todos in the new category's `Todos` collection and save the whole group of objects. EF Core handles the order of related inserts and writes the generated category key to each Todo's foreign key; we do not have to guess the category's ID first. See [EF Core one-to-many relationships](https://learn.microsoft.com/en-us/ef/core/modeling/relationships/one-to-many) for conventions and required relationships.
:::

## Compose the query, then execute it

In `GET /todos`, `query` is an `IQueryable<Todo>` representing a query that has not run yet. Lines 42 and 43 append conditions based on query parameters. Line 45 adds sorting and pagination, and only then does `ToListAsync()` execute the query.

**Why not call `ToList` first and then `Where`?** Retrieving all the rows and filtering the list afterward would load the entire database table into application memory. This example composes a LINQ query first, so SQLite filters and sorts the data and returns only the current page.

`Math.Clamp(page, 1, 10000)` limits the page number to 1–10000: values below 1 are treated as 1, and values above 10000 as 10000. There are always two items per page, making the effects of `Skip` and `Take` easy to observe.

Sorting by the unique `Id` before pagination makes the order stable for a given dataset. However, if data is added or deleted while someone moves between pages, results may still repeat or be missed.

## Select: query only the fields you need

The `Select` on line 46 is called a **projection**: it selects `Id`, `Title`, `Done`, and the category name from the entity to form the response.

In this unexecuted query, EF Core translates `t.Category.Name` into SQL that accesses the related table. There is no need to `Include` the whole category object first. It does not issue a separate category query for each Todo.

**Why not return entities with both navigation properties directly?** A Todo points to a Category, and the Category contains Todos. Serializing both directly can cause a reference loop and ties the database model to the HTTP response. Projection makes the response fields explicit, so an added database property is not automatically exposed through the API.

## Include: load related objects when needed

`GET /categories/{id}` demonstrates a different need: retrieve a category and its Todo objects, then shape the response. `Include(c => c.Todos)` loads the related collection in the query; this is called **eager loading**. This example does not enable lazy loading.

`SingleOrDefaultAsync` executes the query and returns `null` if nothing matches. Here, we query by a unique primary key, so there can be at most one category. Before returning, we construct a `CategoryResponse`; its `TodoSummary` does not have a navigation property pointing back to the category.

Types designed specifically to receive or return data are called **DTOs** (Data Transfer Objects). The request record from earlier chapters is also a DTO. Adding a property to a database entity does not have to change the API's JSON fields.

::: tip Tip
To inspect the SQL, stop the service and run `dotnet run -- --Logging:LogLevel:Microsoft.EntityFrameworkCore.Database.Command=Information`, then send a query. Paging parameters vary with each request; focus on whether filtering happens in SQL and whether there are unnecessary queries. [Loading related data](https://learn.microsoft.com/en-us/ef/core/querying/related-data/eager)
:::

::: fastapi FastAPI comparison
This is similar to using SQLAlchemy relationship attributes to link objects, then using query expressions to filter and select columns. `Include` follows the idea of eager-loading a relationship; it does not mean that accessing any navigation property automatically runs a query.
:::

::: tip Tip
If you need a reminder of LINQ methods, see [EF Core / LINQ ↔ PostgreSQL cheat sheet](../efcore-sql-cheatsheet#queries), which includes runnable comparisons.
:::

## Summary

- A foreign key stores the related identifier, while navigation properties express the relationship between objects. Declaring a navigation property does not mean its object has been loaded.
- Compose conditions, sorting, and pagination on `IQueryable`, then execute the query with methods such as `ToListAsync()`.
- Use `Select` projection to choose response fields instead of serializing a bidirectional relationship directly.
- Project the category name directly when that is all you need; use `Include` when the related object is needed.
- Sort by a unique key before returning each page. This example limits page numbers to 1–10000.

Next: [Complete CRUD](./crud)—add Todo creation, updates, and deletion. Previous: [EF Core Basics](./efcore-basics).
