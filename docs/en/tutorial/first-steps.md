---
title: First Steps
description: 'Create a project with dotnet new web, define your first endpoint with MapGet, then run it and verify the JSON response.'
---

# First Steps

There is just one new concept in this section: an **endpoint**—the code that runs when a particular HTTP request arrives. We’ll write an endpoint that returns JSON and get an automatically generated interactive API documentation page along the way.

Here is the complete code at the end of this section:

<<< @/../samples/02-first-steps/Program.cs{cs:line-numbers} [02-first-steps/Program.cs]

That’s a complete Web API in 17 lines. This section focuses on the endpoint on line 15. We’ll use the rest of the startup and documentation configuration as given and explain only what you need to run it.

## Create a project

Create an empty Web project with the `web` template, then add two package dependencies:

```bash
dotnet new web -o FirstSteps
cd FirstSteps
dotnet add package Microsoft.AspNetCore.OpenApi
dotnet add package Scalar.AspNetCore
```

- `Microsoft.AspNetCore.OpenApi`: Microsoft’s official package for **generating OpenAPI documentation** (JSON that describes the API) from your code.
- `Scalar.AspNetCore`: a third-party open-source package that **renders the OpenAPI document as an interactive web page**.

Then replace `Program.cs` with the code above. The project file should now look like this:

<<< @/../samples/02-first-steps/FirstSteps.csproj{9-12 xml:line-numbers} [02-first-steps/FirstSteps.csproj]

The highlighted `ItemGroup` contains the two dependencies added by `dotnet add package`.

::: tip
If you don’t specify a version with `dotnet add package`, it installs the latest stable version compatible with the current project. Your version number may be newer than the one shown here; that’s fine.
:::

### Set a fixed port

The template assigns a random port in `Properties/launchSettings.json`. To make the output consistent with this tutorial, all our examples set it to `5080`:

<<< @/../samples/02-first-steps/Properties/launchSettings.json{8,10 json:line-numbers} [02-first-steps/Properties/launchSettings.json]

This file applies only to local development (`dotnet run` reads it); it isn’t used when deploying. Line 10 sets the environment to `Development`, which matters in the line-by-line explanation later.

::: info Technical detail
The template creates both `http` and `https` profiles by default. This tutorial keeps only HTTP so you don’t have to deal with a local development certificate yet. In production, HTTPS is usually handled by a reverse proxy or cloud platform; we’ll discuss that in the Deployment chapter.
:::

## Run and verify

```bash
dotnet run
```

When you see this output, the service has started:

```text
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5080
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to shut down.
info: Microsoft.Hosting.Lifetime[0]
      Hosting environment: Development
info: Microsoft.Hosting.Lifetime[0]
      Content root path: /your/path/FirstSteps
```

The program won’t exit; it is waiting for requests. **Open another terminal** and send a request:

```bash
curl -i http://localhost:5080/
```

`-i` displays the response headers too. Expected output:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Sat, 26 Sep 2026 08:56:22 GMT
Server: Kestrel
Transfer-Encoding: chunked

{"message":"Hello, ASP.NET Core!"}
```

You can also open <http://localhost:5080/> in a browser. To stop the service, return to its terminal and press `Ctrl+C`.

:::: details Optional: View the interactive documentation

While the service is running, open <http://localhost:5080/scalar> to see an API documentation page. The left pane lists all endpoints. Open `GET /` and click **Test Request** to send a request and view the response.

Behind this page is an OpenAPI document. Visit <http://localhost:5080/openapi/v1.json> to see its raw content; the part describing `GET /` looks like this:

```json
"paths": {
  "/": {
    "get": {
      "tags": ["FirstSteps"],
      "responses": {
        "200": {
          "description": "OK",
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/AnonymousTypeOfstring" }
            }
          }
        }
      }
    }
  }
}
```

Notice that **you didn’t write any documentation or annotations.** The framework inferred it from the code: it knows this endpoint handles `GET /` and returns a JSON object with a string property named `message`.

::: fastapi FastAPI comparison
The `/scalar` page is similar to FastAPI’s built-in `/docs`, and `/openapi/v1.json` is similar to `/openapi.json`. The difference is that ASP.NET Core separates “generating documentation” from “displaying documentation” into two packages, so you can choose your display tool.
:::

::::

## Line-by-line walkthrough

### Lines 3–7: the builder and app stages

<<< @/../samples/02-first-steps/Program.cs{3,5,7 cs:line-numbers} [02-first-steps/Program.cs]

**Line 3**, `WebApplication.CreateBuilder(args)`, creates a **builder** with the default settings a web application needs: it reads configuration files, sets up logging, and prepares the web server. `args` are command-line arguments; passing them in lets you override configuration from the command line at startup.

`var` asks the compiler to infer the type from the expression on the right. In VS Code, hover over `builder` to see its actual type, `WebApplicationBuilder`. **The type is known; you just don’t have to write it out.**

**Line 5**, `builder.Services`, is a **service collection**—think of it as the list of components the application needs at runtime. `AddOpenApi()` adds the components needed to generate OpenAPI documentation to that list. This only **registers** them; it doesn’t generate anything yet. How services are created and used is covered in [Dependency Injection](./dependency-injection). For now, remember that `builder.Services.AddXxx()` means “register a capability.”

**Line 7**, `Build()`, uses the configuration and service registrations above to build the actual application object, `app` (type `WebApplication`).

::: info Technical detail
Why use two stages? `builder` prepares configuration and service registrations; `Build()` creates the application from them; then `app` defines how requests are handled. After `Build()`, the service-registration collection becomes read-only, so you can’t add or remove registrations. This does not freeze mutable state inside service instances or guarantee that they are safe for concurrent use. [Dependency Injection](./dependency-injection) covers service creation and lifetimes.
:::

::: warning
Service registrations such as `builder.Services.AddXxx()` must happen before `Build()`. Otherwise, the app throws an exception because the service collection is read-only.
:::

### Lines 9–13: expose documentation only in development

<<< @/../samples/02-first-steps/Program.cs{9-13 cs:line-numbers} [02-first-steps/Program.cs]

- `app.MapOpenApi()`: publishes the OpenAPI document at `/openapi/v1.json`.
- `app.MapScalarApiReference()`: publishes the Scalar documentation page at `/scalar`.

They are inside `if (app.Environment.IsDevelopment())`. `app.Environment` gets its value from the `ASPNETCORE_ENVIRONMENT` environment variable, which we set to `Development` in `launchSettings.json`.

**Why enable this only in development?** API documentation lists all your endpoints and data structures, giving attackers a ready-made map. It is useful during development, but should not be exposed by default in production. This is the practice recommended in Microsoft’s official documentation.

### Line 15: define an endpoint

<<< @/../samples/02-first-steps/Program.cs{15 cs:line-numbers} [02-first-steps/Program.cs]

This is the core of the section. An **endpoint** consists of three parts:

| Part | This example | Meaning |
| --- | --- | --- |
| HTTP method | **Get** in `MapGet` | Respond only to GET requests |
| Route template | `"/"` | Respond only to the root path |
| Handler | `() => new { ... }` | Code to run when a request matches |

The handler is a **lambda expression**, or anonymous function: `()` is the parameter list (empty here), and the value after `=>` is the return value. There are also methods such as `MapPost`, `MapPut`, and `MapDelete` for other HTTP methods.

The return value `new { Message = "..." }` is an **anonymous type** object—you can put together an object with properties without defining a class first. The framework automatically **serializes** the returned object as JSON and sets `Content-Type: application/json`.

You may have noticed that the property name in the code begins with an uppercase `Message`, while the JSON uses lowercase `message`. **This is intentional:** C# convention uses PascalCase for properties, while JavaScript and other front-end ecosystems use camelCase. ASP.NET Core converts the names during serialization by default, so both sides can follow their own conventions.

::: tip
If a handler returns a string (for example, `() => "Hello"`), the framework writes it as plain text with `Content-Type: text/plain`. Other objects are serialized as JSON.
:::

::: fastapi FastAPI comparison
Line 15 is like a function returning a dictionary decorated with `@app.get("/")` in FastAPI. The difference is that ASP.NET Core doesn’t use a decorator; it calls `MapGet` to register the handler.
:::

### Line 17: start the server

The last line, `app.Run()`, starts the web server and listens for requests. It blocks until you press `Ctrl+C`, so it is always the last line in `Program.cs`.

::: info Technical detail
The `Server: Kestrel` response header tells you that **Kestrel** handled the request. It is ASP.NET Core’s built-in cross-platform web server, provided by the ASP.NET Core shared framework and running inside the application process. You don’t need to start a separate web-server process.
:::

If you want to practice diagnosing compile errors and using hot reload, read the [optional appendix: Development Tools Practice](./development-tools). It isn’t needed to understand endpoints in this chapter.

## Summary

- `dotnet new web` creates a minimal Web project, with the entire application in `Program.cs`.
- Startup code uses `builder` to prepare services and then `app` to register endpoints. Register services before `Build()`.
- **Endpoint** = HTTP method + route template + handler. `app.MapGet("/", () => ...)` defines a GET endpoint. Returned objects are serialized to JSON automatically, with property names converted to camelCase.
- `AddOpenApi` + `MapOpenApi` + `MapScalarApiReference` generate interactive documentation from the code. For security, enable it only in development.
- Start the service with `dotnet run`, verify the response with curl, and stop it with `Ctrl+C`.

Next: [Path Parameters](./path-params)—use part of a URL as a handler parameter. Previous: [C# Tour](./csharp-tour).
