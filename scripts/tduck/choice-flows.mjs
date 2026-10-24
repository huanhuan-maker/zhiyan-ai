import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {allComponents} from '../../tduck-vue3/src/td/generator/config.js'
const require=createRequire(path.resolve('tduck-vue3/package.json')),{chromium,expect}=require('@playwright/test')
const fixture=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
assert.equal(fixture.backend,'http://127.0.0.1:8997')
let token
async function api(url,data){const result=await fetch(fixture.backend+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(result.code,200,url+': '+result.msg);return result.data}
const user=await api('/login/account',{account:fixture.owner,password:fixture.password});token=user.token
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),checks=[],errors=[]
page.on('pageerror',error=>errors.push(error.message))
await page.addInitScript(user=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user))},user)
const sourceUrl='https://synthetic-options.example.test/choices'
let attempts=0,failNext=false
await page.route(sourceUrl,route=>{
 attempts++
 if(failNext){failNext=false;return route.fulfill({status:503,contentType:'application/json',body:'{}'})}
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({payload:{entries:[{meta:{code:'alpha',text:'Synthetic Alpha'}},{meta:{code:'beta',text:'Synthetic Beta'}}]}})})
})
await page.route('https://synthetic-options.example.test/tree',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({payload:{entries:[{meta:{code:'parent',text:'Synthetic Parent'},nodes:[{meta:{code:'child',text:'Synthetic Child'}}]}]}})}))
try{
 const created=await api('/user/form/create',{name:'Synthetic advanced choice regression '+Date.now(),type:0}),key=typeof created==='string'?created:created.formKey
 const fields={}
 for(const [index,type] of ['SELECT','CASCADER','CHECKBOX','NUMBER'].entries()){
  const item=JSON.parse(JSON.stringify(allComponents.flatMap(group=>group.list).find(item=>item.typeId===type))),config=item.config
  config.formId=type.toLowerCase()+Date.now()+index;item.vModel=config.formId;fields[type]=item
  if(['SELECT','CASCADER'].includes(type)){config.optionsType=1;config.dynamicOptions={url:type==='SELECT'?sourceUrl:'https://synthetic-options.example.test/tree',dataPath:'payload.entries',valueField:'meta.code',labelField:'meta.text',childrenField:'nodes'}}
  if(type==='CHECKBOX')config.options=[{value:1,label:'Synthetic A'},{value:2,label:'Synthetic B'},{value:3,label:'以上都不是'}]
  if(type==='NUMBER'){item.disabled=true;config.defaultValue=3}
  await api('/user/form/item/create',{formKey:key,type,formItemId:config.formId,label:config.label,required:config.required,showLabel:config.showLabel,span:24,defaultValue:config.defaultValue==null?null:String(typeof config.defaultValue==='object'?JSON.stringify(config.defaultValue):config.defaultValue),scheme:item})
 }
 await page.goto('http://127.0.0.1:5180/project/form/editor?key='+key)
 await page.locator('.question-card').nth(2).click()
 const settings=page.locator('.designer-config')
 await settings.getByText('更多设置',{exact:true}).click()
 await settings.locator('.el-form-item').filter({hasText:'多选互斥'}).locator('.el-switch').click()
 await settings.locator('.el-form-item').filter({hasText:'互斥选项'}).locator('.el-select').click()
 await page.getByRole('option',{name:'以上都不是',exact:true}).click()
 await page.keyboard.press('Escape')
 await settings.getByRole('button',{name:'保存设置',exact:true}).click()
 await page.getByText('已保存',{exact:true}).first().waitFor()
 const saved=await api('/user/form/item/list?key='+key),checkbox=saved.find(item=>item.type==='CHECKBOX')
 assert.equal(checkbox.scheme.config.withExclusiveChoice,true);assert.deepEqual(checkbox.scheme.config.exclusiveChoiceApiCodes,[3])
 checks.push('exclusive checkbox setting is configured through designer UI and persisted')
 await api('/user/form/publish',{formKey:key})
 failNext=true
 await page.goto('http://127.0.0.1:5180/s/'+key)
 const field=type=>page.locator(`.native-form > [data-question-type="${type}"]`)
 await field('SELECT').getByRole('button',{name:'重试加载选项'}).click()
 await field('SELECT').locator('.el-select').click();await page.getByRole('option',{name:'Synthetic Beta',exact:true}).click()
 await field('CASCADER').locator('.el-cascader').click()
 const dropdown=page.locator('.el-cascader__dropdown:visible')
 await dropdown.getByText('Synthetic Parent',{exact:true}).click();await dropdown.getByText('Synthetic Child',{exact:true}).click()
 const a=field('CHECKBOX').getByRole('checkbox',{name:'Synthetic A',exact:true}),b=field('CHECKBOX').getByRole('checkbox',{name:'Synthetic B',exact:true}),exclusive=field('CHECKBOX').getByRole('checkbox',{name:'以上都不是',exact:true})
 await field('CHECKBOX').getByText('Synthetic A',{exact:true}).click();await field('CHECKBOX').getByText('Synthetic B',{exact:true}).click();await field('CHECKBOX').getByText('以上都不是',{exact:true}).click()
 await expect(a).not.toBeChecked();await expect(b).not.toBeChecked();await expect(exclusive).toBeChecked()
 await field('CHECKBOX').getByText('Synthetic A',{exact:true}).click();await expect(exclusive).not.toBeChecked();await field('CHECKBOX').getByText('Synthetic B',{exact:true}).click()
 await expect(field('NUMBER').locator('input')).toBeDisabled()
 await expect(field('NUMBER').locator('input')).toHaveValue('3')
 await page.screenshot({path:'evidence/tduck-full/11-advanced-choices.png',fullPage:true})
 await page.getByRole('button',{name:'提交',exact:true}).click();await page.getByText('提交成功',{exact:true}).waitFor()
 const rows=await api('/user/form/data/query',{formKey:key,current:0,size:10,filter:{}});assert.equal(rows.total,1)
 let model=(await api('/user/form/data/details/'+rows.rows[0].id)).formData
 const selectId=fields.SELECT.config.formId,cascadeId=fields.CASCADER.config.formId,checkboxId=fields.CHECKBOX.config.formId
 assert.equal(model[selectId],'beta');assert.equal(model[selectId+'label'],'Synthetic Beta')
 assert.deepEqual(model[cascadeId],['parent','child']);assert.deepEqual(model[cascadeId+'label'],['Synthetic Parent','Synthetic Child'])
 assert.deepEqual(model[checkboxId],[1,2]);assert.deepEqual(model[checkboxId+'label'],['Synthetic A','Synthetic B'])
 assert.equal(model[fields.NUMBER.config.formId],3)
 checks.push('explicit synthetic remote fixture retries after HTTP failure, resolves nested paths and cascader children, and stores correct labels in real backend','exclusive choice replaces ordinary selections; selecting an ordinary option clears exclusive choice','field disabled property prevents editing while retaining its stored default')
 await page.goto('http://127.0.0.1:5180/project/form/data?key='+key)
 await page.getByText('Synthetic Beta',{exact:true}).click()
 const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:/修\s*改/}).click()
 await dialog.locator('[data-question-type="SELECT"] .el-select').click();await page.getByRole('option',{name:'Synthetic Alpha',exact:true}).click()
 await dialog.getByRole('button',{name:/确\s*定/}).click();await page.getByText('修改成功',{exact:true}).waitFor()
 model=(await api('/user/form/data/details/'+rows.rows[0].id)).formData
 assert.equal(model[selectId],'alpha');assert.equal(model[selectId+'label'],'Synthetic Alpha')
 const unchanged=await api('/user/form/item/list?key='+key)
 assert.deepEqual(unchanged.find(item=>item.type==='SELECT').scheme.config.options,fields.SELECT.config.options)
 checks.push('owner answer editor stores current remote labels without modifying the published question schema')
 assert.deepEqual(errors,[])
 const report={checks,errors,remoteSource:'Explicit synthetic Playwright fixture; questionnaire and answers use real isolated backend',formKey:key}
 fs.writeFileSync('evidence/tduck-full/choice-flows.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}catch(error){console.log(JSON.stringify({failure:error.message,checks,errors}));await page.screenshot({path:'.local/tduck-full-audit/choice-failure.png',fullPage:true});process.exitCode=1}finally{await browser.close()}
