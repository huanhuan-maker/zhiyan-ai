import { createFormRequest } from '@/api/project/form'
import { getRequest, postRequest } from '@/api/baseRequest'
import { convert } from '@/generator'

// AI 草稿的「预览」与「导入编辑器」共用同一套题型转换，避免预览与入库字段不一致。
export function createDraftField(q) {
  const field = convert.createField(q.type)
  field.config.label = q.label
  field.config.required = q.required !== false
  if (q.type === 'RADIO' || q.type === 'CHECKBOX') {
    field.config.options = q.options.map((label, i) => ({ label, value: i + 1, quotaSetting: null }))
  } else if (q.type === 'RATE') {
    field.max = q.rateMax || 5
  } else {
    field.placeholder = q.placeholder || ''
  }
  return field
}

// 只有标题、说明与题目完全一致时才算同一份草稿，才能复用上次导入的问卷。
export function draftContentKey(result) {
  return JSON.stringify({ title: result.title, description: result.description || '', questions: result.questions })
}

/**
 * 把 AI 草稿导入成一份未发布问卷（CREATE 状态），逐题走现有题目接口，与编辑器同构。
 * 断点续传：导入会话记入 sessionStorage；第 N 题保存失败后重试会复用同一份问卷，
 * 只续传完整内容一致的草稿；重新生成后内容变化须独立导入。
 * 返回 formKey；返回 null 表示旧版导入记录无法确认，调用方应停止且不新建问卷。
 */
export async function importDraftToEditor({ result, cacheKey, warn = () => {} }) {
  const questions = result.questions
  const title = result.title.slice(0, 100)
  const key = draftContentKey(result)
  let session = null
  try {
    session = JSON.parse(sessionStorage.getItem(cacheKey + ':import') || 'null')
  } catch (e) { session = null }
  if (session && session.draftKey !== key) {
    const legacyKey = JSON.stringify([result.title, questions.map((q) => [q.type, q.label])])
    if (session.draftKey === legacyKey) {
      warn('检测到旧版导入记录，无法确认内容是否一致。请先到“我的项目”检查原问卷；需要另建时，请清空结果后重新生成')
      return null
    }
    warn('草稿内容已变化，将单独导入。上一份已保存的草稿仍可在“我的项目”中管理')
    session = null
  }
  let formKey = ''
  let saved = 0
  if (session && session.formKey) {
    // 查询失败不等于问卷不存在：保留续传记录，禁止自动另建。
    let chk
    try {
      chk = await getRequest('/user/form/' + session.formKey)
    } catch (e) {
      throw new Error('暂时无法确认原导入问卷状态，已保留续传记录。请恢复网络或登录状态后重试，不会自动新建问卷')
    }
    if (!chk || chk.code !== 200 || !chk.data) throw new Error('无法确认原导入问卷，已保留续传记录，请稍后重试')
    if (Number(chk.data.status) !== 1) throw new Error('原导入问卷已不再是未发布草稿。请到“我的项目”确认；需要另建时，请清空结果后重新生成')
    formKey = session.formKey
  }
  if (!formKey) {
    const res = await createFormRequest({ name: title, description: result.description || '', type: 0, folderId: 0 })
    formKey = typeof res.data === 'string' ? res.data : res.data.formKey
    sessionStorage.setItem(cacheKey + ':import', JSON.stringify({ draftKey: key, formKey }))
  }
  const list = await getRequest('/user/form/item/list', { key: formKey })
  const done = new Set((list.data || []).map((x) => x.type + '|' + x.label))
  saved = done.size
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    if (done.has(q.type + '|' + q.label)) continue
    try {
      await postRequest('/user/form/item/create', convert.formItemConvertData(createDraftField(q), formKey))
      saved++
    } catch (e) {
      throw new Error('第 ' + (i + 1) + ' 题保存失败：已保存 ' + saved + '/' + questions.length + ' 题。可重试“导入编辑器”自动续传剩余题目，不会重复建卷')
    }
  }
  return formKey
}
