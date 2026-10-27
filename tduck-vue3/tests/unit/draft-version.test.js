import { describe, expect, it } from 'vitest'
import { sameDraftSnapshot } from '../../src/td/generator/draft-version'

describe('comparing saved drafts', () => {
  it('ignores object key order at any depth', () => {
    const a = { form: { goal: '调查', audience: '学生' }, result: { questions: [{ label: '题目', required: true }] } }
    const b = { result: { questions: [{ required: true, label: '题目' }] }, form: { audience: '学生', goal: '调查' } }
    expect(sameDraftSnapshot(a, b)).toBe(true)
  })
  it('detects changes to content and question or option ordering', () => {
    const a = { questions: [{ label: '题目', options: ['是', '否'] }, { label: '另一题' }] }
    expect(sameDraftSnapshot(a, { questions: [{ label: '题目', options: ['否', '是'] }, { label: '另一题' }] })).toBe(false)
    expect(sameDraftSnapshot(a, { questions: [{ label: '另一题' }, { label: '题目', options: ['是', '否'] }] })).toBe(false)
    expect(sameDraftSnapshot({ result: null }, {})).toBe(false)
  })
})
