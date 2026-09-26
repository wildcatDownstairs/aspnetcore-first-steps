<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useData, useRoute } from 'vitepress'
import { nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import HeroVisual from './components/HeroVisual.vue'

const { isDark, frontmatter } = useData()
const route = useRoute()

/* ---------- 明暗切换：从点击位置圆形扩散（不支持 View Transitions 时直接切换） ---------- */
const canAnimate = () =>
  typeof document !== 'undefined' &&
  'startViewTransition' in document &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

provide('toggle-appearance', async ({ clientX: x, clientY: y }: MouseEvent) => {
  if (!canAnimate()) {
    isDark.value = !isDark.value
    return
  }
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`]
  await document.startViewTransition(async () => {
    isDark.value = !isDark.value
    await nextTick()
  }).ready
  document.documentElement.animate(
    { clipPath: isDark.value ? clipPath.reverse() : clipPath },
    {
      duration: 450,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      pseudoElement: `::view-transition-${isDark.value ? 'old' : 'new'}(root)`,
    },
  )
})

/* ---------- 阅读进度条 ---------- */
const progress = ref(0)
let ticking = false
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - innerHeight
    progress.value = max > 0 ? Math.min(1, scrollY / max) : 0
    ticking = false
  })
}

/* ---------- 滚动进入动画：[data-reveal] 元素进入视口后加 .is-visible ---------- */
let io: IntersectionObserver | undefined
function observeReveal() {
  document.documentElement.classList.add('js-reveal')
  io?.disconnect()
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible')
          io!.unobserve(e.target)
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  )
  document.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((el) => io!.observe(el))
}

/* ---------- 路由切换时让正文淡入 ---------- */
function replayEnter() {
  const el = document.querySelector('.VPContent')
  if (!el) return
  el.classList.remove('page-enter')
  void (el as HTMLElement).offsetWidth // 触发重排，让动画可以重新播放
  el.classList.add('page-enter')
}

onMounted(() => {
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  observeReveal()
})
onUnmounted(() => {
  removeEventListener('scroll', onScroll)
  io?.disconnect()
})
watch(
  () => route.path,
  () =>
    nextTick(() => {
      replayEnter()
      onScroll()
      observeReveal()
    }),
)
</script>

<template>
  <DefaultTheme.Layout>
    <template #home-hero-image>
      <HeroVisual />
    </template>
    <template #layout-top>
      <div v-if="frontmatter.layout !== 'home'" class="reading-progress" aria-hidden="true">
        <div class="reading-progress-bar" :style="{ transform: `scaleX(${progress})` }" />
      </div>
    </template>
  </DefaultTheme.Layout>
</template>
