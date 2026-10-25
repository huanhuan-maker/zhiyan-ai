// UI refresh evidence: desktop and mobile screenshots plus interaction checks.
// Uses the isolated acceptance account and real backend state; synthetic AI response is injected and labelled.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(path.resolve('tduck-vue3/package.json'))
const {chromium,expect}=require('@playwright/test')
const fixture=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
if(fixture.backend!=='http://127.0.0.1:8997')throw Error('Only isolated backend 8997 is allowed')
const out='evidence/tduck-full/ui-refresh';fs.mkdirSync(out,{recursive:true})
async function api(url,data,token){const response=await fetch(fixture.backend+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});const body=await response.json();if(body.code!==200)throw Error(url+': '+body.msg);return body.data}
const token=(await api('/login/account',{account:fixture.owner,password:fixture.password})).token
const draft={kind:'draft',mode:'MOCK',provider:'Synthetic UI evidence fixture',model:'fixture-no-model-call',elapsedMs:1200,title:'UI 风格验证问卷 '+Date.now(),description:'用于验证改版后的真实布局和交互，不使用真实模型',warnings:[],assumptions:['合成验证草稿'],dimensions:['使用体验'],questions:[
 {type:'RADIO',label:'你对当前页面布局是否满意？',required:true,options:['满意','一般','不满意']},
 {type:'CHECKBOX',label:'你希望优先改进哪些部分？',required:true,options:['颜色','间距','操作顺序']},
 {type:'RATE',label:'请为整体清晰度打分',required:true,rateMax:5},
 {type:'TEXTAREA',label:'还有哪些建议？',required:true,placeholder:'请简要说明'}]}
const browser=await chromium.launch({channel:'msedge',headless:true})
const results=[]
async function check(name,fn){try{const detail=await fn();results.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){results.push({name,passed:false,error:e.message.slice(0,400)});console.log('FAIL '+name+': '+e.message.slice(0,180))}}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 page.setDefaultTimeout(12000)
 await page.addInitScript(t=>localStorage.setItem('token',t),token)
 await page.route('**/user/form/ai/draft*',route=>route.fulfill({json:{code:200,data:draft}}))
 await page.goto('http://127.0.0.1:5180/home')
 await expect(page.getByRole('heading',{name:'我的问卷',exact:true})).toBeVisible()
 await page.screenshot({path:out+'/06-home-after-desktop.png'})
 await check('desktop home keeps create and AI entries clickable',async()=>{
  await expect(page.getByRole('button',{name:'新建问卷',exact:true})).toBeEnabled()
  await expect(page.getByRole('button',{name:'AI 建卷',exact:true})).toBeEnabled()
  await page.getByRole('button',{name:'AI 建卷',exact:true}).click()
  await expect(page).toHaveURL(/\/project\/form\/ai-draft/)
 })
 await check('AI form accepts values and question count is visible',async()=>{
  await page.getByPlaceholder('例：我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人').fill('了解大学生社团参与体验')
  await page.getByPlaceholder('例：在校大学生').fill('在校大学生')
  const number=page.getByRole('spinbutton')
  await number.fill('4');await expect(number).toHaveValue('4')
 })
 await page.getByRole('button',{name:'生成草稿',exact:true}).click()
 await expect(page.locator('.question-item')).toHaveCount(4)
 await page.screenshot({path:out+'/07-ai-after-desktop.png'})
 await check('desktop preview and import entries remain enabled',async()=>{
  await expect(page.getByRole('button',{name:'预览答题效果',exact:true})).toBeEnabled()
  await expect(page.getByRole('button',{name:'导入编辑器继续编辑',exact:true})).toBeEnabled()
 })
 await page.setViewportSize({width:390,height:844})
 await check('mobile AI page has no horizontal overflow and bottom actions are reachable',async()=>{
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)
  if(overflow)throw Error('Horizontal overflow at 390px')
  await page.locator('.ai-draft-container').evaluate(el=>{el.scrollTop=el.scrollHeight})
  const box=await page.getByRole('button',{name:'导入编辑器继续编辑',exact:true}).boundingBox()
  if(!box||box.y<0||box.y+box.height>844)throw Error('Import action is outside mobile viewport')
 })
 await page.screenshot({path:out+'/08-ai-after-mobile.png'})
 await page.goto('http://127.0.0.1:5180/home')
 await expect(page.getByRole('heading',{name:'我的问卷',exact:true})).toBeVisible()
 await check('mobile home keeps entries and does not overflow horizontally',async()=>{
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)
  if(overflow)throw Error('Home horizontal overflow at 390px')
  await expect(page.getByRole('button',{name:'新建问卷',exact:true})).toBeEnabled()
  await expect(page.getByRole('button',{name:'AI 建卷',exact:true})).toBeEnabled()
 })
 await page.screenshot({path:out+'/09-home-after-mobile.png'})
}finally{
 await browser.close()
 const report={date:new Date().toISOString(),source:'Real UI and backend; AI draft response is explicitly synthetic and labelled fixture-no-model-call',checks:results,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length}
 fs.writeFileSync(out+'/ui-refresh-results.json',JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify({passed:report.passed,failed:report.failed}))
}
if(results.some(r=>!r.passed))process.exitCode=1
