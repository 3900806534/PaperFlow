<template>
  <div class="paper-card" @click="$emit('click')">
    <div class="card-header">
      <span class="card-icon">📝</span>
      <button class="btn-delete" @click.stop="$emit('delete')" title="删除">×</button>
    </div>
    <h3 class="card-title">{{ paper.title }}</h3>
    <div class="card-info">
      <span>{{ paper.totalQuestions }} 题</span>
      <span class="dot">·</span>
      <span>{{ statusText }}</span>
    </div>
    <div class="card-meta">
      <span class="file-name">{{ paper.fileName }}</span>
      <span class="badge" :class="paper.hasAnswerKey ? 'has-answer' : 'no-answer'">
        {{ paper.hasAnswerKey ? '有答案' : '无答案' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Paper } from '@core/types/paper'

const props = defineProps<{ paper: Paper }>()
defineEmits<{ click: []; delete: [] }>()

const statusText = computed(() => {
  switch (props.paper.status) {
    case 'parsing': return '解析中...'
    case 'ready': return '就绪'
    case 'error': return '解析失败'
  }
})
</script>

<style scoped>
.paper-card { background: #fff; border-radius: 10px; padding: 18px; cursor: pointer; border: 1px solid #e5e7eb; transition: box-shadow 0.15s; }
.paper-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-icon { font-size: 28px; }
.btn-delete { background: none; border: none; color: #999; font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px; }
.btn-delete:hover { color: #e53e3e; background: #fef2f2; }
.card-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; line-height: 1.4; }
.card-info { color: #666; font-size: 13px; margin-bottom: 8px; }
.dot { margin: 0 4px; }
.card-meta { display: flex; justify-content: space-between; align-items: center; }
.file-name { font-size: 12px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
.badge { font-size: 11px; padding: 2px 8px; border-radius: 4px; }
.has-answer { background: #dcfce7; color: #16a34a; }
.no-answer { background: #f3f4f6; color: #888; }
</style>
