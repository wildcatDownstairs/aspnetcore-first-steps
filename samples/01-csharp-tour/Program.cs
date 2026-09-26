// 1. 静态类型与类型推断
int count = 2;
var owner = "小明";

// 2. 字符串插值
Console.WriteLine($"{owner} 有 {count} 个待办事项");

// 3. 可空引用类型
string? nickname = null;
Console.WriteLine($"昵称长度：{nickname?.Length ?? 0}");

// 4. Lambda 表达式
Func<int, int> square = x => x * x;
Console.WriteLine($"5 的平方是 {square(5)}");

// 5. record
var milk = new Todo(1, "买牛奶", false);
var milkDone = milk with { Done = true };
Console.WriteLine(milk);
Console.WriteLine(milkDone);
Console.WriteLine($"值相等：{milk == new Todo(1, "买牛奶", false)}");

// 6. 集合与 LINQ
List<Todo> todos = [milk, new Todo(2, "写代码", true)];
var pending = todos.Where(t => !t.Done).Select(t => t.Title);
Console.WriteLine($"未完成：{string.Join("、", pending)}");

// 7. async / await
var message = await LoadMessageAsync();
Console.WriteLine(message);

static async Task<string> LoadMessageAsync()
{
    await Task.Delay(100);
    return "异步操作完成";
}

record Todo(int Id, string Title, bool Done);
