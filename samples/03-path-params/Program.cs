using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.MapGet("/users/{id:int}", (int id) => new { Id = id, Name = $"用户 {id}" });

app.MapGet("/users/me", () => new { Id = 0, Name = "当前登录用户" });

app.MapGet("/files/{*path}", (string path) => new { Path = path });

app.Run();
