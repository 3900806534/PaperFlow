import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePaperStore } from './paper'

export const usePracticeStore = defineStore('practice', () => {
  const currentIndex = ref(0)
  const showResult = ref(false)
  const isSubmitted = ref(false)
  const selectedOptions = ref<string[]>([])
  const startTime = ref(0)

  const paperStore = usePaperStore()

  const currentQuestion = computed(() => paperStore.currentQuestions[currentIndex.value] ?? null)
  const isFirst = computed(() => currentIndex.value === 0)
  const isLast = computed(() => currentIndex.value >= paperStore.questionCount - 1)

  function selectOption(label: string, multi: boolean = false) {
    if (!multi) {
      selectedOptions.value = [label]
    } else {
      const idx = selectedOptions.value.indexOf(label)
      if (idx >= 0) selectedOptions.value.splice(idx, 1)
      else selectedOptions.value.push(label)
    }
  }

  function isSelected(label: string): boolean {
    return selectedOptions.value.includes(label)
  }

  function submitAnswer() {
    if (!currentQuestion.value) return
    const duration = Math.round((Date.now() - startTime.value) / 1000)
    paperStore.saveUserAnswer(currentQuestion.value.id, [...selectedOptions.value], duration)
    isSubmitted.value = true
    showResult.value = true
    
    // Auto-grade if answers exist
    const answer = paperStore.currentAnswers.find(a => a.questionId === currentQuestion.value!.id)
    if (answer) {
      const userAns = [...selectedOptions.value].map(a => a.toUpperCase()).sort()
      const correctAns = [...answer.answer].map(a => a.toUpperCase()).sort()
      const isCorrect = userAns.length === correctAns.length && userAns.every((v, i) => v === correctAns[i])
      if (!isCorrect) {
        paperStore.addToWrongBook(currentQuestion.value.id, currentQuestion.value.paperId)
      } else {
        paperStore.markWrongMastered(currentQuestion.value.id)
      }
    }
  }

  function nextQuestion() {
    if (currentIndex.value < paperStore.questionCount - 1) {
      currentIndex.value++
      paperStore.updateSessionIndex(currentIndex.value)
      resetQuestion()
    }
  }

  function prevQuestion() {
    if (currentIndex.value > 0) {
      currentIndex.value--
      paperStore.updateSessionIndex(currentIndex.value)
      resetQuestion()
    }
  }

  function goToQuestion(index: number) {
    if (index >= 0 && index < paperStore.questionCount) {
      currentIndex.value = index
      paperStore.updateSessionIndex(index)
      resetQuestion()
    }
  }

  function resetQuestion() {
    showResult.value = false
    isSubmitted.value = false
    selectedOptions.value = []
    startTime.value = Date.now()
    // Restore previous answer if exists
    const q = currentQuestion.value
    if (q) {
      const prev = paperStore.getUserAnswer(q.id)
      if (prev) {
        selectedOptions.value = [...prev.answer]
        isSubmitted.value = true
        showResult.value = true
      }
    }
  }

  function startPractice() {
    currentIndex.value = 0
    resetQuestion()
  }

  function finishPractice() {
    paperStore.completeSession()
  }

  return {
    currentIndex, showResult, isSubmitted, selectedOptions, startTime,
    currentQuestion, isFirst, isLast,
    selectOption, isSelected, submitAnswer, nextQuestion, prevQuestion,
    goToQuestion, resetQuestion, startPractice, finishPractice,
  }
})
