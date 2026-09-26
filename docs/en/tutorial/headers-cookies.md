---
title: Headers and Cookies
description: 'Read request headers with [FromHeader], read cookies through HttpRequest and write them through HttpResponse, and learn when to specify parameter sources explicitly.'
---

# Headers and Cookies

So far we’ve read data from URLs (routes and query strings) and request bodies. An HTTP request has another part: **headers**. Client versions, language preferences, and authentication tokens are often sent there. A **cookie** is itself a request header named `Cookie`.

The new concept in this section: **when the source of a parameter can’t be inferred from its name and type, tell the framework explicitly where to find it.**

<<< @/../samples/07-headers-cookies/Program.cs{1,16-33 cs:line-numbers} [07-headers-cookies/Program.cs]

## Run and verify

```bash
dotnet run
```

By default, curl sends a `User-Agent` header:

```bash
curl http://localhost:5080/whoami
```

```json
{"userAgent":"curl/8.21.0","clientVersion":"Not provided"}
```

Set headers yourself with `-H`:

```bash
curl http://localhost:5080/whoami -H "X-Client-Version: 2.1.0" -H "User-Agent: MyApp/1.0"
```

```json
{"userAgent":"MyApp/1.0","clientVersion":"2.1.0"}
```

The curl version in `userAgent` varies by environment.

## Read request headers

<<< @/../samples/07-headers-cookies/Program.cs{1,16-19 cs:line-numbers} [07-headers-cookies/Program.cs]

[Query Parameters](./query-params) explained that simple parameters not in the route template come from the query string by default. To read a request header, use `[FromHeader]` to **specify the source explicitly**. It comes from the `Microsoft.AspNetCore.Mvc` namespace imported on line 1.

`Name = "User-Agent"` specifies the header name. **Why set the name separately?** Header names commonly contain hyphens (`User-Agent`, `X-Client-Version`), which aren’t allowed in C# parameter names. `Name` lets you use a valid, conventional C# name and map it to the actual HTTP name. Header names are case-insensitive.

The required and optional rules are the same as for query parameters:

- `string userAgent` is non-nullable and required. Sending an empty `User-Agent` (curl removes this header with `-H "User-Agent:"`) returns 400:

  ```text
  Microsoft.AspNetCore.Http.BadHttpRequestException: Required parameter "string userAgent" was not provided from header.
  ```

- `string? clientVersion` is nullable and receives `null` if omitted. Line 19 uses `??` to provide a default display value.

::: tip
Custom headers have traditionally used the `X-` prefix, as in `X-Client-Version`. Current standards no longer recommend this prefix, but it is still common in real projects, and the framework handles both forms.
:::

::: fastapi FastAPI comparison
`[FromHeader(Name = "X-Client-Version")] string? clientVersion` is equivalent to FastAPI’s `x_client_version: str | None = Header(default=None)`. FastAPI converts underscores to hyphens automatically; ASP.NET Core uses `Name` to specify the mapping explicitly.
:::

## Write a cookie

<<< @/../samples/07-headers-cookies/Program.cs{21-30 cs:line-numbers} [07-headers-cookies/Program.cs]

A **cookie** is a small piece of data that a server asks a browser to store. On later visits to the same site, the browser sends it back automatically. Common uses include saving user preferences and login sessions.

Writing a cookie changes the **response headers**, so the handler needs the object representing the response. Line 21’s `HttpResponse response` parameter is that object. `HttpResponse` is a **special type** recognized by the framework: for this type, it doesn’t search the route, query string, or request body; it passes in the current request’s response object directly. `HttpRequest`, `HttpContext`, and `CancellationToken` are special types too.

Lines 23–28 call `Cookies.Append` to add a `Set-Cookie` header to the response. Use `-i` to inspect it:

```bash
curl -i -X POST http://localhost:5080/preferences/theme/dark -c cookies.txt
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Set-Cookie: theme=dark; max-age=2592000; path=/; samesite=lax; httponly

{"saved":"dark"}
```

`-c cookies.txt` makes curl save the received cookie in a file, like a browser. Each of the three `CookieOptions` has a purpose:

| Option | Effect | Why |
| --- | --- | --- |
| `HttpOnly = true` | JavaScript on the page cannot read the cookie | Even if a site is injected with a malicious script, it can’t steal the cookie this way |
| `SameSite = Lax` | Sent with same-site requests; on cross-site requests it can also be sent for top-level navigation using safe methods such as GET, for example when following a link or submitting a GET form | Reduces some cross-site request forgery (CSRF) risk, but is not a complete CSRF defense |
| `MaxAge = 30 days` | Expires after 30 days | If neither `MaxAge` nor `Expires` is set, it is a session cookie whose lifetime is managed by the browser; session restoration may keep it after a browser restart |

::: warning
Cookies are stored on the client, and users can change their values. **Don’t store trusted data in a cookie**, such as “the current user is an administrator.” Authentication should use a cryptographically signed token; we’ll cover that in [Authentication](./authentication).
:::

## Read a cookie

<<< @/../samples/07-headers-cookies/Program.cs{32-33 cs:line-numbers} [07-headers-cookies/Program.cs]

To read a cookie, use `HttpRequest`. Its `Cookies` property looks up a value by name and returns `null` if it doesn’t exist.

Send a request with the cookie you saved (`-b` sends cookies from a file):

```bash
curl http://localhost:5080/preferences -b cookies.txt
```

```json
{"theme":"dark"}
```

Without a cookie, the endpoint returns the default value:

```bash
curl http://localhost:5080/preferences
```

```json
{"theme":"light"}
```

You may have noticed that request headers use a `[FromHeader]` parameter, while cookies are read through `HttpRequest`. That’s because Minimal APIs do **not** have a `[FromCookie]` attribute. Cookies are less common than request headers in Web APIs, so the framework doesn’t provide a dedicated binding method for them.

::: fastapi FastAPI comparison
There is no direct equivalent here for FastAPI’s `Cookie()` parameter; read cookies through `HttpRequest.Cookies`. FastAPI’s `response.set_cookie(...)` corresponds to `response.Cookies.Append(...)`.
:::

## When to use HttpRequest

Since `HttpRequest` gives access to everything in a request, why not always use it instead of declaring `[FromHeader]` parameters?

Because **parameter declarations are an interface description for people and tools**:

- Reading the handler signature tells you which inputs it needs and which are required.
- If a required value is missing, the framework automatically returns 400 without custom checks.
- OpenAPI documentation lists the headers, and the Scalar page provides matching input fields.

When you read directly from `HttpRequest`, this information is hidden inside the handler, isn’t visible in documentation, and you have to handle missing values yourself. Prefer parameters when they can express the input; use `HttpRequest` when no dedicated binding method exists, as with cookies in this section.

## Summary

- Use `[FromHeader(Name = "...")]` to **specify a request-header source explicitly**. `Name` maps to HTTP names containing hyphens.
- The type still determines whether a value is required: `string` is required, while `string?` is optional.
- `HttpRequest`, `HttpResponse`, and `HttpContext` are **special types** passed in by the framework for the current request or response.
- Write cookies with `response.Cookies.Append` and options such as `HttpOnly` and `SameSite`; read them with `request.Cookies["name"]`. Minimal APIs have no `[FromCookie]`.
- Prefer parameter declarations for inputs because they describe the interface, enable automatic checks, and feed the documentation.

Next: [Response Types](./response-types)—describe all possible results in the return type. Previous: [Validation](./validation).
