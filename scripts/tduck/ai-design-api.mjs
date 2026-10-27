import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const base='http://127.0.0.1:8997',root='/user/form/ai',out='evidence/tduck-full/ai-design-assistant',checks=[]
fs.mkdirSync(out,{recursive:true});fs.mkdirSync('.local/ai-design',{recursive:true})
const f=JSON.parse(fs.readFileSync('.local/assistant-simple/acceptance.json','utf8').replace(/^\uFEFF/,''))
let owner,other,key
async function raw(url,data,token=owner?.token){return fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json())}
async function api(url,data,token){const r=await raw(url,data,token);assert.equal(r.code,200,r.msg);return r.data}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,700)});console.log('FAIL '+name+': '+e.message.slice(0,240))}}
const questions=[{type:'RADIO',label:'大家都认为AI非常有助于提高学习效率，你认同吗？',required:true,options:['非常认同','认同']},{type:'RADIO',label:'过去一个月你每周使用AI多少次？',required:true,options:['1-3次','3-5次','5次以上']},{type:'TEXTAREA',label:'你使用AI时有哪些顾虑？',required:false,placeholder:'请描述具体情况'},{type:'TEXTAREA',label:'你使用AI时有哪些顾虑？',required:false}]
const input={title:'AI使用调查（合成验收）',goal:'了解大学生的AI使用习惯与顾虑',audience:'在校大学生',questions}
try{
 owner=await api('/login/account',{account:f.owner,password:f.password},null);other=await api('/login/account',{account:f.other,password:f.password},null)
 const created=await api('/user/form/create',{name:input.title+' '+Date.now(),description:'仅包含合成测试题，无真实答卷',type:0,folderId:0});key=typeof created==='string'?created:created.formKey
 for(const q of questions){const id=q.type+'_'+randomUUID().replaceAll('-','');const config={formId:id,label:q.label,required:q.required,showLabel:true,span:24,regList:[],defaultValue:null,options:q.options?.map((label,i)=>({label,value:i+1})),optionsType:0};await api('/user/form/item/create',{formKey:key,formItemId:id,type:q.type,label:q.label,required:q.required,span:24,showLabel:true,hideType:false,displayType:false,scheme:{typeId:q.type,vModel:id,config,placeholder:q.placeholder||'',style:{},disabled:false},regList:[]})}
 await check('anonymous calls cannot optimize or review',async()=>{for(const endpoint of ['optimize-question','review-survey'])assert.notEqual((await raw(root+'/'+endpoint,endpoint==='optimize-question'?{...input,questionNo:1}:input,null)).code,200)})
 await check('foreign survey scope is denied for both features before model use',async()=>{assert.notEqual((await raw(root+'/optimize-question',{...input,formKey:key,questionNo:1},other.token)).code,200);assert.notEqual((await raw(root+'/review-survey',{...input,formKey:key},other.token)).code,200)})
 await check('out of range questions, privilege injection and over 100 questions are rejected',async()=>{for(const data of [{...input,questionNo:0},{...input,questionNo:5},{...input,questionNo:1,ownerId:99},{...input,questionNo:1,questions:Array(101).fill(questions[0])}])assert.notEqual((await raw(root+'/optimize-question',data)).code,200)})
 const before=await api('/user/form/item/list?key='+key)
 const real=await Promise.allSettled([
   api(root+'/optimize-question',{...input,formKey:key,questionNo:1,instruction:'消除诱导措辞，保留调查AI对学习效率影响的含义；提供平衡的选项'}),
   api(root+'/review-survey',{...input,formKey:key})
 ])
 let optimization,review
 await check('real provider returns a validated single-question candidate, without saving it',async()=>{assert.equal(real[0].status,'fulfilled');optimization=real[0].value;assert.equal(optimization.mode,'REAL',optimization.message);assert.ok(optimization.available&&optimization.after);assert.equal(optimization.after.type,questions[0].type);assert.equal(optimization.after.required,questions[0].required);assert.ok(optimization.model);assert.deepEqual(await api('/user/form/item/list?key='+key),before);fs.writeFileSync(out+'/real-optimization.json',JSON.stringify(optimization,null,2));return {provider:optimization.provider,model:optimization.model,questionNo:optimization.questionNo}})
 await check('real review validates every literal quote and locates deterministic design issues',async()=>{assert.equal(real[1].status,'fulfilled');review=real[1].value;assert.equal(review.mode,'REAL',review.warning);for(const category of ['LEADING','OPTION_OVERLAP','DUPLICATE'])assert.ok(review.issues.some(i=>i.category===category),category);for(const issue of review.issues){for(const e of issue.evidence){assert.ok(issue.questionNos.includes(e.questionNo));const q=questions[e.questionNo-1];assert.ok(e.field==='label'?q.label.includes(e.quote):q.options.some(o=>o.includes(e.quote)))}}assert.deepEqual(await api('/user/form/item/list?key='+key),before);fs.writeFileSync(out+'/real-review.json',JSON.stringify(review,null,2));return {provider:review.provider,model:review.model,issues:review.issues.length}})
 await check('published core questions reject optimization and snapshots remain unchanged',async()=>{await api('/user/form/publish',{formKey:key});const r=await raw(root+'/optimize-question',{...input,formKey:key,questionNo:1});assert.notEqual(r.code,200);assert.match(r.msg,/冻结|收集/);assert.deepEqual(await api('/user/form/item/list?key='+key),before);await api('/user/form/stop',{formKey:key})})
 fs.writeFileSync('.local/ai-design/run.json',JSON.stringify({key,input,optimization,review},null,2))
}finally{
 const result={date:new Date().toISOString(),source:'Authenticated real Spring Boot/MyBatis/MySQL endpoints; real configured model; synthetic questions only. Preview endpoints do not persist edits.',checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length}
 fs.writeFileSync(out+'/api.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,failed:result.failed}));if(result.failed)process.exitCode=1
}
