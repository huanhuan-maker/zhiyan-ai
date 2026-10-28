// A result-card click targets one survey, rather than repeating the catalogue request.
import {positiveChartQuestion,wantsInlineChart} from './knowledge'
export function selectedSurveyQuestion(previous = '', selectedTitle = '') {
  const text = String(previous).trim()
  const version = /(?:v\s*|版本\s*)([1-9][0-9]{0,4})/i.exec(text)
  const scope = '这份问卷' + (text.includes('最新') ? '最新版本' : version ? ` V${Number(version[1])}` : '')
  if (wantsInlineChart(text)) {
    const chartText=positiveChartQuestion(text)
    const type=/饼图|环形图/.test(chartText)?'饼图':/柱状图|条形图/.test(chartText)?'柱状图':/折线图|趋势图/.test(chartText)?'回收趋势图':'数据图'
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
  let actual=text
  if(selectedTitle)actual=actual.replaceAll(`“${selectedTitle}”`,scope).replaceAll(`"${selectedTitle}"`,scope).replaceAll(selectedTitle,scope)
  const scoped=()=>`关于${scope}，${actual.replace(/^(?:请|帮我)?(?:查找|找到|搜索|找一下|找)(?:一下)?/,'')}`
  if (/总结|归纳|分析|为什么|主要发现|主要反馈|知识库/.test(text)) return scoped()
  if (/题目|问卷内容/.test(text)) return `查看${scope}的题目`
  if (/原文|提到|关键词|包含.*回答/.test(text)) {
    const quoted = [...text.matchAll(/[“"‘']([^”"’']{1,30})[”"’']/g)]
    const plain = /(?:提到|包含|关键词(?:为|是|[:：])?)\s*(.+)/.exec(text)
    let term = quoted.length ? quoted[quoted.length - 1][1] : plain?.[1] || ''
    term = term.replace(/[？?。！!]+$/, '').replace(/的(?:回答|原文|意见|建议|内容)$/, '').trim()
    if (term && term.length <= 30) return `查看${scope}中提到“${term}”的回答`
  }
  if (/(?:已审核|审核通过).*报告/.test(text)) return `查看${scope}的已审核报告`
  if (/均值|平均/.test(text)&&!/(哪个|最高|最低|为什么|原因|比较|对比|低评分|高评分|反馈)/.test(text)) return `查看${scope}的评分均值`
  if(!text||/(?:多少|几)份问卷|(?:全部|所有|列出|问卷列表|哪些|有哪些).*问卷/.test(text)||/^(?:查看|查询|查一下)?最新版本(?:的)?统计[？?。]?$/.test(text))return `查一下${scope}的回收统计`
  return scoped()
}
