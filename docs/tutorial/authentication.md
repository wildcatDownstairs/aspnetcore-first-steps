---
title: 认证（JWT）
description: 用 JWT Bearer 认证验证调用者身份，通过 dotnet user-jwts 创建本地测试令牌，区分令牌验证、身份读取和接口保护。
---

# 认证（JWT）

上一章任何人都可以修改 Todo。这一章加入**认证**（authentication）：验证调用者的凭据，确认身份，并要求访问 Todo 接口的人通过认证。

下面在第 17 章的代码上加入 JWT Bearer 认证。模型和上下文不变，仍附在本章项目中，方便独立运行：

<<< @/../samples/18-authentication/Program.cs{1,14-15,21-22,42-44 cs:line-numbers} [18-authentication/Program.cs]

<<< @/../samples/18-authentication/Models.cs{cs:line-numbers} [18-authentication/Models.cs]

<<< @/../samples/18-authentication/TodoDbContext.cs{cs:line-numbers} [18-authentication/TodoDbContext.cs]

## 准备本地测试令牌

**JWT**（JSON Web Token）是一种令牌格式。本例客户端通过 `Authorization: Bearer <令牌>` 提交它；Bearer 表示持有者可以使用这份凭据，因此不要把令牌放进 URL 或日志。

先用 SDK 自带的 `dotnet user-jwts` 生成开发令牌，再让 API 验证它。这样可以先学会保护接口，暂不涉及登录和用户注册。

先停止上一章服务，在仓库根目录执行：

```bash
cd samples/18-authentication
dotnet user-jwts create --name alice --valid-for 1h --output token
```

终端会输出三段以点分隔的令牌。每次生成的内容不同，请完整复制，下一步会用到。

项目已经声明验证令牌的包，以及供开发工具使用的 `UserSecretsId`：

<<< @/../samples/18-authentication/Authentication.csproj{6,12 xml:line-numbers} [18-authentication/Authentication.csproj]

`user-jwts` 会在本机用户配置目录保存测试签名密钥，并更新开发环境的 Bearer 配置。本例只监听 `http://localhost:5080`，对应的配置如下：

<<< @/../samples/18-authentication/appsettings.Development.json{2-11 json:line-numbers} [18-authentication/appsettings.Development.json]

`ValidIssuer` 是接受的**签发者**（issuer），`ValidAudiences` 是接受的**受众**（audience，即令牌面向的 API 标识）。配置和测试密钥由 `AddJwtBearer()` 的配置机制读取；源码里没有固定签名密钥。[本地 JWT 工具说明](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/jwt-authn?view=aspnetcore-10.0)

::: warning 注意
这些令牌和签名密钥只用于本地开发。User Secrets 不加密保存的内容，也不要把它提交到仓库，详见[第 12 章](./configuration)。上线时应接入可信身份服务，按其文档配置令牌验证，并通过 HTTPS 传输令牌。
:::

## 运行与验证

在刚才的项目目录启动 API：

```bash
dotnet run
```

另开终端，先不带令牌：

```bash
curl -i http://localhost:5080/todos
```

响应摘录，`traceId` 用占位文字表示本次请求的动态值：

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer
Content-Type: application/problem+json

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.2","title":"Unauthorized","status":401,"traceId":"本次请求的追踪编号"}
```

在这个发请求的终端里，把刚才复制的完整令牌放入变量。根据使用的 shell 选择一种：

::: code-group

```powershell [PowerShell 7]
$TOKEN = "粘贴刚才的完整令牌"
```

```bash [Bash / zsh]
TOKEN="粘贴刚才的完整令牌"
```

:::

带上请求头，再请求当前用户和列表：

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5080/me
```

```json
{"name":"alice"}
```

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5080/todos
```

本章的新数据库 `todos-18.db` 初始没有任务，所以得到 `[]`。再创建一个：

```bash
curl -i -X POST http://localhost:5080/todos -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"Write report","categoryId":1}'
```

响应是 201，`Location` 为 `/todos/1`，JSON 为：

```json
{"id":1,"title":"Write report","done":false,"categoryId":1}
```

把请求头里的令牌换成 `not-a-valid-token` 再请求 `/todos`，得到 401。令牌无效时，处理程序不会执行，更不会写入数据库。

## 注册认证，不等于自动保护所有端点

这几处配置各有职责：

| 配置 | 职责 |
| --- | --- |
| `AddAuthentication("Bearer").AddJwtBearer()` | 注册默认的 Bearer 认证方案和 JWT 验证处理器 |
| `UseAuthentication()` | 验证请求中的令牌，成功后建立用户身份 |
| `AddAuthorization()` / `UseAuthorization()` | 注册并执行访问规则；本章只要求已认证 |
| `RequireAuthorization()` | 将“必须通过认证”这个要求附加到端点或整个分组 |

**为什么要分别配置？**认证回答“凭据是否有效、对应谁”，端点的访问规则回答“这里是否需要身份”。只注册 JWT 服务，却不为端点添加保护要求，不会自动让所有接口变成私有。

本例将要求加在整个 `/todos` 分组上，CRUD 都受保护；`/me` 单独添加同样的要求。`UseAuthentication()` 放在 `UseAuthorization()` 前面，先建立身份，再检查规则。文档端点仍只在开发环境开放。

## 服务器怎样判断令牌有效

本例的 JWT 载荷不是加密数据：能读出其中的用户名，不代表它是真的。服务端要校验签名、签发者、受众和有效期，不能只做 Base64 解码就相信客户端。

令牌被篡改、签发者或受众不符，都会验证失败。过期检查还允许一定的时钟偏差，所以到期后可能有短暂宽限。[JWT Bearer 验证说明](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0)

`ClaimsPrincipal` 是验证后建立的用户对象，其中的**声明**（claim）是描述身份的键值信息。本地工具生成的用户名经过默认映射后，可以通过 `user.Identity?.Name` 读取。不同身份服务的声明名称和映射规则可能不同，不能假设所有 JWT 都有相同的用户名字段。

## 本章还没有细分权限

现在拥有有效令牌的人都能读写同一份 Todo 列表。下一章会区分“普通读者”和“编辑者”；按用户隔离任务还需要另外检查数据归属。

::: fastapi
FastAPI 的 `HTTPBearer` 或 `OAuth2PasswordBearer` 可以提取请求中的 Bearer 凭据，但仍需配合令牌验证逻辑。这里的 `AddJwtBearer` 负责验证，`RequireAuthorization` 负责要求端点通过访问检查。
:::

## 总结

- JWT Bearer 认证验证令牌并建立身份，不能只解码载荷就信任它。
- `dotnet user-jwts` 仅提供本地测试令牌；生产环境接入可信身份服务并使用 HTTPS。
- 注册认证服务不等于保护端点，端点或分组还要声明 `RequireAuthorization()`。
- 缺少或无法通过验证的令牌访问受保护端点时得到 401。
- `ClaimsPrincipal` 提供验证后的身份；是否能修改数据，要由下一章的授权规则决定。

下一章：[授权](./authorization)——有效身份也不一定有写入权限。上一章：[完整 CRUD](./crud)。
