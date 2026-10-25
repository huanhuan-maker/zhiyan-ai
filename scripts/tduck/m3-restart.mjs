import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),privateFile='.local/tduck-full-audit/m3-restart.json'
let token
async function api(url,data,cap,headers={}){const r=await fetch('http://127.0.0.1:8997'+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{}),...(cap?{'X-Followup-Session':cap}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,url+': '+r.msg);return r.data}
token=(await api('/login/account',{account:f.owner,password:f.password})).token
if(process.argv[2]==='prepare'){
 const form=await api('/user/form/create',{name:'Synthetic M3 restart persistence '+Date.now(),type:0}),key=typeof form==='string'?form:form.formKey
 const questions=[0,1].map(i=>'m3restart'+Date.now()+i)
 for(const id of questions)await api('/user/form/item/create',{formKey:key,formItemId:id,type:'TEXTAREA',label:'食堂哪里需要改善？',required:true,span:24,showLabel:true,scheme:{typeId:'TEXTAREA',config:{formId:id,label:'食堂哪里需要改善？',required:true,span:24,showLabel:true,regList:[]}}})
 await api('/user/form/followup/config',{formKey:key,enabled:true,goal:'食堂体验',totalBudget:2,perQuestionBudget:1,timeBudgetSeconds:600,mode:'RULE',allowedQuestionIds:questions})
 const version=await api('/user/form/publish',{formKey:key}),submissionKey=randomUUID(),s=await api('/form/followup/session',{formKey:key,versionToken:version.shareToken,submissionKey,consent:true})
 const d=await api('/form/followup/decide',{questionId:questions[0],answer:'食堂不太方便'},s.capability);await api('/form/followup/respond',{decisionId:d.id,skip:true},s.capability)
 fs.writeFileSync(privateFile,JSON.stringify({key,questions,version,submissionKey,capability:s.capability,decisionId:d.id,sourceAnswerId:d.sourceAnswerId}))
 console.log('Synthetic M3 restart fixture prepared. Capability kept only in ignored local file.')
}else if(process.argv[2]==='verify'){
 const s=JSON.parse(fs.readFileSync(privateFile,'utf8')),checks=[]
 try{
  const state=await api('/form/followup/state',undefined,s.capability);assert.equal(state.used,1);assert.equal(state.budgetRemaining,1);assert.equal(state.decisions[0].id,s.decisionId);assert.equal(state.decisions[0].state,'DECLINED');checks.push('budget and skipped decision survive actual backend restart')
  assert.equal(state.sources[0].id,s.sourceAnswerId);assert.equal(state.sources[0].answerText,'食堂不太方便');checks.push('original source ID and text survive restart')
  const replay=await api('/form/followup/decide',{questionId:s.questions[0],answer:'食堂不太方便'},s.capability);assert.equal(replay.id,s.decisionId);assert.equal(replay.state,'DECLINED');checks.push('replayed old question does not reopen or recharge after restart')
  const second=await api('/form/followup/decide',{questionId:s.questions[1],answer:'食堂不太方便'},s.capability);assert.equal(second.state,'ASKED');assert.equal(second.budgetRemaining,0);await api('/form/followup/respond',{decisionId:second.id,answer:'Synthetic post-restart response',skip:false},s.capability);checks.push('remaining one prompt can be used and independently answered after restart')
  const result=await api('/user/form/data/public/create',{formKey:s.key,formType:0,originalData:Object.fromEntries(s.questions.map(q=>[q,'食堂不太方便'])),submitUa:{},versionToken:s.version.shareToken},s.capability,{'X-Submission-Key':s.submissionKey});assert.equal(result.followupLinked,true)
  const records=await api(`/user/form/followup/records?formKey=${s.key}&versionNo=${s.version.versionNo}`);assert.ok(records.some(r=>r.answerDataId===result.id&&r.used===2));checks.push('core answer persists and associates both pre/post restart sources')
 }catch(e){checks.push({failure:e.message.slice(0,300)});process.exitCode=1}
 finally{await api('/user/form/stop',{formKey:s.key});fs.writeFileSync('evidence/tduck-full/m3/restart-results.json',JSON.stringify({date:new Date().toISOString(),source:'Actual stop/start of isolated 8997 backend; real MySQL; no exported capabilities',formKey:s.key,checks,passed:checks.filter(x=>typeof x==='string').length,failed:checks.filter(x=>typeof x!=='string').length},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(x=>typeof x==='string').length,failed:checks.filter(x=>typeof x!=='string').length}))}
}else throw Error('Use prepare or verify')
