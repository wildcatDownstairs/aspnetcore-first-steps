using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Options;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddOptions<TodoOptions>()
    .BindConfiguration(TodoOptions.SectionName)
    .ValidateDataAnnotations()
    .ValidateOnStart();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.MapGet("/settings", (IOptions<TodoOptions> options) =>
{
    var settings = options.Value;
    return new
    {
        settings.WelcomeMessage,
        settings.MaxItems,
        AdminKeyConfigured = !string.IsNullOrEmpty(settings.AdminKey),
    };
});

app.Run();

public class TodoOptions
{
    public const string SectionName = "Todo";

    [Required]
    public string WelcomeMessage { get; set; } = "";

    [Range(1, 100)]
    public int MaxItems { get; set; }

    public string? AdminKey { get; set; }
}
