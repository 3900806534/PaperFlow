// PaperFlow OCR module — Windows built-in OCR via Rust backend (WinRT Media.Ocr)
// Zero models, fully offline, native zh-CN support. Image → base64 → invoke('ocr_image') → lines

export interface OCRResult {
  text: string
  quality: 'good' | 'low' | 'empty'
}

export function detectFormulaLike(text: string): boolean {
  const mathSymbols = (text.match(/[+\-×÷=√²³∑∫∞πθ≤≥≈±]/g) || []).length
  const isolatedLetters = (text.match(/(?<![A-Za-z0-9])[A-Za-z](?![A-Za-z0-9])/g) || []).length
  return mathSymbols > 3 || isolatedLetters > 6
}

export function assessQuality(text: string): OCRResult['quality'] {
  if (text.trim().length === 0) return 'empty'
  if (detectFormulaLike(text)) return 'low'
  if (text.trim().length < 8) return 'low'
  return 'good'
}

export function isScannedPdf(textLength: number): boolean {
  return textLength < 100
}

// Timeout wrapper: OCR should never hang the import flow
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`${label} 超时(${ms / 1000}s)`)), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    clearTimeout(timer)
  }
}

// Compress image to PNG base64 (lossless, better OCR accuracy than JPEG)
function canvasToPngBase64(img: HTMLImageElement): string {
  const scale = Math.min(1, 4000 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png').split(',')[1]
}

export async function recognizeImage(img: HTMLImageElement): Promise<OCRResult> {
  const { invoke } = await import('@tauri-apps/api/core')
  const base64 = canvasToPngBase64(img)
  let lines: { text: string }[] | null = null
  // Primary: Umi-OCR (PaddleOCR v3 engine, much better for Chinese/math)
  try {
    lines = await withTimeout(invoke<{ text: string }[]>('umi_ocr_image', { base64Img: base64 }), 90000, 'Umi-OCR')
  } catch (e) {
    console.warn('Umi-OCR 不可用，回退 Windows OCR:', e)
  }
  // Fallback: Windows built-in OCR
  if (!lines) {
    try {
      lines = await withTimeout(invoke<{ text: string }[]>('ocr_image', { base64Img: base64 }), 60000, 'Windows OCR')
    } catch (e) {
      console.warn('Windows OCR 也失败:', e)
    }
  }
  const text = (lines || []).map(l => l.text).join('\n').trim()
  return { text, quality: assessQuality(text) }
}
