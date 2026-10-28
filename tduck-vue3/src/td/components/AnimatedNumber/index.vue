<template>
  <span class="zy-count" :aria-label="String(Number(value) || 0)">{{ text }}</span>
</template>

<script>
// 数字滚动：首次进入和数值变化时用 easeOutCubic 过渡；减少动态偏好时直接显示。
export default {
  name: 'AnimatedNumber',
  props: {
    value: { type: Number, default: 0 },
    duration: { type: Number, default: 720 }
  },
  data() {
    return { shown: 0 }
  },
  computed: {
    text() {
      return Number(this.shown || 0).toLocaleString('zh-CN')
    }
  },
  watch: {
    value(next) {
      this.animateTo(Number(next) || 0)
    }
  },
  mounted() {
    this.animateTo(Number(this.value) || 0)
  },
  beforeUnmount() {
    cancelAnimationFrame(this.frame)
  },
  methods: {
    prefersReduced() {
      return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      )
    },
    animateTo(target) {
      cancelAnimationFrame(this.frame)
      const from = Number(this.shown) || 0
      if (this.prefersReduced() || from === target) {
        this.shown = target
        return
      }
      const started = performance.now()
      const span = Math.max(120, this.duration)
      const step = (now) => {
        const progress = Math.min(1, (now - started) / span)
        const eased = 1 - Math.pow(1 - progress, 3)
        this.shown = Math.round(from + (target - from) * eased)
        if (progress < 1) this.frame = requestAnimationFrame(step)
      }
      this.frame = requestAnimationFrame(step)
    }
  }
}
</script>
