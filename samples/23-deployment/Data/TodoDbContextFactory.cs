using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TodoApi.Data;

// dotnet ef only needs a context; authentication and the HTTP service do not need to start.
public class TodoDbContextFactory : IDesignTimeDbContextFactory<TodoDbContext>
{
    public TodoDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder().SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json").AddEnvironmentVariables().AddCommandLine(args).Build();
        var connectionString = config.GetConnectionString("Todos")
            ?? throw new InvalidOperationException("Missing ConnectionStrings:Todos configuration.");
        return new TodoDbContext(new DbContextOptionsBuilder<TodoDbContext>()
            .UseSqlite(connectionString).Options);
    }
}
