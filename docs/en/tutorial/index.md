---
title: Learning path
description: "The complete learning path for the ASP.NET Core First Steps tutorial: six stages along one main sequence."
prev: false
next:
  text: Environment setup
  link: /en/tutorial/setup
---

# Learning path

This tutorial follows **one main sequence**; it is not a reference manual to browse at random. Each chapter builds on the chapters before it:

- Parameter binding from **Requests and responses** is the foundation for every endpoint that follows.
- **Data access** uses dependency injection and configuration from **Application structure**.
- Authentication and authorization in **Security** are inserted into the middleware pipeline.

So please **read the chapters in order**. Each chapter corresponds to a separate, complete, runnable project in the repository's `samples/` directory. You can open the matching example at any time and compare it with your own code.

::: info About the samples
Both editions use the same runnable projects. Code comments, sample data, and application messages are in English, so commands and responses match in either edition.
:::

<LearningPath compact />

## How to read each page

Every page follows the same structure. Once you are familiar with it, you will be able to move through the material quickly:

1. **Complete code**: The page starts with the finished program for the chapter. You can copy and run it first to see what it does.
2. **Run and verify**: Commands and expected output help confirm that your environment and results are correct.
3. **Walkthrough**: Highlighted lines show what was added or changed, with an explanation of what each part does and **why** it is designed that way.
4. **Summary**: A few key points recap the chapter and link to the next page.

The pages use four callout types with consistent meanings:

::: tip Tip
Practical advice to help you avoid common detours.
:::

::: info Technical detail
Background on how things work. You can skip it on your first read without affecting the rest of the material.
:::

::: warning Note
A common pitfall that is worth reading carefully.
:::

::: fastapi FastAPI comparison
If you have used FastAPI, this callout briefly explains the corresponding concept. If you have not, feel free to skip it.
:::
