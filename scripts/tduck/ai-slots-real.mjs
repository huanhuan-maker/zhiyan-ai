import fs from 'node:fs'
import assert from 'node:assert/strict'
const out='evidence/tduck-full/ai-slots',base='http://127.0.0.1:8997'
fs.mkdirSync(out,{recursive:true})
const f=JSON.parse(fs.readFileSync('.local/assistant-simple/acceptance.json','utf8').replace(/^\uFEFF/,''))
const user=await fetch(base+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:f.owner,password:f.password})}).then(r=>r.json());assert.equal(user.code,200)
const started=Date.now(),r=await fetch(base+'/user/form/ai/draft',{method:'POST',headers:{'Content-Type':'application/json',token:user.data.token},body:JSON.stringify({goal:'合成验收：了解在校大学生使用 AI 辅助学习的频率和用途',audience:'在校大学生',questionCount:3,extra:'请设计简短且中性的题目'})}).then(x=>x.json())
const report={date:new Date().toISOString(),source:'Actual configured AI provider and authenticated generation endpoint; synthetic input; no questionnaire saved.',code:r.code,mode:r.data?.mode,provider:r.data?.provider,model:r.data?.model,kind:r.data?.kind,questionCount:r.data?.questions?.length,elapsedMs:Date.now()-started}
fs.writeFileSync(out+'/real-generation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));assert.equal(r.code,200,r.msg);assert.equal(r.data.mode,'REAL');assert.equal(r.data.kind,'draft');assert.equal(r.data.questions.length,3)
