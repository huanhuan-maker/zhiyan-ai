// Real browser and backend. Synthetic survey created by analysis-api.mjs; one injected network failure.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
const run=JSON.parse(fs.readFileSync('.local/tduck-ui-review/analysis-run.json','utf8'))
const expectedCount=run.snapshot.answerCount,expectedMean=run.snapshot.statistics.find(q=>q.typeCode==='RATE').mean
const base='http://127.0.0.1:8997',out='evidence/tduck-full/analysis',checks=[],errors=[]
let token,reportId=run.reportId
async function api(url,data,headers={}){const r=await fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(r.code,200,url+': '+r.msg);return r.data}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,450)});console.log('FAIL '+name+': '+e.message.slice(0,180))}}
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 token=(await api('/login/account',{account:f.owner,password:f.password})).token
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.setDefaultTimeout(8000)
 page.on('pageerror',e=>errors.push(e.message.slice(0,250)))
 await page.addInitScript(t=>localStorage.setItem('token',t),token)
 const home=async()=>{await page.goto('http://127.0.0.1:5180/project/form/statistics?key='+run.key);await expect(page.locator('.analysis-scope')).toContainText('V2')}
 const research=async()=>{await page.getByRole('tab',{name:'主题与报告',exact:true}).click();await expect(page.locator('.research-workspace')).toHaveAttribute('data-report-id',/.+/);await expect(page.locator('.research-workspace .el-loading-mask')).toHaveCount(0)}
 await home()
 await check('ECharts renders selected-version backend facts and labels the denominator',async()=>{
  await expect(page.locator('.analysis-scope')).toContainText(`本版本答卷 ${expectedCount} 份`)
  await expect(page.locator('.analysis-card').filter({hasText:'整体体验评分'})).toContainText('平均分：'+expectedMean)
  assert.ok(await page.locator('.analysis-card canvas').count()>=3)
  await page.screenshot({path:out+'/01-statistics-desktop.png',animations:'disabled'})
 })
 await check('version switching changes numerical statistics and preserves URL form key',async()=>{
  await page.locator('.statistics-version .el-select').click();await page.getByRole('option',{name:/V1 ·/}).click()
  await expect(page.locator('.analysis-scope')).toContainText('V1 · 本版本答卷 4 份')
  await page.locator('.statistics-version .el-select').click();await page.getByRole('option',{name:/V2 ·/}).click()
  await expect(page.locator('.analysis-scope')).toContainText(`V2 · 本版本答卷 ${expectedCount} 份`)
  assert.equal(new URL(page.url()).searchParams.get('key'),run.key)
 })
 await research()
 await check('saved report and coverage load from real backend after opening the new tab',async()=>{
  await expect(page.locator('.research-workspace')).toHaveAttribute('data-report-id',reportId)
  await expect(page.getByTestId('report-answer-count')).toHaveText(String(expectedCount))
  await expect(page.locator('.coverage-note')).toContainText('主题计数')
 })
 await check('actual model report can be selected and every evidence dialog shows stored source coordinates',async()=>{
  await page.locator('.report-selector .el-select').click();await page.getByRole('option',{name:/模型归纳/}).first().click()
  await expect(page.locator('.research-workspace')).toHaveAttribute('data-report-id',run.realReportId)
  await page.locator('.theme-card').first().getByRole('button',{name:/查看证据 E/}).first().click()
  const dialog=page.getByRole('dialog',{name:'原文证据定位'});await expect(dialog).toContainText(run.ids.TEXTAREA)
  await expect(dialog).toContainText('核心开放回答');await expect(dialog.locator('blockquote')).toHaveText(run.snapshot.evidence[0].text)
  assert.equal(await page.evaluate(()=>window.analysisXss),undefined)
  await page.screenshot({path:out+'/02-evidence-desktop.png',animations:'disabled'})
  await dialog.locator('.el-dialog__headerbtn').click()
  await expect(dialog).not.toBeVisible()
  await page.screenshot({path:out+'/03-model-report-desktop.png',animations:'disabled'})
  await page.locator('.report-selector .el-select').click();await page.getByRole('option',{name:/本地分组/}).first().click()
  await expect(page.locator('.research-workspace')).toHaveAttribute('data-report-id',reportId)
 })
 await check('real model generation requires transfer acknowledgment and local grouping needs none',async()=>{
  await page.locator('.el-radio-button').filter({hasText:'真实模型归纳'}).click()
  await expect(page.getByRole('button',{name:'生成报告快照',exact:true})).toBeDisabled()
  await page.locator('.transfer-consent').click()
  await expect(page.getByRole('button',{name:'生成报告快照',exact:true})).toBeEnabled()
  await page.locator('.el-radio-button').filter({hasText:'本地相同回答分组'}).click()
 })
 await check('review note persists after a full browser refresh',async()=>{
  await page.getByRole('button',{name:'审核此报告',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'审核报告',exact:true})
  await dialog.getByRole('textbox',{name:'审核说明'}).fill('Synthetic UI review: 已核对原文、分母和本地分组范围。')
  await dialog.getByRole('button',{name:'保存审核'}).click();await expect(dialog).toHaveCount(0)
  await expect(page.locator('.review-history')).toContainText('Synthetic UI review')
  await page.reload();await expect(page.locator('.analysis-scope')).toBeVisible();await research()
  await expect(page.locator('.review-history')).toContainText('Synthetic UI review')
 })
 await check('Markdown and JSON download through authenticated endpoints with safe raw-answer escaping',async()=>{
  const [downloaded]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出 Markdown',exact:true}).click()])
  const target='.local/tduck-ui-review/ui-report.md';await downloaded.saveAs(target)
  const text=fs.readFileSync(target,'utf8');assert.ok(text.includes('&lt;img'));assert.ok(!text.includes('<img'));assert.ok(text.includes(reportId))
  const [jsonDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出 JSON',exact:true}).click()])
  await jsonDownload.saveAs('.local/tduck-ui-review/ui-report.json');const r=JSON.parse(fs.readFileSync('.local/tduck-ui-review/ui-report.json','utf8'));assert.equal(r.id,reportId);assert.equal(r.snapshot.answerCount,expectedCount)
 })
 await check('generation network failure retains selected saved report and supports recovery',async()=>{
  await page.route('**/user/form/research/reports?*',r=>r.request().method()==='POST'?r.abort('failed'):r.continue(),{times:1})
  await page.getByRole('button',{name:'生成报告快照',exact:true}).click()
  await expect(page.locator('.research-error')).toBeVisible()
  await expect(page.locator('.research-workspace')).toHaveAttribute('data-report-id',reportId)
  await page.getByRole('button',{name:'刷新数据与报告',exact:true}).click();await expect(page.locator('.research-error')).toHaveCount(0)
 })
 await check('new submission is flagged as changed and prevents approving an outdated snapshot',async()=>{
  const publication=(await api('/user/form/versions?key='+run.key)).find(v=>v.versionNo===2)
  // The share capability is read only from the owner's published metadata, never written to evidence.
  assert.ok(publication?.shareToken);const versionInfo=publication
  await api('/user/form/data/public/create',{formKey:run.key,formType:0,versionToken:versionInfo.shareToken,originalData:{[run.ids.TEXTAREA]:'Synthetic UI additional: 晚间图书馆座位不足，希望增加座位。',[run.ids.RATE]:3},submitUa:{}},{'X-Submission-Key':randomUUID()})
  await page.getByRole('button',{name:'刷新数据与报告',exact:true}).click();await expect(page.locator('.stale-report')).toBeVisible()
  await page.getByRole('button',{name:'审核此报告',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'审核报告',exact:true});await expect(dialog.getByRole('radio',{name:'通过',exact:true})).toBeDisabled()
  await dialog.getByRole('button',{name:'取消',exact:true}).click()
 })
 await check('regeneration creates a new report and refreshed facts without losing history',async()=>{
  const before=reportId
  await page.getByRole('button',{name:'生成报告快照',exact:true}).click()
  await expect(page.getByTestId('report-answer-count')).toHaveText(String(expectedCount+1))
  reportId=await page.locator('.research-workspace').getAttribute('data-report-id');assert.notEqual(reportId,before)
  await expect(page.locator('.stale-report')).toHaveCount(0)
  const history=await api(`/user/form/research/reports?formKey=${run.key}&version=2`);assert.ok(history.some(r=>r.id===before))
 })
 await check('390px report and source dialog stay usable without document overflow or XSS',async()=>{
  await page.setViewportSize({width:390,height:844})
  await page.locator('.statistics-workspace').evaluate(el=>el.scrollTop=0)
  await page.mouse.move(1,843)
  await expect(page.locator('.el-message:visible')).toHaveCount(0,{timeout:10000})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false)
  await page.screenshot({path:out+'/04-report-mobile.png',animations:'disabled'})
  await page.locator('.theme-card').first().getByRole('button',{name:/查看证据/}).first().click()
  const dialog=page.getByRole('dialog',{name:'原文证据定位'});const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391)
  assert.equal(await page.evaluate(()=>window.analysisXss),undefined)
  await page.screenshot({path:out+'/05-evidence-mobile.png',animations:'disabled'})
  await dialog.locator('.el-dialog__headerbtn').click()
 })
 await check('answer data page preserves version selection and offers statistics navigation on mobile',async()=>{
  await page.goto('http://127.0.0.1:5180/project/form/data?key='+run.key)
  await expect(page.getByRole('heading',{name:'答卷数据',exact:true})).toBeVisible()
  await expect(page.locator('.vxe-body--row').first()).toBeVisible()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false)
  await page.screenshot({path:out+'/06-data-mobile.png',animations:'disabled'})
  await page.getByRole('button',{name:'查看统计与报告',exact:true}).click();await expect(page).toHaveURL(/project\/form\/statistics\?key=/)
 })
 await check('no uncaught browser exceptions',async()=>{assert.deepEqual(errors,[])})
 const final=await api('/user/form/research/reports/'+reportId)
 const audited=await api('/user/form/research/reports/'+run.reportId)
 fs.writeFileSync('.local/tduck-ui-review/analysis-run.json',JSON.stringify({...run,reportId:final.id,status:final.status,revision:final.revision,auditCount:final.reviews.length,snapshot:final.snapshot,audited:{id:audited.id,status:audited.status,revision:audited.revision,reviews:audited.reviews}},null,2))
}catch(e){checks.push({name:'browser setup and completion',passed:false,error:e.message.slice(0,450)});console.log('FAIL '+e.message.slice(0,180))}
finally{await browser.close();const r={date:new Date().toISOString(),source:'Real browser/backend; synthetic answers; one injected browser network failure; no new model calls',formKey:run.key,reportId,checks,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length};fs.writeFileSync(out+'/ui-results.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({passed:r.passed,failed:r.failed}));if(r.failed)process.exitCode=1}
