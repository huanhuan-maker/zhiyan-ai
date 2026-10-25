// Independent UI review: real isolated backend; only synthetic forms are created.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const fixture=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
assert.equal(fixture.backend,'http://127.0.0.1:8997')
const out='evidence/tduck-full/ui-review/home';fs.mkdirSync(out,{recursive:true})
const checks=[],errors=[];let key,token
async function api(url,data){const r=await fetch(fixture.backend+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,url+': '+r.msg);return r.data}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,450)});console.log('FAIL '+name+': '+e.message.slice(0,160))}}
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 token=(await api('/login/account',{account:fixture.owner,password:fixture.password})).token
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 page.setDefaultTimeout(6000)
 page.on('pageerror',e=>errors.push(e.message.slice(0,250)))
 await page.addInitScript(t=>localStorage.setItem('token',t),token)
 const home=async()=>{await page.goto('http://127.0.0.1:5180/home');await expect(page.locator('.project-card-item').first()).toBeVisible()}
 await home()
 await check('desktop brand remains readable on one line',async()=>{
  const brand=page.locator('.brand-copy strong')
  const size=await brand.boundingBox();assert.ok(size.height<30,'Brand wraps into a vertical column')
 })
 await check('blank creation validates and persists the exact synthetic form',async()=>{
  await page.getByRole('button',{name:'新建问卷',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'新建问卷',exact:true})
  await dialog.getByPlaceholder('例如：大学生学习体验调查').fill('')
  await dialog.getByRole('button',{name:'创建并编辑'}).click();await expect(dialog.getByText('名称不能为空')).toBeVisible()
  const name='Synthetic UI independent review '+Date.now()
  await dialog.getByPlaceholder('例如：大学生学习体验调查').fill(name)
  await dialog.getByPlaceholder('说明调查目的和填写注意事项（可选）').fill('Synthetic UI description')
  const response=page.waitForResponse(r=>r.url().includes('/user/form/create')&&r.request().method()==='POST')
  await dialog.getByRole('button',{name:'创建并编辑'}).click()
  const data=(await (await response).json()).data;key=typeof data==='string'?data:data.formKey
  await page.waitForURL('**/project/form/editor?**');assert.equal(new URL(page.url()).searchParams.get('key'),key)
  const saved=await api('/user/form/'+key);assert.ok(saved.name.includes(name));assert.equal(saved.description,'Synthetic UI description')
  return {formKey:key,type:saved.type}
 })
 await home()
 await check('card and table navigation preserve the selected form key',async()=>{
  // Existing folder rows sort before ordinary forms; locate our own record by search.
  const search=page.getByRole('textbox',{name:'搜索问卷名称',exact:true})
  const response=page.waitForResponse(r=>r.url().includes('/user/form/page')&&new URL(r.url()).searchParams.get('name')==='Synthetic UI independent review')
  await search.fill('Synthetic UI independent review');await search.press('Enter')
  const searchRows=(await (await response).json()).data.records
  if(!searchRows.some(r=>r.formKey===key))throw Error('Created synthetic form missing from search response: '+JSON.stringify({key,count:searchRows.length}))
  const card=page.locator('.project-card-item').filter({has:page.locator('.card-title',{hasText:'Synthetic UI independent review'})}).first()
  await page.screenshot({path:out+'/03-search-before-navigation.png',animations:'disabled'})
  await card.getByRole('button',{name:/数据/}).click();await page.waitForURL('**/project/form/data?**');assert.equal(new URL(page.url()).searchParams.get('key'),key)
  await home();await search.fill('Synthetic UI independent review');await search.press('Enter');await page.getByRole('button',{name:'列表视图',exact:true}).click()
  const row=page.locator('.el-table__row').filter({hasText:'Synthetic UI independent review'}).first()
  await row.getByRole('button',{name:/统计/}).click();await page.waitForURL('**/project/form/statistics?**');assert.equal(new URL(page.url()).searchParams.get('key'),key)
 })
 await home()
 await check('status filtering returns matching real backend records',async()=>{
  const response=page.waitForResponse(r=>r.url().includes('/user/form/page')&&new URL(r.url()).searchParams.get('status')==='1')
  await page.getByRole('button',{name:'待发布',exact:true}).click()
  const rows=(await (await response).json()).data.records;assert.ok(rows.length>0);assert.ok(rows.every(r=>r.status===1))
  await expect(page.getByRole('button',{name:'待发布',exact:true})).toHaveAttribute('aria-pressed','true')
 })
 await home()
 await check('list failure preserves known records and offers an explicit retry',async()=>{
  const count=await page.locator('.project-card-item').count();assert.ok(count>0)
  await page.route('**/user/form/page?*',r=>r.abort('failed'),{times:1})
  await page.getByRole('button',{name:'待发布',exact:true}).click()
  await expect(page.locator('.project-list-error')).toBeVisible()
  assert.equal(await page.locator('.project-card-item').count(),count)
  await page.locator('.project-list-error').getByRole('button',{name:'重试',exact:true}).click()
  await expect(page.locator('.project-list-error')).toHaveCount(0)
  await expect(page.locator('.card-status').first()).toHaveText('待发布')
 })
 await home()
 await check('current sort caption matches the backend ordering',async()=>{
  // The API currently orders by creation time, so the caption must not promise update ordering.
  await expect(page.locator('.page-subtitle')).not.toContainText('按最近更新排列')
 })
 await check('workbench does not present an unimplemented notification action',async()=>{
  await expect(page.getByRole('button',{name:'消息提醒',exact:true})).toHaveCount(0)
 })
 await check('390px home dialogs and list view remain usable',async()=>{
  await page.setViewportSize({width:390,height:844});await home()
  await page.getByRole('button',{name:'新建问卷',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'新建问卷',exact:true});await expect(dialog).toBeVisible()
  const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390)
  await dialog.getByRole('button',{name:'取消',exact:true}).click()
  await page.getByRole('button',{name:'列表视图',exact:true}).click()
  await expect(page.locator('.el-table__row').first()).toBeVisible()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false)
  await page.screenshot({path:out+'/01-mobile-list.png',animations:'disabled'})
 })
 await check('mobile time filter and date picker open without runtime exceptions',async()=>{
  const before=errors.length
  await page.locator('.date-btn').click();await expect(page.locator('.date-filter-panel')).toBeVisible()
  await page.getByPlaceholder('结束时间',{exact:true}).click()
  await expect(page.locator('.el-date-picker').last()).toBeVisible()
  assert.equal(errors.length,before)
  await page.screenshot({path:out+'/02-mobile-date.png',animations:'disabled'})
  await page.keyboard.press('Escape');await page.mouse.click(5,5)
 })
 await check('account menu remains accessible on mobile',async()=>{
  await home();await page.getByRole('button',{name:'账户菜单',exact:true}).click()
  await expect(page.locator('.person-menu-item').filter({hasText:'我的账户'})).toBeVisible()
  await expect(page.locator('.person-menu-item').filter({hasText:'退出登录'})).toBeVisible()
 })
 await check('no uncaught browser errors',async()=>{assert.deepEqual(errors,[])})
}finally{
 if(key)try{await api('/user/form/logic/delete',{formKey:key})}catch{}
 await browser.close()
 const r={commit:'7800e2b',source:'Real 5180/8997; synthetic blank questionnaire only; one injected network failure; no model calls',date:new Date().toISOString(),checks,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length}
 fs.writeFileSync(out+'/results.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({passed:r.passed,failed:r.failed}));if(r.failed)process.exitCode=1
}
