import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),out='evidence/tduck-full/followup-retired'
fs.mkdirSync(out,{recursive:true});let token,key;const checks=[]
async function api(url,data,headers={}){return fetch('http://127.0.0.1:8997'+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json())}
async function ok(url,data,headers){const r=await api(url,data,headers);assert.equal(r.code,200,url+': '+r.msg);return r.data}
const b=await chromium.launch({channel:'msedge',headless:true})
try{
 const info=await ok('/form/followup/info?formKey=NqqlwySZ');assert.equal(info.enabled,false);checks.push('backend reports feature disabled even for previously enabled surveys')
 for(const endpoint of ['session','consent','decide','respond']){
  const r=await api('/form/followup/'+endpoint,{formKey:'synthetic',questionId:'synthetic',answer:'Synthetic retired check',decisionId:1,consent:true},{'X-Followup-Session':'a'.repeat(64)})
  assert.notEqual(r.code,200);assert.ok(r.msg.includes('停用'))
 }
 checks.push('all followup mutation endpoints reject before reaching provider/session processing')
 const legacy=JSON.parse(fs.readFileSync('.local/tduck-full-audit/m3-demo-real.json','utf8')),p=await b.newPage();let followupRequests=0
 p.on('request',r=>{if(r.url().includes('/form/followup/'))followupRequests++})
 await p.goto(legacy.publicUrl);await expect(p.locator('.native-form > .el-form-item')).toHaveCount(6)
 assert.equal(await p.locator('.followup-consent,.followup-panel').count(),0);assert.equal(followupRequests,0)
 await p.screenshot({path:out+'/01-fixed-questions-only.png',animations:'disabled'});checks.push('old questionnaire still renders six original questions with zero followup UI or requests')
 token=(await ok('/login/account',{account:f.owner,password:f.password})).token
 const form=await ok('/user/form/create',{name:'Synthetic fixed survey after followup retirement '+Date.now(),type:0});key=form.formKey||form
 const id='retired'+Date.now();await ok('/user/form/item/create',{formKey:key,formItemId:id,type:'TEXTAREA',label:'Synthetic fixed question',required:true,showLabel:true,span:24,scheme:{typeId:'TEXTAREA',config:{formId:id,label:'Synthetic fixed question',required:true,showLabel:true,span:24,regList:[]}}})
 const v=await ok('/user/form/publish',{formKey:key});await p.goto(`http://localhost:5180/s/${key}?t=${v.shareToken}`)
 await p.locator('[data-question-type="TEXTAREA"] textarea').fill('Synthetic normal fixed answer')
 await p.getByRole('button',{name:'提交',exact:true}).click();await p.getByText('提交成功',{exact:true}).waitFor()
 const rows=await ok('/user/form/data/query',{formKey:key,versionNo:v.versionNo,current:0,size:10,filter:{}});assert.equal(rows.total,1);assert.equal(followupRequests,0)
 checks.push('new fixed questionnaire publishes and persists a normal anonymous submission without any followup request')
 const owner=await b.newPage();await owner.addInitScript(t=>{if(location.origin==='http://localhost:5180')localStorage.setItem('token',t)},token)
 await owner.goto('http://localhost:5180/project/form/followup?key='+key);await owner.waitForURL('**/project/form/editor?**');await expect(owner.locator('.question-card')).toHaveCount(1)
 assert.equal(await owner.locator('.menu-title').filter({hasText:'AI追问'}).count(),0);await expect(owner.locator('.form-editor-sidebar')).not.toContainText('AI追问')
 checks.push('followup settings URL redirects to editor and its menu entry is removed')
 const ai=await ok('/user/form/ai/status');assert.ok(ai.mode==='REAL'||ai.mode==='MOCK');checks.push('AI draft service remains available')
}catch(e){checks.push({failure:e.message.slice(0,350)});process.exitCode=1}
finally{if(key)try{await ok('/user/form/stop',{formKey:key})}catch{}await b.close();const r={date:new Date().toISOString(),source:'Real 5180/8997 and MySQL; synthetic ordinary submission; no followup/model evaluation performed',checks,passed:checks.filter(x=>typeof x==='string').length,failed:checks.filter(x=>typeof x!=='string').length};fs.writeFileSync(out+'/results.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r))}
