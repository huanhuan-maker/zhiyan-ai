// Real browser UI; optional TD_M3_BASE forwards browser API calls to an isolated staging backend.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),base=process.env.TD_M3_BASE||'http://127.0.0.1:8997',front='http://127.0.0.1:5180'
if(!['http://127.0.0.1:8996','http://127.0.0.1:8997'].includes(base))throw Error('Unexpected backend')
const out='evidence/tduck-full/m3';fs.mkdirSync(out,{recursive:true});let token,formKey,version;const checks=[],errors=[]
async function api(url,data,cap){const r=await fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{}),...(cap?{'X-Followup-Session':cap}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,url+': '+r.msg);return r.data}
const browser=await chromium.launch({channel:'msedge',headless:true})
async function context(owner=false,viewport={width:1440,height:1000}){
 const c=await browser.newContext({viewport});if(owner)await c.addInitScript(t=>{if(location.origin==='http://127.0.0.1:5180')localStorage.setItem('token',t)},token)
 if(base.endsWith('8996'))await c.route('**/tduck-api/**',async r=>{const u=new URL(r.request().url());u.pathname=u.pathname.replace(/^\/tduck-api/,'');const response=await r.fetch({url:base+u.pathname+u.search});await r.fulfill({response})})
 c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return c
}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,400)});console.log('FAIL '+name+': '+e.message.slice(0,160))}}
const qids=Array.from({length:3},(_,i)=>'m3ui'+Date.now()+i)
const panel=(p,i)=>p.locator('[data-followup-for="'+qids[i]+'"]')
const core=(p,i)=>p.locator('[data-question-type="TEXTAREA"]').nth(i).locator('textarea').first()
async function publicPage(c){const p=await c.newPage();await p.goto(front+`/s/${formKey}?t=${version.shareToken}`);await expect(p.locator('.followup-consent')).toBeVisible();await expect(p.getByRole('checkbox',{name:'我同意参与可选追问'})).toBeEnabled();return p}
try{
 token=(await api('/login/account',{account:f.owner,password:f.password})).token
 const f0=await api('/user/form/create',{name:'Synthetic M3 browser survey '+Date.now(),type:0});formKey=typeof f0==='string'?f0:f0.formKey
 for(let i=0;i<3;i++){const id=qids[i],label=['你认为食堂哪里需要改善？','请描述一次具体的食堂经历','你为什么使用或不使用图书馆？'][i];await api('/user/form/item/create',{formKey,formItemId:id,type:'TEXTAREA',label,required:i===0,showLabel:true,span:24,scheme:{typeId:'TEXTAREA',config:{formId:id,label,required:i===0,showLabel:true,span:24,regList:[]}}})}
 await api('/user/form/setting/save',{formKey,saveNotSubmitStatus:true})
 await check('owner configures allowed questions and budgets through Vue UI then publishes',async()=>{
  const c=await context(true),p=await c.newPage();try{
   await p.goto(front+'/project/form/followup?key='+formKey)
   await p.locator('.policy-form .el-switch').click();await p.getByPlaceholder('说明本问卷希望了解什么，作为相关性判断依据').fill('了解学生对食堂和图书馆的使用体验')
   await p.locator('.budget-fields').getByRole('spinbutton').first().fill('2')
   for(const box of await p.locator('.policy-form .el-checkbox').all())await box.click()
   await p.getByRole('button',{name:'保存追问设置',exact:true}).click();await p.getByText('追问设置已保存；发布后对新版本生效',{exact:true}).waitFor()
   await p.reload();await expect(p.locator('.policy-form .el-switch')).toHaveClass(/is-checked/);await expect(p.locator('.budget-fields').getByRole('spinbutton').first()).toHaveValue('2')
   assert.equal((await api('/user/form/followup/config?formKey='+formKey)).allowedQuestionIds.length,3)
   await p.screenshot({path:out+'/01-policy-settings.png',animations:'disabled'})
   await p.goto(front+'/project/form/publish?key='+formKey);await p.locator('.publish-action-btn').click();await p.getByText('发布成功，开始收集数据吧！',{exact:true}).waitFor()
   version=(await api('/user/form/versions?key='+formKey))[0]
  }finally{await c.close()}
 })
 if(!version)throw Error('No published version')
 await check('without AI consent no decision request is sent and ordinary submission succeeds',async()=>{
  const c=await context();let count=0;c.on('request',r=>{if(r.url().includes('/followup/decide'))count++})
  try{const p=await publicPage(c);await expect(p.getByRole('checkbox',{name:'我同意参与可选追问'})).not.toBeChecked();await core(p,0).fill('Synthetic core-only answer');await p.getByRole('button',{name:'提交',exact:true}).click();await p.getByText('提交成功',{exact:true}).waitFor();assert.equal(count,0)}finally{await c.close()}
 })
 await check('neutral followup can be skipped, survives reload, and a self-raised cue can be answered separately',async()=>{
  const c=await context(false,{width:390,height:844});try{
   const p=await publicPage(c);await p.locator('.followup-consent .el-checkbox').click()
   await core(p,0).fill('食堂不太方便');await panel(p,0).getByRole('button',{name:'继续此题（可选追问）'}).click()
   await expect(panel(p,0).locator('.followup-question')).toContainText('具体指什么');await expect(panel(p,0)).not.toContainText('卫生')
   await expect(p.locator('.followup-consent')).toContainText('剩余 1 次')
   await p.screenshot({path:out+'/02-mobile-neutral-question.png',animations:'disabled'})
   await panel(p,0).getByRole('button',{name:'跳过追问',exact:true}).click();await expect(panel(p,0)).toContainText('已跳过')
   await p.reload();await expect(panel(p,0)).toContainText('已跳过');await expect(p.locator('.followup-consent')).toContainText('剩余 1 次');await expect(core(p,0)).toHaveValue('食堂不太方便')
   await core(p,1).fill('六点二楼排队十五分钟，轮到我时菜卖完了');await panel(p,1).getByRole('button',{name:'继续此题（可选追问）'}).click();await expect(panel(p,1)).toContainText('本题不再追问')
   await core(p,2).fill('我朋友都不去，所以我也没动力去');await panel(p,2).getByRole('button',{name:'继续此题（可选追问）'}).click();await expect(panel(p,2).locator('.followup-question')).toContainText('朋友')
   await panel(p,2).getByPlaceholder('补充回答，可跳过').fill('Synthetic independent supplement')
   await panel(p,2).getByRole('button',{name:'保存补充回答',exact:true}).click();await expect(panel(p,2)).toContainText('补充回答已保存');await expect(core(p,2)).toHaveValue('我朋友都不去，所以我也没动力去')
   await expect(p.locator('.followup-consent')).toContainText('剩余 0 次')
   await p.getByRole('button',{name:'提交',exact:true}).click();await p.getByText('提交成功',{exact:true}).waitFor()
   const records=await api(`/user/form/followup/records?formKey=${formKey}&versionNo=${version.versionNo}`),s=records.find(s=>s.decisions.some(d=>d.responseText==='Synthetic independent supplement'))
   assert.equal(s.used,2);assert.ok(s.answerDataId);assert.equal(s.decisions.length,3);assert.ok(s.sources.some(a=>a.answerText==='食堂不太方便'));return {used:2,decisions:3,linked:true}
  }finally{await c.close()}
 })
 await check('browser AI network failure does not block ordinary submission',async()=>{
  const c=await context();try{
   await c.route('**/tduck-api/form/followup/decide*',r=>r.abort('failed'))
   const p=await publicPage(c);await p.locator('.followup-consent .el-checkbox').click();await core(p,0).fill('食堂不太方便');await panel(p,0).getByRole('button',{name:'继续此题（可选追问）'}).click()
   await expect(p.locator('.followup-consent')).toContainText('追问评估未完成')
   await p.getByRole('button',{name:'提交',exact:true}).click();await p.getByText('提交成功',{exact:true}).waitFor()
  }finally{await c.close()}
 })
 await check('owner audit UI exposes traceable source and decision records without capability tokens',async()=>{
  const c=await context(true);try{const p=await c.newPage();await p.goto(front+'/project/form/followup?key='+formKey);await expect(p.locator('.session-record')).toHaveCount(3);await p.locator('.session-record').filter({hasText:'已用 2 次'}).locator('summary').first().click();await expect(p.locator('.records-card')).toContainText('Synthetic independent supplement');await p.screenshot({path:out+'/03-owner-audit.png',animations:'disabled'});await expect(p.getByRole('button',{name:'保存追问设置',exact:true})).toBeDisabled()}finally{await c.close()}
 })
 await check('browser has no uncaught application error',async()=>assert.deepEqual(errors,[]))
}catch(e){checks.push({name:'UI setup/completion',passed:false,error:e.message.slice(0,350)});console.log('FAIL setup '+e.message.slice(0,160))}
finally{
 if(formKey)try{await api('/user/form/stop',{formKey})}catch{}
 await browser.close();const report={date:new Date().toISOString(),frontend:front,backend:base,source:'Real Vue and MySQL workflow; RULE provider; browser API forwarded only when staging selected; one explicitly injected browser network failure',formKey,checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length};fs.writeFileSync(out+'/ui-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}))
}
if(checks.some(c=>!c.passed))process.exitCode=1
