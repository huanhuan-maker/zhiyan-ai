import { describe, expect, it } from 'vitest'
import {
  buildRailItems,
  progressRatio,
  railAnchorId,
  resolveActiveIndex,
  scrollTargetFor,
  stepIndex
} from '../../src/td/components/RailToc/rail'

describe('rail toc active item from scroll position', () => {
  it('keeps the first question active at the very top', () => {
    expect(resolveActiveIndex([0, 520, 1040], 0, 940)).toBe(0)
  })

  it('picks the last anchor above the reading line', () => {
    // 阅读线 = 100 + 940 * 0.32 ≈ 400.8，位于第 2 题（520）之前，仍算第 1 题
    expect(resolveActiveIndex([0, 520, 1040], 100, 940)).toBe(0)
    // 阅读线 ≈ 700，越过第 2 题顶部，激活第 2 题
    expect(resolveActiveIndex([0, 520, 1040], 400, 940)).toBe(1)
    expect(resolveActiveIndex([0, 520, 1040], 230, 940)).toBe(1)
    expect(resolveActiveIndex([0, 520, 1040], 900, 940)).toBe(2)
    expect(resolveActiveIndex([0, 520, 1040], 1500, 940)).toBe(2)
  })

  it('forces the last item when the container is scrolled to the bottom', () => {
    // 最后一题很矮，阅读线永远压不到它，贴底时也要高亮它
    expect(resolveActiveIndex([0, 520, 900], 3800, 940, { maxScroll: 3900 })).toBe(2)
    expect(resolveActiveIndex([0, 520, 900], 0, 940, { maxScroll: 3900 })).toBe(0)
  })

  it('uses a fixed pixel reading line so short cards never skip a question', () => {
    // 题卡高 150px，阅读线 96px：定位到第 2 题顶部附近时仍应高亮第 2 题，而不是第 3 题
    const tops = [0, 150, 300, 450]
    expect(resolveActiveIndex(tops, 150, 900, { readingLine: 96 })).toBe(1)
    expect(resolveActiveIndex(tops, 450, 900, { readingLine: 96 })).toBe(3)
    expect(resolveActiveIndex(tops, 0, 900, { readingLine: 96 })).toBe(0)
    expect(resolveActiveIndex(tops, 60, 900, { readingLine: 96 })).toBe(1)
  })

  it('respects the reading line bias and tolerates empty input', () => {
    const tops = [0, 300, 600]
    expect(resolveActiveIndex(tops, 0, 1000, { bias: 0 })).toBe(0)
    expect(resolveActiveIndex(tops, 0, 1000, { bias: 0.35 })).toBe(1)
    expect(resolveActiveIndex(tops, 0, 1000, { bias: 0.45 })).toBe(1)
    expect(resolveActiveIndex([], 0, 900)).toBe(-1)
    expect(resolveActiveIndex(null, 0, 900)).toBe(-1)
  })
})

describe('rail toc reading progress', () => {
  it('maps scroll position to 0..1 and never overshoots', () => {
    expect(progressRatio(0, 4000, 1000)).toBe(0)
    expect(progressRatio(1500, 4000, 1000)).toBe(0.5)
    expect(progressRatio(3000, 4000, 1000)).toBe(1)
    expect(progressRatio(9999, 4000, 1000)).toBe(1)
    expect(progressRatio(-50, 4000, 1000)).toBe(0)
  })

  it('reports zero progress when there is nothing to scroll', () => {
    expect(progressRatio(0, 900, 900)).toBe(0)
    expect(progressRatio(120, 900, 900)).toBe(0)
  })
})

describe('rail toc click target', () => {
  const tops = [0, 520, 1040]
  it('aligns the card top under the offset and clamps to the scroll range', () => {
    expect(scrollTargetFor(tops, 1, 4000, 940, 24)).toBe(496)
    expect(scrollTargetFor(tops, 0, 4000, 940, 24)).toBe(0)
    expect(scrollTargetFor(tops, 2, 1040, 940, 24)).toBe(100)
  })

  it('returns null for an unknown item instead of scrolling to zero', () => {
    expect(scrollTargetFor(tops, -1, 4000, 940)).toBeNull()
    expect(scrollTargetFor(tops, 3, 4000, 940)).toBeNull()
    expect(scrollTargetFor([], 0, 4000, 940)).toBeNull()
  })
})

describe('rail toc keyboard movement', () => {
  it('moves inside the list without wrapping around', () => {
    expect(stepIndex(0, 1, 5)).toBe(1)
    expect(stepIndex(4, 1, 5)).toBe(4)
    expect(stepIndex(0, -1, 5)).toBe(0)
    expect(stepIndex(2, -3, 5)).toBe(0)
    expect(stepIndex(0, 0, 5)).toBe(0)
    expect(stepIndex(0, 1, 0)).toBe(-1)
  })
})

describe('rail toc anchors and items', () => {
  it('derives stable anchors from field ids and falls back to the sequence', () => {
    expect(railAnchorId('question', 'radio1793098473826924', 0)).toBe('question-radio1793098473826924')
    expect(railAnchorId('question', null, 4)).toBe('question-5')
    expect(railAnchorId('question', '  ', 0)).toBe('question-1')
    expect(railAnchorId('question', 'a b/c#d', 0)).toBe('question-a-b-c-d')
  })

  it('builds numbered rail items that match the question cards', () => {
    const list = [
      { fieldId: 'f1', label: '你目前的年级是？' },
      { fieldId: 'f2', title: '你的专业类别是？' },
      { fieldId: 'f3' }
    ]
    const items = buildRailItems(list, {
      anchorPrefix: 'question',
      labelOf: (item) => item.label || item.title,
      idOf: (item) => item.fieldId
    })
    expect(items.map((item) => item.index)).toEqual([1, 2, 3])
    expect(items.map((item) => item.id)).toEqual(['question-f1', 'question-f2', 'question-f3'])
    expect(items[0].label).toBe('你目前的年级是？')
    expect(items[1].label).toBe('你的专业类别是？')
    expect(items[2].label).toBe('题目 3')
  })

  it('strips html from labels and survives an empty list', () => {
    const items = buildRailItems([{ fieldId: 'x', label: '<b>带标签</b>的题干' }])
    expect(items[0].label).toBe('带标签的题干')
    expect(buildRailItems(null)).toEqual([])
    expect(buildRailItems(undefined)).toEqual([])
  })
})
