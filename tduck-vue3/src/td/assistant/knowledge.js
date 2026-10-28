// Keep persistent backend reference IDs, but present short, local source labels in chat.
export function knowledgeMessage(result) {
  let text=String(result?.message||'')
  if(result?.kind!=='knowledge_answer')return text
  const refs=(result.citations||[]).map((source,index)=>({id:String(source.id),label:`来源${index+1}`})).sort((a,b)=>b.id.length-a.id.length)
  for(const ref of refs){const escaped=ref.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');text=text.replace(new RegExp(`(^|[^A-Za-z0-9_-])${escaped}(?=$|[^A-Za-z0-9_-])`,'g'),(_,prefix)=>prefix+ref.label)}
  return text
}
