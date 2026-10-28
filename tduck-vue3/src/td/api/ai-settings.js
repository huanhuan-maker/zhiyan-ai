import request from '@/api'

// 系统配置页的 AI 配置就是系统默认模型；scope 保留以便后端仍支持账号级配置时复用。
const base = scope => (scope === 'mine' ? '/user/ai-settings/mine' : '/user/ai-settings')

export const getAiSettings = (scope = 'global') => request.get(base(scope))
export const saveAiSettings = (data, scope = 'global') => request.post(base(scope), data)
export const testAiModel = (id, scope = 'global') => request.post(base(scope) + '/test/' + encodeURIComponent(id), {}, { timeout: 125000 })
