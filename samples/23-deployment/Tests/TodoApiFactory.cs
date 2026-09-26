using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

public sealed class TodoApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly SymmetricSecurityKey _key = new(RandomNumberGenerator.GetBytes(32));

    private readonly string _environment;
    public TodoApiFactory(string environment = "Development")
    {
        _environment = environment;
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(_environment);
        builder.UseSetting("Authentication:Schemes:Bearer:Authority", "https://test-issuer.invalid");
        builder.UseSetting("Authentication:Schemes:Bearer:Audience", "test-api");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<TodoDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<TodoDbContext>>();
            services.AddDbContext<TodoDbContext>(options => options.UseSqlite(_connection));
            services.PostConfigure<JwtBearerOptions>("Bearer", options =>
            {
                // Tests provide local metadata and a signing key; no external identity service is contacted.
                options.Configuration = new OpenIdConnectConfiguration { Issuer = "test-issuer" };
                options.Configuration.SigningKeys.Add(_key);
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = "test-issuer",
                    ValidateAudience = true,
                    ValidAudience = "test-api",
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = _key,
                    ClockSkew = TimeSpan.Zero
                };
            });
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<TodoDbContext>().Database.Migrate();
        return host;
    }

    public HttpClient CreateUserClient(bool editor = false)
    {
        var claims = new List<Claim> { new(ClaimTypes.Name, "test-user") };
        if (editor) claims.Add(new Claim(ClaimTypes.Role, "editor"));
        var token = new JwtSecurityToken("test-issuer", "test-api", claims,
            expires: DateTime.UtcNow.AddMinutes(5),
            signingCredentials: new SigningCredentials(_key, SecurityAlgorithms.HmacSha256));
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", new JwtSecurityTokenHandler().WriteToken(token));
        return client;
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await _connection.DisposeAsync();
    }
}
