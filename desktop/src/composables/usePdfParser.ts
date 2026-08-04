import { ref } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export function usePdfParser() {
  const isParsing = ref(false)
  const parseError = ref<string | null>(null)

  async function extractText(filePath: string): Promise<string> {
    isParsing.value = true
    parseError.value = null
    try {
      // For Tauri: read file as ArrayBuffer via Tauri FS API
      const { readFile } = await import('@tauri-apps/plugin-fs')
      const data = await readFile(filePath)
      const pdf = await pdfjsLib.getDocument({ data: data.buffer }).promise
      const textParts: string[] = []
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items
          .map((item: any) => item.str)
          .join(' ')
        textParts.push(pageText)
      }
      return textParts.join('\n')
    } catch (e: any) {
      parseError.value = e?.message ?? 'PDF解析失败'
      throw e
    } finally {
      isParsing.value = false
    }
  }

  return { isParsing, parseError, extractText }
}
