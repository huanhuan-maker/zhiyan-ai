// M2 AI 草稿 UI 全流程回归（真实 5180 前端 + 8997 后端 + 真实本机推理网关，Edge 无头）
// 覆盖：状态栏真实 AI 标注 → 表单生成 → 草稿预览（含人工审核提示）→ 导入现有编辑器（未发布）。
// 截图：evidence/tduck-full/21-ai-draft-page.png / 22-ai-draft-preview.png / 23-ai-draft-imported-editor.png
import {createRequire} from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require=createRequire(path.resolve('tduck-vue3/package.json'))
const {chromium}=require('@playwright/test')
const fixt=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
const checks=[],errors=[]
function check(name,ok,detail=''){checks.push({name,ok});console.log((ok?'[ok] ':'[FAIL] ')+name+(detail?' | '+String(detail).slice(0,120):''));if(!ok)errors.push(name)}
const browser=await chromium.launch({channel:'msedge',headless:true})
const page=await browser.newPage({viewport:{width:1440,height:1000}})
const pageErrors=[]
page.on('pageerror',e=>pageErrors.push(String(e).slice(0,200)))
try{
  // 登录（不截图，避免凭据入证据）
  await page.goto('http://127.0.0.1:5180/login')
  await page.waitForTimeout(1200)
  await page.getByPlaceholder('请输入手机号 / 邮箱').fill(fixt.owner)
  await page.getByPlaceholder('请输入密码').fill(fixt.password)
  await page.getByRole('button',{name:'登 录'}).click()
  await page.waitForTimeout(2500)

  // AI 草稿页：状态栏
  await page.goto('http://127.0.0.1:5180/project/form/ai-draft')
  await page.waitForTimeout(2500)
  const statusText=await page.locator('.ai-status').innerText().catch(()=>'')
  check('UI-1: 状态栏显示真实 AI + Provider/模型',statusText.includes('真实 AI')&&statusText.includes('本机推理网关')&&statusText.includes('group/group'),statusText.replace(/\n/g,' '))
  await page.screenshot({path:'evidence/tduck-full/21-ai-draft-page.png',fullPage:true})

  // 填表生成（验收剧本输入）
  await page.getByPlaceholder('例：我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人').fill('我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人')
  await page.getByPlaceholder('例：在校大学生').fill('在校大学生')
  await page.getByRole('spinbutton').fill('6')
  await page.getByRole('button',{name:'生成草稿'}).click()
  // 真实模型等待上限 110s（代理与后端均为 90/120s 档）
  let settled=false
  for(let i=0;i<22;i++){
    await page.waitForTimeout(5000)
    const body=await page.locator('body').innerText()
    if(body.includes('草稿预览')||body.includes('目标需要澄清')){settled=true;break}
  }
  const bodyText=await page.locator('body').innerText()
  check('UI-2: 生成返回草稿或澄清(110s内)',settled,settled?'':bodyText.slice(0,100))
  if(bodyText.includes('草稿预览')){
    const qCount=await page.locator('.question-item').count()
    check('UI-3: 草稿预览显示 6 道题',qCount===6,'count='+qCount)
    const hasOpen=bodyText.includes('开放题')
    const hasScale=bodyText.includes('量表范围')
    check('UI-4: 预览含开放题与量表标注',hasOpen&&hasScale)
    check('UI-5: 页面显示"不写库不发布"边界提示',bodyText.includes('不写库、不发布'))
    await page.screenshot({path:'evidence/tduck-full/22-ai-draft-preview.png',fullPage:true})

    // 导入编辑器
    await page.getByRole('button',{name:'导入编辑器继续编辑'}).click()
    await page.waitForTimeout(3500)
    await page.waitForURL(/project\/form\/editor/, {timeout: 15000}).catch(()=>{})
    check('UI-6: 导入后跳转现有编辑器',page.url().includes('/project/form/editor'),page.url())
    await page.waitForTimeout(2500)
    const editorText=await page.locator('body').innerText()
    const editorQuestions=await page.locator('.question-card').count()
    check('UI-7: 编辑器载入全部题目',editorQuestions===6,'cards='+editorQuestions)
    check('UI-8: 编辑器显示未发布草稿(无冻结提示,可保存)',!editorText.includes('题目已冻结'))
    await page.screenshot({path:'evidence/tduck-full/23-ai-draft-imported-editor.png',fullPage:true})
  }else{
    check('UI-3~UI-8: 澄清路径跳过导入断言',bodyText.includes('目标需要澄清'),'澄清视图')
    await page.screenshot({path:'evidence/tduck-full/22-ai-draft-preview.png',fullPage:true})
  }
  check('UI-9: 全程无前端报错',pageErrors.length===0,pageErrors.slice(0,2).join(' | '))
}finally{
  await browser.close()
}
fs.writeFileSync('evidence/tduck-full/m2-ui-flows.json',JSON.stringify({date:new Date().toISOString(),total:checks.length,failed:errors.length,checks},null,1)+'\n')
console.log(`\nM2 UI 回归: ${checks.length}项检查, 失败 ${errors.length}`)
if(errors.length){console.log('FAILED: '+errors.join(' ; '));process.exit(1)}
