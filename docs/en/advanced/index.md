---
title: Advanced topics
description: Planned advanced topics beyond the main path, including background tasks, caching, real-time communication, and native AOT.
prev: false
next: false
---

# Advanced topics

This section covers topics **beyond the main tutorial path** that often come up in real projects. Unlike the main path, each topic is relatively independent and can be read as needed—once you have completed the main tutorial.

::: info Technical detail
Advanced topics will be written over time after the main path is complete. The list below is the current plan; its order does not indicate the order of publication.
:::

## Available now

- [Database migrations](./efcore-migrations): Add a column to an existing table and verify that old data is preserved.

## Planned topics

| Topic | Problem it addresses |
| --- | --- |
| Background tasks | Work that continues after a request returns: scheduled jobs and queue consumers (`BackgroundService`) |
| Caching | Reduce repeated computation and database load with memory, distributed, and output caching |
| Rate limiting | Protect endpoints from being overwhelmed by too many requests (built-in Rate Limiting middleware) |
| Real-time communication | Push messages to clients with SignalR |
| Health checks | Let load balancers and container orchestration platforms know whether your service is healthy |
| Native AOT | Compile the app to a native executable for faster startup and lower memory use |
| Observability | Collect traces and metrics with OpenTelemetry |

If there is a topic you especially want to see, open an Issue in the repository.
