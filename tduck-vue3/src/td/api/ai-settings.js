import request from '@/api'

// scope: 'mine' = 当前账号自己的模型配置；'global' = 系统默认配置（仅管理员）
const base = scope => (scope === 'global' ? '/user/ai-settings' : '/user/ai-settings/mine')

export const getAiSettings = (scope = 'mine') => request.get(base(scope))
export const saveAiSettings = (data, scope = 'mine') => request.post(base(scope), data)
export const testAiModel = (id, scope = 'mine') => request.post(base(scope) + '/test/' + encodeURIComponent(id), {}, { timeout: 125000 })
