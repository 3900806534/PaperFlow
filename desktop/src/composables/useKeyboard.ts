import { onMounted, onUnmounted } from 'vue'
export function useKeyboard(handlers: Record<string, (arg?: string) => void>) {
  const map: Record<string,string> = { '1':'A','2':'B','3':'C','4':'D','5':'E','6':'F' }
  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    const key = e.key.toUpperCase()
    if (key === 'ENTER') { handlers['Enter']?.(); return }
    if (key === 'ARROWLEFT') { handlers['ArrowLeft']?.(); return }
    if (key === 'ARROWRIGHT') { handlers['ArrowRight']?.(); return }
    const mapped = map[e.key] || key
    if (mapped >= 'A' && mapped <= 'F') handlers['option']?.(mapped)
  }
  onMounted(() => document.addEventListener('keydown', onKey))
  onUnmounted(() => document.removeEventListener('keydown', onKey))
}
