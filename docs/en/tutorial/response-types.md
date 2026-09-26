---
title: Response Types
description: 'Return status-code-specific results with TypedResults, constrain handler results with Results<T1, T2>, and provide response metadata to OpenAPI.'
---

# Response Types

In previous chapters, Todo handlers returned objects directly, and the framework serialized them as JSON with `200 OK`. Real APIs need to express more outcomes: `404` when a resource isn’t found, `201` when creation succeeds, and `204` when deletion succeeds.

The new concept in this section: **use the return type to constrain which results a handler can return deliberately.**

<<< @/../samples/08-response-types/Program.cs{1,19-33 cs:line-numbers} [08-response-types/Program.cs]

To focus on responses, this section’s `CreateTodo` has only a `Title` and no validation rules.

## Run and verify

```bash
dotnet run
```

Query an existing Todo and get `200`:

```bash
curl -i http://localhost:5080/todos/1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Buy milk","done":false}
```

Query one that doesn’t exist and get `404`:

```bash
curl -i http://localhost:5080/todos/99
```

```http
HTTP/1.1 404 Not Found
Content-Length: 0
```

Create a new one and get `201 Created`, with the new resource’s address in the `Location` header:

```bash
curl -i -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Write report"}'
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /todos/2

{"id":2,"title":"Write report","done":false}
```

Delete one and get `204 No Content` (no response body). Delete it again, and it no longer exists, so the response is `404`:

```bash
curl -i -X DELETE http://localhost:5080/todos/1
curl -i -X DELETE http://localhost:5080/todos/1
```

```http
HTTP/1.1 204 No Content

HTTP/1.1 404 Not Found
Content-Length: 0
```

## TypedResults: return values with status codes

<<< @/../samples/08-response-types/Program.cs{25-30 cs:line-numbers} [08-response-types/Program.cs]

On line 29, the handler no longer returns `todo` itself; it returns `TypedResults.Created(...)`. `TypedResults` provides methods for different HTTP responses:

| Method | Status code | Return type |
| --- | --- | --- |
| `TypedResults.Ok(value)` | 200 | `Ok<T>` |
| `TypedResults.Created(uri, value)` | 201 | `Created<T>` |
| `TypedResults.NoContent()` | 204 | `NoContent` |
| `TypedResults.BadRequest()` | 400 | `BadRequest` |
| `TypedResults.NotFound()` | 404 | `NotFound` |
| `TypedResults.Conflict()` | 409 | `Conflict` |

Each method returns a **specific type** defined in the `Microsoft.AspNetCore.Http.HttpResults` namespace imported on line 1. The type `Created<Todo>` itself tells you “the status code is 201, and the response body is a `Todo`.”

On line 25, the lambda has `Created<Todo>` before its parameter list. This is the lambda’s **explicit return type**. It can be omitted when an endpoint has only one result type, but writing it makes the response obvious to readers.

::: tip
The first argument to `Created` is the new resource’s address. The framework puts it in the `Location` response header, following the HTTP convention that clients can use this address to access the resource they created.
:::

## Results<T1, T2>: list the handler’s possible results

<<< @/../samples/08-response-types/Program.cs{19-23 cs:line-numbers} [08-response-types/Program.cs]

A request for one Todo has two possible results: it was found (`Ok<Todo>`) or it wasn’t (`NotFound`). These two types are unrelated, so how can one method return both?

The answer is line 19’s `Results<Ok<Todo>, NotFound>`. This is a **union type**: the value can be `Ok<Todo>` or `NotFound`, but nothing else. You can list up to six result types in its generic arguments.

Line 22 uses a conditional expression to choose between them. `TypedResults.NotFound()` and `TypedResults.Ok(todo)` have different types, but each converts implicitly to `Results<Ok<Todo>, NotFound>`, so the code compiles.

### The compiler enforces the contract

The union type is a **contract**: this handler can return only these two results. If someone later adds `return TypedResults.BadRequest();`, compilation fails:

```text
Program.cs(22,24): error CS0029: Cannot implicitly convert type 'Microsoft.AspNetCore.Http.HttpResults.BadRequest' to 'Microsoft.AspNetCore.Http.HttpResults.Results<Microsoft.AspNetCore.Http.HttpResults.Ok<Todo>, Microsoft.AspNetCore.Http.HttpResults.NotFound>'”
```

To make the handler return `BadRequest` deliberately, add it to the return type. The compiler checks that the handler’s return value matches its declaration.

::: warning
This contract does not cover the entire request-handling process: parameter binding, validation, middleware, and exception handling can produce other responses. For example, this chapter’s POST handler declares `Created<Todo>` as its return type, but the framework returns 400 before calling it if the JSON is malformed.
:::

### Documentation stays in sync

Open `/openapi/v1.json`. In this example, the handlers’ return types provide the following response information:

| Endpoint | Responses in the documentation |
| --- | --- |
| `GET /todos/{id}` | `200` (body is `Todo`), `404` |
| `POST /todos` | `201` (body is `Todo`) |
| `DELETE /todos/{id}` | `204`, `404` |

All this information comes from the return types; no extra annotations were needed. The `/scalar` page lists these responses under each endpoint. They are not every possible framework response. If you need to make an explicit promise to callers about another response, add documentation for it. The next chapter shows an example with 409.

## Why not use Results?

You may see another style in other material: `Results.Ok(todo)`, `Results.NotFound()` (note `Results`, not `TypedResults`). Their runtime behavior is identical; the difference is the return type. The `Results` methods all return the same interface, `IResult`.

Try an experiment: remove the line 19 return type `Results<Ok<Todo>, NotFound>` and replace both `TypedResults` calls on line 22 with `Results`. The program still runs, but the `GET /todos/{id}` response in the OpenAPI document is reduced to:

```json
"responses": {
  "200": {
    "description": "OK"
  }
}
```

The `404` is gone, as is the response-body schema for `200`. `IResult` says only “some kind of result will be returned”; neither the framework nor the compiler can tell which specific results. That’s why this tutorial consistently uses `TypedResults`: **more specific type information lets the compiler check more and makes the documentation more accurate.**

::: info Technical detail
`IResult` is an interface implemented by all result types. It has one method: write itself to an HTTP response. In addition to implementing `IResult`, types such as `Ok<T>` and `NotFound` implement a metadata interface for OpenAPI that declares their status codes and response-body types. At startup, the framework reads this information from the return type and generates the documentation.
:::

::: fastapi FastAPI comparison
FastAPI’s `response_model` handles runtime response validation, field filtering, and documentation generation; `responses` adds descriptions for other responses. `TypedResults` and `Results<...>` use C# return types to constrain handler results and provide response metadata. They are not the equivalent of Pydantic’s runtime response validation.
:::

## Summary

- `TypedResults` methods such as `Ok`, `Created`, `NoContent`, and `NotFound` return **specific types** that include a status code, such as `Created<Todo>`.
- When a handler has multiple possible results, list them in `Results<T1, T2, ...>`. Deliberately returning an unlisted type causes a **compile error**.
- Specific result types provide OpenAPI response metadata. Add documentation where needed for other responses caused by binding, validation, middleware, or status codes that can’t be inferred from the type.
- `Results.Xxx()` returns the general `IResult` interface and loses type information, so prefer `TypedResults`.

Next: [Status Codes and Error Handling](./errors)—use a consistent format for common errors. Previous: [Headers and Cookies](./headers-cookies).
