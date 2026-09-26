using System.Security.Claims;

namespace TodoApi.Features.Auth;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app) =>
        app.MapGet("/me", (ClaimsPrincipal user) => new { Name = user.Identity?.Name })
            .RequireAuthorization();
}
