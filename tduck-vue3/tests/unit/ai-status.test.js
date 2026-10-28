import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AiStatus from '../../src/td/components/AiStatus/index.vue'

afterEach(() => { vi.useRealTimers() })

describe('AiStatus', () => {
  it('显示服务端阶段文案，并用受控耗时显示秒数', async () => {
    const wrapper = mount(AiStatus, { props: { message: '正在检索答卷、整理分析并核对来源…', elapsedMs: 4200 } })
    expect(wrapper.find('[role="status"]').attributes('aria-label')).toContain('正在检索答卷')
    expect(wrapper.find('[role="status"]').attributes('aria-label')).toContain('已用 4 秒')
    expect(wrapper.find('.ai-status__time').text()).toBe('4s')
    expect(wrapper.text()).toContain('正在检索答卷')
  })

  it('没有外部耗时来源时自己计时，不足 1 秒不显示 0s', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AiStatus, { props: { message: '正在回复…' } })
    expect(wrapper.find('.ai-status__time').text()).toBe('')
    vi.advanceTimersByTime(1500)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.ai-status__time').text()).toBe('1s')
    wrapper.unmount()
  })

  it('空闲态标记 is-idle，仍保留可读文案', () => {
    const wrapper = mount(AiStatus, { props: { message: '草稿已就绪', active: false, elapsedMs: 6800 } })
    expect(wrapper.classes()).toContain('is-idle')
    expect(wrapper.text()).toContain('草稿已就绪')
  })
})
