// A result-card click targets one survey, rather than repeating the catalogue request.
export function selectedSurveyQuestion(previous = '') {
  const text = String(previous).trim()
  const version = /(?:v\s*|版本\s*)([1-9][0-9]{0,4})/i.exec(text)
  const scope = '这份问卷' + (text.includes('最新') ? '最新版本' : version ? ` V${Number(version[1])}` : '')
  if (/原文|提到|关键词|包含.*回答/.test(text)) {
    const quoted = [...text.matchAll(/[“"‘']([^”"’']{1,30})[”"’']/g)]
    const plain = /(?:提到|包含|关键词(?:为|是|[:：])?)\s*(.+)/.exec(text)
    let term = quoted.length ? quoted[quoted.length - 1][1] : plain?.[1] || ''
    term = term.replace(/[？?。！!]+$/, '').replace(/的(?:回答|原文|意见|建议|内容)$/, '').trim()
    if (term && term.length <= 30) return `查看${scope}中提到“${term}”的回答`
  }
  if (/报告|结论/.test(text)) return `查看${scope}的已审核报告`
  if (/均值|评分|平均/.test(text)) return `查看${scope}的评分均值`
  return `查一下${scope}的回收统计`
}
