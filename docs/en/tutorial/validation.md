---
title: Validation
description: 'Use built-in .NET 10 Minimal API validation: declare rules on records and parameters with data annotations, and reject invalid requests before handlers run.'
---

# Validation

The previous chapter left us with a problem: if the request body omitted `title`, the program still created a Todo with a `null` title. The new concept in this section is **declarative validation**: **declare** rules on types and parameters and let the framework check them before it calls the handler. Invalid requests are rejected with 400.

<<< @/../samples/06-validation/Program.cs{1,7,20,31-33 cs:line-numbers} [06-validation/Program.cs]

Compared with the previous chapter, only three things changed: line 7 registers the validation service, lines 31–33 add rules to `CreateTodo` properties, and line 20 adds a rule to a query parameter. The handler itself is unchanged.

## Run and verify

```bash
dotnet run
```

Valid requests still work:

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","priority":2}'
```

```json
{"id":1,"title":"Buy milk","priority":2,"done":false}
```

Now send the request from the previous chapter that omits `title`:

```bash
curl -i -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"priority":3}'
```

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{"title":"One or more validation errors occurred.","errors":{"Title":["The Title field is required."]}}
```

This time the request is rejected. If several fields are invalid, all errors are returned at once:

```bash
curl -X POST http://localhost:5080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"","priority":9}'
```

```json
{"title":"One or more validation errors occurred.","errors":{"Title":["The Title field is required."],"Priority":["The field Priority must be between 1 and 5."]}}
```

Query parameters are checked too:

```bash
curl "http://localhost:5080/todos?pageSize=100"
```

```json
{"title":"One or more validation errors occurred.","errors":{"pageSize":["The field pageSize must be between 1 and 50."]}}
```

## Declare rules with attributes

<<< @/../samples/06-validation/Program.cs{1,31-33 cs:line-numbers} [06-validation/Program.cs]

The bracketed `[Required]`, `[StringLength(50)]`, and `[Range(1, 5)]` are **attributes**, metadata attached to code. These attributes come from the `System.ComponentModel.DataAnnotations` namespace imported on line 1 and are collectively called **data annotations**:

| Attribute | Rule |
| --- | --- |
| `[Required]` | Must be supplied and not be `null`; for strings, it also cannot be empty |
| `[StringLength(50)]` | String length is at most 50 |
| `[Range(1, 5)]` | Number is between 1 and 5, inclusive |
| `[MinLength]`, `[MaxLength]` | Minimum or maximum length of a string or collection |
| `[EmailAddress]`, `[Url]` | Email address or URL format |
| `[RegularExpression]` | Match a regular expression |

You can put multiple attributes in the same set of brackets, separated by commas, for example `[Required, StringLength(50)]`.

**Why declare rules instead of writing `if` statements in the handler?**

- **Rules stay with the data:** looking at `CreateTodo` shows all its constraints; you don’t have to search every handler.
- **Handlers stay clean:** when the handler runs, `input` is valid, so business code doesn’t need to defend against invalid input again.
- **Errors have a consistent format:** every endpoint returns the same error structure, so the client needs only one handling path.
- **Rules appear in the documentation:** for example, the `pageSize` parameter description in OpenAPI includes `"minimum": 1` and `"maximum": 50`.

::: fastapi FastAPI comparison
This is similar to Pydantic’s `Field(min_length=1, max_length=50)`, `Field(ge=1, le=5)`, and `Query(ge=1, le=50)` for query parameters. FastAPI includes validation in Pydantic; ASP.NET Core separates the data model (record) from validation, which you must enable explicitly.
:::

::: warning
**`CreateTodo` must be declared `public`** (line 31). .NET 10 validation uses a **source generator** to generate code for types being validated at compile time, and it processes only public types.

If you remove `public` and write `record CreateTodo(...)`, the project still compiles, but the request body is **not validated at all**—there is no error, warning, or log. This is an easy pitfall: if validation rules don’t run, first check whether the type is `public`.
:::

## Enable validation

<<< @/../samples/06-validation/Program.cs{7 cs:line-numbers} [06-validation/Program.cs]

`AddValidation()` registers validation with the application. After that, before calling a handler, each endpoint checks input against its parameter attributes:

1. Values from the route, query string, request body, and other sources are bound first (from the previous chapter).
2. Each parameter and each property on parameter objects is checked against its attributes.
3. If there are any errors, the framework returns 400 with all of them and does not call the handler.
4. If everything passes, the handler runs.

Notice the difference between steps 2 and the previous chapter: **binding** checks “is the format correct?” (can `"high"` be converted to `int`?), while **validation** checks “is the content acceptable?” (is `9` between 1 and 5?). If binding fails, the framework cannot construct the `CreateTodo` object, so validation never gets a chance to run.

::: info Technical detail
Built-in validation was added in .NET 10; earlier versions required a third-party library or custom code. The source generator discovers validatable types and generates metadata at compile time, and the validation component runs the rules at runtime. It still uses **reflection** (reading type and property information at runtime) to retrieve properties and validation attributes; it does not eliminate reflection entirely. Generated metadata and trimming support make it usable with native AOT (ahead-of-time compilation to native code, discussed in the Advanced section). AOT does not mean reflection is completely unavailable.
:::

## Validate query parameters

<<< @/../samples/06-validation/Program.cs{20 cs:line-numbers} [06-validation/Program.cs]

Attributes can go on handler parameters as well as record properties. `[Range(1, 50)]` limits a page to 50 items, preventing clients from requesting too much data at once.

You can validate route parameters, query parameters, and headers this way. Recall the guidance from [Path Parameters](./path-params): an “invalid value” should return a descriptive 400, not a 404 from a route constraint. This is where you implement that behavior.

## Error response format

The response body for a validation failure has this structure:

```json
{
  "title": "One or more validation errors occurred.",
  "errors": {
    "Title": ["The Title field is required."],
    "Priority": ["The field Priority must be between 1 and 5."]
  }
}
```

`errors` is a dictionary: each key is a field with an error, and its value is a list of that field’s error messages. This structure follows a standard format called **Problem Details**, which we’ll cover in [Status Codes and Error Handling](./errors), along with a consistent way to represent common errors.

::: tip
Default validation messages are in English. You can customize each message with `ErrorMessage`, for example `[Range(1, 5, ErrorMessage = "Priority must be between 1 and 5")]`.
:::

## Summary

- `builder.Services.AddValidation()` enables built-in .NET 10 validation, which runs **before** the handler.
- Declare rules with **data annotations** such as `[Required]`, `[StringLength]`, and `[Range]` on record properties or handler parameters.
- Validation failures return 400, with all field errors listed in the response’s `errors` field. The handler is not called.
- **Binding** checks the format; **validation** checks the content. Rules also appear in OpenAPI documentation.
- Types being validated must be `public`; otherwise, validation is silently skipped.

Next: [Headers and Cookies](./headers-cookies)—read other parts of the request. Previous: [Request Body](./request-body).
