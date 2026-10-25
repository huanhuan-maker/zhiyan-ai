// User's 13-question scenario: real AI and real isolated backend, synthetic answers.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
if(f.backend!=='http://127.0.0.1:8997')throw Error('Unexpected backend')
let token,formKey;const checks=[]
async function api(url,data){const r=await fetch(f.backend+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());if(r.code!==200)throw Error(url+': '+r.msg);return r.data}
token=(await api('/login/account',{account:f.owner,password:f.password})).token
const browser=await chromium.launch({channel:'msedge',headless:true})
const out='evidence/tduck-full/usability';let sample
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});p.setDefaultTimeout(15000)
 await p.addInitScript(t=>localStorage.setItem('token',t),token)
 // Mark only the form created by this test; actual AI generation is never intercepted.
 await p.route('**/user/form/create*',route=>{const body=route.request().postDataJSON();body.name='Synthetic real AI audit '+body.name;return route.continue({postData:JSON.stringify(body)})})
 await p.goto('http://127.0.0.1:5180/project/form/ai-draft')
 await p.getByPlaceholder('例：我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人').fill('我想知道为什么大学生喜欢校外外卖')
 await p.getByPlaceholder('例：在校大学生').fill('大学生');await p.getByRole('spinbutton').fill('13')
 const responsePromise=p.waitForResponse(r=>r.url().includes('/user/form/ai/draft')&&r.request().method()==='POST',{timeout:125000})
 await p.getByRole('button',{name:'生成草稿',exact:true}).click()
 const result=await (await responsePromise).json();if(result.code!==200)throw Error('Real AI generation: '+result.msg)
 const d=result.data;if(d.kind!=='draft'||d.mode!=='REAL')throw Error('Real provider did not produce a draft; kind='+d.kind+' mode='+d.mode)
 sample={provider:d.provider,model:d.model,elapsedMs:d.elapsedMs,questionCount:d.questions.length,types:d.questions.map(q=>q.type)}
 await expect(p.locator('.question-item')).toHaveCount(13);checks.push('real AI generated exactly 13 questions for the user takeout scenario')
 await p.locator('.question-item .el-tag').first().evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished))})
 await p.screenshot({path:out+'/03-real-13-questions.png',fullPage:true})
 await p.getByRole('button',{name:'预览答题效果',exact:true}).click()
 const preview=p.getByRole('dialog');await expect(preview.locator('.native-form > .el-form-item')).toHaveCount(13)
 await expect(preview).toBeVisible()
 await preview.locator('.el-radio').first().click()
 await p.screenshot({path:out+'/04-real-answer-preview.png',fullPage:true})
 await p.keyboard.press('Escape');checks.push('all 13 generated questions render in answer preview before database import')
 await p.getByRole('button',{name:'导入编辑器继续编辑'}).click();await p.waitForURL('**/project/form/editor?**')
 formKey=new URL(p.url()).searchParams.get('key');await expect(p.locator('.question-card')).toHaveCount(13)
 await p.reload();await expect(p.locator('.question-card')).toHaveCount(13)
 const info=await api('/user/form/'+formKey);if(info.description!==d.description)throw Error('Description changed during import')
 checks.push('13 questions and generated introduction survive real import and reload as an unpublished draft')
 // Modify, save and preview through the existing editor UI.
 const title=p.locator('.designer-info').first().locator('[contenteditable="true"]')
 await title.fill('Synthetic real AI edited survey');await title.press('Tab')
 await p.locator('.designer-title').getByRole('button',{name:'保存',exact:true}).click();await p.getByText('已保存',{exact:true}).first().waitFor()
 await p.locator('.form-editor-header .header-right button').first().click()
 await p.getByRole('dialog').getByText('电脑',{exact:true}).click()
 await expect(p.getByRole('dialog').locator('.native-form > .el-form-item')).toHaveCount(13)
 await expect(p.getByRole('dialog')).toContainText('Synthetic real AI edited survey');await p.keyboard.press('Escape')
 checks.push('human edit and save followed by editor answer preview works')
 await p.goto('http://127.0.0.1:5180/project/form/publish?key='+formKey)
 await p.locator('.publish-action-btn').click();await p.getByText('发布成功，开始收集数据吧！',{exact:true}).waitFor()
 const versions=await api('/user/form/versions?key='+formKey),version=versions[0]
 const respondent=await browser.newPage({viewport:{width:390,height:844}})
 await respondent.goto(`http://127.0.0.1:5180/s/${formKey}?t=${version.shareToken}`)
 const rows=respondent.locator('.native-form > .el-form-item');await expect(rows).toHaveCount(13)
 for(let i=0;i<13;i++){
  const row=rows.nth(i),type=await row.getAttribute('data-question-type')
  if(type==='RADIO')await row.locator('.el-radio').first().click()
  else if(type==='CHECKBOX')await row.locator('.el-checkbox').first().click()
  else if(type==='RATE')await row.locator('.el-rate__item').first().click()
  else if(['INPUT','TEXTAREA'].includes(type))await row.locator('input,textarea').fill('Synthetic acceptance response')
  else throw Error('Unexpected generated type '+type)
 }
 await respondent.getByRole('button',{name:'提交',exact:true}).click();await respondent.getByText('提交成功',{exact:true}).waitFor()
 const data=await api('/user/form/data/query',{formKey,versionNo:version.versionNo,current:0,size:10,filter:{}})
 if(data.total!==1)throw Error('Expected one persisted answer, got '+data.total)
 const analysis=await api(`/user/form/report/analysis?formKey=${formKey}&version=${version.versionNo}`)
 if(analysis.length!==13||analysis.some(q=>q.totalCount!==1))throw Error('Statistics do not match all 13 submitted answers')
 checks.push('manual UI publish, anonymous mobile completion, persistence and backend statistics work for all 13 questions')
 console.log(JSON.stringify({passed:checks.length,failed:0,sample},null,2))
}catch(e){console.log('FAIL '+e.message);process.exitCode=1;checks.push({failure:e.message.slice(0,300)})}finally{
 if(formKey)try{await api('/user/form/stop',{formKey})}catch{}
 await browser.close();fs.writeFileSync(out+'/real-flow.json',JSON.stringify({date:new Date().toISOString(),formKey,sample,checks},null,2)+'\n')
}
