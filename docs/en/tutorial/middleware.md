---
title: Middleware
description: "Understand the ASP.NET Core request pipeline: write middleware with app.Use, observe the order in which requests enter and leave, see how short-circuiting works, and learn why middleware registration order matters."
---

# Middleware

A request may need both elapsed-time logging and a maintenance-mode check. Copying that code into every endpoint would be tedious; we can handle it once outside the endpoints.

These processing steps are called **middleware** and are arranged in order to form a **request pipeline**. Exception handling used earlier is also middleware. In this chapter, we write three pieces ourselves and observe how they call the next step.

<<< @/../samples/13-middleware/Program.cs{16-48 cs:line-numbers} [13-middleware/Program.cs]

This example uses `Console.WriteLine` to show the execution order as clearly as possible. The next chapter introduces the standard approach: logging.

## Run and verify

Stop the service from the previous chapter, then run this from the repository root:

```bash
cd samples/13-middleware
dotnet run
```

Open another terminal and send a request:

```bash
curl -i http://localhost:5080/hello
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
X-Elapsed-Ms: 1

{"message":"Hello"}
```

In the terminal running the service, you will see output like this:

```text
→ [1] Enter: GET /hello
→ [2] Enter: start timing
● Endpoint: handling request
← [2] Leave
← [1] Leave: 200
```

Now make another request with the `?maintenance` parameter:

```bash
curl -i "http://localhost:5080/hello?maintenance"
```

```http
HTTP/1.1 503 Service Unavailable
Content-Length: 0
X-Elapsed-Ms: 1
```

```text
→ [1] Enter: GET /hello
→ [2] Enter: start timing
■ [3] Maintenance mode; request intercepted
← [2] Leave
← [1] Leave: 503
```

The endpoint did not run this time. The value of `X-Elapsed-Ms` depends on your machine and may be 0 or another number.

## The pipeline model

Here is the output from the first request as a diagram:

```text
Request ──► [1] ──► [2] ──► [3] ──► Endpoint
                                      │
Response ◄── [1] ◄── [2] ◄── [3] ◄─────┘
```

A piece of middleware can run code both before and after it calls the next step. Look at the first middleware:

<<< @/../samples/13-middleware/Program.cs{17-22 cs:line-numbers} [13-middleware/Program.cs]

- `context` is the `HttpContext`, which contains all the information about this request and response.
- `next` represents **the next step in the pipeline**.
- Line 20, `await next(context)`, passes the request to the next step and **waits for it to finish**.

Line 19 runs first. Line 21 runs after the later code returns normally, so this example can record either `200` or `503`. This does not mean the response has not been sent yet: the endpoint may already have written its response body. If later code throws an unhandled exception, ordinary statements after `await next(context)` do not run; put cleanup code that must run in a `finally` block.

This structure lets a timer start before `next` and stop afterward, or lets exception handling wrap `next` in `try/catch`. The shared work stays together, and endpoints do not need to repeat it.

::: fastapi FastAPI comparison
This is very similar to FastAPI's `@app.middleware("http")`: `response = await call_next(request)` corresponds to `await next(context)`. Code before it handles the request, and code after it handles the response.
:::

## Modify a response header

<<< @/../samples/13-middleware/Program.cs{25-36 cs:line-numbers} [13-middleware/Program.cs]

Middleware 2 wants to add elapsed time to a response header. It may seem natural to do that after `await next(context)`, but by then the response may **already be starting to send**. An HTTP response sends its status line and headers before its body. Once an endpoint begins writing the body, the headers have already been sent, and modifying them throws an exception.

That is why lines 28–32 register a callback with `Response.OnStarting`, which runs just before the response headers are sent. The headers can still be changed then, though the response body may not be fully produced yet; a streaming response, for example, can continue generating content.

::: info Technical detail
`X-Elapsed-Ms` records the time from when middleware 2 starts until the response begins sending. It does not measure the time until the client receives the complete response.
:::

## Short-circuiting

<<< @/../samples/13-middleware/Program.cs{39-48 cs:line-numbers} [13-middleware/Program.cs]

Middleware 3 checks whether the query string contains `maintenance`. If it does, it sets status code 503 (Service Unavailable) and returns directly, **without calling `next`**.

When middleware does not call `next`, the later steps do not run. This is called **short-circuiting**. After middleware 3 returns normally, middleware 1 and 2 continue their return path, so they can still record the 503 status and elapsed time.

Built-in middleware can also short-circuit: authorization can return 401 when a protected endpoint has no valid identity; CORS middleware can return after handling a preflight request; and static-file middleware can return a file when it finds one. Note that JWT **authentication** validates a token and establishes an identity; it does not block every request just because a token is invalid. Whether access is allowed also depends on the endpoint's authorization requirements.

## Why order matters

Middleware added with `app.Use...` is arranged in the order of those calls. Earlier middleware can call later middleware or return immediately.

Consider changing the order in this example:

- If middleware 3 comes first, maintenance-mode requests are intercepted before they enter middleware 1, so middleware 1 cannot record them.
- If middleware 2 comes last, its timing does not include the work done by earlier steps.

For built-in middleware, order directly affects correctness and security:

| Middleware | Position | Reason |
| --- | --- | --- |
| `UseExceptionHandler` | Before the steps whose exceptions it should catch | It can catch only exceptions thrown by later steps |
| `UseStatusCodePages` | Early in the pipeline | It can handle only empty error responses produced by later steps |
| `UseCors` | After routing, before authentication and authorization | Handle CORS preflight first, then check identity and permissions for actual requests |
| `UseAuthentication` | Before authorization | Establish “who you are” before deciding “what you can do” |
| `UseAuthorization` | Before endpoints | Stop requests without permission before they execute an endpoint |

Chapter 09 placed exception handling early so it could catch exceptions from later processing. Chapters 18–20 use the full authentication and authorization order.

::: warning Note
An incorrect order may not cause a startup error. For example, code that throws before the exception-handling middleware runs cannot be caught by it. When adding built-in middleware, check the [recommended order in the official documentation](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/middleware/?view=aspnetcore-10.0#middleware-order).
:::

::: info Technical detail
This example does not explicitly call `UseRouting()`. `WebApplication` arranges route matching before custom middleware and endpoint execution after it. That lets us read the matched endpoint through `context.GetEndpoint()` here; it is `null` when no route matches. If you move routing middleware manually, reconsider this order.
:::

## Summary

- **Middleware** is a step in the request pipeline, written with `app.Use(async (context, next) => { ... })`.
- `await next(context)` calls later steps. Statements after it run only after those steps return normally.
- To change response headers before they are sent, register a callback with `Response.OnStarting`.
- Not calling `next` is **short-circuiting**: later steps do not run, while earlier middleware still completes its return path.
- Custom middleware runs in registration order. Put exception handling before the code it should protect, and authentication before authorization.

Next: [Logging](./logging)—use `ILogger` instead of `Console.WriteLine`. Previous: [Configuration and Options](./configuration).
