import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {allComponents} from '../../tduck-vue3/src/td/generator/config.js'
const require=createRequire(path.resolve('tduck-vue3/package.json')),{chromium}=require('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),base='http://127.0.0.1:5180',checks=[],errors=[]
let token
async function api(url,data){const v=await fetch('http://127.0.0.1:8997'+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(v.code,200,url+': '+v.msg);return v.data}
const user=await api('/login/account',{account:f.owner,password:f.password});token=user.token
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1500,height:1000}})
await page.addInitScript(user=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user))},user)
page.on('pageerror',e=>errors.push(e.message))
try{
 const created=await api('/user/form/create',{name:'Synthetic logic and settings '+Date.now(),type:0}),key=typeof created==='string'?created:created.formKey
 const fields=[]
 for(const type of ['RADIO','INPUT']){
  const item=JSON.parse(JSON.stringify(allComponents.flatMap(g=>g.list).find(x=>x.typeId===type))),c=item.config
  c.formId=type.toLowerCase()+Date.now();item.vModel=c.formId
  const wire={type,formItemId:c.formId,label:c.label,required:c.required,showLabel:c.showLabel,span:24,scheme:item,formKey:key};await api('/user/form/item/create',wire);fields.push(wire)
 }
 await page.goto(`${base}/project/form/logic?key=${key}`)
 await page.getByRole('button',{name:/立即添加逻辑/}).click()
 const selects=page.locator('.logic-item .el-select')
 for(const [i,name] of ['单选框组','选中','选项一','单行文本'].entries()){
  await selects.nth(i).click();await page.getByRole('option',{name,exact:true}).click()
 }
 await page.getByText('已保存',{exact:true}).waitFor()
 assert.equal((await api('/user/form/logic?formKey='+key)).scheme[0].triggerList[0].formItemId,fields[1].formItemId)
 checks.push('conditional visibility configured through Vue 3 UI and saved to real backend')
 await page.goto(`${base}/project/form/setting?key=${key}`)
 await page.getByText('自定义文案',{exact:true}).click()
 await page.getByPlaceholder('请输入自定义的提交成功提示语').fill('Synthetic custom success')
 await page.locator('.el-tab-pane:visible').getByRole('button',{name:/保存设置/}).click()
 await page.getByText('保存成功',{exact:true}).waitFor()
 await page.reload();await page.getByPlaceholder('请输入自定义的提交成功提示语').waitFor()
 assert.equal(await page.getByPlaceholder('请输入自定义的提交成功提示语').inputValue(),'Synthetic custom success')
 const setting=await api('/user/form/setting/'+key);await api('/user/form/setting/save',{...setting,formKey:key,saveNotSubmitStatus:true,passwordWriteStatus:true,writePassword:'SyntheticGate42'})
 checks.push('custom completion text survives settings save and page reload')
 await page.goto(`${base}/project/form/theme?key=${key}`)
 await page.locator('.option-line-view').filter({hasText:'按钮设置'}).locator('.el-switch').click()
 const buttonText=page.locator('.right-container').getByPlaceholder('请输入内容');await buttonText.fill('Synthetic submit');await buttonText.press('Tab')
 await page.waitForTimeout(700)
 assert.equal((await api('/user/form/theme/'+key)).submitBtnText,'Synthetic submit')
 checks.push('theme submit button text saves through the UI')
 await api('/user/form/publish',{formKey:key})
 const anon=await browser.newPage();anon.on('pageerror',e=>errors.push(e.message))
 await anon.goto(base+'/s/'+key)
 await anon.getByPlaceholder('请输入密码填写').fill('SyntheticGate42');await anon.getByRole('button',{name:'确定',exact:true}).click()
 await anon.locator('.el-radio').nth(1).click()
 assert.equal(await anon.locator('.native-form .el-input').count(),0)
 await anon.locator('.el-radio').first().click()
 await anon.locator('.native-form input[type=text]').fill('Synthetic draft persisted')
 await anon.reload();await anon.getByPlaceholder('请输入密码填写').fill('SyntheticGate42');await anon.getByRole('button',{name:'确定',exact:true}).click();await anon.locator('.native-form input[type=text]').waitFor()
 assert.equal(await anon.locator('.native-form input[type=text]').inputValue(),'Synthetic draft persisted')
 checks.push('conditional question shows only for matching choice; enabled draft restores after reload')
 await anon.getByRole('button',{name:'Synthetic submit',exact:true}).click()
 await anon.getByText('Synthetic custom success',{exact:true}).waitFor()
 assert.equal(await anon.evaluate(k=>localStorage.getItem('formData:'+k),key),null)
 checks.push('real submission applies completion text and removes the temporary draft')
 await api('/user/form/stop',{formKey:key})
 await page.goto(`${base}/project/form/editor?key=${key}`)
 await page.locator('.question-card').first().waitFor()
 assert.equal(await page.locator('.designer-title').getByRole('button',{name:'保存',exact:true}).isEnabled(),true)
 checks.push('stopped form permits editing the next draft; published versions remain separate snapshots')
 assert.deepEqual(errors,[])
 fs.writeFileSync('evidence/tduck-full/settings-flows.json',JSON.stringify({checks,errors,formKey:key},null,2));console.log(JSON.stringify({checks,errors},null,2))
}catch(e){console.log(JSON.stringify({failure:e.message,checks,errors}));await page.screenshot({path:'evidence/tduck-full/settings-failure.png',fullPage:true});process.exitCode=1}finally{await browser.close()}
