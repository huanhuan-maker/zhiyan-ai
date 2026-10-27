import unescape from 'lodash/unescape'

export const designTypes = ['RADIO', 'CHECKBOX', 'RATE', 'INPUT', 'TEXTAREA']
export const plainDesignText = value => unescape(String(value || '').replace(/<[^>]*>/g, ''))
const clone = value => JSON.parse(JSON.stringify(value))
const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function toDesignQuestion(field) {
  const q = { type: field.typeId, label: plainDesignText(field.config.label), required: field.config.required !== false }
  if (['RADIO', 'CHECKBOX'].includes(q.type)) {
    q.options = (field.config.options || []).map(o => plainDesignText(o.label))
    q.optionsLocked = field.config.optionsType === 1
  }
  if (q.type === 'RATE') q.rateMax = field.max || 5
  if (['INPUT', 'TEXTAREA'].includes(q.type)) q.placeholder = plainDesignText(field.placeholder)
  return q
}

// Preserve question identity and editor configuration; option identities follow unchanged labels.
export function applyDesignQuestion(field, candidate) {
  if (field.typeId !== candidate.type || (field.config.required !== false) !== candidate.required) throw new Error('原题设置已变化，请重新优化')
  const out = clone(field)
  out.config.label = escape(candidate.label)
  if (['RADIO', 'CHECKBOX'].includes(candidate.type)) {
    const old = out.config.options || [], used = new Set(), reserved = new Set()
    const matches = candidate.options.map(label => {
      const i = old.findIndex((o, n) => !reserved.has(n) && plainDesignText(o.label) === label)
      if (i >= 0) reserved.add(i)
      return i
    })
    let next = Math.max(0, ...old.map(o => Number(o.value) || 0)) + 1
    out.config.options = candidate.options.map((label, n) => {
      let i = matches[n]
      if (i < 0) i = old.findIndex((_, k) => !used.has(k) && !reserved.has(k))
      if (i >= 0) { used.add(i); return { ...old[i], label } }
      return { label, value: next++, quotaSetting: null }
    })
    const values = new Set(out.config.options.map(o => o.value))
    if (candidate.type === 'CHECKBOX' && Array.isArray(out.config.defaultValue)) out.config.defaultValue = out.config.defaultValue.filter(v => values.has(v))
    if (candidate.type === 'RADIO' && !values.has(out.config.defaultValue)) out.config.defaultValue = null
  }
  if (['INPUT', 'TEXTAREA'].includes(candidate.type)) out.placeholder = candidate.placeholder || ''
  return out
}

export const designSnapshot = value => JSON.stringify(value)
