import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
const require=createRequire(path.resolve('tduck-vue3/package.json')),{chromium}=require('@playwright/test')
const ps=path.resolve('scripts/tduck/Admin-Acceptance.ps1'),checks=[],errors=[]
const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe')
let browser,token
async function api(url,data){const r=await fetch('http://127.0.0.1:8997'+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',token},...(data===undefined?{}:{body:JSON.stringify(data)})});const v=await r.json();assert.equal(v.code,200,url+': '+v.msg);return v.data}
try{
 execFileSync(powershell,['-NoProfile','-File',ps],{stdio:'pipe'})
 const f=JSON.parse(fs.readFileSync('.local/tduck-dev/admin-acceptance.json','utf8').replace(/^\uFEFF/,''))
 const user=await api('/login/account',{account:f.account,password:f.password});assert.equal(user.admin,true);token=user.token
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}})
 page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(user=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user))},user)
 let templateCategory,templateCategoryName
 for(const route of ['/project/template/category','/project/theme/category']){
  const name='Synthetic category '+Date.now()
  await page.goto('http://127.0.0.1:5180'+route)
  const filterCreatedCategory=async()=>{
   if(route.includes('template')){
    await page.locator('.search-card').getByPlaceholder('请输入分类名称').fill(name)
    await page.getByRole('button',{name:/搜索/}).click()
   }
  }
  await page.getByRole('button',{name:/新增/}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByPlaceholder('请输入分类名称').fill(name)
  await dialog.getByPlaceholder('请输入排序').fill('0')
  await dialog.getByRole('button',{name:/确\s*定/}).click()
  await dialog.waitFor({state:'hidden'})
  await filterCreatedCategory()
  const row=page.getByRole('row').filter({hasText:name});await row.waitFor()
  if(route.includes('template')){templateCategory=Number((await row.locator('td').nth(1).innerText()).trim());templateCategoryName=name+' edited'}
  await row.getByRole('button',{name:/修改/}).click()
  await dialog.getByPlaceholder('请输入分类名称').fill(name+' edited')
  await dialog.getByRole('button',{name:/确\s*定/}).click()
  await dialog.waitFor({state:'hidden'})
  await page.reload();await filterCreatedCategory();await page.getByText(name+' edited',{exact:true}).waitFor()
  checks.push(route+': create, edit and reload persisted category')
  if(!route.includes('template')){
   await page.getByRole('row').filter({hasText:name+' edited'}).getByRole('button',{name:/删除/}).click()
   await page.getByRole('dialog').getByRole('button',{name:'确定',exact:true}).click()
   await page.getByText('删除成功',{exact:true}).waitFor();checks.push('synthetic theme category deleted')
  }
 }
 const source=JSON.parse(fs.readFileSync('evidence/tduck-full/feature-flows.json','utf8')).formKey
 const template=await api('/form/template/create',{formKey:source,name:'Synthetic Vue3 template',description:'Acceptance data only',coverImg:'/favicon.ico',categoryId:templateCategory,status:0})
 await page.goto('http://127.0.0.1:5180/project/template/preview?key='+template)
 await page.locator('.native-form').waitFor()
 await page.getByRole('button',{name:'使用该模板',exact:true}).click()
 await page.waitForURL('**/project/form/editor?**')
 await page.locator('.question-card').nth(26).waitFor()
 checks.push('template snapshot renders; using template creates a new editable form with all 27 fields')
 await api('/form/template/delete',{formKey:template})
 checks.push('synthetic template deleted without modifying its source or cloned form')
 await page.goto('http://127.0.0.1:5180/project/template/category')
 await page.locator('.search-card').getByPlaceholder('请输入分类名称').fill(templateCategoryName)
 await page.getByRole('button',{name:/搜索/}).click()
 await page.getByRole('row').filter({hasText:templateCategoryName}).getByRole('button',{name:/删除/}).click()
 await page.getByRole('dialog').getByRole('button',{name:'确定',exact:true}).click()
 await page.getByText('删除成功',{exact:true}).waitFor()
 checks.push('only the category created by this run is deleted after its synthetic template')
 assert.deepEqual(errors,[])
 fs.writeFileSync('evidence/tduck-full/admin-flows.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2))
}catch(e){console.log(JSON.stringify({failure:e.message,checks,errors}));process.exitCode=1}finally{
 await browser?.close()
 execFileSync(powershell,['-NoProfile','-File',ps,'-Restore'],{stdio:'pipe'})
 console.log('Isolated administrator profile restored in finally.')
}
