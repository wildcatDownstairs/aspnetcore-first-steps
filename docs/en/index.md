---
layout: home
title: ASP.NET Core First Steps
titleTemplate: .NET 10 & Minimal APIs Tutorial
description: Learn C# and ASP.NET Core with .NET 10 and Minimal APIs. Follow runnable examples covering routing, EF Core, JWT authentication, testing, and Docker deployment.

hero:
  name: ASP.NET Core First Steps
  text: From first endpoint to deployment
  tagline: "Already code, but new to C#? Learn .NET 10 and Minimal APIs one concept at a time, with a complete runnable project in every chapter."
  actions:
    - theme: brand
      text: Start learning →
      link: /en/tutorial/setup
    - theme: alt
      text: Learning path
      link: /en/tutorial/
    - theme: alt
      text: FastAPI cheat sheet
      link: /en/fastapi-cheatsheet

features:
  - title: One concept per page
    details: Each page starts with the complete finished code, then breaks it down section by section and highlights the lines added in that chapter. You will not be buried under ten new terms at once.
  - title: Runnable code throughout
    details: Every code sample comes from a real example project in the repository, and CI builds every sample on each commit. Copy it and run dotnet run—there are no "omitted for brevity" sections.
  - title: Understand why
    details: "Learn not only how to write the code, but why the framework is designed this way: why services and the app are separate, and why route matching does not depend on registration order."
  - title: FastAPI comparisons
    details: If you have used FastAPI, key concepts include a brief comparison to help you transfer what you already know.
  - title: Let types do the checking
    details: C# static typing provides editor completion, compile-time errors, and generated OpenAPI documentation from the same code.
  - title: Follow the path to production
    details: Routing, validation, dependency injection, EF Core with SQLite, JWT authentication, testing, and Docker deployment—by the end, you can build a complete API on your own.
---

<div class="home-section" data-reveal>

<p class="eyebrow">A 30-second preview</p>

## A complete Web API in just 17 lines

<p class="lead">This is the program you will write by the end of Chapter 02: an endpoint that returns JSON, plus automatically generated interactive API documentation. There is no configuration file to edit and no boilerplate class to inherit from.</p>

::: info About the samples
Both editions use the same runnable projects. Code comments, sample data, and application messages are in English, so commands and responses match in either edition.
:::

<div class="home-grid">

<ol class="home-steps">
  <li><strong>Create a project</strong><span>One <code>dotnet new web</code> command creates a minimal web project</span></li>
  <li><strong>Declare an endpoint</strong><span><code>MapGet</code> connects a URL to an ordinary function, and the return value is serialized to JSON automatically</span></li>
  <li><strong>Run it</strong><span><code>dotnet watch</code> starts the service and applies supported code changes with hot reload</span></li>
  <li><strong>Open the docs</strong><span>Visit <code>/scalar</code> to test your endpoint directly in the browser</span></li>
</ol>

<<< @/../samples/02-first-steps/Program.cs{15 cs:line-numbers} [Program.cs]

</div>
</div>

<div class="home-section">

<p class="eyebrow">Learning path</p>

## Six stages, one main path

<p class="lead">Later chapters build on earlier ones: EF Core uses dependency injection, and authentication uses middleware. The tutorial follows a single sequence, so we recommend reading it in order.</p>

<LearningPath />

</div>
