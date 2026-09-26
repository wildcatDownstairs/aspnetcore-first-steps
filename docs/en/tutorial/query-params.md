---
title: Query Parameters
description: 'Read URL query strings through regular handler parameters and understand required and optional values, defaults, arrays, and how the framework infers parameter sources.'
---

# Query Parameters

At the end of the previous chapter, we saw that the framework treated a route parameter with a mismatched name as a “query string” value. This section introduces **query parameters**: the `key=value` part of a URL after `?`, such as `/todos?done=false&page=2`.

They are commonly used for **filtering, sorting, and paging**. They don’t change which resource you’re accessing; they change how you view it.

Here is the complete code for this section:

<<< @/../samples/04-query-params/Program.cs{24-34 cs:line-numbers} [04-query-params/Program.cs]

Lines 15–22 prepare an in-memory list of Todo items as sample data. The code uses collection expressions from [C# Tour](./csharp-tour). The type name is omitted in `new(1, "Buy milk", false)` because the compiler can infer it from `List<Todo>`.

## Run and verify

```bash
dotnet run
```

With no parameters, the default paging settings return two items per page:

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Buy milk","done":false},{"id":2,"title":"Write weekly report","done":true}]
```

Go to page 2:

```bash
curl "http://localhost:5080/todos?page=2"
```

```json
[{"id":3,"title":"Clean the litter box","done":false},{"id":4,"title":"Learn ASP.NET Core","done":false}]
```

Show only unfinished items, with up to 10 per page:

```bash
curl "http://localhost:5080/todos?done=false&pageSize=10"
```

```json
[{"id":1,"title":"Buy milk","done":false},{"id":3,"title":"Clean the litter box","done":false},{"id":4,"title":"Learn ASP.NET Core","done":false}]
```

::: warning
If a URL contains `&`, put the entire URL in quotes. Otherwise the shell treats `&` as a command separator for running a process in the background, and the later parameters are lost.
:::

## Handler parameters are query parameters

<<< @/../samples/04-query-params/Program.cs{24 cs:line-numbers} [04-query-params/Program.cs]

The route template `"/todos"` has no braces, but the handler has three parameters: `done`, `page`, and `pageSize`. The framework sees that these names **aren’t in the route template** and looks for values with the same names in the query string.

That explains the behavior at the end of the previous chapter. For the regular parameters used so far in this tutorial—with no explicitly specified source, no service registration, and no custom binding—you can use these rules as a guide:

| Parameter | Source |
| --- | --- |
| Simple type whose name appears in the route template | Route |
| Simple type (`int`, `string`, `bool`, `DateTime`, etc.) whose name is not in the route template | Query string |
| Complex type (such as the record in the next chapter) when the HTTP method allows implicit body binding | Request body (next chapter) |

::: warning
`GET`, `HEAD`, `OPTIONS`, and `DELETE` do not support the implicit request-body binding in the table above. Don’t change this chapter’s GET endpoint to take a complex object; we’ll receive JSON in a POST endpoint in the next chapter. Types registered as services and framework special types have other binding rules, which we’ll cover later.
:::

These inference rules keep common code concise. If the inferred source isn’t what you intend, you can specify it with an attribute such as `[FromQuery]` or `[FromRoute]`. We’ll use the related `[FromHeader]` attribute in [Headers and Cookies](./headers-cookies).

::: tip
Query parameter names are **case-insensitive**: `?Done=true&PAGESIZE=1` is equivalent to `?done=true&pageSize=1`.
:::

## Required and optional parameters

Of these query parameters, `done`, `page`, and `pageSize` are **optional**. The `keyword` parameter on this endpoint is **required**:

<<< @/../samples/04-query-params/Program.cs{24,30-31 cs:line-numbers} [04-query-params/Program.cs]

The difference comes entirely from the parameter **type declaration**:

| Declaration | Meaning | If omitted from the request |
| --- | --- | --- |
| `string keyword` | Not nullable, with no default value | Returns 400 |
| `bool? done` | Nullable (`?`) | Receives `null` |
| `int page = 1` | Has a default value | Receives `1` |

A request without `keyword` returns:

```bash
curl -i http://localhost:5080/todos/search
```

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Required parameter "string keyword" was not provided from query string.
```

This is where nullable reference types from [C# Tour](./csharp-tour) are useful: **`?` tells the compiler “this may be null” and tells the framework “this parameter is optional.”** No extra annotation is needed.

Line 26 uses the fact that `done` can be null: `done is null` means “don’t filter,” so all items are returned. Otherwise, only items whose `Done` value matches `done` are kept.

::: info Technical detail
`int page = 1` is a **default value** for a lambda parameter, supported starting with C# 12. ASP.NET Core reads the default and treats the parameter as optional, adding the value to the OpenAPI document. In `/openapi/v1.json`, the description for `page` includes `"default": 1`, while `keyword` has `"required": true`.
:::

### When the type is wrong

As with route parameters, query parameter values are converted according to the declared type. Conversion failures return 400:

```bash
curl -i "http://localhost:5080/todos?page=abc"
```

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8

Microsoft.AspNetCore.Http.BadHttpRequestException: Failed to bind parameter "int page" from "abc".
```

`done=yes` produces a similar error because `bool` accepts only `true` and `false`.

::: fastapi FastAPI comparison
This is almost identical to FastAPI: a parameter with no default is required, `Optional[bool] = None` corresponds to C# `bool? done`, and `page: int = 1` corresponds to `int page = 1`.
:::

## Array parameters

<<< @/../samples/04-query-params/Program.cs{33-34 cs:line-numbers} [04-query-params/Program.cs]

Declare a parameter as an array, `int[] id`, to accept the same name multiple times in a query string:

```bash
curl "http://localhost:5080/todos/batch?id=1&id=3&id=5"
```

```json
[{"id":1,"title":"Buy milk","done":false},{"id":3,"title":"Clean the litter box","done":false},{"id":5,"title":"Schedule a checkup","done":true}]
```

If no `id` is provided, `id` is an empty array and the result is `[]`. Array parameters are always optional.

Notice that the parameter name is singular, `id`, rather than `ids`, because it determines the URL form: `?id=1&id=3`. Choose names from the caller’s point of view.

## Spaces and URL encoding

To search for a keyword that contains a space, first **URL-encode** it. A space is encoded as `%20`, so `ASP.NET Core` appears as `ASP.NET%20Core` in a URL:

```bash
curl "http://localhost:5080/todos/search?keyword=ASP.NET%20Core"
```

```json
[{"id":4,"title":"Learn ASP.NET Core","done":false}]
```

The framework decodes the value before binding it, so the handler receives `"ASP.NET Core"` as `keyword`. Browsers and the Scalar documentation page encode it automatically, so you can enter the phrase with a space directly in `/scalar`.

::: warning
The keyword in this example contains only ASCII characters and a space. Encode the space as `%20` as shown above; putting a literal space in the URL may cause a parsing error. You can also enter the unencoded phrase in `/scalar` and let the browser handle it.
:::

## Summary

- Simple handler parameters **not present in the route template** are automatically bound from the **query string**.
- The type declaration determines whether a parameter is required: ordinary types are required; nullable types (`bool?`) and parameters with defaults (`int page = 1`) are optional. A missing required parameter or a failed conversion returns 400.
- Array parameters such as `int[] id` accept multiple values with the same name, such as `?id=1&id=3`.
- Query parameter names are case-insensitive. Non-ASCII characters need URL encoding; the framework decodes them automatically.

Next: [Request Body](./request-body)—use a record to receive JSON. Previous: [Path Parameters](./path-params).
