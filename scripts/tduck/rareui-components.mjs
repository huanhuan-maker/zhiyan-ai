import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const {chromium}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const out='evidence/tduck-full/rareui-reference'
const browser=await chromium.launch({channel:'msedge',headless:true})
const ctx=await browser.newContext({viewport:{width:1440,height:1000}})
const page=await ctx.newPage()
await page.goto('https://www.rareui.com/components',{waitUntil:'networkidle',timeout:60000}).catch(()=>{})
await page.waitForTimeout(2000)
await page.screenshot({path:out+'/02-components.png'})
const items=await page.evaluate(()=>{
  const cards=[...document.querySelectorAll('a[href^="/components/"]')].map(a=>({href:a.getAttribute('href'),text:a.innerText.replace(/\s+/g,' ').trim().slice(0,120)}))
  const seen=new Set();const unique=[];for(const c of cards){if(!seen.has(c.href)){seen.add(c.href);unique.push(c)}}
  return{hrefs:unique.map(c=>c.href),samples:unique.slice(0,40)}
})
fs.writeFileSync(out+'/components.json',JSON.stringify(items,null,2))
console.log('COUNT',items.hrefs.length)
console.log(items.hrefs.join('\n'))
console.log('SAMPLES',JSON.stringify(items.samples.slice(0,15)))
await browser.close()
