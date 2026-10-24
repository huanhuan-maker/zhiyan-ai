import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(path.resolve('tduck-vue3/package.json')),{chromium}=require('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/admin-acceptance.json','utf8').replace(/^\uFEFF/,''))
const login=await fetch(f.backend+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:f.account,password:f.password})}).then(r=>r.json())
if(login.code!==200||!login.data.admin)throw new Error('Test administrator login failed')
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}})
await page.addInitScript(user=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user))},login.data)
const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.stack));page.on('response',async r=>{if(r.url().includes('/tduck-api/'))try{const v=await r.json();if(v.code&&v.code!==200)failed.push({path:new URL(r.url()).pathname,code:v.code})}catch{}})
const checks=[]
try{
 for(const route of ['/home','/manage/user','/manage/system','/project/template','/project/template/category','/project/theme/index','/project/theme/category','/project/recycle','/home/member']){
  await page.goto('http://127.0.0.1:5180'+route);await page.waitForTimeout(700)
  if(!await page.locator('.view-container').isVisible())throw new Error('Workspace missing: '+route)
  checks.push({route,visible:true,errorCount:errors.length})
  if(route==='/manage/system')for(const tab of await page.getByRole('tab').all()){
   const name=await tab.innerText();await tab.click();await page.waitForTimeout(300);checks.push({configTab:name,errorCount:errors.length})
  }
 }
 console.log(JSON.stringify({checks,errors,failed},null,2))
 fs.writeFileSync('evidence/tduck-full/admin-ui.json',JSON.stringify({checks,errors,failed},null,2))
 if(errors.length||failed.length)process.exitCode=1
}finally{await browser.close()}
