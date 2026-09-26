using System.Diagnostics;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

// Middleware 1: Log when a request enters and leaves
app.Use(async (context, next) =>
{
    Console.WriteLine($"→ [1] Enter: {context.Request.Method} {context.Request.Path}");
    await next(context);
    Console.WriteLine($"← [1] Leave: {context.Response.StatusCode}");
});

// Middleware 2: Add elapsed time to the response header
app.Use(async (context, next) =>
{
    var stopwatch = Stopwatch.StartNew();
    context.Response.OnStarting(() =>
    {
        context.Response.Headers["X-Elapsed-Ms"] = stopwatch.ElapsedMilliseconds.ToString();
        return Task.CompletedTask;
    });
    Console.WriteLine("→ [2] Enter: start timing");
    await next(context);
    Console.WriteLine("← [2] Leave");
});

// Middleware 3: In maintenance mode, return 503 without calling the next step
app.Use(async (context, next) =>
{
    if (context.Request.Query.ContainsKey("maintenance"))
    {
        Console.WriteLine("■ [3] Maintenance mode; request intercepted");
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        return;
    }
    await next(context);
});

app.MapGet("/hello", () =>
{
    Console.WriteLine("● Endpoint: handling request");
    return new { Message = "Hello" };
});

app.Run();
