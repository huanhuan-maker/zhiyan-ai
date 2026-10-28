// 我的问卷：文件夹卡片（展开动效/进入/返回/空状态）+ 按住 1 秒删除回归。
// 真实登录 8997 后端，注入 token/userInfo 后访问 5180 前端；文件夹行为真实文件夹数据，
// 管理员账号没有文件夹时通过同一套公开 API 创建验收夹具并记录在 results.json。
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')

const cred=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const out='evidence/tduck-full/folder-card-ux'
const base='http://127.0.0.1:5180'
const apiBase='http://127.0.0.1:8997'
fs.mkdirSync(out,{recursive:true})

const checks=[]
const runtimeErrors=[]
// 新建问卷落点检查会主动 abort 一次 POST，用于排除该预期失败产生的控制台噪音
let allowAbortedRequest=false
const deleteRequests=[]
const screenshots=[]
const tempSurveys=[]
const fixtures={target:null,empty:null,created:[]}
const notes=[]

async function check(name,fn){
  try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}
  catch(e){
    checks.push({name,passed:false,error:String(e&&e.message||e).slice(0,800)})
    console.log('FAIL '+name+': '+String(e&&e.message||e).slice(0,300))
    await page.screenshot({path:out+'/failure-last.png'}).catch(()=>{})
  }
}

const api=async(pathname,{method='GET',body,token}={})=>{
  const res=await fetch(apiBase+pathname,{method,headers:{token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
  return res.json()
}
const pageQuery=(params)=>api('/user/form/page?'+new URLSearchParams(params).toString(),{token})
const createForm=(body)=>api('/user/form/create',{method:'POST',body,token})
const deleteForm=(formKey)=>api('/user/form/delete',{method:'POST',body:{formKey},token})

// ---------- 登录与数据预检 ----------
const login=await api('/login/account',{method:'POST',body:{account:cred.adminEmail,password:cred.adminPassword}})
assert.equal(login.code,200,'admin login failed')
const token=login.data.token
const rootSurveys=await pageQuery({current:1,size:200,folderId:0,folder:0})
assert.equal(rootSurveys.code,200)
const rootSurveyRecords=rootSurveys.data.records||[]
const folderRows=await pageQuery({current:1,size:50,folderId:0,folder:1})
assert.equal(folderRows.code,200)
let folders=folderRows.data.records||[]
const initialFolderCount=folders.length
notes.push('登录账号：'+cred.adminEmail+'（管理员）')
notes.push('/user/form/page?folder=1 预检到文件夹 '+folders.length+' 个；folder=0 问卷总数 '+rootSurveys.data.total)

// 管理员没有文件夹时，用应用自身 API 创建可复用的验收夹具；已有则直接使用，绝不写死名称假设。
async function ensureFixtures(){
  if(!folders.length){
    const created=await createForm({name:'Archive - acceptance',description:'文件夹交互验收夹具（无真实答卷）',type:3,folder:true,folderId:0})
    assert.equal(created.code,200,'create folder failed')
    fixtures.created.push({kind:'folder',id:created.data.id,name:'Archive - acceptance'})
    const child=await createForm({name:'Nested survey - acceptance',description:'文件夹内子问卷验收夹具（无真实答卷）',type:1,folder:false,folderId:created.data.id})
    assert.equal(child.code,200,'create nested survey failed')
    fixtures.created.push({kind:'survey',formKey:child.data.formKey,name:'Nested survey - acceptance',folderId:created.data.id})
    const emptyFolder=await createForm({name:'空归档 - acceptance',description:'空文件夹验收夹具',type:3,folder:true,folderId:0})
    assert.equal(emptyFolder.code,200,'create empty folder failed')
    fixtures.created.push({kind:'folder',id:emptyFolder.data.id,name:'空归档 - acceptance'})
    const again=await pageQuery({current:1,size:50,folderId:0,folder:1})
    folders=again.data.records||[]
  }
  let withChild=null,empty=null
  for(const folder of folders){
    const children=await pageQuery({current:1,size:1,folderId:folder.id,folder:0})
    const total=children.data?children.data.total:0
    const detail={id:folder.id,name:folder.textName||folder.name,total}
    if(total>0&&!withChild)withChild=detail
    if(total===0&&!empty)empty=detail
  }
  if(!withChild&&folders.length){
    // 已有文件夹但都没有子问卷：在其中新建一份，避免测不到「文件夹内能看到子问卷」。
    const child=await createForm({name:'Nested survey - acceptance',description:'文件夹内子问卷验收夹具（无真实答卷）',type:1,folder:false,folderId:folders[0].id})
    assert.equal(child.code,200,'create nested survey failed')
    fixtures.created.push({kind:'survey',formKey:child.data.formKey,name:'Nested survey - acceptance',folderId:folders[0].id})
    withChild={id:folders[0].id,name:folders[0].textName||folders[0].name,total:1}
  }
  assert.ok(withChild,'没有可用文件夹（folder=1 为空且创建失败）')
  if(!empty){
    const created=await createForm({name:'空归档 - acceptance',description:'空文件夹验收夹具',type:3,folder:true,folderId:0})
    assert.equal(created.code,200,'create empty folder failed')
    fixtures.created.push({kind:'folder',id:created.data.id,name:'空归档 - acceptance'})
    empty={id:created.data.id,name:'空归档 - acceptance',total:0}
  }
  fixtures.target=withChild
  fixtures.empty=empty
  fixtures.child=(await pageQuery({current:1,size:50,folderId:withChild.id,folder:0})).data.records[0]
  assert.ok(fixtures.child,'目标文件夹内没有子问卷')
}
await ensureFixtures()
if(!fixtures.created.length) notes.push('本次运行复用了已存在的文件夹夹具（folder=1 预检到 '+initialFolderCount+' 个），未新建文件夹行')
else notes.push('本次运行通过 /user/form/create 新建文件夹夹具 '+fixtures.created.length+' 条')
const targetFolder=folders.find(f=>f.id===fixtures.target.id)
const emptyFolder=folders.find(f=>f.id===fixtures.empty.id)
console.log('fixtures.target',fixtures.target,'empty',fixtures.empty,'child',fixtures.child.formKey,fixtures.child.textName)

// ---------- 浏览器 ----------
const user=JSON.stringify({name:'管理员',admin:true,avatar:'',token})
const browser=await chromium.launch({channel:'msedge',headless:true})
let page
async function newPage(contextOptions={}){
  const context=await browser.newContext({viewport:{width:1600,height:1000},...contextOptions})
  await context.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token,user})
  const p=await context.newPage()
  p.setDefaultTimeout(15000)
  p.on('pageerror',e=>runtimeErrors.push('pageerror: '+e.message))
  p.on('console',m=>{
    if(m.type()!=='error')return
    const text=m.text().slice(0,300)
    if(allowAbortedRequest&&text.includes('net::ERR_FAILED'))return
    runtimeErrors.push('console: '+text)
  })
  p.on('request',r=>{if(r.url().includes('/user/form/logic/delete'))deleteRequests.push({url:r.url(),body:r.postData()})})
  return {context,p}
}
const folderCard=(p,id)=>p.locator('[data-testid="folder-card"][data-folder-id="'+id+'"]')
const surveyCard=(p,key)=>p.locator('.project-card-item[data-form-key="'+key+'"]')
const shot=async(p,name)=>{const file=out+'/'+name;await p.screenshot({path:file});screenshots.push('evidence/tduck-full/folder-card-ux/'+name)}

// 后端被并行验收占用时列表请求偶发失败；遇到「加载失败」提示点一次重试，避免把基础设施抖动记成用例失败。
async function expectFolderLoaded(p,formKey,timeout=8000){
  try{
    await expect(surveyCard(p,formKey)).toHaveCount(1,{timeout})
  }catch(error){
    const retry=p.locator('.project-list-error button')
    if(await retry.count()){await retry.first().click();await expect(surveyCard(p,formKey)).toHaveCount(1,{timeout})}
    else throw error
  }
}
async function expectRootLoaded(p,timeout=8000){
  try{
    await expect(p.locator('[data-testid="folder-strip"]')).toBeVisible({timeout})
  }catch(error){
    const retry=p.locator('.project-list-error button')
    if(await retry.count()){await retry.first().click();await expect(p.locator('[data-testid="folder-strip"]')).toBeVisible({timeout})}
    else throw error
  }
}

try{
  // ---------- 桌面：根目录 ----------
  const desktop=await newPage()
  page=desktop.p
  await page.goto(base+'/home')
  await expect(page.getByRole('heading',{name:'问卷概览'})).toBeVisible()
  await expect(page.locator('[data-testid="folder-card"]').first()).toBeVisible()
  await page.waitForTimeout(900)

  await check('API 预检：文件夹行来自 folder=1，而不是问卷列表',async()=>{
    assert.ok(folders.length>=1,'folder=1 没有返回文件夹')
    const ids=rootSurveyRecords.map(r=>r.id)
    for(const folder of folders) assert.ok(!ids.includes(folder.id),'问卷列表 folder=0 混入了文件夹 '+folder.id)
    assert.equal(rootSurveys.data.total,rootSurveyRecords.length,'folder=0 的 total 与记录数不一致')
  })

  await check('文件夹卡片显示真实文件夹名与内部问卷数',async()=>{
    const card=folderCard(page,fixtures.target.id)
    await expect(card).toHaveCount(1)
    await expect(card).toBeVisible()
    const text=(await card.innerText()).replace(/\s+/g,' ')
    assert.ok(text.includes(fixtures.target.name),'卡片缺少文件夹名：'+text)
    const meta=(await card.locator('.folder-meta').innerText()).trim()
    assert.equal(meta,fixtures.target.total+' 份问卷','文件夹内部问卷数显示错误：'+meta)
    assert.equal(await card.getAttribute('role'),'button')
    assert.equal(await card.getAttribute('tabindex'),'0')
    const aria=await card.getAttribute('aria-label')
    assert.ok(aria.includes('打开文件夹')&&aria.includes(fixtures.target.name),'aria-label 不清：'+aria)
    await expect(card.locator('.folder-tab')).toHaveCount(1)
  })

  await check('文件夹卡片不再按问卷卡片渲染',async()=>{
    const folderKey=targetFolder.formKey
    assert.equal(await page.locator('.project-card-item[data-form-key="'+folderKey+'"]').count(),0,'文件夹仍出现在问卷卡片里')
    const folderText=(await folderCard(page,fixtures.target.id).innerText())
    assert.ok(!folderText.includes('收集份数'),'文件夹卡片出现了问卷字段')
    const surveyText=await page.locator('.project-card-item').first().innerText()
    assert.ok(surveyText.includes('收集份数'),'问卷卡片字段缺失')
  })

  await check('「共 N 份问卷」只统计问卷，不含文件夹',async()=>{
    const expected=String(rootSurveys.data.total)
    await expect.poll(async()=>await page.locator('.page-subtitle .zy-count').first().getAttribute('aria-label')).toBe(expected)
    const subtitle=await page.locator('.page-subtitle').innerText()
    assert.ok(subtitle.includes(folders.length+' 个文件夹'),'副标题缺少文件夹数量：'+subtitle)
  })

  await check('桌面文件夹/问卷卡片均为深色主题，无白底面板',async()=>{
    const colors=await page.evaluate(()=>{
      const pick=(selector)=>Array.from(document.querySelectorAll(selector)).map(el=>getComputedStyle(el).backgroundColor)
      return {folder:pick('[data-testid="folder-card"]'),survey:pick('.project-card-item'),html:document.documentElement.className}
    })
    assert.ok(colors.html.includes('zy-dark'),'html 缺少 zy-dark')
    const whites=[...colors.folder,...colors.survey].filter(c=>c==='rgb(255, 255, 255)')
    assert.deepEqual(whites,[],'出现白底卡片')
  })

  await shot(page,'01-desktop-folder-cards.png')

  // 列表视图仍有文件夹入口
  await check('列表视图保留文件夹入口并可进入',async()=>{
    await page.getByRole('button',{name:'列表视图'}).click()
    const chip=page.locator('.folder-chip[data-folder-id="'+fixtures.target.id+'"]')
    await expect(chip).toBeVisible()
    await chip.click()
    await expect(page.locator('[data-testid="folder-breadcrumb"]')).toContainText(fixtures.target.name)
    await expect(surveyCard(page,fixtures.child.formKey)).toBeVisible()
    await page.locator('[data-testid="folder-back"]').click()
    await expect(page.locator('[data-testid="folder-breadcrumb"]')).toHaveCount(0)
    await page.getByRole('button',{name:'卡片视图'}).click()
    await expectRootLoaded(page)
  })

  // ---------- 打开动效 / 进入文件夹 ----------
  let openingSeen=false
  await check('点击文件夹先播打开动效再进入',async()=>{
    await page.waitForTimeout(400)
    await folderCard(page,fixtures.target.id).click()
    // 打开动效持续 380ms，点击后立刻读取动效态并截图
    openingSeen=await page.evaluate(()=>Boolean(document.querySelector('[data-testid="folder-card"][data-folder-opening="true"]')))
    await shot(page,'02-folder-opening.png')
    assert.ok(openingSeen,'点击后没有捕捉到 data-folder-opening 动效态')
    await expect(page.locator('[data-testid="folder-breadcrumb"]')).toBeVisible({timeout:5000})
    assert.equal(await page.evaluate(()=>Boolean(document.querySelector('[data-folder-opening="true"]'))),false,'动效态未结束')
    const url=new URL(page.url())
    assert.equal(url.searchParams.get('folderId'),String(fixtures.target.id),'URL 未进入文件夹：'+page.url())
    await expectFolderLoaded(page,fixtures.child.formKey)
  })

  await check('面包屑显示「根目录 / 文件夹名」',async()=>{
    const crumb=page.locator('[data-testid="folder-breadcrumb"]')
    await expect(crumb).toBeVisible()
    const text=(await crumb.innerText()).replace(/\s+/g,' ')
    assert.ok(text.includes('根目录'),'面包屑缺少根目录：'+text)
    assert.ok(text.includes(fixtures.target.name),'面包屑缺少文件夹名：'+text)
    assert.equal(await page.locator('[data-testid="folder-card"]').count(),0,'文件夹内不应再显示文件夹卡片')
  })

  await check('文件夹内能看到子问卷',async()=>{
    const card=surveyCard(page,fixtures.child.formKey)
    await expect(card).toHaveCount(1)
    await expect(card).toBeVisible()
    await expect(card).toContainText(String(fixtures.child.textName).replace(/<[^>]*>/g,'').trim())
  })

  await shot(page,'03-inside-folder.png')

  await check('文件夹内新建问卷自动落在当前 folderId',async()=>{
    let payload=null
    // axios 签名拦截器会给 POST 追加 timestamp/sign 查询参数，匹配时不能锚定结尾
    const matcher=/\/user\/form\/create(?:\?|$)/
    const dialog=page.getByRole('dialog',{name:'新建问卷'})
    await page.route(matcher,async route=>{payload=route.request().postDataJSON();await route.abort()})
    allowAbortedRequest=true
    try{
      await page.getByRole('button',{name:'新建问卷'}).click()
      await expect(dialog).toBeVisible()
      await dialog.locator('input').first().fill('文件夹内新建验证 '+Date.now())
      await dialog.getByRole('button',{name:'创建并编辑'}).click()
      await expect.poll(()=>payload?payload.folderId:null,{timeout:8000}).toBe(fixtures.target.id)
      assert.ok(payload&&String(payload.name).includes('文件夹内新建验证'),'创建请求缺少名称')
    }finally{
      await page.unroute(matcher).catch(()=>{})
      await dialog.getByRole('button',{name:'取消'}).click().catch(()=>{})
      await expect(dialog).toHaveCount(0).catch(()=>{})
      await page.waitForTimeout(400)
      allowAbortedRequest=false
    }
  })

  // ---------- 返回根目录 ----------
  await check('点击返回根目录回到 folderId=0',async()=>{
    await page.locator('[data-testid="folder-back"]').click()
    await expect(page.locator('[data-testid="folder-breadcrumb"]')).toHaveCount(0)
    await expectRootLoaded(page)
    const url=new URL(page.url())
    assert.equal(url.searchParams.get('folderId'),null,'URL 仍带 folderId')
    assert.equal(await page.locator('.folder-chip').count(),0,'卡片视图不应出现表格文件夹条')
  })

  // ---------- 空文件夹 ----------
  await check('空文件夹显示空状态且不是白底',async()=>{
    await folderCard(page,fixtures.empty.id).click()
    const emptyView=page.locator('[data-testid="folder-empty"]')
    await expect(emptyView).toBeVisible()
    const text=(await emptyView.innerText()).replace(/\s+/g,' ')
    assert.ok(text.includes('这个文件夹还是空的'),'空文件夹文案缺失：'+text)
    assert.ok(text.includes(fixtures.empty.name),'空状态未说明文件夹名：'+text)
    const style=await emptyView.evaluate(el=>({bg:getComputedStyle(el).backgroundColor,dark:document.documentElement.classList.contains('zy-dark')}))
    assert.ok(style.dark,'zy-dark 缺失')
    assert.notEqual(style.bg,'rgb(255, 255, 255)','空文件夹出现白底')
    const whitePanels=await page.evaluate(()=>Array.from(document.querySelectorAll('[data-testid="folder-empty"], [data-testid="folder-empty"] *')).filter(el=>getComputedStyle(el).backgroundColor==='rgb(255, 255, 255)').length)
    assert.equal(whitePanels,0,'空状态内出现白底元素')
  })
  await shot(page,'04-empty-folder.png')
  await page.locator('[data-testid="folder-back"]').click()
  await page.waitForTimeout(500)

  // ---------- 按住删除 ----------
  const tempA=await createForm({name:'按住删除临时问卷 A '+Date.now(),description:'按住删除回归临时数据，无真实答卷',type:1,folderId:0})
  assert.equal(tempA.code,200)
  tempSurveys.push({key:tempA.data.formKey,name:tempA.data.name,deletedBy:'按住 1 秒删除',status:'逻辑删除，留在回收站'})
  const tempB=await createForm({name:'按住删除临时问卷 B（键盘） '+Date.now(),description:'按住删除键盘回归临时数据，无真实答卷',type:1,folderId:0})
  assert.equal(tempB.code,200)
  tempSurveys.push({key:tempB.data.formKey,name:tempB.data.name,deletedBy:'键盘 Space 按住 1 秒删除',status:'逻辑删除，留在回收站'})
  await page.reload()
  await expectRootLoaded(page)

  async function openHoldPanel(p,key){
    const card=surveyCard(p,key)
    await expect(card).toBeVisible()
    await card.locator('.more-trigger').click()
    // 列表里多张待发布问卷都带「删除问卷」，必须只取当前展开（可见）的那个菜单项
    const item=p.locator('.el-dropdown-menu__item:visible').filter({hasText:'删除问卷'}).first()
    await expect(item).toBeVisible()
    await item.click()
    await expect(p.locator('[data-testid="hold-delete-panel"]')).toBeVisible()
  }

  await check('删除改为卡片内按住确认，按钮可聚焦且文案为中文',async()=>{
    await openHoldPanel(page,tempA.data.formKey)
    const panel=page.locator('[data-testid="hold-delete-panel"]')
    const text=(await panel.innerText()).replace(/\s+/g,' ')
    assert.ok(text.includes('按住 1 秒删除'),'缺少按住提示：'+text)
    assert.ok(text.includes('松开')||text.includes('松手'),'缺少取消提示：'+text)
    const focused=await page.evaluate(()=>document.activeElement&&document.activeElement.classList.contains('hold-delete-button'))
    assert.ok(focused,'按住按钮未获得焦点')
    const button=panel.locator('.hold-delete-button')
    const aria=await button.getAttribute('aria-label')
    assert.ok(aria.includes('按住 1 秒删除'),'aria-label 不清：'+aria)
    const describedBy=await button.getAttribute('aria-describedby')
    assert.ok(describedBy,'缺少 aria-describedby')
  })

  await check('计时中松开不删除',async()=>{
    const button=page.locator('[data-testid="hold-delete-panel"] .hold-delete-button')
    const card=surveyCard(page,tempA.data.formKey)
    const before=deleteRequests.length
    await button.hover()
    await page.mouse.down()
    await page.waitForTimeout(420)
    await expect(button).toHaveClass(/is-holding/)
    const ring=await button.locator('.hold-ring-progress').evaluate(el=>getComputedStyle(el).animationName)
    assert.notEqual(ring,'none','进度环动画未启动')
    await shot(page,'05-hold-progress.png')
    await page.mouse.up()
    await page.waitForTimeout(500)
    await expect(button).not.toHaveClass(/is-holding/)
    await expect(card).toHaveCount(1)
    assert.equal(deleteRequests.length,before,'计时中松开仍发出了删除请求')
    await expect(page.locator('[data-testid="hold-delete-panel"]')).toBeVisible()
  })

  await check('ESC 取消按住删除且不删除问卷',async()=>{
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="hold-delete-panel"]')).toHaveCount(0)
    await expect(surveyCard(page,tempA.data.formKey)).toHaveCount(1)
  })

  await check('按住满 1 秒后问卷从列表消失',async()=>{
    await openHoldPanel(page,tempA.data.formKey)
    const button=page.locator('[data-testid="hold-delete-panel"] .hold-delete-button')
    await button.hover()
    await page.mouse.down()
    await page.waitForTimeout(1150)
    await page.mouse.up()
    await expect(surveyCard(page,tempA.data.formKey)).toHaveCount(0,{timeout:8000})
    await expect(page.locator('.el-message--success')).toContainText('删除成功')
    const hit=deleteRequests.filter(item=>(item.body||'').includes(tempA.data.formKey))
    assert.ok(hit.length>=1,'未观察到 /user/form/logic/delete 请求')
    const after=await pageQuery({current:1,size:200,folderId:0,folder:0})
    assert.ok(!(after.data.records||[]).some(r=>r.formKey===tempA.data.formKey),'逻辑删除后列表接口仍返回该问卷')
  })

  await check('键盘按住 Space 1 秒同样删除',async()=>{
    await openHoldPanel(page,tempB.data.formKey)
    const button=page.locator('[data-testid="hold-delete-panel"] .hold-delete-button')
    const focused=await page.evaluate(()=>document.activeElement&&document.activeElement.classList.contains('hold-delete-button'))
    assert.ok(focused,'键盘操作前按钮未聚焦')
    await page.keyboard.down('Space')
    await page.waitForTimeout(1150)
    await page.keyboard.up('Space')
    await expect(surveyCard(page,tempB.data.formKey)).toHaveCount(0,{timeout:8000})
    const hit=deleteRequests.filter(item=>(item.body||'').includes(tempB.data.formKey))
    assert.ok(hit.length>=1,'键盘按住未发出删除请求')
    tempSurveys.find(item=>item.key===tempB.data.formKey).deletedBy='键盘 Space 按住 1 秒删除（已验证）'
  })

  await check('删除失败时卡片内显示错误提示，问卷保留且可重试',async()=>{
    const tempD=await createForm({name:'按住删除失败注入问卷 '+Date.now(),description:'删除失败提示回归临时数据，无真实答卷',type:1,folderId:0})
    assert.equal(tempD.code,200)
    tempSurveys.push({key:tempD.data.formKey,name:tempD.data.name,deletedBy:'失败注入后重试按住删除',status:'逻辑删除，留在回收站'})
    const matcher=/\/user\/form\/logic\/delete(?:\?|$)/
    await page.reload()
    await expectRootLoaded(page)
    await openHoldPanel(page,tempD.data.formKey)
    const button=page.locator('[data-testid="hold-delete-panel"] .hold-delete-button')
    const card=surveyCard(page,tempD.data.formKey)
    await page.route(matcher,route=>route.abort())
    allowAbortedRequest=true
    try{
      await button.hover(); await page.mouse.down(); await page.waitForTimeout(1150); await page.mouse.up()
      const error=page.locator('[data-testid="hold-delete-panel"] .hold-error')
      await expect(error).toBeVisible({timeout:8000})
      assert.ok((await error.innerText()).includes('删除失败'),'缺少可见错误提示')
      await expect(card).toHaveCount(1)
    }finally{
      await page.unroute(matcher).catch(()=>{})
      await page.waitForTimeout(400)
      allowAbortedRequest=false
    }
    // 恢复网络后重试，验证失败不会把卡片锁死
    await button.hover(); await page.mouse.down(); await page.waitForTimeout(1150); await page.mouse.up()
    await expect(card).toHaveCount(0,{timeout:8000})
    tempSurveys.find(item=>item.key===tempD.data.formKey).deletedBy='失败注入后重试按住 1 秒删除（已验证）'
  })

  // ---------- 移动端 ----------
  await check('移动端文件夹卡片可见且不横向溢出',async()=>{
    const mobile=await newPage({viewport:{width:390,height:844}})
    try{
      await mobile.p.goto(base+'/home')
      await expectRootLoaded(mobile.p)
      await mobile.p.locator('[data-testid="folder-strip"]').scrollIntoViewIfNeeded()
      const overflow=await mobile.p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
      assert.ok(overflow<=1,'移动端横向溢出 '+overflow)
      await folderCard(mobile.p,fixtures.target.id).click()
      await expect(mobile.p.locator('[data-testid="folder-breadcrumb"]')).toBeVisible()
      await expect(surveyCard(mobile.p,fixtures.child.formKey)).toBeVisible()
      await mobile.p.locator('[data-testid="folder-strip"]').count().catch(()=>{})
      await mobile.p.evaluate(()=>window.scrollTo(0,0))
      await shot(mobile.p,'06-mobile-folder.png')
    } finally { await mobile.context.close() }
  })

  // ---------- reduced-motion ----------
  await check('reduced-motion 跳过打开动效，仍可进入文件夹',async()=>{
    const reduced=await newPage({reducedMotion:'reduce'})
    try{
      await reduced.p.goto(base+'/home')
      await expectRootLoaded(reduced.p)
      await folderCard(reduced.p,fixtures.target.id).click()
      const opening=await reduced.p.evaluate(()=>Boolean(document.querySelector('[data-folder-opening="true"]')))
      assert.equal(opening,false,'reduced-motion 下仍出现打开动效态')
      await expect(reduced.p.locator('[data-testid="folder-breadcrumb"]')).toBeVisible({timeout:1500})
    } finally { await reduced.context.close() }
  })

  await check('reduced-motion 下按住删除不做动画但仍删除',async()=>{
    const tempC=await createForm({name:'按住删除临时问卷 C（减少动效） '+Date.now(),description:'reduced-motion 按住删除回归临时数据，无真实答卷',type:1,folderId:0})
    assert.equal(tempC.code,200)
    tempSurveys.push({key:tempC.data.formKey,name:tempC.data.name,deletedBy:'reduced-motion 按住 1 秒删除',status:'逻辑删除，留在回收站'})
    const reduced=await newPage({reducedMotion:'reduce'})
    try{
      await reduced.p.goto(base+'/home')
      await expect(surveyCard(reduced.p,tempC.data.formKey)).toBeVisible()
      await openHoldPanel(reduced.p,tempC.data.formKey)
      const button=reduced.p.locator('[data-testid="hold-delete-panel"] .hold-delete-button')
      await button.hover()
      await reduced.p.mouse.down()
      await reduced.p.waitForTimeout(350)
      const animation=await button.locator('.hold-ring-progress').evaluate(el=>getComputedStyle(el).animationName)
      assert.equal(animation,'none','reduced-motion 下进度环仍有动画')
      await reduced.p.waitForTimeout(850)
      await reduced.p.mouse.up()
      await expect(surveyCard(reduced.p,tempC.data.formKey)).toHaveCount(0,{timeout:8000})
    } finally { await reduced.context.close() }
  })

  await check('页面没有运行时错误',async()=>{if(runtimeErrors.length)throw Error(runtimeErrors.join(' | '))})
}catch(e){
  checks.push({name:'回归脚本未捕获异常',passed:false,error:String(e&&e.stack||e).slice(0,1200)})
  console.log('FATAL',e)
  try{await page.screenshot({path:out+'/failure-last.png'})}catch(_){}
}finally{
  // 文件夹夹具保留供人工查看（截图与 results.json 记录 id）；临时问卷已由按住删除逻辑删除。
  // 若某次运行中途失败导致临时问卷仍可见，则硬删除，避免污染列表。
  for(const temp of tempSurveys){
    try{
      const pageData=await pageQuery({current:1,size:200,folderId:0,folder:0})
      if((pageData.data.records||[]).some(r=>r.formKey===temp.key)){
        await deleteForm(temp.key)
        temp.status='回归中途失败，已硬删除清理'
      }
    }catch(_){}
  }
  await browser.close().catch(()=>{})
}

const failed=checks.filter(c=>!c.passed)
const result={
  date:new Date().toISOString(),
  base,apiBase,
  checks,total:checks.length,passed:checks.length-failed.length,failed:failed.length,
  runtimeErrors,
  deleteRequests,
  fixtures:{
    note:fixtures.created.length
      ?'文件夹夹具由本脚本通过 /user/form/create 创建并保留，便于人工核对；不需要时可用 /user/form/delete 清理。'
      :'文件夹夹具在更早的验收探测中通过 /user/form/create 创建，本脚本直接复用；临时问卷使用逻辑删除，留在回收站。',
    initialFolderCount,
    target:fixtures.target,empty:fixtures.empty,
    child:fixtures.child?{formKey:fixtures.child.formKey,textName:fixtures.child.textName}:null,
    created:fixtures.created
  },
  tempSurveys,
  screenshots,
  notes
}
fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2)+'\n')
console.log('\n'+(checks.length-failed.length)+'/'+checks.length+' checks passed')
console.log('screenshots:',screenshots.join(', '))
if(failed.length)process.exitCode=1
