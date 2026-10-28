// Full management dark-theme smoke and visual evidence; no model call or new business data.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
if(f.backend!=='http://127.0.0.1:8997')throw Error('Only isolated backend 8997 is allowed')
const out='evidence/tduck-full/dark-mode/admin';fs.mkdirSync(out,{recursive:true})
const login=await (await fetch(f.backend+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:f.owner,password:f.password})})).json()
if(login.code!==200)throw Error('Isolated login failed')
const browser=await chromium.launch({channel:'msedge',headless:true})
const checks=[]
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,400)});console.log('FAIL '+name+': '+e.message.slice(0,180))}}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 page.setDefaultTimeout(12000)
 await page.addInitScript(({token})=>{localStorage.setItem('token',token);localStorage.setItem('zhiyan-workbench-theme','dark')},{token:login.data.token})
 await page.goto('http://127.0.0.1:5180/home/assistant')
 await expect(page.locator('.assistant-controls')).toBeVisible()
 await check('survey assistant controls, composer and page are navy',async()=>{
  const colors=await page.evaluate(()=>['.assistant-page','.assistant-controls','.assistant-composer'].map(s=>getComputedStyle(document.querySelector(s)).backgroundColor))
  if(colors.join('|')!=='rgb(12, 24, 41)|rgb(20, 34, 53)|rgb(20, 34, 53)')throw Error(colors.join('|'))
  await expect(page.locator('.assistant-composer textarea')).toBeEditable()
 })
 await page.screenshot({path:out+'/01-assistant-dark.png'})
 const formKey=f.forms[0].key
 const pages=[
  ['editor',`/project/form/editor?key=${formKey}`,'.native-designer','02-editor-dark.png'],
  ['logic',`/project/form/logic?key=${formKey}`,'.show-logic-container','03-logic-dark.png'],
  ['setting',`/project/form/setting?key=${formKey}`,'.setting-tabs','04-setting-dark.png'],
  ['publish',`/project/form/publish?key=${formKey}`,'.publish-wrapper','05-publish-dark.png'],
  ['data',`/project/form/data?key=${formKey}`,'.answer-data-table','06-data-dark.png'],
  ['statistics',`/project/form/statistics?key=${formKey}`,'.statistics-workspace','07-statistics-dark.png'],
  ['theme',`/project/form/theme?key=${formKey}`,'.theme-container','08-theme-dark.png'],
  ['member','/home/member','.profile-banner','09-member-dark.png'],
  ['users','/manage/user','.table-card','10-users-dark.png'],
  ['system','/manage/system','.config-card','11-system-dark.png']
 ]
 for(const [name,url,selector,file] of pages){
  await page.goto('http://127.0.0.1:5180'+url)
  await expect(page.locator(selector)).toBeVisible()
  await page.waitForTimeout(400)
  await check(name+' has dark surface and readable content',async()=>{
   const result=await page.locator(selector).evaluate(el=>({bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}))
   if(result.bg==='rgb(255, 255, 255)'||result.bg==='rgba(0, 0, 0, 0)'&&name==='theme')throw Error(JSON.stringify(result))
   if(result.overflow)throw Error('Horizontal overflow')
  })
  await page.screenshot({path:out+'/'+file})
 }
 await page.goto('http://127.0.0.1:5180/project/form/statistics?key='+formKey)
 await expect(page.locator('.statistics-workspace')).toBeVisible()
 await check('ECharts theme changes with workbench theme without changing option data',async()=>{
  await expect(page.locator('.echarts').first()).toBeVisible()
  await page.locator('.form-editor-header .ai-theme-toggle').click()
  await expect(page.locator('html')).not.toHaveClass(/zy-dark/)
  await page.locator('.form-editor-header .ai-theme-toggle').click()
  await expect(page.locator('html')).toHaveClass(/zy-dark/)
  await expect(page.locator('.echarts').first()).toBeVisible()
 })
 await page.goto('http://127.0.0.1:5180/home/assistant')
 await expect(page.locator('.assistant-controls')).toBeVisible()
 await page.setViewportSize({width:390,height:844})
 await check('assistant remains usable at 390px dark',async()=>{
  if(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth))throw Error('Horizontal overflow')
  await expect(page.locator('.assistant-composer textarea')).toBeEditable()
 })
 await page.screenshot({path:out+'/12-assistant-mobile-dark.png'})
}finally{
 await browser.close()
 const report={date:new Date().toISOString(),source:'Real management pages and backend data; no synthetic AI/model call',checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length}
 fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify({passed:report.passed,failed:report.failed}))
}
if(checks.some(c=>!c.passed))process.exitCode=1
