---
title: Testing
description: Turn manual checks of the Todo API into integration tests with xUnit and WebApplicationFactory, verifying responses, data, and access permissions.
---

# Testing

After each code change, manually sending a curl request makes it easy to miss an error path. This chapter turns “create a task, then read it back” into an **integration test**: one request passes through routing, validation, authentication, the handler, and SQLite before the test checks the result.

Start with the first complete test file. The API reuses Chapter 20; this chapter adds a `Tests` project:

<<< @/../samples/21-testing/Tests/CreateTodoTests.cs{6-19 cs:line-numbers} [Tests/CreateTodoTests.cs]

This file also needs the test factory and project configuration below. Both are included in the repository.

:::: details Complete test factory and project configuration
::: code-group

<<< @/../samples/21-testing/Tests/TodoApiFactory.cs{16-20,26-43 cs:line-numbers} [Tests/TodoApiFactory.cs]

<<< @/../samples/21-testing/Tests/TodoApi.Tests.csproj{10-15 xml:line-numbers} [Tests/TodoApi.Tests.csproj]

<<< @/../samples/21-testing/global.json{json:line-numbers} [global.json]

<<< @/../samples/21-testing/TestAccess.cs{cs:line-numbers} [TestAccess.cs]

<<< @/../samples/21-testing/Testing.csproj{xml:line-numbers} [Testing.csproj]

:::
::::

## Run and verify

Run from the repository root:

```bash
cd samples/21-testing
dotnet test --project Tests/TodoApi.Tests.csproj
```

You do not need to run `dotnet run` first or create a development JWT. The summary should look like this; elapsed time and full paths vary by machine. The CLI localizes this text according to its UI language; this example shows English:

```text
Test run summary: Passed!
  total: 11
  failed: 0
  succeeded: 11
  skipped: 0
```

The example uses the **xUnit** test framework and selects .NET 10's **Microsoft Testing Platform (MTP)** test runner in this chapter's `global.json`. That is why the command uses `--project` to select the test project; run it from this chapter's directory so the SDK finds that configuration. `v3` in the xUnit package name is a product-series name and does not have to match the package version. See [Getting started with xUnit](https://xunit.net/docs/getting-started/v3/getting-started).

## What does one test check?

`[Fact]` marks a test. Its method name describes the behavior under test: after creating a task successfully, you can read the saved data. The method has three steps:

1. Create the test application and obtain an `HttpClient` with the editor role.
2. Send a JSON request to `/todos`.
3. Use **assertions** to check the status code, Location, and task contents returned by a follow-up read.

`PostAsJsonAsync` serializes an object as JSON and sets the request's Content-Type. `GetFromJsonAsync<TodoResponse>` deserializes the response to the specified type. The test reuses the DTO introduced earlier instead of parsing a JSON string by hand.

Why check more than `201`? A handler might report success without saving the task, or return a Location with the wrong ID. Reading the task again confirms the address the client received actually works.

`TestContext.Current.CancellationToken` comes from the test runner and can cancel an unfinished HTTP operation when the test is cancelled. `using` and `await using` release the client, test application, and database connection when the test ends.

## What does WebApplicationFactory do?

`WebApplicationFactory<Program>` creates a test host. A test server handles requests from `HttpClient` without occupying the real port 5080. `Program` is the application entry point; the public declarations in `TestAccess.cs` let another project reference this type without adding an HTTP endpoint.

Despite `Mvc` in its name, `Microsoft.AspNetCore.Mvc.Testing` can also test Minimal APIs; it does not require controllers. See [ASP.NET Core integration tests](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0).

The test factory replaces two settings:

| Setting | Test behavior | Why |
| --- | --- | --- |
| Database | Each factory opens its own SQLite in-memory connection | Does not read or write the practice database file, and tests do not compete for IDs |
| JWT | Each factory creates a random signing key and a short-lived test token | Does not depend on local User Secrets or an external identity service |

The tests still use the real SQLite provider and JWT validation handler. They replace the database location and trusted issuer configuration without hardcoding “allow access.” The token-issuing code in the factory belongs only to the test project; it is not a login endpoint.

::: info Technical detail
An SQLite in-memory database disappears when its connection closes, so the factory opens the connection and closes it only after the test application is disposed. The old `DbContextOptions` and its configuration registration must also be removed to prevent two connection configurations from taking effect at once. Requests from the same factory share this test database; each test in this example creates its own factory and sends requests sequentially.
:::

## Check error paths too

Here is the complete file containing the remaining tests:

::: details Validation, authentication, role, update, and delete tests
<<< @/../samples/21-testing/Tests/TodoApiTests.cs{cs:line-numbers} [Tests/TodoApiTests.cs]
:::

`[Theory]` combined with `[InlineData]` runs the same test code with several inputs. There are two empty-title cases and three forbidden-write cases (POST, PUT, and DELETE), so the number of test methods differs from the number of test cases.

These tests check more than status codes:

- An empty title or missing category returns 400; the list remains empty.
- A nonexistent ID returns 404.
- A missing or invalid token returns 401.
- A regular reader trying to create, update, or delete gets 403; the original task and item count stay unchanged.
- After an editor updates a task, the test reads it again, deletes it, and queries again to confirm the save and the final 404.

## Intentionally break it once

In this chapter's `Program.cs`, temporarily remove `RequireAuthorization("CanWriteTodos")` from the end of the POST registration, while keeping the authorization requirement on the group. Then run the tests.

The POST case in `Reader_cannot_write` should fail: it expects `Forbidden` (403), but receives `Created` (201). This shows that a regular reader gained write permission. Restore the policy call; all 11 test cases should pass again.

This also gives us a check for Chapter 22's file split: the files can move while the behavior seen by the client stays the same.

::: warning Note
These are API integration tests. They do not verify browser CORS behavior, reverse proxies, TLS, or login flows with an external identity service. Check browser and deployment behavior in the corresponding environment.
:::

::: fastapi FastAPI comparison
This is similar to calling a FastAPI app with pytest and TestClient, then asserting the status code and JSON. Here, WebApplicationFactory creates the test app, and the test factory replaces the database and authentication settings.
:::

## Summary

- Integration tests send requests through multiple components working together, without manually starting the API.
- Use `[Fact]` for one case and `[Theory]` to check multiple inputs with the same code.
- Check response content and follow-up reads after success; after a rejected write, also confirm the data did not change.
- Each test uses its own database and test signing key, so results do not depend on test order.
- Run the tests before and after a refactor to catch response or permission changes early.

Next: [Organizing the project by feature](./project-structure)—keep code for a feature together. Previous: [CORS](./cors).
