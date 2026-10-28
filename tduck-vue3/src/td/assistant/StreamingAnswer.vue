<template>
  <p ref="root" class="streaming-text" :class="{ 'is-typing': typing }">{{ shown }}<span v-if="typing" class="streaming-caret" aria-hidden="true" /></p>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { createTypist } from '@/assistant/typing'

// 只负责「显示节奏」：正文仍来自服务端已校验的结果，不提前展示、不改变内容。
const emit = defineEmits(['done'])
const props = defineProps({
  text: { type: String, default: '' },
  streaming: { type: Boolean, default: false },
  pace: { type: Boolean, default: true }
})

const root = ref(null)
const shown = ref('')
const typing = ref(false)
let pushed = '' // 已经交给打字节奏的内容；必须和 props.text 比较，不能用还没渲染完的 shown
let typist = null
let finishing = null

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function follow() {
  const scroller = root.value?.closest?.('.assistant-messages')
  if (!scroller) return
  // 用户主动往上翻时不抢滚动位置，只在接近底部时跟随。
  if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140) scroller.scrollTop = scroller.scrollHeight
}

function ensureTypist() {
  if (typist) return typist
  typist = createTypist({
    maxLagMs: 3200,
    onUpdate(value) { shown.value = value; typing.value = value.length < pushed.length; follow() },
    onDone() { typing.value = false; emit('done'); if (props.text !== shown.value) { shown.value = String(props.text || ''); pushed = shown.value } }
  })
  return typist
}

function reset(value) {
  typist?.stop()
  typist = null
  finishing = null
  pushed = value
  shown.value = value
  typing.value = false
}

function drain() {
  if (!typist || finishing) return finishing
  typing.value = true
  finishing = typist.finish().then(() => { typing.value = false })
  follow()
  return finishing
}

watch(
  () => [props.text, props.streaming, props.pace],
  () => {
    const value = String(props.text || '')
    if (!props.streaming) {
      // 流结束后把手里的字数排完，避免文字突然整体跳变；没有积压就立即同步。
      if (typist) drain()
      else reset(value)
      return
    }
    if (!props.pace || reducedMotion()) {
      reset(value)
      return
    }
    if (value.startsWith(pushed)) {
      const chunk = value.slice(pushed.length)
      if (chunk) {
        pushed = value
        ensureTypist().push(chunk)
        typing.value = true
      }
      return
    }
    reset(value)
  },
  { immediate: true }
)

onBeforeUnmount(() => { typist?.stop(); typist = null })
</script>

<style scoped>
.streaming-text.is-typing {
  min-height: 1.9em;
}
.streaming-caret {
  display: inline-block;
  width: 2px;
  height: 1.05em;
  margin-left: 2px;
  vertical-align: -0.16em;
  background: var(--zy-accent-cyan, #38e8ff);
  border-radius: 2px;
  animation: streaming-caret-blink 1.05s steps(1, end) infinite;
}
@keyframes streaming-caret-blink {
  0%, 55% { opacity: 1; }
  56%, 100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .streaming-caret { animation: none; opacity: 0.75; }
}
</style>
