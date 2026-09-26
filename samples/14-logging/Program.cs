using Microsoft.AspNetCore.Http.HttpResults;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddSingleton<ITodoStore, InMemoryTodoStore>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

var todosApi = app.MapGroup("/todos").WithTags("待办事项");

todosApi.MapGet("/{id:int}", Results<Ok<Todo>, NotFound> (int id, ITodoStore store, ILogger<Program> logger) =>
{
    var todo = store.Find(id);
    if (todo is null)
    {
        logger.LogWarning("找不到待办事项 {TodoId}", id);
        return TypedResults.NotFound();
    }
    return TypedResults.Ok(todo);
});

todosApi.MapPost("/", Created<Todo> (CreateTodo input, ITodoStore store) =>
{
    var todo = store.Add(input.Title);
    return TypedResults.Created($"/todos/{todo.Id}", todo);
});

app.Run();

record CreateTodo(string Title);

record Todo(int Id, string Title, bool Done);

interface ITodoStore
{
    Todo? Find(int id);
    Todo Add(string title);
}

class InMemoryTodoStore(ILogger<InMemoryTodoStore> logger) : ITodoStore
{
    private readonly List<Todo> _todos = [];
    private readonly Lock _lock = new();
    private int _nextId = 1;

    public Todo? Find(int id)
    {
        lock (_lock)
        {
            logger.LogDebug("查找待办事项 {TodoId}，当前共 {Count} 项", id, _todos.Count);
            return _todos.Find(t => t.Id == id);
        }
    }

    public Todo Add(string title)
    {
        Todo todo;
        lock (_lock)
        {
            todo = new Todo(_nextId++, title, Done: false);
            _todos.Add(todo);
        }
        logger.LogInformation("已创建待办事项 {TodoId}，标题：{Title}", todo.Id, todo.Title);
        return todo;
    }
}
