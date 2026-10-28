// 题目导航轨（Rail TOC）的纯计算：不依赖 DOM，便于单元测试。
// 组件只负责测量锚点位置与滚动状态，激活项/进度/滚动目标都由这里算。

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export function clampNumber(value, min, max) {
  const num = toNumber(value, min)
  if (num < min) return min
  if (num > max) return max
  return num
}

// 键盘上下键：只在下标范围内移动，不循环，避免从最后一项突然跳回第一项。
export function stepIndex(current, delta, length) {
  const total = Math.max(0, Math.round(toNumber(length, 0)))
  if (total === 0) return -1
  const base = Math.round(toNumber(current, 0))
  return clampNumber(base + Math.round(toNumber(delta, 0)), 0, total - 1)
}

// 滚动高亮：阅读线之上、最近的一道题就是当前题。
// readingLine 给固定像素（默认用组件传入的 96px，题卡高度小于阅读线时也不会一次跳过两题）；
// 也可以只给 bias（按视口比例）作为旧口径。
// 贴底时强制最后一项，避免最后一题过矮、阅读线永远压不到它。
export function resolveActiveIndex(tops, scrollTop, viewportHeight, options = {}) {
  const list = Array.isArray(tops) ? tops.filter((top) => Number.isFinite(Number(top))).map(Number) : []
  if (!list.length) return -1
  if (options.maxScroll != null) {
    const maxScroll = toNumber(options.maxScroll, 0)
    if (maxScroll > 2 && toNumber(scrollTop, 0) >= maxScroll - 2) return list.length - 1
  }
  const line =
    options.readingLine != null
      ? Math.max(0, toNumber(options.readingLine, 0))
      : Math.max(0, toNumber(viewportHeight, 0)) * clampNumber(options.bias == null ? 0.32 : options.bias, 0, 1)
  const probe = toNumber(scrollTop, 0) + line
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i] <= probe + 0.5) return i
  }
  return 0
}

// 阅读进度：0..1，容器不足一屏时为 0。
export function progressRatio(scrollTop, scrollHeight, clientHeight) {
  const max = toNumber(scrollHeight, 0) - toNumber(clientHeight, 0)
  if (max <= 0) return 0
  return clampNumber(toNumber(scrollTop, 0) / max, 0, 1)
}

// 点击某项后容器应滚动到的位置：题卡顶部对齐到 offset，且不越过上下边界。
export function scrollTargetFor(tops, index, scrollHeight, clientHeight, offset = 24) {
  const list = Array.isArray(tops) ? tops : []
  const at = Math.round(toNumber(index, -1))
  if (at < 0 || at >= list.length) return null
  const top = toNumber(list[at], 0) - toNumber(offset, 0)
  const max = Math.max(0, toNumber(scrollHeight, 0) - toNumber(clientHeight, 0))
  return clampNumber(top, 0, max)
}

// 锚点 id：字段 id 优先（稳定），缺失时退回序号；只保留 id 安全字符。
export function railAnchorId(prefix, value, index) {
  const head = String(prefix || 'question')
  const raw = value == null ? '' : String(value).trim()
  const tail = raw || String(Math.round(toNumber(index, 0)) + 1)
  const safe = tail.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return head + '-' + (safe || String(Math.round(toNumber(index, 0)) + 1))
}

// 题目列表 -> rail 条目；序号从 1 开始，与题卡标题一致。
export function buildRailItems(list, options = {}) {
  const source = Array.isArray(list) ? list : []
  const labelOf = typeof options.labelOf === 'function' ? options.labelOf : (item) => item && (item.label || item.title)
  const idOf = typeof options.idOf === 'function' ? options.idOf : (item) => item && (item.fieldId || item.id)
  const prefix = options.anchorPrefix || 'question'
  const fallback = options.fallbackLabel || '题目'
  return source.map((item, index) => {
    const label = String(defaultLabel(labelOf(item), index, fallback))
    return {
      id: railAnchorId(prefix, idOf(item), index),
      label,
      index: index + 1
    }
  })
}

function defaultLabel(value, index, fallback) {
  const text = value == null ? '' : String(value).replace(/<[^>]*>/g, '').trim()
  return text || fallback + ' ' + (index + 1)
}
