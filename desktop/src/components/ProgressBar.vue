<template>
  <div class="progress-bar">
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: percent + '%' }"></div>
    </div>
    <span v-if="showLabel" class="progress-label">{{ percent }}%</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ percent: number; showLabel?: boolean }>()
</script>

<style scoped>
.progress-bar { display: flex; align-items: center; gap: 8px; flex: 1; }
.progress-track { flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: #4f46e5; border-radius: 3px; transition: width 0.3s; }
.progress-label { font-size: 12px; color: #888; min-width: 36px; text-align: right; }
</style>
