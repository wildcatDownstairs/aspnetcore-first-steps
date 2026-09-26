<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import { localeCodes, localeForLang, locales } from '../../locales.mts'
import { languagePreferenceCookie } from '../../../../shared/language.mjs'

const { lang, page } = useData()
const current = computed(() => localeForLang(lang.value))
const texts = {
  zh: { change: '切换语言', reading: '阅读语言', source: '基准内容', translation: '译文' },
  en: { change: 'Change language', reading: 'Reading language', source: 'Source', translation: 'Translation' },
  ja: { change: '言語を変更', reading: '表示言語', source: '原文', translation: '翻訳' },
}
const text = computed(() => texts[current.value])
const open = ref(false)
const root = ref<HTMLElement>()
const button = ref<HTMLButtonElement>()
// 相同文件路径对应相同章节；标题的翻译会改变锚点，所以切换时回到该章开头。
const chapter = computed(() => (page.value.isNotFound ? 'index.md' : page.value.relativePath).replace(/^(zh|en|ja)\//, '')
  .replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, ''))
const languages = computed(() => localeCodes.map(code => ({
  code, lang: locales[code].lang, label: locales[code].label,
  note: code === 'zh' ? text.value.source : text.value.translation,
  href: withBase(`/${code}/${chapter.value}`), active: current.value === code,
})))
function choose(code: string) {
  document.cookie = languagePreferenceCookie(code, location.protocol === 'https:')
  close()
}
function close(focus = false) {
  open.value = false
  if (focus) button.value?.focus()
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
      :aria-label="text.change"
      :aria-expanded="open" aria-controls="site-language-options"
      @click="open = !open" @keydown.down.prevent="focusFirst">
      <svg class="language-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" />
      </svg>
      <span>{{ locales[current].short }}</span>
      <svg class="language-chevron" :class="{ expanded: open }" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>
    </button>
    <div v-show="open" id="site-language-options" class="language-options" role="group"
      :aria-label="text.reading">
      <p class="language-caption">{{ text.reading }}</p>
      <a v-for="item in languages" :key="item.code" :href="item.href" :lang="item.lang" :hreflang="item.lang"
        :aria-current="item.active ? 'true' : undefined" @click="choose(item.code)">
        <span><strong>{{ item.label }}</strong><small>{{ item.note }}</small></span>
        <svg v-if="item.active" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
      </a>
    </div>
  </div>
</template>
