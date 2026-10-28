// 系统配置页深色回归：逐个标签页点击后审计浅色残留与文字对比度（异步加载后再审计）。
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const {chromium}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const cred=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const out='evidence/tduck-full/system-dark-tabs', base='http://127.0.0.1:5180'
fs.mkdirSync(out,{recursive:true})
const TABS=[
  {name:'system',label:'系统配置'},
  {name:'file',label:'文件存储'},
  {name:'email',label:'邮件配置'},
  {name:'sms',label:'短信配置'},
  {name:'wxmp',label:'微信公众号'},
  {name:'ai',label:'AI 配置',ready:'[data-testid="provider-card"], [data-testid="model-card"], .el-empty'}
]
const login=await (await fetch('http://127.0.0.1:8997/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:cred.adminEmail,password:cred.adminPassword})})).json()
if(login.code!==200)throw Error('login failed')
const user=JSON.stringify({name:'管理员',admin:true,avatar:'',token:login.data.token})
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:1000}})
await context.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('userInfo',user)},{token:login.data.token,user})
const page=await context.newPage();page.setDefaultTimeout(15000)
const errors=[];page.on('pageerror',e=>errors.push(e.message))
const checks=[]
const audit=()=>page.evaluate(()=>{
  const parse=(c)=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(Number);return{r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}}
  const lum=({r,g,b})=>{const f=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)}
  const bgOf=(el)=>{let n=el;while(n&&n!==document.documentElement){const c=parse(getComputedStyle(n).backgroundColor);if(c&&c.a>0.6)return c;n=n.parentElement}return parse(getComputedStyle(document.body).backgroundColor)}
  const ratio=(a,b)=>{const x=lum(a),y=lum(b),hi=Math.max(x,y),lo=Math.min(x,y);return (hi+0.05)/(lo+0.05)}
  const leaks=[],low=[]
  document.querySelectorAll('.config-card *, .ai-settings *').forEach(el=>{
    const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')return
    const box=el.getBoundingClientRect()
    const bg=parse(cs.backgroundColor)
    if(bg&&bg.a>0.6&&lum(bg)>0.72&&box.width>=40&&box.height>=24)leaks.push({cls:String(el.className).slice(0,70),bg:cs.backgroundColor})
    if(!el.childNodes.length)return
    const text=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('')
    if(!text||box.width<8||box.height<8)return
    if(String(el.className||'').includes('avatar-text'))return
    const fg=parse(cs.color)
    if(!fg)return
    const r=ratio(fg,bgOf(el))
    if(r<4.5)low.push({text:text.slice(0,24),cls:String(el.className).slice(0,50),ratio:Math.round(r*100)/100})
  })
  return{dark:document.documentElement.classList.contains('zy-dark'),leaks:leaks.slice(0,8),leakCount:leaks.length,low:low.slice(0,8),lowCount:low.length}
})
function check(name,fn){return Promise.resolve().then(fn).then(()=>{checks.push({name,passed:true});console.log('PASS '+name)},e=>{checks.push({name,passed:false,error:e.message.slice(0,700)});console.log('FAIL '+name+': '+e.message.slice(0,260))})}
try{
  await page.goto(base+'/manage/system')
  await page.locator('.modern-tabs').waitFor()
  for(const tab of TABS){
    await page.getByRole('tab',{name:tab.label,exact:true}).click()
    if(tab.ready)await page.locator(tab.ready).first().waitFor()
    await page.waitForTimeout(700)
    await check('深色 / '+tab.label+'：没有浅色残留',async()=>{
      const a=await audit()
      if(!a.dark)throw Error('zy-dark 丢失')
      if(a.leakCount)throw Error('浅色块 '+a.leakCount+' 个：'+JSON.stringify(a.leaks))
    })
    await check('深色 / '+tab.label+'：输入框文字与背景对比度 >= 4.5',async()=>{
      const bad=await page.evaluate(()=>{
        const parse=(c)=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(Number);return{r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}}
        const lum=({r,g,b})=>{const f=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)}
        const bgOf=(el)=>{let n=el;while(n&&n!==document.documentElement){const c=parse(getComputedStyle(n).backgroundColor);if(c&&c.a>0.6)return c;n=n.parentElement}return parse(getComputedStyle(document.body).backgroundColor)}
        const ratio=(a,b)=>{const x=lum(a),y=lum(b),hi=Math.max(x,y),lo=Math.min(x,y);return (hi+0.05)/(lo+0.05)}
        const out=[]
        document.querySelectorAll('.config-card input, .config-card textarea').forEach(el=>{
          if(['checkbox','radio','hidden','range','color','file'].includes(el.type))return
          const cs=getComputedStyle(el)
          if(cs.visibility==='hidden'||cs.display==='none')return
          const fg=parse(cs.color);if(!fg)return
          const r=ratio(fg,bgOf(el))
          if(r<4.5)out.push({type:el.type||'textarea',cls:String(el.className).slice(0,40),fg:cs.color,ratio:Math.round(r*100)/100})
        })
        return out
      })
      if(bad.length)throw Error('输入框低对比 '+bad.length+' 处：'+JSON.stringify(bad.slice(0,5)))
    })
    await check('深色 / '+tab.label+'：正文对比度 >= 4.5',async()=>{
      const a=await audit()
      if(a.lowCount)throw Error('低对比 '+a.lowCount+' 处：'+JSON.stringify(a.low))
    })
    await page.screenshot({path:out+'/'+tab.name+'.png'})
  }
  await check('没有运行时错误',async()=>{if(errors.length)throw Error(errors.join(' | '))})
  const failed=checks.filter(c=>!c.passed)
  fs.writeFileSync(out+'/results.json',JSON.stringify({date:new Date().toISOString(),checks,total:checks.length,passed:checks.length-failed.length,failed:failed.length,errors},null,2)+'\n')
  console.log('\n'+(checks.length-failed.length)+'/'+checks.length+' checks passed')
  if(failed.length)process.exitCode=1
}finally{await browser.close()}
