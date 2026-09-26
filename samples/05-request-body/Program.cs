using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

List<Todo> todos = [];
var nextId = 1;

app.MapGet("/todos", () => todos);

app.MapPost("/todos", (CreateTodo input) =>
{
    var todo = new Todo(nextId++, input.Title, input.Priority, Done: false);
    todos.Add(todo);
    return todo;
});

app.Run();

record CreateTodo(string Title, int Priority);

record Todo(int Id, string Title, int Priority, bool Done);
