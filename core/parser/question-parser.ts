// PaperFlow Core — Parse raw PDF text into structured questions
// Handles: line-based questions, inline question numbers, options sharing line with stem tail
import type { ParsedQuestion, QuestionOption } from '../types/paper'
import { QuestionType } from '../types/paper'

let questionCounter = 0
function genId(paperId: string): string {
  return `${paperId}-q${++questionCounter}-${Date.now()}`
}

export function resetQuestionCounter(): void {
  questionCounter = 0
}

// Question number: "1." "1、" "1）" "(1)" "第1题" "1 ." (space-separated)
const Q_NUM_RE = /(?:第\s*)?(\d{1,3})\s*[\.、．）\)题]/
// Option label: "A." "A、" "A）" "(A)" "A ."
const OPT_RE = /([A-F])\s*[\.、．）\)]/
// True/False labels
const TF_LABELS = ['对', '错', '正确', '错误', '√', '×', 'T', 'F']

interface Mark { pos: number; len: number; type: 'q' | 'opt' | 'tf'; num?: number; label?: string }

function isTF(text: string): boolean {
  const t = text.replace(/[\.、．）\)\s]/g, '')
  return t === '对' || t === '错' || t === '正确' || t === '错误' || t === '√' || t === '×' || t === 'T' || t === 'F'
}

// Scan a line for question-number and option marks (inline-aware)
function scanLine(line: string): Mark[] {
  const marks: Mark[] = []

  // Scan question numbers: digits followed by separator, next char not digit (avoid "6.5元")
  const qRe = /(?:第\s*)?(\d{1,3})\s*[\.、．）\)题](?=\s|[^0-9])/g
  let m: RegExpExecArray | null
  while ((m = qRe.exec(line))) {
    // Heuristic: question numbers usually at line start or after 2+ spaces (column layout)
    const before = line.slice(0, m.index)
    const atLineStart = before.trim().length === 0
    const afterColon = /[：:]\s*$/.test(before)
    if (atLineStart || afterColon || /[ 　]{2,}$/.test(before)) {
      marks.push({ pos: m.index, len: m[0].length, type: 'q', num: parseInt(m[1], 10) })
    }
  }

  // Scan options A-F
  const optRe = /([A-F])\s*[\.、．）\)](?=\s|[^0-9])/g
  while ((m = optRe.exec(line))) {
    const before = line.slice(0, m.index)
    const after = line.slice(m.index + m[0].length)
    const afterSpace = after.length === 0 || /^\s/.test(after)
    const standalone = /(^|\s)$/.test(before) || /[：:]\s*$/.test(before) || /[ 　]{2,}$/.test(before)
    if (afterSpace && standalone) {
      marks.push({ pos: m.index, len: m[0].length, type: 'opt', label: m[1] })
    }
  }

  // Scan True/False labels: 对. 错、 正确 等
  const tfRe = /(对|错|正确|错误|√|×|T|F)\s*[\.、．）\)]?(?=\s|[^对错正确错误√×TF])/g
  while ((m = tfRe.exec(line))) {
    const before = line.slice(0, m.index)
    if (/(^|\s)$/.test(before) || /[：:]\s*$/.test(before) || /[ 　]{2,}$/.test(before)) {
      const seg = line.slice(m.index, m.index + m[0].length).trim().replace(/[\.、．）\)]$/, '')
      if (isTF(seg)) {
        marks.push({ pos: m.index, len: m[0].length, type: 'tf', label: seg })
      }
    }
  }

  return marks.sort((a, b) => a.pos - b.pos)
}

// Some PDF pages embed every char as a separate text item joined by spaces
// ("2 0 2 6 国 考" or "3 0 . 题干"). Collapse single spaces between CJK/alnum chars.
export function normalizeText(text: string): string {
  return text.replace(/([一-鿿A-Za-z0-9]) (?=[一-鿿A-Za-z0-9])/g, '$1')
}

// Split raw text into named sections by markers like 专项刷题一 / 第X套
export function splitSections(rawText: string): { name: string; text: string }[] {
  const lines = normalizeText(rawText).split(/\r?\n/)
  const sections: { name: string; text: string }[] = []
  let current: { name: string; lines: string[] } | null = null

  for (const line of lines) {
    const allMatches = line.match(/专项刷题[一二三四五六七八九十]{1,3}/g) || []
    if (allMatches.length === 1 && !line.includes('B站') && !line.includes('CCtalk')) {
      // Single section marker on this line = new section (skip TOC lines with multiple markers)
      if (current) sections.push({ name: current.name, text: current.lines.join('\n') })
      current = { name: allMatches[0], lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) sections.push({ name: current.name, text: current.lines.join('\n') })
  return sections
}

export function parseQuestions(paperId: string, rawText: string): ParsedQuestion[] {
  resetQuestionCounter()
  const lines = normalizeText(rawText).split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  const questions: ParsedQuestion[] = []

  let current: { index: number; stemLines: string[]; optionLines: string[]; rawLines: string[] } | null = null
  let pendingStem: string[] = []

  function flushQuestion() {
    if (!current || current.stemLines.length === 0) return
    const stem = current.stemLines.join('\n').trim()
    const options = parseOptions(current.optionLines)
    const type = detectType(stem, options)
    questions.push({
      id: genId(paperId),
      paperId,
      index: current.index,
      type,
      stem,
      options,
      rawText: current.rawLines.join('\n'),
    })
    current = null
  }

  function newQuestion(num: number, content: string) {
    flushQuestion()
    current = {
      index: num,
      stemLines: [content.trim()],
      optionLines: [],
      rawLines: [content.trim()],
    }
  }

  function addOption(label: string, content: string) {
    if (!current) return
    current.optionLines.push(`${label}. ${content.trim()}`)
    current.rawLines.push(`${label}. ${content.trim()}`)
  }

  function addStem(text: string) {
    if (!current) return
    current.stemLines.push(text.trim())
    current.rawLines.push(text.trim())
  }

  for (const line of lines) {
    // Skip page-header lines (contain page numbers that look like question numbers)
    if (/B站|CCtalk|抖音|夜色难免|前行必有曙光|大懒猫/.test(line)) continue

    const marks = scanLine(line)

    // No marks: continue stem, or accumulate orphan stem once current question has all 4 options
    // (question number lost by PDF layout — e.g. material-based questions spanning pages)
    if (marks.length === 0) {
      if (current && current.optionLines.length < 4) addStem(line)
      else if (current && current.optionLines.length >= 4) pendingStem.push(line)
      else pendingStem.push(line)
      continue
    }

    // Split line by marks: each mark's content runs to the next mark
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i]
      const nextPos = i + 1 < marks.length ? marks[i + 1].pos : line.length
      const content = line.slice(mark.pos + mark.len, nextPos).trim()
      const before = line.slice(0, mark.pos).trim()

      if (mark.type === 'q') {
        // Filter page numbers: isolated number jumping from the sequence (e.g. page "43" between 22 and 23)
        // Use current.index when open (not yet flushed into questions)
        const prevNum = current ? current.index : (questions.length > 0 ? questions[questions.length - 1].index : 0)
        const nextNum = marks[i + 1] && marks[i + 1].type === 'q' ? marks[i + 1].num! : prevNum + 1
        const isPageNumber = Math.abs(mark.num! - prevNum) > 2 && Math.abs(nextNum - prevNum) === 1
        if (!isPageNumber) {
          newQuestion(mark.num!, (before + ' ' + content).trim())
          pendingStem = []
        }
      } else if (mark.type === 'opt' || mark.type === 'tf') {
        // Option: content after the label is the option text
        if (current && current.optionLines.length < 4) {
          addOption(mark.label!, content)
        } else if (current && current.optionLines.length >= 4 && pendingStem.length > 0) {
          // New question starts while previous one is full (4 options) — lost question number.
          // Flush previous, create the orphan question with the accumulated stem.
          const prevNum: number = current.index
          flushQuestion()
          current = {
            index: prevNum + 1,
            stemLines: [...pendingStem],
            optionLines: [],
            rawLines: [...pendingStem],
          }
          pendingStem = []
          addOption(mark.label!, content)
        } else if (!current && pendingStem.length > 0) {
          // Orphan stem + options = question with lost number; assign next sequential number
          const prevNum = questions.length > 0 ? questions[questions.length - 1].index : 0
          current = {
            index: prevNum + 1,
            stemLines: [...pendingStem],
            optionLines: [],
            rawLines: [...pendingStem],
          }
          pendingStem = []
          addOption(mark.label!, content)
        }
      }
    }
  }
  flushQuestion()
  return questions
}

function parseOptions(optionLines: string[]): QuestionOption[] {
  const options: QuestionOption[] = []
  for (const line of optionLines) {
    const m = line.match(/^([A-F对错正确错误√×TF])\s*[\.、．）\)]?\s*(.*)/)
    if (m) {
      let label = m[1]
      if (label === '√' || label === 'T') label = '对'
      if (label === '×' || label === 'F') label = '错'
      options.push({ label, content: m[2] || label })
    }
  }
  return options
}

function detectType(stem: string, options: QuestionOption[]): QuestionType {
  const labels = options.map(o => o.label)
  if (labels.length === 2 && labels.every(l => TF_LABELS.includes(l))) {
    return QuestionType.TrueFalse
  }
  if (labels.length >= 2 && labels.every(l => /^[A-F]$/.test(l))) {
    return QuestionType.SingleChoice
  }
  if (options.length === 0) {
    if (/填空|______|___/.test(stem)) return QuestionType.FillBlank
    if (/简答|简述|论述|问答/.test(stem)) return QuestionType.ShortAnswer
  }
  return QuestionType.SingleChoice
}
