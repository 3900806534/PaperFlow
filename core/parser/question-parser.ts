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

// Section marker patterns:
// 1. "专项刷题一" style
// 2. "2012年国考真题" style (annual exam sets in 公考 books)
const SECTION_MARKER_RE = /专项刷题[一二三四五六七八九十]{1,3}/g
// "2012年国考真题" — may have the header-block words glued on by OCR
// two-column layout ("2013年国考真题错题数量：")
const SECTION_ANNUAL_RE = /^\d{4}年[一-鿿A-Za-z（）()一-九十]{2,18}真题(?:起止时间|掌握题型与知识点|错题数量|难度)*：?$/

// TOC / non-question line patterns
const TOC_KEYWORDS = ['目录', '参考答案', '解析', '答案速查', '快速对答案']
const DOTS_RE = /[.．·]{3,}/  // 3+ consecutive dots (TOC leader dots)
// Repeated short lines (page headers/footers like "四逸公考 SIHAICIVILSERVICEEXAMINATION")
// are filtered via buildRepeatLineSet, checked before isNonQuestionLine.

interface Mark { pos: number; len: number; type: 'q' | 'opt' | 'tf'; num?: number; label?: string }

function isTF(text: string): boolean {
  const t = text.replace(/[\.、．）\)\s]/g, '')
  return t === '对' || t === '错' || t === '正确' || t === '错误' || t === '√' || t === '×' || t === 'T' || t === 'F'
}

// ── TOC detection ──────────────────────────────────────────────

/** Check if a line that matches a section marker is actually a TOC entry.
 *  TOC lines have trailing content: "专项刷题一  类比推理 ..... 1"
 *  Real section headers are just: "专项刷题一" */
function isTocLine(line: string): boolean {
  // Strip the section marker, check what's left
  const afterMarker = line.replace(SECTION_MARKER_RE, '').trim()
  // If there's substantial trailing content (≥8 chars) or leader dots → TOC
  if (afterMarker.length >= 8) return true
  if (DOTS_RE.test(afterMarker)) return true
  // If the line has a trailing page number (isolated digits at end after dots/spaces)
  if (/[.．·\s]+\d{1,4}\s*$/.test(afterMarker)) return true
  return false
}

/** Detect TOC page: ≥3 section-marker lines that are very short (< 20 chars)
 *  within a 10-line window. Short marker lines clustered together = TOC listing.
 *  Lines with trailing content (handled by isTocLine) are excluded by the length check. */
function findTocPageIndices(lines: string[]): Set<number> {
  const tocIndices = new Set<number>()
  const markerIndices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    const matches = trimmed.match(SECTION_MARKER_RE)
    // Only short lines (just the section name, no trailing content)
    if (matches && trimmed.length < 20 && !/B站|CCtalk|抖音/.test(trimmed)) {
      for (const _m of matches) markerIndices.push(i)
    }
  }
  // Sliding window: ≥3 short markers within 10 lines → TOC cluster
  for (let i = 0; i < markerIndices.length; i++) {
    let j = i
    while (j < markerIndices.length && markerIndices[j] - markerIndices[i] <= 10) j++
    if (j - i >= 3) {
      for (let k = i; k < j; k++) tocIndices.add(markerIndices[k])
    }
  }
  return tocIndices
}

/** Check if a line is likely a TOC or non-question line that should be skipped. */
function isNonQuestionLine(line: string): boolean {
  const trimmed = line.trim()
  // Ads / watermarks
  if (/B站|CCtalk|抖音|夜色难免|前行必有曙光|大懒猫/.test(trimmed)) return true
  // Book cover / brand lines
  if (/四逸公考|心净公考|SIHAI|CIVILSERVICE|EXAMINATION|JIANOSU|JIANGSU|出版社|升级版|题本篇|镇江|江苏大学|编著/.test(trimmed)) return true
  // Page header repeated in body: "20122018尔国家公务员考试数量"
  if (/国家公务员考试数量/.test(trimmed) && trimmed.length < 30) return true
  for (const kw of TOC_KEYWORDS) {
    if (trimmed.includes(kw)) return true
  }
  if (DOTS_RE.test(trimmed)) return true
  // Page numbers (normalized): "106108110112" long digit run, or "2-3" page range
  if (/^\d{1,4}$/.test(trimmed)) return true
  if (/^\d{4,}$/.test(trimmed)) return true
  if (/^\d{1,3}[-—－]\d{1,3}$/.test(trimmed)) return true
  // Single CJK char lines (page-number artifacts like "台" from "2-3" mis-OCR)
  if (/^[一-鿿]$/.test(trimmed)) return true
  if (/^\s*[Pp]?\.?\s*\d{1,4}\s*$/.test(trimmed) && trimmed.length <= 6) return true
  // Chapter headers that look like year-question patterns but aren't section titles
  // (e.g. "2013年各省份省考数量真题" — verified by splitSections to not be a section start)
  if (SECTION_ANNUAL_RE.test(trimmed) && trimmed.length <= 20) return true
  return false
}

/** Build the set of short lines appearing ≥3 times — these are page headers/footers
 *  repeated on every page (e.g. "四逸公考SIHAICIVILSERVICEEXAMINATION"). */
function buildRepeatLineSet(lines: string[]): Set<string> {
  const counts = new Map<string, number>()
  for (const l of lines) {
    const t = l.trim()
    // Exclude option lines ("B.3" repeats across sections) and digit lines
    if (t.length >= 2 && t.length <= 30 && !/^\d/.test(t) && !/^[A-F][\.、．）\)]/.test(t)) {
      counts.set(t, (counts.get(t) || 0) + 1)
    }
  }
  const set = new Set<string>()
  for (const [t, c] of counts) {
    if (c >= 3) set.add(t)
  }
  return set
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
    // Exclude option-prefixed sub-numbers: "A、（1）三分之一（2）二分之一" —
    // the (1)(2) are sub-items inside an option, not question numbers.
    const isOptionPrefix = /^[A-F][\.、．）\)]?[\s　(（]*$/.test(before) || /^[A-F][\s　]+$/.test(before)
    // Parenthesized numbers ("（2）") are sub-items inside options in many 公考 books —
    // only treat them as question numbers at line start or after a colon.
    const isParenNum = /[）)]$/.test(m[0].trim())
    const posOk = atLineStart || afterColon || (!isParenNum && /[ 　]{2,}$/.test(before))
    if (posOk && !isOptionPrefix) {
      marks.push({ pos: m.index, len: m[0].length, type: 'q', num: parseInt(m[1], 10) })
    }
  }

  // Scan options A-F
  const optRe = /([A-F])\s*[\.、．）\)]/g
  let optCountInLine = 0
  while ((m = optRe.exec(line))) {
    const before = line.slice(0, m.index)
    // First option must start at line start / after colon / after 2+ spaces.
    // Subsequent options on the same line ("B. xx D. yy" layout) pass automatically.
    // No after-content check: options may be glued to the label ("A.忠诚可靠",
    // "A.2", "C. 4") — the standalone check already excludes in-stem false matches.
    const standalone = /(^|\s)$/.test(before) || /[：:]\s*$/.test(before) || /[ 　]{2,}$/.test(before) || optCountInLine > 0
    if (standalone) {
      marks.push({ pos: m.index, len: m[0].length, type: 'opt', label: m[1] })
      optCountInLine++
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

// Group label by exam type, derived from the section title (reliable, no OCR
// chapter-header dependency): "国家公务员考试（国考）" / "多省份联考" / "各省份省考"
function chapterForSection(name: string): string {
  if (/国考/.test(name)) return '国家公务员考试（国考）'
  if (/联考/.test(name)) return '多省份联考'
  if (/省考|市考|区考|招警|政法干警|省直/.test(name)) return '各省份省考'
  if (/专项刷题/.test(name)) return '专项刷题'
  return ''
}

// Split raw text into named sections by markers like 专项刷题一 / 第X套
// Returns sections with an optional chapter label for grouping display.
export function splitSections(rawText: string): { name: string; chapter: string; text: string }[] {
  const normalized = normalizeText(rawText)
  const lines = normalized.split(/\r?\n/)
  const sections: { name: string; chapter: string; text: string }[] = []
  let current: { name: string; chapter: string; lines: string[] } | null = null

  // Pre-compute TOC page indices (sliding window detection)
  const tocPageIndices = findTocPageIndices(lines)
  // Pre-compute repeated page-header lines
  const repeatSet = buildRepeatLineSet(lines)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Skip known TOC page lines entirely
    if (tocPageIndices.has(i)) continue
    // Skip repeated page headers/footers
    if (repeatSet.has(line.trim())) continue

    const allMatches = line.match(SECTION_MARKER_RE) || []
    const isSingleMarker = allMatches.length === 1
    const isAdLine = /B站|CCtalk|抖音/.test(line)
    // Annual-exam title ("2012年国考真题") — only a real section boundary if the
    // next few lines are the fixed header block (起止时间/掌握题型/错题数量/难度)
    // or a question number. Chapter headers ("2013年各省份省考数量真题") fail this.
    const isAnnualCandidate = SECTION_ANNUAL_RE.test(line.trim())
    let isAnnualHeader = false
    if (isAnnualCandidate) {
      const nextText = lines.slice(i + 1, i + 4).join('\n')
      isAnnualHeader = /起止时间|掌握题型|错题数量|难度/.test(nextText) || /^\s*\d{1,3}\s*[\.、．）\)]/.test(nextText)
    }

    if ((isSingleMarker && !isAdLine && !isTocLine(line)) || isAnnualHeader) {
      // Genuine section header (not TOC, not ad, not page header)
      const name = isAnnualHeader ? line.trim() : (allMatches[0] || line.trim())
      if (current) sections.push({ name: current.name, chapter: current.chapter, text: current.lines.join('\n') })
      // Chapter grouping by exam type — reliable, derived from the section title
      current = { name, chapter: chapterForSection(name), lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) sections.push({ name: current.name, chapter: current.chapter, text: current.lines.join('\n') })

  // Fallback: no section markers found — treat whole document as one section
  if (sections.length === 0) {
    sections.push({ name: '全部', chapter: '', text: normalized })
  }
  return sections
}

// ── Scanned PDF section splitting (page-density based) ─────────

/** Split scanned PDF pages into sections by text density.
 *  Pages with ≤3 lines of OCR text are treated as section boundaries (title/separator pages).
 *  Returns sections with auto-generated or extracted names. */
export function splitByPageDensity(pages: string[]): { name: string; chapter: string; text: string }[] {
  if (pages.length <= 1) {
    return [{ name: '全部', chapter: '', text: pages[0] || '' }]
  }

  // Count non-empty lines per page
  const pageLineCounts = pages.map(p => {
    const trimmed = p.trim()
    if (!trimmed) return 0
    return trimmed.split(/\r?\n/).filter(l => l.trim().length > 0).length
  })

  // Find boundary pages: pages with very few lines (title/separator pages)
  const boundaries: number[] = []
  for (let i = 0; i < pageLineCounts.length; i++) {
    if (pageLineCounts[i] <= 3) {
      boundaries.push(i)
    }
  }

  // If no clear boundaries, or too many pages are sparse (e.g. all 1-line test data),
  // fall back to single section
  if (boundaries.length === 0 || boundaries.length > pages.length * 0.6) {
    return [{ name: '全部', chapter: '', text: pages.join('\n') }]
  }

  // Build sections from boundaries
  const sections: { name: string; chapter: string; text: string }[] = []
  let sectionStart = 0

  for (let i = 0; i < boundaries.length; i++) {
    const boundaryPage = boundaries[i]

    // Skip leading empty boundary pages
    if (boundaryPage === sectionStart) {
      // Try to extract name from this boundary page
      const nameText = pages[boundaryPage].trim().slice(0, 30) || `第${i + 1}部分`
      sectionStart = boundaryPage + 1
      // If next section hasn't started yet, store potential name
      if (i + 1 < boundaries.length || sectionStart < pages.length) {
        // This boundary is a candidate section header — carry the name forward
        continue // handled below
      }
    }

    // Content pages from sectionStart to boundaryPage
    if (boundaryPage > sectionStart) {
      const contentPages = pages.slice(sectionStart, boundaryPage)
      const content = contentPages.join('\n').trim()
      if (content.length > 0) {
        // Try to extract name from the previous boundary page
        let name = `第${sections.length + 1}部分`
        if (sectionStart > 0) {
          const prevPageText = pages[sectionStart - 1].trim()
          if (prevPageText.length > 0 && prevPageText.length < 50) {
            name = prevPageText.slice(0, 20)
          }
        }
        sections.push({ name, chapter: '', text: content })
      }
      sectionStart = boundaryPage + 1
    } else {
      sectionStart = boundaryPage + 1
    }
  }

  // Handle trailing content after last boundary
  if (sectionStart < pages.length) {
    const contentPages = pages.slice(sectionStart)
    const content = contentPages.join('\n').trim()
    if (content.length > 0) {
      let name = `第${sections.length + 1}部分`
      if (sectionStart > 0) {
        const prevPageText = pages[sectionStart - 1].trim()
        if (prevPageText.length > 0 && prevPageText.length < 50) {
          name = prevPageText.slice(0, 20)
        }
      }
      sections.push({ name, chapter: '', text: content })
    }
  }

  // If density split produced nothing useful, fall back to whole document
  if (sections.length === 0) {
    return [{ name: '全部', chapter: '', text: pages.join('\n') }]
  }

  return sections
}

export function parseQuestions(paperId: string, rawText: string): ParsedQuestion[] {
  resetQuestionCounter()
  const allLines = normalizeText(rawText).split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  // Filter repeated page headers/footers before parsing
  const repeatSet = buildRepeatLineSet(allLines)
  const lines = allLines.filter(l => !repeatSet.has(l))
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
    // Skip ad watermarks, TOC lines, page numbers
    if (isNonQuestionLine(line)) continue

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
        // Only applies once a question context exists — first question of a section
        // may legitimately start at any number (16, 31, ...) in multi-set books.
        const hasContext = questions.length > 0 || current !== null
        const prevNum = current ? current.index : (questions.length > 0 ? questions[questions.length - 1].index : 0)
        const nextNum = marks[i + 1] && marks[i + 1].type === 'q' ? marks[i + 1].num! : prevNum + 1
        const isPageNumber = hasContext && Math.abs(mark.num! - prevNum) > 2 && Math.abs(nextNum - prevNum) === 1
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
