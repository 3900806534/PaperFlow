<template>
  <div class="paper-detail">
    <header class="detail-header">
      <button class="btn-back" @click="$router.push('/')">← 返回</button>
      <div>
        <h2>{{ paper?.title ?? '试卷详情' }}</h2>
        <p class="paper-info">{{ paper?.totalQuestions }} 题 · 已答 {{ answeredCount }} 题 · 正确率 {{ accuracy }}%</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary" @click="startPractice">开始刷题</button>
        <button class="btn-secondary" @click="importAnswers">导入答案</button>
        <button class="btn-ghost" @click="manualAnswers">手动录入答案</button>
        <button class="btn-danger" @click="handleReset">重新开始</button>
      </div>
    </header>

    <div class="question-list">
      <div
        v-for="(q, idx) in questions"
        :key="q.id"
        class="question-summary"
        :class="{ answered: isAnswered(q.id), correct: isCorrect(q.id), wrong: isWrong(q.id) }"
      >
        <span class="q-index">{{ idx + 1 }}</span>
        <span class="q-stem">{{ truncate(q.stem, 60) }}</span>
        <span class="q-status">{{ getStatus(q.id) }}</span>
      </div>
    </div>

    <div v-if="showGrade" class="grade-summary">
      <h3>成绩汇总</h3>
      <div class="grade-stats">
        <div class="stat"><span class="stat-value">{{ answeredCount }}</span><span class="stat-label">已答</span></div>
        <div class="stat"><span class="stat-value">{{ correctCount }}</span><span class="stat-label">正确</span></div>
        <div class="stat"><span class="stat-value">{{ accuracy }}%</span><span class="stat-label">正确率</span></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePaperStore } from '../stores/paper'
import type { ParsedQuestion, Paper } from '@core/types/paper'

const route = useRoute()
const router = useRouter()
const store = usePaperStore()

const paperId = route.params.id as string
const paper = computed(() => store.papers.find(p => p.id === paperId) ?? null)
const questions = ref<ParsedQuestion[]>([])
const showGrade = ref(false)
const correctCount = ref(0)

onMounted(async () => {
  try {
    const { initDB, queryAll, queryOne } = await import('../db')
    await initDB()
    const row = queryOne('SELECT * FROM papers WHERE id=?', [paperId]) as any
    if (row) {
      const paperData: Paper = {
        id: row.id, title: row.title, fileName: row.file_name, filePath: row.file_path,
        totalQuestions: row.total_questions, questionTypes: JSON.parse(row.question_types || '[]'),
        parsedAt: row.parsed_at, status: row.status, hasAnswerKey: !!row.has_answer_key,
      }
      store.selectPaper(paperData)
    }
    const rows = queryAll('SELECT * FROM questions WHERE paper_id=? ORDER BY idx', [paperId]) as any[]
    questions.value = rows.map(r => ({
      id: r.id, paperId: r.paper_id, index: r.idx, type: r.question_type,
      stem: r.stem, options: JSON.parse(r.options || '[]'), rawText: r.raw_text,
    })) as ParsedQuestion[]
  } catch (e) {
    console.error('加载试卷失败:', e)
  }
})

const answeredCount = computed(() => store.currentSession?.completedQuestionIds.length ?? 0)
const accuracy = computed(() => {
  if (answeredCount.value === 0) return 0
  const result = store.computeGrade()
  return result?.accuracy ?? 0
})

function isAnswered(qId: string) { return store.currentSession?.completedQuestionIds.includes(qId) ?? false }
function isCorrect(qId: string) { return store.userAnswers.has(qId) }
function isWrong(qId: string) { return store.wrongBook.some(e => e.questionId === qId && !e.mastered) }
function getStatus(qId: string): string {
  if (isWrong(qId)) return '❌'
  if (isAnswered(qId)) return '✅'
  return '○'
}
function truncate(text: string, max: number) { return text.length > max ? text.slice(0, max) + '...' : text }

function startPractice() {
  store.initSession(paperId)
  router.push(`/practice/${paperId}`)
}

async function importAnswers() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      filters: [{ name: '答案文件', extensions: ['txt', 'pdf'] }],
    })
    if (!selected || Array.isArray(selected)) return
    const filePath = selected as string
    const { invoke } = await import('@tauri-apps/api/core')
    const rawText: string = await invoke('read_answer_file', { filePath })
    const answers = store.parseAndSetAnswers(rawText, paperId)
    await invoke('save_answers', { paperId, answers })
    showGrade.value = true
  } catch (e) {
    console.error('导入答案失败:', e)
  }
}

function manualAnswers() {
  router.push(`/practice/${paperId}?mode=answer-entry`)
}

async function handleReset() {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('reset_paper', { paperId })
  store.resetPaper(paperId)
  showGrade.value = false
}
</script>

<style scoped>
.paper-detail { max-width: 900px; margin: 0 auto; padding: 24px; }
.detail-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
.btn-back { background: none; border: none; color: #4f46e5; cursor: pointer; font-size: 15px; padding: 8px; }
.detail-header h2 { font-size: 22px; font-weight: 600; }
.paper-info { color: #888; font-size: 14px; margin-top: 4px; }
.header-actions { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; }
.btn-primary { background: #4f46e5; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
.btn-secondary { background: #fff; color: #4f46e5; border: 1px solid #4f46e5; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
.btn-ghost { background: none; border: none; color: #666; padding: 8px 16px; cursor: pointer; font-size: 14px; }
.btn-danger { background: none; border: 1px solid #e53e3e; color: #e53e3e; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
.question-list { display: flex; flex-direction: column; gap: 4px; }
.question-summary { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 6px; cursor: pointer; }
.question-summary:hover { background: #f0f0ff; }
.question-summary.answered { background: #f0fdf4; }
.question-summary.correct { background: #dcfce7; }
.question-summary.wrong { background: #fef2f2; }
.q-index { width: 28px; height: 28px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; flex-shrink: 0; }
.q-stem { flex: 1; font-size: 14px; color: #333; }
.q-status { font-size: 16px; }
.grade-summary { margin-top: 32px; padding: 20px; background: #fff; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.grade-summary h3 { font-size: 18px; margin-bottom: 16px; }
.grade-stats { display: flex; gap: 32px; }
.stat { display: flex; flex-direction: column; align-items: center; }
.stat-value { font-size: 28px; font-weight: 700; color: #4f46e5; }
.stat-label { font-size: 13px; color: #888; margin-top: 4px; }
</style>
