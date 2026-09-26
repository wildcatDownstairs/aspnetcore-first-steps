using Microsoft.EntityFrameworkCore;
using TodoApi.Features.Todos;

namespace TodoApi.Data;

public static class TodoDatabase
{
    public static async Task InitializeAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TodoDbContext>();
        await db.Database.EnsureCreatedAsync();
        if (!await db.Categories.AnyAsync())
        {
            db.Categories.AddRange(new Category { Name = "Work" }, new Category { Name = "Life" });
            await db.SaveChangesAsync();
        }
    }
}
