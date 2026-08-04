<template>
  <div class="settings">
    <header class="settings-header">
      <button class="btn-back" @click="$router.push('/')">← 返回</button>
      <h2>设置</h2>
    </header>

    <div class="setting-group">
      <label class="setting-label">数据存储路径</label>
      <div class="setting-row">
        <input :value="appStore.storagePath" class="path-input" readonly />
        <button class="btn-change" @click="changePath">更改</button>
      </div>
      <p class="setting-hint">试卷PDF、数据库和答题记录将存储在此路径下</p>
    </div>

    <div class="setting-group">
      <label class="setting-label">悬浮球</label>
      <div class="setting-row">
        <span>{{ appStore.floatBallVisible ? '已显示' : '已隐藏' }}</span>
        <button class="btn-change" @click="appStore.toggleFloatBall()">{{ appStore.floatBallVisible ? '隐藏' : '显示' }}</button>
      </div>
    </div>

    <div class="setting-group">
      <label class="setting-label">关于 PaperFlow</label>
      <p class="about-text">版本 1.0.0 · 本地离线试卷学习工具</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/app'

const appStore = useAppStore()

async function changePath() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true })
    if (selected && !Array.isArray(selected)) {
      appStore.setStoragePath(selected as string)
    }
  } catch (e) {
    console.error('选择路径失败:', e)
  }
}
</script>

<style scoped>
.settings { max-width: 700px; margin: 0 auto; padding: 24px; }
.settings-header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
.btn-back { background: none; border: none; color: #4f46e5; cursor: pointer; font-size: 15px; }
.settings-header h2 { font-size: 22px; }
.setting-group { margin-bottom: 24px; padding: 16px; background: #fff; border-radius: 8px; }
.setting-label { font-size: 15px; font-weight: 600; display: block; margin-bottom: 8px; }
.setting-row { display: flex; align-items: center; gap: 8px; }
.path-input { flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: #f9fafb; }
.btn-change { background: #fff; border: 1px solid #d1d5db; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.setting-hint { color: #999; font-size: 12px; margin-top: 8px; }
.about-text { color: #666; font-size: 14px; }
</style>
