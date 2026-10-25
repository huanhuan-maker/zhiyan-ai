import { getRequest } from '../baseRequest'
import request from '../index'

// M2 AI 问卷草稿：状态与生成都由服务端统一调用 Provider，密钥不出服务端
export const getAiStatusRequest = () => getRequest('/user/form/ai/status')

export const generateAiDraftRequest = (data) => request.post('/user/form/ai/draft', data, { timeout: 120000 })
