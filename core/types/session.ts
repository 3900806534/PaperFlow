// PaperFlow Core — Practice session & progress models
export type SessionStatus = 'in_progress' | 'completed'

export interface PracticeSession {
  id: string
  paperId: string
  startedAt: number
  lastActiveAt: number
  completedQuestionIds: string[]
  currentQuestionIndex: number
  status: SessionStatus
}

export interface WrongBookEntry {
  questionId: string
  paperId: string
  wrongCount: number
  lastWrongAt: number
  mastered: boolean
}
