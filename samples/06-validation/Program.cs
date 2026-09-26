using System.ComponentModel.DataAnnotations;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddValidation();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

List<Todo> todos = [];
var nextId = 1;

app.MapGet("/todos", ([Range(1, 50)] int pageSize = 10) => todos.Take(pageSize));

app.MapPost("/todos", (CreateTodo input) =>
{
    var todo = new Todo(nextId++, input.Title, input.Priority, Done: false);
    todos.Add(todo);
    return todo;
});

app.Run();

public record CreateTodo(
    [Required, StringLength(50)] string Title,
    [Range(1, 5)] int Priority);

record Todo(int Id, string Title, int Priority, bool Done);
