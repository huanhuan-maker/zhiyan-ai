// Controlled 32s UI response, no AI call and no database writes.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const {chromium}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
const auth=await fetch('http://127.0.0.1:8997/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:f.owner,password:f.password})}).then(r=>r.json())
if(auth.code!==200)throw Error('Synthetic login failed')
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage();await page.addInitScript(t=>localStorage.setItem('token',t),auth.data.token)
 await page.route('**/user/form/ai/draft*',async route=>{
  await new Promise(resolve=>setTimeout(resolve,32000))
  try{await route.fulfill({json:{code:200,data:{kind:'clarification',mode:'MOCK',provider:'Synthetic delay fixture',model:'fixture',clarification:['Synthetic delayed clarification']}}})}catch{}
 })
 await page.goto('http://127.0.0.1:5180/project/form/ai-draft')
 await page.getByPlaceholder('例：我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人').fill('Synthetic slow test')
 await page.getByPlaceholder('例：在校大学生').fill('Synthetic students')
 const start=Date.now();await page.getByRole('button',{name:'生成草稿',exact:true}).click()
 let passed=false
 try{await page.getByText('Synthetic delayed clarification',{exact:true}).waitFor({timeout:38000});passed=true}catch{}
 const report={date:new Date().toISOString(),source:'Controlled 32 second browser response, not real AI',passed,elapsedMs:Date.now()-start}
 fs.writeFileSync('evidence/tduck-full/usability/slow-request.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!passed)process.exitCode=1
}finally{await browser.close()}
