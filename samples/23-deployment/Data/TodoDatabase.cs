using Microsoft.EntityFrameworkCore;

namespace TodoApi.Data;

public static class TodoDatabase
{
    // Run once during deployment; normal API startup does not change the database schema.
    public static async Task MigrateAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TodoDbContext>();
        await db.Database.MigrateAsync();
    }
}
