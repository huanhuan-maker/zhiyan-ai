export async function readAssistantEvents(response,onEvent){
  if(!response.ok)throw new Error('连接失败，请重新登录或重试')
  if(!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('服务未返回流式响应，请重新登录或重试')
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',done=false
  try{for(;;){const part=await reader.read();buffer+=decoder.decode(part.value||new Uint8Array(),{stream:!part.done});buffer=buffer.replace(/\r\n/g,'\n');let boundary
    while((boundary=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const type=block.split('\n').find(x=>x.startsWith('event:'))?.slice(6).trim();const data=block.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');if(!type||!data)continue;const value=JSON.parse(data);if(type==='error')throw new Error(value.message);await onEvent(type,value);if(type==='done')done=true}
    if(part.done)break
  }if(!done)throw new Error('回复连接中断，可刷新历史恢复已保存的回答')}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
