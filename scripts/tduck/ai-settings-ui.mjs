import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const out='evidence/tduck-full/ai-settings',checks=[],errors=[];fs.mkdirSync(out,{recursive:true})
const user=JSON.parse(fs.readFileSync('.local/assistant-review/admin-session.json','utf8'))
async function saveUI(){const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/user/ai-settings')&&r.request().method()==='POST');await page.getByRole('button',{name:'保存全部配置',exact:true}).click();const r=await(await response).json();assert.equal(r.code,200,r.msg);await expect(page.locator('.settings-toolbar')).toContainText('已与服务端同步')}
const browser=await chromium.launch({channel:'msedge',headless:true})
const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(6500)
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,400)});console.log('FAIL '+name)}}
try{
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(user=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user))},user)
 await page.goto('http://127.0.0.1:5180/manage/system');await page.getByRole('tab',{name:'AI 配置',exact:true}).click()
 await check('regression: AI settings shows the actual model suppliers instead of the disconnected DeepSeek switch',async()=>{await expect(page.getByRole('heading',{name:'模型供应商',exact:true})).toBeVisible();await expect(page.locator('[data-testid="provider-card"]')).not.toHaveCount(0);await expect(page.getByText('启用 DeepSeek 服务',{exact:true})).toHaveCount(0)})
 if(process.argv.includes('--baseline'))await page.screenshot({path:out+'/baseline-old-config.png'})
 else {
  await check('imported live provider is visible without any API key value',async()=>{await expect(page.locator('[data-testid="provider-card"]').first()).toContainText('已保存密钥');assert.equal(await page.locator('input[autocomplete="new-password"]').first().inputValue(),'');await expect(page.locator('[data-testid="model-id"]').first().locator('input')).toHaveValue('group/group')})
  await check('protocol picker offers all three requested APIs',async()=>{await page.locator('[data-testid="provider-protocol"]').first().click();for(const label of ['OpenAI Chat Completions','OpenAI Responses','Anthropic Messages'])await expect(page.getByRole('option',{name:label,exact:true})).toBeVisible();await page.keyboard.press('Escape')})
  await check('one supplier can add two custom model profiles with individual budgets and effort',async()=>{
   const p=page.locator('[data-testid="provider-card"]').first();const count=await p.locator('[data-testid="model-card"]').count()
   await p.getByRole('button',{name:'添加模型',exact:true}).click();const m=p.locator('[data-testid="model-card"]').last();await m.getByLabel('显示名称',{exact:true}).fill('Synthetic UI custom profile');await m.getByLabel('模型 ID',{exact:true}).fill('synthetic-ui-custom')
   await m.getByLabel('上下文窗口（Token）',{exact:true}).fill('65536');await m.getByLabel('最大输出 Token',{exact:true}).fill('4096');await m.getByLabel('历史提问轮数',{exact:true}).fill('3')
   await m.locator('[data-testid="reasoning-effort"]').click();await page.getByRole('option',{name:'高 · high',exact:true}).click();await expect(p.locator('[data-testid="model-card"]')).toHaveCount(count+1)
   await saveUI();await page.reload();await page.getByRole('tab',{name:'AI 配置',exact:true}).click();await expect(page.locator('[data-testid="model-id"] input').last()).toHaveValue('synthetic-ui-custom')
  })
  await check('saved settings survive reload and removing only the synthetic profile is persisted',async()=>{const last=page.locator('[data-testid="model-card"]').last();await expect(last.getByLabel('上下文窗口（Token）',{exact:true})).toHaveValue('65536');await expect(last.locator('[data-testid="reasoning-effort"]')).toContainText('high');await last.getByRole('button',{name:'移除模型',exact:true}).click();await saveUI()})
  await check('a custom Responses supplier can be saved and removed in the real interface',async()=>{
   await page.getByRole('button',{name:'添加供应商',exact:true}).click();const p=page.locator('[data-testid="provider-card"]').last();await p.getByLabel('供应商名称',{exact:true}).fill('Synthetic UI provider');await p.getByLabel('Base URL',{exact:true}).fill('http://127.0.0.1:1/v1');await p.locator('input[autocomplete="new-password"]').fill('synthetic-ui-key');await p.locator('[data-testid="provider-protocol"]').click();await page.getByRole('option',{name:'OpenAI Responses',exact:true}).click();const m=p.locator('[data-testid="model-card"]').first();await m.getByLabel('显示名称',{exact:true}).fill('Synthetic response model');await m.getByLabel('模型 ID',{exact:true}).fill('synthetic-response-model');await saveUI();await expect(p).toContainText('已保存密钥');assert.equal(await p.locator('input[autocomplete="new-password"]').inputValue(),'');await p.getByRole('button',{name:'移除供应商',exact:true}).click();await saveUI()
  })
  await check('saved live model connection can be tested in the interface',async()=>{await page.getByRole('button',{name:'测试连接',exact:true}).first().click();await expect(page.locator('.test-result').first()).toContainText('连接成功',{timeout:110000})})
  await check('desktop actual settings and mobile controls render without horizontal overflow',async()=>{await expect(page.locator('.el-message')).toHaveCount(0,{timeout:10000});await page.setViewportSize({width:1440,height:1400});await page.getByRole('heading',{name:'模型供应商',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:out+'/01-settings-desktop.png'});await page.setViewportSize({width:390,height:844});await page.getByRole('heading',{name:'模型供应商',exact:true}).scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);await page.screenshot({path:out+'/02-settings-mobile.png'});await page.locator('[data-testid="model-card"]').first().scrollIntoViewIfNeeded();await page.screenshot({path:out+'/03-model-mobile.png'})})
  await check('no uncaught browser exceptions',async()=>{assert.deepEqual(errors,[])})
 }
}finally{await browser.close();const result={date:new Date().toISOString(),source:'Actual administrator session and real persisted model settings; synthetic custom profile removed after test',checks,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length};fs.writeFileSync(out+(process.argv.includes('--baseline')?'/baseline-ui.json':'/ui-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,failed:result.failed}));if(result.failed)process.exitCode=1}
