// 表单发布相关接口
import { getRequest, postRequest } from '../baseRequest'

// 获取表单公开发布状态
export const getFormStatusRequest = (formKey) => getRequest('/user/form/' + formKey)
// 发布表单（返回 versionNo/shareToken 版本分享令牌）
export const publishFormRequest = (data) => postRequest('/user/form/publish', data)
// 停止发布表单
export const stopPublishFormRequest = (data) => postRequest('/user/form/stop', data)
// 问卷发布版本列表（含各版本答卷数与分享令牌）
export const listFormVersionsRequest = (key) => getRequest('/user/form/versions', { key })
