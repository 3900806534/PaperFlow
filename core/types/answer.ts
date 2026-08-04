// PaperFlow Core — Answer & Grading models
// Platform-agnostic, zero dependencies

export interface StandardAnswer {
  questionId: string
  answer: string[]          // ['A'] or ['A','C'] or ['对']
  explanation?: string      // 解析说明
}

export interface UserAnswer {
  questionId: string
  answer: string[]
  answeredAt: number        // timestamp
  duration: number          // 本题耗时（秒）
}

export interface GradeResult {
  questionId: string
  isCorrect: boolean
  userAnswer: string[]
  correctAnswer: string[]
  explanation?: string
}

export interface PaperGradeSummary {
  paperId: string
  totalQuestions: number
  answeredQuestions: number
  correctCount: number
  accuracy: number          // 0-100
  totalDuration: number     // 秒
}
