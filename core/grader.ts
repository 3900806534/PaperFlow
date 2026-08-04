// PaperFlow Core — Grading logic
import type { StandardAnswer, UserAnswer, GradeResult, PaperGradeSummary } from './types/answer'

export function gradeSingle(
  questionId: string,
  userAnswer: UserAnswer | undefined,
  standardAnswer: StandardAnswer | undefined
): GradeResult | null {
  if (!standardAnswer) return null
  const userAns = userAnswer?.answer ?? []
  const correctAns = standardAnswer.answer.map(a => a.toUpperCase())
  
  const sortedUser = [...userAns].map(a => a.toUpperCase()).sort()
  const sortedCorrect = [...correctAns].sort()
  const isCorrect = sortedUser.length === sortedCorrect.length &&
    sortedUser.every((v, i) => v === sortedCorrect[i])

  return {
    questionId,
    isCorrect,
    userAnswer: userAns,
    correctAnswer: correctAns,
    explanation: standardAnswer.explanation,
  }
}

export function gradePaper(
  standardAnswers: StandardAnswer[],
  userAnswers: UserAnswer[],
  totalQuestions: number
): PaperGradeSummary {
  const answerMap = new Map(userAnswers.map(u => [u.questionId, u]))
  const standardMap = new Map(standardAnswers.map(s => [s.questionId, s]))
  
  let correctCount = 0
  let answeredQuestions = 0
  let totalDuration = 0

  for (const [qId, std] of standardMap) {
    const userAns = answerMap.get(qId)
    if (userAns) {
      answeredQuestions++
      totalDuration += userAns.duration
      const result = gradeSingle(qId, userAns, std)
      if (result?.isCorrect) correctCount++
    }
  }

  // Count user answers without standard answers (unscored but answered)
  for (const [qId, userAns] of answerMap) {
    if (!standardMap.has(qId)) {
      answeredQuestions++
      totalDuration += userAns.duration
    }
  }

  return {
    paperId: standardAnswers[0]?.questionId.split('-')[0] ?? '',
    totalQuestions,
    answeredQuestions,
    correctCount,
    accuracy: answeredQuestions > 0 ? Math.round((correctCount / totalQuestions) * 10000) / 100 : 0,
    totalDuration,
  }
}
