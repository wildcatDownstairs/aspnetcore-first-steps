namespace TodoApi.Features.Auth;

public static class AuthConfiguration
{
    public static IServiceCollection AddTodoAuthentication(this IServiceCollection services)
    {
        services.AddAuthentication("Bearer").AddJwtBearer();
        services.AddAuthorization(options => options.AddPolicy("CanWriteTodos",
            policy => policy.RequireAuthenticatedUser().RequireRole("editor")));
        return services;
    }
}
