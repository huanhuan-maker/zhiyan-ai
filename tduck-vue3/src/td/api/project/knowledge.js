import request from '@/api/index'
const root = '/user/form/knowledge'
export const listKnowledge = () => request.get(root)
export const syncKnowledge = data => request.post(root + '/sync', data, { timeout: 120000 })
export const searchKnowledge = data => request.post(root + '/search', data, { timeout: 120000 })
