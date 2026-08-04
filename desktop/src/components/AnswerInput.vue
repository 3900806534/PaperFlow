<template>
  <div class="answer-input-panel">
    <h4>手动录入标准答案</h4>
    <div class="input-row">
      <label>题号:</label>
      <span class="q-num">{{ questionIndex }}</span>
    </div>
    <div class="input-row">
      <label>答案:</label>
      <input
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        placeholder="如: A 或 B 或 对"
        class="answer-field"
      />
    </div>
    <div class="input-row">
      <label>解析(可选):</label>
      <textarea
        :value="explanation"
        @input="$emit('update:explanation', ($event.target as HTMLTextAreaElement).value)"
        placeholder="答案解析..."
        class="explain-field"
        rows="3"
      ></textarea>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  questionIndex: number
  modelValue: string
  explanation: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
  'update:explanation': [value: string]
}>()
</script>

<style scoped>
.answer-input-panel { padding: 20px; background: #fffbeb; border-radius: 10px; border: 1px solid #fde68a; }
h4 { font-size: 15px; margin-bottom: 12px; }
.input-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.input-row label { font-size: 13px; color: #666; min-width: 60px; text-align: right; }
.q-num { font-weight: 600; }
.answer-field { border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 10px; font-size: 14px; width: 150px; }
.explain-field { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; font-size: 13px; width: 100%; resize: vertical; }
</style>
