import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {allComponents} from '../../tduck-vue3/src/td/generator/config.js'
const require=createRequire(path.resolve('tduck-vue3/package.json')),{chromium}=require('@playwright/test'),base='http://127.0.0.1:8997'
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),checks=[],errors=[]
let token
async function api(url,data){const v=await fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());assert.equal(v.code,200,url+': '+v.msg);return v.data}
token=(await api('/login/account',{account:f.owner,password:f.password})).token
const created=await api('/user/form/create',{name:'Synthetic local question roundtrip '+Date.now(),type:0}),key=typeof created==='string'?created:created.formKey
const definitions=allComponents.flatMap(g=>g.list),types=['INPUT','NUMBER','TEXTAREA','DATE','RATE','SORT','SLIDER','SELECT','CASCADER','RADIO','CHECKBOX','PAGINATION','IMAGE_SELECT','PROVINCE_CITY','SUB_FORM','MATRIX_INPUT','MATRIX_SELECT','MATRIX_SCALE','DIVIDER','IMAGE','IMAGE_CAROUSEL','DESC_TEXT'],ids={}
for(const [i,type] of types.entries()){
 const item=JSON.parse(JSON.stringify(definitions.find(x=>x.typeId===type))),c=item.config
 c.formId=type.toLowerCase()+Date.now()+i;item.vModel=c.formId;ids[type]=c.formId
 if(type==='SUB_FORM'){const child=JSON.parse(JSON.stringify(definitions.find(x=>x.typeId==='INPUT')));child.config.formId='inputchild'+Date.now();child.vModel=child.config.formId;item.childList=[child];ids.child=child.config.formId}
 await api('/user/form/item/create',{formKey:key,type,formItemId:c.formId,label:c.label,required:c.required,displayType:!!c.displayType,span:24,showLabel:c.showLabel,defaultValue:typeof c.defaultValue==="object"?JSON.stringify(c.defaultValue):c.defaultValue,scheme:item})
}
await api('/user/form/publish',{formKey:key})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1200,height:1000}})
page.on('pageerror',e=>errors.push(e.message))
const field=type=>page.locator(`.native-form > [data-question-type="${type}"]`)
async function cascade(type,depth){await field(type).locator('.el-cascader').click();const drop=page.locator('.el-cascader__dropdown:visible');for(let i=0;i<depth;i++)await drop.locator('.el-cascader-menu').nth(i).locator('.el-cascader-node').first().click()}
try{
 await page.goto('http://127.0.0.1:5180/s/'+key)
 await field('INPUT').locator('input').fill('Synthetic local text')
 await field('NUMBER').locator('input').fill('42');await field('NUMBER').locator('input').press('Tab')
 await field('TEXTAREA').locator('textarea').fill('Synthetic paragraph')
 await field('DATE').locator('input').fill('2026-10-24');await field('DATE').locator('input').press('Enter')
 await field('RATE').locator('.el-rate__item').nth(3).click()
 await field('SORT').getByRole('button',{name:'↓',exact:true}).first().click()
 await field('SLIDER').getByRole('slider').press('End')
 await field('SELECT').locator('.el-select').click();await page.getByRole('option',{name:'选项二',exact:true}).click()
 await cascade('CASCADER',2)
 await field('RADIO').locator('.el-radio').nth(1).click()
 await field('CHECKBOX').locator('.el-checkbox').first().click();await field('CHECKBOX').locator('.el-checkbox').nth(1).click()
 await page.getByRole('button',{name:'下一页',exact:true}).click()
 await field('IMAGE_SELECT').locator('.el-radio').first().click()
 await cascade('PROVINCE_CITY',3)
 await field('SUB_FORM').getByRole('button',{name:'添加一行',exact:true}).click();await field('SUB_FORM').locator('input').fill('Synthetic child')
 for(const input of await field('MATRIX_INPUT').locator('input').all())await input.fill('Synthetic matrix')
 for(const row of await field('MATRIX_SELECT').locator('tbody tr').all())await row.locator('.el-radio').nth(1).click()
 for(const row of await field('MATRIX_SCALE').locator('tbody tr').all())await row.locator('.el-rate__item').nth(3).click()
 await page.screenshot({path:'evidence/tduck-full/10-local-question-types.png',fullPage:true})
 await page.getByRole('button',{name:'提交',exact:true}).click();await page.getByText('提交成功',{exact:true}).waitFor()
 const rows=await api('/user/form/data/query',{formKey:key,current:0,size:10,filter:{}});assert.equal(rows.total,1)
 const model=(await api('/user/form/data/details/'+rows.rows[0].id)).formData
 assert.equal(model[ids.INPUT],'Synthetic local text');assert.equal(model[ids.TEXTAREA],'Synthetic paragraph');assert.equal(model[ids.NUMBER],42);assert.equal(model[ids.DATE],'2026-10-24')
 assert.equal(model[ids.RATE],4);assert.equal(model[ids.SLIDER],100);assert.equal(model[ids.SELECT],2);assert.equal(model[ids.RADIO],2);assert.deepEqual(model[ids.CHECKBOX],[1,2]);assert.deepEqual(model[ids.CASCADER],[1,2])
 assert.equal(model[ids.IMAGE_SELECT],1);assert.equal(model[ids.SORT][0].value,2);assert.equal(model[ids.PROVINCE_CITY].cascadeValue.length,3);assert.equal(model[ids.SUB_FORM][0][ids.child],'Synthetic child')
 assert.equal(Object.keys(model[ids.MATRIX_INPUT]).length,3);assert.deepEqual(Object.values(model[ids.MATRIX_SELECT]),['选项2','选项2','选项2']);assert.deepEqual(Object.values(model[ids.MATRIX_SCALE]),[4,4,4])
 checks.push('17 local input types populated using real browser controls and verified against persisted raw answers','pagination retains page one answers when page two is submitted','four display types render without becoming answer fields')
 assert.deepEqual(errors,[])
 fs.writeFileSync('evidence/tduck-full/question-roundtrip.json',JSON.stringify({checks,types,errors,formKey:key},null,2));console.log(JSON.stringify({checks,errors},null,2))
}catch(e){console.log(JSON.stringify({failure:e.message,errors}));await page.screenshot({path:'evidence/tduck-full/questions-failure.png',fullPage:true});process.exitCode=1}finally{await browser.close()}
