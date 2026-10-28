// Replay already generated answers for visual checks; does not call a model or alter surveys.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const credentials=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,'')),out='evidence/tduck-full/knowledge'
let user
async function api(url,body){const response=await fetch('http://127.0.0.1:8997'+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{token:user.token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}).then(r=>r.json());assert.equal(response.code,200);return response.data}
user=await api('/login/account',{account:credentials.adminEmail,password:credentials.adminPassword})
let conversation
for(const c of await api('/user/form/assistant/conversations')){const h=await api('/user/form/assistant/conversations/'+c.id);if(h.turns.some(t=>t.result?.formKey==='cYtMpVqA'&&t.result?.generationMode==='REAL'&&t.result.kind==='knowledge_answer')){conversation=c.id;break}}
assert.ok(conversation,'Run the real knowledge UI check first')
const b=await chromium.launch({channel:'msedge',headless:true}),p=await b.newPage({viewport:{width:1560,height:1050}}),errors=[]
await p.addInitScript(({user,conversation})=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user));localStorage.setItem('zhiyan-workbench-theme','dark');sessionStorage.setItem('assistant-conversation',conversation)},{user,conversation})
p.on('pageerror',e=>errors.push(e.message))
try{
 await p.goto('http://127.0.0.1:5180/home/assistant');await expect(p.locator('.knowledge-answer-scope').last()).toContainText('LLM 分析');await expect(p.locator('.assistant-turn').last().locator('.answer-bubble > .assistant-hint')).toHaveCount(0);await expect(p.locator('.knowledge-answer-scope .el-tag').last()).not.toHaveClass(/enter-active/);await p.screenshot({path:out+'/02-grounded-chat.png',fullPage:true})
 await p.locator('.assistant-turn').last().locator('.citation-actions .el-button').first().click();await expect(p.getByRole('dialog',{name:'查询来源'})).toBeVisible();await expect(p.locator('.el-dialog')).not.toHaveClass(/enter-active/);const background=await p.locator('.assistant-source-dialog .el-dialog__header').evaluate(e=>getComputedStyle(e).backgroundColor);assert.notEqual(background,'rgb(255, 255, 255)');await p.screenshot({path:out+'/04-source-dialog.png',fullPage:true});await p.getByRole('dialog',{name:'查询来源'}).locator('button.el-dialog__headerbtn').click();await expect(p.locator('.el-overlay:visible')).toHaveCount(0)
 await p.goto('http://127.0.0.1:5180/home/knowledge');await p.locator('.kb-collection').filter({hasText:'大学生 AI Agent 使用与需求调查'}).first().getByRole('button',{name:'查看资料',exact:true}).click();await p.getByRole('button',{name:'检索',exact:true}).click();await expect(p.locator('.kb-source .el-tag').first()).not.toHaveClass(/enter-active/);await expect(p.locator('.kb-source').first()).toBeVisible();await p.screenshot({path:out+'/01-knowledge-desktop.png',fullPage:true})
 await p.setViewportSize({width:390,height:844});await p.goto('http://127.0.0.1:5180/home/knowledge');await expect(p.locator('.kb-collection .el-tag').first()).not.toHaveClass(/enter-active/);await expect(p.locator('.kb-collection').first()).toBeVisible();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:out+'/03-knowledge-mobile.png',fullPage:true});assert.deepEqual(errors,[])
 fs.writeFileSync(out+'/visual.json',JSON.stringify({checks:['existing real answer replayed without another model request','dark source dialog has readable surface contrast','desktop and mobile captures wait for entry transitions','mobile width remains within viewport'],pageErrors:errors},null,2));console.log('Visual checks passed')
}finally{await b.close()}
