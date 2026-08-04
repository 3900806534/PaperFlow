// PaperFlow Core — Progress calculation
import type { PracticeSession } from './types/session'

export function calcProgress(session: PracticeSession, totalQuestions: number): {
  completed: number
  total: number
  percentage: number
} {
  const completed = session.completedQuestionIds.length
  return {
    completed,
    total: totalQuestions,
    percentage: totalQuestions > 0 ? Math.round((completed / totalQuestions) * 100) : 0,
  }
}

export function getResumeIndex(session: PracticeSession, totalQuestions: number): number {
  if (session.status === 'completed') return totalQuestions - 1
  // Resume from the question after the last completed one
  return Math.min(session.currentQuestionIndex, totalQuestions - 1)
}

export function isSessionComplete(session: PracticeSession, totalQuestions: number): boolean {
  return session.completedQuestionIds.length >= totalQuestions
}
