import {it,expect} from 'vitest'
import {readAssistantEvents} from '../../src/td/assistant/stream'
function response(text){const bytes=new TextEncoder().encode(text);return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3));c.close()}}),{headers:{'Content-Type':'text/event-stream'}})}
it('handles UTF8 and SSE frames across arbitrary network boundaries',async()=>{const events=[];await readAssistantEvents(response('event: status\ndata: {"message":"检索中"}\n\nevent: delta\ndata: {"text":"你好🌟"}\n\nevent: done\ndata: {}\n\n'),(type,data)=>events.push([type,data]));expect(events.map(x=>x[0])).toEqual(['status','delta','done']);expect(events[1][1].text).toBe('你好🌟')})
it('does not treat a truncated answer as completed',async()=>{await expect(readAssistantEvents(response('event: delta\ndata: {"text":"部分"}\n\n'),()=>{})).rejects.toThrow('中断')})
it('surfaces server failure and invalid authentication responses',async()=>{await expect(readAssistantEvents(response('event: error\ndata: {"message":"没有权限"}\n\n'),()=>{})).rejects.toThrow('没有权限');await expect(readAssistantEvents(new Response('{}'),()=>{})).rejects.toThrow('流式响应')})
