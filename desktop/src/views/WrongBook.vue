<template>
  <div class="wrong-book">
    <header class="wb-header">
      <button class="btn-back" @click="$router.push('/')">← 返回</button>
      <h2>错题本</h2>
      <span class="count">{{ wrongEntries.length }} 道错题</span>
    </header>

    <div v-if="wrongEntries.length === 0" class="empty">
      <p>暂无错题 🎉</p>
    </div>

    <div v-else class="wrong-list">
      <div v-for="entry in wrongEntries" :key="entry.questionId" class="wrong-item" :class="{ mastered: entry.mastered }">
        <span class="wrong-badge">✗{{ entry.wrongCount }}</span>
        <span class="wrong-stem">{{ getQuestionStem(entry.questionId) }}</span>
        <button class="btn-retry" @click="retryQuestion(entry)">重做</button>
        <button v-if="!entry.mastered" class="btn-mastered" @click="markMastered(entry.questionId)">已掌握</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePaperStore } from '../stores/paper'

const router = useRouter()
const store = usePaperStore()

const wrongEntries = computed(() => store.wrongBook.filter(e => !e.mastered))

function getQuestionStem(qId: string): string {
  const q = store.currentQuestions.find(q => q.id === qId)
  return q ? q.stem.slice(0, 50) + (q.stem.length > 50 ? '...' : '') : '未知题目'
}

function retryQuestion(entry: { questionId: string; paperId: string }) {
  router.push(`/paper/${entry.paperId}`)
}

function markMastered(qId: string) {
  store.markWrongMastered(qId)
}
</script>

<style scoped>
.wrong-book { max-width: 800px; margin: 0 auto; padding: 24px; }
.wb-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.btn-back { background: none; border: none; color: #4f46e5; cursor: pointer; font-size: 15px; }
.wb-header h2 { font-size: 22px; }
.count { color: #888; font-size: 14px; }
.empty { text-align: center; padding: 60px; font-size: 18px; color: #888; }
.wrong-list { display: flex; flex-direction: column; gap: 8px; }
.wrong-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: #fff; border-radius: 8px; border: 1px solid #fecaca; }
.wrong-item.mastered { border-color: #bbf7d0; opacity: 0.7; }
.wrong-badge { background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.wrong-stem { flex: 1; font-size: 14px; color: #333; }
.btn-retry { background: #4f46e5; color: #fff; border: none; padding: 5px 12px; border-radius: 5px; cursor: pointer; font-size: 12px; }
.btn-mastered { background: #16a34a; color: #fff; border: none; padding: 5px 12px; border-radius: 5px; cursor: pointer; font-size: 12px; }
</style>
