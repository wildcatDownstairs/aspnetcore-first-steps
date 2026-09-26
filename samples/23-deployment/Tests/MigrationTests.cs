using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

public class MigrationTests
{
    [Fact]
    public async Task Adding_note_keeps_existing_rows()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync(ct);
        await using var db = new TodoDbContext(new DbContextOptionsBuilder<TodoDbContext>()
            .UseSqlite(connection).Options);
        var migrator = db.GetService<IMigrator>();

        await migrator.MigrateAsync("InitialCreate", ct);
        var title = "Created before upgrade";
        await db.Database.ExecuteSqlAsync(
            $"INSERT INTO Todos (Title, Done, CategoryId) VALUES ({title}, {false}, {1})", ct);

        await migrator.MigrateAsync(cancellationToken: ct);
        var todo = await db.Todos.SingleAsync(ct);
        Assert.Equal(title, todo.Title);
        Assert.Null(todo.Note);
        Assert.Equal(2, await db.Categories.CountAsync(ct));

        todo.Note = "Added after upgrade";
        await db.SaveChangesAsync(ct);
        await migrator.MigrateAsync(cancellationToken: ct);
        Assert.Single(await db.Todos.AsNoTracking().ToListAsync(ct));
        Assert.Equal("Added after upgrade", await db.Todos.Select(t => t.Note).SingleAsync(ct));
    }
}
