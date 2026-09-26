---
title: Dependency Injection
description: Encapsulate data access in a service, register it with the container, and let the framework create and provide it when needed. Understand the Singleton, Scoped, and Transient lifetimes, and why a database context is Scoped.
---

# Dependency Injection

Earlier handlers read and wrote a list directly in `Program.cs`. In this chapter, we move the list and its read/write operations into `InMemoryTodoStore`, then let the framework pass that object to handlers.

Providing required objects from the outside is called **dependency injection (DI)**. Notice what the code no longer needs: handlers do not manage the list or create a store themselves. They only declare an `ITodoStore` parameter.

<<< @/../samples/11-dependency-injection/Program.cs{7-10,22,24,30-38,46-75 cs:line-numbers} [11-dependency-injection/Program.cs]

## Run and verify

Stop the service from the previous chapter, then run this from the repository root:

```bash
cd samples/11-dependency-injection
dotnet run
```

The Todo endpoints work just as before:

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'
```

```json
{"id":1,"title":"Buy milk","done":false}
```

```bash
curl http://localhost:5080/todos
```

```json
[{"id":1,"title":"Buy milk","done":false}]
```

There is also a `/lifetimes` demo endpoint. Call it twice:

```bash
curl http://localhost:5080/lifetimes
curl http://localhost:5080/lifetimes
```

```json
{"singleton":["91e834bc","91e834bc"],"scoped":["87edf2ac","87edf2ac"],"transient":["d4f30286","a151a3a5"]}
{"singleton":["91e834bc","91e834bc"],"scoped":["16f8e1fc","16f8e1fc"],"transient":["6e9ab485","c3b925ae"]}
```

Each identifier represents an object instance. Your identifiers will differ, but the pattern of **which ones match and which differ** will be the same. That pattern is the focus of the second half of this chapter.

## Turn data access into a service

<<< @/../samples/11-dependency-injection/Program.cs{46-75 cs:line-numbers} [11-dependency-injection/Program.cs]

Lines 46–50 define an **interface**, `ITodoStore`, which describes only what it can do: get all items and add one. `InMemoryTodoStore` on lines 52–75 is one **implementation**, using an in-memory list to perform those operations. By convention, interface names begin with a capital `I`.

In dependency injection, a class like this is called a **service**: an object that provides a capability to other parts of the application.

## Register a service

<<< @/../samples/11-dependency-injection/Program.cs{7 cs:line-numbers} [11-dependency-injection/Program.cs]

In “First Steps,” we described `builder.Services` as the list of components the application needs at runtime. Now you have added an item to that list. Line 7 means:

> When someone needs `ITodoStore`, provide an `InMemoryTodoStore`.

The component that manages this list and creates objects is called the **dependency injection container** (DI container). Methods such as `AddOpenApi()` do the same kind of work internally: they register several framework services at once.

## Use the service

<<< @/../samples/11-dependency-injection/Program.cs{22,24-28 cs:line-numbers} [11-dependency-injection/Program.cs]

The handler declares an `ITodoStore` parameter. It does not explicitly specify a binding source, but because this type is registered as a service, the framework retrieves an instance from the container and passes it in. It does not read it from the request body.

Service parameters are not part of the HTTP request, so they do not appear in the OpenAPI document. On the `/scalar` page, `GET /todos` still has no parameters.

If we used `new InMemoryTodoStore()` for every request, each one would get an empty list. By handing creation to the container, we can choose which requests share an object through its registration, without repeating that management in every handler.

`ITodoStore` also demonstrates another point: handlers call only the methods in the interface, so we can swap in a different implementation for tests. **Dependency injection does not require an interface for every class**; you can register a concrete class directly. Chapter 15 injects `TodoDbContext` directly so you can see the database operations without another storage interface layer.

::: fastapi FastAPI comparison
This is similar to FastAPI's `Depends(get_store)`: the handler declares the object it needs, and the framework provides it. Here, the container looks up the registered type. Whether requests share the same instance depends on the lifetime setting described below.
:::

::: warning Note
If you forget the registration on line 7, compilation succeeds, but the first `GET /todos` request returns a 500:

```text
System.InvalidOperationException: Body was inferred but the method does not allow inferred body parameters.
Below is the list of parameters that we found:

Parameter           | Source
---------------------------------------------------------------------------------
store               | Body (Inferred)


Did you mean to register the "Body (Inferred)" parameter(s) as a Service or apply the [FromServices] or [FromBody] attribute?
```

The framework does not recognize `ITodoStore`, so by default it treats this complex type as a request body. A GET request does not allow an inferred request body. The last line of the error gives the answer: register it as a service.
:::

## Three lifetimes

<<< @/../samples/11-dependency-injection/Program.cs{8-10,30-38,77-86 cs:line-numbers} [11-dependency-injection/Program.cs]

Lines 77–86 define three nearly identical marker classes. Each instance gets a random identifier when it is created. Lines 8–10 register them in three different ways, and the handler on lines 30–38 requests **two instances of each type** and returns their identifiers. Compare the results from the two requests above:

| Registration method | Lifetime | Two resolutions in one request | Across requests |
| --- | --- | --- | --- |
| `AddSingleton` | **Singleton** | Same instance | Same instance |
| `AddScoped` | **Scoped** | Same instance | Different instances |
| `AddTransient` | **Transient** | A new instance each time | A new instance each time |

- **Singleton**: In this example, all requests share one instance, so it can retain the in-memory list.
- **Scoped**: One instance per scope. In a typical HTTP request, the same instance is shared within that request, and separate requests get separate instances.
- **Transient**: A new instance is created each time the container resolves it.

`ITodoStore` is registered as Singleton because its data must persist across requests. If it were Scoped, each request would get a new empty list, and a Todo created in one request would disappear by the next.

### A Singleton must be thread-safe

Multiple requests may be handled at the same time, and they receive the **same** Singleton instance. That is why `InMemoryTodoStore` uses `lock` to protect its list (lines 60 and 68): only one request at a time can enter, preventing two requests from modifying the list simultaneously and corrupting the data. This addresses the “not thread-safe” warning from the “Request Body” chapter.

Line 62 returns `_todos.ToList()`, a **copy** of the list rather than the list itself. Otherwise, a caller could read the list outside the lock while another request modifies it.

::: info Technical detail
`Lock` is a dedicated lock type introduced in .NET 9. In this example, the C# `lock` statement enters and exits the lock. It ensures only one thread at a time executes the protected code, without requiring you to call an unlock method yourself.
:::

## Why DbContext is Scoped

Chapter 15 introduces EF Core's `DbContext`, which tracks the objects read and changed during an operation. `AddDbContext` registers it as Scoped by default: code in the same request can share it, it is disposed when the request ends, and a new one is created for the next request.

It is not thread-safe and must not be shared as a Singleton across all requests. Scoped does not add a lock automatically: even within one request, do not use a context for multiple database operations at the same time. Keep this limitation in mind; Chapter 15 covers its use.

### Do not let a Singleton hold a request-scoped service

What would happen if the constructor of `InMemoryTodoStore` (a Singleton) required `ScopedMarker` (a Scoped service)?

The Singleton would keep holding the object it received when it was constructed, retaining a Scoped service that should have been separate for each request. If that service were a `DbContext`, multiple requests could also use it at the same time. This accidental extension of a dependency's lifetime is called a **captive dependency**.

In the development environment, the container checks for this kind of error at startup and the application fails to start:

```text
Unhandled exception. System.AggregateException: Some services are not able to be constructed (Error while validating the service descriptor 'ServiceType: ITodoStore Lifetime: Singleton ImplementationType: InMemoryTodoStore': Cannot consume scoped service 'ScopedMarker' from singleton 'ITodoStore'.)
```

The key point is “do not directly inject a Scoped service into a Singleton,” not “a longer-lived service can never depend on a shorter-lived one.” For example, a Singleton can receive a Transient service; it will simply keep the instance it received at construction time. It will not get a new one automatically for each request.

::: warning Note
Scope validation is enabled by default in development and disabled by default in production. An application starting successfully in production does not mean that the dependency relationship is sound. [Service scope validation](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview#scope-validation)
:::

## Summary

- **Dependency injection**: a handler declares the service it needs as a parameter, and the container creates and supplies it instead of the handler calling `new`.
- Register services with methods such as `builder.Services.AddSingleton<interface, implementation>()`. You can also register a concrete class directly; an interface is not required for every service.
- Registered service types are automatically recognized as container-provided parameters and do not appear in OpenAPI. If you forget to register one, it is treated as a request body and causes an error.
- The three lifetimes are **Singleton**, shared by the same container and required to be thread-safe; **Scoped**, one per scope; and **Transient**, newly created for each resolution.
- `AddDbContext` registers a database context as Scoped by default. Do not directly inject a Scoped service into a Singleton; development checks for this error.

Next: [Configuration and Options](./configuration)—separate changeable settings from code. Previous: [Route Groups](./route-groups).
