using Microsoft.EntityFrameworkCore;
using TodoApi.Data;

namespace TodoApi.Features.Todos;

public class TodoService(TodoDbContext db)
{
    public Task<List<TodoResponse>> ListAsync() =>
        db.Todos.AsNoTracking().OrderBy(t => t.Id)
            .Select(t => new TodoResponse(t.Id, t.Title, t.Done, t.CategoryId)).ToListAsync();

    public Task<TodoResponse?> FindAsync(int id) =>
        db.Todos.AsNoTracking().Where(t => t.Id == id)
            .Select(t => new TodoResponse(t.Id, t.Title, t.Done, t.CategoryId)).SingleOrDefaultAsync();

    // Null means the target category does not exist; the endpoint determines the HTTP status code.
    public async Task<TodoResponse?> CreateAsync(CreateTodo input)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId)) return null;
        var todo = new Todo { Title = input.Title, CategoryId = input.CategoryId };
        db.Todos.Add(todo);
        await db.SaveChangesAsync();
        return new TodoResponse(todo.Id, todo.Title, todo.Done, todo.CategoryId);
    }

    public async Task<ReplaceOutcome> ReplaceAsync(int id, ReplaceTodo input)
    {
        var todo = await db.Todos.FindAsync(id);
        if (todo is null) return ReplaceOutcome.TodoNotFound;
        if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId)) return ReplaceOutcome.CategoryNotFound;
        todo.Title = input.Title;
        todo.Done = input.Done;
        todo.CategoryId = input.CategoryId;
        await db.SaveChangesAsync();
        return ReplaceOutcome.Updated;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var todo = await db.Todos.FindAsync(id);
        if (todo is null) return false;
        db.Todos.Remove(todo);
        await db.SaveChangesAsync();
        return true;
    }
}
