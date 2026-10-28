// 我的问卷卡片：用「收集份数」替换「类型编号」，数字必须与后端数据页总数一致。
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const cred=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const out='evidence/tduck-full/form-card-counts', base='http://127.0.0.1:5180', api='http://127.0.0.1:8997'
fs.mkdirSync(out,{recursive:true})
const checks=[],errors=[]
const login=await (await fetch(api+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:cred.adminEmail,password:cred.adminPassword})})).json()
if(login.code!==200)throw Error('login failed')
const token=login.data.token
const pageData=await (await fetch(api+'/user/form/page?current=1&size=48&folderId=0',{headers:{token}})).json()
const records=pageData.data.records
const keys=records.map(r=>r.formKey)
const counts=await (await fetch(api+'/user/form/answer-counts?keys='+keys.join(','),{headers:{token}})).json()
assert.equal(counts.code,200)
const withAnswers=records.filter(r=>Number(counts.data[r.formKey])>0)
const user=JSON.stringify({name:'管理员',admin:true,avatar:'',token})
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1600,height:1000}})
await context.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token,user})
const page=await context.newPage();page.setDefaultTimeout(15000)
page.on('pageerror',e=>errors.push(e.message))
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,600)});console.log('FAIL '+name+': '+e.message.slice(0,240));await page.screenshot({path:out+'/ui-last-failure.png'}).catch(()=>{})}}
const card=(key,scope=page)=>scope.locator('[data-form-key="'+key+'"]')
const expected=key=>String(counts.data[key] ?? '—')
try{
  await page.goto(base+'/home')
  await expect(page.getByRole('heading',{name:'问卷概览'})).toBeVisible()
  await expect(page.locator('.project-card-item').first()).toBeVisible()

  await check('卡片不再显示类型编号，改为收集份数',async()=>{
    const labels=await page.locator('.project-card-item').first().locator('.metric-label').allInnerTexts()
    assert.deepEqual(labels,['状态','收集份数','更新时间'])
    const text=await page.locator('.project-card-item').first().innerText()
    if(text.includes('类型编号'))throw Error('类型编号仍存在')
  })

  await check('每张卡片的收集份数与批量接口一致',async()=>{
    const shown=await page.locator('.project-card-item').evaluateAll(nodes=>nodes.map(n=>({
      key:n.getAttribute('data-form-key'),
      value:n.querySelectorAll('.metric-value')[1]?.textContent.trim()
    })))
    if(!shown.length)throw Error('no cards')
    for(const item of shown){
      const want=expected(item.key)
      if(item.value!==want)throw Error(item.key+' 显示'+item.value+' 期望'+want)
    }
  })

  await check('有答卷的问卷显示真实份数',async()=>{
    if(!withAnswers.length)throw Error('数据库里没有带答卷的问卷，无法验证真实数字')
    for(const form of withAnswers.slice(0,3)){
      const item=card(form.formKey)
      await expect(item).toHaveCount(1)
      await expect(item).toContainText('收集份数')
      const value=await item.locator('.metric-value').nth(1).innerText()
      assert.equal(value,String(counts.data[form.formKey]))
    }
  })

  await check('有答卷用强调色、0 份用次级色',async()=>{
    const style=await card(withAnswers[0].formKey).locator('.count-value').evaluate(el=>({color:getComputedStyle(el).color,dark:document.documentElement.classList.contains('zy-dark')}))
    if(!style.dark)throw Error('zy-dark missing')
    assert.equal(style.color,'rgb(56, 232, 255)')
    const zero=await page.locator('.project-card-item .count-value.count-zero').first().evaluate(el=>getComputedStyle(el).color)
    assert.equal(zero,'rgb(131, 145, 165)')
  })

  await check('后端对未登录请求拒绝返回份数',async()=>{
    const anon=await (await fetch(api+'/user/form/answer-counts?keys='+keys[0])).json()
    assert.equal(anon.code,401)
  })

  await check('别人无法查询不属于自己的问卷份数',async()=>{
    const foreign=await (await fetch(api+'/user/form/answer-counts?keys=NOT-MY-FORM',{headers:{token}})).json()
    assert.equal(foreign.code,200)
    assert.deepEqual(foreign.data,{})
  })

  await page.screenshot({path:out+'/01-desktop.png'})

  await check('移动端卡片仍显示三项信息且不横向溢出',async()=>{
    const mobile=await context.newPage()
    await mobile.setViewportSize({width:390,height:844})
    mobile.on('pageerror',e=>errors.push(e.message))
    await mobile.goto(base+'/home')
    await expect(mobile.locator('.project-card-item').first()).toBeVisible()
    const labels=await mobile.locator('.project-card-item').first().locator('.metric-label').allInnerTexts()
    assert.deepEqual(labels,['状态','收集份数','更新时间'])
    const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
    if(overflow>1)throw Error('横向溢出 '+overflow)
    await mobile.screenshot({path:out+'/02-mobile.png'})
    await mobile.close()
  })

  await check('页面没有运行时错误',async()=>{if(errors.length)throw Error(errors.join(' | '))})
  const failed=checks.filter(c=>!c.passed)
  fs.writeFileSync(out+'/results.json',JSON.stringify({date:new Date().toISOString(),checks,total:checks.length,passed:checks.length-failed.length,failed:failed.length,errors,counts:counts.data},null,2)+'\n')
  console.log('\n'+(checks.length-failed.length)+'/'+checks.length+' checks passed')
  if(failed.length)process.exitCode=1
}finally{await browser.close()}
