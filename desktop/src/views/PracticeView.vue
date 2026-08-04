<template>
  <div class="practice-view">
    <header class="practice-header">
      <button class="btn-back" @click="handleBack">← 返回</button>
      <ProgressBar :percent="store.progressPercent" />
      <span class="question-counter">{{ store.answeredCount }} / {{ store.questionCount }}</span>
      <button class="btn-finish" @click="handleFinish">完成</button>
    </header>

    <div v-if="currentQuestion" class="question-area">
      <QuestionItem
        :question="currentQuestion"
        :show-result="practiceStore.showResult"
        :selected-options="practiceStore.selectedOptions"
        :is-submitted="practiceStore.isSubmitted"
        @select="practiceStore.selectOption($event, false)"
      />

      <div v-if="practiceStore.showResult && answerResult" class="result-panel" :class="{ correct: answerResult.isCorrect }">
        <p class="result-text">{{ answerResult.isCorrect ? '✅ 回答正确' : '❌ 回答错误' }}</p>
        <p v-if="!answerResult.isCorrect" class="correct-answer">
          正确答案: {{ answerResult.correctAnswer.join(', ') }}
        </p>
        <p v-if="answerResult.explanation" class="explanation">{{ answerResult.explanation }}</p>
      </div>

      <div v-if="isAnswerEntryMode && practiceStore.isSubmitted" class="answer-entry">
        <label>标准答案:</label>
        <input v-model="manualAnswer" placeholder="如: A 或 B" class="answer-input" />
        <button class="btn-save" @click="saveManualAnswer">保存答案</button>
      </div>

      <div class="practice-actions">
        <button class="btn-nav" :disabled="practiceStore.isFirst" @click="practiceStore.prevQuestion">上一题</button>
        <button v-if="!practiceStore.isSubmitted" class="btn-submit" @click="practiceStore.submitAnswer" :disabled="practiceStore.selectedOptions.length === 0">提交答案</button>
        <button class="btn-nav" :disabled="practiceStore.isLast" @click="practiceStore.nextQuestion">{{ practiceStore.isLast ? '最后一题' : '下一题' }}</button>
      </div>
    </div>

    <div v-else class="empty-practice">
      <p>该试卷没有题目</p>
    </div>

    <div class="question-nav">
      <button
        v-for="(q, idx) in store.currentQuestions"
        :key="q.id"
        class="q-nav-btn"
        :class="{ active: idx === practiceStore.currentIndex, answered: store.currentSession?.completedQuestionIds.includes(q.id) }"
        @click="practiceStore.goToQuestion(idx)"
      >{{ idx + 1 }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePaperStore } from '../stores/paper'
import { usePracticeStore } from '../stores/practice'
import QuestionItem from '../components/QuestionItem.vue'
import ProgressBar from '../components/ProgressBar.vue'
import { gradeSingle } from '@core/grader'

const route = useRoute()
const router = useRouter()
const store = usePaperStore()
const practiceStore = usePracticeStore()

const paperId = route.params.paperId as string
const isAnswerEntryMode = computed(() => route.query.mode === 'answer-entry')
const manualAnswer = ref('')

onMounted(async () => {
  if (store.currentQuestions.length === 0) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
    const qs = await invoke('get_questions', { paperId }) as any
      store.currentQuestions = qs
    } catch (e) {
      console.error('加载题目失败:', e)
    }
  }
  if (!store.currentSession || store.currentSession.paperId !== paperId) {
    store.initSession(paperId)
  }
  practiceStore.startPractice()
})

const currentQuestion = computed(() => practiceStore.currentQuestion)

const answerResult = computed(() => {
  if (!currentQuestion.value || !practiceStore.isSubmitted) return null
  const userAns = store.getUserAnswer(currentQuestion.value.id)
  const stdAns = store.currentAnswers.find(a => a.questionId === currentQuestion.value!.id)
  return gradeSingle(currentQuestion.value.id, userAns, stdAns)
})

function saveManualAnswer() {
  if (!currentQuestion.value || !manualAnswer.value.trim()) return
  store.currentAnswers.push({
    questionId: currentQuestion.value.id,
    answer: [manualAnswer.value.trim().toUpperCase()],
  })
  if (store.currentPaper) store.currentPaper.hasAnswerKey = true
  manualAnswer.value = ''
}

function handleBack() {
  router.push(`/paper/${paperId}`)
}

async function handleFinish() {
  store.completeSession()
  const grade = store.computeGrade()
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('save_session', {
      session: store.currentSession,
      userAnswers: Array.from(store.userAnswers.values()),
      gradeSummary: grade,
    })
  } catch (e) {
    console.error('保存会话失败:', e)
  }
  router.push(`/paper/${paperId}`)
}
</script>

<style scoped>
.practice-view { max-width: 800px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; min-height: 100vh; }
.practice-header { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
.btn-back { background: none; border: none; color: #4f46e5; cursor: pointer; font-size: 14px; }
.question-counter { font-size: 13px; color: #888; white-space: nowrap; }
.btn-finish { background: #e53e3e; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; margin-left: auto; }
.question-area { flex: 1; padding: 32px 0; }
.result-panel { margin-top: 20px; padding: 16px; border-radius: 8px; background: #fef2f2; }
.result-panel.correct { background: #f0fdf4; }
.result-text { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.correct-answer { color: #16a34a; font-size: 14px; }
.explanation { color: #666; font-size: 13px; margin-top: 8px; line-height: 1.6; }
.answer-entry { margin-top: 20px; padding: 16px; background: #fffbeb; border-radius: 8px; display: flex; align-items: center; gap: 8px; }
.answer-entry label { font-size: 14px; white-space: nowrap; }
.answer-input { border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 10px; font-size: 14px; width: 120px; }
.btn-save { background: #4f46e5; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.practice-actions { display: flex; justify-content: center; gap: 12px; margin-top: 32px; }
.btn-nav { background: #fff; border: 1px solid #d1d5db; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; }
.btn-nav:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-submit { background: #4f46e5; color: #fff; border: none; padding: 10px 28px; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; }
.btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }
.empty-practice { flex: 1; display: flex; align-items: center; justify-content: center; color: #888; }
.question-nav { display: flex; flex-wrap: wrap; gap: 6px; padding: 16px 0; border-top: 1px solid #e5e7eb; }
.q-nav-btn { width: 32px; height: 32px; border-radius: 6px; border: 1px solid #d1d5db; background: #fff; font-size: 12px; cursor: pointer; }
.q-nav-btn.active { background: #4f46e5; color: #fff; border-color: #4f46e5; }
.q-nav-btn.answered { background: #dbeafe; border-color: #93c5fd; }
</style>
