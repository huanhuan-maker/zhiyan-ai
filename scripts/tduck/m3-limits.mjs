// Real DB clock-boundary fixtures: update only sessions created by this script.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),manifest=JSON.parse(fs.readFileSync('.local/tduck-dev/manifest.json','utf8').replace(/^\uFEFF/,''))
assert.equal(manifest.database,'tduck_vue3_dev');const base='http://127.0.0.1:8997',out='evidence/tduck-full/m3',checks=[];let token,key,v
async function api(url,data,cap,headers={}){return fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{}),...(cap?{'X-Followup-Session':cap}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json())}
async function ok(url,data,cap,headers){const r=await api(url,data,cap,headers);assert.equal(r.code,200,url+': '+r.msg);return r.data}
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,250)});console.log('FAIL '+name)}}
function fixtureClock(id,assignment){assert.match(id,/^[a-f0-9-]{36}$/);assert.ok(['created_at=created_at-61000','expires_at=0'].includes(assignment));const c=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''));execFileSync('D:/MySQL/MySQL Server 8.0/bin/mysql.exe',['--host=127.0.0.1','--user=root','--default-character-set=utf8mb4','tduck_vue3_dev','--execute',`UPDATE fm_followup_session SET ${assignment} WHERE id='${id}'`],{env:{...process.env,MYSQL_PWD:c.mysqlRootPassword},stdio:'pipe'})}
async function publish(total,per){if(v)await ok('/user/form/stop',{formKey:key});await ok('/user/form/followup/config',{formKey:key,enabled:true,goal:'食堂体验',totalBudget:total,perQuestionBudget:per,timeBudgetSeconds:60,mode:'RULE',allowedQuestionIds:['m3limit0'+suffix]});v=await ok('/user/form/publish',{formKey:key})}
async function session(){const submissionKey=randomUUID();return {...await ok('/form/followup/session',{formKey:key,versionToken:v.shareToken,submissionKey,consent:true}),submissionKey}}
const suffix=Date.now(),decide=(s,i)=>ok('/form/followup/decide',{questionId:'m3limit'+i+suffix,answer:'食堂不太方便'},s.capability)
try{
 token=(await ok('/login/account',{account:f.owner,password:f.password})).token
 const form=await ok('/user/form/create',{name:'Synthetic M3 limits '+suffix,type:0});key=typeof form==='string'?form:form.formKey
 for(let i=0;i<2;i++){const id='m3limit'+i+suffix;await ok('/user/form/item/create',{formKey:key,formItemId:id,type:'TEXTAREA',label:'食堂体验'+i,required:i===0,span:24,showLabel:true,scheme:{typeId:'TEXTAREA',config:{formId:id,label:'食堂体验'+i,required:i===0,span:24,showLabel:true,regList:[]}}})}
 await publish(2,0)
 await check('zero per-question allowance stops before provider',async()=>{const s=await session(),d=await decide(s,0);assert.equal(d.reasonCode,'BUDGET_EXHAUSTED');assert.equal(d.provider,'未调用模型');assert.equal((await ok('/form/followup/state',undefined,s.capability)).used,0)})
 await check('an unapproved open question cannot trigger a provider',async()=>{const s=await session(),d=await decide(s,1);assert.equal(d.reasonCode,'QUESTION_NOT_ALLOWED');assert.equal(d.model,'none')})
 await publish(0,1)
 await check('zero global budget cannot generate a prompt',async()=>{const s=await session(),d=await decide(s,0);assert.equal(d.action,'SKIP');assert.equal(d.reasonCode,'BUDGET_EXHAUSTED');assert.equal(d.budgetRemaining,0)})
 await publish(2,1)
 await check('elapsed time budget is checked by server without charging',async()=>{const s=await session();fixtureClock(s.sessionId,'created_at=created_at-61000');const d=await decide(s,0);assert.equal(d.reasonCode,'TIME_BUDGET');assert.equal(d.provider,'未调用模型');assert.equal((await ok('/form/followup/state',undefined,s.capability)).used,0)})
 await check('expired AI capability cannot block ordinary core submission',async()=>{const s=await session();fixtureClock(s.sessionId,'expires_at=0');assert.notEqual((await api('/form/followup/state',undefined,s.capability)).code,200);const r=await ok('/user/form/data/public/create',{formKey:key,formType:0,originalData:{['m3limit0'+suffix]:'Synthetic core after AI expiry'},submitUa:{},versionToken:v.shareToken},s.capability,{'X-Submission-Key':s.submissionKey});assert.ok(r.id);assert.equal(r.followupLinked,false)})
}catch(e){checks.push({name:'Limit setup',passed:false,error:e.message.slice(0,250)})}
finally{if(key)try{await ok('/user/form/stop',{formKey:key})}catch{}fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/limits-results.json',JSON.stringify({date:new Date().toISOString(),source:'Real MySQL; clock fixtures scoped to synthetic session IDs; RULE provider',formKey:key,checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length},null,2)+'\n')}
if(checks.some(c=>!c.passed))process.exitCode=1
