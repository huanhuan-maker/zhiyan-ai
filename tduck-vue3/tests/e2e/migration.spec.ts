import {test,expect} from '@playwright/test'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {resolve} from 'node:path'
import {writeFileSync} from 'node:fs'
const exec=promisify(execFile)
for(const script of ['smoke-full','feature-flows','settings-flows','workspace-menu','data-roundtrip','backend-security','question-roundtrip','choice-flows','closure-flows']){
 test(script+' real backend workflow',async()=>{
  let stdout:string
  try{
   ({stdout}=await exec(process.execPath,[`scripts/tduck/${script}.mjs`],{cwd:resolve('..'),timeout:110000,maxBuffer:1024*1024}))
  }catch(error:any){
   writeFileSync(resolve(`../.local/tduck-full-audit/${script}-failed.log`),String(error.stdout||'')+'\n'+String(error.stderr||''))
   throw error
  }
  writeFileSync(resolve(`../evidence/tduck-full/${script}.log`),stdout)
  expect(stdout).not.toContain('"failure"')
 })
}
test('anonymous owner page requires login',async({page})=>{
 await page.goto('/home')
 await expect(page).toHaveURL(/\/login\?redirect=/)
 await expect(page.getByPlaceholder('请输入手机号 / 邮箱')).toBeVisible()
})
test('wrong password stays on login and displays server error',async({page})=>{
 await page.goto('/login')
 await page.getByPlaceholder('请输入手机号 / 邮箱').fill('invalid-migration-user@example.test')
 await page.getByPlaceholder('请输入密码',{exact:true}).fill('SyntheticWrongPassword!42')
 await page.getByRole('button',{name:'登 录',exact:true}).click()
 await expect(page.locator('.el-message--error')).toBeVisible()
 await expect(page).toHaveURL(/\/login/)
})
test('invalid token is rejected by real backend and removed locally',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('token','expired-acceptance-token');localStorage.setItem('userInfo','{}')})
 await page.goto('/home')
 await expect(page.getByText('登录状态已过期，您可以继续留在该页面，或者重新登录',{exact:true})).toBeVisible()
 expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull()
 await page.getByRole('button',{name:'重新登录',exact:true}).click()
 await expect(page).toHaveURL(/\/login/)
})
