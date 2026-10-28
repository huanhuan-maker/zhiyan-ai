import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const before=process.argv.includes('--baseline'),out='evidence/tduck-full/named-overview',checks=[],turns=[],errors=[]
fs.mkdirSync(out,{recursive:true})
const c=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
let user
async function api(url,data){const r=await fetch('http://127.0.0.1:8997'+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{token:user.token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,r.msg);return r.data}
user=await api('/login/account',{account:c.adminEmail,password:c.adminPassword})
const conversation=await api('/user/form/assistant/conversations',{})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}})
page.setDefaultTimeout(25000)
await page.addInitScript(({u,id})=>{localStorage.setItem('token',u.token);localStorage.setItem('userInfo',JSON.stringify(u));localStorage.setItem('zhiyan-workbench-theme','dark');sessionStorage.setItem('assistant-conversation',id)},{u:user,id:conversation.id})
page.on('pageerror',e=>errors.push(e.message))
async function ask(question,key){
 const count=await page.locator('.assistant-turn').count()
 await page.getByRole('textbox',{name:'给问卷助手发消息'}).fill(question)
 await page.getByRole('button',{name:'发送',exact:true}).click()
 await expect(page.locator('.assistant-turn')).toHaveCount(count+1)
 await expect(page.getByRole('button',{name:'发送',exact:true})).not.toHaveClass(/is-loading/,{timeout:300000})
 const history=await api('/user/form/assistant/conversations/'+conversation.id),turn=history.turns.at(-1);turns.push(turn)
 assert.equal(turn.result?.kind,'knowledge_answer',JSON.stringify(turn.result))
 assert.equal(turn.result.formKey,key)
 assert.equal(turn.result.version,key==='Kd12jgkg'?1:2)
 assert.equal(turn.result.generationMode,'REAL',turn.result.generationWarning)
 assert.equal(turn.result.answerCount,35)
 assert.ok(turn.result.providedStatisticCount>0&&turn.result.retrievedCount>0)
 await expect(page.getByRole('button',{name:'查询这份',exact:true})).toHaveCount(0)
 await expect(page.locator('.assistant-turn').last().locator('[data-testid="assistant-analysis"], .el-table')).toHaveCount(0)
 return turn
}
try{
 await page.goto('http://127.0.0.1:5180/home/assistant')
 await expect(page.getByRole('textbox',{name:'给问卷助手发消息'})).toBeVisible()
 await ask('看一下大学生社团参与意愿调查的情况','Kd12jgkg')
 checks.push('exact unquoted screenshot request automatically retrieves club-survey evidence and generates real analysis')
 await page.locator('.assistant-turn').last().locator('.assistant-answer-text').evaluate(el=>el.scrollIntoView({block:'start'}))
 await page.screenshot({path:out+'/01-exact-question.png',fullPage:true})
 await ask('这份问卷反映了哪些问题？简短一点','Kd12jgkg')
 checks.push('follow-up retains the automatically resolved club survey')
 await ask('看一下大学生 AI Agent 使用与需求调查 V2 的情况','cYtMpVqA')
 checks.push('an explicitly named different survey overrides the previous survey context')
 await ask('看一下大学生社团参与意愿调查的情况','Kd12jgkg')
 checks.push('the same exact sentence switches back to the club survey without selection cards')
 await page.reload()
 await expect(page.locator('.context-chip')).toContainText('大学生社团参与意愿调查')
 await expect(page.locator('.assistant-turn').last().locator('.knowledge-answer-scope')).toBeVisible()
 await expect(page.getByRole('button',{name:'查询这份',exact:true})).toHaveCount(0)
 checks.push('reload preserves the corrected target and grounded answer')
 assert.deepEqual(errors,[])
}catch(e){checks.push({failed:e.message});await page.screenshot({path:out+(before?'/before.png':'/failure.png'),fullPage:true});process.exitCode=1}
finally{await browser.close();const report={passed:checks.filter(x=>typeof x==='string').length,failed:checks.filter(x=>typeof x!=='string').length,checks,pageErrors:errors,conversationId:conversation.id,turns};fs.writeFileSync(out+(before?'/before.json':'/results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,turns:turns.map(t=>({question:t.question,kind:t.result?.kind,model:t.result?.model,message:t.result?.message}))},null,2))}
