using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

public class TodoApiTests
{
    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    public async Task Invalid_title_does_not_insert(string title)
    {
        await using var app = new TodoApiFactory();
        using var client = app.CreateUserClient(editor: true);
        var ct = TestContext.Current.CancellationToken;
        var response = await client.PostAsJsonAsync("/todos", new { title, categoryId = 1 }, ct);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var items = await client.GetFromJsonAsync<TodoResponse[]>("/todos", ct);
        Assert.NotNull(items);
        Assert.Empty(items);
    }

    [Fact]
    public async Task Unknown_category_does_not_insert()
    {
        await using var app = new TodoApiFactory();
        using var client = app.CreateUserClient(editor: true);
        var ct = TestContext.Current.CancellationToken;
        var response = await client.PostAsJsonAsync("/todos", new { title = "Buy milk", categoryId = 99 }, ct);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<TodoResponse[]>("/todos", ct))!);
    }

    [Fact]
    public async Task Missing_todo_returns_404()
    {
        await using var app = new TodoApiFactory();
        using var client = app.CreateUserClient();
        var response = await client.GetAsync("/todos/99", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Anonymous_request_returns_401()
    {
        await using var app = new TodoApiFactory();
        using var client = app.CreateClient();
        var response = await client.GetAsync("/todos", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Invalid_token_returns_401()
    {
        await using var app = new TodoApiFactory();
        using var client = app.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "invalid");
        var response = await client.GetAsync("/todos", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    [InlineData("DELETE")]
    public async Task Reader_cannot_write(string method)
    {
        await using var app = new TodoApiFactory();
        using var editor = app.CreateUserClient(editor: true);
        using var reader = app.CreateUserClient();
        var ct = TestContext.Current.CancellationToken;
        var created = await editor.PostAsJsonAsync("/todos", new { title = "Keep me", categoryId = 1 }, ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        using var request = new HttpRequestMessage(new HttpMethod(method), method == "POST" ? "/todos" : "/todos/1")
        {
            Content = JsonContent.Create(new { title = "Changed", done = true, categoryId = 2 })
        };
        var response = await reader.SendAsync(request, ct);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var saved = await reader.GetFromJsonAsync<TodoResponse>("/todos/1", ct);
        Assert.Equal(new TodoResponse(1, "Keep me", false, 1), saved);
        Assert.Single((await reader.GetFromJsonAsync<TodoResponse[]>("/todos", ct))!);
    }

    [Fact]
    public async Task Editor_can_replace_and_delete()
    {
        await using var app = new TodoApiFactory();
        using var client = app.CreateUserClient(editor: true);
        var ct = TestContext.Current.CancellationToken;
        var created = await client.PostAsJsonAsync("/todos", new { title = "Buy milk", categoryId = 1 }, ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var updated = await client.PutAsJsonAsync("/todos/1", new { title = "Bought milk", done = true, categoryId = 2 }, ct);
        Assert.Equal(HttpStatusCode.NoContent, updated.StatusCode);
        Assert.Equal(new TodoResponse(1, "Bought milk", true, 2), await client.GetFromJsonAsync<TodoResponse>("/todos/1", ct));
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/todos/1", ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/todos/1", ct)).StatusCode);
    }
}
