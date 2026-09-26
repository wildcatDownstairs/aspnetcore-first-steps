---
title: Authentication (JWT)
description: Authenticate callers with JWT Bearer tokens. Create local test tokens with dotnet user-jwts and distinguish token validation, reading an identity, and protecting an endpoint.
---

# Authentication (JWT)

In the previous chapter, anyone could change Todos. This chapter adds **authentication**: validate the caller's credentials, establish their identity, and require callers to authenticate before accessing Todo endpoints.

This example adds JWT Bearer authentication to the code from Chapter 17. The models and context are unchanged and are included with this chapter's project so it can run independently:

<<< @/../samples/18-authentication/Program.cs{1,14-15,21-22,42-44 cs:line-numbers} [18-authentication/Program.cs]

<<< @/../samples/18-authentication/Models.cs{cs:line-numbers} [18-authentication/Models.cs]

<<< @/../samples/18-authentication/TodoDbContext.cs{cs:line-numbers} [18-authentication/TodoDbContext.cs]

## Prepare a local test token

A **JWT** (JSON Web Token) is a token format. In this example, a client submits it in `Authorization: Bearer <token>`. “Bearer” means that whoever holds the credential can use it, so do not put a token in a URL or a log.

We will use the SDK's `dotnet user-jwts` tool to generate a development token and have the API validate it. This lets us learn how to protect endpoints before getting into sign-in and user registration.

Stop the previous chapter's service, then run these commands from the repository root:

```bash
cd samples/18-authentication
dotnet user-jwts create --name alice --valid-for 1h --output token
```

The terminal prints a token with three dot-separated parts. Each generated token differs, so copy the complete value for the next step.

The project declares both the package for validating tokens and a `UserSecretsId` for the development tool:

<<< @/../samples/18-authentication/Authentication.csproj{6,12 xml:line-numbers} [18-authentication/Authentication.csproj]

`user-jwts` stores a test signing key in the local user's configuration directory and updates the development environment's Bearer settings. This example listens only on `http://localhost:5080`, matching this configuration:

<<< @/../samples/18-authentication/appsettings.Development.json{2-11 json:line-numbers} [18-authentication/appsettings.Development.json]

`ValidIssuer` is an accepted **issuer**, and `ValidAudiences` are accepted **audiences**, or API identifiers that the token is intended for. The configuration and test key are read through `AddJwtBearer()`'s configuration mechanism; the source code does not contain a fixed signing key. [Local JWT tool documentation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/jwt-authn?view=aspnetcore-10.0)

::: warning Note
Use these tokens and the signing key only for local development. User Secrets are not encrypted, and they must not be committed to the repository. See [Chapter 12](./configuration). For deployment, use a trusted identity provider, configure token validation according to its documentation, and send tokens over HTTPS.
:::

## Run and verify

Start the API in the project directory you just entered:

```bash
dotnet run
```

Open another terminal and make a request without a token:

```bash
curl -i http://localhost:5080/todos
```

Response excerpt; `traceId` represents a dynamic value for this request:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.2","title":"Unauthorized","status":401,"traceId":"request-trace-id"}
```

In the terminal where you will send requests, put the complete token you copied into a variable. Choose the command for your shell:

::: code-group

```powershell [PowerShell 7]
$TOKEN = "paste-the-complete-token-here"
```

```bash [Bash / zsh]
TOKEN="paste-the-complete-token-here"
```

:::

Add the header, then request the current user and the list:

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5080/me
```

```json
{"name":"alice"}
```

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5080/todos
```

The new database `todos-18.db` starts with no Todos, so the response is `[]`. Create one:

```bash
curl -i -X POST http://localhost:5080/todos -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

The response is 201 with `Location: /todos/1` and this JSON body:

```json
{"id":1,"title":"Write report","done":false,"categoryId":1}
```

Replace the token in the request header with `not-a-valid-token` and request `/todos` again; the result is 401. When a token is invalid, the handler does not run and no data is written to the database.

## Registering authentication does not automatically protect every endpoint

These settings each have a separate responsibility:

| Setting | Responsibility |
| --- | --- |
| `AddAuthentication("Bearer").AddJwtBearer()` | Register the default Bearer authentication scheme and the JWT validation handler |
| `UseAuthentication()` | Validate the request's token and establish a user identity on success |
| `AddAuthorization()` / `UseAuthorization()` | Register and apply access rules; in this chapter, only authentication is required |
| `RequireAuthorization()` | Add a requirement to an endpoint or group that it must be authenticated |

**Why configure these separately?** Authentication answers “are these credentials valid, and who do they represent?” An endpoint's access rule answers “is an identity required here?” Registering JWT services alone and adding no protection requirement to an endpoint does not make every API private.

This example applies the requirement to the whole `/todos` group, protecting all CRUD endpoints, and adds the same requirement to `/me` individually. `UseAuthentication()` comes before `UseAuthorization()` so the identity is established before the rule is checked. Documentation endpoints remain available only in development.

## How the server decides whether a token is valid

The JWT payload in this example is not encrypted. Being able to read the username in it does not prove the token is authentic. The server must validate the signature, issuer, audience, and expiration; it cannot simply Base64-decode the token and trust it.

A modified token, an incorrect issuer, or an incorrect audience will fail validation. Expiration checks allow some clock skew, so there may be a short grace period after a token expires. [JWT Bearer validation guidance](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0)

`ClaimsPrincipal` is the user object established after validation. Its **claims** are key-value information describing the identity. The username generated by the local tool is mapped by default, so it can be read through `user.Identity?.Name`. Other identity providers may use different claim names and mapping rules; do not assume that every JWT has the same username field.

## This chapter does not distinguish permissions yet

Anyone with a valid token can currently read and write the same Todo list. The next chapter will distinguish “readers” from “editors.” Isolating Todos by user also requires a separate check of data ownership.

::: fastapi FastAPI comparison
FastAPI's `HTTPBearer` or `OAuth2PasswordBearer` can extract a Bearer credential from a request, but token validation logic is still needed. Here, `AddJwtBearer` validates tokens, and `RequireAuthorization` requires endpoints to pass access checks.
:::

## Summary

- JWT Bearer authentication validates a token and establishes an identity; do not trust a token just because its payload can be decoded.
- `dotnet user-jwts` provides local test tokens only. Use a trusted identity provider in production and send tokens over HTTPS.
- Registering authentication does not protect endpoints by itself. An endpoint or group must also declare `RequireAuthorization()`.
- A missing token or a token that fails validation gets a 401 when requesting a protected endpoint.
- `ClaimsPrincipal` provides the validated identity. The next chapter's authorization rules determine whether it can change data.

Next: [Authorization](./authorization)—a valid identity does not always have permission to write. Previous: [Complete CRUD](./crud).
