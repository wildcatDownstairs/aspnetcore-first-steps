using Microsoft.AspNetCore.Http.HttpResults;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

List<Todo> todos = [new(1, "Buy milk", false)];

app.MapGet("/todos/{id:int}", Results<Ok<Todo>, NotFound> (int id) =>
{
    var todo = todos.Find(t => t.Id == id);
    return todo is null ? TypedResults.NotFound() : TypedResults.Ok(todo);
});

app.MapPost("/todos/{id:int}/complete", Results<Ok<Todo>, NotFound, ProblemHttpResult> (int id) =>
{
    var index = todos.FindIndex(t => t.Id == id);
    if (index < 0)
    {
        return TypedResults.NotFound();
    }
    if (todos[index].Done)
    {
        return TypedResults.Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "Todo is already completed",
            detail: $"Todo with id {id} is already complete and cannot be completed again.");
    }
    todos[index] = todos[index] with { Done = true };
    return TypedResults.Ok(todos[index]);
}).ProducesProblem(StatusCodes.Status409Conflict);

app.MapGet("/crash", () =>
{
    throw new InvalidOperationException("Database connection string is not configured");
});

app.Run();

record Todo(int Id, string Title, bool Done);
