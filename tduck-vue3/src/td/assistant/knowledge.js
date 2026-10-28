// Keep persistent backend reference IDs, but present short, local source labels in chat.
export function positiveChartQuestion(question='') {
  return String(question).replace(/(?:不要|不用|无需|不需要|别|不必)(?:给我|再|任何|生成|展示|显示|画|绘制|输出|提供|使用|用|出|一张|一个|数据|统计|的|\s)*(?:数据图|统计图|可视化|图表|柱状图|条形图|饼图|环形图|折线图|趋势图|图)/g,'')
}
export function wantsInlineChart(question='') {return /数据图|统计图|可视化|图表|出图|画.*图|生成.*图|柱状图|条形图|饼图|环形图|折线图|趋势图/.test(positiveChartQuestion(question))}
export function knowledgeMessage(result) {
  let text=String(result?.message||'')
  if(result?.kind!=='knowledge_answer')return text
  const refs=(result.citations||[]).map((source,index)=>({id:String(source.id),label:`来源${index+1}`})).sort((a,b)=>b.id.length-a.id.length)
  for(const ref of refs){const escaped=ref.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');text=text.replace(new RegExp(`(^|[^A-Za-z0-9_-])${escaped}(?=$|[^A-Za-z0-9_-])`,'g'),(_,prefix)=>prefix+ref.label)}
  return text
}
