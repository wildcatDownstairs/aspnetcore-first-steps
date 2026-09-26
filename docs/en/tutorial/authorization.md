---
title: Authorization
description: Use named policies to distinguish Todo read and write permissions. Understand identity claims, role requirements, and the difference between 401 and 403.
---

# Authorization

In the previous chapter, everyone who authenticated could delete Todos. This chapter uses an **authorization policy** to define who can change data.

The rule is: **any authenticated user can read the shared Todos, but only a user with the editor role can create, update, or delete them.** The models, database operations, and error handling follow the previous chapter.

<<< @/../samples/19-authorization/Program.cs{15-18,47,71,86,95 cs:line-numbers} [19-authorization/Program.cs]

<<< @/../samples/19-authorization/Models.cs{cs:line-numbers} [19-authorization/Models.cs]

<<< @/../samples/19-authorization/TodoDbContext.cs{cs:line-numbers} [19-authorization/TodoDbContext.cs]

## Prepare two identities for the same project

Stop the previous chapter's service, then enter this chapter's project from the repository root:

```bash
cd samples/19-authorization
dotnet user-jwts create --name alice --valid-for 1h --output token
dotnet user-jwts create --name bob --role editor --valid-for 1h --output token
```

Copy the complete token from the output of each command: alice has no editor role, while bob does. This chapter has its own `UserSecretsId` and test signing key, so generate new tokens instead of reusing the previous chapter's.

```bash
dotnet run
```

In another terminal, where you will send requests, set these variables:

::: code-group

```powershell [PowerShell 7]
$READER_TOKEN = "paste-Alice-token-here"
$EDITOR_TOKEN = "paste-Bob-token-here"
```

```bash [Bash / zsh]
READER_TOKEN="paste-Alice-token-here"
EDITOR_TOKEN="paste-Bob-token-here"
```

:::

## Run and verify

Alice can read the list. The new `todos-19.db` is empty on its first run:

```bash
curl -H "Authorization: Bearer $READER_TOKEN" http://localhost:5080/todos
```

```json
[]
```

But she cannot create a Todo:

```bash
curl -i -X POST http://localhost:5080/todos -H "Authorization: Bearer $READER_TOKEN" -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

Response excerpt; `traceId` is dynamic:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.4","title":"Forbidden","status":403,"traceId":"request-trace-id"}
```

Replace the token with Bob's, leaving the rest of the request unchanged:

```bash
curl -i -X POST http://localhost:5080/todos -H "Authorization: Bearer $EDITOR_TOKEN" -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

This time the response is 201 with `Location: /todos/1` and this body:

```json
{"id":1,"title":"Write report","done":false,"categoryId":1}
```

Alice still cannot delete it, while Bob can:

```bash
curl -i -X DELETE http://localhost:5080/todos/1 -H "Authorization: Bearer $READER_TOKEN"
curl -i -X DELETE http://localhost:5080/todos/1 -H "Authorization: Bearer $EDITOR_TOKEN"
```

The responses are **403** and **204**, respectively. The second request deletes the Todo successfully and has no response body; the first request does not run the delete operation.

## Use one policy for all three write endpoints

Line 17 registers a policy named `CanWriteTodos`. It requires an authenticated identity and the **editor** role. In this JWT example, the role comes from a claim in a trusted token, not from a request body or an arbitrary HTTP header.

POST, PUT, and DELETE each call `RequireAuthorization("CanWriteTodos")`. The authorization system checks this policy before the handler runs. If write permissions need to change later, we can update one rule instead of changing three handlers separately.

New write endpoints must also have this policy applied; the framework does not automatically require the editor role just because an endpoint uses POST or PUT.

The group's `RequireAuthorization()` requirement is not replaced by the named policy on an individual endpoint. These requirements combine: every endpoint in the group requires authentication, and write endpoints add the editor role requirement.

## What 401 and 403 tell the client

| Request | Result | Reason |
| --- | --- | --- |
| No token, or an invalid token | 401 | No authenticated identity could be established to satisfy the requirement |
| Valid Alice token requests GET | 200 | Authentication succeeded and reading is allowed |
| Valid Alice token requests POST / PUT / DELETE | 403 | The identity is valid but does not satisfy the write policy |
| Valid Bob token makes a valid write | The relevant 201 or 204 | Both identity and permission requirements are satisfied |

**A 403 will not necessarily be fixed by signing in again.** If the identity provider has not granted this user the editor role, another token with the same permissions will still get 403. [Role-based authorization](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/roles?view=aspnetcore-10.0)

The role name must match the policy. This example uses lowercase `editor`. Roles should be issued by the identity provider based on user permissions; do not trust a `role` field submitted by the client.

## Role authorization does not check data ownership

An editor in this chapter can change any Todo in the shared list. To ensure users can change only their own Todos, the data must store an owner identifier, and a query or update must check it against the current user. A role check alone cannot do that.

::: warning Note
`--role editor` is a capability of the local test tool only. Production clients cannot issue roles for themselves. A user's permissions in an existing token also do not update automatically when they change; the identity provider must handle token expiration and revocation.
:::

::: fastapi FastAPI comparison
This is similar to wrapping a permission check in a reusable dependency and attaching it to operations that require write permission. ASP.NET Core's authorization system evaluates the named policy; the handler declares only the policy name.
:::

## Summary

- Authentication confirms identity; an authorization policy decides what that identity can do.
- `CanWriteTodos` defines the write permission in one place, and POST, PUT, and DELETE explicitly use it.
- Group-level and endpoint-level authorization requirements combine. GET still inherits the group's authentication requirement.
- A request that fails authentication gets 401; a valid identity without the required permission gets 403.
- Roles come from trusted identity claims. A role rule for a shared list does not check ownership of an individual resource.

Next: [CORS](./cors)—let a browser page on another origin call the API. Previous: [Authentication (JWT)](./authentication).
