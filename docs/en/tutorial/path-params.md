---
title: Path Parameters
description: 'Declare route parameters and let the framework convert URL segments into strongly typed handler parameters; understand route constraints, precedence, and catch-all parameters.'
---

# Path Parameters

The endpoints in the previous chapter could respond to only one fixed URL. Real APIs often put data in the URL: `42` in `/users/42` is a user ID, and the trailing portion of `/files/docs/report.pdf` is a file path. The new concept in this section is a **route parameter**: leave a segment of the URL as a placeholder and pass it to the handler as a parameter.

Here is the complete code for this section. The highlighted lines are new compared with the previous chapter:

<<< @/../samples/03-path-params/Program.cs{15,17,19 cs:line-numbers} [03-path-params/Program.cs]

Lines 1–13 are unchanged from the previous chapter, so we won’t explain them again.

## Run and verify

Create a project as in the previous chapter, or go directly to the repository’s `samples/03-path-params` directory, then run:

```bash
dotnet run
```

Send these requests in order and compare the results:

```bash
curl http://localhost:5080/users/42
```

```json
{"id":42,"name":"User 42"}
```

```bash
curl http://localhost:5080/users/me
```

```json
{"id":0,"name":"Current user"}
```

```bash
curl http://localhost:5080/files/docs/2026/report.pdf
```

```json
{"path":"docs/2026/report.pdf"}
```

Now try an invalid address and use `-i` to see the status code:

```bash
curl -i http://localhost:5080/users/abc
```

```http
HTTP/1.1 404 Not Found
Content-Length: 0
Date: Sat, 26 Sep 2026 08:55:56 GMT
Server: Kestrel
```

All four results match. Let’s see how each one is produced.

## Declare a route parameter

<<< @/../samples/03-path-params/Program.cs{15 cs:line-numbers} [03-path-params/Program.cs]

In the route template `"/users/{id:int}"`, the part in braces is the route parameter. It has the **same name** as the handler parameter `int id`; the framework uses the name to match them. For a request to `/users/42`, it extracts `42` and passes it to the `id` parameter.

This is called **parameter binding**. It works by convention—you don’t need an annotation to say “`id` comes from the route.” Matching names are enough.

### A string is converted to int automatically

A URL is fundamentally a string, but the handler receives `id` as an `int`. The framework performs the conversion by calling `int.TryParse` to turn `"42"` into `42`.

Inside the handler, `id` **is an integer**, and the compiler treats it as one:

- `id + 1` gives `43`, not the concatenated string `"421"`.
- `id.Length` fails to compile because an integer has no length:

```text
error CS1061: 'int' does not contain a definition for 'Length' and no accessible extension method 'Length' accepting a first argument of type 'int' could be found (are you missing a using directive or an assembly reference?)
```

**The type you write in the parameter list declares the expected input format.** The rest of your code can safely use it as an integer without parsing or checking it yourself. Common types such as `long`, `Guid`, `DateTime`, `bool`, and enums can also be used directly as parameter types.

::: fastapi FastAPI comparison
This is almost the same as `def get_user(id: int)` in FastAPI: the type annotation determines the conversion rule. The difference is that C# types are checked at compile time, so an invalid use of a type cannot compile.
:::

### Types also appear in the documentation

Open <http://localhost:5080/openapi/v1.json> and find the `/users/{id}` entry:

```json
"parameters": [
  {
    "name": "id",
    "in": "path",
    "required": true,
    "schema": {
      "pattern": "^-?(?:0|[1-9]\\d*)$",
      "type": "integer",
      "format": "int32"
    }
  }
]
```

`"type": "integer"` and `"format": "int32"` come from the `int` in the code. When you try this endpoint on the `/scalar` page, the documentation also tells you to enter an integer. One type declaration determines the conversion rule, compile-time checks, and API documentation.

## Route constraints

In the template `{id:int}`, `:int` is a **route constraint**. It means **the endpoint matches only if this segment can be parsed as an integer.**

That explains why `/users/abc` returned `404 Not Found`: `abc` doesn’t meet the `int` constraint, so this endpoint was never selected and the framework couldn’t find an endpoint to handle the request.

Why repeat the type in the template if the handler parameter is already an `int`? Remove the constraint and compare. With the template `"/users/{id}"`, a request to `/users/abc` returns:

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Failed to bind parameter "int id" from "abc".
```

The difference is **when the check happens**:

| | When it happens | On failure | Meaning |
| --- | --- | --- | --- |
| Route constraint `{id:int}` | Before endpoint matching | 404 | “This URL doesn’t match this endpoint” |
| Parameter type `int id` | After endpoint matching | 400 | “The endpoint matched, but the parameter value couldn’t be converted” |

Which should you use? Microsoft’s guidance is clear: **use route constraints to distinguish routes with similar shapes, not to validate input.** From a client’s perspective, `/users/abc` means “the parameter is invalid”; a 400 with an explanation is more useful than an empty 404.

Constraints are useful when the same position could match multiple endpoints. For example, if you provide both `/users/{id:int}` (look up by ID) and `/users/{name}` (look up by username), `/users/42` meets the `int` constraint and selects the first endpoint; `/users/alice` doesn’t and falls through to the second. Without the constraint, these routes could not coexist, as we’ll see in the next section.

This example keeps `:int` so you can observe how a constraint works. In your own project, if `/users/{id}` is the only route of that shape, removing the constraint and returning 400 for invalid values is friendlier to callers.

::: tip
An interesting case: `/users/99999999999` also returns 404. This number is outside the range of `int` (about ±2.1 billion), so it doesn’t meet the `int` constraint. If IDs may be larger, use `long` and the `{id:long}` constraint.
:::

Other common constraints include:

| Constraint | Example | Matches |
| --- | --- | --- |
| `int` / `long` | `{id:int}` | An integer |
| `guid` | `{id:guid}` | A GUID, such as `0f8fad5b-d9cb-469f-a165-70867728950e` |
| `bool` | `{on:bool}` | `true` or `false` |
| `alpha` | `{name:alpha}` | Letters only |
| `min(1)` | `{page:min(1)}` | An integer greater than or equal to 1 |
| `minlength(3)` | `{code:minlength(3)}` | At least 3 characters |

You can combine constraints, for example `{id:int:min(1)}`.

::: warning
**Don’t use route constraints to validate input.** A failed constraint returns 404, so the client only knows “the URL doesn’t exist,” not why the value is wrong. Constraints **distinguish routes**. “The format is correct but the value is invalid” (for example, a negative age) is input validation and should return a clear 400 error. We’ll cover this in [Validation](./validation).
:::

## Route precedence

<<< @/../samples/03-path-params/Program.cs{15,17 cs:line-numbers} [03-path-params/Program.cs]

Notice the registration order: line 15’s `/users/{id:int}` comes **before** line 17’s `/users/me`. But a request to `/users/me` selects line 17.

This has nothing to do with registration order. Even if you remove `:int` so `/users/{id}` could also match `me`, `/users/me` still selects line 17 (try it yourself). ASP.NET Core routing **does not try routes one by one in registration order**. It finds all matching candidates first, then selects the most specific one by **precedence**. Roughly:

1. Literal segments such as `me` have the highest precedence.
2. Constrained parameters such as `{id:int}` come next.
3. Unconstrained parameters such as `{id}` follow.
4. Catch-all parameters such as `{*path}` have the lowest precedence; we’ll cover them next.

**Why is it designed this way?** In real projects, endpoints are often registered across several files (see [Organizing Larger Projects](./project-structure)), so controlling registration order is difficult and program behavior shouldn’t depend on it. Precedence lets you register endpoints in any order with the same result.

::: fastapi FastAPI comparison
This is a major difference from FastAPI. FastAPI matches routes in declaration order, so `/users/me` must come before `/users/{user_id}`. In ASP.NET Core, order doesn’t matter.
:::

What if a request matches two routes with exactly the same precedence? For example, if you register both `/users/{id}` and `/users/{name}` without constraints, the framework cannot choose for `/users/42`. It returns a `500` error with an `AmbiguousMatchException`.

The routes must be able to match **the same request** to conflict. `/users/{id}` and `/posts/{id}` have the same precedence but can never match the same URL, so they don’t conflict.

For the conflict above, the compiler reports a warning:

```text
warning ASP0022: Route '/users/{id}' conflicts with another handler route. An HTTP request that matches multiple routes results in an ambiguous match error.
```

ASP.NET Core’s built-in **analyzer** checks your code. It understands more than C# syntax; it also understands the meaning of route templates.

::: warning
Don’t assume “no compiler warning” means “no route conflict.” To avoid false positives, ASP0022 is deliberately conservative: it checks only duplicate routes in the **same code block**, so conflicting routes in separate branches of an `if` statement may not be reported. The analyzer catches common mistakes, but it doesn’t replace testing.
:::

## Catch-all parameters

<<< @/../samples/03-path-params/Program.cs{19 cs:line-numbers} [03-path-params/Program.cs]

A regular route parameter matches only **one segment**, the content between two `/` characters. Add `*` before the parameter name to make it a **catch-all parameter**: it passes all remaining segments, **including their `/` characters**, to the parameter.

So, for `/files/docs/2026/report.pdf`, `path` receives `docs/2026/report.pdf`. This is useful for file paths, nested categories, and other values with a variable number of segments. A catch-all parameter can appear only as the final segment of a template.

::: warning
`path` has type `string` (not nullable), so it is **required**. A request to `/files/` with nothing after it returns 400. To allow an empty value, change the parameter type to `string?`; the question mark means it can be null, and `path` will receive `null`. See [C# Tour](./csharp-tour) for nullable types.
:::

::: fastapi FastAPI comparison
`{*path}` is equivalent to FastAPI’s `{file_path:path}` path converter.
:::

## What if the names don’t match?

Binding matches parameters by name, so what happens if the names differ? Suppose the template is `"/users/{id}"` but the handler parameter is `(int userId)`. It compiles, but a request to `/users/5` returns:

```text
HTTP/1.1 400 Bad Request

Microsoft.AspNetCore.Http.BadHttpRequestException: Required parameter "int userId" was not provided from query string.
```

Look at the end of the error message: the framework searched the **query string** for `userId`. Since the route template has no parameter named `userId`, the framework inferred that it should come from the part of the URL after `?`.

That leads into the next chapter. For now, remember: **the names in the route template and parameter list must match.**

## Summary

- Declare a **route parameter** with `{name}` in the template. A same-named handler parameter receives its value automatically.
- The parameter type (such as `int`) determines string conversion. The converted value is checked as that type at compile time and included in OpenAPI documentation.
- A **route constraint** (such as `{id:int}`) applies before endpoint matching and returns 404 if it fails. Parameter conversion happens after matching and returns 400 if it fails. Constraints distinguish routes; they don’t validate input.
- Routes are matched by **precedence**, not registration order: literal > constrained parameter > regular parameter > catch-all. Routes that match the same request with equal precedence cause an ambiguous-match error. Analyzer ASP0022 detects some of these at compile time.
- `{*path}` is a **catch-all parameter** that can match the remaining path, including `/` characters.

Next: [Query Parameters](./query-params)—handle the part of a URL after `?`. Previous: [First Steps](./first-steps).
