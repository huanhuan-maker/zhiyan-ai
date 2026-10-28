import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const c=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,'')),out='evidence/tduck-full/knowledge',checks=[],errors=[]
const root='http://127.0.0.1:8997',front='http://127.0.0.1:5180'
let user
async function api(url,data){const r=await fetch(root+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{token:user.token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,url+': '+r.msg);return r.data}
user=await api('/login/account',{account:c.adminEmail,password:c.adminPassword})
fs.mkdirSync(out,{recursive:true})
for(const key of ['yh5ry2od','Kd12jgkg','cYtMpVqA','dUJev0eA']){const r=await api('/user/form/knowledge/sync',{formKey:key});assert.equal(r.answerCount,35)}
checks.push('four questionnaires visible in the user account are indexed with 35 responses each')
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1560,height:1050}})
page.setDefaultTimeout(20000)
await page.addInitScript(u=>{localStorage.setItem('token',u.token);localStorage.setItem('userInfo',JSON.stringify(u));localStorage.setItem('zhiyan-workbench-theme','dark')},user)
const demo=await api('/user/form/assistant/conversations',{});await page.addInitScript(id=>sessionStorage.setItem('assistant-conversation',id),demo.id)
page.on('pageerror',e=>errors.push(e.message))
try{
 await page.goto(front+'/home/knowledge');await expect(page.locator('.kb-collection').first()).toBeVisible();await expect(page.locator('.menu-view')).toContainText('问卷知识库');checks.push('knowledge page and sidebar render real owner-scoped collections')
 const card=page.locator('.kb-collection').filter({hasText:'大学生 AI Agent 使用与需求调查'}).first();await expect(card).toContainText('35 份答卷');await card.getByRole('button',{name:'查看资料',exact:true}).click();await page.getByRole('textbox',{name:'知识库检索问题'}).fill('总结主要反馈，并说明有哪些证据支持');await page.getByRole('button',{name:'检索',exact:true}).click();await expect(page.locator('.kb-source').first()).toBeVisible();await expect(page.locator('.kb-scope')).toContainText('35 份答卷');checks.push('retrieval preview renders persisted sources with answer and field identifiers')
 await expect(page.locator('.kb-source .el-tag').first()).not.toHaveClass(/enter-active/);await page.screenshot({path:out+'/01-knowledge-desktop.png',fullPage:true})
 await page.getByRole('button',{name:'带着这个问题去问助手 →',exact:true}).click();await page.waitForURL('**/home/assistant?**');await expect(page.getByRole('textbox',{name:'给问卷助手发消息'})).toHaveValue('总结主要反馈，并说明有哪些证据支持');await expect(page.locator('.context-chip')).toContainText('大学生 AI Agent 使用与需求调查');checks.push('knowledge-to-chat navigation preserves the selected survey, version and question')
 await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.locator('.assistant-turn').last().locator('.knowledge-answer-scope')).toBeVisible({timeout:150000});await expect(page.locator('.assistant-turn').last().locator('.knowledge-answer-scope')).toContainText('LLM 分析',{timeout:1000});await expect(page.locator('.assistant-turn').last().locator('.knowledge-answer-scope')).toContainText('35 份答卷');await expect(page.locator('.assistant-turn').last().locator('.answer-bubble > .assistant-hint')).toHaveCount(0);checks.push('real model answers the user question after retrieval rather than listing questionnaire fields')
 await page.locator('.assistant-turn').last().locator('.citation-actions .el-button').first().click();await expect(page.getByRole('dialog',{name:'查询来源'})).toBeVisible();await expect(page.getByRole('dialog',{name:'查询来源'})).toContainText('cYtMpVqA');checks.push('answer citations open actual version-bound evidence');await page.getByRole('dialog',{name:'查询来源'}).locator('button.el-dialog__headerbtn').click();await expect(page.locator('.el-overlay:visible')).toHaveCount(0);await page.screenshot({path:out+'/02-grounded-chat.png',fullPage:true})
 await page.reload();await expect(page.locator('.assistant-turn').last().locator('.knowledge-answer-scope')).toContainText('35 份答卷');checks.push('generated knowledge answer survives a full page reload')
 await page.setViewportSize({width:390,height:844});await page.goto(front+'/home/knowledge');await expect(page.locator('.kb-collection').first()).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await expect(page.locator('.kb-collection .el-tag').first()).not.toHaveClass(/enter-active/);await page.screenshot({path:out+'/03-knowledge-mobile.png',fullPage:true});checks.push('390px knowledge page has no horizontal overflow')
 assert.deepEqual(errors,[])
}catch(e){console.log('FAIL '+e.message);await page.screenshot({path:out+'/ui-failure.png',fullPage:true});process.exitCode=1;checks.push({failed:e.message})}finally{await browser.close();const report={checks,pageErrors:errors};fs.writeFileSync(out+'/ui.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))}
