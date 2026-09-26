using Microsoft.AspNetCore.Http.HttpResults;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddSingleton<ITodoStore, InMemoryTodoStore>();
builder.Services.AddSingleton<SingletonMarker>();
builder.Services.AddScoped<ScopedMarker>();
builder.Services.AddTransient<TransientMarker>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

var todosApi = app.MapGroup("/todos").WithTags("待办事项");

todosApi.MapGet("/", (ITodoStore store) => store.GetAll());

todosApi.MapPost("/", Created<Todo> (CreateTodo input, ITodoStore store) =>
{
    var todo = store.Add(input.Title);
    return TypedResults.Created($"/todos/{todo.Id}", todo);
});

app.MapGet("/lifetimes", (
    SingletonMarker singleton1, SingletonMarker singleton2,
    ScopedMarker scoped1, ScopedMarker scoped2,
    TransientMarker transient1, TransientMarker transient2) => new
    {
        Singleton = new[] { singleton1.Id, singleton2.Id },
        Scoped = new[] { scoped1.Id, scoped2.Id },
        Transient = new[] { transient1.Id, transient2.Id },
    }).WithTags("演示");

app.Run();

record CreateTodo(string Title);

record Todo(int Id, string Title, bool Done);

interface ITodoStore
{
    IReadOnlyList<Todo> GetAll();
    Todo Add(string title);
}

class InMemoryTodoStore : ITodoStore
{
    private readonly List<Todo> _todos = [];
    private readonly Lock _lock = new();
    private int _nextId = 1;

    public IReadOnlyList<Todo> GetAll()
    {
        lock (_lock)
        {
            return _todos.ToList();
        }
    }

    public Todo Add(string title)
    {
        lock (_lock)
        {
            var todo = new Todo(_nextId++, title, Done: false);
            _todos.Add(todo);
            return todo;
        }
    }
}

abstract class Marker
{
    public string Id { get; } = Guid.NewGuid().ToString()[..8];
}

class SingletonMarker : Marker;

class ScopedMarker : Marker;

class TransientMarker : Marker;
