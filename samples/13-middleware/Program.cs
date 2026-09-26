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

// 中间件 1：记录请求进入和离开
app.Use(async (context, next) =>
{
    Console.WriteLine($"→ [1] 进入：{context.Request.Method} {context.Request.Path}");
    await next(context);
    Console.WriteLine($"← [1] 离开：{context.Response.StatusCode}");
});

// 中间件 2：在响应头中写入处理耗时
app.Use(async (context, next) =>
{
    var stopwatch = Stopwatch.StartNew();
    context.Response.OnStarting(() =>
    {
        context.Response.Headers["X-Elapsed-Ms"] = stopwatch.ElapsedMilliseconds.ToString();
        return Task.CompletedTask;
    });
    Console.WriteLine("→ [2] 进入：开始计时");
    await next(context);
    Console.WriteLine("← [2] 离开");
});

// 中间件 3：维护模式，直接返回 503，不再往后传递
app.Use(async (context, next) =>
{
    if (context.Request.Query.ContainsKey("maintenance"))
    {
        Console.WriteLine("■ [3] 维护中，请求被拦截");
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        return;
    }
    await next(context);
});

app.MapGet("/hello", () =>
{
    Console.WriteLine("● 端点：处理请求");
    return new { Message = "你好" };
});

app.Run();
