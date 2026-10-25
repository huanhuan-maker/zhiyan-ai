import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const out='evidence/tduck-full/ai-settings-button-fix';fs.mkdirSync(out,{recursive:true})
const user=JSON.parse(fs.readFileSync('.local/assistant-review/admin-session.json','utf8'))
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1400}})
function luminance(rgb){const c=rgb.match(/[\d.]+/g).slice(0,3).map(x=>{const v=Number(x)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722}
const checks=[]
try{
 await page.addInitScript(user=>{localStorage.setItem('token',user.token);localStorage.setItem('userInfo',JSON.stringify(user))},user)
 await page.goto('http://127.0.0.1:5180/manage/system');await page.getByRole('tab',{name:'AI 配置',exact:true}).click();await expect(page.locator('[data-testid="provider-card"]').first()).toBeVisible()
 for(const name of ['移除供应商','移除模型']){const b=page.getByRole('button',{name,exact:true}).first();for(const state of ['normal','hover']){if(state==='hover')await b.hover();else await page.mouse.move(0,0);await page.waitForTimeout(220);const colors=await b.evaluate(el=>{const s=getComputedStyle(el);return {color:s.color,background:s.backgroundColor}});const a=luminance(colors.color),bg=luminance(colors.background),contrast=(Math.max(a,bg)+.05)/(Math.min(a,bg)+.05);checks.push({name:name+' '+state,...colors,contrast:Number(contrast.toFixed(2)),passed:contrast>=4.5&&bg>.65})}}
 await page.mouse.move(0,0);await page.screenshot({path:out+(process.argv.includes('--baseline')?'/before.png':'/after.png')})
}finally{await browser.close();const r={date:new Date().toISOString(),checks,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length};fs.writeFileSync(out+(process.argv.includes('--baseline')?'/before.json':'/after.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));if(r.failed)process.exitCode=1}
