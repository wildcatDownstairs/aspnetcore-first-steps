using System.Net;
using System.Net.Http.Json;

public class CreateTodoTests
{
    [Fact]
    public async Task Create_then_read_returns_saved_todo()
    {
        await using var app = new TodoApiFactory();
        using var client = app.CreateUserClient(editor: true);
        var ct = TestContext.Current.CancellationToken;

        var created = await client.PostAsJsonAsync("/todos", new { title = "Buy milk", categoryId = 1 }, ct);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("/todos/1", created.Headers.Location?.ToString());
        var saved = await client.GetFromJsonAsync<TodoResponse>(created.Headers.Location, ct);
        Assert.NotNull(saved);
        Assert.Equal(new TodoResponse(1, "Buy milk", false, 1), saved);
    }
}
