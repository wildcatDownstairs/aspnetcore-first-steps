---
title: Request Body
description: 'Describe a request body with a record and let the framework deserialize JSON into a strongly typed object; understand why input models and data models should be separate.'
---

# Request Body

Route and query parameters work well for a few simple values. To **create** a Todo item, the client needs to send a larger structured value. That’s when we use a **request body**: the content in the body of an HTTP request, usually JSON in a Web API.

The new concept in this section: **declare the shape of the request body with a record, and the framework automatically converts JSON into an object of that type.**

<<< @/../samples/05-request-body/Program.cs{20-25,29 cs:line-numbers} [05-request-body/Program.cs]

Starting with this chapter, we’ll build up a Todo API a little at a time. By [Full CRUD](./crud), it will be a complete application connected to a database.

## Run and verify

```bash
dotnet run
```

Send a JSON request body with the `POST` method:

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","priority":2}'
```

- `-X POST`: use the POST method.
- `-H "Content-Type: application/json"`: tell the server the request body is JSON.
- `-d '...'`: the request body content.

Expected response:

```json
{"id":1,"title":"Buy milk","priority":2,"done":false}
```

List the items to see the one you just created:

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Buy milk","priority":2,"done":false}]
```

::: tip
Windows PowerShell handles quotes and backslash line continuations differently from bash, so the multiline command above may not run as-is. The easiest option is to open `/scalar`, find `POST /todos`, enter JSON in the request body editor, and send it. Scalar generates a request-body template from the OpenAPI document.
:::

## Declare the shape of the request body

<<< @/../samples/05-request-body/Program.cs{20,29 cs:line-numbers} [05-request-body/Program.cs]

Line 29 uses a record to describe what must be provided when creating a Todo: a string `Title` and an integer `Priority`. The handler parameter on line 20 has type `CreateTodo`.

This is a POST endpoint. `CreateTodo` is a **complex type** (not a simple value such as `int` or `string`) that is neither registered as a service nor custom-bound, so the framework infers that it comes from the request body. That is the third rule in the parameter-source table in the previous chapter. The framework reads the request body and deserializes it into a `CreateTodo` object using **System.Text.Json**, .NET’s built-in JSON library.

When the handler runs, `input` is already a complete, strongly typed object: `input.Title` is a `string`, and `input.Priority` is an `int`. The editor can complete these properties, and a misspelled property name fails at compile time.

::: tip
JSON property matching is **case-insensitive**. `{"TITLE":"Case test","Priority":1}` binds correctly too. Response property names are consistently camelCase, as mentioned in [First Steps](./first-steps).
:::

::: fastapi FastAPI comparison
This is like using a Pydantic model as the parameter type in FastAPI: `def create(todo: CreateTodo)`. The difference is that a record describes only the shape of the data and does not validate it by default. We’ll see the consequence next.
:::

## Why define CreateTodo separately?

<<< @/../samples/05-request-body/Program.cs{22,29,31 cs:line-numbers} [05-request-body/Program.cs]

The file has two records: line 29’s `CreateTodo` is the **input model**, describing what the client may submit; line 31’s `Todo` is the **data model**, describing what the system stores. Why not use `Todo` as the parameter type directly?

Because `Todo` has `Id` and `Done`, values the client shouldn’t control: the server assigns `Id`, and a new Todo is always unfinished. If you accepted `Todo` directly, the client could choose its own `id` and `done` values.

By receiving input as `CreateTodo`, the client **cannot set** those two fields. Try sending a few extra properties:

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Extra","priority":1,"id":999,"done":true}'
```

```json
{"id":2,"title":"Extra","priority":1,"done":false}
```

`id` and `done` are ignored because `CreateTodo` has no corresponding properties. The server chooses their values on line 22. Separating input from stored data helps prevent a security issue known as **over-posting**.

::: warning
This chapter stores data in an in-memory `List`, so it disappears when the program restarts. Also, neither `List` nor `nextId++` is **thread-safe**, so concurrent writes may fail. This keeps the example simple; [EF Core Basics](./efcore-basics) replaces it with a real database.
:::

## When the request body is invalid

### Invalid format

If the JSON syntax is invalid or a value has the wrong type, the framework returns 400 directly and never runs the handler:

```bash
curl -i -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"x","priority":"high"}'
```

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Failed to read parameter "CreateTodo input" from the request body as JSON.
 ---> System.Text.Json.JsonException: The JSON value could not be converted to CreateTodo. Path: $.priority | LineNumber: 0 | BytePositionInLine: 30.
```

The error identifies the problem at `$.priority`, because `"high"` cannot be converted to an `int`.

### Missing Content-Type

This tutorial uses `Content-Type: application/json` to declare a JSON request body. The framework also accepts media types such as `application/*+json`. If a request has a body but no supported JSON media type, the response is `415 Unsupported Media Type`:

```http
HTTP/1.1 415 Unsupported Media Type
Content-Length: 0
```

The framework parses a request body as JSON only when the request declares a JSON media type. This is a common pitfall: a perfectly valid JSON body fails because the header is missing.

### Missing fields

Pay close attention to this case:

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"priority":3}'
```

```json
{"id":3,"title":null,"priority":3,"done":false}
```

The request succeeded, but `title` is `null` even though `Title` in `CreateTodo` is a non-nullable `string`. Sending an empty object `{}` is even more surprising: the result has `title` set to `null` and `priority` set to `0`.

As [C# Tour](./csharp-tour) explained, nullable reference types are **compile-time** checks. JSON deserialization happens at runtime: a missing string property is set to `null`, and a missing number is set to `0`, without an error.

**Deserialization checks only that the “format is valid”; it doesn’t guarantee that the “content makes sense.”** Rules such as “title must not be empty” and “priority must be between 1 and 5” need separate checks. That’s the subject of the next chapter.

::: info Technical detail
System.Text.Json has options such as `RespectNullableAnnotations` that can make deserialization fail when it encounters `null`. But that only checks “is it null?” and can’t express rules like “length must not exceed 50.” The validation mechanism in the next chapter handles these cases consistently and returns structured errors.
:::

## Summary

- In this chapter’s POST endpoint, a regular **complex type** parameter such as `CreateTodo` is read from the **request body** as JSON by default. This inference doesn’t apply to methods such as GET or to types registered as services.
- For a JSON request body, provide a supported `Content-Type`; this tutorial uses `application/json`. An unsupported media type returns 415; invalid JSON or a type mismatch returns 400.
- Receive request data in a separate **input model** (`CreateTodo`) from the **data model** (`Todo`). Client input cannot change server-controlled fields such as `Id`.
- Deserialization does not check business rules: missing fields become `null` or `0` and need separate validation.

Next: [Validation](./validation)—have the framework reject invalid input before the handler runs. Previous: [Query Parameters](./query-params).
