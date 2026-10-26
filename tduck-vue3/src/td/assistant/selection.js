// A result-card click targets one survey, rather than repeating the catalogue request.
export function selectedSurveyQuestion(previous = '') {
  const text = String(previous).trim()
  const version = /(?:v\s*|版本\s*)([1-9][0-9]{0,4})/i.exec(text)
  const scope = '这份问卷' + (text.includes('最新') ? '最新版本' : version ? ` V${Number(version[1])}` : '')
  if (/数据图|统计图|可视化|图表|出图|画.*图|生成.*图|柱状图|条形图|饼图|环形图|折线图|趋势图/.test(text)) {
    const type=/饼图|环形图/.test(text)?'饼图':/柱状图|条形图/.test(text)?'柱状图':/折线图|趋势图/.test(text)?'回收趋势图':'数据图'
    const quoted=[...text.matchAll(/[“"‘']([^”"’']{1,100})[”"’']/g)]
    const field=quoted.length>1?`中“${quoted.at(-1)[1]}”的`:''
    return `基于${scope}${field}生成${type}`
  }
  const numbers = [...text.matchAll(/第\s*([1-9][0-9]{0,2})\s*题/g)].map(m=>Number(m[1]))
  if (numbers.length && /删除|移除/.test(text)) return `删除这份问卷的第${numbers[0]}题`
  if (numbers.length === 2 && /移动|移到|调整/.test(text)) return `将这份问卷第${numbers[0]}题移动到第${numbers[1]}题`
  if (/删除|回收站/.test(text)) return '把这份问卷移入回收站'
  if (/停止.*收集|停收/.test(text)) return '停止这份问卷的收集'
  if (/复制/.test(text)) return '复制这份问卷'
  if (/发布/.test(text) && !/版本|历史/.test(text)) return '发布这份问卷'
  if (/导出/.test(text)) return `导出${scope}的答卷`
  if (/分享|链接/.test(text)) return `获取${scope}的分享链接`
  if (/版本历史|版本列表|所有版本/.test(text)) return '查看这份问卷的版本列表'
  if (/题目|问卷内容/.test(text)) return `查看${scope}的题目`
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
