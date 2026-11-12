---
title: C# Tour
description: 'The C# features used in this tutorial: static typing and var, string interpolation, nullable reference types, lambdas, records, LINQ, async/await, union types, and the other new C# 15 syntax.'
---

# C# Tour

This is not a complete C# course. It covers only the syntax you’ll need in later chapters so you can follow the code. If you’ve used a statically typed language such as Java, TypeScript, or Kotlin, most of this will be familiar and you can skim it.

Unlike the other chapters, this is a quick tour of several small language features. They share one theme: **C# is statically typed. The compiler knows the type of every value before the program runs and uses that information to check your code.** Every later chapter builds on this.

Here is the complete console program for this chapter:

<<< @/../samples/01-csharp-tour/Program.cs{cs:line-numbers} [01-csharp-tour/Program.cs]

Run it (from the `samples/01-csharp-tour` directory, or create a project with `dotnet new console` as in [Setup](./setup) and replace `Program.cs`):

```bash
dotnet run
```

Expected output:

```text
Alex has 2 todo items
Nickname length:0
Square of 5 is 25
Todo { Id = 1, Title = Buy milk, Done = False }
Todo { Id = 1, Title = Buy milk, Done = True }
Value equality:True
Pending: Buy milk
Async operation complete
Todo 3 not found
High priority: Due today
Distinct tags: 2
Visited 1
Visited 2
Visited 3
Found by title: Todo { Id = 2, Title = Write code, Done = True }
```

We’ll look at the code in five groups.

## Types, nullability, and lambdas

<<< @/../samples/01-csharp-tour/Program.cs{2-3,6,9-10,13-14 cs:line-numbers} [01-csharp-tour/Program.cs]

### Static typing and var

**Line 2** declares the type `int` explicitly. **Line 3** uses `var` to let the compiler **infer** the type from the value on the right: `owner` is a `string`, and it will always be a `string`.

`var` is not a “dynamic type.” If you later write `owner = 42;`, compilation fails. It only saves you from repeating a type name; the type is still determined at compile time. In VS Code, hover over a variable to see its inferred type.

::: fastapi FastAPI comparison
Python type hints are optional and aren’t checked at runtime; FastAPI reads them to convert data. C# types are mandatory: the compiler checks every use, and code with a type mismatch cannot run. Later you’ll see ASP.NET Core read these types for parameter binding and documentation generation too.
:::

### String interpolation

**Line 6** has a `$` before the string. This is **string interpolation**: write variables or expressions inside braces and they are replaced with their values at runtime. It’s like Python f-strings or JavaScript template strings.

### Nullable reference types

**Line 9** uses `string?` to mean “this variable may be `null`.” Without the question mark, `string` means “should not be `null`.” This feature is called **nullable reference types**. It is enabled in the project file by `<Nullable>enable</Nullable>` and is enabled by default in .NET templates.

**Why is this useful?** Null-reference errors (accessing a member on `null`) are among the most common runtime crashes. Nullable annotations let the compiler detect potential problems early. For example, if you change line 10 to access `nickname.Length` directly, you’ll get a compile-time warning:

```text
Program.cs(10,19): warning CS8602: Dereference of a possibly null reference.
```

The correct code on line 10 uses two operators:

- `?.` (null-conditional operator): if `nickname` is `null`, it doesn’t access `.Length` and the whole expression evaluates to `null`.
- `??` (null-coalescing operator): if the left side is `null`, use the value on the right, which is `0` here.

::: warning
Nullable annotations are **compile-time** checks. They do not prevent `null` from appearing at runtime. For example, deserialized JSON data can still be `null` even if its type is written as `string`. We’ll see this in [Request Body](./request-body) and address it in [Validation](./validation).
:::

### Lambda expressions

**Line 13** has `x => x * x`, a **lambda expression** (anonymous function): the parameter is on the left of `=>` and the return value is on the right. Its type is `Func<int, int>`, meaning “a function that takes an `int` and returns an `int`.”

You’ll use lambdas in the next chapter, [First Steps](./first-steps): the second argument to `app.MapGet("/", () => ...)` is a lambda. A lambda body can also be a block of code in braces with a `return` statement; later chapters use this form often.

::: fastapi FastAPI comparison
This is like Python’s `lambda x: x * x`, but a C# lambda can contain multiple statements, so endpoint logic can be written directly in the lambda.
:::

## Records and LINQ

<<< @/../samples/01-csharp-tour/Program.cs{17-21,24-26,77 cs:line-numbers} [01-csharp-tour/Program.cs]

### record

**Line 77** defines a type named `Todo` in one line:

- The `int Id, string Title, bool Done` values in parentheses are both constructor parameters and automatically generated `init` properties with the same names. They can be assigned only during initialization.
- The compiler also generates `ToString()` (so line 19 can print `Todo { Id = 1, ... }`) and value-based equality.

This kind of type is called a **record**. This example uses a positional `record class` (the `class` keyword is optional), which is useful for representing a set of data. It has two convenient features:

1. **Value equality:** two records are equal when all their properties are equal. Line 21’s `milk == new Todo(1, "Buy milk", false)` evaluates to `True`, even though they are different objects.
2. **No reassignment after initialization:** the generated `init` properties in this example can be assigned only during initialization. To “change” a value, use the **line 18** `with` expression to make a copy with selected properties replaced; the original `milk` stays unchanged.

A `record` does not enforce immutability by itself: you can still declare properties with `set`. If a property points to a mutable list, `init` prevents replacing the list but does not prevent changing its elements. This is called **shallow immutability**.

**Why are records popular in Web APIs?** Request and response data is essentially a set of values: it comes from JSON and goes back to JSON, and should not be changed accidentally along the way. Records express that intent with little code. Starting in [Request Body](./request-body), all data models in this tutorial will be records.

::: info Technical detail
In a `Program.cs` file that uses top-level statements, type declarations such as `record Todo` must appear **after** all statements. That’s why you’ll see them at the end of each sample file. Line 32’s `static async Task<string> LoadMessageAsync()` is a **local function**, which can appear between statements or after them.
:::

::: fastapi FastAPI comparison
A record plays a role similar to a Pydantic model or `@dataclass(frozen=True)`: fields describe the shape of the data. The difference is that a record does not validate by itself; ASP.NET Core validation is covered separately in [Validation](./validation).
:::

### Collections and LINQ

**Line 24** uses square brackets, `[milk, new Todo(2, "Write code", true)]`, as a **collection expression** to create a `List<Todo>`. The `<Todo>` in `List<Todo>` is a **generic type argument**: this is a list that can hold only `Todo` values, and adding another type causes a compile error.

**Line 25** uses **LINQ** (Language Integrated Query):

- `Where(t => !t.Done)`: filter for items that are not done.
- `Select(t => t.Title)`: select only the titles.

Both methods accept lambdas and can be chained like a pipeline. LINQ appears frequently later: [Query Parameters](./query-params) uses it for filtering and paging, and [EF Core Basics](./efcore-basics) shows the same style translated into SQL queries.

::: fastapi FastAPI comparison
Line 25 is equivalent to Python’s `[t.title for t in todos if not t.done]`.
:::

## async / await

<<< @/../samples/01-csharp-tour/Program.cs{29,32-36 cs:line-numbers} [01-csharp-tour/Program.cs]

**Lines 32–36** define an **asynchronous method**:

- `async` means the method can use `await`.
- The return type `Task<string>` means “an operation that will produce a `string` later.”
- Line 34’s `await Task.Delay(100)` waits for 100 milliseconds but **does not block the thread**.

**Line 29** uses `await` to wait for this method and retrieve its result. By convention, asynchronous method names end in `Async`.

**Why do web services need async?** A server spends much of its time waiting for a response from a database, a file read, or another service. Synchronous code holds on to a thread while it waits. Asynchronous code returns the thread to the server while waiting, so it can handle other requests. The same machine can then handle many more concurrent requests. Starting with [EF Core Basics](./efcore-basics), all database operations will be asynchronous.

::: fastapi FastAPI comparison
The idea is the same as Python’s `async def` / `await`. ASP.NET Core can mix synchronous and asynchronous handlers and the framework handles both correctly. There is no equivalent to “calling blocking synchronous code in an async function stalls the event loop,” but blocking calls still waste threads, so use asynchronous APIs for I/O.
:::

## Union types

<<< @/../samples/01-csharp-tour/Program.cs{39-45,78-79 cs:line-numbers} [01-csharp-tour/Program.cs]

**Line 79** uses `union` to declare a **union type**: a `TodoResult` value is either a `Todo` or a `NotFound`, and nothing else. This syntax is new in C# 15.

- **Line 39** assigns a `NotFound` directly to a `TodoResult` variable; the compiler performs the conversion.
- **Lines 40–44** use a `switch` expression to choose a branch by the actual type. `Todo todo =>` means “if it contains a `Todo`, take it out and name it `todo`.”

**The compiler checks that every case is handled.** Delete line 43 and build again, and you get a warning:

```text
Program.cs(40,22): warning CS8509: The switch expression does not handle all possible values of its input type (it is not exhaustive). For example, the pattern 'NotFound' is not covered.
```

When you later add a third case to `TodoResult`, every `switch` that hasn’t been updated is reported the same way.

“Return the data if found, otherwise return 404” is a very common result in a Web API. The Response Types chapter expresses the same idea with ASP.NET Core’s own `Results<Ok<Todo>, NotFound>`. It predates `union` in C#, so the syntax differs, but the idea is the same.

::: fastapi
This is like `Todo | NotFound` in a Python type hint, and the `switch` expression corresponds to a `match` statement. The difference is that the C# compiler checks whether the branches are complete.
:::

## Other new syntax in C# 15

Besides union types, C# 15 adds a few more pieces of syntax. Later chapters don’t depend on them, but you will meet them when reading other code.

<<< @/../samples/01-csharp-tour/Program.cs{48-54,57,62,68,75,80-82,86-89 cs:line-numbers} [01-csharp-tour/Program.cs]

### Closed hierarchies

`closed` on **line 80** means that only types in the same **assembly** (for now, read this as “the same project”) can derive from `Priority`. Lines 81 and 82 are all of its derived types. A `closed` type can’t be instantiated directly.

Because the derived types are fixed, once the `switch` expression on **lines 49–53** lists `Low` and `High`, the compiler knows every case is handled and no catch-all branch is needed. If you miss a branch, you get the same CS8509 warning as with a union type.

How do you choose between a union type and a closed hierarchy? Use `union` when the cases are existing, unrelated types such as `Todo` and `NotFound`. Use `closed` when the cases naturally share a base type.

### Collection expression arguments

The first item inside the brackets on **line 57**, `with(...)`, is not an element of the collection. It is an argument passed to the collection’s constructor. Here it passes `StringComparer.OrdinalIgnoreCase`, so the `HashSet<string>` ignores case when comparing. `"home"` and `"Home"` count as the same element, and the program prints `Distinct tags: 2`.

Before C# 15, you couldn’t use the bracket syntax when you needed a constructor argument; you had to write `new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ... }`.

### Labeled break and continue

**Line 62** puts the label `outer:` in front of the outer loop. `break outer;` on **line 68** exits that outer loop directly; a `break` without a label exits only the innermost loop. So the output stops at `Visited 3`, and 5 and 6 are never visited.

`continue outer;` works the same way and moves straight to the next iteration of the outer loop.

### Extension indexers

**Lines 86–89** are an **extension block**: `extension(List<Todo> todos)` means “add members to `List<Todo>`” without changing `List<T>` itself. Extension blocks were introduced in C# 14, and C# 15 lets you declare an **indexer** inside one (`this[...]`, which defines what bracket access does).

That is why **line 75** can write `todos["Write code"]` to find a todo by title. The built-in access by position, such as `todos[0]`, is unaffected. The return type is `Todo?`, so the result is `null` when nothing matches.

## Summary

- C# is **statically typed**. `var` asks the compiler to infer a type; the type is still determined at compile time.
- `$"..."` is **string interpolation**. `string?` means **nullable** and works with `?.` and `??` to handle `null` safely. Nullability checks happen only at compile time.
- A **lambda** such as `x => ...` is an anonymous function used as a handler by methods such as `MapGet`.
- A **positional record** concisely defines a data type with value equality and `with` copying. This example uses `init` properties, but records do not make every member immutable.
- A **union type** declared with `union` lists the types a value can be. The compiler warns when a `switch` expression misses a case.
- C# 15 also adds `closed` hierarchies, collection expression arguments with `with(...)`, labeled `break` / `continue`, and extension indexers.
- **LINQ** chains methods such as `Where` and `Select` to process collections. **async/await** avoids occupying a thread while waiting for I/O.

Next: [First Steps](./first-steps), where you’ll write your first Web API. Previous: [Setup](./setup).
