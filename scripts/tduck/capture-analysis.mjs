// Refresh the real-model demonstration from already-verified synthetic evidence only.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
const run=JSON.parse(fs.readFileSync('.local/tduck-ui-review/analysis-run.json','utf8')),base='http://127.0.0.1:8997',out='evidence/tduck-full/analysis'
let token
async function api(url,data){const r=await fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,url+': '+r.msg);return r.data}
token=(await api('/login/account',{account:f.owner,password:f.password})).token
const form=await api('/user/form/'+run.key);assert.ok(form.name.includes('Synthetic M4-R'))
const snapshot=await api(`/user/form/research/snapshot?formKey=${run.key}&version=2`)
assert.ok(snapshot.evidence.length>1&&snapshot.evidence.every(e=>e.text.includes('Synthetic')),'Only the known synthetic fixture may be sent')
const report=await api('/user/form/research/reports',{formKey:run.key,version:2,mode:'REAL',allowModelTransfer:true,snapshotFingerprint:snapshot.fingerprint})
assert.equal(report.dataChanged,false);assert.equal(report.status,'PENDING');assert.ok(report.output.themes.every(t=>t.evidenceIds.every(id=>report.snapshot.evidence.some(e=>e.id===id))))
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(8000)
 await page.addInitScript(t=>localStorage.setItem('token',t),token)
 await page.goto('http://127.0.0.1:5180/project/form/statistics?key='+run.key)
 await page.getByRole('tab',{name:'主题与报告',exact:true}).click()
 await expect(page.locator('.research-workspace')).toHaveAttribute('data-report-id',report.id)
 await expect(page.locator('.research-workspace .el-loading-mask')).toHaveCount(0)
 await expect(page.locator('.stale-report')).toHaveCount(0)
 await page.locator('.research-panel').filter({has:page.getByRole('heading',{name:/候选归纳与解释/})}).scrollIntoViewIfNeeded()
 await page.screenshot({path:out+'/03-model-report-desktop.png',animations:'disabled'})
 const response=await fetch(`${base}/user/form/research/reports/${report.id}/export?format=markdown`,{headers:{token}});assert.equal(response.status,200)
 fs.writeFileSync(out+'/current-model-report.md',await response.text())
 const metadata={date:new Date().toISOString(),source:'Actual configured provider, known synthetic evidence only, fresh snapshot; left pending for human review',formKey:run.key,reportId:report.id,version:2,answerCount:report.snapshot.answerCount,provider:report.provider,model:report.model,status:report.status,url:'http://localhost:5180/project/form/statistics?key='+run.key,themes:report.output.themes}
 fs.writeFileSync(out+'/demo.json',JSON.stringify(metadata,null,2)+'\n')
 console.log(JSON.stringify({reportId:report.id,answers:report.snapshot.answerCount,model:report.model,themes:report.output.themes.length,status:report.status}))
}finally{await browser.close()}
