// Menu retirement regression. Real owner login and questionnaire CRUD; synthetic admin flag tests presentation only.
// No administrator account is changed and no administrator permission is granted.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import rootRoutes from '../../tduck-vue3/src/td/router/modules/root.js'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
const out='evidence/tduck-full/workspace-menu',base='http://127.0.0.1:8997',checks=[],errors=[]
fs.mkdirSync(out,{recursive:true});let token,key
async function api(url,data){const r=await fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,url+': '+r.msg);return r.data}
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,450)});console.log('FAIL '+name+': '+e.message.slice(0,160))}}
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const user=await api('/login/account',{account:f.owner,password:f.password});token=user.token;assert.equal(Boolean(user.admin),false)
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(user=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user))},user)
 await check('ordinary owner sees My Questionnaires and the authorized assistant entry',async()=>{
  await page.goto('http://127.0.0.1:5180/home');await expect(page.locator('.menu-view .menu-item:visible')).toHaveCount(2)
  assert.deepEqual(await page.locator('.menu-view .menu-item:visible .menu-label').allTextContents(),['我的问卷','问卷助手'])
 })
 await check('all six retired URLs return to My Questionnaires instead of loading their pages',async()=>{
  for(const route of ['template','template/category','template/preview?key=synthetic','theme/index','theme/category','recycle']){
   await page.goto('http://127.0.0.1:5180/project/'+route);await page.waitForURL('**/home')
   await expect(page.getByRole('heading',{name:'问卷概览',exact:true})).toBeVisible()
  }
 })
 await check('new questionnaire remains a real persisted editable form',async()=>{
  await page.getByRole('button',{name:'新建问卷',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'新建问卷',exact:true})
  const name='Synthetic simplified workspace '+Date.now()
  await dialog.getByPlaceholder('例如：大学生学习体验调查').fill(name)
  await dialog.getByRole('button',{name:'创建并编辑',exact:true}).click();await page.waitForURL('**/project/form/editor?**')
  key=new URL(page.url()).searchParams.get('key');assert.ok((await api('/user/form/'+key)).name.includes(name))
  await page.getByRole('button',{name:'开放题',exact:false}).click();await expect(page.locator('.question-card')).toHaveCount(1)
  await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByText('已保存',{exact:true}).first()).toBeVisible()
 })
 await check('template creation entry is removed while normal preview still works',async()=>{
  await expect(page.getByRole('button',{name:'保存至模板中心',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'预览',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
 })
 await check('per-questionnaire appearance settings are preserved',async()=>{
  await page.goto(`http://127.0.0.1:5180/project/form/theme?key=${key}`);await expect(page.getByText('外观设置',{exact:true})).toBeVisible()
 })
 await check('AI drafting and evidence report pages remain available',async()=>{
  await page.goto('http://127.0.0.1:5180/project/form/ai-draft');await expect(page.getByRole('spinbutton')).toBeVisible()
  await api('/user/form/publish',{formKey:key})
  await page.goto(`http://127.0.0.1:5180/project/form/statistics?key=${key}`)
  await page.getByRole('tab',{name:'主题与报告',exact:true}).click();await expect(page.locator('.research-workspace')).toBeVisible()
  await expect(page.getByRole('button',{name:'生成报告快照',exact:true})).toBeDisabled()
 })
 await check('ordinary owner remains blocked from both retained administration routes',async()=>{
  for(const route of ['user','system']){await page.goto('http://127.0.0.1:5180/manage/'+route);await page.waitForURL('**/home')}
  assert.deepEqual(rootRoutes.find(r=>r.path==='/manage').children.map(r=>r.path),['user','system'])
 })
 await check('administrator presentation preserves management plus the authorized assistant entry',async()=>{
  // UI-only role fixture, deliberately never used to request an admin endpoint.
  const adminPage=await browser.newPage({viewport:{width:1440,height:1000}})
  await adminPage.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',JSON.stringify({name:'Synthetic menu layout',avatar:'',admin:true}))},token)
  await adminPage.goto('http://127.0.0.1:5180/home')
  await expect(adminPage.locator('.menu-view .menu-item:visible')).toHaveCount(4)
  assert.deepEqual(await adminPage.locator('.menu-view .menu-item:visible .menu-label').allTextContents(),['我的问卷','问卷助手','用户管理','系统配置'])
  await adminPage.locator('.menu-box').screenshot({path:out+'/01-admin-menu-synthetic-state.png',animations:'disabled'})
  await adminPage.setViewportSize({width:390,height:844})
  assert.equal(await adminPage.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false)
  await adminPage.locator('.menu-view').screenshot({path:out+'/02-menu-mobile.png',animations:'disabled'});await adminPage.close()
 })
 await check('removing a synthetic questionnaire still archives it without deleting its question records',async()=>{
  const before=await api('/user/form/item/list?key='+key);assert.equal(before.length,1)
  await api('/user/form/stop',{formKey:key})
  await api('/user/form/logic/delete',{formKey:key})
  const rows=await api('/user/form/page?current=1&size=100&folderId=0&name=Synthetic%20simplified%20workspace')
  assert.ok(rows.records.every(r=>r.formKey!==key));assert.equal((await api('/user/form/item/list?key='+key)).length,1)
 })
 await check('no uncaught browser errors',async()=>{assert.deepEqual(errors,[])})
}catch(e){checks.push({name:'setup and completion',passed:false,error:e.message.slice(0,450)});console.log('FAIL '+e.message.slice(0,160))}
finally{await browser.close();const result={date:new Date().toISOString(),source:'Real ordinary-owner backend and synthetic questionnaire; admin menu screenshot uses UI-only synthetic role, no admin account changes or admin API validation',checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length};fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,failed:result.failed}));if(result.failed)process.exitCode=1}
