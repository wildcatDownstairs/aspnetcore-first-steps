using System.ComponentModel.DataAnnotations;

public class Todo
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public bool Done { get; set; }
}

public record CreateTodo([Required, StringLength(100)] string Title);
