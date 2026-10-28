// 轻量交互指令：只用 CSS + IntersectionObserver / pointer 事件，不引入动画库。
// 参考 Rare UI 的节奏（聚光、错峰进场、图标触感），但保持本项目的深色令牌与可访问性约束。
const reduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const reveal = {
  mounted(el, binding) {
    const delay = Number(binding.value)
    el.dataset.reveal = ''
    el.style.setProperty('--reveal-delay', (Number.isFinite(delay) ? Math.max(0, delay) : 0) + 'ms')
    if (reduced() || typeof IntersectionObserver !== 'function') {
      el.classList.add('is-revealed')
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-revealed')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.06, rootMargin: '0px 0px -6% 0px' }
    )
    observer.observe(el)
    el.__revealObserver = observer
  },
  unmounted(el) {
    if (el.__revealObserver) el.__revealObserver.disconnect()
    delete el.__revealObserver
  }
}

export const spotlight = {
  mounted(el) {
    if (reduced()) return
    el.dataset.spotlight = ''
    el.__spotlightMove = (event) => {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--mx', (event.clientX - rect.left).toFixed(1) + 'px')
      el.style.setProperty('--my', (event.clientY - rect.top).toFixed(1) + 'px')
    }
    el.addEventListener('pointermove', el.__spotlightMove, { passive: true })
  },
  unmounted(el) {
    if (el.__spotlightMove) el.removeEventListener('pointermove', el.__spotlightMove)
    delete el.__spotlightMove
  }
}
