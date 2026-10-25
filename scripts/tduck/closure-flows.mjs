import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import path from 'node:path'
import {allComponents} from '../../tduck-vue3/src/td/generator/config.js'
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),base=f.backend
assert.equal(base,'http://127.0.0.1:8997')
let token;const checks=[]
async function request(url,data,headers={}){return fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json())}
async function api(url,data,headers){const result=await request(url,data,headers);assert.equal(result.code,200,url+': '+result.msg);return result.data}
token=(await api('/login/account',{account:f.owner,password:f.password})).token
if(process.argv.includes('--replay')){
 const saved=JSON.parse(fs.readFileSync('.local/tduck-full-audit/closure-replay.json','utf8'))
 const result=await api('/user/form/data/public/create',saved.payload,{'X-Submission-Key':saved.session})
 assert.equal(String(result.id),String(saved.answerId));assert.equal(result.replayed,true)
 const rows=await api('/user/form/data/query',{formKey:saved.key,current:0,size:10,filter:{}});assert.equal(rows.total,saved.count)
 console.log(`Persistent receipt replay after backend restart: passed; count remains ${saved.count}.`);process.exit(0)
}
const create=await api('/user/form/create',{name:'Synthetic closure statistics '+Date.now(),type:0}),key=typeof create==='string'?create:create.formKey,ids={}
for(const [index,type] of ['RADIO','CHECKBOX','RATE','TEXTAREA'].entries()){
 const item=JSON.parse(JSON.stringify(allComponents.flatMap(g=>g.list).find(i=>i.typeId===type))),c=item.config
 c.formId=type.toLowerCase()+Date.now()+index;item.vModel=c.formId;c.required=false;ids[type]=c.formId
 await api('/user/form/item/create',{formKey:key,type,formItemId:c.formId,label:c.label,required:false,span:24,showLabel:true,scheme:item})
}
await api('/user/form/publish',{formKey:key})
const payload=(rating,text,choice=1)=>({formKey:key,formType:1,submitUa:{},completeTime:1000,originalData:{[ids.RADIO]:choice,[ids.RADIO+'label']:choice===1?'A':'B',[ids.CHECKBOX]:choice===1?[1,2]:[2],[ids.CHECKBOX+'label']:choice===1?['A','B']:['B'],[ids.RATE]:rating,[ids.TEXTAREA]:text}})
const session=randomUUID(),first=payload(4,'Synthetic original text')
const repeated=await Promise.all(Array.from({length:8},()=>api('/user/form/data/public/create',first,{'X-Submission-Key':session})))
assert.equal(new Set(repeated.map(result=>String(result.id))).size,1)
assert.equal(repeated.filter(result=>!result.replayed).length,1)
let rows=await api('/user/form/data/query',{formKey:key,current:0,size:10,filter:{}});assert.equal(rows.total,1)
checks.push('eight concurrent requests with the same session persist one answer and return the same answer ID')
const replay=await api('/user/form/data/public/create',payload(1,'Synthetic tampered retry'),{'X-Submission-Key':session})
assert.equal(String(replay.id),String(repeated[0].id));assert.equal(replay.replayed,true)
const original=(await api('/user/form/data/details/'+replay.id)).formData;assert.equal(original[ids.RATE],4);assert.equal(original[ids.TEXTAREA],'Synthetic original text')
assert.notEqual((await request('/user/form/data/public/create',first)).code,200)
assert.notEqual((await request('/user/form/data/public/create',first,{'X-Submission-Key':'bad'})).code,200)
await api('/user/form/data/public/create',payload(2,'Synthetic second text',2),{'X-Submission-Key':randomUUID()})
await api('/user/form/data/public/create',{formKey:key,formType:1,submitUa:{},originalData:{}},{'X-Submission-Key':randomUUID()})
rows=await api('/user/form/data/query',{formKey:key,current:0,size:10,filter:{}});assert.equal(rows.total,3)
checks.push('same session retry cannot overwrite answers; missing session rejected; different sessions sharing an IP remain independent')
const analysis=await api('/user/form/report/analysis?formKey='+key),rate=analysis.find(a=>a.typeCode==='RATE'),multi=analysis.find(a=>a.typeCode==='CHECKBOX'),text=analysis.find(a=>a.typeCode==='TEXTAREA'),radio=analysis.find(a=>a.typeCode==='RADIO')
assert.equal(Number(rate.mean),3);assert.equal(rate.validCount,2);assert.equal(rate.missingCount,1);assert.equal(rate.totalCount,3)
assert.equal(Number(multi.percentages.A),50);assert.equal(Number(multi.percentages.B),100);assert.equal(Number(radio.percentages.A),50);assert.equal(Number(radio.percentages.B),50)
assert.equal(text.responses.length,2);assert.ok(text.responses.every(row=>row.answerId&&row.fieldId===ids.TEXTAREA));assert.equal(text.validCount,2);assert.equal(text.missingCount,1)
checks.push('backend calculates scale mean 3 with valid denominator 2 and missing 1; checkbox percentages are 50% and 100%','open responses retain exact original text, answer ID and question ID')
const require=createRequire(path.resolve('tduck-vue3/package.json')),{chromium,expect}=require('@playwright/test'),browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(token=>localStorage.setItem('token',token),token)
 await page.goto('http://127.0.0.1:5180/project/form/statistics?key='+key)
 await page.getByRole('tab',{name:'题目统计',exact:true}).click()
 await expect(page.getByText('平均分：3',{exact:false})).toBeVisible()
 await expect(page.getByText('Synthetic original text',{exact:true})).toBeVisible()
 await expect(page.getByText('Synthetic second text',{exact:true})).toBeVisible()
 for(const width of [1440,375]){
  await page.setViewportSize({width,height:1000})
  await expect.poll(()=>page.locator('.chart-wrapper').evaluateAll(wrappers=>wrappers.every(wrapper=>{
   const chart=wrapper.querySelector('canvas'),box=wrapper.getBoundingClientRect(),drawn=chart?.getBoundingClientRect()
   return drawn&&drawn.width>0&&drawn.left>=box.left-1&&drawn.right<=box.right+1
  }))).toBe(true)
 }
 await page.setViewportSize({width:1440,height:1000})
 await page.screenshot({path:'evidence/tduck-full/13-closure-analysis.png',fullPage:true})
 await page.locator('.analysis-card').filter({hasText:'平均分：'}).scrollIntoViewIfNeeded()
 await page.screenshot({path:'evidence/tduck-full/14-scale-analysis.png',fullPage:true})
 await page.locator('.analysis-card').filter({hasText:'原始回答（'}).scrollIntoViewIfNeeded()
 await page.screenshot({path:'evidence/tduck-full/15-open-responses.png',fullPage:true})
 assert.deepEqual(errors,[])
 checks.push('statistics UI displays backend mean and traceable text without browser errors; charts fit their container at 1440px and 375px')
 const respondent=await browser.newPage()
 await respondent.goto('http://127.0.0.1:5180/s/'+key)
 await respondent.locator('.native-form textarea').fill('Synthetic browser session answer')
 await respondent.getByRole('button',{name:'提交',exact:true}).click();await respondent.getByText('提交成功',{exact:true}).waitFor()
 // 提交幂等键自版本机制修复起带发布版本后缀（tdSubmission:{key}:v{version}），按前缀读取避免耦合具体版本号
 const sessionBefore=await respondent.evaluate(()=>{const k=Object.keys(sessionStorage).find(x=>x&&x.startsWith('tdSubmission:'));return k?sessionStorage.getItem(k):null});assert.ok(sessionBefore)
 await respondent.reload();await respondent.locator('.native-form textarea').fill('Synthetic changed browser retry')
 await respondent.getByRole('button',{name:'提交',exact:true}).click();await respondent.getByText('提交成功',{exact:true}).waitFor()
 assert.equal(await respondent.evaluate(()=>{const k=Object.keys(sessionStorage).find(x=>x&&x.startsWith('tdSubmission:'));return k?sessionStorage.getItem(k):null}),sessionBefore)
 rows=await api('/user/form/data/query',{formKey:key,current:0,size:10,filter:{}});assert.equal(rows.total,4)
 const browserRecords=await Promise.all(rows.rows.map(row=>api('/user/form/data/details/'+row.id)))
 assert.equal(browserRecords.filter(row=>row.formData[ids.TEXTAREA]==='Synthetic browser session answer').length,1)
 assert.equal(browserRecords.filter(row=>row.formData[ids.TEXTAREA]==='Synthetic changed browser retry').length,0)
 checks.push('actual browser reload retains submission session; resubmitting changed text returns original success without another answer')
}finally{await browser.close()}
fs.writeFileSync('.local/tduck-full-audit/closure-replay.json',JSON.stringify({key,session,answerId:repeated[0].id,payload:first,count:4,ids}))
const report={checks,passed:checks.length,failed:0,formKey:key,source:'Synthetic fixtures, real Spring Boot/MyBatis-Plus/MySQL and browser'}
fs.writeFileSync('evidence/tduck-full/closure-flows.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
