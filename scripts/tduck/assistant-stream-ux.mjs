// 问卷助手流式回答的交互层：等待态有微光计时状态，正文按节奏铺开并带光标，完成后与历史一致。
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {knowledgeMessage} from '../../tduck-vue3/src/td/assistant/knowledge.js'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const cred=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const out='evidence/tduck-full/assistant-stream-ux', base='http://127.0.0.1:5180', api='http://127.0.0.1:8997'
fs.mkdirSync(out,{recursive:true})
const checks=[],errors=[]
let delayOnce=true
const login=await (await fetch(api+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:cred.adminEmail,password:cred.adminPassword})})).json()
if(login.code!==200)throw Error('login failed: '+login.msg)
const token=login.data.token
const pageData=await (await fetch(api+'/user/form/page?current=1&size=50&folderId=0&folder=0',{headers:{token}})).json()
const forms=pageData.data.records.filter(r=>!r.folder)
const counts=await (await fetch(api+'/user/form/answer-counts?keys='+forms.map(f=>f.formKey).join(','),{headers:{token}})).json()
assert.equal(counts.code,200)
const target=forms.find(f=>Number(counts.data[f.formKey])>0)
if(!target)throw Error('没有带答卷的问卷，无法验证知识库流式回答')
const user=JSON.stringify({name:'管理员',admin:true,avatar:'',token})
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1500,height:1000}})
await context.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token,user})
const page=await context.newPage();page.setDefaultTimeout(20000)
page.on('pageerror',e=>errors.push(e.message))
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,800)});console.log('FAIL '+name+': '+e.message.slice(0,240));await page.screenshot({path:out+'/ui-last-failure.png'}).catch(()=>{})}}
try{
  await page.goto(base+'/home/assistant')
  await expect(page.getByRole('heading',{name:'聊一聊，也管理你的问卷'})).toBeVisible()
  await expect(page.locator('.assistant-composer textarea')).toBeEnabled({timeout:20000})

  await check('等待模型时显示微光状态行与已用秒数，而不是干等',async()=>{
    await page.goto(base+'/home/assistant?formKey='+target.formKey+'&title='+encodeURIComponent(target.textName||target.name||'')+'&question='+encodeURIComponent('总结这份问卷的答卷'))
    await expect(page.locator('.context-chip')).toContainText('正在聊')
    await page.getByRole('button',{name:'发送',exact:true}).click()
    const status=page.locator('.answer-bubble .ai-status').first()
    await expect(status).toBeVisible({timeout:20000})
    await expect(status).toContainText(/正在|检索|理解/)
    await expect(status.locator('.ai-status__orb')).toBeVisible()
    await page.screenshot({path:out+'/01-waiting-status.png'})
    await expect(status.locator('.ai-status__time')).toContainText(/[1-9]s/,{timeout:15000})
  })

  await check('模型逐字输出时显示草稿流：文字增长、光标闪烁、气泡进入流式样式',async()=>{
    const draft=page.locator('.live-draft').first()
    const paced=page.locator('.streaming-text.is-typing').first()
    await expect.poll(async()=> (await draft.count()) + (await paced.count()), {timeout:120000}).toBeGreaterThan(0)
    const isDraft=await draft.count()>0
    const node=isDraft?draft.locator('p.assistant-answer-text'):paced
    const sizes=new Set()
    let first=null
    for(let i=0;i<18;i++){
      const size=await node.innerText().then(x=>x.length).catch(()=>null)
      if(size===null)break
      sizes.add(size)
      if(first===null)first=size
      await page.waitForTimeout(180)
    }
    if(sizes.size<3)throw Error('逐字输出没有推进，只看到长度 '+[...sizes].join(','))
    const a=first,b=[...sizes].at(-1)
    const glow=await page.locator('.answer-bubble:has(.live-draft), .answer-bubble:has(.streaming-text.is-typing)').count()
    if(glow<1)throw Error('生成中气泡没有进入流式样式')
    if(isDraft){
      const caret=await page.locator('.live-draft p').evaluate((el)=>getComputedStyle(el,'::after').content)
      if(!caret||caret==='none')throw Error('草稿流没有光标')
    }else{
      await expect(paced.locator('.streaming-caret')).toBeVisible()
    }
    await page.screenshot({path:out+'/02-streaming.png'})
    return {mode:isDraft?'live-draft':'paced-answer',first:a,second:b}
  })

  await check('回答完成后草稿收起、光标消失，正文与后端保存的历史一致',async()=>{
    await expect(page.locator('.live-draft')).toHaveCount(0,{timeout:60000})
    await expect(page.locator('.streaming-text.is-typing')).toHaveCount(0,{timeout:30000})
    await expect(page.locator('.streaming-caret')).toHaveCount(0)
    const shown=(await page.locator('.assistant-answer-text').last().innerText()).trim()
    const cid=await page.evaluate(()=>sessionStorage.getItem('assistant-conversation'))
    if(!cid)throw Error('页面没有记录当前对话')
    const history=await (await fetch(api+'/user/form/assistant/conversations/'+cid,{headers:{token}})).json()
    const norm=value=>String(value||'').replace(/\s+/g,'')
    const expected=(history.data.turns||[]).map(turn=>norm(knowledgeMessage(turn?.result||{}))).find(text=>text&&text.length>10&&norm(shown).includes(text.slice(0,20)))
    if(!expected)throw Error('历史里没有保存这段正文')
    if(norm(shown)!==expected)throw Error('正文与历史不一致或被重复拼接: '+norm(shown).length+' vs '+expected.length)
    await page.screenshot({path:out+'/03-complete.png'})
    return {chars:shown.length}
  })

  await check('没有草稿流的回答（本地规划）按节奏逐字铺开并显示光标',async()=>{
    const ctx=await browser.newContext({viewport:{width:1400,height:950}})
    await ctx.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token,user})
    const p=await ctx.newPage();p.setDefaultTimeout(20000)
    await p.goto(base+'/home/assistant')
    await expect(p.locator('.assistant-composer textarea')).toBeEnabled({timeout:20000})
    await p.locator('.assistant-composer textarea').fill('你能做什么？')
    await p.getByRole('button',{name:'发送',exact:true}).click()
    const typing=p.locator('.streaming-text.is-typing').first()
    await expect(typing).toBeVisible({timeout:20000})
    await expect(p.locator('.streaming-caret').first()).toBeVisible()
    const a=(await typing.innerText()).length
    await p.waitForTimeout(240)
    const b=await p.locator('.streaming-text.is-typing').first().innerText().then(x=>x.length).catch(()=>a)
    if(!(b>a))throw Error('文字没有逐步出现: '+a+' -> '+b)
    await p.screenshot({path:out+'/04-paced-answer.png'})
    await expect(p.locator('.streaming-text.is-typing')).toHaveCount(0,{timeout:20000})
    await ctx.close()
    return {first:a,second:b}
  })

  await check('减少动态偏好下直接显示完整回答，不出现光标',async()=>{
    const ctx=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'})
    await ctx.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token,user})
    const p=await ctx.newPage();p.setDefaultTimeout(20000)
    await p.goto(base+'/home/assistant')
    await expect(p.locator('.assistant-composer textarea')).toBeEnabled({timeout:20000})
    await p.locator('.assistant-composer textarea').fill('你能做什么？')
    await p.getByRole('button',{name:'发送',exact:true}).click()
    let caret=0
    for(let i=0;i<12;i++){caret+=await p.locator('.streaming-caret').count();await p.waitForTimeout(150)}
    await expect(p.locator('.assistant-answer-text').last()).toContainText('问卷')
    if(caret>0)throw Error('减少动态偏好下仍出现逐字光标')
    await p.screenshot({path:out+'/05-reduced-motion.png'})
    await ctx.close()
  })

  await check('没有未捕获的前端异常',()=>assert.deepEqual(errors,[]))
}finally{
  await browser.close()
  const report={date:new Date().toISOString(),source:'真实 Edge 浏览器 + 8997 后端 + 真实知识库问卷流式回答',checks,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length}
  fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({passed:report.passed,failed:report.failed}))
  if(report.failed)process.exitCode=1
}