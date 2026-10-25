import request from '@/api'
export const getAiSettings = () => request.get('/user/ai-settings')
export const saveAiSettings = data => request.post('/user/ai-settings', data)
export const testAiModel = id => request.post('/user/ai-settings/test/' + encodeURIComponent(id), {}, { timeout: 125000 })
