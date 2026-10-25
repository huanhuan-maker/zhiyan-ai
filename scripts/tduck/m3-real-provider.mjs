import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),base=process.env.TD_M3_BASE||'http://127.0.0.1:8997'
if(!['http://127.0.0.1:8996','http://127.0.0.1:8997'].includes(base))throw Error('Unexpected backend')
let owner,key;const checks=[],out='evidence/tduck-full/m3';let sample
async function api(url,data,cap,headers={}){const r=await fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(owner?{token:owner}:{}),...(cap?{'X-Followup-Session':cap}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,url+': '+r.msg);return r.data}
try{
 owner=(await api('/login/account',{account:f.owner,password:f.password})).token
 const form=await api('/user/form/create',{name:'Synthetic M3 real provider '+Date.now(),type:0});key=typeof form==='string'?form:form.formKey
 const q='m3real'+Date.now(),label='你认为食堂哪里需要改善？'
 await api('/user/form/item/create',{formKey:key,formItemId:q,type:'TEXTAREA',label,required:true,showLabel:true,span:24,scheme:{typeId:'TEXTAREA',config:{formId:q,label,required:true,showLabel:true,span:24,regList:[]}}})
 await api('/user/form/followup/config',{formKey:key,enabled:true,goal:'了解大学生对食堂的使用体验与改善需求',totalBudget:1,perQuestionBudget:1,timeBudgetSeconds:600,mode:'LLM',allowedQuestionIds:[q]})
 const version=await api('/user/form/publish',{formKey:key}),info=await api('/form/followup/info?formKey='+key+'&versionToken='+version.shareToken)
 assert.equal(info.providerInfo.mode,'REAL');checks.push('configured real provider and model explicitly identified')
 const submission=randomUUID(),session=await api('/form/followup/session',{formKey:key,versionToken:version.shareToken,submissionKey:submission,consent:true})
 const started=Date.now(),d=await api('/form/followup/decide',{questionId:q,answer:'食堂不太方便'},session.capability)
 sample={provider:d.provider,model:d.model,action:d.action,reasonCode:d.reasonCode,state:d.state,elapsedMs:Date.now()-started,sourceAnswerId:d.sourceAnswerId,budgetRemaining:d.budgetRemaining,policyVersion:d.policyVersion,outcome:d.reasonCode==='MODEL_FAILURE'||d.reasonCode==='INVALID_MODEL_OUTPUT'?'DEGRADED':'VALIDATED_MODEL_DECISION'}
 assert.equal(d.model,info.providerInfo.model);assert.ok(d.sourceAnswerId>0);assert.ok(['CLARIFY','DEEPEN','EXPLORE','SKIP'].includes(d.action))
 if(d.state==='ASKED'){assert.equal((d.questionText.match(/？/g)||[]).length,1);assert.ok('食堂不太方便'.includes(d.evidenceQuote));await api('/form/followup/respond',{decisionId:d.id,skip:true},session.capability)}
 else assert.equal(d.action,'SKIP')
 checks.push('real model request produced a validated decision or explicitly recorded safe degradation')
 const data=await api('/user/form/data/public/create',{formKey:key,formType:0,originalData:{[q]:'食堂不太方便'},submitUa:{},versionToken:version.shareToken},session.capability,{'X-Submission-Key':submission})
 assert.equal(data.followupLinked,true);checks.push('ordinary core submission succeeds and links source after optional model decision')
 const records=await api(`/user/form/followup/records?formKey=${key}&versionNo=${version.versionNo}`);assert.ok(records.some(s=>s.answerDataId===data.id&&s.decisions[0]?.sourceAnswerId===d.sourceAnswerId));checks.push('real decision and source evidence remain queryable from owner audit')
 console.log(JSON.stringify({passed:checks.length,sample}))
}catch(e){checks.push({failure:e.message.slice(0,300)});process.exitCode=1;console.log('FAIL '+e.message.slice(0,160))}
finally{if(key)try{await api('/user/form/stop',{formKey:key})}catch{}fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/real-provider.json',JSON.stringify({date:new Date().toISOString(),backend:base,formKey:key,source:'Actual configured model request; synthetic survey and response',sample,checks,passed:checks.filter(x=>typeof x==='string').length,failed:checks.filter(x=>typeof x!=='string').length},null,2)+'\n')}
