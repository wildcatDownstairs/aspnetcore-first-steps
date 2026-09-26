using Microsoft.AspNetCore.Mvc;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.MapGet("/whoami", (
    [FromHeader(Name = "User-Agent")] string userAgent,
    [FromHeader(Name = "X-Client-Version")] string? clientVersion) =>
    new { UserAgent = userAgent, ClientVersion = clientVersion ?? "未提供" });

app.MapPost("/preferences/theme/{theme}", (string theme, HttpResponse response) =>
{
    response.Cookies.Append("theme", theme, new CookieOptions
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Lax,
        MaxAge = TimeSpan.FromDays(30),
    });
    return new { Saved = theme };
});

app.MapGet("/preferences", (HttpRequest request) =>
    new { Theme = request.Cookies["theme"] ?? "light" });

app.Run();
