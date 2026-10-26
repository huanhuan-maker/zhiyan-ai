import request from '@/api/index'
const root = '/user/form/assistant'
export const assistantStatus = () => request.get(root + '/status')
export const assistantConversations = () => request.get(root + '/conversations')
export const createAssistantConversation = () => request.post(root + '/conversations')
export const assistantHistory = id => request.get(root + '/conversations/' + id)
export const assistantVersions = formKey => request.get(root + '/versions', { params: { formKey } })
export const planAssistantQuery = data => request.post(root + '/plan', data, { timeout: 120000 })
export const decideAssistantAction = (id,confirm) => request.post(root + '/actions/' + id + '/decision', { confirm }, { timeout: 120000 })
