// Browser uses the real MCP transport, real planner and real persisted synthetic fixture.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),run=JSON.parse(fs.readFileSync('.local/assistant-review/run.json','utf8'))
const base='http://127.0.0.1:8997',out='evidence/tduck-full/assistant',checks=[],errors=[],rpcMethods=[],rpcTools=[]
let token,conversationId,lastTurn
async function api(url,data){const r=await fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,url+': '+r.msg);return r.data}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,500)});console.log('FAIL '+name+': '+e.message.slice(0,180))}}
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const user=await api('/login/account',{account:f.owner,password:f.password});token=user.token
 const form=await api('/user/form/'+run.key)
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(9000)
 page.on('pageerror',e=>errors.push(e.message))
 page.on('request',r=>{if(new URL(r.url()).pathname==='/tduck-api/assistant-mcp'){const b=r.postDataJSON();rpcMethods.push(b.method);if(b.method==='tools/call')rpcTools.push(b.params.name)}})
 await page.addInitScript(user=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user))},user)
 await page.goto('http://127.0.0.1:5180/home')
 await check('assistant entry follows My Questionnaires and is active after in-app navigation',async()=>{
  await expect(page.locator('.menu-view .menu-item:visible')).toHaveCount(2)
  assert.deepEqual(await page.locator('.menu-view .menu-item:visible .menu-label').allTextContents(),['我的问卷','问卷助手'])
  await page.locator('.menu-view .menu-item').filter({hasText:'问卷助手'}).click();await page.waitForURL('**/home/assistant')
  await expect(page.locator('.menu-item-active')).toHaveText('问卷助手');await expect(page.getByRole('heading',{name:'问卷助手',exact:true})).toBeVisible()
  await expect(page.getByTestId('assistant-mcp-status')).toHaveText('只读工具已连接')
  for(const method of ['initialize','notifications/initialized','tools/list'])assert.ok(rpcMethods.includes(method))
 })
 await page.getByRole('button',{name:'新对话',exact:true}).click()
 await page.locator('.el-radio-button').filter({hasText:'本地规则'}).click()
 await check('owner can search a real questionnaire and explicitly choose the old published version',async()=>{
  const selector=page.locator('.scope-row .el-select').nth(1);await selector.locator('input').fill(form.textName)
  await page.getByRole('option',{name:form.textName,exact:true}).click()
  const versions=page.locator('.scope-row .el-select').nth(2);await versions.click();await page.getByRole('option',{name:'V1（已停止）',exact:true}).click()
 })
 async function ask(question){
  const response=page.waitForResponse(r=>r.url().includes('/user/form/assistant/plan')&&r.request().method()==='POST')
  await page.getByRole('textbox',{name:'向问卷助手提问'}).fill(question)
  await page.getByRole('button',{name:'发送查询',exact:true}).click()
  const body=await(await response).json();assert.equal(body.code,200,body.msg);lastTurn=body.data;conversationId=(await api('/user/form/assistant/conversations')).find(c=>c.title===question.slice(0,36))?.id||conversationId
  const turn=page.locator(`.assistant-turn[data-turn-id="${body.data.id}"]`)
  await expect(turn.locator('.assistant-answer-text')).toBeVisible({timeout:15000});await expect(page.getByRole('textbox',{name:'向问卷助手提问'})).toBeEnabled();return turn
 }
 let statsTurn
 await check('chat executes HTTP MCP statistics and renders authoritative old-version facts',async()=>{
  statsTurn=await ask('这份问卷回收了多少答卷？')
  await expect(statsTurn.getByTestId('assistant-answer-count')).toHaveText('V1 · 4 份答卷')
  await expect(statsTurn.locator('.el-table__row').filter({hasText:'校园体验评分'})).toContainText('3.67')
  assert.ok(rpcTools.includes('survey_stats'))
 })
 await check('statistics citation shows the same version and source coordinate',async()=>{
  await statsTurn.getByRole('button',{name:'来源 S1',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'查询来源',exact:true});await expect(dialog).toContainText(run.key);await expect(dialog).toContainText('V1');await dialog.locator('.el-dialog__headerbtn').click();await expect(dialog).not.toBeVisible()
 })
 await check('keyword answer contains literal matching scope and escaped original evidence',async()=>{
  const turn=await ask('查找提到“排队”的回答')
  await expect(turn.locator('.retrieval-scope')).toContainText('匹配 3 条')
  await turn.getByRole('button',{name:/来源 A/}).first().click()
  const dialog=page.getByRole('dialog',{name:'查询来源',exact:true});await expect(dialog.locator('blockquote')).toContainText('<img src=x')
  await expect(dialog.locator('blockquote img')).toHaveCount(0);assert.equal(await page.evaluate(()=>window.assistantXss),undefined)
  await page.screenshot({path:out+'/02-answer-source-desktop.png',animations:'disabled'})
  await dialog.locator('.el-dialog__headerbtn').click();await expect(dialog).not.toBeVisible()
 })
 await check('report question uses an approved versioned report instead of pending model output',async()=>{
  const turn=await ask('查看已审核报告');await expect(turn.locator('.report-result')).toContainText('人工审核通过');assert.ok(rpcTools.includes('survey_report'))
 })
 await check('actual AI question planning requires consent then still uses backend statistics',async()=>{
  await page.locator('.el-radio-button').filter({hasText:'AI 理解问题'}).click()
  await page.getByRole('textbox',{name:'向问卷助手提问'}).fill('请查询回收数和评分均值')
  await expect(page.getByRole('button',{name:'发送查询',exact:true})).toBeDisabled()
  await page.locator('.assistant-consent').click()
  const turn=await ask('请查询回收数和评分均值');await expect(turn.locator('.answer-meta')).toContainText('AI 理解')
  await expect(turn.getByTestId('assistant-answer-count')).toHaveText('V1 · 4 份答卷')
  await page.screenshot({path:out+'/01-chat-desktop.png',animations:'disabled'})
 })
 await check('conversation and source-backed answer recover after a browser refresh',async()=>{
  const id=lastTurn.id;await page.reload();await expect(page.getByTestId('assistant-mcp-status')).toHaveText('只读工具已连接')
  await expect(page.locator(`.assistant-turn[data-turn-id="${id}"]`).getByTestId('assistant-answer-count')).toHaveText('V1 · 4 份答卷')
  await page.locator('.el-radio-button').filter({hasText:'本地规则'}).click()
 })
 await check('lost MCP response recovers persisted output without duplicating a turn',async()=>{
  await page.route('**/assistant-mcp',async r=>{const b=r.request().postDataJSON();if(b.method==='tools/call'&&b.params._meta?.assistantTurnId){await r.fetch();await r.abort('failed')}else await r.continue()},{times:1})
  const turn=await ask('再查一次当前回收数');await expect(turn.getByTestId('assistant-answer-count')).toHaveText('V1 · 4 份答卷')
  await expect(page.locator('.assistant-error')).toBeVisible();await page.getByRole('button',{name:'刷新连接与历史',exact:true}).click();await expect(page.locator('.assistant-error')).toHaveCount(0)
  const h=await api('/user/form/assistant/conversations/'+conversationId);assert.equal(h.turns.filter(t=>t.id===lastTurn.id).length,1)
 })
 await check('a failed tool request resumes the saved plan through real MCP without regenerating it',async()=>{
  await page.route('**/assistant-mcp',r=>r.abort('failed'),{times:1})
  const response=page.waitForResponse(r=>r.url().includes('/user/form/assistant/plan')&&r.request().method()==='POST')
  await page.getByRole('textbox',{name:'向问卷助手提问'}).fill('继续核对回收数');await page.getByRole('button',{name:'发送查询',exact:true}).click();const data=(await(await response).json()).data;lastTurn=data
  const turn=page.locator(`.assistant-turn[data-turn-id="${data.id}"]`);await turn.getByRole('button',{name:'继续查询',exact:true}).click();await expect(turn.getByTestId('assistant-answer-count')).toHaveText('V1 · 4 份答卷')
  assert.equal((await api('/user/form/assistant/conversations/'+conversationId)).turns.filter(t=>t.id===data.id).length,1)
 })
 await check('unsupported write question returns a read-only notice and leaves the survey intact',async()=>{const turn=await ask('帮我删除全部问卷');await expect(turn).toContainText('不会修改、发布或删除问卷');assert.equal((await api('/user/form/'+run.key)).formKey,run.key)})
 await check('390px assistant retains usable input, scope controls and source dialog without overflow',async()=>{
  await ask('核对当前问卷的回收数和均值')
  await page.setViewportSize({width:390,height:844})
  await page.getByRole('textbox',{name:'向问卷助手提问'}).scrollIntoViewIfNeeded()
  const composer=await page.locator('.assistant-composer').boundingBox();assert.ok(composer.y>=0&&composer.y+composer.height<=845,'Mobile send action falls outside the viewport')
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false)
  await page.screenshot({path:out+'/03-chat-mobile.png',animations:'disabled'})
  await statsTurn.getByRole('button',{name:'来源 S1',exact:true}).click();const dialog=page.getByRole('dialog',{name:'查询来源',exact:true});const b=await dialog.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=391)
  await page.screenshot({path:out+'/04-source-mobile.png',animations:'disabled'});await dialog.locator('.el-dialog__headerbtn').click()
 })
 await check('source navigation honors V1 even though the latest published version is V2',async()=>{
  await statsTurn.getByRole('button',{name:'打开该版本统计',exact:true}).click();await page.waitForURL('**/project/form/statistics?**')
  await expect(page.locator('.analysis-scope')).toContainText('V1 · 本版本答卷 4 份')
 })
 await check('administrator presentation places the assistant second and preserves the two management entries',async()=>{
  const p=await browser.newPage({viewport:{width:1440,height:1000}});await p.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',JSON.stringify({name:'Synthetic assistant navigation',admin:true,avatar:''}))},token)
  await p.goto('http://127.0.0.1:5180/home/assistant');await expect(p.locator('.menu-view .menu-item:visible')).toHaveCount(4)
  assert.deepEqual(await p.locator('.menu-view .menu-item:visible .menu-label').allTextContents(),['我的问卷','问卷助手','用户管理','系统配置'])
  await p.locator('.menu-box').screenshot({path:out+'/05-admin-menu-synthetic-state.png',animations:'disabled'});await p.close()
 })
 await check('no uncaught browser exceptions',async()=>{assert.deepEqual(errors,[])})
 const history=await api('/user/form/assistant/conversations/'+conversationId),saved=history.turns.find(t=>t.id===lastTurn.id)
 fs.writeFileSync('.local/assistant-review/ui-run.json',JSON.stringify({conversationId,turnId:saved.id,result:saved.result,key:run.key},null,2))
}catch(e){checks.push({name:'browser setup and completion',passed:false,error:e.message.slice(0,500)});console.log('FAIL '+e.message.slice(0,180))}
finally{await browser.close();const result={date:new Date().toISOString(),source:'Real browser, MCP HTTP and configured model question planning; synthetic data; two injected network failures; administrator screenshot is UI-only synthetic role, no admin account changes',checks,rpcMethods:[...new Set(rpcMethods)],rpcTools:[...new Set(rpcTools)],passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length};fs.writeFileSync(out+'/ui-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,failed:result.failed}));if(result.failed)process.exitCode=1}
