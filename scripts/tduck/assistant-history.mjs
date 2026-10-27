// 对话历史：深色抽屉 + 删除功能回归（真实后端 + 真实浏览器）
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require = createRequire(path.resolve('tduck-vue3/package.json'))
const {chromium} = require('@playwright/test')
const cred = JSON.parse(fs.readFileSync('.local/tduck-credentials.json', 'utf8').replace(/^\uFEFF/, ''))
const out = 'evidence/tduck-full/assistant-layout'
fs.mkdirSync(out, {recursive: true})
const BACKEND = 'http://127.0.0.1:8997'

const login = await (await fetch(BACKEND + '/login/account', {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({account: cred.adminEmail, password: cred.adminPassword})
})).json()
if (login.code !== 200) throw Error('admin login failed')
const token = login.data.token
const api = async (method, url, body) => {
  const res = await fetch(BACKEND + url, {
    method, headers: {'Content-Type': 'application/json', token},
    ...(body ? {body: JSON.stringify(body)} : {})
  })
  return res.json()
}

const checks = []
const check = async (name, fn) => {
  try { const detail = await fn(); checks.push({name, passed: true, detail}); console.log('PASS ' + name) }
  catch (e) { checks.push({name, passed: false, error: e.message.slice(0, 300)}); console.log('FAIL ' + name + ': ' + e.message.slice(0, 200)) }
}

// 1) 后端接口：创建 → 出现在列表 → 删除 → 从列表消失 → 重复删除被拒 → 非法 id 被拒
const created = await api('POST', '/user/form/assistant/conversations')
const createdId = created && created.data && created.data.id
await check('后端：新建对话后出现在历史列表', async () => {
  if (created.code !== 200 || !createdId) throw Error('create failed: ' + JSON.stringify(created).slice(0, 150))
  const list = await api('GET', '/user/form/assistant/conversations')
  if (!list.data.some((c) => c.id === createdId)) throw Error('conversation not listed')
})
await check('后端：删除后从历史列表消失', async () => {
  const del = await api('POST', '/user/form/assistant/conversations/' + createdId + '/delete')
  if (del.code !== 200 || del.data.deleted !== true) throw Error('delete failed: ' + JSON.stringify(del).slice(0, 150))
  const list = await api('GET', '/user/form/assistant/conversations')
  if (list.data.some((c) => c.id === createdId)) throw Error('conversation still listed')
})
await check('后端：重复删除与非法编号被拒绝', async () => {
  const again = await api('POST', '/user/form/assistant/conversations/' + createdId + '/delete')
  if (again.code === 200) throw Error('second delete unexpectedly succeeded')
  const bad = await api('POST', '/user/form/assistant/conversations/not-a-uuid/delete')
  if (bad.code === 200) throw Error('malformed id unexpectedly succeeded')
})

// 2) 浏览器：抽屉深色 + 有删除按钮 + UI 删除生效
const uiCreated = await api('POST', '/user/form/assistant/conversations')
const uiId = uiCreated.data.id
const browser = await chromium.launch({channel: 'msedge', headless: true})
let countBefore = 0
let countAfter = 0
try {
  const page = await browser.newPage({viewport: {width: 1600, height: 900}})
  page.setDefaultTimeout(20000)
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e).slice(0, 150)))
  await page.addInitScript(({t, info}) => { localStorage.setItem('token', t); localStorage.setItem('userInfo', JSON.stringify(info)) }, {t: token, info: {name: 'admin', admin: true, email: cred.adminEmail}})
  await page.goto('http://127.0.0.1:5180/home/assistant', {waitUntil: 'networkidle'})
  await page.waitForTimeout(2000)
  await page.getByRole('button', {name: '历史', exact: true}).click()
  await page.waitForTimeout(2500)
  await page.screenshot({path: out + '/history-drawer.png'})

  await check('抽屉：深色底、标题可读、每条都有删除按钮', async () => {
    const info = await page.evaluate(() => {
      const drawer = document.querySelector('.el-drawer')
      const body = document.querySelector('.el-drawer__body')
      const title = document.querySelector('.el-drawer__title')
      const items = [...document.querySelectorAll('.conversation-item')]
      return {
        drawerBg: drawer ? getComputedStyle(drawer).backgroundColor : null,
        bodyBg: body ? getComputedStyle(body).backgroundColor : null,
        titleColor: title ? getComputedStyle(title).color : null,
        items: items.length,
        deletes: document.querySelectorAll('.conversation-delete').length,
        titleColors: [...document.querySelectorAll('.conversation-title')].slice(0, 3).map((el) => getComputedStyle(el).color)
      }
    })
    if (info.drawerBg !== 'rgb(20, 34, 53)' || info.bodyBg !== 'rgb(20, 34, 53)') throw Error('drawer not dark: ' + JSON.stringify(info))
    if (info.items === 0) throw Error('no history items')
    if (info.deletes !== info.items) throw Error('some items lack delete button: ' + JSON.stringify(info))
    const dark = info.titleColors.every((c) => c !== 'rgb(29, 41, 57)')
    if (!dark) throw Error('title still light-theme colour: ' + JSON.stringify(info.titleColors))
    return info
  })

  countBefore = await page.locator('.conversation-item').count()
  await page.locator('.conversation-item').first().locator('.conversation-delete').click()
  await page.waitForTimeout(800)
  await page.screenshot({path: out + '/history-delete-confirm.png'})
  await check('抽屉：删除前有二次确认', async () => {
    const box = page.locator('.el-message-box')
    if (!(await box.isVisible())) throw Error('confirm dialog missing')
    const text = await box.innerText()
    if (!text.includes('删除')) throw Error('confirm text: ' + text.slice(0, 80))
  })
  await page.getByRole('button', {name: '删除', exact: true}).click()
  await page.waitForTimeout(2500)
  countAfter = await page.locator('.conversation-item').count()
  await page.screenshot({path: out + '/history-after-delete.png'})
  await check('抽屉：确认后条目从列表移除', async () => {
    if (!(countAfter < countBefore)) throw Error('count did not drop: ' + countBefore + ' -> ' + countAfter)
  })
  await check('抽屉：UI 删除的新对话确实已从后端删除', async () => {
    const list = await api('GET', '/user/form/assistant/conversations')
    if (list.data.some((c) => c.id === uiId)) throw Error('ui conversation still exists')
  })
  await check('抽屉：操作过程无运行时报错', async () => { if (pageErrors.length) throw Error(pageErrors[0]) })
} finally {
  await browser.close()
  const report = {
    date: new Date().toISOString(),
    source: '真实浏览器 5180 + 真实后端 8997（管理员账号），新建/删除的是本轮临时对话',
    checks,
    createdForApi: createdId,
    createdForUi: uiId,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length
  }
  fs.writeFileSync(out + '/history-results.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({passed: report.passed, failed: report.failed, items: [countBefore, countAfter]}))
}
if (checks.some((c) => !c.passed)) process.exitCode = 1
