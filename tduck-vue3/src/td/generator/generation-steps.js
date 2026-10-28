// AI 建卷进度的阶段推导：把服务端真实阶段事件映射到四步展示，供组件与单测共用。
export const GENERATION_STEPS = ['需求检查', 'AI 设计问卷', '检查生成结果', '草稿就绪']
export const TERMINAL_FAILURE = 'FAILED'

export function phaseStep(phase) {
  if (phase === 'SUCCEEDED' || phase === 'CLARIFICATION') return 3
  if (phase === 'VALIDATING') return 2
  if (phase === 'MODEL_RUNNING' || phase === 'MOCK_RUNNING') return 1
  return 0
}

export function activeStep(state, phase, events = []) {
  const last = events.length ? events[events.length - 1].phase : 'REGISTERED'
  const source = state === 'failed' ? (events.filter((e) => e.phase !== TERMINAL_FAILURE).pop()?.phase || 'REGISTERED') : phase || last
  if (state === 'succeeded' || state === 'clarification') return 3
  return phaseStep(source)
}

export function stepStates(state, phase, events = []) {
  const active = activeStep(state, phase, events)
  const complete = state === 'succeeded' || state === 'clarification'
  return GENERATION_STEPS.map((label, index) => ({
    label,
    index,
    done: complete ? index <= 3 : index < active,
    active: !complete && state !== 'failed' && index === active,
    failed: state === 'failed' && index === active
  }))
}

// 连接线进度（0–100）：已完成阶段之间的实线长度。
export function stepProgress(state, phase, events = []) {
  if (state === 'succeeded' || state === 'clarification') return 100
  return Math.round((activeStep(state, phase, events) / (GENERATION_STEPS.length - 1)) * 100)
}

// 某一步在真实事件里最后一次出现的记录，用于"回看"时显示当时的阶段说明与耗时。
export function stepRecord(events = [], index) {
  let hit = null
  for (const event of events) if (phaseStep(event.phase) === index) hit = event
  return hit
}
