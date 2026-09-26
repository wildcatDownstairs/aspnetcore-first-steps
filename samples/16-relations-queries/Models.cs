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

public record TodoSummary(int Id, string Title, bool Done);
public record CategoryResponse(int Id, string Name, List<TodoSummary> Todos);
