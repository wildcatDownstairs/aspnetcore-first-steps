using Microsoft.AspNetCore.Http.HttpResults;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

List<Todo> todos = [new(1, "Buy milk", false)];
var nextId = 2;

app.MapGet("/todos/{id:int}", Results<Ok<Todo>, NotFound> (int id) =>
{
    var todo = todos.Find(t => t.Id == id);
    return todo is null ? TypedResults.NotFound() : TypedResults.Ok(todo);
});

app.MapPost("/todos", Created<Todo> (CreateTodo input) =>
{
    var todo = new Todo(nextId++, input.Title, Done: false);
    todos.Add(todo);
    return TypedResults.Created($"/todos/{todo.Id}", todo);
});

app.MapDelete("/todos/{id:int}", Results<NoContent, NotFound> (int id) =>
    todos.RemoveAll(t => t.Id == id) > 0 ? TypedResults.NoContent() : TypedResults.NotFound());

app.Run();

record CreateTodo(string Title);

record Todo(int Id, string Title, bool Done);
