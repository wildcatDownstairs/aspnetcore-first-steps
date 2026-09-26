using System.ComponentModel.DataAnnotations;

public class Todo
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public bool Done { get; set; }
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
}

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public List<Todo> Todos { get; set; } = [];
}

public record CreateTodo(
    [Required, StringLength(100)] string Title,
    [Range(1, int.MaxValue)] int CategoryId);

public record ReplaceTodo(
    [Required, StringLength(100)] string Title,
    bool Done,
    [Range(1, int.MaxValue)] int CategoryId);

public record TodoResponse(int Id, string Title, bool Done, int CategoryId);
