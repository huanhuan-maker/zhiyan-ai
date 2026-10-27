import fs from 'node:fs'
import assert from 'node:assert/strict'
const base='http://127.0.0.1:8997',root='/user/form/ai/draft',out='evidence/tduck-full/ai-generation-progress',checks=[]
fs.mkdirSync(out,{recursive:true})
const f=JSON.parse(fs.readFileSync('.local/assistant-simple/acceptance.json','utf8').replace(/^\uFEFF/,''))
async function raw(url,data,token){return fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json())}
async function api(url,data,token){const r=await raw(url,data,token);assert.equal(r.code,200,r.msg);return r.data}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,700)});console.log('FAIL '+name+': '+e.message.slice(0,180))}}
const owner=(await api('/login/account',{account:f.owner,password:f.password})).token,other=(await api('/login/account',{account:f.other,password:f.password})).token
const input={goal:'合成验收：了解大学生 AI 学习工具的使用频率、用途与顾虑',audience:'在校大学生',questionCount:3,extra:'题干简明中立，包含开放题'}
try{
 await check('anonymous callers cannot start or read generation progress',async()=>{assert.notEqual((await raw(root+'/progress',{})).code,200);assert.notEqual((await raw(root+'/progress/not-owned')).code,200)})
 const started=await api(root+'/progress',{},owner)
 await check('progress is owner scoped and contains no questionnaire inputs',async()=>{assert.notEqual((await raw(root+'/progress/'+started.id,undefined,other)).code,200);assert.notEqual((await raw(root+'?progressId='+started.id,input,other)).code,200);const progress=await api(root+'/progress/'+started.id,undefined,owner);assert.equal(progress.phase,'REGISTERED');assert.ok(!JSON.stringify(progress).includes(input.goal))})
 let done=false;const observed=[]
 const request=raw(root+'?progressId='+started.id,input,owner).finally(()=>{done=true})
 while(!done){observed.push((await api(root+'/progress/'+started.id,undefined,owner)).phase);if(!done)await new Promise(resolve=>setTimeout(resolve,700))}
 const result=await request,finished=await api(root+'/progress/'+started.id,undefined,owner)
 await check('real model generation records actual input, model, validation and success events',async()=>{assert.equal(result.code,200,result.msg);assert.equal(result.data.mode,'REAL');assert.equal(result.data.questions.length,3);assert.deepEqual(finished.events.map(x=>x.phase),['REGISTERED','RECEIVED','INPUT_VALIDATED','MODEL_RUNNING','VALIDATING','SUCCEEDED']);assert.equal(finished.terminal,true);assert.ok(observed.includes('MODEL_RUNNING'));for(let n=1;n<finished.events.length;n++)assert.ok(finished.events[n].elapsedMs>=finished.events[n-1].elapsedMs);fs.writeFileSync(out+'/real-progress.json',JSON.stringify({observed,finished,provider:result.data.provider,model:result.data.model,questionCount:result.data.questions.length,dimensions:result.data.dimensions},null,2)+'\n');return {provider:result.data.provider,model:result.data.model,observed}})
 await check('a submitted request ID cannot trigger another model call',async()=>{const replay=await raw(root+'?progressId='+started.id,input,owner);assert.notEqual(replay.code,200);assert.match(replay.msg,/重复/);assert.equal((await api(root+'/progress/'+started.id,undefined,owner)).phase,'SUCCEEDED')})
 await check('invalid input finishes as failed without pretending to reach the model',async()=>{const run=await api(root+'/progress',{},owner);const r=await raw(root+'?progressId='+run.id,{...input,goal:''},owner);assert.notEqual(r.code,200);const p=await api(root+'/progress/'+run.id,undefined,owner);assert.deepEqual(p.events.map(x=>x.phase),['REGISTERED','RECEIVED','FAILED']);assert.equal(p.terminal,true)})
}finally{const report={date:new Date().toISOString(),source:'Actual authenticated backend and configured real AI. Only synthetic questionnaire requirements; no questionnaire persisted.',checks,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length};fs.writeFileSync(out+'/api.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1}
