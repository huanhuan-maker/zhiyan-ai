// 用用户提供的真实网关截图取证：我的模型配置 + 应用内测试连接结果（不显示密钥）。
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const cred=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const base='http://127.0.0.1:8997',web='http://127.0.0.1:5180',out='evidence/tduck-full/ai-settings-personal'
fs.mkdirSync(out,{recursive:true})
const login=await (await fetch(base+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:cred.adminEmail,password:cred.adminPassword})})).json()
const token=login.data.token
const user=JSON.stringify({name:'管理员',admin:true,avatar:'',token})
const browser=await chromium.launch({channel:'msedge',headless:true})
const ctx=await browser.newContext({viewport:{width:1440,height:1100}})
await ctx.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token,user})
const page=await ctx.newPage();page.setDefaultTimeout(30000)
const errors=[];page.on('pageerror',e=>errors.push(e.message))
try{
  await page.goto(web+'/home/ai-settings')
  await expect(page.getByTestId('provider-card').first()).toContainText('huanhuan666 网关')
  await expect(page.locator('.ai-settings .el-loading-mask')).toHaveCount(0,{timeout:20000})
  await expect(page.getByTestId('model-id').first().locator('input')).toHaveValue('deepseek-v4.1-flash')
  await page.screenshot({path:out+'/04-live-provider.png'})
  await page.getByRole('button',{name:'测试连接',exact:true}).first().click()
  await expect(page.locator('.test-result').first()).toContainText('连接成功',{timeout:110000})
  const result=await page.locator('.test-result').first().innerText()
  await page.screenshot({path:out+'/05-live-test-success.png'})
  const api=await (await fetch(base+'/user/ai-settings/mine',{headers:{token}})).json()
  fs.writeFileSync(out+'/live-provider.json',JSON.stringify({date:new Date().toISOString(),checked:'actual provider configured by the user; key never returned',uiTestResult:result,provider:api.data.providers.map(p=>({name:p.name,baseUrl:p.baseUrl,protocol:p.protocol,hasApiKey:p.hasApiKey,models:p.models.map(m=>m.modelId)})),inherited:api.data.inherited,errors},null,2)+'\n')
  console.log('UI test result:',result)
  console.log('providers:',JSON.stringify(api.data.providers.map(p=>p.name+' '+p.baseUrl)))
  if(errors.length)throw Error(errors.join(' | '))
}finally{await browser.close()}
