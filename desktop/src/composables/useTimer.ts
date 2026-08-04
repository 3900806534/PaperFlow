import { ref, onUnmounted } from 'vue'

export function useTimer() {
  const elapsed = ref(0)
  const isRunning = ref(false)
  let intervalId: ReturnType<typeof setInterval> | null = null

  function start() {
    if (isRunning.value) return
    isRunning.value = true
    elapsed.value = 0
    intervalId = setInterval(() => { elapsed.value++ }, 1000)
  }

  function pause() {
    isRunning.value = false
    if (intervalId) { clearInterval(intervalId); intervalId = null }
  }

  function reset() {
    pause()
    elapsed.value = 0
  }

  function getElapsedSeconds(): number { return elapsed.value }

  onUnmounted(() => pause())

  return { elapsed, isRunning, start, pause, reset, getElapsedSeconds }
}
