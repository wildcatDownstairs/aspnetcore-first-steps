using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

List<Todo> todos =
[
    new(1, "Buy milk", false),
    new(2, "Write weekly report", true),
    new(3, "Clean the litter box", false),
    new(4, "Learn ASP.NET Core", false),
    new(5, "Schedule a checkup", true),
];

app.MapGet("/todos", (bool? done, int page = 1, int pageSize = 2) =>
{
    var result = done is null ? todos : todos.Where(t => t.Done == done);
    return result.Skip((page - 1) * pageSize).Take(pageSize);
});

app.MapGet("/todos/search", (string keyword) =>
    todos.Where(t => t.Title.Contains(keyword)));

app.MapGet("/todos/batch", (int[] id) =>
    todos.Where(t => id.Contains(t.Id)));

app.Run();

record Todo(int Id, string Title, bool Done);
