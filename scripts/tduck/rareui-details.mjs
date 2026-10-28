import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const {chromium}=createRequire(path.resolve('tduck-vue3/package.json'))('@playwright/test')
const out='evidence/tduck-full/rareui-reference'
const pages=['aistatus','animatedcounter','bouncesidebar','gridreveal','scrollprogressindicator','stepplayer','foldercomponent']
const browser=await chromium.launch({channel:'msedge',headless:true})
const ctx=await browser.newContext({viewport:{width:1440,height:1000}})
const page=await ctx.newPage();page.setDefaultTimeout(45000)
const info={}
for(const name of pages){
  try{
    await page.goto('https://www.rareui.com/components/'+name,{waitUntil:'domcontentloaded',timeout:45000})
    await page.waitForTimeout(2600)
    await page.screenshot({path:out+'/'+name+'.png'})
    info[name]=await page.evaluate(()=>{
      const h=[...document.querySelectorAll('h1,h2,h3')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,10)
      return{heads:h,text:document.body.innerText.replace(/\s+/g,' ').slice(0,700)}
    })
    console.log('OK',name)
  }catch(e){console.log('FAIL',name,String(e.message).slice(0,120))}
}
fs.writeFileSync(out+'/details.json',JSON.stringify(info,null,2))
await browser.close()
