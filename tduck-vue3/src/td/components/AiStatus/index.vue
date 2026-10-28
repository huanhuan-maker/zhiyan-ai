<template>
  <span class="ai-status" :class="['ai-status--' + size, { 'is-idle': !active }]" role="status" :aria-label="ariaLabel">
    <span class="ai-status__orb" aria-hidden="true"><i /><i /><i /></span>
    <span class="ai-status__text">{{ message }}</span>
    <span class="ai-status__time" aria-hidden="true">{{ clockLabel }}</span>
    <span class="ai-status__sheen" aria-hidden="true" />
  </span>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  message: { type: String, default: '正在处理…' },
  elapsedMs: { type: Number, default: null },
  active: { type: Boolean, default: true },
  size: { type: String, default: 'sm' }
})

// 没有外部计时来源时自己计时；有 elapsedMs 时完全受控，避免两套秒数打架。
const localElapsed = ref(0)
const startedAt = Date.now()
let timer = null
onMounted(() => {
  if (props.elapsedMs !== null) return
  timer = setInterval(() => {
    if (!props.active) return
    localElapsed.value = Date.now() - startedAt
  }, 500)
})
onBeforeUnmount(() => clearInterval(timer))

const elapsed = computed(() => (props.elapsedMs === null ? localElapsed.value : props.elapsedMs))
const seconds = computed(() => (elapsed.value >= 1000 ? Math.floor(elapsed.value / 1000) : 0))
const clockLabel = computed(() => (seconds.value ? seconds.value + 's' : ''))
const ariaLabel = computed(() => props.message + (seconds.value ? '，已用 ' + seconds.value + ' 秒' : ''))
</script>

<style scoped>
.ai-status {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  max-width: 100%;
  padding: 5px 12px 5px 10px;
  overflow: hidden;
  vertical-align: middle;
  color: var(--zy-text-secondary);
  font-size: 12.5px;
  line-height: 1.6;
  background: var(--zy-surface-subtle);
  border: 1px solid var(--zy-border-light);
  border-radius: 999px;
}
.ai-status--md { padding: 7px 14px 7px 12px; font-size: 13px; gap: 10px; }
.ai-status__orb { display: inline-flex; align-items: flex-end; gap: 2.5px; flex: none; height: 10px; }
.ai-status__orb i {
  display: block;
  width: 3.5px;
  height: 3.5px;
  background: var(--zy-accent-cyan);
  border-radius: 50%;
  animation: ai-status-dot 1.05s ease-in-out infinite;
}
.ai-status__orb i:nth-child(2) { animation-delay: 0.15s; }
.ai-status__orb i:nth-child(3) { animation-delay: 0.3s; }
.ai-status__text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-status__time { flex: none; min-width: 2.1em; text-align: right; font-variant-numeric: tabular-nums; color: var(--zy-text-regular, var(--zy-text-secondary)); }
.ai-status__sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(100deg, transparent 18%, rgba(120, 180, 255, 0.16) 46%, rgba(120, 180, 255, 0.02) 56%, transparent 84%);
  transform: translateX(-70%);
  animation: ai-status-sheen 2.8s ease-in-out infinite;
}
.ai-status.is-idle { color: var(--zy-text-secondary); border-color: var(--zy-border-light); }
.ai-status.is-idle .ai-status__orb i { animation: none; opacity: 0.45; }
.ai-status.is-idle .ai-status__sheen { animation: none; opacity: 0; }
@keyframes ai-status-dot {
  0%, 100% { transform: translateY(0); opacity: 0.45; }
  50% { transform: translateY(-3px); opacity: 1; }
}
@keyframes ai-status-sheen {
  0% { transform: translateX(-70%); }
  55%, 100% { transform: translateX(70%); }
}
@media (prefers-reduced-motion: reduce) {
  .ai-status__orb i, .ai-status__sheen { animation: none; }
  .ai-status__sheen { opacity: 0; }
}
</style>
