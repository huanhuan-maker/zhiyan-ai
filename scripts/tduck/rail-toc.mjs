// 题目导航轨（Rail TOC）回归：统计页 + 编辑器，全部使用真实后端问卷数据。
// 断言：轨道显示、圆点数=题卡数、点击滚动定位、滚动跟随高亮、深色浮层、
//       键盘可达、reduced-motion 降级、tab 切换隐藏、无横向溢出、桌面+移动截图。
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {chromium,expect}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const cred=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const out='evidence/tduck-full/rail-toc', base='http://127.0.0.1:5180', api='http://127.0.0.1:8997'
fs.mkdirSync(out,{recursive:true})
const checks=[],pageErrors=[],consoleErrors=[]
const login=await (await fetch(api+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:cred.adminEmail,password:cred.adminPassword})})).json()
if(login.code!==200)throw Error('login failed: '+JSON.stringify(login).slice(0,200))
const token=login.data.token
const get=async url=>{const r=await fetch(api+url,{headers:{token}});const j=await r.json();if(j.code!==200)throw Error(url+' -> '+j.code+' '+j.msg);return j.data}

// ---- 选一份「题目多 + 有发布版本 + 有答卷」的真实问卷 ----
const pageData=await get('/user/form/page?current=1&size=50&folderId=0&folder=0')
const candidates=[]
for(const form of pageData.records){
  const versions=await get('/user/form/versions?key='+form.formKey)
  const version=versions.find(v=>Number(v.answerCount)>0)
  if(!version)continue
  const analysis=await get('/user/form/report/analysis?formKey='+form.formKey+'&version='+version.versionNo)
  candidates.push({formKey:form.formKey,name:form.name,versionNo:version.versionNo,answerCount:Number(version.answerCount),items:analysis})
}
if(!candidates.length)throw Error('后端没有可用的已发布且有答卷的问卷，无法验证真实数据')
candidates.sort((a,b)=>b.items.length-a.items.length)
const target=candidates[0]
if(target.items.length<8)throw Error('题目太少（'+target.items.length+' 题），无法验证导航轨滚动')
const statsUrl=base+'/project/form/statistics?key='+target.formKey+'&version='+target.versionNo
const editorUrl=base+'/project/form/editor?key='+target.formKey
console.log('SURVEY',target.name,target.formKey,'V'+target.versionNo,'answers',target.answerCount,'items',target.items.length)

const user=JSON.stringify({name:'管理员',admin:true,avatar:'',token})
const browser=await chromium.launch({channel:'msedge',headless:true})

function watch(page,tag){
  page.on('pageerror',e=>pageErrors.push(tag+': '+e.message))
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(tag+': '+m.text().slice(0,300))})
}
async function check(name,fn){
  try{await fn();checks.push({name,passed:true});console.log('PASS '+name)}
  catch(e){checks.push({name,passed:false,error:String(e.message||e).slice(0,700)});console.log('FAIL '+name+': '+String(e.message||e).slice(0,300));try{await shotPage.screenshot({path:out+'/ui-last-failure.png'})}catch{}}
}
async function newLoggedInPage(viewport,extra={}){
  const context=await browser.newContext({viewport,...extra})
  await context.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token,user})
  const page=await context.newPage()
  page.setDefaultTimeout(30000)
  return page
}
// 等滚动动画停下来：先给动画起始留出时间（minMs），再要求连续多帧 scrollTop 不变。
async function settle(page,selector,minMs=300){
  await page.evaluate(({sel,minMs})=>new Promise(resolve=>{
    const el=document.querySelector(sel); if(!el)return resolve()
    const started=performance.now()
    let last=el.scrollTop,still=0
    const tick=()=>{
      const value=el.scrollTop
      if(Math.abs(value-last)<1)still+=1;else still=0
      last=value
      const elapsed=performance.now()-started
      if((still>=8&&elapsed>minMs)||elapsed>8000)resolve();else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }),{sel:selector,minMs})
}
const railState=page=>page.evaluate(()=>{
  const rail=document.querySelector('.rail-toc')
  const items=[...document.querySelectorAll('.rail-item')]
  const label=document.querySelector('.rail-label')
  const active=document.querySelector('.rail-item.is-active')
  return {
    visible:!!rail&&getComputedStyle(rail).display!=='none',
    count:items.length,
    active:active?Number(active.dataset.railIndex):-1,
    label: label?{text:label.textContent.trim(),bg:getComputedStyle(label).backgroundColor}:null,
    navLabel: rail?getComputedStyle(rail).getPropertyValue('display')&&rail.getAttribute('aria-label'):null
  }
})

let shotPage=null
try{
  const page=await newLoggedInPage({width:1600,height:1000})
  shotPage=page
  watch(page,'statistics')
  await page.goto(statsUrl)
  await expect(page.locator('.analysis-card').first()).toBeVisible()
  await page.waitForTimeout(2500)

  await check('统计页使用真实后端数据：题卡数 = 该版本题目数',async()=>{
    const cards=await page.locator('.analysis-card').count()
    assert.equal(cards,target.items.length)
    const firstTitle=(await page.locator('.analysis-card .title-text').first().innerText()).trim()
    assert.equal(firstTitle,String(target.items[0].label||target.items[0].title).trim())
  })

  await check('右侧导航轨显示，圆点数量 = 题卡数量',async()=>{
    const state=await railState(page)
    assert.ok(state.visible,'rail 不可见')
    assert.equal(state.count,target.items.length)
    assert.equal(state.navLabel,'题目导航')
    assert.equal(state.active,0,'首屏应高亮第 1 题')
    const numbers=await page.locator('.rail-item .rail-index').allInnerTexts()
    assert.equal(String(numbers[0]).trim(),'1')
    assert.equal(String(numbers[numbers.length-1]).trim(),String(target.items.length))
  })

  await check('导航轨在题卡右侧，不遮挡题卡、不产生横向溢出',async()=>{
    const geo=await page.evaluate(()=>{
      const rail=document.querySelector('.rail-toc').getBoundingClientRect()
      const cards=[...document.querySelectorAll('.analysis-card')].map(el=>el.getBoundingClientRect())
      const ws=document.querySelector('.statistics-workspace')
      return {
        rail:{left:rail.left,right:rail.right,top:rail.top,bottom:rail.bottom},
        maxCardRight:Math.max(...cards.map(r=>r.right)),
        docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        wsOverflow:ws.scrollWidth-ws.clientWidth,
        vw:innerWidth,vh:innerHeight
      }
    })
    assert.ok(geo.rail.left>=geo.maxCardRight-1,'导航轨压住题卡：rail.left='+geo.rail.left+' card.right='+geo.maxCardRight)
    assert.ok(geo.rail.right<=geo.vw,'导航轨超出视口右侧')
    assert.ok(geo.rail.top>=0&&geo.rail.bottom<=geo.vh,'导航轨超出视口垂直范围')
    assert.ok(geo.docOverflow<=1,'文档横向溢出 '+geo.docOverflow)
    assert.ok(geo.wsOverflow<=1,'滚动容器横向溢出 '+geo.wsOverflow)
  })

  await check('当前题高亮并显示深色题目标签（不是白底）',async()=>{
    const state=await railState(page)
    assert.equal(state.active,0)
    assert.ok(state.label,'当前题没有浮层标签')
    assert.equal(state.label.text,String(target.items[0].label||target.items[0].title).trim())
    const rgb=state.label.bg.match(/\d+/g).map(Number)
    const luminance=0.299*rgb[0]+0.587*rgb[1]+0.114*rgb[2]
    assert.ok(luminance<80,'浮层不是深色：'+state.label.bg)
  })

  const clickIndex=Math.min(target.items.length-1,Math.max(3,Math.round(target.items.length*0.4)))
  await check('点击第 '+(clickIndex+1)+' 项：题卡滚入视口并高亮该项',async()=>{
    await page.locator('.rail-item').nth(clickIndex).click()
    await settle(page,'.statistics-workspace')
    const info=await page.evaluate(index=>{
      const ws=document.querySelector('.statistics-workspace')
      const cols=[...document.querySelectorAll('.analysis-container [id^="question-"]')]
      const card=cols[index]
      const cr=card.getBoundingClientRect(); const wr=ws.getBoundingClientRect()
      return {topOffset:cr.top-wr.top, inView:cr.top>=wr.top-2&&cr.top<wr.bottom-40,
        canvas:document.querySelectorAll('.analysis-card canvas').length,
        active:Number(document.querySelector('.rail-item.is-active').dataset.railIndex),
        ariaCurrent:document.querySelector('.rail-item.is-active').getAttribute('aria-current')}
    },clickIndex)
    assert.ok(info.inView,'题卡未进入视口')
    assert.ok(info.topOffset>=0&&info.topOffset<160,'题卡顶部未定位到视口上部：'+info.topOffset)
    assert.equal(info.active,clickIndex)
    assert.equal(info.ariaCurrent,'true')
  })
  await page.screenshot({path:out+'/03-statistics-clicked.png'})

  await check('滚动到中部与底部时高亮跟随',async()=>{
    const middle=await page.evaluate(index=>{
      const ws=document.querySelector('.statistics-workspace')
      const cols=[...document.querySelectorAll('.analysis-container [id^="question-"]')]
      const cr=cols[index].getBoundingClientRect(); const wr=ws.getBoundingClientRect()
      ws.scrollTop=ws.scrollTop+(cr.top-wr.top)-80
      return index
    },Math.min(target.items.length-2,clickIndex+8))
    await settle(page,'.statistics-workspace')
    await page.waitForTimeout(250)
    let state=await railState(page)
    assert.equal(state.active,middle,'中部高亮不跟随')
    assert.equal(state.label.text,String(target.items[middle].label||target.items[middle].title).trim())

    await page.evaluate(()=>{const ws=document.querySelector('.statistics-workspace');ws.scrollTop=ws.scrollHeight})
    await settle(page,'.statistics-workspace')
    await page.waitForTimeout(250)
    state=await railState(page)
    assert.equal(state.active,target.items.length-1,'滚到底部应高亮最后一题')
    const fill=await page.locator('.rail-track-fill').evaluate(el=>parseFloat(el.style.height)||0)
    assert.ok(fill>95,'底部进度线未走满：'+fill)
  })
  await page.evaluate(()=>{document.querySelector('.statistics-workspace').scrollTop=0})
  await settle(page,'.statistics-workspace')

  await check('悬停任一圆点浮出对应题干（深色浮层）',async()=>{
    const hoverIndex=Math.min(7,target.items.length-1)
    await page.locator('.rail-item').nth(hoverIndex).hover()
    await page.waitForTimeout(200)
    const state=await railState(page)
    assert.ok(state.label,'悬停后没有浮层')
    assert.equal(state.label.text,String(target.items[hoverIndex].label||target.items[hoverIndex].title).trim())
    const labels=await page.locator('.rail-label').count()
    assert.equal(labels,1,'同时浮出了多个标签')
  })
  await page.screenshot({path:out+'/02-statistics-hover.png'})

  await check('键盘可达：Tab 进入轨道、方向键移动、Enter 定位',async()=>{
    await page.locator('.rail-toc').hover({position:{x:10,y:10}})
    await page.mouse.move(10,10)
    await page.evaluate(()=>document.activeElement&&document.activeElement.blur())
    let reached=false
    for(let i=0;i<90&&!reached;i++){
      await page.keyboard.press('Tab')
      reached=await page.evaluate(()=>!!document.activeElement&&document.activeElement.classList.contains('rail-item'))
    }
    assert.ok(reached,'Tab 无法聚焦到导航轨')
    const before=await page.evaluate(()=>{
      const el=document.activeElement
      return {index:Number(el.dataset.railIndex),label:el.getAttribute('aria-label'),tabbable:[...document.querySelectorAll('.rail-item')].filter(n=>n.tabIndex===0).length}
    })
    assert.equal(before.tabbable,1,'roving tabindex 不唯一')
    assert.ok(/^第 \d+ 题：/.test(before.label),'缺少中文 aria-label：'+before.label)
    await page.keyboard.press('ArrowDown')
    const after=await page.evaluate(()=>Number(document.activeElement.dataset.railIndex))
    assert.equal(after,Math.min(before.index+1,target.items.length-1),'ArrowDown 未移动焦点')
    await page.keyboard.press('Enter')
    await settle(page,'.statistics-workspace')
    await page.waitForTimeout(200)
    const state=await railState(page)
    assert.equal(state.active,after,'Enter 未定位到焦点项')
  })

  await check('切到「主题与报告」「访问与收集概览」时导航轨隐藏，切回恢复',async()=>{
    await page.getByRole('tab',{name:'主题与报告'}).click()
    await page.waitForTimeout(500)
    assert.equal((await railState(page)).visible,false,'research tab 仍显示 rail')
    await page.screenshot({path:out+'/04-statistics-research-tab.png'})
    await page.getByRole('tab',{name:'题目统计'}).click()
    await page.waitForTimeout(800)
    assert.equal((await railState(page)).visible,true,'切回 analysis tab 后 rail 没恢复')
  })

  await check('原有统计内容未变：图表、口径文案、tab 都在',async()=>{
    const info=await page.evaluate(()=>({
      canvas:document.querySelectorAll('.analysis-card canvas').length,
      text:document.querySelector('.analysis-container').innerText,
      tabs:[...document.querySelectorAll('.el-tabs__item')].map(el=>el.textContent.trim()),
      selectCount:document.querySelectorAll('.statistics-version .el-select').length
    }))
    assert.ok(info.canvas>0,'图表未渲染')
    assert.ok(info.text.includes('图表数值由后端计算'),'缺少后端口径文案')
    assert.ok(info.text.includes('有效人数占比'),'缺少有效人数占比列')
    assert.ok(info.text.includes('比例按本题有效回答人数计算'),'缺少比例口径说明')
    assert.deepEqual(info.tabs,['题目统计','主题与报告','访问与收集概览'])
    assert.equal(info.selectCount,1)
  })
  await page.evaluate(()=>{const ws=document.querySelector('.statistics-workspace');ws.scrollTop=0})
  await settle(page,'.statistics-workspace')
  await page.waitForTimeout(300)
  await page.screenshot({path:out+'/01-statistics-desktop.png'})
  await page.screenshot({path:out+'/01b-statistics-desktop-rail.png',clip:{x:1400,y:150,width:200,height:760}})

  // ---------- reduced motion ----------
  await check('prefers-reduced-motion 下取消平滑滚动与动画',async()=>{
    const reduced=await newLoggedInPage({width:1600,height:1000},{reducedMotion:'reduce'})
    watch(reduced,'statistics-reduced')
    await reduced.goto(statsUrl)
    await expect(reduced.locator('.analysis-card').first()).toBeVisible()
    await reduced.waitForTimeout(2000)
    const transition=await reduced.locator('.rail-item').first().evaluate(el=>getComputedStyle(el).transitionDuration)
    assert.equal(transition,'0s','reduced-motion 下仍有过渡动画')
    const index=Math.min(20,target.items.length-1)
    const started=Date.now()
    await reduced.locator('.rail-item').nth(index).click()
    await reduced.waitForTimeout(160)
    const info=await reduced.evaluate(i=>{
      const ws=document.querySelector('.statistics-workspace')
      const card=[...document.querySelectorAll('.analysis-container [id^="question-"]')][i]
      const cr=card.getBoundingClientRect(); const wr=ws.getBoundingClientRect()
      return {topOffset:cr.top-wr.top,active:Number(document.querySelector('.rail-item.is-active').dataset.railIndex)}
    },index)
    assert.ok(info.topOffset<200,'减少动效下没有立即定位：topOffset='+info.topOffset+' elapsed='+(Date.now()-started))
    assert.equal(info.active,index)
    await reduced.screenshot({path:out+'/05-statistics-reduced-motion.png'})
    await reduced.close()
  })

  // ---------- 移动端 ----------
  await check('移动端 390 宽：导航轨隐藏且无横向溢出',async()=>{
    const mobile=await newLoggedInPage({width:390,height:844},{deviceScaleFactor:2})
    watch(mobile,'statistics-mobile')
    await mobile.goto(statsUrl)
    await expect(mobile.locator('.analysis-card').first()).toBeVisible()
    await mobile.waitForTimeout(2000)
    const info=await mobile.evaluate(()=>{
      const rail=document.querySelector('.rail-toc')
      return {
        railInDom:!!rail,
        railDisplay:rail?getComputedStyle(rail).display:null,
        docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        cards:document.querySelectorAll('.analysis-card').length
      }
    })
    assert.ok(info.railInDom,'窄屏下导航轨不应参与布局')
    assert.equal(info.railDisplay,'none')
    assert.ok(info.docOverflow<=1,'移动端横向溢出 '+info.docOverflow)
    assert.equal(info.cards,target.items.length)
    await mobile.screenshot({path:out+'/06-statistics-mobile-390.png'})
    await mobile.close()
  })

  // ---------- 编辑器 ----------
  const editor=await newLoggedInPage({width:1600,height:1000})
  watch(editor,'editor')
  shotPage=editor
  await editor.goto(editorUrl)
  await expect(editor.locator('.question-card').first()).toBeVisible()
  await editor.waitForTimeout(2500)

  await check('编辑器：导航轨显示，圆点数量 = 题目卡片数量',async()=>{
    const state=await railState(editor)
    const cards=await editor.locator('.question-card').count()
    assert.ok(state.visible,'编辑器 rail 不可见')
    assert.equal(state.count,cards,'圆点数与题卡数不一致')
    assert.equal(state.active,0)
    assert.equal(state.navLabel,'题目导航')
  })

  await check('编辑器：导航轨不遮挡右侧设置面板与题卡，无横向溢出',async()=>{
    const geo=await editor.evaluate(()=>{
      const rail=document.querySelector('.rail-toc').getBoundingClientRect()
      const config=document.querySelector('.designer-config').getBoundingClientRect()
      const cards=[...document.querySelectorAll('.question-card')].map(el=>el.getBoundingClientRect())
      const canvas=document.querySelector('.designer-canvas').getBoundingClientRect()
      const tools=document.querySelector('.question-card .question-tools').getBoundingClientRect()
      return {rail:{left:rail.left,right:rail.right},config:{left:config.left,right:config.right},
        maxCardRight:Math.max(...cards.map(r=>r.right)),minCardLeft:Math.min(...cards.map(r=>r.left)),
        toolsRight:tools.right,canvas:{left:canvas.left,right:canvas.right},
        docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}
    })
    assert.ok(geo.rail.right<=geo.config.left,'rail 压到右侧设置面板')
    assert.ok(geo.rail.left>=geo.maxCardRight-1,'rail 压住题卡')
    assert.ok(geo.rail.left>=geo.toolsRight,'rail 压住题卡工具按钮')
    assert.ok(geo.rail.left>=geo.canvas.left&&geo.rail.right<=geo.canvas.right,'rail 超出编辑画布列')
    assert.ok(geo.docOverflow<=1,'编辑器横向溢出 '+geo.docOverflow)
  })
  await editor.screenshot({path:out+'/07-editor-desktop.png'})

  await check('编辑器：点击导航项滚动到题卡并选中该题',async()=>{
    const index=Math.min(target.items.length-1,Math.max(5,Math.round(target.items.length*0.4)))
    await editor.locator('.rail-item').nth(index).click()
    await settle(editor,'.designer-canvas')
    await editor.waitForTimeout(300)
    const info=await editor.evaluate(i=>{
      const canvas=document.querySelector('.designer-canvas')
      const cards=[...document.querySelectorAll('.question-card')]
      const card=cards[i]; const cr=card.getBoundingClientRect(); const wr=canvas.getBoundingClientRect()
      return {inView:cr.top>=wr.top-2&&cr.top<wr.bottom-40, topOffset:Math.round(cr.top-wr.top),
        active:Number(document.querySelector('.rail-item.is-active').dataset.railIndex),
        selected:card.classList.contains('selected'),
        selectedText:(document.querySelector('.question-card.selected strong')||{}).textContent||'',
        label:(document.querySelector('.rail-label')||{}).textContent||''}
    },index)
    assert.ok(info.inView,'题卡未滚入编辑画布视口')
    assert.ok(info.topOffset>=0&&info.topOffset<160,'题卡未定位到画布上部：'+info.topOffset)
    assert.equal(info.active,index)
    assert.ok(info.selected,'点击导航后未选中该题')
    assert.ok(info.selectedText.includes(String(target.items[index].label||'').slice(0,8)),'选中的不是同一题')
    assert.equal(info.label.trim(),String(target.items[index].label||target.items[index].title).trim())
  })
  await editor.screenshot({path:out+'/08-editor-clicked.png'})

  await check('编辑器移动端 390 宽：导航轨隐藏，不遮挡设置面板',async()=>{
    const mobile=await newLoggedInPage({width:390,height:844},{deviceScaleFactor:2})
    watch(mobile,'editor-mobile')
    await mobile.goto(editorUrl)
    await expect(mobile.locator('.question-card').first()).toBeVisible()
    await mobile.waitForTimeout(2000)
    const info=await mobile.evaluate(()=>{
      const rail=document.querySelector('.rail-toc')
      return {railDisplay:rail?getComputedStyle(rail).display:null,
        docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        cards:document.querySelectorAll('.question-card').length}
    })
    assert.equal(info.railDisplay,'none')
    assert.ok(info.docOverflow<=1,'移动端横向溢出 '+info.docOverflow)
    assert.ok(info.cards>0)
    await mobile.screenshot({path:out+'/09-editor-mobile-390.png'})
    await mobile.close()
  })

  await check('页面没有未捕获异常',async()=>{
    if(pageErrors.length)throw Error(pageErrors.slice(0,3).join(' | '))
  })

  const failed=checks.filter(c=>!c.passed)
  fs.writeFileSync(out+'/results.json',JSON.stringify({
    date:new Date().toISOString(),
    survey:{name:target.name,formKey:target.formKey,versionNo:target.versionNo,answers:target.answerCount,questions:target.items.length},
    urls:{statistics:statsUrl,editor:editorUrl},
    checks,total:checks.length,passed:checks.length-failed.length,failed:failed.length,
    pageErrors,consoleErrors:consoleErrors.slice(0,10),
    screenshots:fs.readdirSync(out).filter(f=>f.endsWith('.png')).sort()
  },null,2)+'\n')
  console.log('\n'+(checks.length-failed.length)+'/'+checks.length+' checks passed')
  if(failed.length)process.exitCode=1
}finally{
  await browser.close()
}
