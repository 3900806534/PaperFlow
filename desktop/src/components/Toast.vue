<template>
  <Transition name="t">
    <div v-if="show" class="toast" :class="type">{{ message }}</div>
  </Transition>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
const props = defineProps<{ message: string; type?: string; duration?: number }>()
const show = ref(false)
watch(() => props.message, (v) => { if(v) { show.value=true; setTimeout(()=>show.value=false, props.duration||2000) } })
</script>
<style scoped>
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 24px;border-radius:8px;font-size:14px;z-index:9999;pointer-events:none}
.toast.success{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0}
.toast.error{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.t-enter-active{transition:all .3s ease}.t-leave-active{transition:all .3s ease}
.t-enter-from{opacity:0;transform:translateX(-50%) translateY(10px)}
.t-leave-to{opacity:0;transform:translateX(-50%) translateY(-10px)}
</style>
