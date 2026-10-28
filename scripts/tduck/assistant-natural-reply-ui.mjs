import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const out='evidence/tduck-full/natural-reply',checks=[],answers=[],errors=[]
fs.mkdirSync(out,{recursive:true})
const credentials=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
let user
async function api(url,data){const r=await fetch('http://127.0.0.1:8997'+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{token:user.token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,url+': '+r.msg);return r.data}
user=await api('/login/account',{account:credentials.adminEmail,password:credentials.adminPassword})
const conversation=await api('/user/form/assistant/conversations',{})
const browser=await chromium.launch({channel:'msedge',headless:true})
const page=await browser.newPage({viewport:{width:1440,height:1000}})
page.setDefaultTimeout(25000)
await page.addInitScript(({u,id})=>{localStorage.setItem('token',u.token);localStorage.setItem('userInfo',JSON.stringify(u));localStorage.setItem('zhiyan-workbench-theme','dark');sessionStorage.setItem('assistant-conversation',id)},{u:user,id:conversation.id})
page.on('pageerror',e=>errors.push(e.message))
async function ask(question,kind){
 const count=await page.locator('.assistant-turn').count()
 await page.getByRole('textbox',{name:'给问卷助手发消息'}).fill(question)
 await page.getByRole('button',{name:'发送',exact:true}).click()
 await expect(page.locator('.assistant-turn')).toHaveCount(count+1)
 const turn=page.locator('.assistant-turn').last()
 if(kind==='knowledge_answer')await expect(turn.locator('.knowledge-answer-scope')).toBeVisible({timeout:180000})
 else await expect(turn.locator('[data-testid="assistant-analysis"]')).toBeVisible({timeout:180000})
 const id=await turn.getAttribute('data-turn-id')
 const history=await api('/user/form/assistant/conversations/'+conversation.id)
 const saved=(Array.isArray(history)?history:history.turns).find(t=>t.id===id)
 assert.ok(saved,'saved turn exists')
 assert.equal(saved.result.kind,kind)
 assert.equal(saved.result.answerCount,35)
 if(kind==='knowledge_answer'){
  assert.equal(saved.result.generationMode,'REAL',saved.result.generationWarning)
  await expect(turn.locator('[data-testid="assistant-analysis"]')).toHaveCount(0)
  assert.equal(await turn.locator('.knowledge-answer-scope').getAttribute('open'),null)
 }
 answers.push({question,result:saved.result,plan:saved.plan})
 return turn
}
try{
 await page.goto('http://127.0.0.1:5180/home/assistant?formKey=cYtMpVqA&version=2&title='+encodeURIComponent('大学生 AI Agent 使用与需求调查'))
 await expect(page.locator('.context-chip')).toContainText('大学生 AI Agent')
 let turn=await ask('查一下这份问卷的回收统计','knowledge_answer')
 assert.match(answers.at(-1).result.message,/35/)
 assert.ok(answers.at(-1).result.message.length<600,'simple count answer stays concise')
 checks.push('exact reported recovery query uses the real LLM, reports 35, and does not expand a dashboard')
 await page.screenshot({path:out+'/01-recovery-answer.png',fullPage:true})
 turn=await ask('哪个用途选择的人最多？请只回答这个问题。','knowledge_answer')
 assert.notEqual(answers.at(-1).result.message,answers[0].result.message)
 checks.push('a different focused question receives a different grounded answer without a chart')
 turn=await ask('那为什么呢？','knowledge_answer')
 checks.push('a contextual why follow-up retrieves evidence and receives a real model answer')
 await page.screenshot({path:out+'/02-focused-followup.png',fullPage:true})
 turn=await ask('给这份问卷画一张柱状图','statistics')
 checks.push('explicit chart request still displays real statistical charts for 35 responses')
 await turn.locator('[data-testid="assistant-analysis"]').evaluate(el=>el.scrollIntoView({block:'start'}))
 await page.screenshot({path:out+'/03-explicit-chart.png',fullPage:true})
 turn=await ask('不用图表，只告诉我本版有多少答卷','knowledge_answer')
 assert.match(answers.at(-1).result.message,/35/)
 checks.push('negated chart request returns text and leaves historical chart intact')
 await turn.locator('.citation-actions .el-button').first().click()
 await expect(page.getByRole('dialog',{name:'查询来源'})).toBeVisible()
 await expect(page.getByRole('dialog',{name:'查询来源'})).toContainText('cYtMpVqA')
 await page.getByRole('dialog',{name:'查询来源'}).locator('button.el-dialog__headerbtn').click()
 await expect(page.locator('.el-overlay:visible')).toHaveCount(0)
 checks.push('natural answers retain clickable version-bound sources')
 await page.reload()
 await expect(page.locator('.assistant-turn').last().locator('.knowledge-answer-scope')).toContainText('35 份答卷')
 await expect(page.locator('.assistant-turn').last().locator('[data-testid="assistant-analysis"]')).toHaveCount(0)
 checks.push('natural answers and collapsed provenance survive reload')
 await page.setViewportSize({width:390,height:844})
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await expect(page.getByRole('button',{name:'发送',exact:true})).toBeVisible()
 await page.locator('.assistant-turn').last().locator('.knowledge-answer-scope').evaluate(el=>el.scrollIntoView({block:'end'}))
 await page.screenshot({path:out+'/04-mobile.png',fullPage:true})
 checks.push('390px chat has no horizontal overflow and keeps send visible')
 assert.deepEqual(errors,[])
}catch(e){checks.push({failed:e.message});await page.screenshot({path:out+'/failure.png',fullPage:true});process.exitCode=1}
finally{await browser.close();const report={passed:checks.filter(x=>typeof x==='string').length,failed:checks.filter(x=>typeof x!=='string').length,checks,pageErrors:errors,conversationId:conversation.id,answers};fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,answers:answers.map(a=>({question:a.question,kind:a.result.kind,mode:a.result.generationMode,model:a.result.model,message:a.result.message}))},null,2))}
