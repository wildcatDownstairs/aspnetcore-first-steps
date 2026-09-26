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
            title: "待办事项已完成",
            detail: $"id 为 {id} 的待办事项已经是完成状态，不能重复完成。");
    }
    todos[index] = todos[index] with { Done = true };
    return TypedResults.Ok(todos[index]);
}).ProducesProblem(StatusCodes.Status409Conflict);

app.MapGet("/crash", () =>
{
    throw new InvalidOperationException("数据库连接字符串未配置");
});

app.Run();

record Todo(int Id, string Title, bool Done);
