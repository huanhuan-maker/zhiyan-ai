import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const out='evidence/tduck-full/natural-reply',checks=[],turns=[],errors=[]
const c=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
let user
async function api(url,data){const r=await fetch('http://127.0.0.1:8997'+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{token:user.token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,r.msg);return r.data}
user=await api('/login/account',{account:c.adminEmail,password:c.adminPassword})
const conversation=await api('/user/form/assistant/conversations',{})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}})
page.setDefaultTimeout(25000)
await page.addInitScript(({u,id})=>{localStorage.setItem('token',u.token);localStorage.setItem('userInfo',JSON.stringify(u));localStorage.setItem('zhiyan-workbench-theme','dark');sessionStorage.setItem('assistant-conversation',id)},{u:user,id:conversation.id})
page.on('pageerror',e=>errors.push(e.message))
async function ask(question,kind){
 const count=await page.locator('.assistant-turn').count()
 await page.getByRole('textbox',{name:'给问卷助手发消息'}).fill(question)
 await page.getByRole('button',{name:'发送',exact:true}).click()
 await expect(page.locator('.assistant-turn')).toHaveCount(count+1)
 await expect(page.getByRole('button',{name:'发送',exact:true})).not.toHaveClass(/is-loading/,{timeout:240000})
 const history=await api('/user/form/assistant/conversations/'+conversation.id),turn=history.turns.at(-1)
 assert.equal(turn.result?.kind,kind,JSON.stringify(turn.result))
 assert.equal(turn.question,question)
 await expect(page.locator('.survey-results')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'查询这份',exact:true})).toHaveCount(0)
 turns.push(turn)
 return turn
}
try{
 await page.goto('http://127.0.0.1:5180/home/assistant')
 const count=await ask('我现在有多少份问卷','chat')
 assert.match(count.result.message,/\d+/)
 checks.push('catalogue count is a concise reply without questionnaire cards')
 const vague=await ask('帮我分析一下问卷','chat')
 assert.match(vague.result.message,/名称|主题/)
 checks.push('an ambiguous request asks one conversational clarification without dumping choices')
 const analysis=await ask('总结“大学生 AI Agent 使用与需求调查”的答卷，重点分析用户的需求，给我结论和建议，不用图表','knowledge_answer')
 assert.equal(analysis.result.formKey,'cYtMpVqA');assert.equal(analysis.result.answerCount,35);assert.equal(analysis.result.generationMode,'REAL',analysis.result.generationWarning)
 const prose=analysis.result.findings.map(f=>f.refs.reduce((text,ref)=>text.replaceAll(ref,''),f.text)).join('')
 assert.ok((prose.match(/[0-9]+(?:\.[0-9]+)?/g)||[]).length<=8,'analysis summarises findings instead of dumping many statistics')
 await expect(page.locator('.assistant-turn').last().locator('[data-testid="assistant-analysis"]')).toHaveCount(0)
 await expect(page.locator('.assistant-turn').last().locator('.el-table')).toHaveCount(0)
 checks.push('without manually choosing a survey, the real model analyses the named questionnaire from 35 responses')
 await page.locator('.assistant-turn').last().locator('.assistant-answer-text').evaluate(el=>el.scrollIntoView({block:'start'}))
 await page.screenshot({path:out+'/05-automatic-analysis.png',fullPage:true})
 const followup=await ask('那最值得优先改进什么？简短一些','knowledge_answer')
 assert.equal(followup.result.formKey,'cYtMpVqA');assert.equal(followup.result.generationMode,'REAL',followup.result.generationWarning)
 assert.ok(followup.result.providedStatisticCount>0&&followup.result.retrievedCount>0,'improvement follow-up must receive statistics and answer evidence, not only the total count')
 assert.ok(followup.result.findings.map(f=>f.text).join('').length<=300,'the request for a short answer is preserved')
 checks.push('follow-up continues analysing the automatically resolved survey')
 await page.reload()
 await expect(page.getByRole('button',{name:'查询这份',exact:true})).toHaveCount(0)
 await expect(page.locator('.assistant-turn').last().locator('.knowledge-answer-scope')).toBeVisible()
 checks.push('reload preserves natural analysis without reintroducing questionnaire selection')
 assert.deepEqual(errors,[])
}catch(e){checks.push({failed:e.message});await page.screenshot({path:out+'/auto-search-failure.png',fullPage:true});process.exitCode=1}
finally{await browser.close();fs.writeFileSync(out+'/auto-search.json',JSON.stringify({passed:checks.filter(x=>typeof x==='string').length,failed:checks.filter(x=>typeof x!=='string').length,checks,pageErrors:errors,conversationId:conversation.id,turns},null,2));console.log(JSON.stringify({checks,pageErrors:errors,turns:turns.map(t=>({question:t.question,kind:t.result.kind,model:t.result.model,message:t.result.message}))},null,2))}
