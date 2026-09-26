using Microsoft.AspNetCore.Http.HttpResults;

namespace TodoApi.Features.Todos;

public static class TodoEndpoints
{
    public static void MapTodoEndpoints(this WebApplication app)
    {
        var todos = app.MapGroup("/todos").WithTags("Todos").RequireAuthorization();
        todos.MapGet("/", (TodoService service) => service.ListAsync());
        todos.MapGet("/{id:int}", GetAsync);
        todos.MapPost("/", CreateAsync).ProducesProblem(400).RequireAuthorization("CanWriteTodos");
        todos.MapPut("/{id:int}", ReplaceAsync).ProducesProblem(400).RequireAuthorization("CanWriteTodos");
        todos.MapDelete("/{id:int}", DeleteAsync).RequireAuthorization("CanWriteTodos");
    }

    private static async Task<Results<Ok<TodoResponse>, NotFound>> GetAsync(int id, TodoService service)
    {
        var todo = await service.FindAsync(id);
        return todo is null ? TypedResults.NotFound() : TypedResults.Ok(todo);
    }

    private static async Task<Results<Created<TodoResponse>, ProblemHttpResult>> CreateAsync(CreateTodo input, TodoService service)
    {
        var todo = await service.CreateAsync(input);
        return todo is null ? TypedResults.Problem(statusCode: 400, title: "Category not found")
            : TypedResults.Created($"/todos/{todo.Id}", todo);
    }

    private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> ReplaceAsync(int id, ReplaceTodo input, TodoService service) =>
        await service.ReplaceAsync(id, input) switch
        {
            ReplaceOutcome.Updated => TypedResults.NoContent(),
            ReplaceOutcome.TodoNotFound => TypedResults.NotFound(),
            _ => TypedResults.Problem(statusCode: 400, title: "Category not found")
        };

    private static async Task<Results<NoContent, NotFound>> DeleteAsync(int id, TodoService service) =>
        await service.DeleteAsync(id) ? TypedResults.NoContent() : TypedResults.NotFound();
}
