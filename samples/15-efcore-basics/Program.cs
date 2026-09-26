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
}

app.MapGet("/todos", async (TodoDbContext db) =>
    await db.Todos.AsNoTracking().OrderBy(t => t.Id).ToListAsync());

app.MapGet("/todos/{id:int}", async Task<Results<Ok<Todo>, NotFound>> (int id, TodoDbContext db) =>
{
    var todo = await db.Todos.FindAsync(id);
    return todo is null ? TypedResults.NotFound() : TypedResults.Ok(todo);
});

app.MapPost("/todos", async Task<Created<Todo>> (CreateTodo input, TodoDbContext db) =>
{
    var todo = new Todo { Title = input.Title };
    db.Todos.Add(todo);
    await db.SaveChangesAsync();
    return TypedResults.Created($"/todos/{todo.Id}", todo);
});

app.Run();
