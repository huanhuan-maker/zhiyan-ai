// 系统配置 → AI 配置 作为唯一的模型配置入口：默认模型是用户指定的网关，侧栏不再有独立 AI 配置页。
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const cred=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const out='evidence/tduck-full/ai-settings-default', web='http://127.0.0.1:5180', api='http://127.0.0.1:8997'
fs.mkdirSync(out,{recursive:true})
const checks=[],errors=[]
const login=await (await fetch(api+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:cred.adminEmail,password:cred.adminPassword})})).json()
assert.equal(login.code,200)
const token=login.data.token
const settings=await (await fetch(api+'/user/ai-settings',{headers:{token}})).json()
const model=settings.data.providers.flatMap(p=>p.models).find(m=>m.id===settings.data.defaultModelId)
const provider=settings.data.providers.find(p=>p.models.some(m=>m.id===settings.data.defaultModelId))
const user=JSON.stringify({name:'管理员',admin:true,avatar:'',token})
const browser=await chromium.launch({channel:'msedge',headless:true})
const ctx=await browser.newContext({viewport:{width:1440,height:1100}})
await ctx.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token,user})
const page=await ctx.newPage();page.setDefaultTimeout(20000)
page.on('pageerror',e=>errors.push(e.message))
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:String(e.message).slice(0,600)});console.log('FAIL '+name+': '+String(e.message).slice(0,240));await page.screenshot({path:out+'/ui-last-failure.png'}).catch(()=>{})}}
try{
  await check('侧栏不再有独立的 AI 配置入口',async()=>{
    await page.goto(web+'/home')
    await expect(page.locator('.menu-item').first()).toBeVisible()
    const labels=await page.locator('.menu-item').allInnerTexts()
    assert.deepEqual(labels.map(s=>s.trim()),['AI 建卷','我的问卷','问卷助手','用户管理','系统配置'])
  })

  await check('原来的 /home/ai-settings 地址不再存在',async()=>{
    const response=await page.goto(web+'/home/ai-settings')
    const text=await page.locator('body').innerText()
    assert.equal(/我的模型配置/.test(text),false,'个人配置页仍然可访问')
    assert.ok(response.status()===200,'路由应被前端兜底而不是 500')
    await expect(page.locator('.error-code')).toBeVisible()
    await expect(page.locator('.error-code')).toContainText('404')
  })

  await check('系统配置里的 AI 配置显示系统默认模型与指定网关',async()=>{
    await page.goto(web+'/manage/system')
    await page.getByRole('tab',{name:'AI 配置',exact:true}).click()
    await expect(page.getByRole('heading',{name:'系统默认模型'})).toBeVisible()
    await expect(page.getByTestId('provider-card').first()).toBeVisible()
    await expect(page.locator('.ai-settings .el-loading-mask')).toHaveCount(0,{timeout:20000})
    await expect(page.getByTestId('provider-card').filter({hasText:'huanhuan666'})).toHaveCount(1)
    const defaultCard=page.getByTestId('provider-card').filter({hasText:'huanhuan666'})
    await expect(defaultCard).toContainText('默认模型')
    await expect(defaultCard.locator('[data-testid="model-id"] input').first()).toHaveValue('deepseek-v4.1-flash')
    await expect(defaultCard).toContainText('已保存密钥')
    const keyValue=await defaultCard.locator('input[autocomplete="new-password"]').inputValue()
    assert.equal(keyValue,'','页面不得回显密钥')
    await page.screenshot({path:out+'/01-system-ai-default.png'})
    await defaultCard.scrollIntoViewIfNeeded()
    await page.screenshot({path:out+'/02-default-provider.png'})
  })

  await check('配置页是深色且没有浅色残留',async()=>{
    const a=await page.evaluate(()=>{
      const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(Number);return{r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}}
      const lum=({r,g,b})=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)}
      const leaks=[]
      document.querySelectorAll('.config-card *').forEach(el=>{const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')return;const bg=parse(cs.backgroundColor);const box=el.getBoundingClientRect();if(bg&&bg.a>0.6&&lum(bg)>0.72&&box.width>=40&&box.height>=24)leaks.push({cls:String(el.className).slice(0,50),bg:cs.backgroundColor})})
      return{dark:document.documentElement.classList.contains('zy-dark'),leakCount:leaks.length,leaks:leaks.slice(0,5)}
    })
    assert.equal(a.dark,true)
    assert.equal(a.leakCount,0,JSON.stringify(a.leaks))
  })

  await check('页面没有运行时错误',async()=>{if(errors.length)throw Error(errors.join(' | '))})
  const failed=checks.filter(c=>!c.passed)
  fs.writeFileSync(out+'/results.json',JSON.stringify({date:new Date().toISOString(),defaultModel:model?.modelId,defaultProvider:provider?.name,providers:settings.data.providers.map(p=>({name:p.name,models:p.models.map(m=>m.modelId)})),checks,total:checks.length,passed:checks.length-failed.length,failed:failed.length,errors},null,2)+'\n')
  console.log('default:',provider?.name,'/',model?.modelId)
  console.log('\n'+(checks.length-failed.length)+'/'+checks.length+' checks passed')
  if(failed.length)process.exitCode=1
}finally{await browser.close()}
