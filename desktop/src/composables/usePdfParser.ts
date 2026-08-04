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
      const data = await readFile(filePath)
      
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
      const textParts: string[] = []
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        
        // Rebuild line structure using y-coordinates
        // pdf.js gives flat items; y position changes indicate new lines
        let pageText = ''
        let lastY: number | null = null
        let lastX: number | null = null
        for (const item of content.items as any[]) {
          const y = item.transform?.[5] ?? 0
          const x = item.transform?.[4] ?? 0
          if (lastY !== null) {
            if (Math.abs(y - lastY) > 3) {
              pageText += '\n'        // new line
            } else if (lastX !== null && x > lastX + 2) {
              pageText += ' '         // same line, space between items
            }
          }
          pageText += item.str
          lastY = y
          lastX = x
        }
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
