// Workbench dark mode: isolated local UI evidence. Synthetic AI response is explicitly labelled.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
if(f.backend!=='http://127.0.0.1:8997')throw Error('Only isolated backend 8997 is allowed')
const out='evidence/tduck-full/dark-mode';fs.mkdirSync(out,{recursive:true})
const checks=[]
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,400)});console.log('FAIL '+name+': '+e.message.slice(0,180))}}
const login=await (await fetch(f.backend+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:f.owner,password:f.password})})).json()
if(login.code!==200)throw Error('Isolated account login failed')
const draft={kind:'draft',mode:'MOCK',provider:'Synthetic dark-mode fixture',model:'fixture-no-model-call',elapsedMs:1200,title:'深色模式布局验证',description:'合成 UI 草稿，仅验证样式，不是实际模型生成',warnings:[],assumptions:[],dimensions:[],questions:[
 {type:'RADIO',label:'深色模式下文字是否清晰？',required:true,options:['清晰','一般']},
 {type:'RATE',label:'请为深色模式打分',required:true,rateMax:5},
 {type:'TEXTAREA',label:'补充建议',required:true,placeholder:'可选建议'}]}
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 page.setDefaultTimeout(12000)
 await page.addInitScript(t=>localStorage.setItem('token',t),login.data.token)
 await page.route('**/user/form/ai/draft*',r=>r.fulfill({json:{code:200,data:draft}}))
 await page.goto('http://127.0.0.1:5180/home')
 await page.evaluate(()=>{localStorage.removeItem('zhiyan-workbench-theme');document.documentElement.classList.remove('zy-dark');document.documentElement.style.colorScheme='light'})
 await expect(page.locator('.project-card-item').first()).toBeVisible()
 await check('light theme is the default and survey data is visible',async()=>{
  if(await page.locator('html.zy-dark').count())throw Error('Dark theme unexpectedly active')
  await expect(page.locator('.project-card-item').first()).toBeVisible()
 })
 await page.locator('.theme-toggle-btn').click()
 await expect(page.locator('html')).toHaveClass(/zy-dark/)
 await page.reload()
 await expect(page.locator('.project-card-item').first()).toBeVisible()
 await expect(page.locator('.project-card-container .el-loading-mask')).toHaveCount(0)
 await check('dark theme survives reload and uses navy surface tokens',async()=>{
  const style=await page.locator('.home-container').evaluate(el=>({background:getComputedStyle(el).backgroundColor,scheme:document.documentElement.style.colorScheme,stored:localStorage.getItem('zhiyan-workbench-theme'),card:getComputedStyle(el.querySelector('.project-card-item')).backgroundColor,nav:getComputedStyle(el.querySelector('.menu-item-active')).backgroundColor}))
  if(style.background!=='rgb(12, 24, 41)'||style.scheme!=='dark'||style.stored!=='dark'||style.card!=='rgb(20, 34, 53)'||style.nav!=='rgb(23, 49, 55)')throw Error(JSON.stringify(style))
 })
 await page.screenshot({path:out+'/01-home-dark-desktop.png'})
 await check('light theme can be restored from the sidebar',async()=>{
  await page.locator('.theme-toggle-btn').click()
  if(await page.locator('html.zy-dark').count())throw Error('Dark class not removed')
  await page.locator('.theme-toggle-btn').click()
 })
 await page.getByRole('button',{name:'AI 建卷',exact:true}).click()
 await page.getByPlaceholder('例：我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人').fill('深色模式下的表单可读性')
 await page.getByPlaceholder('例：在校大学生').fill('在校大学生')
 await page.getByRole('spinbutton').fill('3')
 await page.screenshot({path:out+'/02-ai-dark-form-desktop.png'})
 await check('dark AI form keeps visible values and generates a draft',async()=>{
  await expect(page.getByRole('spinbutton')).toHaveValue('3')
  const inputBackground=await page.locator('.ai-draft-container .input-card .el-input__wrapper').first().evaluate(el=>getComputedStyle(el).backgroundColor)
  if(inputBackground!=='rgb(17, 30, 48)')throw Error('AI input is not dark: '+inputBackground)
  const nativeBackground=await page.getByPlaceholder('例：在校大学生').evaluate(el=>getComputedStyle(el).backgroundColor)
  if(nativeBackground==='rgb(255, 255, 255)')throw Error('Native AI input remains white')
  await page.getByRole('button',{name:'生成草稿',exact:true}).click()
  await expect(page.locator('.question-item')).toHaveCount(3)
 })
 await page.screenshot({path:out+'/03-ai-dark-draft-desktop.png'})
 await check('dark preview, answer widgets and modal are usable',async()=>{
  await page.getByRole('button',{name:'预览答题效果',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.locator('.native-form')).toBeVisible()
  await dialog.locator('.el-radio').first().click()
  await dialog.locator('.el-rate__item').nth(3).click()
  await page.screenshot({path:out+'/04-ai-dark-preview-desktop.png'})
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button',{name:'导入编辑器继续编辑',exact:true})).toBeEnabled()
 })
 await page.setViewportSize({width:390,height:844})
 await page.goto('http://127.0.0.1:5180/home')
 await expect(page.locator('.project-card-item').first()).toBeVisible()
 await expect(page.locator('.project-card-container .el-loading-mask')).toHaveCount(0)
 await check('390px dark home has no overflow and retains theme toggle',async()=>{
  if(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth))throw Error('Horizontal overflow')
  await expect(page.getByRole('button',{name:'切换浅色模式',exact:true})).toBeVisible()
 })
 await page.screenshot({path:out+'/05-home-dark-mobile.png'})
 await page.goto('http://127.0.0.1:5180/project/form/ai-draft')
 await expect(page.locator('.question-item')).toHaveCount(3)
 await page.locator('.ai-draft-container').evaluate(el=>{el.scrollTop=el.scrollHeight})
 await check('390px dark AI draft preserves restored inputs and reachable actions',async()=>{
  await expect(page.getByRole('spinbutton')).toHaveValue('3')
  const box=await page.getByRole('button',{name:'导入编辑器继续编辑',exact:true}).boundingBox()
  if(!box||box.y<0||box.y+box.height>844)throw Error('Bottom action outside viewport')
 })
 await page.screenshot({path:out+'/06-ai-dark-mobile.png'})
}finally{
 await browser.close()
 const report={date:new Date().toISOString(),source:'Real Vue UI and local backend login; synthetic AI fixture with no model call',checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length}
 fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify({passed:report.passed,failed:report.failed}))
}
if(checks.some(c=>!c.passed))process.exitCode=1
