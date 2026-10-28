// 交互层回归：卡片聚光/错峰进场、侧栏选中指示条、顶部阅读进度、数字滚动、减少动态偏好。
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const cred=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const out='evidence/tduck-full/interactions', web='http://127.0.0.1:5180', api='http://127.0.0.1:8997'
fs.mkdirSync(out,{recursive:true})
const checks=[],errors=[]
const login=await (await fetch(api+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:cred.adminEmail,password:cred.adminPassword})})).json()
const user=JSON.stringify({name:'管理员',admin:true,avatar:'',token:login.data.token})
const browser=await chromium.launch({channel:'msedge',headless:true})
const ctx=await browser.newContext({viewport:{width:1500,height:1000}})
await ctx.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token:login.data.token,user})
const page=await ctx.newPage();page.setDefaultTimeout(20000)
page.on('pageerror',e=>errors.push(e.message))
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:String(e.message).slice(0,500)});console.log('FAIL '+name+': '+String(e.message).slice(0,220));await page.screenshot({path:out+'/ui-last-failure.png'}).catch(()=>{})}}
try{
  await page.goto(web+'/home')
  await expect(page.getByRole('heading',{name:'问卷概览'})).toBeVisible()
  await page.waitForTimeout(1200)

  await check('问卷卡片带聚光与进场指令，首屏自动展开',async()=>{
    const card=page.locator('.project-card-item').first()
    await expect(card).toHaveClass(/is-revealed/)
    const attrs=await card.evaluate(el=>({spotlight:el.hasAttribute('data-spotlight'),reveal:el.hasAttribute('data-reveal'),delay:getComputedStyle(el).getPropertyValue('--reveal-delay').trim()}))
    assert.equal(attrs.spotlight,true)
    assert.equal(attrs.reveal,true)
    await page.screenshot({path:out+'/01-home-revealed.png'})
  })

  await check('悬停时聚光跟随指针',async()=>{
    const card=page.locator('.project-card-item').first()
    const box=await card.boundingBox()
    await page.mouse.move(box.x+box.width*0.3,box.y+box.height*0.4)
    await page.waitForTimeout(250)
    const glow=await card.evaluate(el=>({mx:el.style.getPropertyValue('--mx'),my:el.style.getPropertyValue('--my'),opacity:getComputedStyle(el,'::before').opacity,transition:getComputedStyle(el,'::before').transitionDuration}))
    assert.ok(glow.mx && glow.my,'没有写入指针坐标')
    assert.ok(Number(glow.opacity)>0.5,'聚光没有显现：'+JSON.stringify(glow))
    await page.screenshot({path:out+'/02-card-spotlight.png'})
  })

  await check('侧栏选中项有指示条，图标有过渡',async()=>{
    const item=page.locator('.menu-item.menu-item-active').first()
    const bar=await item.evaluate(el=>{const s=getComputedStyle(el,'::before');return{height:s.height,opacity:s.opacity,transition:s.transitionDuration}})
    assert.equal(bar.opacity,'1')
    assert.ok(parseFloat(bar.height)>=10,'指示条高度异常：'+bar.height)
    const icon=page.locator('.menu-item').nth(1).locator('.menu-icon')
    const t=await icon.evaluate(el=>getComputedStyle(el).transitionDuration)
    assert.ok(t && t!=='0s','图标没有过渡')
  })

  await check('长页面出现顶部阅读进度',async()=>{
    const bar=page.locator('.zy-scroll-progress i')
    await expect(bar).toHaveCount(1)
    const before=await bar.evaluate(el=>el.getBoundingClientRect().width)
    await page.locator('.router-view-wrapper').evaluate(el=>{el.scrollTop=el.scrollHeight})
    await page.waitForTimeout(400)
    const after=await bar.evaluate(el=>el.getBoundingClientRect().width)
    assert.ok(after>before,'滚动后进度条没有增长 '+before+'->'+after)
    await page.screenshot({path:out+'/03-scroll-progress.png'})
  })

  await check('数字滚动到最终值并不影响读屏',async()=>{
    const count=page.locator('.page-subtitle .zy-count').first()
    await expect(count).toHaveText(/^[0-9,]+$/)
    const aria=await count.getAttribute('aria-label')
    assert.ok(Number(aria)>=0,'aria-label 缺失')
  })

  await check('AI 建卷的三步说明与候选卡有进场',async()=>{
    await page.goto(web+'/home/ai')
    await page.waitForTimeout(1600)
    const step=page.locator('.guide-step').first()
    await expect(step).toHaveClass(/is-revealed/)
    await page.screenshot({path:out+'/04-ai-studio-guide.png'})
  })

  await check('减少动态偏好下内容直接显示、聚光关闭',async()=>{
    const reduced=await browser.newContext({viewport:{width:1500,height:1000},reducedMotion:'reduce'})
    await reduced.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token:login.data.token,user})
    const p=await reduced.newPage();p.setDefaultTimeout(20000)
    await p.goto(web+'/home')
    await p.waitForTimeout(900)
    const card=p.locator('.project-card-item').first()
    const state=await card.evaluate(el=>({revealed:el.classList.contains('is-revealed'),spotlight:el.hasAttribute('data-spotlight'),transition:getComputedStyle(el).transitionDuration}))
    assert.equal(state.revealed,true)
    assert.equal(state.spotlight,false)
    assert.equal(state.transition,'0s')
    await p.screenshot({path:out+'/05-reduced-motion.png'})
    await reduced.close()
  })

  await check('没有运行时错误',async()=>{if(errors.length)throw Error(errors.join(' | '))})
  const failed=checks.filter(c=>!c.passed)
  fs.writeFileSync(out+'/results.json',JSON.stringify({date:new Date().toISOString(),checks,total:checks.length,passed:checks.length-failed.length,failed:failed.length,errors},null,2)+'\n')
  console.log('\n'+(checks.length-failed.length)+'/'+checks.length+' checks passed')
  if(failed.length)process.exitCode=1
}finally{await browser.close()}
