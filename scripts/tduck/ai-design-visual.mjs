import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const out='evidence/tduck-full/ai-design-assistant',checks=[]
const f=JSON.parse(fs.readFileSync('.local/assistant-simple/acceptance.json','utf8').replace(/^\uFEFF/,'')),run=JSON.parse(fs.readFileSync('.local/ai-design/run.json','utf8'))
const login=await fetch('http://127.0.0.1:8997/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:f.owner,password:f.password})}).then(r=>r.json());assert.equal(login.code,200);const user=login.data
const fixture={ownerKey:createHash('sha256').update(user.token).digest('hex'),form:{goal:run.input.goal,audience:run.input.audience,extra:'视觉验收合成题目',questionCount:4},result:{kind:'draft',title:run.input.title,description:'视觉验收合成题目，不写库',questions:run.input.questions,mode:'MOCK',model:'synthetic-no-model',provider:'明确标注的合成测试题',elapsedMs:1}}
const browser=await chromium.launch({channel:'msedge',headless:true})
const luminance=rgb=>{const c=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*c[0]+.7152*c[1]+.0722*c[2]}
async function contrast(locator){const colors=await locator.evaluate(el=>{let parent=el,bg;do{bg=getComputedStyle(parent).backgroundColor;parent=parent.parentElement}while(bg==='rgba(0, 0, 0, 0)'&&parent);return {text:getComputedStyle(el).color,bg}});const a=luminance(colors.text),b=luminance(colors.bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
try{
 for(const theme of ['dark','light'])for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}}),page=await context.newPage()
  await page.addInitScript(({user,fixture,theme})=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user));localStorage.setItem('zhiyan-workbench-theme',theme);sessionStorage.setItem('aiDraft:last',JSON.stringify(fixture))},{user,fixture,theme})
  await page.route(url=>url.pathname.endsWith('/user/form/ai/optimize-question'),r=>r.fulfill({json:{code:200,data:run.optimization}}));await page.route(url=>url.pathname.endsWith('/user/form/ai/review-survey'),r=>r.fulfill({json:{code:200,data:run.review}}))
  await page.goto('http://127.0.0.1:5180/project/form/ai-draft');await expect(page.locator('.question-item')).toHaveCount(4)
  for(const mode of ['optimization','review']){
   if(mode==='optimization'){await page.locator('.question-item').first().getByRole('button',{name:'AI 优化',exact:true}).click();await page.getByRole('dialog',{name:'AI 单题优化',exact:true}).getByRole('button',{name:'生成优化建议',exact:true}).click()}else{await page.getByRole('button',{name:'问卷体检',exact:true}).click();await page.getByRole('dialog',{name:'问卷体检',exact:true}).getByRole('button',{name:'开始体检',exact:true}).click()}
   const dialog=page.getByRole('dialog',{name:mode==='optimization'?'AI 单题优化':'问卷体检',exact:true});await expect(dialog.getByTestId(mode==='optimization'?'optimization-model':'review-model')).toBeVisible()
   const titleContrast=await contrast(dialog.locator('.el-dialog__title'));assert.ok(titleContrast>=4.5,`${theme} title contrast ${titleContrast}`)
   let tagContrast;if(mode==='review'){tagContrast=await contrast(dialog.locator('.design-issue-tags .design-category').first());assert.ok(tagContrast>=4.5,`${theme} tag contrast ${tagContrast}`);assert.ok((await dialog.locator('.design-category').first().boundingBox()).width>=48)}
   assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false)
   await page.screenshot({path:`${out}/visual-${theme}-${mobile?'mobile':'desktop'}-${mode}.png`})
   checks.push({name:`${theme} ${mobile?'390px':'desktop'} ${mode}`,passed:true,titleContrast:Number(titleContrast.toFixed(2)),...(tagContrast?{tagContrast:Number(tagContrast.toFixed(2))}:{})})
   await dialog.getByRole('button',{name:mode==='optimization'?'取消':'关闭',exact:true}).click()
  }
  await context.close()
 }
}catch(error){checks.push({name:'visual assertion',passed:false,error:error.message});process.exitCode=1}finally{await browser.close();fs.writeFileSync(out+'/visual.json',JSON.stringify({date:new Date().toISOString(),source:'Actual Edge rendering, replayed validated real model candidates/review, local session fixture only. No survey or account workspace writes. Titles/tags require contrast >=4.5 and dialog has no horizontal overflow.',checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,notRun:8-checks.length},null,2)+'\n')}
console.log(JSON.stringify({passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,notRun:8-checks.length}))
