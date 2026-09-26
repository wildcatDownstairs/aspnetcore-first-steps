---
title: About
description: Who this ASP.NET Core First Steps tutorial is for, how it is written, and how to contribute.
prev: false
next: false
---

# About this tutorial

## Who it is for

This tutorial is for developers with programming experience who **have not used C# or ASP.NET Core**. You may have worked with Python (FastAPI, Flask, or Django), Node.js, or mainly on the frontend. After completing the main path, you should be able to build and deploy a Web API with a database and authentication on your own.

## Scope

- **.NET 10 (LTS) and C# 14**: All code uses the .NET 10 approach; older patterns such as `Startup.cs` are not covered.
- **Minimal APIs only**: MVC Controllers, Razor Pages, and Blazor are outside the scope, keeping the focus on one learning path.
- **EF Core with SQLite**: No database installation is needed; clone the repository and run the examples.
- **Built-in OpenAPI with Scalar**: Every example includes interactive API documentation.

## Writing principles

- **Introduce one new concept per page.** The page starts with the complete code, then explains it section by section.
- **Keep the code runnable.** All tutorial code is included from real projects in the repository's `samples/` directory rather than being handwritten in the docs. Continuous integration (CI) builds every sample on each commit, and a failed build prevents publication.
- **Explain why**, not just how to use something.
- **Show the expected output** so you can check your work.

The tutorial's structure and teaching approach were inspired by the official FastAPI tutorial, but all text and examples are original.

## Contributing

If you find an error, something unclear, or a topic we should add, open an Issue or Pull Request in the GitHub repository. Every page has an "Edit this page on GitHub" link at the bottom.
