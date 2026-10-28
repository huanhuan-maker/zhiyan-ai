import { describe, expect, it } from 'vitest'
import { activeStep, phaseStep, stepProgress, stepRecord, stepStates } from '../../src/td/generator/generation-steps'

const events = [
  { phase: 'REGISTERED', message: '请求已登记', elapsedMs: 0 },
  { phase: 'RECEIVED', message: '服务器已接收', elapsedMs: 120 },
  { phase: 'INPUT_VALIDATED', message: '输入检查通过', elapsedMs: 240 },
  { phase: 'MODEL_RUNNING', message: '模型正在设计', elapsedMs: 400 },
  { phase: 'VALIDATING', message: '正在检查题型', elapsedMs: 6200 },
  { phase: 'SUCCEEDED', message: '草稿检查完成', elapsedMs: 6800 }
]

describe('phaseStep', () => {
  it('把服务端真实阶段映射到四步', () => {
    expect(phaseStep('REGISTERED')).toBe(0)
    expect(phaseStep('INPUT_VALIDATED')).toBe(0)
    expect(phaseStep('MODEL_RUNNING')).toBe(1)
    expect(phaseStep('MOCK_RUNNING')).toBe(1)
    expect(phaseStep('VALIDATING')).toBe(2)
    expect(phaseStep('SUCCEEDED')).toBe(3)
    expect(phaseStep('CLARIFICATION')).toBe(3)
  })
})

describe('activeStep / stepStates / stepProgress', () => {
  it('运行中只推进到最后真实到达的阶段', () => {
    expect(activeStep('running', 'MODEL_RUNNING', events)).toBe(1)
    expect(activeStep('running', 'VALIDATING', events)).toBe(2)
    expect(stepProgress('running', 'VALIDATING', events)).toBe(67)
  })

  it('成功后四步全部完成，进度 100', () => {
    const states = stepStates('succeeded', 'SUCCEEDED', events)
    expect(states.every((s) => s.done)).toBe(true)
    expect(states.some((s) => s.active)).toBe(false)
    expect(stepProgress('succeeded', 'SUCCEEDED', events)).toBe(100)
  })

  it('失败定位到最后一次有效阶段，并标记失败步', () => {
    const failed = [...events.slice(0, 4), { phase: 'FAILED', message: '模型失败', elapsedMs: 900 }]
    expect(activeStep('failed', 'FAILED', failed)).toBe(1)
    const states = stepStates('failed', 'FAILED', failed)
    expect(states[1].failed).toBe(true)
    expect(states[1].done).toBe(false)
    expect(states[0].done).toBe(true)
  })
})

describe('stepRecord', () => {
  it('回看时返回该步真实事件与耗时', () => {
    expect(stepRecord(events, 2)).toMatchObject({ phase: 'VALIDATING', elapsedMs: 6200 })
    expect(stepRecord(events, 3)).toMatchObject({ phase: 'SUCCEEDED' })
    expect(stepRecord([], 1)).toBeNull()
  })
})
