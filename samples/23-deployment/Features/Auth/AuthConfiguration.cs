namespace TodoApi.Features.Auth;

public static class AuthConfiguration
{
    public static IServiceCollection AddTodoAuthentication(this IServiceCollection services,
        IConfiguration configuration, IHostEnvironment environment, bool migrateOnly)
    {
        if (!environment.IsDevelopment() && !migrateOnly)
        {
            var authority = configuration["Authentication:Schemes:Bearer:Authority"];
            var audience = configuration["Authentication:Schemes:Bearer:Audience"];
            if (!Uri.TryCreate(authority, UriKind.Absolute, out var uri) || uri.Scheme != "https"
                || string.IsNullOrWhiteSpace(audience))
                throw new InvalidOperationException("Production requires an HTTPS Authority and an Audience. Configure a trusted identity service.");
        }

        services.AddAuthentication("Bearer").AddJwtBearer();
        services.AddAuthorization(options => options.AddPolicy("CanWriteTodos",
            policy => policy.RequireAuthenticatedUser().RequireRole("editor")));
        return services;
    }
}
