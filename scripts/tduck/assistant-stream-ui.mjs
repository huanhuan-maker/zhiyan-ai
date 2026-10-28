import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const out='evidence/tduck-full/assistant-stream';fs.mkdirSync(out,{recursive:true})
const c=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,'')),checks=[],errors=[]
const login=await fetch('http://127.0.0.1:8997/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:c.adminEmail,password:c.adminPassword})}).then(r=>r.json());assert.equal(login.code,200);const user=login.data
const conversation=await fetch('http://127.0.0.1:8997/user/form/assistant/conversations',{method:'POST',headers:{'Content-Type':'application/json',token:user.token},body:'{}'}).then(r=>r.json())
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}})
await page.addInitScript(({u,id})=>{localStorage.setItem('token',u.token);localStorage.setItem('userInfo',JSON.stringify(u));localStorage.setItem('zhiyan-workbench-theme','dark');sessionStorage.setItem('assistant-conversation',id)},{u:user,id:conversation.data.id})
page.on('pageerror',e=>errors.push(e.message));let start,headersAt,wire,finishedAt
page.on('response',async r=>{if(r.url().endsWith('/chat/stream')){headersAt=Date.now()-start;wire=await r.text();finishedAt=Date.now()-start}})
try{
 await page.goto('http://127.0.0.1:5180/home/assistant')
 await page.getByRole('textbox',{name:'给问卷助手发消息'}).fill('看一下大学生社团参与意愿调查的情况')
 start=Date.now();await page.getByRole('button',{name:'发送',exact:true}).click()
 await expect(page.locator('.assistant-hint').last()).toContainText(/正在理解|正在定位|正在检索/,{timeout:20000});checks.push('progress status is visible while actual model work is pending')
 await page.screenshot({path:out+'/01-progress.png',fullPage:true})
 await expect(page.getByRole('button',{name:'发送',exact:true})).not.toHaveClass(/is-loading/,{timeout:300000})
 await expect(page.locator('.knowledge-answer-scope').last()).toContainText('35 份答卷');await expect(page.locator('.assistant-answer-text').last()).not.toBeEmpty();checks.push('validated real survey answer renders through SSE')
 await expect.poll(()=>wire,{timeout:10000}).toBeTruthy()
 const events=[...wire.matchAll(/event: ([^\n]+)\ndata: ([^\n]+)\n\n/g)].map(m=>({type:m[1],data:JSON.parse(m[2])}))
 assert.equal(events[0].type,'status');assert.equal(events.at(-1).type,'done');assert.ok(events.filter(e=>e.type==='delta').length>1);assert.ok(headersAt<finishedAt);checks.push('network delivers status before completion and multiple answer delta frames')
 const history=await fetch('http://127.0.0.1:8997/user/form/assistant/conversations/'+conversation.data.id,{headers:{token:user.token}}).then(r=>r.json()),turn=history.data.turns.at(-1)
 assert.equal(turn.result.generationMode,'REAL',turn.result.generationWarning);assert.equal(turn.result.formKey,'Kd12jgkg');assert.equal(events.filter(e=>e.type==='delta').map(e=>e.data.text).join(''),turn.result.message);checks.push('streamed text equals persisted grounded answer without duplication')
 await page.screenshot({path:out+'/02-answer.png',fullPage:true});await page.reload();await expect(page.locator('.knowledge-answer-scope').last()).toContainText('35 份答卷');checks.push('refresh restores completed answer and sources')
 assert.deepEqual(errors,[])
 fs.writeFileSync(out+'/wire.json',JSON.stringify({headersAtMs:headersAt,completedAtMs:finishedAt,events},null,2))
}catch(e){checks.push({failed:e.message});await page.screenshot({path:out+'/failure.png',fullPage:true});process.exitCode=1}
finally{await browser.close();fs.writeFileSync(out+'/results.json',JSON.stringify({passed:checks.filter(x=>typeof x==='string').length,failed:checks.filter(x=>typeof x!=='string').length,checks,pageErrors:errors},null,2));console.log(JSON.stringify({checks,errors},null,2))}
