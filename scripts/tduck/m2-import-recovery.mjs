// M2 import recovery regressions: explicit synthetic AI, real isolated persistence.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
if(f.backend!=='http://127.0.0.1:8997')throw Error('Unexpected backend')
let token;const checks=[],created=[]
async function api(url,data){const r=await fetch(f.backend+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());if(r.code!==200)throw Error(url+': '+r.msg);return r.data}
token=(await api('/login/account',{account:f.owner,password:f.password})).token
const browser=await chromium.launch({channel:'msedge',headless:true})
const out='evidence/tduck-full/import-recovery',run=Date.now();fs.mkdirSync(out,{recursive:true})
function fixture(name,revision='A'){return {kind:'draft',mode:'MOCK',provider:'Synthetic independent review fixture',model:'no-model',elapsedMs:1,title:`Synthetic review ${name} ${run}`,description:'Introduction '+revision,questions:[{type:'RADIO',label:'Stable question label',required:true,options:revision==='A'?['Old A','Old B']:['New X','New Y']},{type:'TEXTAREA',label:'Open question',required:true,placeholder:'Placeholder '+revision}],warnings:[],assumptions:[],dimensions:[]}}
async function start(name){
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addInitScript(t=>localStorage.setItem('token',t),token)
 const p=await context.newPage();p.setDefaultTimeout(10000)
 const state={draft:fixture(name),creates:0,itemRequests:0,failSecond:true,loseFirst:false,key:''}
 await p.route('**/tduck-api/user/form/ai/draft*',r=>r.fulfill({json:{code:200,data:state.draft}}))
 await p.route('**/tduck-api/user/form/create*',async r=>{state.creates++;const response=await r.fetch();const data=(await response.json()).data;state.key=typeof data==='string'?data:data.formKey;created.push(state.key);await r.fulfill({response})})
 await p.route('**/tduck-api/user/form/item/create*',async r=>{
  state.itemRequests++
  if(state.loseFirst&&state.itemRequests===1){await r.fetch();await r.abort('failed');return}
  if(state.failSecond&&state.itemRequests===2){state.failSecond=false;await r.fulfill({json:{code:500,msg:'Synthetic interruption'}});return}
  await r.continue()
 })
 await p.goto('http://127.0.0.1:5180/project/form/ai-draft')
 await p.getByPlaceholder('例：我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人').fill('Synthetic independent review')
 await p.getByPlaceholder('例：在校大学生').fill('Synthetic audience')
 await p.getByRole('spinbutton').fill('2')
 return {context,p,state}
}
async function generate(p){const response=p.waitForResponse(r=>r.url().includes('/user/form/ai/draft'));await p.getByRole('button',{name:'生成草稿',exact:true}).click();await response;await expect(p.locator('.question-item')).toHaveCount(2);await expect(p.getByRole('button',{name:'生成草稿',exact:true})).toBeEnabled()}
const importBtn=p=>p.getByRole('button',{name:'导入编辑器继续编辑',exact:true})
async function interrupt(p){await importBtn(p).click();await expect(p.locator('.el-message--error').filter({hasText:'续传'})).toBeVisible();await expect(importBtn(p)).not.toHaveClass(/is-loading/)}
async function finish(p){await importBtn(p).click();await p.waitForURL('**/project/form/editor?**');await expect(p.locator('.question-card')).toHaveCount(2)}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail})}catch(e){checks.push({name,passed:false,error:String(e.message).slice(0,650)})}}
try{
 await check('regeneration with same title/labels but new options imports the new content',async()=>{
  const {context,p,state}=await start('regenerate')
  try{
   await generate(p);await interrupt(p);const originalKey=state.key
   state.draft=fixture('regenerate','B');await generate(p)
   await expect(p.locator('.option-list')).toContainText('New X');await finish(p)
   const key=new URL(p.url()).searchParams.get('key'),items=await api('/user/form/item/list?key='+key),form=await api('/user/form/'+key)
   const actual={originalKey,importedKey:key,creates:state.creates,description:form.description,containsNewOption:JSON.stringify(items).includes('New X'),containsOldOption:JSON.stringify(items).includes('Old A')}
   await p.screenshot({path:out+'/01-regenerated-content.png',animations:'disabled'})
   if(form.description!=='Introduction B'||!actual.containsNewOption)throw Error('Imported stale content: '+JSON.stringify(actual))
   return actual
  }finally{await context.close()}
 })
 await check('temporary network failure while checking resumable form does not create another form',async()=>{
  const {context,p,state}=await start('retry-network')
  try{
   await generate(p);await interrupt(p);const originalKey=state.key
   let lookupAttempted=false
   await p.route(url=>url.pathname==='/tduck-api/user/form/'+originalKey,async r=>{lookupAttempted=true;await r.abort('failed')},{times:1})
   await importBtn(p).click()
   await expect.poll(()=>lookupAttempted).toBe(true)
   await expect(importBtn(p)).not.toHaveClass(/is-loading/)
   const old=await api('/user/form/item/list?key='+originalKey)
   await expect(p.locator('.el-message--error').filter({hasText:'暂时无法确认'})).toBeVisible()
   await p.screenshot({path:out+'/02-network-interruption.png',animations:'disabled'})
   const actual={creates:state.creates,originalKey,currentKey:state.key,originalQuestionCount:old.length}
   if(state.creates!==1)throw Error('Duplicate form created after connection error: '+JSON.stringify(actual))
   await expect(p).toHaveURL(/\/ai-draft$/)
   const session=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('aiDraft:import')))
   if(session.formKey!==originalKey)throw Error('Resume record lost')
   await p.reload();await expect(p.locator('.question-item')).toHaveCount(2);await finish(p)
   if(state.key!==originalKey||state.creates!==1)throw Error('Retry did not resume the original form')
   const completed=await api('/user/form/item/list?key='+originalKey)
   if(completed.length!==2)throw Error('Retry did not save remaining question')
   await p.screenshot({path:out+'/03-network-recovered.png',animations:'disabled'})
   return actual
  }finally{await context.close()}
 })
 await check('lost response after first question is persisted can be retried without duplicated questions',async()=>{
  const {context,p,state}=await start('lost-response')
  try{
   state.failSecond=false;state.loseFirst=true
   await generate(p);await interrupt(p);await p.reload();await expect(p.locator('.question-item')).toHaveCount(2)
   await finish(p);const items=await api('/user/form/item/list?key='+state.key)
   if(items.length!==2||state.creates!==1)throw Error('Unexpected repeated save')
   return {creates:state.creates,itemCount:items.length}
  }finally{await context.close()}
 })
 for(const property of ['description','required','placeholder','rateMax']){
  await check('regeneration changing only '+property+' preserves the new value',async()=>{
   const {context,p,state}=await start('changed-'+property)
   try{
    if(property==='rateMax')state.draft.questions[0]={type:'RATE',label:'Stable scale label',required:true,rateMax:5}
    await generate(p);await interrupt(p)
    state.draft=structuredClone(state.draft)
    if(property==='description')state.draft.description='Changed introduction only'
    if(property==='required')state.draft.questions[0].required=false
    if(property==='placeholder')state.draft.questions[1].placeholder='Changed placeholder only'
    if(property==='rateMax')state.draft.questions[0].rateMax=7
    await generate(p);await p.reload();await expect(p.locator('.question-item')).toHaveCount(2)
    await finish(p)
    const items=await api('/user/form/item/list?key='+state.key),form=await api('/user/form/'+state.key)
    const schema=typeof items[0].scheme==='string'?JSON.parse(items[0].scheme):items[0].scheme
    const correct=property==='description'?form.description===state.draft.description:property==='required'?items[0].required===false:property==='placeholder'?items[1].placeholder===state.draft.questions[1].placeholder:schema.max===7
    if(!correct||state.creates!==2)throw Error('Changed content was reused or lost: '+property)
    return {creates:state.creates,property,newValuePreserved:true}
   }finally{await context.close()}
  })
 }
 await check('server rejection during form lookup preserves the session and permits retry',async()=>{
  const {context,p,state}=await start('lookup-rejected')
  try{
   await generate(p);await interrupt(p);const key=state.key
   await p.route(url=>url.pathname==='/tduck-api/user/form/'+key,r=>r.fulfill({json:{code:403,msg:'Synthetic denied lookup'}}),{times:1})
   await importBtn(p).click();await expect(p.locator('.el-message--error').filter({hasText:'暂时无法确认'})).toBeVisible()
   await expect(importBtn(p)).not.toHaveClass(/is-loading/)
   if(state.creates!==1)throw Error('Server rejection created another form')
   await finish(p)
   if(state.key!==key||state.creates!==1)throw Error('Retry did not reuse original form')
   return {creates:state.creates,recovered:true}
  }finally{await context.close()}
 })
 await check('published resumable form is blocked instead of silently creating a replacement',async()=>{
  const {context,p,state}=await start('published')
  try{
   await generate(p);await interrupt(p);const key=state.key
   await api('/user/form/publish',{formKey:key})
   await importBtn(p).click();await expect(p.locator('.el-message--error').filter({hasText:'不再是未发布草稿'})).toBeVisible()
   await expect(importBtn(p)).not.toHaveClass(/is-loading/)
   if(state.creates!==1||(await api('/user/form/item/list?key='+key)).length!==1)throw Error('Published form or resume session changed')
   return {creates:state.creates,publishedQuestionCount:1}
  }finally{await context.close()}
 })
 await check('legacy incomplete draft identity requires review without creating another form',async()=>{
  const {context,p,state}=await start('legacy')
  try{
   await generate(p);await interrupt(p)
   await p.evaluate(d=>{const s=JSON.parse(sessionStorage.getItem('aiDraft:import'));s.draftKey=JSON.stringify([d.title,d.questions.map(q=>[q.type,q.label])]);sessionStorage.setItem('aiDraft:import',JSON.stringify(s))},state.draft)
   await importBtn(p).click();await expect(p.locator('.el-message--warning').filter({hasText:'旧版导入记录'})).toBeVisible()
   if(state.creates!==1)throw Error('Legacy identity silently created another form')
   return {creates:state.creates,reviewRequired:true}
  }finally{await context.close()}
 })
}finally{
 for(const formKey of created)try{await api('/user/form/stop',{formKey})}catch{}
 await browser.close()
 fs.writeFileSync(out+'/edge-results.json',JSON.stringify({date:new Date().toISOString(),source:'Explicit synthetic response and failure injection; real isolated backend persistence',checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length},null,2)+'\n')
 console.log(JSON.stringify(checks,null,2))
}
if(checks.some(c=>!c.passed))process.exitCode=1
