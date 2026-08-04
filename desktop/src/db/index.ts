// PaperFlow — Local SQLite database via sql.js (WASM, zero native deps)
import initSqlJs from 'sql.js'; import type { Database, SqlJsStatic } from 'sql.js'
import wasmUrl from '../assets/sql-wasm.wasm?url'

let SQL: SqlJsStatic | null = null
let db: Database | null = null
const DB_PATH = 'D:/PaperFlowData/paperflow.db'

async function getSQL(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs({
      // Load wasm locally (offline support), bundled by Vite
      locateFile: () => wasmUrl,
    })
  }
  return SQL
}

let initPromise: Promise<Database> | null = null

export function initDB(): Promise<Database> {
  if (!initPromise) {
    initPromise = _initDB()
  }
  return initPromise
}

async function _initDB(): Promise<Database> {
  const sql = await getSQL()

  // Try loading existing DB
  try {
    const { readFile } = await import('@tauri-apps/plugin-fs')
    const data = await readFile(DB_PATH)
    db = new sql.Database(new Uint8Array(data))
  } catch {
    db = new sql.Database()
  }

  db.run('PRAGMA journal_mode=WAL')
  db.run('PRAGMA foreign_keys=ON')

  createTables(db)
  return db
}

function createTables(d: Database) {
  d.run(`CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY, title TEXT, file_name TEXT, file_path TEXT,
    total_questions INTEGER DEFAULT 0, question_types TEXT DEFAULT '[]',
    parsed_at INTEGER, status TEXT DEFAULT 'ready',
    has_answer_key INTEGER DEFAULT 0, answer_key_path TEXT
  )`)
  d.run(`CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY, paper_id TEXT, idx INTEGER,
    question_type TEXT DEFAULT 'single', stem TEXT,
    options TEXT DEFAULT '[]', raw_text TEXT,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
  )`)
  d.run(`CREATE TABLE IF NOT EXISTS answers (
    question_id TEXT PRIMARY KEY, answer TEXT, explanation TEXT,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
  )`)
  d.run(`CREATE TABLE IF NOT EXISTS user_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, question_id TEXT, session_id TEXT,
    answer TEXT, answered_at INTEGER, duration INTEGER DEFAULT 0,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
  )`)
  d.run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, paper_id TEXT, started_at INTEGER,
    last_active_at INTEGER, completed_question_ids TEXT DEFAULT '[]',
    current_question_index INTEGER DEFAULT 0, status TEXT DEFAULT 'in_progress',
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
  )`)
  d.run(`CREATE TABLE IF NOT EXISTS wrong_book (
    question_id TEXT NOT NULL, paper_id TEXT, wrong_count INTEGER DEFAULT 1,
    last_wrong_at INTEGER, mastered INTEGER DEFAULT 0,
    PRIMARY KEY (question_id),
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
  )`)
}

export async function saveDB(): Promise<void> {
  if (!db) return
  const data = db.export()
  const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs')
  await mkdir('D:/PaperFlowData', { recursive: true })
  await writeFile(DB_PATH, new Uint8Array(data))
}

export function getDB(): Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

// Helper: run query and return rows
export function queryAll(sql: string, params?: any[]): any[] {
  const d = getDB()
  const stmt = d.prepare(sql)
  if (params) stmt.bind(params)
  const rows: any[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function queryOne(sql: string, params?: any[]): any | null {
  const rows = queryAll(sql, params)
  return rows.length > 0 ? rows[0] : null
}

export function execute(sql: string, params?: any[]): void {
  const d = getDB()
  d.run(sql, params)
}
