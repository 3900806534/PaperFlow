import { ref } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export function usePdfParser() {
  const isParsing = ref(false)
  const parseError = ref<string | null>(null)

  async function extractText(filePath: string): Promise<string> {
    isParsing.value = true
    parseError.value = null
    try {
      if (!filePath) throw new Error('文件路径为空')
      
      const { readFile } = await import('@tauri-apps/plugin-fs')
      // Correct: readFile takes a string path (NOT an object)
      const data = await readFile(filePath)
      
      // Convert Uint8Array to ArrayBuffer for pdf.js
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
      const textParts: string[] = []
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items.map((item: any) => item.str).join(' ')
        textParts.push(pageText)
      }
      return textParts.join('\n')
    } catch (e: any) {
      parseError.value = e?.message ?? 'PDF解析失败'
      throw new Error(`PDF解析失败: ${e?.message || e}`)
    } finally {
      isParsing.value = false
    }
  }

  return { isParsing, parseError, extractText }
}
