<template>
  <div class="home">
    <header class="home-header">
      <h1>PaperFlow</h1>
      <p class="subtitle">试卷学习工具</p>
      <div class="header-actions">
        <button class="btn-primary" @click="importPapers">导入试卷</button>
        <router-link to="/wrongbook" class="btn-secondary">错题本</router-link>
        <router-link to="/settings" class="btn-ghost">设置</router-link>
      </div>
    </header>

    <div v-if="papers.length === 0 && !isImporting" class="empty-state">
      <div class="empty-icon">&#9737;</div>
      <p>还没有试卷</p>
      <p class="empty-hint">点击"导入试卷"开始学习</p>
    </div>

    <div v-else class="paper-grid">
      <PaperCard
        v-for="paper in papers"
        :key="paper.id"
        :paper="paper"
        @click="openPaper(paper.id)"
        @delete="handleDelete(paper.id)"
      />
    </div>

    <div v-if="isImporting" class="import-overlay">
      <div class="import-modal">
        <h3>正在解析试卷...</h3>
        <ProgressBar :percent="importProgress" />
        <p class="import-status">{{ importStatus }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePaperStore } from '../stores/paper'
import PaperCard from '../components/PaperCard.vue'
import ProgressBar from '../components/ProgressBar.vue'
import type { Paper } from '@core/types/paper'
import { usePdfParser } from '../composables/usePdfParser'
import { parseQuestions } from '@core/parser/question-parser'
import { initDB, execute, saveDB } from '../db'

const router = useRouter()
const store = usePaperStore()
const { extractText } = usePdfParser()

const papers = ref<Paper[]>([])
const isImporting = ref(false)
const importProgress = ref(0)
const importStatus = ref('')

onMounted(async () => {
  await loadPapers()
})

async function loadPapers() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const list: Paper[] = await invoke('list_papers')
    papers.value = list
    store.setPapers(list)
  } catch {
    papers.value = []
  }
}

async function importPapers() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      multiple: true,
      filters: [{ name: 'PDF文件', extensions: ['pdf'] }],
    })
    if (!selected) return

    const files = Array.isArray(selected) ? selected : [selected]
    if (files.length === 0) return

    isImporting.value = true
    importProgress.value = 0

    await initDB()
    const { invoke } = await import('@tauri-apps/api/core')

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i]
      const fileName = filePath.split(/[\/]/).pop() || 'unknown.pdf'
      importStatus.value = `正在解析: ${fileName}`

      try {
        // Copy file via Rust backend
        const paper: Paper = await invoke('import_paper', { filePath })
        
        // Extract text with pdf.js
        const rawText = await extractText(paper.filePath)
        
        // Parse into structured questions
        const questions = parseQuestions(paper.id, rawText)
        paper.totalQuestions = questions.length
        
        // Save paper to DB
        execute(
          `INSERT OR REPLACE INTO papers (id, title, file_name, file_path, total_questions, question_types, parsed_at, status, has_answer_key) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [paper.id, paper.title, paper.fileName, paper.filePath, paper.totalQuestions, '["single"]', Date.now(), 'ready', 0]
        )
        
        // Save questions
        for (const q of questions) {
          execute(
            `INSERT OR REPLACE INTO questions (id, paper_id, idx, question_type, stem, options, raw_text)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [q.id, q.paperId, q.index, q.type, q.stem, JSON.stringify(q.options), q.rawText]
          )
        }
        await saveDB()

        papers.value.push(paper)
        store.addPaper(paper)
      } catch (e: any) {
        console.error(`导入失败: ${fileName}`, e)
      }
      importProgress.value = Math.round(((i + 1) / files.length) * 100)
    }
  } catch (e) {
    console.error('导入错误:', e)
  } finally {
    isImporting.value = false
    importStatus.value = ''
  }
}

function openPaper(id: string) {
  router.push(`/paper/${id}`)
}

async function handleDelete(id: string) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('delete_paper', { paperId: id })
    papers.value = papers.value.filter(p => p.id !== id)
    store.removePaper(id)
  } catch (e) {
    console.error('删除失败:', e)
  }
}
</script>

<style scoped>
.home { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
.home-header { text-align: center; margin-bottom: 40px; }
.home-header h1 { font-size: 32px; font-weight: 700; color: #1a1a2e; }
.subtitle { color: #666; margin: 8px 0 24px; }
.header-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.btn-primary { background: #4f46e5; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-size: 15px; cursor: pointer; }
.btn-primary:hover { background: #4338ca; }
.btn-secondary { background: #fff; color: #4f46e5; border: 1px solid #4f46e5; padding: 10px 24px; border-radius: 8px; font-size: 15px; text-decoration: none; cursor: pointer; }
.btn-ghost { background: transparent; color: #666; border: none; padding: 10px 24px; font-size: 15px; text-decoration: none; cursor: pointer; }
.empty-state { text-align: center; padding: 80px 20px; }
.empty-icon { font-size: 64px; margin-bottom: 16px; }
.empty-state p { color: #666; font-size: 16px; }
.empty-hint { color: #999; font-size: 14px; margin-top: 8px; }
.paper-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.import-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.import-modal { background: #fff; padding: 32px; border-radius: 12px; min-width: 360px; text-align: center; }
.import-modal h3 { margin-bottom: 16px; }
.import-status { margin-top: 12px; color: #666; font-size: 14px; }
</style>
