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

    <div v-else>
      <template v-for="(group, gi) in groupedPapers" :key="gi">
        <div v-if="group.items.length > 1" class="group-header">
          <span class="group-title">{{ group.items[0].fileName }}</span>
          <span class="group-count">{{ group.items.length }} 套</span>
        </div>
        <div class="paper-grid">
          <PaperCard
            v-for="p in group.items" :key="p.id" :paper="p"
            @click="$router.push('/paper/'+p.id)"
            @delete="handleDelete(p.id)"
          />
        </div>
      </template>
    </div>

    <div v-if="previewSections.length > 0" class="import-overlay">
      <div class="import-modal">
        <h3>解析完成，确认导入？</h3>
        <p class="preview-hint">该 PDF 包含 {{ previewSections.length }} 套题，将分别导入：</p>
        <div class="preview-list">
          <div v-for="(s, i) in previewSections" :key="i" class="preview-row">
            <span>{{ s.name }}</span>
            <span class="preview-count">{{ s.count }} 题</span>
          </div>
        </div>
        <div class="preview-actions">
          <button class="btn-ghost" @click="cancelPreview">取消</button>
          <button class="btn-primary" @click="confirmImport">确认导入</button>
        </div>
      </div>
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
import { ref, onMounted, computed } from 'vue'
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

// Group papers by parent PDF (same source file)
const groupedPapers = computed(() => {
  const groups = new Map<string, Paper[]>()
  for (const p of papers.value) {
    const key = (p as any).parentId || p.id
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }
  return Array.from(groups.values()).map(items => ({ parentId: items[0].id, items }))
})
const { extractText } = usePdfParser()
const papers = ref<Paper[]>([])
const isImporting = ref(false)
const importProgress = ref(0)
const importStatus = ref('')
const previewSections = ref<{ name: string; count: number }[]>([])
const previewPaper = ref<Paper | null>(null)
const previewRaw = ref<{ sec: { name: string; text: string }, qs: any[] }[]>([])

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
      parentId: r.parent_id ?? null,
    })) as Paper[]
  } catch (e) { console.error(e); papers.value = [] }
}

async function confirmImport() {
  // Save all previewed sections to DB
  if (!previewPaper.value) return
  try {
    const { initDB, execute, saveDB } = await import('../db')
    await initDB()
    for (const item of previewRaw.value) {
      if (item.qs.length === 0) continue
      const paperId = previewPaper.value.id + '-s' + previewRaw.value.indexOf(item)
      const paper: Paper = { ...previewPaper.value, id: paperId, title: previewPaper.value.title + '-' + item.sec.name, totalQuestions: item.qs.length }
      execute(`INSERT OR REPLACE INTO papers (id,title,file_name,file_path,total_questions,question_types,parsed_at,status,has_answer_key,parent_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [paper.id, paper.title, paper.fileName, paper.filePath, paper.totalQuestions, '["single"]', Date.now(), 'ready', 0, previewPaper.value.id])
      for (const q of item.qs) {
        execute(`INSERT OR REPLACE INTO questions (id,paper_id,idx,question_type,stem,options,raw_text) VALUES (?,?,?,?,?,?,?)`,
          [q.id, q.paperId, q.index, q.type, q.stem, JSON.stringify(q.options), q.rawText])
      }
      papers.value.push(paper)
    }
    await saveDB()
    previewPaper.value = null
    previewSections.value = []
    previewRaw.value = []
  } catch (e: any) {
    alert(`导入保存失败: ${e?.message || e}`)
  }
}

function cancelPreview() {
  previewPaper.value = null
  previewSections.value = []
  previewRaw.value = []
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

        // Split into named sections (e.g. 专项刷题一~二十); show preview first
        if (rawText.trim().length < 100) {
          alert(`「${fileName}」可能为扫描版 PDF（无法提取文字）。当前版本仅支持文字型 PDF，请使用文字版文件。`)
          continue
        }
        const sections = splitSections(rawText)
        const parsed = sections.map((sec, si) => ({
          sec,
          qs: parseQuestions(basePaper.id + '-s' + si, sec.text),
        }))
        const usable = parsed.filter(p => p.qs.length > 0)

        if (usable.length > 1) {
          // Multiple sets: show preview dialog, save on confirm
          previewPaper.value = basePaper
          previewSections.value = usable.map(u => ({ name: u.sec.name, count: u.qs.length }))
          previewRaw.value = usable
        } else {
          // Single set: save directly
          const questions = parseQuestions(basePaper.id, rawText)
          basePaper.totalQuestions = questions.length
          execute(`INSERT OR REPLACE INTO papers (id,title,file_name,file_path,total_questions,question_types,parsed_at,status,has_answer_key,parent_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [basePaper.id, basePaper.title, basePaper.fileName, basePaper.filePath, basePaper.totalQuestions, '["single"]', Date.now(), 'ready', 0, null])
          for (const q of questions) {
            execute(`INSERT OR REPLACE INTO questions (id,paper_id,idx,question_type,stem,options,raw_text) VALUES (?,?,?,?,?,?,?)`,
              [q.id, q.paperId, q.index, q.type, q.stem, JSON.stringify(q.options), q.rawText])
          }
          papers.value.push(basePaper)
          await saveDB()
        }
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
.preview-hint { color: #666; font-size: 13px; margin: 8px 0 12px; }
.preview-list { max-height: 260px; overflow-y: auto; text-align: left; }
.preview-row { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
.preview-count { color: #4f46e5; font-weight: 600; }
.preview-actions { display: flex; justify-content: center; gap: 12px; margin-top: 16px; }
.group-header { display: flex; align-items: center; gap: 8px; margin: 24px 0 12px; }
.group-title { font-size: 15px; font-weight: 600; color: #333; }
.group-count { font-size: 12px; color: #888; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; }
</style>
