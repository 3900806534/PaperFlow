import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Paper, ParsedQuestion } from '@core/types/paper'
import type { StandardAnswer, UserAnswer, PaperGradeSummary } from '@core/types/answer'
import type { PracticeSession, WrongBookEntry } from '@core/types/session'
import { parseQuestions } from '@core/parser/question-parser'
import { parseAnswerText } from '@core/parser/answer-parser'
import { gradePaper } from '@core/grader'
import { calcProgress } from '@core/progress'

export const usePaperStore = defineStore('paper', () => {
  const papers = ref<Paper[]>([])
  const currentPaper = ref<Paper | null>(null)
  const currentQuestions = ref<ParsedQuestion[]>([])
  const currentAnswers = ref<StandardAnswer[]>([])
  const userAnswers = ref<Map<string, UserAnswer>>(new Map())
  const currentSession = ref<PracticeSession | null>(null)
  const wrongBook = ref<WrongBookEntry[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const questionCount = computed(() => currentQuestions.value.length)
  const answeredCount = computed(() => currentSession.value?.completedQuestionIds.length ?? 0)
  const progressPercent = computed(() => {
    if (!currentSession.value || questionCount.value === 0) return 0
    return calcProgress(currentSession.value, questionCount.value).percentage
  })

  function setPapers(list: Paper[]) { papers.value = list }
  function addPaper(paper: Paper) { papers.value.push(paper) }
  function removePaper(id: string) { papers.value = papers.value.filter(p => p.id !== id) }

  function selectPaper(paper: Paper) { currentPaper.value = paper }

  async function parsePaperQuestions(paperId: string, rawText: string): Promise<ParsedQuestion[]> {
    const questions = parseQuestions(paperId, rawText)
    currentQuestions.value = questions
    return questions
  }

  function setAnswers(answers: StandardAnswer[]) {
    currentAnswers.value = answers
    if (currentPaper.value) {
      currentPaper.value.hasAnswerKey = answers.length > 0
    }
  }

  function parseAndSetAnswers(rawText: string, paperId: string) {
    const questionIds = currentQuestions.value.map(q => q.id)
    const answers = parseAnswerText(rawText, paperId, questionIds)
    setAnswers(answers)
    return answers
  }

  function saveUserAnswer(questionId: string, answer: string[], duration: number) {
    const ua: UserAnswer = { questionId, answer, answeredAt: Date.now(), duration }
    userAnswers.value.set(questionId, ua)
    if (currentSession.value && !currentSession.value.completedQuestionIds.includes(questionId)) {
      currentSession.value.completedQuestionIds.push(questionId)
    }
  }

  function getUserAnswer(questionId: string): UserAnswer | undefined {
    return userAnswers.value.get(questionId)
  }

  function computeGrade(): PaperGradeSummary | null {
    if (currentAnswers.value.length === 0 || !currentPaper.value) return null
    return gradePaper(currentAnswers.value, Array.from(userAnswers.value.values()), currentPaper.value.totalQuestions)
  }

  function initSession(paperId: string): PracticeSession {
    const session: PracticeSession = {
      id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      paperId,
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      completedQuestionIds: [],
      currentQuestionIndex: 0,
      status: 'in_progress',
    }
    currentSession.value = session
    userAnswers.value.clear()
    return session
  }

  function updateSessionIndex(index: number) {
    if (currentSession.value) {
      currentSession.value.currentQuestionIndex = index
      currentSession.value.lastActiveAt = Date.now()
    }
  }

  function completeSession() {
    if (currentSession.value) {
      currentSession.value.status = 'completed'
      currentSession.value.lastActiveAt = Date.now()
    }
  }

  function resetPaper(paperId: string) {
    userAnswers.value.clear()
    currentAnswers.value = []
    currentSession.value = null
    if (currentPaper.value?.id === paperId) {
      currentPaper.value.hasAnswerKey = false
      currentPaper.value.status = 'ready'
    }
  }

  function addToWrongBook(questionId: string, paperId: string) {
    const existing = wrongBook.value.find(e => e.questionId === questionId)
    if (existing) {
      existing.wrongCount++
      existing.lastWrongAt = Date.now()
      existing.mastered = false
    } else {
      wrongBook.value.push({ questionId, paperId, wrongCount: 1, lastWrongAt: Date.now(), mastered: false })
    }
  }

  function markWrongMastered(questionId: string) {
    const entry = wrongBook.value.find(e => e.questionId === questionId)
    if (entry) entry.mastered = true
  }

  function clearError() { error.value = null }

  return {
    papers, currentPaper, currentQuestions, currentAnswers, userAnswers,
    currentSession, wrongBook, isLoading, error,
    questionCount, answeredCount, progressPercent,
    setPapers, addPaper, removePaper, selectPaper,
    parsePaperQuestions, setAnswers, parseAndSetAnswers,
    saveUserAnswer, getUserAnswer, computeGrade,
    initSession, updateSessionIndex, completeSession, resetPaper,
    addToWrongBook, markWrongMastered, clearError,
  }
})
