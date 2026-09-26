---
title: Status Codes and Error Handling
description: 'Express business errors with Problem Details and generate safe descriptions for eligible empty error responses and unhandled exceptions.'
---

# Status Codes and Error Handling

The `404` response in the previous chapter had no content, so the client knew only that “something went wrong,” not why. Error formats also varied across earlier chapters: binding failures were plain text, validation failures were JSON, and a missing route returned nothing.

The new concept in this section is **Problem Details**, a standard format for error responses. We’ll use it for business errors and to handle eligible empty error responses and unhandled exceptions consistently. First, use curl’s default request headers to verify JSON responses; then we’ll explain when this applies.

<<< @/../samples/09-errors/Program.cs{7,11-12,28-49 cs:line-numbers} [09-errors/Program.cs]

## Run and verify

```bash
dotnet run
```

Mark a Todo as done. The first request succeeds:

```bash
curl -X POST http://localhost:5080/todos/1/complete
```

```json
{"id":1,"title":"Buy milk","done":true}
```

Mark it done again and get `409 Conflict` with an explanatory error:

```bash
curl -i -X POST http://localhost:5080/todos/1/complete
```

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.10","title":"Todo is already completed","status":409,"detail":"Todo with id 1 is already complete and cannot be completed again.","traceId":"00-eb960df5537d54d0822d3270697c268f-9f6dbe4c8a52e820-00"}
```

`traceId` is different for every request, so your value will differ.

## The Problem Details format

Here is the response body above, formatted:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.10",
  "title": "Todo is already completed",
  "status": 409,
  "detail": "Todo with id 1 is already complete and cannot be completed again.",
  "traceId": "00-eb960df5537d54d0822d3270697c268f-9f6dbe4c8a52e820-00"
}
```

This is the Problem Details format defined by **RFC 9457**, with the dedicated `application/problem+json` content type:

| Field | Meaning |
| --- | --- |
| `type` | URI identifying the error type; by default, it points to the description for the status code in the HTTP specification |
| `title` | Short, human-readable summary; it should be the same for the same kind of error |
| `status` | HTTP status code, matching the response line |
| `detail` | Explanation specific to this error |
| `traceId` | Request trace identifier, an extension field added by ASP.NET Core |

**Why use a standard format?** Clients can reuse **one** way to handle Problem Details responses and read fields such as `status`, `title`, and `detail`. Clients should still check the response content type and retain a fallback for non-JSON responses. Many HTTP client libraries and API tools also recognize this format. Validation failures in [Validation](./validation) use an extension of the same format, with an additional `errors` field.

`traceId` helps **track down problems**: when a user reports an error and provides this ID, you can find the corresponding request in server logs. We’ll use it in [Logging](./logging).

## Business errors: TypedResults.Problem

<<< @/../samples/09-errors/Program.cs{28-44 cs:line-numbers} [09-errors/Program.cs]

Lines 35–41 handle a business rule: an already completed Todo cannot be completed again. `TypedResults.Problem(...)` creates a Problem Details response. You can specify its status code, `title`, and `detail`. The return type on line 28 includes `ProblemHttpResult` accordingly.

Line 44’s `ProducesProblem(StatusCodes.Status409Conflict)` adds a description of the 409 response to OpenAPI. Why is it needed? The status code for `ProblemHttpResult` is specified at the call to `Problem(...)`, so the return type alone can’t tell that it is 409. Open `/openapi/v1.json` and this POST endpoint lists responses `200`, `404`, and `409`; the 409 media type is `application/problem+json`. `ProducesProblem` adds documentation metadata only. It does not change the actual response or check the business rule for you.

**Why 409 instead of 400?** There is nothing wrong with the request itself (its format and parameters are valid); the resource’s **current state** does not allow the operation. `409 Conflict` is intended for this kind of situation. Choosing the right status code tells clients how to respond without reading `detail`: 400 means “fix your request and try again,” while 409 means “the resource state changed; refresh it first.”

Common error status codes:

| Status | Meaning | Typical scenario |
| --- | --- | --- |
| `400 Bad Request` | The request itself is invalid | Invalid format or failed validation |
| `401 Unauthorized` | The caller is not logged in (not authenticated) | Missing or invalid token |
| `403 Forbidden` | The caller is logged in but lacks permission | A regular user accesses an admin feature |
| `404 Not Found` | The resource doesn’t exist | ID not found |
| `409 Conflict` | The request conflicts with the resource’s current state | Duplicate operation or version conflict |
| `500 Internal Server Error` | An internal server error occurred | Unhandled exception |

::: tip
`StatusCodes.Status409Conflict` is a framework constant equivalent to writing `409` directly. Using the constant improves readability and avoids mistyping the number.
:::

## Add content to empty responses

<<< @/../samples/09-errors/Program.cs{7,12,22-26 cs:line-numbers} [09-errors/Program.cs]

Lines 22–26 are unchanged from the previous chapter: when a Todo isn’t found, the handler returns `TypedResults.NotFound()`, an empty 404. But now request an ID that doesn’t exist:

```bash
curl -i http://localhost:5080/todos/99
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"00-89e72e72b0724704260ef30ead4c62b0-7b0d90993376a8c3-00"}
```

The response body is now Problem Details. Two lines work together to produce it:

- **Line 7**, `AddProblemDetails()`: registers the service that creates Problem Details, which other components use when they need to generate an error response.
- **Line 12**, `UseStatusCodePages()`: adds content to eligible 400–599 responses. Here it passes the empty 404 to the Problem Details service.

::: info Technical detail
Status code pages handle a response only if it hasn’t started, its status code is between 400 and 599, and it has no `Content-Length` or `Content-Type`. Being “empty” alone isn’t enough: even if no body was written, setting `Content-Type` or `Content-Length: 0` makes it skip the response. It doesn’t rewrite error content already generated by an endpoint.
:::

It also works for a route that doesn’t exist at all:

```bash
curl -i http://localhost:5080/nothing-here
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"00-4d4857384b8d1dd421304c5d187d7a78-199a0d8a7972567f-00"}
```

**Why not call `TypedResults.Problem(...)` in every handler?** For common errors such as “not found,” the status code already tells you what happened. Repeating the same code everywhere is verbose and can lead to inconsistencies. Let handlers return a simple `NotFound()` and use a shared mechanism to add the format. Use `Problem(...)` for business errors that need extra explanation in `detail`.

## Unhandled exceptions

<<< @/../samples/09-errors/Program.cs{11,46-49 cs:line-numbers} [09-errors/Program.cs]

Lines 46–49 simulate an unexpected situation: the code throws an exception, and nothing catches it.

```bash
curl -i http://localhost:5080/crash
```

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Cache-Control: no-cache,no-store

{"type":"https://tools.ietf.org/html/rfc9110#section-15.6.1","title":"An error occurred while processing your request.","status":500,"traceId":"00-4a7b5bf94fc135b5b5c01580b95299c7-862cabea5a9180c8-00"}
```

**Line 11**, `UseExceptionHandler()`, catches the exception and returns a 500 Problem Details response. Notice what’s **not** in it: the exception message “Database connection string is not configured” and the stack trace.

**This is intentional security design.** Exception messages and stack traces may contain file paths, database structure, or configuration names that give attackers useful clues. The client needs to know only that “the server encountered an error” and the `traceId`; detailed information goes in server logs. Look at the terminal running `dotnet run`:

```text
fail: Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware[1]
      An unhandled exception has occurred while executing the request.
      System.InvalidOperationException: Database connection string is not configured
         at Program.<>c.<<Main>$>b__0_2() in /your/path/09-errors/Program.cs:line 48
```

::: info Technical detail
You may remember that binding failures in earlier chapters printed a long stack trace in plain text in the terminal. That was the **Developer Exception Page**. In the development environment, if no exception handler is configured, the framework enables it automatically and returns exception details to the client to help with debugging.

This section explicitly calls `UseExceptionHandler()`, which catches the exception before the Developer Exception Page can, so even in development the client sees production-style behavior. This lets you see what the client will receive. For details, read the terminal logs.
:::

::: warning
Both middleware components depend on line 7’s `AddProblemDetails()`, but they behave differently when it’s missing:

- `UseExceptionHandler()` makes the application **fail at startup**, with an error telling you to configure `AddProblemDetails()`.
- `UseStatusCodePages()` **doesn’t report an error**; it silently falls back to plain text, and an empty 404 becomes `Status Code: 404; Not Found`.

The second case is less obvious. If an error response isn’t JSON, first check that `AddProblemDetails()` was registered, then check the request’s `Accept` header and whether the response meets the status code pages’ conditions.
:::

::: info Technical detail
To write Problem Details, the middleware also needs a writer that supports the media types declared by the client in its `Accept` header. This is called **content negotiation**. The curl commands above send `Accept: */*` by default and can receive JSON. If you change it to `Accept: text/html`, this example’s `/nothing-here` falls back to a plain-text 404, while `/crash` returns a 500 with no response body. Registering `AddProblemDetails()` does not guarantee that every error becomes JSON, and a failed negotiation does not expose exception details.
:::

Calls such as `app.UseXxx()` are **middleware**. They process each request and response in sequence. Why they appear before `MapGet`, and whether order matters, are topics for the [Middleware](./middleware) chapter. For now, remember to put error-handling middleware near the beginning.

::: fastapi FastAPI comparison
`TypedResults.Problem(...)` is similar to expressing a business error with `raise HTTPException(...)` in FastAPI, though this code returns a result and uses a different response format. Global handling of unhandled exceptions is similar to FastAPI’s `@app.exception_handler(Exception)`.
:::

## Summary

- **Problem Details** (RFC 9457) is a standard error format with `type`, `title`, `status`, and `detail`, and the `application/problem+json` content type.
- Return business errors with `TypedResults.Problem(statusCode, title, detail)` and choose an appropriate status code. Use `ProducesProblem` to document a status code that is specified dynamically.
- `AddProblemDetails()` + `UseStatusCodePages()` add Problem Details to eligible empty error responses. JSON generation also depends on the request’s `Accept` header.
- `UseExceptionHandler()` converts unhandled exceptions into a 500 response that doesn’t reveal internal details. Exception details stay in server logs and can be correlated by `traceId`.
- **Return** expected errors as results; let exception handling deal with unexpected errors.

Next: [Route Groups](./route-groups)—organize related endpoints with `MapGroup`. Previous: [Response Types](./response-types).
