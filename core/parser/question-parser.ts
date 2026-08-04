// PaperFlow Core — Parse raw PDF text into structured questions
import type { ParsedQuestion, QuestionOption } from '../types/paper'
import { QuestionType } from '../types/paper'

let questionCounter = 0
function genId(paperId: string): string {
  return `${paperId}-q${++questionCounter}-${Date.now()}`
}

export function resetQuestionCounter(): void {
  questionCounter = 0
}

// Match question numbers: "1.", "1、", "1）", "1)", "(1)", "第1题"
const Q_NUM_RE = /^(?:第\s*)?(\d+)\s*[\.、．）\)题]\s*/

// Match option labels: "A.", "A、", "A）", "A)", "(A)"
const OPTION_RE = /^([A-F])\s*[\.、．）\)]\s*/

// Answer-like option labels for True/False
const TF_RE = /^(对|错|正确|错误|√|×|T|F)\s*[\.、．）\)]?\s*/

// Detect option start
function isOptionStart(line: string): boolean {
  return OPTION_RE.test(line) || /^[A-F]\s*[\.、．）\)]/.test(line)
}

// Detect new question start
function isQuestionStart(line: string): boolean {
  return Q_NUM_RE.test(line)
}

// Detect question type from stem and options
function detectType(stem: string, options: QuestionOption[]): QuestionType {
  const optLabels = options.map(o => o.label)
  const tfLabels = ['对', '错', '正确', '错误', '√', '×', 'T', 'F']
  if (optLabels.length === 2 && optLabels.every(l => tfLabels.includes(l))) {
    return QuestionType.TrueFalse
  }
  if (optLabels.length >= 2 && optLabels.every(l => /^[A-F]$/.test(l))) {
    return QuestionType.SingleChoice
  }
  if (options.length === 0) {
    const stemLower = stem.toLowerCase()
    if (/填空|填空|______|___/.test(stemLower)) return QuestionType.FillBlank
    if (/简答|简述|论述|问答/.test(stemLower)) return QuestionType.ShortAnswer
  }
  return QuestionType.SingleChoice
}

export function parseQuestions(paperId: string, rawText: string): ParsedQuestion[] {
  resetQuestionCounter()
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  const questions: ParsedQuestion[] = []
  let current: { index: number; stemLines: string[]; optionLines: string[]; rawLines: string[] } | null = null

  function flushQuestion() {
    if (!current || current.stemLines.length === 0) return
    const stem = current.stemLines.join('\n').trim()
    const options = parseOptions(current.optionLines)
    const type = detectType(stem, options)
    const rawText = current.rawLines.join('\n')
    questions.push({
      id: genId(paperId),
      paperId,
      index: current.index,
      type,
      stem,
      options,
      rawText,
    })
    current = null
  }

  for (const line of lines) {
    if (isQuestionStart(line)) {
      flushQuestion()
      const m = line.match(Q_NUM_RE)!
      current = {
        index: parseInt(m[1], 10),
        stemLines: [line.replace(Q_NUM_RE, '').trim()],
        optionLines: [],
        rawLines: [line],
      }
    } else if (current && isOptionStart(line)) {
      current.optionLines.push(line)
      current.rawLines.push(line)
    } else if (current) {
      // Part of stem (multi-line)
      current.stemLines.push(line)
      current.rawLines.push(line)
    }
  }
  flushQuestion()
  return questions
}

function parseOptions(optionLines: string[]): QuestionOption[] {
  const options: QuestionOption[] = []
  for (const line of optionLines) {
    let m = line.match(OPTION_RE)
    if (m) {
      options.push({ label: m[1], content: line.replace(OPTION_RE, '').trim() })
      continue
    }
    m = line.match(/^([对错正确错误√×TF])\s*[\.、．）\)]?\s*(.*)/)
    if (m) {
      const label = m[1] === '√' ? '对' : m[1] === '×' ? '错' : m[1] === 'T' ? '对' : m[1] === 'F' ? '错' : m[1]
      options.push({ label, content: m[2] || label })
      continue
    }
    // Appending to last option's content
    if (options.length > 0) {
      options[options.length - 1].content += ' ' + line.trim()
    }
  }
  return options
}
