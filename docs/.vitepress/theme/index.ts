import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import LearningPath from './components/LearningPath.vue'
import '@fontsource-variable/jetbrains-mono'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('LearningPath', LearningPath)
  },
} satisfies Theme
