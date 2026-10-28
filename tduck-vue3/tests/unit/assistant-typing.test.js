import { describe, expect, it } from 'vitest'
import { createTypist, revealCount } from '../../src/td/assistant/typing'

function manualTypist(maxLagMs = 2000) {
  let clock = 0
  const queue = []
  const updates = []
  let done = 0
  const typist = createTypist({
    now: () => clock,
    schedule: (cb) => {
      queue.push(cb)
      return queue.length
    },
    cancel: () => {},
    onUpdate: (text) => updates.push(text),
    onDone: () => { done++ },
    maxLagMs
  })
  const frame = (ms = 16) => {
    clock += ms
    const cb = queue.shift()
    if (cb) cb()
  }
  return { typist, updates, frame, doneCount: () => done, pendingFrames: () => queue.length, clock: () => clock }
}

describe('revealCount', () => {
  it('一次至少推进一个字，且不超过剩余长度', () => {
    expect(revealCount(0, 16, 2000)).toBe(0)
    expect(revealCount(5, 0, 2000)).toBe(1)
    expect(revealCount(5, 16, 2000)).toBeGreaterThanOrEqual(1)
    expect(revealCount(1, 1000, 2000)).toBe(1)
    expect(revealCount(400, 5000, 10)).toBeLessThanOrEqual(400)
  })

  it('预算耗尽时一次铺完，不会把长文拖成十几秒', () => {
    expect(revealCount(800, 16, 0)).toBe(800)
    expect(revealCount(800, 16, -5)).toBe(800)
  })

  it('积压越多推进越快', () => {
    expect(revealCount(4000, 16, 2000)).toBeGreaterThan(revealCount(40, 16, 2000))
  })
})

describe('createTypist', () => {
  it('按帧铺开分块，finish 之后才结束', async () => {
    const { typist, updates, frame } = manualTypist()
    typist.push('第一段')
    typist.push('第二段')
    expect(typist.text()).toBe('')
    expect(typist.pendingLength()).toBe(6)
    frame()
    expect(typist.text().length).toBeGreaterThan(0)
    expect(updates.length).toBe(1)
    const finished = typist.finish()
    let settled = false
    finished.then(() => { settled = true })
    for (let i = 0; i < 400 && typist.pendingLength() > 0; i++) frame()
    expect(typist.text()).toBe('第一段第二段')
    await finished
    expect(settled).toBe(true)
    expect(updates.at(-1)).toBe('第一段第二段')
  })

  it('一千字积压也在预算时间内铺完', async () => {
    const { typist, frame, clock } = manualTypist(2000)
    typist.push('字'.repeat(1000))
    for (let i = 0; i < 200 && typist.pendingLength() > 0; i++) frame()
    expect(typist.pendingLength()).toBe(0)
    expect(typist.text()).toHaveLength(1000)
    expect(clock()).toBeLessThanOrEqual(2400)
  })

  it('空文本 finish 立即完成，stop 之后不再继续铺开', async () => {
    const { typist, frame } = manualTypist()
    await expect(typist.finish()).resolves.toBeUndefined()
    const second = manualTypist()
    second.typist.push('abcdefghijklmnop')
    second.frame()
    const before = second.typist.text()
    second.typist.stop()
    second.frame()
    expect(second.typist.text()).toBe(before)
    expect(second.pendingFrames()).toBe(0)
  })
})
