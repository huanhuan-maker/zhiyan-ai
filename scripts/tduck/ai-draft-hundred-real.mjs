import fs from 'node:fs'
import assert from 'node:assert/strict'
const privatePath='.local/ai-draft-workspace/real-100.json',out='evidence/tduck-full/ai-draft-workspace'
fs.mkdirSync('.local/ai-draft-workspace',{recursive:true});fs.mkdirSync(out,{recursive:true})
if(fs.existsSync(privatePath)&&!process.argv.includes('--regenerate')){const data=JSON.parse(fs.readFileSync(privatePath,'utf8'));assert.equal(data.mode,'REAL');assert.equal(data.questions.length,100);console.log('Existing actual-model capture validated: REAL / '+data.model+' / 100 questions. Use --regenerate for another paid provider call.');process.exit(0)}
const f=JSON.parse(fs.readFileSync('.local/assistant-simple/acceptance.json','utf8').replace(/^\uFEFF/,'')),base='http://127.0.0.1:8997'
const login=await fetch(base+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:f.owner,password:f.password})}).then(r=>r.json());assert.equal(login.code,200)
const started=Date.now();console.log('Requesting 100 concise actual-model questions through authenticated generation endpoint.')
const response=await fetch(base+'/user/form/ai/draft',{method:'POST',headers:{token:login.data.token,'Content-Type':'application/json'},body:JSON.stringify({goal:'合成验收：调查大学生在学习、编程、写作、信息核对、隐私保护等方面使用AI的情况',audience:'合成验收场景中的大学生',questionCount:100,extra:'生成99道RATE评分题与最后1道TEXT开放建议题，评分上限5。每道题干尽量简短、不超过16字，题干各不相同，按不同细分维度展开。只输出需要的字段，控制篇幅。'})}).then(r=>r.json())
const result={date:new Date().toISOString(),source:'Actual configured provider, authenticated generation endpoint; no fabricated question response',elapsedMs:Date.now()-started,code:response.code,message:response.msg,mode:response.data?.mode,provider:response.data?.provider,model:response.data?.model,questionCount:response.data?.questions?.length}
fs.writeFileSync(out+'/real-100.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));assert.equal(response.code,200,response.msg);assert.equal(response.data.mode,'REAL');assert.equal(response.data.questions.length,100);fs.writeFileSync(privatePath,JSON.stringify(response.data))
