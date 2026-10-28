// AI 配置：每个账号用自己的请求地址与 API Key 配置模型（API + 浏览器回归）。
// 覆盖：继承系统默认配置、首次保存、密钥不回显、换地址必须重填 Key、普通用户不能改全局、未登录拒绝、
//      个人配置真的用于 AI 生成、深色与保存交互。
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const api='http://127.0.0.1:8997', web='http://127.0.0.1:5180'
const out='evidence/tduck-full/ai-settings-personal'
fs.mkdirSync(out,{recursive:true})
const admin=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const fixture=JSON.parse(fs.readFileSync('.local/assistant-simple/acceptance.json','utf8').replace(/^\uFEFF/,''))
const MYSQL='D:/MySQL/MySQL Server 8.0/bin/mysql.exe'
const mysql=(sql)=>{const r=execFileSync(MYSQL,['-uroot','-D','tduck_vue3_dev','-N','-B','-e',sql],{env:{...process.env,MYSQL_PWD:admin.mysqlRootPassword},encoding:'utf8'});return r.trim()}

const ownerId=Number(mysql(`SELECT id FROM ac_user WHERE email='${fixture.owner}' LIMIT 1`))
if(!ownerId)throw Error('测试账号不存在')
// 从干净状态开始：删掉这个账号的个人配置，验证"继承系统默认配置"的状态。
mysql(`DELETE FROM fm_ai_settings_user WHERE user_id=${ownerId}`)
const beforeRevision=Number(mysql('SELECT revision FROM fm_ai_settings WHERE id=1'))

const checks=[],errors=[]
async function raw(url,{method='GET',token,body}={}){const r=await fetch(api+url,{method,headers:{'Content-Type':'application/json',...(token?{token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return r.json()}
async function ok(url,opts){const r=await raw(url,opts);assert.equal(r.code,200,url+' -> '+r.code+' '+r.msg);return r.data}
async function login(account,password){const r=await raw('/login/account',{method:'POST',body:{account,password}});assert.equal(r.code,200,'login '+account);return r.data.token}
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:String(e.message).slice(0,700)});console.log('FAIL '+name+': '+String(e.message).slice(0,240))}}

const ownerToken=await login(fixture.owner,fixture.password)
const adminToken=await login(admin.adminEmail,admin.adminPassword)
const provider={id:randomUUID(),name:'我的自建网关',protocol:'OPENAI_CHAT',baseUrl:'http://127.0.0.1:3425/v1',apiKey:'sk-personal-e2e',timeoutMs:60000,outputTokenParameter:'max_tokens',models:[{id:randomUUID(),name:'我的模型',modelId:'group/group',reasoningEffort:'auto',contextWindow:32768,maxOutputTokens:8192,historyTurns:6}]}
let personal
const browser=await chromium.launch({channel:'msedge',headless:true})
let context,page
try{
  await check('普通用户可以读取自己的模型配置（默认继承系统配置）',async()=>{
    const view=await ok('/user/ai-settings/mine',{token:ownerToken})
    assert.equal(view.inherited,true)
    assert.equal(view.providers.length>=1,true)
    assert.equal(view.providers[0].hasApiKey,true)
    assert.equal(JSON.stringify(view).includes('encryptedKey'),false,'不应返回加密密文')
  })

  await check('未登录不能读取个人配置',async()=>{
    const r=await raw('/user/ai-settings/mine')
    assert.equal(r.code,401)
  })

  await check('普通用户不能用全局接口修改系统默认配置',async()=>{
    const r=await raw('/user/ai-settings',{method:'POST',token:ownerToken,body:{revision:0,enabled:false,providers:[]}})
    assert.equal(r.code,500)
    assert.match(r.msg,/管理员/)
  })

  await check('填写自己的请求地址和 API Key 可以保存，且不改动系统默认配置',async()=>{
    const globalRevisionBefore=mysql('SELECT revision FROM fm_ai_settings WHERE id=1')
    const globalJsonBefore=mysql('SELECT config_json FROM fm_ai_settings WHERE id=1')
    const view=await ok('/user/ai-settings/mine',{token:ownerToken})
    personal={revision:view.revision,enabled:true,defaultModelId:provider.models[0].id,providers:[provider]}
    const saved=await ok('/user/ai-settings/mine',{method:'POST',token:ownerToken,body:personal})
    assert.equal(saved.inherited,false)
    assert.equal(saved.providers[0].baseUrl,provider.baseUrl)
    assert.equal(saved.providers[0].hasApiKey,true)
    assert.equal(JSON.stringify(saved).includes('sk-personal-e2e'),false,'密钥不得回显')
    assert.equal(JSON.stringify(saved).includes('encryptedKey'),false)
    assert.equal(mysql('SELECT revision FROM fm_ai_settings WHERE id=1'),globalRevisionBefore,'普通用户保存不得推进系统配置版本')
    assert.equal(mysql('SELECT config_json FROM fm_ai_settings WHERE id=1'),globalJsonBefore,'普通用户保存不得改动系统配置内容')
  })

  await check('重新读取时只看到自己的配置',async()=>{
    const view=await ok('/user/ai-settings/mine',{token:ownerToken})
    assert.equal(view.inherited,false)
    assert.equal(view.providers.length,1)
    assert.equal(view.providers[0].name,'我的自建网关')
    const global=await ok('/user/ai-settings',{token:adminToken})
    assert.equal(global.providers.some(p=>p.name==='我的自建网关'),false,'系统默认配置里不应出现测试供应商')
  })

  await check('改了 Base URL 却没重新填写 API Key 会被拒绝',async()=>{
    const view=await ok('/user/ai-settings/mine',{token:ownerToken})
    const changed=JSON.parse(JSON.stringify(view))
    changed.providers[0].baseUrl='http://127.0.0.1:9999/v1'
    changed.providers[0].apiKey=''
    delete changed.inherited
    const r=await raw('/user/ai-settings/mine',{method:'POST',token:ownerToken,body:changed})
    assert.equal(r.code,500)
    assert.match(r.msg,/重新填写API Key/)
  })

  if(process.env.PERSONAL_AI_REAL==='1'){
    await check('个人配置真的用于 AI 生成（真实网关）',async()=>{
      const draft=await ok('/user/form/ai/draft',{method:'POST',token:ownerToken,body:{goal:'了解大学生使用校园打印店的频率与不满意的地方',audience:'在校大学生',questionCount:5}})
      assert.equal(draft.kind,'draft')
      assert.equal(draft.questions.length>=4,true)
      assert.equal(draft.provider,'我的自建网关')
    })
  }

  const user=JSON.stringify({name:'Vue3 Researcher',admin:false,avatar:'',token:ownerToken})
  context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token:ownerToken,user})
  page=await context.newPage();page.setDefaultTimeout(20000)
  page.on('pageerror',e=>errors.push(e.message))

  await check('浏览器：普通用户侧栏有 AI 配置并能打开自己的配置页',async()=>{
    await page.goto(web+'/home/ai-settings')
    await expect(page.locator('.menu-item',{hasText:'AI 配置'})).toBeVisible()
    await expect(page.getByRole('heading',{name:'我的模型配置'})).toBeVisible()
    await expect(page.getByTestId('provider-card')).toHaveCount(1)
    await expect(page.locator('.inherited-alert')).toHaveCount(0)
  })

  await check('浏览器：页面是深色且没有浅色残留',async()=>{
    await expect(page.locator('.ai-settings .el-loading-mask')).toHaveCount(0,{timeout:20000})
    await expect(page.locator('.settings-heading .el-switch')).toHaveClass(/is-checked/)
    const a=await page.evaluate(()=>{
      const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(Number);return{r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}}
      const lum=({r,g,b})=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)}
      const leaks=[]
      document.querySelectorAll('.ai-settings-page *').forEach(el=>{const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')return;const bg=parse(cs.backgroundColor);const box=el.getBoundingClientRect();if(bg&&bg.a>0.6&&lum(bg)>0.72&&box.width>=40&&box.height>=24)leaks.push({cls:String(el.className).slice(0,50),bg:cs.backgroundColor})})
      return{dark:document.documentElement.classList.contains('zy-dark'),leaks:leaks.slice(0,5),leakCount:leaks.length}
    })
    assert.equal(a.dark,true)
    assert.equal(a.leakCount,0,JSON.stringify(a.leaks))
    await page.screenshot({path:out+'/01-personal-settings.png'})
  })

  await check('浏览器：改地址和 Key 后点保存能成功',async()=>{
    const card=page.getByTestId('provider-card').first()
    const urlInput=card.locator('label',{hasText:'Base URL'}).locator('input')
    await urlInput.fill('http://127.0.0.1:3425/v1')
    const keyInput=card.locator('label',{hasText:'API Key'}).locator('input')
    await keyInput.fill('sk-personal-browser')
    await page.getByRole('button',{name:'保存全部配置'}).click()
    await expect(page.locator('.el-message--success')).toContainText('已保存你自己的模型配置',{timeout:20000})
    await expect(page.locator('.settings-error')).toHaveCount(0)
    await expect(page.locator('.ai-settings .el-loading-mask')).toHaveCount(0,{timeout:20000})
    await page.screenshot({path:out+'/02-personal-saved.png'})
  })

  await check('浏览器：管理员系统配置里仍是系统默认模型',async()=>{
    const adminUser=JSON.stringify({name:'管理员',admin:true,avatar:'',token:adminToken})
    const ctx=await browser.newContext({viewport:{width:1440,height:1000}})
    await ctx.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token:adminToken,user:adminUser})
    const p=await ctx.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message))
    await p.goto(web+'/manage/system')
    await p.getByRole('tab',{name:'AI 配置',exact:true}).click()
    await expect(p.getByRole('heading',{name:'系统默认模型'})).toBeVisible()
    await expect(p.locator('.ai-settings .el-loading-mask')).toHaveCount(0,{timeout:20000})
    await expect(p.getByTestId('provider-card').first()).toBeVisible()
    await p.screenshot({path:out+'/03-global-settings.png'})
    await ctx.close()
  })

  await check('浏览器没有运行时错误',async()=>{if(errors.length)throw Error(errors.join(' | '))})
  const failed=checks.filter(c=>!c.passed)
  fs.writeFileSync(out+'/results.json',JSON.stringify({date:new Date().toISOString(),owner:fixture.owner,checks,total:checks.length,passed:checks.length-failed.length,failed:failed.length,errors},null,2)+'\n')
  console.log('\n'+(checks.length-failed.length)+'/'+checks.length+' checks passed')
  if(failed.length)process.exitCode=1
}finally{await context?.close().catch(()=>{});await browser.close()}
