import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const storagePath = ref('D:/PaperFlowData')
  const floatBallVisible = ref(true)
  const floatBallTop = ref(true)
  const theme = ref<'light' | 'dark'>('light')

  function setStoragePath(path: string) { storagePath.value = path }
  function toggleFloatBall() { floatBallVisible.value = !floatBallVisible.value }
  function setFloatBallTop(top: boolean) { floatBallTop.value = top }
  function setTheme(t: 'light' | 'dark') { theme.value = t }

  return {
    storagePath, floatBallVisible, floatBallTop, theme,
    setStoragePath, toggleFloatBall, setFloatBallTop, setTheme,
  }
})
