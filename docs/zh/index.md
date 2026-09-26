---
layout: home
title: ASP.NET Core 第一步
titleTemplate: 中文 ASP.NET Core 渐进式教程
description: 从零学习 C# 与 ASP.NET Core：基于 .NET 10 和 Minimal API，逐步掌握路由、EF Core 数据库、JWT 认证、测试与 Docker 部署，每章都有可运行示例。

hero:
  name: ASP.NET Core 第一步
  text: 从第一个接口到上线
  tagline: 写给有编程经验、但没碰过 C# 的你。基于 .NET 10 与 Minimal API，一步只学一个概念，每一章都是能直接 dotnet run 的完整项目。
  actions:
    - theme: brand
      text: 开始学习 →
      link: /zh/tutorial/setup
    - theme: alt
      text: 查看学习路线
      link: /zh/tutorial/
    - theme: alt
      text: FastAPI 对照速查
      link: /zh/fastapi-cheatsheet

features:
  - title: 一页只学一个概念
    details: 每一页开头先给出最终的完整代码，再逐段拆解，并用行高亮标出本节新增的部分。不会一次塞给你十个新名词。
  - title: 代码都能直接运行
    details: 教程中的每段代码都来自仓库里真实的示例项目，CI 每次提交都会编译全部示例。复制即可 dotnet run，没有"此处省略"。
  - title: 讲清"为什么"
    details: 不止告诉你怎么写，也解释框架为什么这样设计——为什么要分 builder 和 app，为什么路由不看注册顺序。
  - title: FastAPI 对照
    details: 如果你写过 FastAPI，每个关键概念旁都有一两句话的类比，帮你把已有经验迁移过来。
  - title: 让类型替你把关
    details: 充分利用 C# 的静态类型：编辑器补全、编译期报错、自动生成的 OpenAPI 文档，都来自同一份代码。
  - title: 一路走到上线
    details: 路由、校验、依赖注入、EF Core + SQLite、JWT 认证、测试、Docker 部署——读完能独立写出一个完整的 API。
---

<div class="home-section" data-reveal>

<p class="eyebrow">三十秒预览</p>

## 一个完整的 Web API，只有 17 行

<p class="lead">这就是第 02 章结束时你会写出的程序：一个返回 JSON 的接口，外加自动生成的交互式 API 文档。没有配置文件要改，没有样板类要继承。</p>

<div class="home-grid">

<ol class="home-steps">
  <li><strong>创建项目</strong><span>一条 <code>dotnet new web</code> 命令得到一个最小的 Web 项目</span></li>
  <li><strong>声明端点</strong><span><code>MapGet</code> 把 URL 和一个普通函数连起来，返回值自动序列化为 JSON</span></li>
  <li><strong>运行</strong><span><code>dotnet watch</code> 启动服务，改代码后自动热重载</span></li>
  <li><strong>打开文档</strong><span>访问 <code>/scalar</code>，在浏览器里直接调试你的接口</span></li>
</ol>

<<< @/../samples/02-first-steps/Program.cs{15 cs:line-numbers} [Program.cs]

</div>
</div>

<div class="home-section">

<p class="eyebrow">学习路线</p>

## 六个阶段，一条主线

<p class="lead">后面的章节依赖前面的内容：EF Core 要用到依赖注入，认证要用到中间件。所以教程是一条线性主线，建议按顺序阅读。</p>

<LearningPath />

</div>
