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
        db.Categories.AddRange(
            new Category { Name = "Work", Todos = [new Todo { Title = "Write report" }, new Todo { Title = "Review PR", Done = true }] },
            new Category { Name = "Life", Todos = [new Todo { Title = "Buy milk" }] });
        await db.SaveChangesAsync();
    }
}

app.MapGet("/todos", async (TodoDbContext db, int? categoryId, bool? done, int page = 1) =>
{
    var query = db.Todos.AsNoTracking();
    if (categoryId is not null) query = query.Where(t => t.CategoryId == categoryId);
    if (done is not null) query = query.Where(t => t.Done == done);
    var currentPage = Math.Clamp(page, 1, 10000);
    return await query.OrderBy(t => t.Id).Skip((currentPage - 1) * 2).Take(2)
        .Select(t => new { t.Id, t.Title, t.Done, Category = t.Category.Name })
        .ToListAsync();
});

app.MapGet("/categories/{id:int}", async Task<Results<Ok<CategoryResponse>, NotFound>> (int id, TodoDbContext db) =>
{
    var category = await db.Categories.AsNoTracking().Include(c => c.Todos)
        .SingleOrDefaultAsync(c => c.Id == id);
    if (category is null) return TypedResults.NotFound();
    return TypedResults.Ok(new CategoryResponse(category.Id, category.Name,
        category.Todos.OrderBy(t => t.Id).Select(t => new TodoSummary(t.Id, t.Title, t.Done)).ToList()));
});

app.Run();
