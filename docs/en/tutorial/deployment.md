---
title: Publishing and deployment
description: Publish the Todo API with the .NET SDK, configure production with Docker Compose, apply database migrations, and persist SQLite data.
---

# Publishing and deployment

This chapter turns the Todo API from Chapter 22 into a program that can run on another machine. The central question is: **after publishing the code, where do configuration and data live?** The image carries the program, environment variables provide configuration, and a data volume stores the database.

Start with the complete entry point. The endpoints and feature-based directories carry over from the previous chapter; the additions are a separate migration command and a liveness check:

<<< @/../samples/23-deployment/Program.cs{7,16,36-43 cs:line-numbers} [Program.cs]

:::: details Publishing configuration and database initialization
::: code-group

<<< @/../samples/23-deployment/Deployment.csproj{xml:line-numbers} [Deployment.csproj]

<<< @/../samples/23-deployment/Features/Auth/AuthConfiguration.cs{8-15 cs:line-numbers} [Features/Auth/AuthConfiguration.cs]

<<< @/../samples/23-deployment/Data/TodoDatabase.cs{cs:line-numbers} [Data/TodoDatabase.cs]

<<< @/../samples/23-deployment/Data/TodoDbContext.cs{cs:line-numbers} [Data/TodoDbContext.cs]

:::
::::

## Run it locally first

Run from the repository root:

```bash
cd samples/23-deployment
dotnet run -- --migrate
dotnet user-jwts create --name alice --role editor
dotnet run
```

The first run command applies migrations and exits. Its final line is `Database migration complete.`. The development token created next is for local debugging, and the service is still at `http://localhost:5080`.

Open another terminal:

```bash
curl http://localhost:5080/health
```

```json
{"status":"ok"}
```

`/health` only confirms that the process can respond to HTTP; **it does not check the database or identity service**. To check those dependencies, you can also use ASP.NET Core health checks.

::: warning Use this chapter's own database
This chapter starts with a new `todos-23.db` and uses migrations to create its tables. Do not run migrations directly against databases created with `EnsureCreated` in Chapters 15–22; these two table-creation approaches cannot be mixed directly. If you need to upgrade existing data, first read [Database migrations](../advanced/efcore-migrations).
:::

## Publish the app and create an image

**Publishing** gathers the assemblies and configuration needed to run the application. A **container image** also includes the runtime and operating system base files. Containers start from images; data is stored separately.

For a regular publish, run:

```bash
dotnet publish -c Release -o ./publish
```

On a machine with the appropriate ASP.NET Core runtime installed, you can start `Deployment.dll` in the output directory with `dotnet Deployment.dll`. The published output does not automatically use the development settings in `launchSettings.json`; provide the authentication configuration below before running it in production.

This chapter uses the .NET SDK to create a Linux x64 image directly, without maintaining a separate Dockerfile:

```bash
dotnet publish -c Release --os linux --arch x64 /t:PublishContainer
```

By default, this command writes `todo-api:chapter23` to the local container runtime. The next steps require Docker to be running and use Linux containers. For an ARM64 target machine, change `x64` to `arm64` and run the image on a matching machine.

The image is based on `mcr.microsoft.com/dotnet/aspnet:10.0`, and the app runs as a non-root user. The default user ID in this example is `1654`. The SDK can also push directly to a container registry or create an archive; see the [official container publishing documentation](https://learn.microsoft.com/en-us/dotnet/core/containers/sdk-publish).

## Configure production

Here is the complete Compose configuration. **Docker Compose** uses one file to describe the containers, environment variables, and data volumes to start:

<<< @/../samples/23-deployment/compose.yaml{yaml:line-numbers} [compose.yaml]

The three services each have a task: `init-data` prepares permissions on the data directory, `migrate` upgrades the database and exits, and `api` continues serving HTTP requests.

Copy the environment-variable template:

::: code-group

```powershell [PowerShell]
Copy-Item .env.example .env
```

```bash [Bash]
cp .env.example .env
```

:::

<<< @/../samples/23-deployment/.env.example{dotenv:line-numbers} [.env.example]

Replace the placeholder values in `.env` with your configuration:

| Setting | Value |
| --- | --- |
| `Authority` | HTTPS address of the trusted identity service. It must provide the metadata and public keys needed to validate JWTs. |
| `Audience` | The audience identifier configured for this API in the identity service. |
| `Cors__Origins__0` | The frontend origin allowed to read the API, such as `https://todo.example.com`, without a trailing `/`. |

Double underscores in environment variable names correspond to colons in configuration paths. Compose sets the database connection string separately to `/data/todos.db`, so it does not depend on the container's working directory.

::: warning Do not take development tokens to production
`dotnet user-jwts` is for local development. This chapter's production configuration trusts access tokens issued by an identity service. Obtain a token for this API from that service; write operations also require the service to identify the `editor` role. Role claims differ between services, so configure role mapping for the service's format.

Keeping the placeholder addresses in the template lets you check `/health` and confirm that anonymous requests get a 401, but it cannot authenticate a valid token. That does not mean the identity service is connected.
:::

If the production environment has no HTTPS `Authority` or no `Audience`, the example refuses to start and reports the missing configuration. This check only confirms that the settings are present; it does not prove the remote identity service is available.

## Create the database, then start the API

Run these commands from the `samples/23-deployment` directory:

```bash
docker compose run --rm init-data
docker compose run --rm migrate
docker compose up -d api
```

`init-data` runs as root only to change ownership of the data directory; both the migration and API run as a regular user. Start the API after the migration succeeds so requests do not reach tables that are still being upgraded.

The migration uses `MigrateAsync()` to apply pending changes; migrations already applied are not run again. The example in this repository includes two migrations: create the initial tables, then add a nullable `Note` column to Todo. The column demonstrates an upgrade and is not yet part of HTTP requests or responses. See [Database migrations](../advanced/efcore-migrations) for the migration files and upgrade verification.

Check the results:

```bash
curl http://localhost:5080/health
curl -i http://localhost:5080/todos
curl -i http://localhost:5080/openapi/v1.json
curl -i http://localhost:5080/scalar
```

| Request | Expected |
| --- | --- |
| `/health` | 200, with response body `{"status":"ok"}` |
| `/todos`, without a token | 401 |
| `/openapi/v1.json` | 404 |
| `/scalar` | 404 |

OpenAPI and Scalar are registered only in the Development environment. Production still uses the error-handling middleware and does not expose the developer exception page to callers.

## Keep data when the app is upgraded

Compose mounts the named `todo-data` volume at `/data`. When a container is replaced, the database stays in the volume and the new container continues using it.

Use an `editor` token issued by the identity service to call the create endpoint from the previous chapter, and note the returned task ID. Then recreate the container:

```bash
docker compose up -d --force-recreate api
```

Send another request to `/todos/{id}` with the token; the task should still be there. `docker compose down` stops and removes the containers but keeps named volumes by default. **Do not add `--volumes` or `-v` unless you intend to delete the data.**

Before upgrading the app, back up the database and publish the new image. Stop the API, run the migration, and finally recreate the API container. This example has a single API instance, so it will be briefly unavailable. An SQLite backup must cover a consistent data state: stop writes before making a copy or use SQLite's backup mechanism. Do not assume copying a single `.db` file while writes are in progress is a complete backup.

## From local verification to a public deployment

The port mapping is `127.0.0.1:5080:8080`, which only allows access from the host machine. Put the image and Compose configuration on a server with Docker, configure a domain and HTTPS in a reverse proxy on that server, and forward requests to `127.0.0.1:5080`. Add the frontend's actual origin to the CORS configuration too.

If the proxy changes the request scheme, host name, or client address, configure trusted proxies in the app as described in the [proxy and forwarded headers documentation](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0). Do not unconditionally trust forwarded headers from the public internet.

GitHub Pages hosts the static website generated for this tutorial; it cannot run the ASP.NET Core API. The API needs a host that can run .NET or containers.

To investigate startup problems, use:

```bash
docker compose ps
docker compose logs --tail 100 api
docker compose logs --tail 100 migrate
```

| Symptom | Check first |
| --- | --- |
| API reports missing authentication configuration on startup | Does `.env` exist, and are Authority and Audience set? |
| SQLite cannot open the file or reports read-only access | Check the volume mount path and whether `init-data` succeeded. |
| Still getting 401 with a token | Check the issuer, audience, signature, expiry, and identity-service metadata. |
| Reads work, but writes return 403 | Can the token's role be mapped to `editor`? |

## Automatically verify behavior before publishing

```bash
dotnet test --project Tests/TodoApi.Tests.csproj -c Release -p:TreatWarningsAsErrors=true
```

This chapter has 13 test cases: the previous chapter's 11 plus production behavior and a migration test that preserves existing data. CI also creates the image, starts Compose, recreates the container, and confirms that database records have not been lost.

::: fastapi FastAPI comparison
This is similar to putting a FastAPI app in a container: the program is in the image, environment configuration is outside it, and persistent data lives in a volume. The container does not configure authentication or apply database migrations for you.
:::

## Summary

- Published output carries the program, and environment variables provide production settings; development launch settings do not automatically apply in production.
- The .NET SDK can create a container image directly, and the app runs as a regular user.
- Apply database migrations before starting the API, and back up real data before an upgrade.
- The SQLite file lives in a data volume and remains after the container is recreated.
- A successful liveness check is only the first step; also verify authentication, authorization, data persistence, and public HTTPS.

Previous: [Organizing a project by feature](./project-structure). The main path ends here; next, read [Advanced topics](../advanced/) as needed.
