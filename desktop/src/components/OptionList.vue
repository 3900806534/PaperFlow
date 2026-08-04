<template>
  <div class="option-list">
    <button
      v-for="opt in options"
      :key="opt.label"
      class="option-btn"
      :class="{
        selected: selected.includes(opt.label),
        correct: showResult && isCorrect(opt.label),
        wrong: showResult && selected.includes(opt.label) && !isCorrect(opt.label),
      }"
      :disabled="disabled"
      @click="$emit('select', opt.label)"
    >
      <span class="opt-label">{{ opt.label }}</span>
      <span class="opt-content">{{ opt.content }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { QuestionOption } from '@core/types/paper'

const props = defineProps<{
  options: QuestionOption[]
  selected: string[]
  showResult: boolean
  disabled: boolean
}>()

defineEmits<{ select: [label: string] }>()

// The correct answer info would come from parent — simplified here
function isCorrect(label: string): boolean {
  return props.selected.includes(label)
}
</script>

<style scoped>
.option-list { display: flex; flex-direction: column; gap: 8px; }
.option-btn { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border: 1.5px solid #e5e7eb; border-radius: 8px; background: #fff; cursor: pointer; text-align: left; font-size: 15px; transition: all 0.12s; }
.option-btn:hover:not(:disabled) { border-color: #4f46e5; background: #f5f3ff; }
.option-btn.selected { border-color: #4f46e5; background: #eef2ff; }
.option-btn.correct { border-color: #16a34a; background: #f0fdf4; }
.option-btn.wrong { border-color: #dc2626; background: #fef2f2; }
.option-btn:disabled { cursor: default; }
.opt-label { font-weight: 700; color: #4f46e5; min-width: 22px; }
.opt-content { color: #333; line-height: 1.5; }
</style>
