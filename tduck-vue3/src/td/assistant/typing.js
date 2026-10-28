// 显示层打字节奏：服务端已校验的分块一次性到达后，按可控速度铺开。
// 只影响显示节奏，不改变正文、不提前展示未校验内容，也不声称是模型逐 token 输出。
// 每次铺开的字数按「剩余预算时间」分摊，保证积压再多也会在 maxLagMs 内显示完。
export function revealCount(backlog, deltaMs, remainingMs) {
  if (backlog <= 0) return 0
  if (remainingMs <= 0) return backlog
  const quota = Math.ceil((backlog * Math.max(0, deltaMs)) / Math.max(1, remainingMs))
  return Math.min(backlog, Math.max(1, quota))
}

export function createTypist({
  onUpdate,
  onDone,
  now = () => Date.now(),
  schedule = (cb) => requestAnimationFrame(cb),
  cancel = (id) => cancelAnimationFrame(id),
  maxLagMs = 2000
} = {}) {
  let pending = ''
  let visible = ''
  let frame = 0
  let last = 0
  let pushedAt = 0
  let finished = false
  let stopped = false
  let waiters = []

  const settle = () => {
    const list = waiters
    waiters = []
    for (const resolve of list) resolve()
  }

  const pump = () => {
    frame = 0
    if (stopped) return
    const stamp = now()
    const delta = last ? Math.min(120, stamp - last) : 16
    last = stamp
    if (pending) {
      const remaining = pushedAt + maxLagMs - stamp
      const take = revealCount(pending.length, delta, remaining)
      visible += pending.slice(0, take)
      pending = pending.slice(take)
      onUpdate?.(visible)
    }
    if (pending) {
      frame = schedule(pump)
      return
    }
    last = 0
    if (finished) {
      onDone?.()
      settle()
    }
  }

  const ensure = () => {
    if (frame || stopped) return
    last = 0
    frame = schedule(pump)
  }

  return {
    push(text) {
      const chunk = String(text ?? '')
      if (!chunk) return
      pending += chunk
      pushedAt = now()
      ensure()
    },
    finish() {
      finished = true
      if (!pending && !frame) {
        onDone?.()
        settle()
        return Promise.resolve()
      }
      if (!pending) return new Promise((resolve) => waiters.push(resolve))
      ensure()
      return new Promise((resolve) => waiters.push(resolve))
    },
    stop() {
      stopped = true
      if (frame) cancel(frame)
      frame = 0
      settle()
    },
    text: () => visible,
    pendingLength: () => pending.length
  }
}
