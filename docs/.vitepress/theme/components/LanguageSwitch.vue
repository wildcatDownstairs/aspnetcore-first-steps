<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import { languageStorageKey } from '../locale-preference.mjs'

const { lang, page } = useData()
const english = computed(() => lang.value === 'en')
const open = ref(false)
const root = ref<HTMLElement>()
const button = ref<HTMLButtonElement>()
// 相同文件路径对应相同章节；标题的翻译会改变锚点，所以切换时回到该章开头。
const chapter = computed(() => page.value.relativePath.replace(/^en\//, '')
  .replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, ''))
const languages = computed(() => [
  { code: 'zh-CN', label: '简体中文', note: english.value ? 'Source' : '基准内容', href: withBase('/' + chapter.value), active: !english.value },
  { code: 'en', label: 'English', note: english.value ? 'Translation' : '英文译文', href: withBase('/en/' + chapter.value), active: english.value },
])
function close(focus = false) {
  open.value = false
  if (focus) button.value?.focus()
}
function chooseLanguage(language: string) {
  try { localStorage.setItem(languageStorageKey, language) } catch { /* Storage may be disabled. */ }
  close()
}
async function focusFirst() {
  open.value = true
  await nextTick()
  root.value?.querySelector<HTMLAnchorElement>('a')?.focus()
}
function outside(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close()
}
function focusOut(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null)) close()
}
watch(() => page.value.relativePath, () => close())
onMounted(() => document.addEventListener('pointerdown', outside))
onUnmounted(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="root" class="language-switch" @keydown.esc.stop.prevent="close(true)" @focusout="focusOut">
    <button ref="button" class="language-trigger" type="button"
      :aria-label="english ? 'Change language' : '切换语言'"
      :aria-expanded="open" aria-controls="site-language-options"
      @click="open = !open" @keydown.down.prevent="focusFirst">
      <svg class="language-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" />
      </svg>
      <span>{{ english ? 'EN' : '中文' }}</span>
      <svg class="language-chevron" :class="{ expanded: open }" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>
    </button>
    <div v-if="open" id="site-language-options" class="language-options" role="group"
      :aria-label="english ? 'Reading language' : '阅读语言'">
      <p class="language-caption">{{ english ? 'Reading language' : '阅读语言' }}</p>
      <a v-for="item in languages" :key="item.code" :href="item.href" :lang="item.code" :hreflang="item.code"
        :aria-current="item.active ? 'true' : undefined" @click="chooseLanguage(item.code)">
        <span><strong>{{ item.label }}</strong><small>{{ item.note }}</small></span>
        <svg v-if="item.active" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
      </a>
    </div>
  </div>
</template>
