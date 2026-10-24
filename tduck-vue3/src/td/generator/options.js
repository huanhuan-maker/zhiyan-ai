import get from 'lodash/get'

// Remote definitions use lodash paths in the original TDuck schema.
export function remoteOptions(payload, config) {
  const rows = config.dataPath ? get(payload, config.dataPath) : payload
  if (!Array.isArray(rows)) throw new Error('选项接口的数据路径必须指向数组')
  const convert = entries => entries.map(entry => {
    const value = get(entry, config.valueField), label = get(entry, config.labelField)
    if (value == null || label == null) throw new Error('选项接口缺少配置的值或文字字段')
    const children = config.childrenField && get(entry, config.childrenField)
    return {value, label, ...(Array.isArray(children) && children.length ? {children: convert(children)} : {})}
  })
  return convert(rows)
}

export function exclusiveSelection(previous, next, config) {
  if (!config.withExclusiveChoice || !next.length) return next
  const same = (a,b) => String(a) === String(b)
  const added = next.find(value => !previous.some(old => same(old,value)))
  const exclusive = value => (config.exclusiveChoiceApiCodes || []).some(code => same(code,value))
  if (added !== undefined && exclusive(added)) return [added]
  return added !== undefined ? next.filter(value => !exclusive(value)) : next
}
