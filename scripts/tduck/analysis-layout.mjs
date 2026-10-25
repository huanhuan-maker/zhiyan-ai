// Additional data workspace regression: toolbar and version loading, real backend and synthetic fixture.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
const run=JSON.parse(fs.readFileSync('.local/tduck-ui-review/analysis-run.json','utf8')),checks=[]
const login=await fetch('http://127.0.0.1:8997/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:f.owner,password:f.password})}).then(r=>r.json());assert.equal(login.code,200)
const browser=await chromium.launch({channel:'msedge',headless:true})
const out='evidence/tduck-full/analysis'
try {
 const p=await browser.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(8000)
 await p.addInitScript(t=>localStorage.setItem('token',t),login.data.token)
 async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,400)});console.log('FAIL '+name+': '+e.message.slice(0,150))}}
 await p.goto('http://127.0.0.1:5180/project/form/data?key='+run.key)
 await expect(p.locator('.vxe-body--row').first()).toBeVisible()
 await check('390px toolbar buttons remain above the table header without overlapping',async()=>{
  const bounds=await p.locator('.answer-data-table').evaluate(root=>{
   const header=root.querySelector('.vxe-table--header-wrapper').getBoundingClientRect()
   return {headerTop:header.top,buttons:[...root.querySelectorAll('.vxe-toolbar button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>({title:b.getAttribute('title')||b.textContent.trim(),bottom:b.getBoundingClientRect().bottom}))}
  })
  assert.ok(bounds.buttons.length>5);assert.ok(bounds.buttons.every(b=>b.bottom<=bounds.headerTop+1),JSON.stringify(bounds))
 })
 await check('switching data version queries exactly that backend version',async()=>{
  const response=p.waitForResponse(r=>r.url().includes('/user/form/data/query')&&r.request().method()==='POST'&&r.request().postDataJSON()?.versionNo===1)
  await p.locator('.data-version-bar .el-select').click();await p.getByRole('option',{name:/V1（/}).click()
  const body=await(await response).json();assert.equal(body.code,200);assert.equal(body.data.total,4)
 })
 await check('version request failure blocks the table until an explicit retry succeeds',async()=>{
  await p.route('**/user/form/versions?*',r=>r.abort('failed'),{times:1})
  await p.reload();await expect(p.getByText('答卷版本或字段加载失败，请重试',{exact:true})).toBeVisible();await expect(p.locator('.answer-data-table')).toHaveCount(0)
  await p.getByRole('button',{name:'重试加载答卷',exact:true}).click();await expect(p.locator('.vxe-body--row').first()).toBeVisible()
  await p.mouse.move(1,843);await expect(p.locator('.el-message:visible')).toHaveCount(0,{timeout:10000})
  await p.screenshot({path:out+'/06-data-mobile.png',animations:'disabled'})
 })
}finally{await browser.close();const result={date:new Date().toISOString(),source:'Real browser/backend; synthetic answers; one version-request network failure',checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length};fs.writeFileSync(out+'/layout-results.json',JSON.stringify(result,null,2)+'\n');if(result.failed)process.exitCode=1}
