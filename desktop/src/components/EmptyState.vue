<template>
  <div class="empty-state">
    <div class="empty-icon">{{ icon }}</div>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <button v-if="action" class="btn-action" @click="$emit('action')">{{ action }}</button>
  </div>
</template>
<script setup lang="ts">
defineProps<{ icon: string; title: string; description: string; action?: string }>()
defineEmits<{ action: [] }>()
</script>
<style scoped>
.empty-state{text-align:center;padding:60px 20px}
.empty-icon{font-size:56px;margin-bottom:16px}
h3{font-size:18px;color:#333;margin-bottom:8px}
p{color:#888;font-size:14px;margin-bottom:20px}
.btn-action{background:#4f46e5;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px}
</style>
