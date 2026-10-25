// User-reported regression: optional follow-up must be discoverable and explain a rule skip.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),out='evidence/tduck-full/m3-visibility'
fs.mkdirSync(out,{recursive:true});let token,key;const checks=[]
async function api(url,data){const r=await fetch('http://127.0.0.1:8997'+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{} )},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,url+': '+r.msg);return r.data}
const b=await chromium.launch({channel:'msedge',headless:true})
try{
 token=(await api('/login/account',{account:f.owner,password:f.password})).token
 const form=await api('/user/form/create',{name:'Synthetic followup discoverability '+Date.now(),type:0});key=form.formKey||form
 const id='visibility'+Date.now(),label='你认为食堂哪里需要改善？'
 await api('/user/form/item/create',{formKey:key,formItemId:id,type:'TEXTAREA',label,required:true,showLabel:true,span:24,scheme:{typeId:'TEXTAREA',config:{formId:id,label,required:true,showLabel:true,span:24,regList:[]}}})
 await api('/user/form/followup/config',{formKey:key,enabled:true,goal:'食堂体验',totalBudget:2,perQuestionBudget:1,timeBudgetSeconds:600,mode:'RULE',allowedQuestionIds:[id]})
 const v=await api('/user/form/publish',{formKey:key}),p=await b.newPage();let decisions=0
 p.on('request',r=>{if(r.url().includes('/followup/decide'))decisions++})
 await p.goto(`http://localhost:5180/s/${key}?t=${v.shareToken}`)
 await expect(p.locator('.followup-consent')).toContainText('查看可选追问',{timeout:2000})
 await expect(p.getByRole('button',{name:'查看可选追问',exact:true})).toBeVisible()
 await expect(p.getByRole('button',{name:'查看可选追问',exact:true})).toBeDisabled()
 assert.equal(decisions,0);checks.push('guide and visible disabled entry explain opt-in without sending an answer')
 await expect(p.getByRole('checkbox',{name:'我同意参与可选追问'})).toBeEnabled();await p.locator('.followup-consent .el-checkbox').click()
 await p.locator('[data-question-type="TEXTAREA"] textarea').fill('还行')
 const response=p.waitForResponse(r=>r.url().includes('/followup/decide'));await p.getByRole('button',{name:'查看可选追问',exact:true}).click()
 const d=(await(await response).json()).data;assert.equal(d.reasonCode,'NO_CLEAR_INFORMATION_GAP')
 await expect(p.locator('.followup-panel')).toContainText('规则模式未识别到补充方向');assert.equal(await p.locator('.followup-question').count(),0)
 checks.push('rule skip is explicitly explained instead of a misleading generic no-followup message')
 await expect(p.locator('.followup-consent')).toContainText('剩余 2 次');checks.push('skipped evaluation leaves the actual backend budget untouched')
 await p.screenshot({path:out+'/01-skip-explained.png',animations:'disabled'})
 await p.reload();await expect(p.locator('.followup-panel')).toContainText('规则模式未识别到补充方向');assert.equal(decisions,1);checks.push('refresh preserves the explanation without repeating the decision')
 const p2=await b.newPage();await p2.goto(`http://localhost:5180/s/${key}?t=${v.shareToken}`);await expect(p2.getByRole('checkbox',{name:'我同意参与可选追问'})).toBeEnabled()
 await p2.locator('.followup-consent .el-checkbox').click();await p2.locator('[data-question-type="TEXTAREA"] textarea').fill('食堂不太方便')
 await p2.getByRole('button',{name:'查看可选追问',exact:true}).click();await expect(p2.locator('.followup-question')).toContainText('具体指什么');checks.push('recognized gap still displays an answerable question after the clearer entry')
 await p2.screenshot({path:out+'/02-followup-visible.png',animations:'disabled'})
}catch(e){checks.push({failure:e.message.slice(0,350)});process.exitCode=1}
finally{if(key)try{await api('/user/form/stop',{formKey:key})}catch{}await b.close();const report={date:new Date().toISOString(),source:'Synthetic answers; real localhost UI, Spring Boot and MySQL; RULE explicitly non-model',checks,passed:checks.filter(x=>typeof x==='string').length,failed:checks.filter(x=>typeof x!=='string').length};fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))}
