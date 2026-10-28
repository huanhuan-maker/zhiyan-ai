import { describe, expect, it } from 'vitest'
import { answerCountLabel, applyAnswerCounts } from '../../src/td/utils/answerCounts'

describe('answer counts on the survey card', () => {
  it('merges counts by formKey and keeps list order', () => {
    const list = [{ formKey: 'a', name: 'A' }, { formKey: 'b', name: 'B' }]
    const merged = applyAnswerCounts(list, { b: 12, a: 0 })
    expect(merged.map((item) => item.answerCount)).toEqual([0, 12])
    expect(merged.map((item) => item.name)).toEqual(['A', 'B'])
  })

  it('uses null instead of inventing zero for unknown counts', () => {
    const merged = applyAnswerCounts([{ formKey: 'a' }, { formKey: 'missing' }], { a: 3 })
    expect(merged[0].answerCount).toBe(3)
    expect(merged[1].answerCount).toBeNull()
    expect(answerCountLabel(merged[1].answerCount)).toBe('—')
  })

  it('tolerates a failed or malformed response without breaking the list', () => {
    expect(applyAnswerCounts([{ formKey: 'a' }], null)[0].answerCount).toBeNull()
    expect(applyAnswerCounts([{ formKey: 'a' }], 'oops')[0].answerCount).toBeNull()
    expect(applyAnswerCounts(null, { a: 1 })).toEqual([])
  })

  it('rejects non numeric values from the server', () => {
    expect(applyAnswerCounts([{ formKey: 'a' }], { a: 'nope' })[0].answerCount).toBeNull()
    expect(answerCountLabel(0)).toBe('0')
  })
})
