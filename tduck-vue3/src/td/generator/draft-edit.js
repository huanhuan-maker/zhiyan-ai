// Validate a detached question before replacing one entry in an unpublished AI draft.
export function editedDraftQuestion(question, questions, index) {
  const q = JSON.parse(JSON.stringify(question))
  if (!['RADIO', 'CHECKBOX', 'RATE', 'TEXTAREA'].includes(q.type)) throw new Error('请选择支持的题型')
  q.label = String(q.label || '').trim()
  if (!q.label || q.label.length > 200) throw new Error('题干不能为空，且不能超过 200 字')
  if (questions.some((other, i) => i !== index && String(other.label || '').trim() === q.label)) throw new Error('题干与其他题目重复，请调整后保存')
  q.required = q.required !== false
  if (['RADIO', 'CHECKBOX'].includes(q.type)) {
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 20) throw new Error('选择题需要 2～20 个选项')
    q.options = q.options.map(value => String(value || '').trim())
    if (q.options.some(value => !value || value.length > 200)) throw new Error('选项不能为空，且不能超过 200 字')
    if (new Set(q.options).size !== q.options.length) throw new Error('选项不能重复，请调整后保存')
  } else delete q.options
  if (q.type === 'RATE') {
    if (!Number.isInteger(q.rateMax) || q.rateMax < 2 || q.rateMax > 10) throw new Error('评分上限必须是 2～10 的整数')
  } else delete q.rateMax
  q.placeholder = String(q.placeholder || '').trim()
  if (q.placeholder.length > 200) throw new Error('回答提示不能超过 200 字')
  return q
}
