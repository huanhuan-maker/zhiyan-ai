// A separate synthetic respondent verifies the real-model demo; never touches user's tab/session.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const demo=JSON.parse(fs.readFileSync('.local/tduck-full-audit/m3-demo-real.json','utf8')),out='evidence/tduck-full/m3-visibility'
const b=await chromium.launch({channel:'msedge',headless:true});let sample;const checks=[]
try{
 const p=await b.newPage({viewport:{width:1200,height:950}})
 await p.goto(demo.publicUrl);await expect(p.locator('.followup-consent')).toContainText('真实模型')
 await expect(p.getByRole('checkbox',{name:'我同意参与可选追问'})).toBeEnabled();await p.locator('.followup-consent .el-checkbox').click()
 const row=p.locator('[data-question-type="TEXTAREA"]').first();await row.locator('textarea').first().fill('食堂不太方便')
 const response=p.waitForResponse(r=>r.url().includes('/followup/decide'),{timeout:20000});await row.getByRole('button',{name:'查看可选追问',exact:true}).click()
 const raw=await(await response).json();assert.equal(raw.code,200);const d=raw.data
 sample={provider:d.provider,model:d.model,action:d.action,state:d.state,reasonCode:d.reasonCode,elapsedMs:d.elapsedMs,sourceAnswerId:d.sourceAnswerId}
 assert.equal(d.state,'ASKED');assert.ok(['CLARIFY','DEEPEN','EXPLORE'].includes(d.action));assert.ok('食堂不太方便'.includes(d.evidenceQuote))
 await expect(row.locator('.followup-question')).toBeVisible();checks.push('fresh real-model demo displays an actual answerable followup for synthetic input')
 await row.screenshot({path:out+'/03-real-model-question.png',animations:'disabled'})
 await row.getByRole('button',{name:'跳过追问',exact:true}).click();await expect(row).toContainText('已跳过');checks.push('real generated question remains optional and can be skipped')
}catch(e){checks.push({failure:e.message.slice(0,300)});process.exitCode=1}
finally{await b.close();fs.writeFileSync(out+'/real-demo-results.json',JSON.stringify({date:new Date().toISOString(),source:'Actual configured model; synthetic answer in a separate browser session; original demo/session unchanged',formKey:demo.formKey,sample,checks,passed:checks.filter(x=>typeof x==='string').length,failed:checks.filter(x=>typeof x!=='string').length},null,2)+'\n');console.log(JSON.stringify({sample,checks}))}
