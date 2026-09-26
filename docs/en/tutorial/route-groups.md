---
title: Route Groups
description: 'Use MapGroup to organize endpoints that share a route prefix and apply metadata such as OpenAPI tags to the whole group.'
---

# Route Groups

As you add endpoints, you’ll find repeated patterns: the same kind of endpoints start with `/api/todos`, may all require authentication later, and should appear together in the documentation. The new concept in this section is a **route group**, which lets you define these shared features in one place.

<<< @/../samples/10-route-groups/Program.cs{19-23,25,31,38,41 cs:line-numbers} [10-route-groups/Program.cs]

This chapter uses the CRUD example from Chapter 08 to demonstrate route groups. For now, it leaves out validation from Chapter 06 and shared error handling from Chapter 09, so the change stays focused on **where** endpoints are registered. Those features work with `MapGroup` too; without them, the 404 response for a missing resource in this chapter still has no body.

## Run and verify

```bash
dotnet run
```

All Todo endpoints are now under `/api/todos`:

```bash
curl http://localhost:5080/api/todos
```

```json
[{"id":1,"title":"Buy milk","done":false}]
```

```bash
curl http://localhost:5080/api/todos/1
```

```json
{"id":1,"title":"Buy milk","done":false}
```

```bash
curl -i -X POST http://localhost:5080/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Write report"}'
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /api/todos/2

{"id":2,"title":"Write report","done":false}
```

The health-check endpoint is at `/api/health`:

```bash
curl http://localhost:5080/api/health
```

```json
{"status":"ok"}
```

The old `/todos` address no longer exists and returns `404`.

## Create a group with MapGroup

<<< @/../samples/10-route-groups/Program.cs{19,21,23,25 cs:line-numbers} [10-route-groups/Program.cs]

**Line 19**, `app.MapGroup("/api")`, creates a group. The `api` value represents “all routes beginning with `/api`.”

**Line 21** calls `MapGroup("/todos")` on `api` to create a **nested group** with the full prefix `/api/todos`.

Then `MapGet`, `MapPost`, and other methods on `todosApi` use **relative paths**:

| Registration | Actual route |
| --- | --- |
| `todosApi.MapGet("/", ...)` | `GET /api/todos` |
| `todosApi.MapGet("/{id:int}", ...)` | `GET /api/todos/{id}` |
| `todosApi.MapPost("/", ...)` | `POST /api/todos` |
| `todosApi.MapDelete("/{id:int}", ...)` | `DELETE /api/todos/{id}` |
| `api.MapGet("/health", ...)` | `GET /api/health` |

The group object works almost exactly like `app`; you can call `MapGet`, `MapPost`, and `MapGroup` on it. That’s what makes this useful: **you don’t need to learn a new API; you just call it on a different object.**

**Why not write the full path for each route?** The prefix is a **decision**, so it should appear only once. If one day the API needs to move to `/api/v2`, a route group means you change only line 19. If the prefix is repeated on each endpoint, you have to update each one and may miss one, leaving inconsistent URLs.

::: warning
Line 35’s `Created` address, `$"/api/todos/{todo.Id}"`, is still a manually written full path. The group does not add its prefix there automatically. Remember to update it too if you change the group prefix.
:::

## Add metadata to a group

<<< @/../samples/10-route-groups/Program.cs{21,41 cs:line-numbers} [10-route-groups/Program.cs]

A group is more than a route prefix. Line 21’s `.WithTags("Todos")` adds an OpenAPI **tag** to the group, and **all endpoints** in the group inherit it. Line 41 gives the health-check endpoint its own “System” tag.

Open `/scalar`. The endpoint list on the left is split into two groups by tag: four endpoints under “Todos” and one under “System.” In `/openapi/v1.json`, the four Todo endpoints each have `tags: ["Todos"]`, while `/api/health` has `tags: ["System"]`.

::: info Technical detail
Earlier chapters didn’t set tags, so Scalar used the project name (such as `FirstSteps`) as the default tag for all endpoints.
:::

Calls such as `WithTags` add **metadata** to an endpoint. They don’t change the handler’s logic; they attach a “tag” for other parts of the framework to read. Metadata added to a group applies to every endpoint in it, making groups a convenient place for shared configuration. Later chapters add other features to groups, such as:

- [Authorization](./authorization): `todosApi.RequireAuthorization()` requires authentication for every endpoint in the group.
- [CORS](./cors): enable cross-origin access for a group of endpoints.

**Configure once and it applies to the whole group**, including endpoints added later, so you don’t create a security hole by forgetting to configure one.

::: fastapi FastAPI comparison
`MapGroup` is similar to FastAPI’s `APIRouter(prefix="/todos", tags=["Todos"])`. FastAPI requires mounting a router later with `app.include_router()`. An ASP.NET Core group is already attached to the app when created with `app.MapGroup()`, and can be nested as on line 21.
:::

## Summary

- `app.MapGroup("/prefix")` creates a route group. Endpoints registered on it use **relative paths**, and the prefix is added automatically.
- Groups can be nested: `api.MapGroup("/todos")` has the prefix `/api/todos`.
- **Metadata** added to a group (such as `WithTags`) applies to all endpoints in it. You can also configure features such as authorization and CORS for a group.
- Shared prefixes and configuration are declared once and are easy to update. Manually written full paths, such as the `Created` address, still need to be updated separately.

This is the final chapter in the “Requests and Responses” stage. You can now write an API with complete parameters, validation, consistent responses, and a clear structure. The next stage, “Application Structure,” starts with [Dependency Injection](./dependency-injection) and replaces the in-memory list in our examples with real services. Previous: [Status Codes and Error Handling](./errors).
