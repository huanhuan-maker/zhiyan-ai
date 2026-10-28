// AI 建卷步骤播放器：连接线进度、勾选动效、点步回看真实阶段记录、回放流程。
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const out='evidence/tduck-full/ai-step-player', checks=[], errors=[]
fs.mkdirSync(out,{recursive:true})
const cred=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const api='http://127.0.0.1:8997'
const login=await (await fetch(api+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:cred.adminEmail,password:cred.adminPassword})})).json()
if(login.code!==200)throw Error('login failed: '+login.msg)
const user=login.data
const draft={kind:'draft',title:'步骤播放器合成问卷',description:'合成验收数据',mode:'MOCK',provider:'显式合成验收',model:'synthetic',elapsedMs:3000,questions:[{type:'RADIO',label:'你使用 AI 的频率是？',required:true,options:['经常','偶尔','从不']},{type:'RATE',label:'请为使用体验评分',required:true,rateMax:5},{type:'TEXTAREA',label:'你有什么建议？',required:false,placeholder:''}],dimensions:['使用习惯'],assumptions:['以在校大学生为调查对象'],warnings:[]}
const labels={REGISTERED:'请求已登记，准备提交调查需求',RECEIVED:'服务器已接收调查需求',INPUT_VALIDATED:'调查目标、人群和题数已通过输入检查',MODEL_RUNNING:'模型正在设计问卷，请稍候',VALIDATING:'已收到生成结果，正在检查题型、选项和题数',SUCCEEDED:'草稿检查完成，可以逐题审核'}
let phase='REGISTERED', events=[], modelGate, validationGate
const push=p=>{phase=p;events.push({phase:p,message:labels[p],elapsedMs:events.length*1200})}
const gate=()=>{let release;const promise=new Promise(r=>{release=r});return {promise,release}}
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:1000}})
await context.addInitScript((user)=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user));localStorage.setItem('zhiyan-workbench-theme','dark')},user)
const page=await context.newPage();page.setDefaultTimeout(15000)
page.on('pageerror',e=>errors.push(e.message))
await page.route(url=>url.pathname.endsWith('/user/form/ai/draft/progress'),route=>route.fulfill({json:{code:200,data:{id:'synthetic-step-1'}}}))
await page.route(url=>/\/user\/form\/ai\/draft\/progress\/[^/]+$/.test(url.pathname),route=>route.fulfill({json:{code:200,data:{phase,events,terminal:['SUCCEEDED','FAILED'].includes(phase)}}}))
await page.route(url=>url.pathname.endsWith('/user/form/ai/draft'),async route=>{
  push('RECEIVED');push('INPUT_VALIDATED');push('MODEL_RUNNING')
  await modelGate.promise;push('VALIDATING');await validationGate.promise
  push('SUCCEEDED')
  return route.fulfill({json:{code:200,data:draft}})
})
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,700)});console.log('FAIL '+name+': '+e.message.slice(0,220));await page.screenshot({path:out+'/ui-failure.png'}).catch(()=>{})}}
const panel=()=>page.getByTestId('generation-progress')
try{
  await page.goto('http://127.0.0.1:5180/project/form/ai-draft?fresh=step-'+Date.now())
  await page.getByPlaceholder('例：我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人').fill('合成验收：了解大学生 AI 使用习惯与体验')
  await page.getByPlaceholder('例：在校大学生').fill('在校大学生')
  await page.getByRole('spinbutton').fill('3')
  modelGate=gate();validationGate=gate()
  await page.getByRole('button',{name:'生成草稿',exact:true}).click()

  await check('四步都在，当前步高亮，连接线按真实阶段推进',async()=>{
    await expect(panel()).toBeVisible()
    await expect(panel().locator('.generation-step')).toHaveCount(4)
    await expect(panel().locator('.generation-steps .active')).toContainText('AI 设计问卷')
    const progress=await panel().locator('.generation-steps').evaluate(el=>getComputedStyle(el).getPropertyValue('--step-progress').trim())
    if(progress!=='33%')throw Error('连接线进度不是 33%: '+progress)
    await expect(panel().getByRole('status')).toContainText('模型正在设计问卷')
    await page.screenshot({path:out+'/01-running-steps.png'})
  })

  await check('点击某一步能回看那一步的真实阶段记录与耗时',async()=>{
    await panel().locator('.generation-step').first().click()
    const detail=panel().locator('.generation-step-detail')
    await expect(detail).toBeVisible()
    await expect(detail).toContainText('需求检查')
    await expect(detail).toContainText('调查目标、人群和题数已通过输入检查')
    await expect(detail.locator('time')).toContainText('s')
    await page.screenshot({path:out+'/02-step-detail.png'})
    await panel().locator('.generation-step').first().click()
    await expect(detail).toHaveCount(0)
  })

  await check('生成完成后四步打勾、连接线满格，并可回放整段流程',async()=>{
    modelGate.release();validationGate.release()
    await expect(panel().getByRole('heading',{name:'草稿已就绪'})).toBeVisible({timeout:60000})
    await expect(panel().locator('.generation-steps .done')).toHaveCount(4)
    const progress=await panel().locator('.generation-steps').evaluate(el=>getComputedStyle(el).getPropertyValue('--step-progress').trim())
    if(progress!=='100%')throw Error('完成时连接线不是 100%: '+progress)
    const replay=panel().getByTestId('generation-replay')
    await expect(replay).toBeVisible()
    await replay.click()
    await expect(panel().locator('.generation-step[aria-pressed="true"]')).toHaveCount(1)
    const first=await panel().locator('.generation-step[aria-pressed="true"]').innerText()
    await page.waitForTimeout(1400)
    const later=await panel().locator('.generation-step[aria-pressed="true"]').innerText()
    if(first===later)throw Error('回放没有推进步骤: '+first)
    await page.screenshot({path:out+'/03-replay.png'})
    await expect(replay).toContainText('停止回看')
    await replay.click()
    await expect(replay).toContainText('回看流程')
  })

  await check('窄屏下步骤改为两列，页面无横向溢出',async()=>{
    await page.setViewportSize({width:390,height:844})
    await panel().scrollIntoViewIfNeeded()
    const columns=await panel().locator('.generation-steps').evaluate(el=>getComputedStyle(el).gridTemplateColumns)
    if(columns.trim().split(' ').length!==2)throw Error('窄屏不是两列: '+columns)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false)
    await page.screenshot({path:out+'/04-mobile.png'})
  })

  await check('没有未捕获的前端异常',()=>assert.deepEqual(errors,[]))
}finally{
  modelGate?.release();validationGate?.release()
  await browser.close()
  const report={date:new Date().toISOString(),source:'真实 Edge 浏览器 + 合成进度/生成响应（仅模拟阶段与延迟，不伪造数据）',checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length}
  fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({passed:report.passed,failed:report.failed}))
  if(report.failed)process.exitCode=1
}
