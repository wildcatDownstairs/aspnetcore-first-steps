using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using TodoApi.Data;
using TodoApi.Features.Auth;
using TodoApi.Features.Todos;

var migrateOnly = args.Contains("--migrate");
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();
builder.Services.AddValidation();
builder.Services.AddProblemDetails();
var connectionString = builder.Configuration.GetConnectionString("Todos")
    ?? throw new InvalidOperationException("Missing ConnectionStrings:Todos configuration.");
builder.Services.AddDbContext<TodoDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddScoped<TodoService>();
builder.Services.AddTodoAuthentication(builder.Configuration, builder.Environment, migrateOnly);
builder.Services.AddCors(options => options.AddPolicy("LocalFrontend", policy =>
    policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
        .WithMethods("GET", "POST", "PUT", "DELETE")
        .WithHeaders("Authorization", "Content-Type")
        .WithExposedHeaders("Location")));

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseRouting();
app.UseCors("LocalFrontend");
app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

if (migrateOnly)
{
    await TodoDatabase.MigrateAsync(app.Services);
    Console.WriteLine("Database migration complete.");
    return;
}

app.MapGet("/health", () => TypedResults.Ok(new { Status = "ok" }));
app.MapAuthEndpoints();
app.MapTodoEndpoints();
app.Run();
