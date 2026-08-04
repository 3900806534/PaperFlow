<template>
  <div class="home">
    <header class="home-header">
      <h1>PaperFlow</h1>
      <p class="subtitle">试卷学习工具</p>
      <div class="header-actions">
        <button class="btn-primary" @click="importPapers">导入试卷</button>
        <button class="btn-secondary" @click="$router.push('/wrongbook')">错题本</button>
        <button class="btn-ghost" @click="$router.push('/settings')">设置</button>
      </div>
    </header>

    <div v-if="papers.length === 0 && !isImporting" class="empty-state">
      <div class="empty-icon">&#9737;</div>
      <p>还没有试卷</p>
      <p class="empty-hint">点击"导入试卷"选择PDF文件</p>
    </div>

    <div v-else class="paper-grid">
      <PaperCard
        v-for="p in papers" :key="p.id" :paper="p"
        @click="$router.push('/paper/'+p.id)"
        @delete="handleDelete(p.id)"
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
import { parseQuestions, splitSections } from '@core/parser/question-parser'
import { initDB, execute, saveDB } from '../db'

const router = useRouter()
const store = usePaperStore()
const { extractText } = usePdfParser()
const papers = ref<Paper[]>([])
const isImporting = ref(false)
const importProgress = ref(0)
const importStatus = ref('')

onMounted(async () => { await initDB(); await loadPapers() })

async function loadPapers() {
  try {
    await initDB()
    const { queryAll } = await import('../db')
    const rows = queryAll('SELECT * FROM papers ORDER BY parsed_at DESC') as any[]
    papers.value = rows.map(r => ({
      id: r.id, title: r.title, fileName: r.file_name, filePath: r.file_path,
      totalQuestions: r.total_questions, questionTypes: JSON.parse(r.question_types || '[]'),
      parsedAt: r.parsed_at, status: r.status, hasAnswerKey: !!r.has_answer_key,
    })) as Paper[]
  } catch (e) { console.error(e); papers.value = [] }
}

async function importPapers() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const files = await open({ multiple: true, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (!files) return
    const list = Array.isArray(files) ? files : [files]
    if (list.length === 0) return

    isImporting.value = true
    importProgress.value = 0

    for (let i = 0; i < list.length; i++) {
      const filePath = list[i]
      const fileName = filePath.split(/[\/]/).pop() || 'unknown.pdf'
      importStatus.value = `正在解析: ${fileName}`

      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const basePaper: Paper = await invoke('import_paper', { filePath })
        const rawText = await extractText(basePaper.filePath)

        // Split into named sections (e.g. 专项刷题一~二十); fallback to whole doc
        const sections = splitSections(rawText)
        const usable = sections.filter(s => parseQuestions(basePaper.id + '-s' + sections.indexOf(s), s.text).length > 0)

        if (usable.length > 1) {
          // Multiple sets: create one paper per section (skip empty/TOC/explanation pages)
          for (let si = 0; si < sections.length; si++) {
            const sec = sections[si]
            const questions = parseQuestions(basePaper.id + '-s' + si, sec.text)
            if (questions.length === 0) continue

            const paper: Paper = { ...basePaper, id: basePaper.id + '-s' + si, title: basePaper.title + '-' + sec.name, totalQuestions: questions.length }
            execute(`INSERT OR REPLACE INTO papers (id,title,file_name,file_path,total_questions,question_types,parsed_at,status,has_answer_key) VALUES (?,?,?,?,?,?,?,?,?)`,
              [paper.id, paper.title, paper.fileName, paper.filePath, paper.totalQuestions, '["single"]', Date.now(), 'ready', 0])
            for (const q of questions) {
              execute(`INSERT OR REPLACE INTO questions (id,paper_id,idx,question_type,stem,options,raw_text) VALUES (?,?,?,?,?,?,?)`,
                [q.id, q.paperId, q.index, q.type, q.stem, JSON.stringify(q.options), q.rawText])
            }
            papers.value.push(paper)
          }
        } else {
          // Single set
          const questions = parseQuestions(basePaper.id, rawText)
          basePaper.totalQuestions = questions.length
          execute(`INSERT OR REPLACE INTO papers (id,title,file_name,file_path,total_questions,question_types,parsed_at,status,has_answer_key) VALUES (?,?,?,?,?,?,?,?,?)`,
            [basePaper.id, basePaper.title, basePaper.fileName, basePaper.filePath, basePaper.totalQuestions, '["single"]', Date.now(), 'ready', 0])
          for (const q of questions) {
            execute(`INSERT OR REPLACE INTO questions (id,paper_id,idx,question_type,stem,options,raw_text) VALUES (?,?,?,?,?,?,?)`,
              [q.id, q.paperId, q.index, q.type, q.stem, JSON.stringify(q.options), q.rawText])
          }
          papers.value.push(basePaper)
        }
        await saveDB()
      } catch (e: any) {
        console.error(`导入失败: ${fileName}`, e)
        alert(`导入 ${fileName} 失败: ${e?.message || e}`)
      }
      importProgress.value = Math.round(((i + 1) / list.length) * 100)
    }
  } catch (e) {
    console.error('导入错误:', e)
  } finally {
    isImporting.value = false
    importStatus.value = ''
  }
}

async function handleDelete(id: string) {
  try {
    execute('DELETE FROM papers WHERE id=?', [id])
    await saveDB()
    papers.value = papers.value.filter(p => p.id !== id)
    store.removePaper(id)
  } catch (e) { console.error(e) }
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
