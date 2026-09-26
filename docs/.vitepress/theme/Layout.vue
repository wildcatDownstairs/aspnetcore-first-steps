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

let switching = false

provide('toggle-appearance', async ({ clientX: x, clientY: y }: MouseEvent) => {
  if (!canAnimate()) {
    isDark.value = !isDark.value
    return
  }
  if (switching) return // 上一次切换还没结束时忽略重复点击
  switching = true

  // 切换期间禁用所有 CSS 过渡、暂停 CSS 动画：
  // View Transition 的新画面是"实时"的，页面上任何仍在变化的元素（颜色过渡、光标闪烁）
  // 都会让浏览器每一帧重新截取整个视口，大屏、高分屏上就会卡顿
  const root = document.documentElement
  root.classList.add('theme-switching')

  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`]
  const transition = document.startViewTransition(async () => {
    isDark.value = !isDark.value
    await nextTick()
  })

  let clip: Animation | undefined
  try {
    await transition.ready
    // 变暗：旧的浅色画面收缩到点击处；变亮：新的浅色画面从点击处展开。
    // fill: 'forwards' 让动画停在最后一帧，否则动画结束到过渡拆除之间的那一帧，
    // 收缩完的旧画面会恢复成完整画面，造成一次闪烁
    clip = root.animate(
      { clipPath: isDark.value ? [...clipPath].reverse() : clipPath },
      {
        duration: 450,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards',
        pseudoElement: `::view-transition-${isDark.value ? 'old' : 'new'}(root)`,
      },
    )
    await transition.finished
  } finally {
    // 带 fill: 'forwards' 的动画不会自动消失，过渡结束后要手动取消，
    // 否则它会残留下来，影响下一次切换时的快照
    clip?.cancel()
    root.classList.remove('theme-switching')
    switching = false
  }
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

/* ---------- 文档页蓝图框架：测量正文栏位置，写入 CSS 变量（配合 style.css 中的说明） ---------- */
const BP_RAIL_OFFSET = 24 // 内轨在正文栏外侧的距离
const BP_GUTTER = 104 // 无侧边栏时，外轨与内轨之间的沟槽宽度
const BP_MIN_MARGIN = 16 // 外轨距视口边缘至少留出的距离

let bpObserver: ResizeObserver | undefined
function layoutBlueprint() {
  const doc = document.querySelector<HTMLElement>('.VPDoc')
  const column = doc?.querySelector<HTMLElement>('.content-container')
  if (!doc || !column) return
  const d = doc.getBoundingClientRect()
  const c = column.getBoundingClientRect()
  const l = c.left - BP_RAIL_OFFSET - d.left
  const r = d.right - (c.right + BP_RAIL_OFFSET)
  let ol: number, or: number
  if (document.querySelector('.VPContent.has-sidebar')) {
    ol = 0 // 左外轨 = 侧边栏边界
    or = r // 右侧是目录，不画外轨（与内轨重合）
  } else {
    const gutter = l - BP_GUTTER >= BP_MIN_MARGIN ? BP_GUTTER : 0
    ol = l - gutter
    or = Math.min(ol, r) // 右外轨与左外轨对称，并且不会越过右内轨
  }
  const vars: Record<string, number> = { l, r, ol, or, gl: l - ol, gr: r - or }
  for (const [k, v] of Object.entries(vars)) doc.style.setProperty(`--bp-${k}`, `${Math.round(v)}px`)
  doc.classList.add('bp-ready')
}
function watchBlueprint() {
  bpObserver?.disconnect()
  const doc = document.querySelector('.VPDoc')
  if (!doc) return
  bpObserver = new ResizeObserver(() => layoutBlueprint())
  bpObserver.observe(doc)
  layoutBlueprint()
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
  watchBlueprint()
})
onUnmounted(() => {
  removeEventListener('scroll', onScroll)
  io?.disconnect()
  bpObserver?.disconnect()
})
watch(
  () => route.path,
  () =>
    nextTick(() => {
      replayEnter()
      onScroll()
      observeReveal()
      watchBlueprint()
    }),
)
</script>

<template>
  <DefaultTheme.Layout>
    <template #home-hero-image>
      <HeroVisual />
    </template>
    <template #layout-bottom>
      <div class="app-noise" aria-hidden="true" />
    </template>
    <template #layout-top>
      <div v-if="frontmatter.layout !== 'home'" class="reading-progress" aria-hidden="true">
        <div class="reading-progress-bar" :style="{ transform: `scaleX(${progress})` }" />
      </div>
    </template>
  </DefaultTheme.Layout>
</template>
