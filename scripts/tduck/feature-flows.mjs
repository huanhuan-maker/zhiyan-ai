import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {allComponents} from '../../tduck-vue3/src/td/generator/config.js'
const require=createRequire(path.resolve('tduck-vue3/package.json')),{chromium}=require('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
const base='http://127.0.0.1:5180',backend='http://127.0.0.1:8997'
let token
async function api(url,data){const r=await fetch(backend+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});const v=await r.json();assert.equal(v.code,200,url+': '+v.msg);return v.data}
const user=await api('/login/account',{account:f.owner,password:f.password});token=user.token
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1600,height:1000}})
await page.addInitScript(user=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user))},user)
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message))
try{
 const form=await api('/user/form/create',{name:'Synthetic 27 question compatibility '+Date.now(),type:0})
 const key=typeof form==='string'?form:form.formKey
 assert.ok(key,'form key')
 let i=0
 for(const def of allComponents.flatMap(g=>g.list)){
  const item=JSON.parse(JSON.stringify(def)),c=item.config
  c.formId=item.typeId.toLowerCase()+Date.now()+i++;item.vModel=c.formId;c.required=false
  await api('/user/form/item/create',{type:item.typeId,formItemId:c.formId,label:c.label,required:false,showLabel:c.showLabel,span:24,displayType:c.displayType,scheme:item,formKey:key})
 }
 await page.goto(`${base}/project/form/editor?key=${key}`)
 await page.locator('.question-card').nth(26).waitFor()
 const body=page.locator('.designer-config > div > .el-form textarea').first()
 await body.fill('Synthetic title persisted');await body.press('Space');await body.press('Backspace')
 await page.getByText('有未保存修改',{exact:true}).waitFor()
 await page.getByRole('button',{name:'保存',exact:true}).click();await page.getByText('已保存',{exact:true}).first().waitFor()
 await page.reload();await page.locator('.question-card').first().getByText('Synthetic title persisted',{exact:false}).waitFor()
 assert.equal((await api('/user/form/item/list?key='+key)).length,27)
 await page.screenshot({path:'evidence/tduck-full/07-all-types-editor.png',fullPage:true})
 checks.push('27 question schemas render in native editor; rich title survives save and reload')
 await page.goto(`${base}/project/form/view?key=${key}`)
 await page.locator('.native-form').waitFor();await page.waitForTimeout(700)
 await page.screenshot({path:'evidence/tduck-full/08-all-types-preview.png',fullPage:true})
 checks.push('27 question preview loads without page errors (external SMS/upload/map providers not invoked)')
 await page.goto(base+'/manage/system');await page.waitForURL('**/home')
 checks.push('non-admin is redirected from administration')
 await api('/user/form/logic/delete',{formKey:key})
 await page.goto(base+'/project/recycle')
 await page.waitForURL('**/home')
 const archived=await api('/user/form/page?current=1&size=100&folderId=0&name=Synthetic%2027%20question%20compatibility')
 assert.ok(archived.records.every(row=>row.formKey!==key))
 assert.equal((await api('/user/form/item/list?key='+key)).length,27)
 checks.push('retired recycle page redirects home; archived questionnaire leaves the list and retains all question records')
 const smoke=JSON.parse(fs.readFileSync('.local/tduck-full-audit/smoke-form.json','utf8'))
 await page.goto(`${base}/project/form/data?key=${smoke.key}`)
 await page.getByText('Synthetic Vue 3 response',{exact:true}).click()
 const dialog=page.getByRole('dialog')
 await dialog.getByRole('button',{name:/修\s*改/}).click()
 await dialog.locator('.native-form textarea').first().fill('Synthetic edited response')
 await dialog.locator('.el-radio').nth(1).click()
 await dialog.getByRole('button',{name:/确\s*定/}).click()
 await page.getByText('修改成功',{exact:true}).waitFor()
 await page.reload();await page.getByText('Synthetic edited response',{exact:true}).waitFor()
 await page.locator('.vxe-body--row').filter({hasText:'Synthetic edited response'}).getByText('选项二',{exact:true}).waitFor()
 checks.push('answer edit validates and retains both value and choice label after reload')
 assert.deepEqual(errors,[])
 const report={checks,errors,formKey:key};fs.writeFileSync('evidence/tduck-full/feature-flows.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}catch(e){console.log(JSON.stringify({failure:e.message,errors}));await page.screenshot({path:'evidence/tduck-full/feature-failure.png',fullPage:true});process.exitCode=1}finally{await browser.close()}
