// AI 建卷工作室：入口、生成输入、候选对比、草稿箱与移动端布局的视觉回归。
// 直接触发真实 AI 生成会消耗网关额度，这里用与服务端一致的数据结构注入候选，专门验证布局与交互。
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const cred=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const out='evidence/tduck-full/ai-studio', base='http://127.0.0.1:5180'
fs.mkdirSync(out,{recursive:true})
const checks=[],errors=[]
const login=await (await fetch('http://127.0.0.1:8997/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:cred.adminEmail,password:cred.adminPassword})})).json()
if(login.code!==200) throw Error('login failed: '+login.msg)
const token=login.data.token, ownerKey=createHash('sha256').update(token).digest('hex')
const user=JSON.stringify({name:'管理员',admin:true,avatar:'',token})

const draft=(n,title,questions)=>({id:'variant-'+n,form:{goal:'合成研究目标 '+n,audience:'在校大学生',extra:'',questionCount:questions.length},createdAt:'2026-10-25T02:0'+n+':00.000Z',result:{kind:'draft',title,description:'合成描述：用于验证候选对比布局，不代表真实生成结果。',questions,provider:'合成',model:'synthetic',elapsedMs:18400+n*2300,warnings:n===2?['第 3 题选项未覆盖“其他”情况，建议补充。']:[],assumptions:[],dimensions:['参与动机','阻碍因素']}})
const Q=(type,label,extra={})=>({type,label,required:true,...extra})
const v1=draft(1,'大学生社团参与意愿调查',[Q('RADIO','你目前是否参加过社团活动？',{options:['正在参加','曾参加但已退出','从未参加']}),Q('CHECKBOX','影响你参加社团的主要因素有哪些？',{options:['时间冲突','兴趣不匹配','信息获取不便','社交压力','其他']}),Q('RATE','你对社团活动的整体满意度',{rateMax:5}),Q('TEXTAREA','如果愿意参加，你希望社团提供什么？')])
const v2=draft(2,'社团参与阻碍因素研究',[Q('RADIO','你所在的年级是？',{options:['大一','大二','大三','大四及以上']}),Q('CHECKBOX','你退出或未参加社团的原因是？',{options:['学业压力','社团活动质量','人际关系','经济成本']}),Q('CHECKBOX','以下哪些支持会提高你的参与意愿？',{options:['灵活时间安排','技能培训','志愿时长认定']}),Q('RATE','你认为社团活动对个人成长的价值',{rateMax:7}),Q('TEXTAREA','请描述一次让你印象深刻的社团经历')])
const v3=draft(3,'社团信息触达与参与意愿',[Q('RADIO','你主要通过什么渠道了解社团信息？',{options:['公众号','同学推荐','招新现场','几乎没有渠道']}),Q('RATE','你对现有社团宣传的清晰度评价',{rateMax:5}),Q('TEXTAREA','你希望看到什么样的社团介绍？')])
const session={form:{goal:'大学生为什么不愿意参加社团活动，区分从没参加过和已经退出的人',audience:'在校大学生',extra:'需要区分两类人群',questionCount:10},variants:[v1,v2,v3]}

let context,page
const audit=async()=>page.evaluate(()=>{
  const parse=(c)=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(Number);return{r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}}
  const lum=({r,g,b})=>{const f=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)}
  const leaks=[]
  document.querySelectorAll('.ai-studio *, .ai-strip *').forEach(el=>{const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')return;const bg=parse(cs.backgroundColor);const box=el.getBoundingClientRect();if(bg&&bg.a>0.6&&lum(bg)>0.72&&box.width>=40&&box.height>=24)leaks.push({cls:String(el.className).slice(0,60),bg:cs.backgroundColor})})
  return{dark:document.documentElement.classList.contains('zy-dark'),leaks:leaks.slice(0,8),leakCount:leaks.length,scrollW:document.documentElement.scrollWidth,clientW:document.documentElement.clientWidth}
})
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,600)});console.log('FAIL '+name+': '+e.message.slice(0,300));await page.screenshot({path:out+'/ui-last-failure.png'}).catch(()=>{})}}
try{
  const browser=await chromium.launch({channel:'msedge',headless:true})
  context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1})
  await context.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token,user})
  page=await context.newPage();page.setDefaultTimeout(15000)
  page.on('pageerror',e=>errors.push(e.message))

  await check('首页出现 AI 建卷横幅并指向工作室',async()=>{
    await page.goto(base+'/home');await expect(page.getByRole('heading',{name:'问卷概览'})).toBeVisible()
    const strip=page.locator('.ai-strip');await expect(strip).toBeVisible()
    await expect(strip).toContainText('用一句话生成一份可编辑问卷')
    await page.screenshot({path:out+'/01-home-banner.png'})
    await strip.getByRole('button',{name:'进入 AI 建卷'}).click()
    await page.waitForURL('**/home/ai')
    await expect(page.getByRole('heading',{name:/用一句话描述你的研究/})).toBeVisible()
  })

  await check('侧栏把 AI 建卷放在第一位并高亮',async()=>{
    const first=page.locator('.menu-item').first()
    await expect(first).toContainText('AI 建卷')
    await expect(first).toHaveClass(/menu-item-active/)
    await expect(page.locator('.header-title h1')).toHaveText('AI 建卷')
  })

  await check('工作室默认是深色且没有浅色块或横向溢出',async()=>{
    const a=await audit()
    if(!a.dark)throw Error('zy-dark missing')
    if(a.leakCount)throw Error('light blocks: '+JSON.stringify(a.leaks))
    if(a.scrollW>a.clientW+1)throw Error('horizontal overflow '+a.scrollW+'>'+a.clientW)
    await page.screenshot({path:out+'/02-studio-empty.png',fullPage:true})
  })

  await check('点击灵感示例会填好目标、人群与题量',async()=>{
    await page.locator('.idea-chip').first().click()
    await expect(page.locator('#studio-goal')).toHaveValue(/社团/)
    await expect(page.locator('#studio-audience')).toHaveValue('在校大学生')
    await expect(page.locator('.count-chip.active')).toHaveText('10')
    await page.screenshot({path:out+'/03-studio-idea-filled.png'})
  })

  await check('三个候选并排展示并自动选中最新一份',async()=>{
    await context.addInitScript(({key,session})=>{sessionStorage.setItem(key,JSON.stringify(session))},{key:'aiStudio:'+ownerKey,session})
    page=await context.newPage();page.setDefaultTimeout(15000)
    page.on('pageerror',e=>errors.push(e.message))
    await page.goto(base+'/home/ai')
    await expect(page.getByTestId('studio-variant')).toHaveCount(3)
    await expect(page.locator('.variant-card.selected .variant-badge')).toHaveText('C')
    const cards=await page.getByTestId('studio-variant').evaluateAll(ns=>ns.map(n=>({left:Math.round(n.getBoundingClientRect().left),w:Math.round(n.getBoundingClientRect().width)})))
    if(cards[0].left===cards[1].left)throw Error('候选没有并排')
    await page.locator('.variants-section').scrollIntoViewIfNeeded()
    await page.screenshot({path:out+'/04-studio-variants.png'})
  })

  await check('点击候选卡片切换题目预览',async()=>{
    await page.getByTestId('studio-variant').first().click()
    await expect(page.locator('.variant-card.selected .variant-badge')).toHaveText('A')
    await expect(page.locator('.detail-head h3')).toHaveText('大学生社团参与意愿调查')
    await expect(page.locator('.detail-question')).toHaveCount(4)
    await expect(page.locator('.detail-question').first()).toContainText('正在参加')
    await page.locator('.detail-panel').scrollIntoViewIfNeeded()
    await page.screenshot({path:out+'/05-studio-detail.png'})
  })

  await check('丢弃候选后数量与选中项同步更新',async()=>{
    await page.getByTestId('studio-variant').nth(1).locator('.variant-discard').click()
    await expect(page.getByTestId('studio-variant')).toHaveCount(2)
  })

  await check('草稿箱区块可读，无草稿时给出说明',async()=>{
    const box=page.locator('.draft-box');await expect(box).toBeVisible()
    await expect(box.locator('.section-bar h2')).toHaveText('我的 AI 草稿')
    const cards=await box.getByTestId('studio-draft').count()
    if(cards===0)await expect(box.locator('.draft-empty')).toBeVisible()
  })

  await check('移动端窄屏单列排布且不横向溢出',async()=>{
    const mobile=await context.newPage()
    await mobile.setViewportSize({width:390,height:844})
    mobile.on('pageerror',e=>errors.push(e.message))
    await mobile.goto(base+'/home/ai')
    await expect(mobile.getByTestId('studio-variant')).toHaveCount(3)
    const widths=await mobile.getByTestId('studio-variant').evaluateAll(ns=>ns.map(n=>Math.round(n.getBoundingClientRect().width)))
    if(new Set(widths).size!==1)throw Error('cards not full width: '+widths)
    const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
    if(overflow>1)throw Error('mobile horizontal overflow '+overflow)
    await mobile.screenshot({path:out+'/06-studio-mobile.png'})
    await mobile.locator('.variants-section').scrollIntoViewIfNeeded()
    await mobile.screenshot({path:out+'/07-studio-mobile-variants.png'})
    await mobile.locator('.draft-box').scrollIntoViewIfNeeded()
    await mobile.screenshot({path:out+'/08-studio-mobile-drafts.png'})
    await mobile.close()
  })

  await check('候选可直接导入为未发布问卷并进入编辑器',async()=>{
    await page.goto(base+'/home/ai')
    await page.getByTestId('studio-variant').first().click()
    await page.getByTestId('studio-import').click()
    await page.waitForURL('**/project/form/editor?**',{timeout:45000})
    await expect(page.locator('.question-card')).toHaveCount(4)
    await expect(page.locator('.question-card').first()).toContainText('你目前是否参加过社团活动')
    await page.screenshot({path:out+'/09-imported-editor.png'})
  })

  // 可选：真实走一次本机推理网关，证明工作室的生成路径可用（不注入候选）。
  if(process.env.STUDIO_REAL==='1'){
    await check('真实网关生成一份草稿并落到候选区',async()=>{
      const real=await chromium.launch({channel:'msedge',headless:true})
      const ctx=await real.newContext({viewport:{width:1440,height:1000}})
      await ctx.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token,user})
      const p=await ctx.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push('real: '+e.message))
      await p.goto(base+'/home/ai')
      await p.locator('#studio-goal').fill('了解大学生对食堂价格的接受程度，区分经常在食堂吃饭和不常去的人')
      await p.locator('#studio-audience').fill('在校大学生')
      await p.locator('.count-chip').filter({hasText:/^8$/}).click()
      await p.getByTestId('studio-generate').click()
      await expect(p.getByTestId('studio-variant')).toHaveCount(1,{timeout:180000})
      await expect(p.locator('.detail-head h3')).toBeVisible()
      await p.locator('.variants-section').scrollIntoViewIfNeeded()
      await p.screenshot({path:out+'/10-studio-real-generated.png'})
      await ctx.close();await real.close()
    })
  }

  await check('页面没有运行时错误',async()=>{ if(errors.length)throw Error(errors.join(' | ')) })
  const failed=checks.filter(c=>!c.passed)
  fs.writeFileSync(out+'/results.json',JSON.stringify({checks,total:checks.length,passed:checks.length-failed.length,failed:failed.length,errors},null,2))
  console.log('\n'+(checks.length-failed.length)+'/'+checks.length+' checks passed')
  if(failed.length)process.exitCode=1
}finally{await context?.close().catch(()=>{})}
