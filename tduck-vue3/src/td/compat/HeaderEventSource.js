// Native streaming fetch keeps authentication out of URLs and browser history.
export default class HeaderEventSource {
  constructor(url,options={}){this.controller=new AbortController();this.closed=false;queueMicrotask(()=>this.start(url,options))}
  async start(url,options){
    try{
      const response=await fetch(url,{headers:{Accept:'text/event-stream',...options.headers},signal:this.controller.signal})
      if(!response.ok||!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('AI 服务当前不可用，请检查服务端配置')
      this.onopen?.({type:'open'})
      const reader=response.body.getReader(),decoder=new TextDecoder();let pending=''
      while(!this.closed){const {done,value}=await reader.read();pending+=decoder.decode(value||new Uint8Array(),{stream:!done});pending=pending.replace(/\r\n/g,'\n');let end;while((end=pending.indexOf('\n\n'))>=0){const chunk=pending.slice(0,end);pending=pending.slice(end+2);const data=chunk.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(data)this.onmessage?.({data})}if(done)break}
      this.oncomplete?.()
    }catch(error){if(!this.closed&&error.name!=='AbortError')this.onerror?.(error)}
  }
  close(){this.closed=true;this.controller.abort()}
}
