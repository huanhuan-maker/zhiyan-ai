<template>
  <div class="zy-scroll-progress" aria-hidden="true"><i :style="{ width: percent + '%' }" /></div>
</template>

<script>
// 顶部阅读进度：跟随工作台的滚动容器（.router-view-wrapper），长页面才显示。
export default {
  name: 'ScrollProgress',
  data() {
    return { percent: 0, target: null }
  },
  mounted() {
    this.target = document.querySelector('.router-view-wrapper')
    const source = this.target || window
    source.addEventListener('scroll', this.refresh, { passive: true })
    this.refresh()
  },
  beforeUnmount() {
    const source = this.target || window
    source.removeEventListener('scroll', this.refresh)
  },
  methods: {
    refresh() {
      if (!this.target) {
        const doc = document.documentElement
        const max = doc.scrollHeight - doc.clientHeight
        this.percent = max > 4 ? Math.min(100, (window.scrollY / max) * 100) : 0
        return
      }
      const max = this.target.scrollHeight - this.target.clientHeight
      this.percent = max > 4 ? Math.min(100, (this.target.scrollTop / max) * 100) : 0
    }
  }
}
</script>
