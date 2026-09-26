using System.Text.Json;
using Microsoft.EntityFrameworkCore;

var postgresSql = args.Contains("--postgres-sql");
var options = new DbContextOptionsBuilder<TodoDbContext>();
if (postgresSql)
    options.UseNpgsql("Host=localhost;Database=translation_only");
else
    options.UseSqlite("Data Source=:memory:");

await using var db = new TodoDbContext(options.Options);
var categoryId = 1;
var query = db.Todos.AsNoTracking()
    .Where(t => t.CategoryId == categoryId && !t.Done)
    .OrderBy(t => t.Title).ThenBy(t => t.Id)
    .Skip(0).Take(2)
    .Select(t => new { t.Id, t.Title, Category = t.Category.Name });

// Translate queries only; do not connect to PostgreSQL or create tables.
if (postgresSql)
{
    Console.WriteLine(query.ToQueryString());
    return;
}

// The in-memory database disappears when the connection closes; each run starts with the same data.
await db.Database.OpenConnectionAsync();
await db.Database.EnsureCreatedAsync();
db.Categories.AddRange(new Category { Id = 1, Name = "Work" }, new Category { Id = 2, Name = "Life" });
db.Todos.AddRange(
    new Todo { Id = 1, Title = "Write report", CategoryId = 1 },
    new Todo { Id = 2, Title = "Review PR", Done = true, CategoryId = 1 },
    new Todo { Id = 3, Title = "Buy milk", CategoryId = 2 });
await db.SaveChangesAsync();
db.ChangeTracker.Clear();

Print("Filter and projection", await query.ToListAsync());
Print("Second page", await db.Todos.AsNoTracking().OrderBy(t => t.Id)
    .Skip(2).Take(2).Select(t => new { t.Id, t.Title }).ToListAsync());
Print("Incomplete count", await db.Todos.CountAsync(t => !t.Done));
Print("Any incomplete tasks?", await db.Todos.AnyAsync(t => !t.Done));
Print("First item", (await db.Todos.AsNoTracking().OrderBy(t => t.Id).FirstOrDefaultAsync())?.Id);
Print("Missing ID", (await db.Todos.AsNoTracking().SingleOrDefaultAsync(t => t.Id == 99))?.Id);

var category = await db.Categories.AsNoTracking().Include(c => c.Todos)
    .SingleAsync(c => c.Id == 1);
Print("Category and tasks", new { category.Name, Titles = category.Todos.OrderBy(t => t.Id).Select(t => t.Title) });

var todo = await db.Todos.FindAsync(1) ?? throw new InvalidOperationException("The initial todo is missing.");
todo.Done = true;
Print("Database Done before save", await db.Todos.Where(t => t.Id == 1).Select(t => t.Done).SingleAsync());
await db.SaveChangesAsync();
Print("Database Done after save", await db.Todos.Where(t => t.Id == 1).Select(t => t.Done).SingleAsync());

var created = new Todo { Title = "Learn EF Core", CategoryId = 2 };
db.Todos.Add(created);
Print("Count after Add", await db.Todos.CountAsync());
await db.SaveChangesAsync();
Print("New ID", created.Id);
Print("Count after save", await db.Todos.CountAsync());

db.Todos.Remove(created);
await db.SaveChangesAsync();
Print("Count after delete", await db.Todos.CountAsync());

static void Print<T>(string label, T value) =>
    Console.WriteLine($"{label}: {JsonSerializer.Serialize(value, JsonSerializerOptions.Web)}");
