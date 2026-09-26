using System.Net;
using System.Net.Http.Json;

public class ProductionTests
{
    [Fact]
    public async Task Production_keeps_docs_private_and_enforces_roles()
    {
        await using var app = new TodoApiFactory("Production");
        using var anonymous = app.CreateClient();
        using var editor = app.CreateUserClient(editor: true);
        using var reader = app.CreateUserClient();
        var ct = TestContext.Current.CancellationToken;
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync("/health", ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync("/openapi/v1.json", ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync("/scalar", ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/todos", ct)).StatusCode);
        var created = await editor.PostAsJsonAsync("/todos", new { title = "Production test", categoryId = 1 }, ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.DeleteAsync("/todos/1", ct)).StatusCode);
        Assert.Single((await reader.GetFromJsonAsync<TodoResponse[]>("/todos", ct))!);
    }
}
