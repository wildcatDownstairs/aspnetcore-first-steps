// 1. Static typing and type inference
int count = 2;
var owner = "Alex";

// 2. String interpolation
Console.WriteLine($"{owner} has {count} todo items");

// 3. Nullable reference types
string? nickname = null;
Console.WriteLine($"Nickname length: {nickname?.Length ?? 0}");

// 4. Lambda expressions
Func<int, int> square = x => x * x;
Console.WriteLine($"Square of 5 is {square(5)}");

// 5. Records
var milk = new Todo(1, "Buy milk", false);
var milkDone = milk with { Done = true };
Console.WriteLine(milk);
Console.WriteLine(milkDone);
Console.WriteLine($"Value equality: {milk == new Todo(1, "Buy milk", false)}");

// 6. Collections and LINQ
List<Todo> todos = [milk, new Todo(2, "Write code", true)];
var pending = todos.Where(t => !t.Done).Select(t => t.Title);
Console.WriteLine($"Pending: {string.Join(", ", pending)}");

// 7. async / await
var message = await LoadMessageAsync();
Console.WriteLine(message);

static async Task<string> LoadMessageAsync()
{
    await Task.Delay(100);
    return "Async operation complete";
}

// 8. Union types
TodoResult result = new NotFound(3);
var summary = result switch
{
    Todo todo => $"Found: {todo.Title}",
    NotFound missing => $"Todo {missing.Id} not found",
};
Console.WriteLine(summary);

// 9. Closed hierarchies
Priority priority = new High("Due today");
var label = priority switch
{
    Low => "Low priority",
    High high => $"High priority: {high.Reason}",
};
Console.WriteLine(label);

// 10. Collection expression arguments
HashSet<string> tags = [with(StringComparer.OrdinalIgnoreCase), "home", "Home", "work"];
Console.WriteLine($"Distinct tags: {tags.Count}");

// 11. Labeled break and continue
int[][] rows = [[1, 2], [3, 4], [5, 6]];
outer: foreach (var row in rows)
{
    foreach (var value in row)
    {
        if (value == 4)
        {
            break outer;
        }
        Console.WriteLine($"Visited {value}");
    }
}

// 12. Extension indexers
Console.WriteLine($"Found by title: {todos["Write code"]}");

record Todo(int Id, string Title, bool Done);
record NotFound(int Id);
union TodoResult(Todo, NotFound);
closed record Priority;
record Low : Priority;
record High(string Reason) : Priority;

static class TodoListExtensions
{
    extension(List<Todo> todos)
    {
        public Todo? this[string title] => todos.FirstOrDefault(t => t.Title == title);
    }
}
