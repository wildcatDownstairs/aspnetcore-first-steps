using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddValidation();
builder.Services.AddProblemDetails();
var connectionString = builder.Configuration.GetConnectionString("Todos")
    ?? throw new InvalidOperationException("Missing ConnectionStrings:Todos configuration.");
builder.Services.AddDbContext<TodoDbContext>(options => options.UseSqlite(connectionString));

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

// For standalone learning samples only; EnsureCreatedAsync does not update existing tables.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TodoDbContext>();
    await db.Database.EnsureCreatedAsync();
    if (!await db.Categories.AnyAsync())
    {
        db.Categories.AddRange(new Category { Name = "Work" }, new Category { Name = "Life" });
        await db.SaveChangesAsync();
    }
}

var todos = app.MapGroup("/todos").WithTags("Todos");

todos.MapGet("/", async (TodoDbContext db) =>
    await db.Todos.AsNoTracking().OrderBy(t => t.Id)
        .Select(t => new TodoResponse(t.Id, t.Title, t.Done, t.CategoryId)).ToListAsync());

todos.MapGet("/{id:int}", async Task<Results<Ok<TodoResponse>, NotFound>> (int id, TodoDbContext db) =>
{
    var todo = await db.Todos.FindAsync(id);
    return todo is null ? TypedResults.NotFound()
        : TypedResults.Ok(new TodoResponse(todo.Id, todo.Title, todo.Done, todo.CategoryId));
});

todos.MapPost("/", async Task<Results<Created<TodoResponse>, ProblemHttpResult>> (CreateTodo input, TodoDbContext db) =>
{
    if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId))
    {
        return TypedResults.Problem(statusCode: 400, title: "Category not found");
    }
    var todo = new Todo { Title = input.Title, CategoryId = input.CategoryId };
    db.Todos.Add(todo);
    await db.SaveChangesAsync();
    return TypedResults.Created($"/todos/{todo.Id}",
        new TodoResponse(todo.Id, todo.Title, todo.Done, todo.CategoryId));
}).ProducesProblem(400);

todos.MapPut("/{id:int}", async Task<Results<NoContent, NotFound, ProblemHttpResult>> (int id, ReplaceTodo input, TodoDbContext db) =>
{
    var todo = await db.Todos.FindAsync(id);
    if (todo is null) return TypedResults.NotFound();
    if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId))
    {
        return TypedResults.Problem(statusCode: 400, title: "Category not found");
    }
    todo.Title = input.Title;
    todo.Done = input.Done;
    todo.CategoryId = input.CategoryId;
    await db.SaveChangesAsync();
    return TypedResults.NoContent();
}).ProducesProblem(400);

todos.MapDelete("/{id:int}", async Task<Results<NoContent, NotFound>> (int id, TodoDbContext db) =>
{
    var todo = await db.Todos.FindAsync(id);
    if (todo is null) return TypedResults.NotFound();
    db.Todos.Remove(todo);
    await db.SaveChangesAsync();
    return TypedResults.NoContent();
});

app.Run();
