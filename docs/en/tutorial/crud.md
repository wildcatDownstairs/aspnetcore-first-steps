---
title: Complete CRUD
description: Combine the existing queries, validation, and response types with EF Core change tracking to create, read, update, and delete Todos.
---

# Complete CRUD

The previous two chapters added Todo creation and querying. This chapter adds updates and deletion: first load an entity, then modify it or mark it for deletion, and finally call `SaveChangesAsync()` to save.

**CRUD** stands for Create, Read, Update, and Delete. Validation, route groups, and error handling follow the earlier examples. To focus on writes, this chapter's list returns all Todos without filtering or pagination. The categories Work (1) and Life (2) are preloaded, and there are no category create or delete endpoints yet.

<<< @/../samples/17-crud/Program.cs{50-85 cs:line-numbers} [17-crud/Program.cs]

<<< @/../samples/17-crud/Models.cs{19-28 cs:line-numbers} [17-crud/Models.cs]

<<< @/../samples/17-crud/TodoDbContext.cs{cs:line-numbers} [17-crud/TodoDbContext.cs]

## Run and verify

Stop the previous chapter's service, then run this from the repository root:

```bash
cd samples/17-crud
dotnet run
```

This chapter uses `todos-17.db`. On the first run, the Todo table is empty. Perform these operations in order; only the key response headers are shown, and the ID may differ if the database already has data.

Create a Todo:

```bash
curl -i -X POST http://localhost:5080/todos -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

```http
HTTP/1.1 201 Created
Location: /todos/1
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Write report","done":false,"categoryId":1}
```

Mark it complete and move it to the Life category:

```bash
curl -i -X PUT http://localhost:5080/todos/1 -H "Content-Type: application/json" -d '{"title":"Write report","done":true,"categoryId":2}'
```

```http
HTTP/1.1 204 No Content
```

A 204 response has no body. Retrieve it again to see the saved content:

```bash
curl http://localhost:5080/todos/1
```

```json
{"id":1,"title":"Write report","done":true,"categoryId":2}
```

Delete it, then query it again:

```bash
curl -i -X DELETE http://localhost:5080/todos/1
curl -i http://localhost:5080/todos/1
```

The first response is 204; the second is 404, with this body. The `traceId` differs each time:

```json
{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"request-trace-id"}
```

## Which fields can a request change?

`CreateTodo` accepts only `Title` and `CategoryId`; `ReplaceTodo` also accepts `Done`. `Id` always comes from the route or database, never from the request body.

**Why not use `Todo` directly as the request type?** If the entity gains internal fields in the future, accepting the whole entity could allow clients to change those fields too. A separate request type makes the allowed fields explicit.

`[Required]`, `[StringLength]`, and `[Range]` on the inputs use the mechanism from Chapter 06. The input record remains `public` so the .NET 10 validation generator can process it.

Here, PUT means replacing the complete client-editable state, so send all three fields: `title`, `done`, and `categoryId`. It does not mean “update only the fields that appear in the JSON.” For example, if `done` is omitted, deserialization supplies `false`, replacing the current completion state with `false`.

## Load, modify, then save

The PUT steps are:

1. `FindAsync(id)` loads the entity. If it does not exist, return 404.
2. Check whether the target category exists. If not, return a 400 with an explanation.
3. Modify the properties of the tracked entity.
4. `SaveChangesAsync()` detects the changes and writes them to the database.

There is no need to call `Update(todo)` because the entity returned by `FindAsync` is already tracked by the current context. `AsNoTracking()` is for read-only list queries; if you retrieve an untracked object and only change its properties, saving will not automatically write those changes back. [Basic save operations](https://learn.microsoft.com/en-us/ef/core/saving/basic)

Deletion works the same way: `Remove(todo)` marks the entity for deletion, and `SaveChangesAsync()` actually deletes the database row. Querying that ID afterward returns 404.

## A valid ID does not prove the category exists

`[Range(1, int.MaxValue)]` can check that an ID is positive, but it cannot prove that category 99 exists. Checking whether a category exists requires a database query, so that check belongs in the handler:

```bash
curl -i -X POST http://localhost:5080/todos -H "Content-Type: application/json" -d '{"title":"Invalid","categoryId":99}'
```

The response is 400, with this body:

```json
{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"Category not found","status":400,"traceId":"request-trace-id"}
```

The check lets us return a clear “category does not exist” message. The database foreign key constraint still prevents an invalid ID from being saved. This example cannot delete categories; if a delete endpoint is added later, it will also need to handle a category being deleted after the check but before the save.

`.ProducesProblem(400)` adds this kind of 400 response to the OpenAPI document. See [Chapter 09](./errors) for why.

## Repeated requests and concurrent updates

Repeating a PUT with the same content leads to the same final state. After repeated DELETE requests, the resource is still gone. This is called **idempotency**: it does not require the same status code on every request, so a 204 for the first DELETE and a 404 for the next one are consistent. POST may create a new resource each time.

This chapter does not check for concurrent updates yet. If two people read the same Todo and then make separate changes, the later save may overwrite the earlier one. The next chapter first limits who can call these endpoints.

::: fastapi FastAPI comparison
This is similar to loading a SQLAlchemy entity in a FastAPI handler, changing its properties, and then committing the Session. Separating DTOs from database entities also corresponds to giving Pydantic input/output models and ORM models distinct responsibilities.
:::

::: tip Tip
For a comparison with INSERT, UPDATE, and DELETE, see [EF Core / LINQ ↔ PostgreSQL cheat sheet](../efcore-sql-cheatsheet#writes), which includes runnable examples.
:::

## Summary

- CRUD combines create, read, update, and delete operations, each using appropriate HTTP methods and status codes.
- Request DTOs limit the fields clients can change, entities represent database records, and response DTOs define returned fields.
- A tracked entity can be changed directly; `SaveChangesAsync()` detects and saves its changes.
- `Remove` only marks an entity for deletion. The deletion takes effect on save; field validation cannot replace a database existence check.
- In this example, PUT replaces the complete editable state, and concurrent update conflicts are not handled yet.

Next: [Authentication (JWT)](./authentication)—first establish who is calling the API. Previous: [Relations and Queries](./relations-queries).
