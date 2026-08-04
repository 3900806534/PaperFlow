// PaperFlow Data Management - Backup, Restore, Export
import { saveDB, getDB, queryAll } from './index'

// Export database to a user-chosen location
export async function backupDatabase(): Promise<string> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const path = await save({
    defaultPath: `PaperFlow_backup_${new Date().toISOString().slice(0,10)}.db`,
    filters: [{ name: '数据库', extensions: ['db'] }],
  })
  if (!path) throw new Error('用户取消')
  
  await saveDB()
  const { copyFile } = await import('@tauri-apps/plugin-fs')
  await copyFile('D:/PaperFlowData/paperflow.db', path)
  return path as string
}

// Restore database from backup
export async function restoreDatabase(): Promise<void> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const path = await open({
    filters: [{ name: '数据库', extensions: ['db'] }],
    multiple: false,
  })
  if (!path) throw new Error('用户取消')
  
  const { copyFile } = await import('@tauri-apps/plugin-fs')
  await copyFile(path as string, 'D:/PaperFlowData/paperflow.db')
  
  // Reload by refreshing page
  window.location.reload()
}

// Get storage statistics
export async function getStorageStats() {
  const db = getDB()
  const paperCount = queryAll('SELECT COUNT(*) as c FROM papers')[0]?.c ?? 0
  const questionCount = queryAll('SELECT COUNT(*) as c FROM questions')[0]?.c ?? 0
  const sessionCount = queryAll('SELECT COUNT(*) as c FROM sessions')[0]?.c ?? 0
  const wrongCount = queryAll('SELECT COUNT(*) as c FROM wrong_book WHERE mastered=0')[0]?.c ?? 0
  
  return { paperCount, questionCount, sessionCount, wrongCount }
}
