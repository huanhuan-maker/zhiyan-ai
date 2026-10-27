import { getRequest } from '../baseRequest'
import request from '../index'

// M2 AI 问卷草稿：状态与生成都由服务端统一调用 Provider，密钥不出服务端
export const getAiStatusRequest = () => getRequest('/user/form/ai/status')

export const generateAiDraftRequest = (data) => request.post('/user/form/ai/draft', data, { timeout: 120000 })
export const getAiDraftWorkspaceRequest = () => request.get('/user/form/ai/workspace')
export const saveAiDraftWorkspaceRequest = (data) => request.post('/user/form/ai/workspace', data)
export const clearAiDraftWorkspaceRequest = () => request.post('/user/form/ai/workspace/clear')
export const optimizeQuestionRequest = (data) => request.post('/user/form/ai/optimize-question', data, { timeout: 120000 })
export const reviewSurveyRequest = (data) => request.post('/user/form/ai/review-survey', data, { timeout: 120000 })
