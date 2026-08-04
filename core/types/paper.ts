// PaperFlow Core — Paper & Question data models
// Platform-agnostic, zero dependencies

export enum QuestionType {
  SingleChoice = 'single',
  MultipleChoice = 'multiple',
  TrueFalse = 'truefalse',
  FillBlank = 'fillblank',
  ShortAnswer = 'shortanswer',
}

export interface QuestionOption {
  label: string   // A / B / C / D / 对 / 错
  content: string
}

export interface ParsedQuestion {
  id: string
  paperId: string
  index: number          // 题号 (1-based)
  type: QuestionType
  stem: string           // 题干
  options: QuestionOption[]
  rawText: string        // 原始文本，调试/重解析用
}

export type PaperStatus = 'parsing' | 'ready' | 'error'

export interface Paper {
  id: string
  title: string
  fileName: string
  filePath: string
  totalQuestions: number
  questionTypes: QuestionType[]
  parsedAt: number       // timestamp
  status: PaperStatus
  hasAnswerKey: boolean
  answerKeyPath?: string // 答案文件路径
}
