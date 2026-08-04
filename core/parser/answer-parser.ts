// PaperFlow Core — Parse answer text into structured answers
import type { StandardAnswer } from '../types/answer'

// Parse answer strings like "1-5: ABCDD, 6-10: CBADA" or "1.A 2.B 3.C"
export function parseAnswerText(rawText: string, paperId: string, questionIds: string[]): StandardAnswer[] {
  const answers: StandardAnswer[] = []
  const cleaned = rawText.replace(/\s+/g, ' ').trim()
  
  // Try range format: "1-5: ABCDD"
  const rangeRe = /(\d+)\s*[-–—]\s*(\d+)\s*[:：]\s*([A-Fa-f对错√×TF]+)/g
  let match: RegExpExecArray | null
  while ((match = rangeRe.exec(cleaned)) !== null) {
    const start = parseInt(match[1], 10)
    const end = parseInt(match[2], 10)
    const answerStr = match[3].toUpperCase()
    for (let i = start; i <= end && (i - start) < answerStr.length; i++) {
      const qId = questionIds[i - 1]
      if (qId) {
        answers.push({ questionId: qId, answer: [answerStr[i - start]] })
      }
    }
    if (answers.length > 0) return answers
  }

  // Try single format: "1.A  2.B  3.C" or "1:A 2:B 3:C"
  const singleRe = /(\d+)\s*[\.、:：]\s*([A-Fa-f对错√×TF])/g
  while ((match = singleRe.exec(cleaned)) !== null) {
    const idx = parseInt(match[1], 10)
    const qId = questionIds[idx - 1]
    if (qId) {
      const ans = match[2].toUpperCase()
      const label = ans === '√' ? '对' : ans === '×' ? '错' : ans
      const final = (label === 'T') ? '对' : (label === 'F') ? '错' : label
      answers.push({ questionId: qId, answer: [final] })
    }
  }
  return answers
}

// Parse PDF-extracted answer text (full answer key with explanations)
export function parsePdfAnswerText(rawText: string, paperId: string, questionIds: string[]): StandardAnswer[] {
  const answers: StandardAnswer[] = []
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  
  const qNumRe = /^(?:第\s*)?(\d+)\s*[\.、．）\)题]\s*/
  const answerRe = /答案\s*[:：]\s*([A-Fa-f对错√×TF]+)/i
  const explainRe = /解析\s*[:：]\s*(.+)/i

  let currentIdx = -1
  let currentAnswer = ''
  let currentExplain = ''

  function flush() {
    if (currentIdx > 0 && currentAnswer) {
      const qId = questionIds[currentIdx - 1]
      if (qId) {
        const ans = currentAnswer.toUpperCase()
        const label = ans === '√' ? '对' : ans === '×' ? '错' : ans
        const final = (label === 'T') ? '对' : (label === 'F') ? '错' : label
        answers.push({ questionId: qId, answer: [final], explanation: currentExplain || undefined })
      }
    }
    currentIdx = -1
    currentAnswer = ''
    currentExplain = ''
  }

  for (const line of lines) {
    const qMatch = line.match(qNumRe)
    if (qMatch) {
      flush()
      currentIdx = parseInt(qMatch[1], 10)
    }
    
    const aMatch = line.match(answerRe)
    if (aMatch) {
      currentAnswer = aMatch[1]
    }
    
    const eMatch = line.match(explainRe)
    if (eMatch) {
      currentExplain = eMatch[1]
    }
  }
  flush()
  return answers
}
