<template>
  <nav
    ref="host"
    v-show="visible"
    class="rail-toc"
    :aria-label="ariaLabel"
    :style="hostStyle"
  >
    <span class="rail-track" aria-hidden="true">
      <i class="rail-track-fill" :style="{ height: progress + '%' }" />
    </span>
    <ol class="rail-list">
      <li v-for="(item, i) in items" :key="item.id" class="rail-row">
        <button
          type="button"
          class="rail-item"
          :class="{ 'is-active': i === activeIndex, 'is-hover': i === hoverIndex }"
          :data-rail-index="i"
          :data-rail-id="item.id"
          :data-rail-active="i === activeIndex ? 'true' : null"
          :tabindex="i === focusIndex ? 0 : -1"
          :aria-current="i === activeIndex ? 'true' : null"
          :aria-label="itemAria(item)"
          @click="select(i)"
          @mouseenter="hoverIndex = i"
          @mouseleave="hoverIndex = -1"
          @pointerdown="pointerDown = true"
          @focus="onFocus(i)"
          @blur="onBlur"
          @keydown="onKeydown($event, i)"
        >
          <span class="rail-index">{{ item.index }}</span>
          <span class="rail-dot" aria-hidden="true" />
        </button>
        <span v-if="labelShown(i)" class="rail-label" role="tooltip" aria-hidden="true">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<script>
// 题目导航轨：右侧竖排圆点 + 序号，点击在滚动容器内平滑定位，滚动时高亮当前题。
// 纯计算（激活项/进度/滚动目标）在 ./rail.js，便于单元测试。
import {
  clampNumber,
  progressRatio,
  resolveActiveIndex,
  scrollTargetFor,
  stepIndex
} from './rail'

export default {
  name: 'RailToc',
  props: {
    items: { type: Array, default: () => [] },
    // 滚动容器：css 选择器或元素；留空时自动找锚点最近的可滚动祖先。
    container: { type: [String, Object], default: null },
    // 受控高亮（可选）：传入 id 时以它为准。
    activeId: { type: [String, Number], default: null },
    // 锚点 id 找不到时的兜底选择器（按题目顺序取第 n 个）。
    anchorSelector: { type: String, default: '' },
    // 点击定位后题卡顶部与容器顶部的距离。
    offset: { type: Number, default: 24 },
    // 阅读线：容器顶边下方多少像素处算「当前题」。
    readingLine: { type: Number, default: 96 },
    ariaLabel: { type: String, default: '题目导航' }
  },
  emits: ['select'],
  data() {
    return {
      ready: false,
      hidden: true,
      rightOffset: 24,
      topOffset: 320,
      rowHeight: 16,
      progress: 0,
      innerActive: 0,
      hoverIndex: -1,
      focusIndex: 0,
      focusTouched: false,
      keyboardFocus: false,
      pointerDown: false,
      containerEl: null,
      anchors: [],
      tops: [],
      scrollTop: 0,
      viewportHeight: 0,
      scrollHeight: 0
    }
  },
  computed: {
    visible() {
      return this.ready && !this.hidden && this.items.length > 0
    },
    activeIndex() {
      if (this.activeId == null) return this.innerActive
      const index = this.items.findIndex((item) => item.id === this.activeId)
      return index >= 0 ? index : this.innerActive
    },
    hostStyle() {
      return {
        right: this.rightOffset + 'px',
        top: this.topOffset + 'px',
        '--rail-row': this.rowHeight + 'px',
        '--rail-font': (this.rowHeight >= 13 ? 10 : 9) + 'px'
      }
    }
  },
  watch: {
    items: {
      deep: true,
      handler() {
        this.$nextTick(() => this.bind())
      }
    },
    activeId() {
      this.$nextTick(() => this.refresh())
    }
  },
  mounted() {
    this.$nextTick(() => this.bind())
  },
  beforeUnmount() {
    this.teardown()
  },
  methods: {
    itemAria(item) {
      return '第 ' + item.index + ' 题：' + item.label
    },
    // 同一时刻只浮出一个标签：悬停 > 键盘焦点 > 当前题，避免两个浮层叠在一起。
    labelShown(index) {
      if (this.hoverIndex >= 0) return index === this.hoverIndex
      if (this.keyboardFocus && this.focusIndex >= 0) return index === this.focusIndex
      return index === this.activeIndex
    },
    // ---------- 生命周期 ----------
    bind() {
      this.teardown()
      this.containerEl = this.resolveContainer()
      this.anchors = this.resolveAnchors()
      this.measureLayout()
      this.refresh()
      this.attachListeners()
    },
    attachListeners() {
      const scope = this.scrollSource()
      this.onScroll = () => {
        if (this.ticking) return
        this.ticking = true
        const run = () => {
          this.ticking = false
          this.refresh()
        }
        if (typeof window !== 'undefined' && window.requestAnimationFrame) window.requestAnimationFrame(run)
        else run()
      }
      this.onResize = () => {
        this.measureLayout()
        this.refresh()
      }
      scope.addEventListener('scroll', this.onScroll, { passive: true })
      if (typeof window !== 'undefined') window.addEventListener('resize', this.onResize)
      if (typeof ResizeObserver !== 'undefined') {
        this.containerObserver = new ResizeObserver(() => this.onResize())
        if (this.containerEl && this.containerEl !== window) this.containerObserver.observe(this.containerEl)
        const parent = this.$el && this.$el.parentElement
        if (parent) {
          this.parentObserver = new ResizeObserver(() => this.refresh())
          this.parentObserver.observe(parent)
        }
      }
      // tab 切换（display:none）不一定触发滚动或尺寸变化，用点击后补检一次。
      this.onDocumentClick = () => {
        if (this.visibilityTimer) clearTimeout(this.visibilityTimer)
        this.visibilityTimer = setTimeout(() => this.refresh(), 80)
      }
      if (typeof document !== 'undefined') document.addEventListener('click', this.onDocumentClick, true)
      this.visibilityTimer = setTimeout(() => this.refresh(), 320)
      this.lateTimer = setTimeout(() => {
        this.measureLayout()
        this.refresh()
      }, 1200)
    },
    teardown() {
      if (this.onScroll) {
        const scope = this.scrollSource()
        scope.removeEventListener('scroll', this.onScroll)
        this.onScroll = null
      }
      if (typeof window !== 'undefined' && this.onResize) window.removeEventListener('resize', this.onResize)
      if (this.containerObserver) {
        this.containerObserver.disconnect()
        this.containerObserver = null
      }
      if (this.parentObserver) {
        this.parentObserver.disconnect()
        this.parentObserver = null
      }
      if (typeof document !== 'undefined' && this.onDocumentClick) {
        document.removeEventListener('click', this.onDocumentClick, true)
        this.onDocumentClick = null
      }
      if (this.visibilityTimer) clearTimeout(this.visibilityTimer)
      if (this.lateTimer) clearTimeout(this.lateTimer)
      this.visibilityTimer = null
      this.lateTimer = null
      this.ticking = false
    },
    // ---------- 容器 / 锚点 ----------
    scrollSource() {
      if (!this.containerEl || this.containerEl === window) {
        return typeof window === 'undefined' ? { addEventListener() {}, removeEventListener() {} } : window
      }
      return this.containerEl
    },
    resolveContainer() {
      const prop = this.container
      if (typeof prop === 'string' && prop) {
        const found = typeof document === 'undefined' ? null : document.querySelector(prop)
        if (found) return found
      } else if (prop && typeof prop === 'object' && prop.nodeType === 1) {
        return prop
      }
      const first = this.resolveAnchors()[0]
      return this.nearestScrollParent(first) || (typeof window === 'undefined' ? null : window)
    },
    nearestScrollParent(node) {
      let el = node && node.parentElement
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el)
        const overflow = style.overflowY
        if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el
        el = el.parentElement
      }
      return null
    },
    resolveAnchors() {
      if (typeof document === 'undefined' || !this.items.length) return []
      const byId = this.items.map((item) => (item.id ? document.getElementById(item.id) : null))
      if (byId.every(Boolean)) return byId
      if (this.anchorSelector) {
        const scope = this.containerEl && this.containerEl !== window ? this.containerEl : document
        const nodes = Array.from(scope.querySelectorAll(this.anchorSelector))
        if (nodes.length >= this.items.length) {
          return this.items.map((item, i) => (item.id ? document.getElementById(item.id) : null) || nodes[i])
        }
      }
      return []
    },
    measureLayout() {
      const el = this.containerEl
      const isWindow = !el || el === window
      const viewport = isWindow ? window.innerHeight : el.clientHeight
      const cap = clampNumber(Math.round(viewport * 0.74), 160, 680)
      const count = Math.max(1, this.items.length)
      this.rowHeight = Math.round(clampNumber(Math.floor(cap / count), 9, 18))
      if (isWindow) {
        this.rightOffset = 24
        this.topOffset = Math.round(window.innerHeight / 2)
        return
      }
      const rect = el.getBoundingClientRect()
      this.rightOffset = Math.max(12, Math.round(window.innerWidth - rect.right) + 12)
      this.topOffset = Math.round(rect.top + rect.height / 2)
    },
    // ---------- 测量 / 高亮 ----------
    refresh() {
      if (typeof document === 'undefined') return
      if (!this.items.length || !this.anchors.length) {
        this.hidden = true
        return
      }
      const el = this.containerEl
      const isWindow = !el || el === window
      const scrollTop = isWindow ? window.scrollY || document.documentElement.scrollTop : el.scrollTop
      const viewport = isWindow ? window.innerHeight : el.clientHeight
      const scrollHeight = isWindow ? document.documentElement.scrollHeight : el.scrollHeight
      const rect = isWindow ? { top: 0 } : el.getBoundingClientRect()
      const tops = this.anchors.map((node) => Math.round(node.getBoundingClientRect().top - rect.top + scrollTop))
      this.tops = tops
      this.scrollTop = scrollTop
      this.viewportHeight = viewport
      this.scrollHeight = scrollHeight
      const hidden = this.anchors.every((node) => node.getClientRects().length === 0)
      this.hidden = hidden
      if (hidden) return
      this.ready = true
      const index = resolveActiveIndex(tops, scrollTop, viewport, {
        readingLine: this.readingLine,
        maxScroll: scrollHeight - viewport
      })
      if (index >= 0 && index !== this.innerActive) this.innerActive = index
      if (!this.focusTouched) this.focusIndex = Math.max(0, this.innerActive)
      const percent = Math.round(progressRatio(scrollTop, scrollHeight, viewport) * 1000) / 10
      if (percent !== this.progress) this.progress = percent
    },
    // ---------- 交互 ----------
    onFocus(index) {
      // 鼠标点进来的焦点不常驻标签；只有键盘（Tab/方向键）才留标签。
      this.keyboardFocus = this.pointerDown !== true
      this.pointerDown = false
      this.focusTouched = true
      this.focusIndex = index
      this.hoverIndex = index
    },
    onBlur() {
      this.hoverIndex = -1
      this.keyboardFocus = false
    },
    reduceMotion() {
      return typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false
    },
    select(index) {
      const item = this.items[index]
      if (!item) return
      this.focusTouched = true
      this.focusIndex = index
      this.emitSelect(item)
      this.refresh()
      const target = scrollTargetFor(this.tops, index, this.scrollHeight, this.viewportHeight, this.offset)
      if (target == null) return
      const behavior = this.reduceMotion() ? 'auto' : 'smooth'
      const el = this.containerEl
      if (!el || el === window) window.scrollTo({ top: target, behavior })
      else el.scrollTo({ top: target, behavior })
      // 点击后滚动动画会把高亮带到目标题；此时清掉悬停标签，避免同时浮出两个题目标签。
      this.hoverIndex = -1
    },
    emitSelect(item) {
      this.$emit('select', item)
    },
    focusItem(index) {
      const node = this.$el && this.$el.querySelector('[data-rail-index="' + index + '"]')
      if (node) node.focus()
    },
    onKeydown(event, index) {
      let next = null
      if (event.key === 'ArrowDown') next = stepIndex(index, 1, this.items.length)
      else if (event.key === 'ArrowUp') next = stepIndex(index, -1, this.items.length)
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = this.items.length - 1
      if (next == null) return
      event.preventDefault()
      this.keyboardFocus = true
      this.focusItem(next)
    }
  }
}
</script>

<style lang="scss" scoped>
.rail-toc {
  position: fixed;
  z-index: 60;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  width: 42px;
  padding: 0;
  color: var(--zy-text-secondary, #8391a5);
  font-family: var(--zy-font-family, Inter, system-ui, sans-serif);
  background: transparent;
  transform: translateY(-50%);
  pointer-events: none;
}

.rail-track {
  position: absolute;
  top: 6px;
  right: 3px;
  bottom: 6px;
  width: 2px;
  overflow: hidden;
  background: var(--zy-border, #26374b);
  border-radius: 2px;
  pointer-events: none;

  .rail-track-fill {
    display: block;
    width: 100%;
    height: 0;
    background: var(--zy-accent-line, linear-gradient(180deg, #38bdf8 0%, #4bd6b1 100%));
    border-radius: inherit;
    transition: height 0.12s linear;
  }
}

.rail-list {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 0;
  margin: 0;
  list-style: none;
}

.rail-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 42px;
  height: var(--rail-row, 16px);
}

.rail-item {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  height: 100%;
  padding: 0;
  color: var(--zy-text-placeholder, #8391a5);
  font: inherit;
  background: none;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  pointer-events: auto;
  transition: color 0.16s var(--zy-ease-out, ease);

  &:hover,
  &.is-hover {
    color: var(--zy-text, #edf2f8);
  }

  &.is-active {
    color: var(--zy-primary, #88b0ff);

    .rail-index {
      font-weight: 700;
      opacity: 1;
    }
  }
}

.rail-index {
  width: 16px;
  font-size: var(--rail-font, 9px);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-align: right;
  letter-spacing: 0.2px;
  opacity: 0.72;
  transition: opacity 0.16s ease;

  .rail-item:hover &,
  .rail-item.is-hover & {
    opacity: 1;
  }
}

.rail-dot {
  position: relative;
  display: block;
  flex: 0 0 8px;
  width: 8px;
  height: 8px;

  &::before {
    position: absolute;
    top: 50%;
    right: 1px;
    width: 6px;
    height: 6px;
    content: '';
    background: currentColor;
    border-radius: 50%;
    opacity: 0.42;
    transform: translateY(-50%);
    transition: width 0.18s var(--zy-ease-out, ease), opacity 0.18s ease, background 0.18s ease;
  }

  .rail-item:hover &::before,
  .rail-item.is-hover &::before {
    opacity: 0.9;
  }

  .rail-item.is-active &::before {
    width: 12px;
    height: 3px;
    background: var(--zy-accent-line, linear-gradient(90deg, #38bdf8 0%, #4bd6b1 100%));
    border-radius: 2px;
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.45);
    opacity: 1;
  }
}

.rail-label {
  position: absolute;
  top: 50%;
  right: calc(100% + 10px);
  z-index: 2;
  box-sizing: border-box;
  width: max-content;
  max-width: min(300px, 34vw);
  padding: 6px 10px;
  color: var(--zy-text, #edf2f8);
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  white-space: normal;
  pointer-events: none;
  background: var(--zy-surface, #142235);
  border: 1px solid var(--zy-border, #26374b);
  border-radius: var(--zy-radius-sm, 8px);
  box-shadow: var(--zy-shadow-popup, 0 10px 30px rgba(0, 0, 0, 0.3));
  transform: translateY(-50%);
  animation: rail-label-in 0.14s var(--zy-ease-out, ease);
}

@keyframes rail-label-in {
  from {
    opacity: 0;
    transform: translate(6px, -50%);
  }
  to {
    opacity: 1;
    transform: translate(0, -50%);
  }
}

// 窄屏隐藏：不占位、不遮挡内容，也不产生横向滚动。
@media (max-width: 1099.98px) {
  .rail-toc {
    display: none !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rail-toc,
  .rail-item,
  .rail-index,
  .rail-dot::before,
  .rail-track-fill {
    transition: none !important;
  }

  .rail-label {
    animation: none !important;
  }
}
</style>
