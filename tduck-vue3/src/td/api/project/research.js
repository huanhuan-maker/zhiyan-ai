import request from '@/api/index'
const root = '/user/form/research'
export const researchStatus = () => request.get(root + '/status')
export const researchSnapshot = (formKey, version) => request.get(root + '/snapshot', { params: { formKey, version } })
export const researchReports = (formKey, version) => request.get(root + '/reports', { params: { formKey, version } })
export const researchReport = (id) => request.get(root + '/reports/' + id)
export const generateResearch = (data) => request.post(root + '/reports', data, { timeout: 120000 })
export const reviewResearch = (id, data) => request.post(root + '/reports/' + id + '/review', data)
export const exportResearch = (id, format) => request.get(root + '/reports/' + id + '/export', { params: { format }, responseType: 'blob' })
