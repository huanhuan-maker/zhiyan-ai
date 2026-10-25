// Real Spring Boot/MyBatis-Plus/MySQL. Synthetic survey/answers; RULE is not a model.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
const base=process.env.TD_M3_BASE||'http://127.0.0.1:8997'
if(!['http://127.0.0.1:8996','http://127.0.0.1:8997'].includes(base))throw Error('Only isolated test backends allowed')
const out='evidence/tduck-full/m3';fs.mkdirSync(out,{recursive:true})
const checks=[],forms=[];let owner,other,formKey,version,questionIds,policy
async function api(url,data,token,cap,headers={}){return fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{}),...(cap?{'X-Followup-Session':cap}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json())}
async function ok(url,data,token,cap,headers){const r=await api(url,data,token,cap,headers);assert.equal(r.code,200,url+': '+r.msg);return r.data}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,350)});console.log('FAIL '+name+': '+e.message.slice(0,180))}}
async function session(consent=true){const submissionKey=randomUUID();const s=await ok('/form/followup/session',{formKey,versionToken:version.shareToken,submissionKey,consent});return {...s,submissionKey}}
const decide=(s,n,answer)=>ok('/form/followup/decide',{questionId:questionIds[n],answer},null,s.capability)
const state=s=>ok('/form/followup/state',undefined,null,s.capability)
for(let i=0;i<40;i++){try{await fetch(base+'/public/systemInfoConfig');break}catch{await new Promise(r=>setTimeout(r,1000))}}
try{
 owner=(await ok('/login/account',{account:f.owner,password:f.password})).token
 other=(await ok('/login/account',{account:f.other,password:f.password})).token
 const form=await ok('/user/form/create',{name:'Synthetic M3 semantic followup '+Date.now(),type:0},owner);formKey=typeof form==='string'?form:form.formKey;forms.push(formKey)
 questionIds=Array.from({length:5},(_,i)=>'m3q'+Date.now()+i)
 for(let i=0;i<questionIds.length;i++){
  const id=questionIds[i],label=i===0?'你认为食堂哪里需要改善？':i===2?'你为什么使用或不使用图书馆？':'还有哪些具体使用体验需要说明？'+i
  await ok('/user/form/item/create',{formKey,formItemId:id,type:'TEXTAREA',label,required:i===0,showLabel:true,span:24,scheme:{typeId:'TEXTAREA',placeholder:'请输入体验',config:{formId:id,label,required:i===0,showLabel:true,span:24,regList:[]}}},owner)
 }
 policy={formKey,enabled:true,goal:'了解学生对食堂和校园公共设施的使用体验与改善需求',totalBudget:2,perQuestionBudget:1,timeBudgetSeconds:600,mode:'RULE',allowedQuestionIds:questionIds}
 await ok('/user/form/followup/config',policy,owner)
 version=await ok('/user/form/publish',{formKey},owner)
 await check('published followup policy is frozen and owner protected',async()=>{
  assert.notEqual((await api('/user/form/followup/config',{...policy,totalBudget:9},owner)).code,200)
  assert.notEqual((await api('/user/form/followup/config?formKey='+formKey,undefined,other)).code,200)
  const p=await ok('/form/followup/info?formKey='+formKey+'&versionToken='+version.shareToken)
  assert.equal(p.totalBudget,2);assert.equal(p.providerInfo.mode,'RULE');return {version:version.versionNo,totalBudget:p.totalBudget}
 })
 let vague,s1,social,s3
 await check('vague answer produces one neutral clarification with real source ID',async()=>{
  s1=await session();vague=await decide(s1,0,'食堂不太方便');assert.equal(vague.action,'CLARIFY');assert.equal(vague.state,'ASKED');assert.ok(vague.sourceAnswerId>0);assert.equal((vague.questionText.match(/？/g)||[]).length,1);assert.ok(!vague.questionText.includes('卫生'));return {sourceAnswerId:vague.sourceAnswerId,action:vague.action,reason:vague.reasonCode,budget:vague.budgetRemaining}
 })
 await check('specific context is skipped without length-only threshold',async()=>{
  const s=await session(),d=await decide(s,0,'六点二楼排队十五分钟，轮到我时菜卖完了');assert.equal(d.action,'SKIP');assert.equal(d.reasonCode,'CONCRETE_CONTEXT');assert.equal((await state(s)).used,0)
 })
 await check('new self-raised social cue can be explored with a literal quote',async()=>{
  s3=await session();const answer='我朋友都不去，所以我也没动力去';social=await decide(s3,2,answer);assert.equal(social.action,'EXPLORE');assert.ok(answer.includes(social.evidenceQuote));assert.ok(!social.questionText.includes('价格'));return {action:social.action,quoteVerified:true}
 })
 await check('skipped followup never reopens or overwrites original answer',async()=>{
  await ok('/form/followup/respond',{decisionId:vague.id,skip:true},null,s1.capability)
  const replay=await decide(s1,0,'修改后的内容不应覆盖第一次原文');assert.equal(replay.id,vague.id);assert.equal(replay.state,'DECLINED')
  const s=await state(s1);assert.equal(s.used,1);assert.equal(s.sources[0].answerText,'食堂不太方便')
 })
 await check('explicit refusal and privacy risk stop before any provider',async()=>{
  const s=await session(),d=await decide(s,0,'不想回答这个问题'),p=await decide(s,1,'身份证信息需要保密');assert.equal(d.reasonCode,'RESPONDENT_DECLINED');assert.equal(p.reasonCode,'PRIVACY_RISK');assert.equal(d.provider,'未调用模型');assert.equal((await state(s)).used,0)
 })
 await check('no AI consent means no provider call and normal core submission works',async()=>{
  const s=await session(false),d=await decide(s,0,'食堂不太方便');assert.equal(d.reasonCode,'NO_CONSENT');assert.equal(d.model,'none');assert.equal((await state(s)).used,0)
  const result=await ok('/user/form/data/public/create',{formKey,formType:0,originalData:Object.fromEntries(questionIds.map(id=>[id,'Synthetic consent-free answer'])),submitUa:{},versionToken:version.shareToken},null,s.capability,{'X-Submission-Key':s.submissionKey})
  assert.equal(result.followupLinked,true);assert.ok(result.id>0)
 })
 await check('global budget is enforced under concurrent different-question requests',async()=>{
  const s=await session(),decisions=await Promise.all([0,1,2,3].map(i=>decide(s,i,'使用体验不太方便')))
  assert.equal(decisions.filter(d=>d.state==='ASKED').length,2);let current=await state(s);assert.equal(current.used,2);assert.equal(current.budgetRemaining,0)
  await Promise.all([0,1,2,3].map(i=>decide(s,i,'使用体验不太方便')));current=await state(s);assert.equal(current.used,2);assert.equal(current.decisions.length,4);return {shown:2,usedAfterReplay:2}
 })
 await check('same-question concurrent retries only create one decision and one charge',async()=>{
  const s=await session(),all=await Promise.all(Array.from({length:6},()=>decide(s,0,'食堂不太方便')));assert.equal(new Set(all.map(d=>d.id)).size,1);const current=await state(s);assert.equal(current.used,1);assert.equal(current.sources.length,1)
 })
 await check('supplement is independently persisted and attached to the real submitted answer',async()=>{
  await ok('/form/followup/respond',{decisionId:social.id,answer:'Synthetic social cue supplement',skip:false},null,s3.capability)
  const result=await ok('/user/form/data/public/create',{formKey,formType:0,originalData:Object.fromEntries(questionIds.map(id=>[id,'Synthetic core answer'])),submitUa:{},versionToken:version.shareToken},null,s3.capability,{'X-Submission-Key':s3.submissionKey})
  assert.equal(result.followupLinked,true);const current=await state(s3);assert.equal(current.status,'SUBMITTED');assert.ok(current.sources.every(s=>s.answerDataId===result.id));assert.equal(current.decisions[0].responseText,'Synthetic social cue supplement');assert.equal(current.sources[0].answerText,'我朋友都不去，所以我也没动力去')
  return {answerId:result.id,sourceAnswerId:social.sourceAnswerId}
 })
 await check('invalid or foreign session and question IDs are rejected',async()=>{
  assert.notEqual((await api('/form/followup/state',undefined,null,'a'.repeat(64))).code,200)
  const s=await session();assert.notEqual((await api('/form/followup/respond',{decisionId:vague.id,skip:true},null,s.capability)).code,200)
  assert.notEqual((await api('/form/followup/decide',{questionId:'foreign-question',answer:'不方便'},null,s.capability)).code,200)
  assert.notEqual((await api('/user/form/followup/records?formKey='+formKey+'&versionNo='+version.versionNo,undefined,other)).code,200)
 })
 await check('consent revocation closes outstanding prompts without reopening on retry',async()=>{
  const s=await session(),d=await decide(s,0,'食堂不太方便');await ok('/form/followup/consent',{consent:false},null,s.capability);const replay=await decide(s,0,'食堂不太方便');assert.equal(replay.id,d.id);assert.equal(replay.state,'DECLINED');assert.equal((await state(s)).used,1)
 })
 await check('owner can trace source, state transitions, model policy and cost uncertainty',async()=>{
  const records=await ok('/user/form/followup/records?formKey='+formKey+'&versionNo='+version.versionNo,undefined,owner)
  assert.ok(records.length>=8);assert.ok(records.every(s=>!JSON.stringify(s).includes('tokenHash')))
  const record=records.find(s=>s.decisions.some(d=>d.id===social.id));assert.ok(record.events.some(e=>e.toState==='CORE_ANSWER_SAVED'));assert.ok(record.events.some(e=>e.toState==='EVALUATING'));assert.ok(record.events.some(e=>e.toState==='REPLIED'));assert.ok(record.events.some(e=>e.toState==='NEXT_QUESTION'));assert.equal(record.decisions[0].estimatedCostMicros,null)
 })
 await check('new published policy cannot alter old version snapshot or old answers',async()=>{
  await ok('/user/form/stop',{formKey},owner);await ok('/user/form/followup/config',{...policy,totalBudget:1},owner)
  const old=version;version=await ok('/user/form/publish',{formKey},owner)
  assert.equal((await ok('/form/followup/info?formKey='+formKey+'&versionToken='+version.shareToken)).totalBudget,1)
  assert.notEqual((await api('/form/followup/session',{formKey,versionToken:old.shareToken,submissionKey:randomUUID(),consent:true})).code,200)
  const history=await ok('/user/form/followup/records?formKey='+formKey+'&versionNo='+old.versionNo,undefined,owner);assert.ok(history.some(s=>s.used===2));return {oldVersion:old.versionNo,newVersion:version.versionNo}
 })
}catch(e){checks.push({name:'API test setup/completion',passed:false,error:e.message.slice(0,400)});console.log('FAIL setup '+e.message.slice(0,200))}
finally{
 for(const formKey of forms)try{await ok('/user/form/stop',{formKey},owner)}catch{}
 const report={date:new Date().toISOString(),backend:base,source:'Real MySQL and Spring Boot; synthetic input; deterministic RULE provider',formKey,checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length}
 fs.writeFileSync(out+'/api-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}))
}
if(checks.some(c=>!c.passed))process.exitCode=1
