---
title: CORS
description: Configure a precise cross-origin policy for a separate frontend. Verify preflight requests, the Authorization request header, and the Location response header, and distinguish CORS from authorization.
---

# CORS

The API runs on port 5080, and the frontend page runs on port 5178. By default, a browser does not let the page read the API's response. This chapter configures **Cross-Origin Resource Sharing (CORS)** so a local frontend can call the API and read its results.

Add a CORS policy to the previous chapter's code. Here are the complete files:

<<< @/../samples/20-cors/Program.cs{19-23,29-32 cs:line-numbers} [20-cors/Program.cs]

<<< @/../samples/20-cors/Models.cs{cs:line-numbers} [20-cors/Models.cs]

<<< @/../samples/20-cors/TodoDbContext.cs{cs:line-numbers} [20-cors/TodoDbContext.cs]

The allowed frontend address comes from configuration:

<<< @/../samples/20-cors/appsettings.json{13-17 json:line-numbers} [20-cors/appsettings.json]

## First, understand origins

An **origin** consists of a protocol, host, and port:

| Address | Same origin as `http://localhost:5080`? |
| --- | --- |
| `http://localhost:5080/todos` | Yes; a different path does not affect the origin |
| `http://localhost:5178` | No; the port differs |
| `http://127.0.0.1:5080` | No; the host differs |
| `https://localhost:5080` | No; the protocol differs |

The browser's **same-origin policy** restricts scripts from reading responses from another origin. With CORS configured, the server can allow pages from specified origins to read a response.

## Start the API

Stop the previous chapter's service, then run these commands from the repository root:

```bash
cd samples/20-cors
dotnet user-jwts create --name alice --role editor --valid-for 1h --output token
dotnet run
```

Copy the complete token printed by the tool for later. Generate the token in this chapter's project. The database is a new `todos-20.db`, whose Todo list starts empty; the categories remain Work (1) and Life (2).

## Verify using a real browser page

The sample includes an HTML page served locally by Node.js; it does not require installing npm packages:

<<< @/../samples/20-cors/browser/index.html{24-35 html:line-numbers} [20-cors/browser/index.html]

<<< @/../samples/20-cors/browser/serve.mjs{js:line-numbers} [20-cors/browser/serve.mjs]

Open another terminal, go to `samples/20-cors`, and run:

```bash
node browser/serve.mjs
```

Expected output:

```text
Open http://localhost:5178/
```

Open the page through this HTTP address; do not double-click the HTML file to open it with `file://`. Paste the token into the page's input and click “Read Todos.” On the first run, the result is:

```text
HTTP 200
Location: (none)
[]
```

Then click “Create Todo.” The result is:

```text
HTTP 201
Location: /todos/1
{"id":1,"title":"Browser todo","done":false,"categoryId":1}
```

This ID assumes a new database; clicking again creates another Todo. The token stays in the current page's memory and is not written to localStorage, a Cookie, or a server file.

## Preflight: ask if the request is allowed before sending it

Open the browser developer tools and select the Network panel. You can see an **OPTIONS preflight request**. This example manually sends `Authorization`, and POST also uses `application/json`; these conditions trigger a preflight. POST is not the only method that triggers one. The browser may cache preflight results, so an OPTIONS request may not appear for every click.

Use curl to inspect the preflight response. This command does not include a JWT or create a Todo:

```bash
curl -i -X OPTIONS http://localhost:5080/todos -H "Origin: http://localhost:5178" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type"
```

The relevant response headers are:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5178
Access-Control-Allow-Methods: GET,POST,PUT,DELETE
Access-Control-Allow-Headers: Authorization,Content-Type
```

The preflight does not carry the actual request's Bearer token, so it must be handled before authentication and authorization. This example calls `UseRouting()` first to identify the endpoint, then `UseCors()` to handle preflight. Actual GET and POST requests still require a valid token, and writes still require the editor role.

## The policy's four settings

| Setting | Purpose |
| --- | --- |
| `WithOrigins(...)` | Allow the exact origin `http://localhost:5178`; it does not include a path or trailing slash |
| `WithMethods(...)` | Allow the frontend to use GET, POST, PUT, and DELETE |
| `WithHeaders(...)` | Allow the actual request to include Authorization and Content-Type |
| `WithExposedHeaders("Location")` | Allow frontend JavaScript to read the Location response header |

**Why configure request and response headers separately?** Allowing a request to send Authorization does not allow it to read any response header. `Location` is not exposed to cross-origin scripts by default, so it must be declared separately. Otherwise, the browser's Network panel may show it, but `response.headers.get('Location')` returns `null`.

This example manually sends a Bearer header and uses `credentials: 'omit'` to prevent the browser from attaching a Cookie, so `AllowCredentials()` is not needed. If you later use Cookie-based sign-in, configure credentials separately and defend against **cross-site request forgery (CSRF)**. [ASP.NET Core CORS documentation](https://learn.microsoft.com/en-us/aspnet/core/security/cors?view=aspnetcore-10.0)

## A disallowed origin does not necessarily get a 403

Change the Origin in the preflight command to `http://localhost:5179` and run it again. This example still returns 204, but **does not include `Access-Control-Allow-Origin`**, so the browser will not approve the follow-up cross-origin request.

curl does not enforce the browser's same-origin policy. With a valid token, a direct curl request may still reach a handler even if it includes a disallowed Origin; the response simply lacks the CORS permission header. Some browser requests that do not require preflight may also reach the server, but the script cannot read their responses.

**CORS does not replace authentication and authorization.** JWT and `CanWriteTodos` prevent writes by callers without permission in this chapter; CORS determines whether a browser page may read a response. [How CORS works](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)

::: tip Tip
When you see a “CORS error” in the browser, first inspect the preflight and actual request in Network: check that the API is running, the Origin matches exactly, the method and request headers are allowed, and whether the actual request received 401 or 403. Do not change business permissions just because the browser reported an error.
:::

::: fastapi FastAPI comparison
This corresponds to FastAPI / Starlette's `CORSMiddleware`: configure allowed origins, methods, request headers, and readable response headers separately. Browser preflight and same-origin rules are the same regardless of the server framework.
:::

## Summary

- An origin is defined by protocol, host, and port. CORS allows browser scripts to read cross-origin responses from specified origins.
- Configure origins, methods, and request headers precisely. To read response headers such as Location, expose them explicitly as well.
- Preflight checks cross-origin permission; actual requests still need authentication and authorization. Place CORS middleware before authentication and authorization.
- A disallowed origin may still receive an HTTP response, but without a permission header. A successful curl request does not prove that browser CORS is configured correctly.
- CORS does not provide user permissions or data isolation, and it does not replace CSRF protection.

This chapter completes the “Security” stage. Next: [Testing](./testing)—use automated checks to protect these behaviors. Previous: [Authorization](./authorization).
