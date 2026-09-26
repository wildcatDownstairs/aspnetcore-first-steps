---
title: FastAPI ↔ ASP.NET Core Comparison Cheat Sheet
description: A concept comparison for developers familiar with FastAPI, helping you find the equivalent approach in ASP.NET Core Minimal APIs.
prev: false
next: false
pageClass: page-cheatsheet
---

# FastAPI ↔ ASP.NET Core Comparison Cheat Sheet

If you have used FastAPI, many ideas in ASP.NET Core Minimal APIs will feel familiar: define endpoints with functions, declare parameters with types, and generate OpenAPI documentation automatically. This table helps translate what you already know.

::: warning Note
These comparisons are analogies to help you understand the concepts; they do not mean the two frameworks behave identically. Rows with larger differences are marked. See the linked chapter for details.
:::

## Projects and tools

| FastAPI / Python | ASP.NET Core / .NET | Explanation | Chapter |
| --- | --- | --- | --- |
| `python` + `pip` + `venv` | `dotnet` CLI | One tool handles running, dependency management, and building; no virtual environment is needed | [Environment setup](/en/tutorial/setup) |
| `pyproject.toml` | `.csproj` project file | Declares the target framework and package dependencies | [Environment setup](/en/tutorial/setup) |
| PyPI | NuGet | Package repository | [Environment setup](/en/tutorial/setup) |
| `pip install xxx` | `dotnet add package Xxx` | Add a dependency | [First steps](/en/tutorial/first-steps) |
| uvicorn | Kestrel | Web server; Kestrel is built into the program and does not need to be started separately | [First steps](/en/tutorial/first-steps) |
| `fastapi dev` / `uvicorn --reload` | `dotnet watch` | Automatically reload during development; changes that support Hot Reload can be applied without restarting the process | [Development tools practice](/en/tutorial/development-tools) |

## Defining endpoints

| FastAPI / Python | ASP.NET Core / .NET | Explanation | Chapter |
| --- | --- | --- | --- |
| `app = FastAPI()` | `builder` + `app = builder.Build()` | .NET separates service registration from request handling | [First steps](/en/tutorial/first-steps) |
| `@app.get("/")` | `app.MapGet("/", ...)` | Register endpoints by calling a method rather than using a decorator | [First steps](/en/tutorial/first-steps) |
| Return a `dict` | Return an anonymous type `new { ... }` or a `record` | Automatically serialized as JSON, with property names converted to camelCase | [First steps](/en/tutorial/first-steps) |
| `/docs` | `/scalar` (`Scalar.AspNetCore`) | Interactive docs; in .NET, generation and display are handled by separate packages | [First steps](/en/tutorial/first-steps) |
| `/openapi.json` | `/openapi/v1.json` | OpenAPI document; .NET 10 generates OpenAPI 3.1 by default | [First steps](/en/tutorial/first-steps) |

## Request parameters

| FastAPI / Python | ASP.NET Core / .NET | Explanation | Chapter |
| --- | --- | --- | --- |
| `/items/{item_id}` + `item_id: int` | `/items/{id:int}` + `int id` | Binding by name and type conversion | [Route parameters](/en/tutorial/path-params) |
| Match routes in declaration order | Match routes by priority | **Difference**: in .NET, registration order does not affect the matching result | [Route parameters](/en/tutorial/path-params) |
| `{file_path:path}` | `{*path}` | Match the remaining path, including `/` characters | [Route parameters](/en/tutorial/path-params) |
| Query parameter `q: str \| None = None` | `string? q` | A nullable type represents an optional parameter | [Query parameters](/en/tutorial/query-params) |
| Pydantic model as request body | `record` as request body | JSON is bound automatically to a strongly typed object | [Request body](/en/tutorial/request-body) |
| Validation such as `Field(ge=1)` | Data annotations + built-in .NET 10 validation | | [Validation](/en/tutorial/validation) |
| `Header()` / `Cookie()` | `[FromHeader]` / `HttpRequest.Cookies` | .NET has no `[FromCookie]` attribute; read cookies from the request object | [Headers and cookies](/en/tutorial/headers-cookies) |

## Responses and errors

| FastAPI / Python | ASP.NET Core / .NET | Explanation | Chapter |
| --- | --- | --- | --- |
| `response_model` | `TypedResults` and `Results<T1, T2>` | Typed results constrain handler return values and provide documentation metadata. They are not equivalent to Pydantic's runtime response validation and filtering. | [Response types](/en/tutorial/response-types) |
| `HTTPException` | `TypedResults.NotFound()`, ProblemDetails | | [Status codes and error handling](/en/tutorial/errors) |
| `APIRouter` | `app.MapGroup(...)` | Route groups and shared prefixes | [Route groups](/en/tutorial/route-groups) |

## Application structure

| FastAPI / Python | ASP.NET Core / .NET | Explanation | Chapter |
| --- | --- | --- | --- |
| `Depends()` | Dependency injection container `builder.Services` | .NET includes a full DI container with three service lifetimes | [Dependency injection](/en/tutorial/dependency-injection) |
| `pydantic-settings` | Configuration system + Options pattern | appsettings.json, environment variables, and User Secrets | [Configuration and Options](/en/tutorial/configuration) |
| `@app.middleware("http")` | `app.Use(...)` middleware | Pipeline model; order matters | [Middleware](/en/tutorial/middleware) |
| `logging` | `ILogger<T>` | Structured logging | [Logging](/en/tutorial/logging) |

## Data, security, and deployment

| FastAPI / Python | ASP.NET Core / .NET | Explanation | Chapter |
| --- | --- | --- | --- |
| SQLAlchemy / SQLModel | EF Core | ORM; `DbContext` tracks and saves entity changes | [EF Core basics](/en/tutorial/efcore-basics) |
| relationship / query expressions | Navigation properties, LINQ, `Include` | Distinguish relationship declarations, projections, and loading related objects | [Relationships and queries](/en/tutorial/relations-queries) |
| Modify an entity in a Session and commit | Tracked entity + `SaveChangesAsync()` | Keep input DTOs separate from database entities | [Complete CRUD](/en/tutorial/crud) |
| Alembic | EF Core migrations (`dotnet ef`) | Used for schema upgrades; chapter 23 uses migrations to manage changes | [Database migrations](/en/advanced/efcore-migrations) · [Official migrations docs](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/) |
| `OAuth2PasswordBearer` + JWT validation logic | `AddJwtBearer` + `RequireAuthorization()` | FastAPI credential extraction is not the same as JWT validation; generate a local token with `dotnet user-jwts` | [Authentication (JWT)](/en/tutorial/authentication) |
| `Security()` / check permissions in a dependency | Named policy + `RequireAuthorization()` | This example restricts writes to the editor role | [Authorization](/en/tutorial/authorization) |
| `CORSMiddleware` | `AddCors` + `UseCors` | Allows browser cross-origin requests; it does not replace authentication or authorization | [CORS](/en/tutorial/cors) |
| `TestClient` | `WebApplicationFactory` | Start the application in memory for integration tests | [Testing](/en/tutorial/testing) |

If you are familiar with SQL, see the [EF Core / LINQ ↔ PostgreSQL cheat sheet](./efcore-sql-cheatsheet) to compare queries, pagination, relationships, and data changes.
