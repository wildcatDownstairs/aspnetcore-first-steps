<script setup lang="ts">
import { withBase, useData } from 'vitepress'
import { computed } from 'vue'
import { stagesFor } from '../../nav'

defineProps<{ compact?: boolean }>()

const { lang } = useData()
const english = computed(() => lang.value === 'en')
const stages = computed(() => stagesFor(english.value ? 'en' : 'root'))
const total = stages.value.reduce((n, s) => n + s.chapters.length, 0)
const done = stages.value.reduce((n, s) => n + s.chapters.filter((c) => c.ready).length, 0)
</script>

<template>
  <div class="lp" :class="{ 'lp-compact': compact }">
    <p class="lp-meta">
      <template v-if="english">{{ stages.length }} stages, {{ total }} chapters · {{ done }} available.</template>
      <template v-else>共 {{ stages.length }} 个阶段、{{ total }} 章，已完成 {{ done }} 章。</template>
    </p>
    <ol class="lp-stages">
      <li
        v-for="(stage, i) in stages"
        :key="stage.title"
        class="lp-stage"
        data-reveal
        :style="{ '--reveal-delay': `${i * 60}ms` }"
      >
        <span class="lp-dot" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
        <div class="lp-body">
          <div class="lp-head">
            <h3 class="lp-title">{{ stage.title }}</h3>
            <p class="lp-summary">{{ stage.summary }}</p>
          </div>
          <ul class="lp-chapters">
            <li v-for="c in stage.chapters" :key="c.slug">
              <a v-if="c.ready" class="lp-chip" :href="withBase(`${english ? '/en' : ''}/tutorial/${c.slug}`)">
                <span class="lp-chip-num">{{ c.num }}</span>{{ c.title }}
              </a>
              <span v-else class="lp-chip is-soon" :title="english ? 'Coming soon' : '即将推出'">
                <span class="lp-chip-num">{{ c.num }}</span>{{ c.title }}
              </span>
            </li>
          </ul>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.lp {
  container-type: inline-size;
}
.lp-meta {
  color: var(--vp-c-text-2);
  font-size: 14px;
  margin: 0 0 24px;
}
.lp-stages {
  list-style: none;
  padding: 0 !important;
  margin: 0;
  border-top: 1px solid var(--vp-c-divider);
}
.lp-stage {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  margin: 0 !important;
  padding: 20px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
/* 教程正文比首页窄，按组件自身宽度决定是否展开三列。 */
@container (min-width: 640px) {
  .lp-stage {
    grid-template-columns: 48px 180px minmax(0, 1fr);
    gap: 16px;
  }
}
.lp-dot {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 28px;
  color: var(--vp-c-brand-1);
}
.lp-body {
  display: contents;
}
.lp-head {
  min-width: 0;
}
.lp-title {
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  font-size: 16px !important;
  font-weight: 600;
  line-height: 28px;
}
.lp-summary {
  margin: 2px 0 0 !important;
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.6 !important;
}
.lp-chapters {
  grid-column: 2;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-content: flex-start;
  list-style: none;
  padding: 0 !important;
  margin: 0 !important;
}
@container (min-width: 640px) {
  .lp-chapters {
    grid-column: auto;
  }
}
.lp-chapters li {
  max-width: 100%;
  margin: 0 !important;
}
.lp-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  overflow-wrap: anywhere;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1) !important;
  font-size: 13.5px;
  line-height: 22px;
  text-decoration: none !important;
  transition:
    border-color 0.2s,
    color 0.2s;
}
a.lp-chip:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1) !important;
}
.lp-chip-num {
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}
a.lp-chip .lp-chip-num {
  color: var(--vp-c-brand-1);
}
.lp-chip.is-soon {
  color: var(--vp-c-text-3) !important;
  border-color: transparent;
  cursor: default;
}
</style>
