import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const {chromium}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const out='evidence/tduck-full/rareui-reference';fs.mkdirSync(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const ctx=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1})
const page=await ctx.newPage()
await page.goto('https://www.rareui.com/',{waitUntil:'networkidle',timeout:60000}).catch(()=>{})
await page.waitForTimeout(2500)
await page.screenshot({path:out+'/01-home.png'})
const info=await page.evaluate(()=>{
  const heads=[...document.querySelectorAll('h1,h2,h3')].map(h=>h.textContent.trim()).filter(Boolean).slice(0,60)
  const links=[...document.querySelectorAll('a[href^="/"]')].map(a=>a.getAttribute('href')).filter(Boolean)
  const unique=[...new Set(links)].slice(0,80)
  const bodyText=document.body.innerText.slice(0,3000)
  return{title:document.title,heads,links:unique,bodyText}
})
fs.writeFileSync(out+'/page-info.json',JSON.stringify(info,null,2))
console.log('TITLE',info.title)
console.log('HEADS',JSON.stringify(info.heads))
console.log('LINKS',JSON.stringify(info.links.slice(0,60)))
console.log('BODY',info.bodyText.slice(0,1500))
await browser.close()
