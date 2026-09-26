using System.ComponentModel.DataAnnotations;

namespace TodoApi.Features.Todos;

public record CreateTodo(
    [Required, StringLength(100)] string Title,
    [Range(1, int.MaxValue)] int CategoryId);

public record ReplaceTodo(
    [Required, StringLength(100)] string Title,
    bool Done,
    [Range(1, int.MaxValue)] int CategoryId);

public record TodoResponse(int Id, string Title, bool Done, int CategoryId);

public enum ReplaceOutcome { Updated, TodoNotFound, CategoryNotFound }
