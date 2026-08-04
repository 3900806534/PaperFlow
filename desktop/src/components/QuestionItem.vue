<template>
  <div class="question-item">
    <div class="q-header">
      <span class="q-number">{{ question.index }}</span>
      <span class="q-type">{{ typeLabel }}</span>
    </div>
    <p class="q-stem">{{ question.stem }}</p>
    <OptionList
      v-if="question.options.length > 0"
      :options="question.options"
      :selected="selectedOptions"
      :show-result="showResult"
      :disabled="isSubmitted"
      @select="(label: string) => $emit('select', label)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ParsedQuestion } from '@core/types/paper'
import { QuestionType } from '@core/types/paper'
import OptionList from './OptionList.vue'

const props = defineProps<{
  question: ParsedQuestion
  showResult: boolean
  selectedOptions: string[]
  isSubmitted: boolean
}>()

defineEmits<{ select: [label: string] }>()

const typeLabel = computed(() => {
  switch (props.question.type) {
    case QuestionType.SingleChoice: return '单选'
    case QuestionType.MultipleChoice: return '多选'
    case QuestionType.TrueFalse: return '判断'
    case QuestionType.FillBlank: return '填空'
    case QuestionType.ShortAnswer: return '简答'
  }
})
</script>

<style scoped>
.question-item { padding: 8px 0; }
.q-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.q-number { width: 30px; height: 30px; border-radius: 50%; background: #4f46e5; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; }
.q-type { font-size: 12px; color: #888; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; }
.q-stem { font-size: 16px; line-height: 1.7; color: #1a1a2e; margin-bottom: 20px; }
</style>
