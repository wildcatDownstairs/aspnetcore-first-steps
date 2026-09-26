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

record Todo(int Id, string Title, bool Done);
