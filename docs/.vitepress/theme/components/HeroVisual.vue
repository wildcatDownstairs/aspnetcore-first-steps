<script setup lang="ts">
/**
 * 首页右侧的终端画面：演示"启动服务 → 发请求 → 得到 JSON"，
 * 内容与第 02、03 章示例的真实输出一致。
 */
</script>

<template>
  <div class="hv" aria-hidden="true">
    <div class="hv-bar">
      <span>bash</span>
      <span class="hv-bar-path">~/samples/03-path-params</span>
    </div>
    <div class="hv-body">
      <div class="hv-line l1"><span class="hv-prompt">$</span> dotnet run</div>
      <div class="hv-line l2 hv-muted">Now listening on: http://localhost:5080</div>
      <div class="hv-line l3"><span class="hv-prompt">$</span> curl localhost:5080/users/42</div>
      <div class="hv-line l4">
        <span class="hv-p">{</span><span class="hv-k">"id"</span><span class="hv-p">:</span><span class="hv-n">42</span><span class="hv-p">,</span><span class="hv-k">"name"</span><span class="hv-p">:</span><span class="hv-s">"User 42"</span><span class="hv-p">}</span>
      </div>
      <div class="hv-line l5"><span class="hv-prompt">$</span> curl -i localhost:5080/users/abc</div>
      <div class="hv-line l6 hv-muted">HTTP/1.1 404 Not Found</div>
      <div class="hv-line l7"><span class="hv-prompt">$</span> <span class="hv-caret" /></div>
    </div>
  </div>
</template>

<style scoped>
.hv {
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  border-radius: 8px;
  overflow: hidden;
  background: #16161a;
  border: 1px solid #2a2a2e;
  font-family: var(--vp-font-family-mono);
  text-align: left;
  animation: hv-in 0.6s 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@media (min-width: 960px) {
  .hv {
    margin: 0 0 0 auto;
  }
}
.hv-bar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid #2a2a2e;
  font-size: 11.5px;
  color: #8a8a94;
}
.hv-bar-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hv-body {
  padding: 14px 16px 18px;
  font-size: 13px;
  line-height: 1.85;
  color: #e4e4e8;
}
.hv-line {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  opacity: 0;
  animation: hv-line 0.01s steps(1) forwards;
}
.l1 {
  animation-delay: 0.5s;
}
.l2 {
  animation-delay: 0.9s;
}
.l3 {
  animation-delay: 1.5s;
}
.l4 {
  animation-delay: 1.9s;
}
.l5 {
  animation-delay: 2.6s;
}
.l6 {
  animation-delay: 3s;
}
.l7 {
  animation-delay: 3.4s;
}
.hv-prompt {
  color: #8a8a94;
  margin-right: 4px;
}
.hv-muted {
  color: #8a8a94;
}
.hv-k {
  color: #9ecbff;
}
.hv-s {
  color: #a5d6a7;
}
.hv-n {
  color: #f0c674;
}
.hv-p {
  color: #8a8a94;
}
.hv-caret {
  display: inline-block;
  width: 7px;
  height: 14px;
  vertical-align: -2px;
  background: #c8c8d0;
  animation: hv-blink 1.1s steps(1) infinite;
}
@keyframes hv-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
@keyframes hv-line {
  to {
    opacity: 1;
  }
}
@keyframes hv-blink {
  50% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hv-line {
    opacity: 1;
  }
}
</style>
