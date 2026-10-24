import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
const require=createRequire(path.resolve('tduck-vue3/package.json')),{chromium}=require('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),{key}=JSON.parse(fs.readFileSync('.local/tduck-full-audit/smoke-form.json','utf8'))
const user=await fetch('http://127.0.0.1:8997/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:f.owner,password:f.password})}).then(r=>r.json()).then(v=>{assert.equal(v.code,200);return v.data})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[],checks=[]
await page.addInitScript(user=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user))},user)
page.on('pageerror',e=>errors.push(e.message))
try{
 await page.goto(`http://127.0.0.1:5180/project/form/data?key=${key}`)
 await page.getByRole('button',{name:'导入',exact:true}).click()
 const dialog=page.getByRole('dialog')
 const download=page.waitForEvent('download');await dialog.getByText('下载模板',{exact:true}).click()
 const source=path.resolve('.local/tduck-full-audit/import-template.xlsx'),target=path.resolve('.local/tduck-full-audit/import-synthetic.xlsx')
 await(await download).saveAs(source)
 assert.equal(fs.readFileSync(source).subarray(0,2).toString(),'PK')
 execFileSync('D:/Workspace/python312/python.exe',['scripts/tduck/import-fixture.py',source,target])
 checks.push('downloaded a valid XLSX import template through migrated UI')
 await dialog.locator('input[type=file]').setInputFiles(target)
 const imported=page.waitForResponse(r=>new URL(r.url()).pathname==='/tduck-api/user/form/data/import')
 await dialog.getByRole('button',{name:/确\s*定/}).click()
 const importResult=await(await imported).json();assert.equal(importResult.code,200,importResult.msg)
 await page.getByText('导入结果',{exact:true}).waitFor()
 await page.getByRole('dialog').getByRole('button',{name:'确定',exact:true}).click()
 await page.reload();await page.getByText('Synthetic imported response',{exact:true}).first().waitFor()
 checks.push('XLSX import through UI persists the synthetic text and choice label')
 const fields=await fetch(`http://127.0.0.1:8997/user/form/fields/${key}`,{headers:{token:user.token}}).then(r=>r.json())
 const response=await fetch('http://127.0.0.1:8997/user/form/data/export',{method:'POST',headers:{token:user.token,'Content-Type':'application/json'},body:JSON.stringify({formKey:key,columns:fields.data.map(f=>f.value),type:'csv',mode:'all',filename:'synthetic',sheetName:'Synthetic',filter:{}})})
 const csv=await response.text();assert.ok(csv.includes('Synthetic imported response'));assert.ok(csv.includes('选项二'))
 checks.push('server CSV export contains the imported answer and human choice label')
 await page.getByTitle('导出',{exact:true}).click()
 await page.getByText('导出数据',{exact:true}).waitFor()
 const button=page.locator('.vxe-table-export--panel-footer').getByRole('button',{name:'导出',exact:true});await button.waitFor()
 const [exported]=await Promise.all([page.waitForEvent('download'),button.click()])
 const exportPath=path.resolve('.local/tduck-full-audit/ui-export.xlsx');await exported.saveAs(exportPath)
 assert.ok(fs.statSync(exportPath).size>100)
 checks.push('migrated table export dialog downloads the real server export')
 await page.screenshot({path:'evidence/tduck-full/09-imported-data.png',fullPage:true})
 assert.deepEqual(errors,[])
 fs.writeFileSync('evidence/tduck-full/data-roundtrip.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2))
}catch(e){console.log(JSON.stringify({failure:e.message,checks,errors}));await page.screenshot({path:'evidence/tduck-full/data-failure.png',fullPage:true});process.exitCode=1}finally{await browser.close()}
