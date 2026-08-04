<template>
  <div
    class="float-ball"
    :class="{ hidden: !visible }"
    @mousedown="startDrag"
    @dblclick="openApp"
  >
    <span class="ball-icon">📝</span>
    <span class="ball-label">刷题</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ open: [] }>()

const isDragging = ref(false)
let startX = 0
let startY = 0
let ballX = 0
let ballY = 0

function startDrag(e: MouseEvent) {
  isDragging.value = false
  startX = e.clientX
  startY = e.clientY
  const ball = e.currentTarget as HTMLElement
  const rect = ball.getBoundingClientRect()
  ballX = rect.left
  ballY = rect.top
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    isDragging.value = true
  }
  const ball = document.querySelector('.float-ball') as HTMLElement
  if (ball) {
    ball.style.left = (ballX + dx) + 'px'
    ball.style.top = (ballY + dy) + 'px'
    ball.style.right = 'auto'
    ball.style.bottom = 'auto'
  }
}

function stopDrag() {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function openApp() {
  if (!isDragging.value) {
    emit('open')
  }
}
</script>

<style scoped>
.float-ball {
  position: fixed;
  right: 20px;
  bottom: 120px;
  width: 56px;
  height: 56px;
  background: #4f46e5;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(79, 70, 229, 0.4);
  z-index: 9999;
  user-select: none;
  transition: opacity 0.2s;
}
.float-ball.hidden { opacity: 0; pointer-events: none; }
.ball-icon { font-size: 20px; }
.ball-label { font-size: 10px; color: #fff; margin-top: 1px; }
</style>
