// M2 user-reported regressions. Synthetic AI responses are explicitly labelled;
// imports, publish, answers and statistics use the real isolated backend.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(path.resolve('tduck-vue3/package.json'))
const {chromium,expect}=require('@playwright/test')
const fixture=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
if(fixture.backend!=='http://127.0.0.1:8997')throw Error('Only isolated backend 8997 is allowed')
const out='evidence/tduck-full/usability';fs.mkdirSync(out,{recursive:true})
const checks=[],errors=[];let token
async function api(url,data,headers={}){
 const response=await fetch(fixture.backend+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})})
 const body=await response.json();if(body.code!==200)throw Error(url+': '+body.msg);return body.data
}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,350)});console.log('FAIL '+name+': '+e.message.slice(0,160))}}
token=(await api('/login/account',{account:fixture.owner,password:fixture.password})).token
const draft={kind:'draft',mode:'MOCK',provider:'Synthetic UI test fixture',model:'fixture-no-model-call',elapsedMs:1,title:'Synthetic usability survey '+Date.now(),description:'Synthetic introduction retained for audit',assumptions:['Synthetic assumption'],dimensions:['Synthetic dimension'],warnings:[],questions:[
 {type:'RADIO',label:'Synthetic single choice',required:true,options:['A','B']},
 {type:'CHECKBOX',label:'Synthetic multiple choice',required:true,options:['A','B']},
 {type:'RATE',label:'Synthetic scale',required:true,rateMax:5},
 {type:'TEXTAREA',label:'Synthetic open question',required:true,placeholder:'Synthetic placeholder'}]}
const browser=await chromium.launch({channel:'msedge',headless:true})
let formKey,published
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 let publicPosts=0,formCreates=0
 page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/user/form/data/public/create'))publicPosts++;if(r.method()==='POST'&&r.url().includes('/user/form/create'))formCreates++})
 page.setDefaultTimeout(6000)
 page.on('pageerror',e=>errors.push(e.message.slice(0,300)))
 await page.addInitScript(t=>localStorage.setItem('token',t),token)
 await page.route('**/user/form/ai/draft*',route=>route.fulfill({json:{code:200,data:draft}}))
 await page.goto('http://127.0.0.1:5180/project/form/ai-draft')
 const number=page.getByRole('spinbutton');await number.waitFor()
 await check('question count is readable and editable with buttons/keyboard',async()=>{
  const metrics=await number.evaluate(el=>{const s=getComputedStyle(el);return {value:el.value,width:el.getBoundingClientRect().width,padding:parseFloat(s.paddingLeft)+parseFloat(s.paddingRight),fontSize:s.fontSize}})
  await number.fill('13');await number.press('Tab');await expect(number).toHaveValue('13')
  await page.locator('.el-input-number__increase').click();await expect(number).toHaveValue('14')
  await page.locator('.el-input-number__decrease').click();await expect(number).toHaveValue('13')
  if(metrics.width-metrics.padding<24)throw Error('No visible text area: '+JSON.stringify(metrics))
  await page.setViewportSize({width:390,height:844})
  const narrow=await number.evaluate(el=>{const s=getComputedStyle(el);return el.getBoundingClientRect().width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)})
  if(narrow<24)throw Error('Question count clipped on mobile')
  await page.setViewportSize({width:1440,height:1000})
  return metrics
 })
 await page.getByPlaceholder('例：我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人').fill('Synthetic takeout survey')
 await page.getByPlaceholder('例：在校大学生').fill('Synthetic college students')
 await number.fill('4');await page.getByRole('button',{name:'生成草稿',exact:true}).click()
 await expect(page.locator('.question-item')).toHaveCount(4)
 await page.locator('.question-item .el-tag').first().evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished))})
 await page.screenshot({path:out+'/01-generated.png',fullPage:true})
 await check('generated questions and bottom actions can be reached by scrolling',async()=>{
  await page.setViewportSize({width:1440,height:720})
  await page.locator('.ai-draft-container').evaluate(el=>{el.scrollTop=el.scrollHeight})
  const box=await page.getByRole('button',{name:'导入编辑器继续编辑'}).boundingBox()
  if(!box||box.y<0||box.y+box.height>720)throw Error('Bottom actions are outside the viewport after scrolling')
  await page.setViewportSize({width:1440,height:1000})
 })
 await check('AI draft has a working answer preview before importing',async()=>{
  const own=page.getByRole('button',{name:'预览答题效果',exact:true})
  if(await own.count())await own.click();else await page.locator('.form-editor-header .header-right button').first().click()
  const dialog=page.getByRole('dialog').last()
  await expect(dialog.locator('.native-form')).toBeVisible({timeout:3000})
  await expect(dialog).toContainText('Synthetic single choice')
  await dialog.locator('.el-radio').first().click()
  await dialog.locator('.el-checkbox').first().click()
  await dialog.locator('.el-rate__item').nth(3).click()
  await dialog.locator('textarea').fill('Synthetic preview only')
  await dialog.getByRole('button',{name:'提交',exact:true}).click()
  if(publicPosts!==0||formCreates!==0)throw Error('Preview unexpectedly writes a form or answer')
  await page.screenshot({path:out+'/02-preview.png',fullPage:true})
 })
 if(await page.getByRole('dialog').count())await page.keyboard.press('Escape')
 await check('AI page does not expose project-only publish/template/navigation actions',async()=>{
  if(await page.locator('.form-editor-sidebar:visible').count())throw Error('Project editor navigation exists without a project key')
  if(await page.getByRole('button',{name:'保存至模板中心'}).isVisible())throw Error('Template action exists without a project key')
 })
 await page.getByRole('button',{name:'导入编辑器继续编辑'}).click()
 await page.waitForURL('**/project/form/editor?**');formKey=new URL(page.url()).searchParams.get('key')
 await check('imported draft opens four editable questions and survives reload',async()=>{
  await expect(page.locator('.question-card')).toHaveCount(4)
  await page.reload();await expect(page.locator('.question-card')).toHaveCount(4)
  const form=await api('/user/form/'+formKey);if(Number(form.status)!==1)throw Error('Imported form is not a draft')
 })
 await check('AI description survives import',async()=>{
  const form=await api('/user/form/'+formKey);if(form.description!==draft.description)throw Error('Generated introduction is lost: '+JSON.stringify(form.description))
 })
 await check('editor preview shows the imported questions',async()=>{
  await page.locator('.form-editor-header .header-right button').first().click()
  const dialog=page.getByRole('dialog').last();await dialog.getByText('电脑',{exact:true}).click()
  await expect(dialog.locator('.native-form')).toBeVisible();await expect(dialog).toContainText('Synthetic open question')
  await page.keyboard.press('Escape')
 })
 await check('stop then reopen editor permits drafting the next version',async()=>{
  published=await api('/user/form/publish',{formKey});await api('/user/form/stop',{formKey})
  await page.reload();await expect(page.locator('.question-card')).toHaveCount(4)
  await expect(page.locator('.designer-title').getByRole('button',{name:'保存',exact:true})).toBeEnabled({timeout:2000})
 })
 await check('public submit and backend statistics match real four-type answers',async()=>{
  published=await api('/user/form/publish',{formKey})
  const p=await browser.newPage();await p.goto(`http://127.0.0.1:5180/s/${formKey}?t=${published.shareToken}`)
  await p.locator('.native-form .el-radio').first().click();await p.locator('.native-form .el-checkbox').first().click()
  await p.locator('.native-form .el-rate__item').nth(3).click();await p.locator('.native-form textarea').fill('Synthetic actual answer')
  await p.getByRole('button',{name:'提交',exact:true}).click();await p.getByText('提交成功',{exact:true}).waitFor()
  const analysis=await api(`/user/form/report/analysis?formKey=${formKey}&version=${published.versionNo}`)
  const scale=analysis.find(a=>a.typeCode==='RATE');if(scale.totalCount!==1||Number(scale.mean)!==4)throw Error('Scale count/mean mismatch')
  await p.close()
 })
 await check('browser has no uncaught errors',async()=>{if(errors.length)throw Error(errors.join('; '))})
}finally{
 if(formKey)try{await api('/user/form/stop',{formKey})}catch{}
 await browser.close()
 const report={date:new Date().toISOString(),source:'Synthetic UI response fixture; real Spring Boot/MySQL import, publish and submission',formKey,checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length}
 fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed,formKey}))
}
if(checks.some(c=>!c.passed))process.exitCode=1
