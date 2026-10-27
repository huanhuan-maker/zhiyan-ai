// 工作台视觉回归（深色全覆盖）：工作台 + 管理页 + 助手 + 问卷编辑器全部子页面。
// 断言：无运行时报错、无浅色残留块、正文对比度 >= 4.5、不再有主题切换入口。
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require = createRequire(path.resolve('tduck-vue3/package.json'))
const {chromium} = require('@playwright/test')
const cred = JSON.parse(fs.readFileSync('.local/tduck-credentials.json', 'utf8').replace(/^\uFEFF/, ''))
const out = 'evidence/tduck-full/workbench-visual'
fs.mkdirSync(out, {recursive: true})
const FORM_KEY = process.env.FORM_KEY || 'cYtMpVqA'

const PAGES = [
  {name: 'home', url: '/home'},
  {name: 'manage-user', url: '/manage/user'},
  {name: 'manage-system', url: '/manage/system'},
  {name: 'assistant', url: '/home/assistant'},
  {name: 'form-editor', url: '/project/form/editor?key=' + FORM_KEY},
  {name: 'form-logic', url: '/project/form/logic?key=' + FORM_KEY},
  {name: 'form-theme', url: '/project/form/theme?key=' + FORM_KEY},
  {name: 'form-setting', url: '/project/form/setting?key=' + FORM_KEY},
  {name: 'form-publish', url: '/project/form/publish?key=' + FORM_KEY},
  {name: 'form-data', url: '/project/form/data?key=' + FORM_KEY},
  {name: 'form-statistics', url: '/project/form/statistics?key=' + FORM_KEY},
  {name: 'form-preview', url: '/project/form/preview?key=' + FORM_KEY},
  {name: 'form-ai-draft', url: '/project/form/ai-draft?key=' + FORM_KEY}
]
// 允许：装饰性头像字母、富文本编辑器内部（TinyMCE 自带皮肤，iframe 内容）
const CONTRAST_ALLOWLIST = ['avatar-text', 'tox-']
const LIGHT_LEAK_ALLOWLIST = ['tox-']

const login = await (await fetch('http://127.0.0.1:8997/login/account', {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({account: cred.adminEmail, password: cred.adminPassword})
})).json()
if (login.code !== 200) throw Error('admin login failed: ' + login.msg)

const auditPage = (cfg) => {
  const {CONTRAST_ALLOWLIST, LIGHT_LEAK_ALLOWLIST} = cfg
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1} }
  const lum = ({r, g, b}) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.6) return c; n = n.parentElement } return parse(getComputedStyle(document.body).backgroundColor) }
  const ratio = (fg, bg) => { const a = lum(fg), b = lum(bg), hi = Math.max(a, b), lo = Math.min(a, b); return (hi + 0.05) / (lo + 0.05) }
  const allowed = (el) => CONTRAST_ALLOWLIST.some((t) => String(el.className || '').includes(t))
  const lightBlocks = []
  const lowContrast = []
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return
    const box = el.getBoundingClientRect()
    const bg = parse(cs.backgroundColor)
    if (bg && bg.a > 0.6 && lum(bg) > 0.72 && box.width >= 40 && box.height >= 24) {
      if (!LIGHT_LEAK_ALLOWLIST.some((t) => String(el.className || '').includes(t))) lightBlocks.push({cls: String(el.className).slice(0, 60), bg: cs.backgroundColor})
    }
    if (!el.childNodes.length || allowed(el)) return
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('')
    if (!text) return
    if (Number(cs.opacity) < 0.5) return
    const fg = parse(cs.color)
    if (!fg || box.width < 8 || box.height < 8) return
    const value = ratio(fg, bgOf(el))
    if (value < 4.5) lowContrast.push({text: text.slice(0, 20), cls: String(el.className).slice(0, 40), ratio: Math.round(value * 100) / 100})
  })
  return {
    dark: document.documentElement.classList.contains('zy-dark'),
    toggles: document.querySelectorAll('.theme-toggle-btn, .header-theme-btn, .ai-theme-toggle').length,
    lightBlocks: lightBlocks.slice(0, 10), lightBlockCount: lightBlocks.length,
    lowContrast: lowContrast.slice(0, 10), lowContrastCount: lowContrast.length,
    tableHeaderBg: (() => { const el = document.querySelector('.el-table th.el-table__cell'); return el ? getComputedStyle(el).backgroundColor : null })()
  }
}

const browser = await chromium.launch({channel: 'msedge', headless: true})
const checks = []
const check = async (name, fn) => {
  try { const detail = await fn(); checks.push({name, passed: true, detail}); console.log('PASS ' + name) }
  catch (e) { checks.push({name, passed: false, error: e.message.slice(0, 400)}); console.log('FAIL ' + name + ': ' + e.message.slice(0, 200)) }
}

try {
  const page = await browser.newPage({viewport: {width: 1600, height: 900}})
  page.setDefaultTimeout(25000)
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e).slice(0, 160)))
  await page.addInitScript(({token, info}) => {
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify(info))
  }, {token: login.data.token, info: {name: 'admin', admin: true, email: cred.adminEmail}})

  for (const pageDef of PAGES) {
    await page.goto('http://127.0.0.1:5180' + pageDef.url, {waitUntil: 'networkidle'})
    await page.waitForTimeout(1800)
    const state = await page.evaluate(auditPage, {CONTRAST_ALLOWLIST, LIGHT_LEAK_ALLOWLIST})
    await page.screenshot({path: out + '/dark-' + pageDef.name + '.png'})

    await check('dark / ' + pageDef.name + '：深色类生效且无主题切换入口', async () => {
      if (!state.dark) throw Error('zy-dark missing')
      if (state.toggles !== 0) throw Error('theme toggles still rendered: ' + state.toggles)
    })
    await check('dark / ' + pageDef.name + '：无运行时报错', async () => {
      if (pageErrors.length) throw Error(pageErrors[0])
    })
    await check('dark / ' + pageDef.name + '：没有浅色残留块', async () => {
      if (state.lightBlockCount) throw Error(JSON.stringify(state.lightBlocks))
    })
    await check('dark / ' + pageDef.name + '：正文文字对比度 >= 4.5', async () => {
      if (state.lowContrastCount) throw Error(JSON.stringify(state.lowContrast))
    })
  }

  await page.goto('http://127.0.0.1:5180/home', {waitUntil: 'networkidle'})
  await page.waitForTimeout(1200)
  await check('dark / home：既有深色底值未被改坏', async () => {
    const colors = await page.evaluate(() => {
      const pick = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).backgroundColor : null }
      return {home: pick('.home-container'), card: pick('.project-card-item'), nav: pick('.menu-item-active')}
    })
    const expected = {home: 'rgb(12, 24, 41)', card: 'rgb(20, 34, 53)', nav: 'rgb(23, 49, 55)'}
    for (const [key, value] of Object.entries(expected)) if (colors[key] !== value) throw Error(key + ' = ' + colors[key])
  })

  await page.goto('http://127.0.0.1:5180/manage/user', {waitUntil: 'networkidle'})
  await page.waitForTimeout(1500)
  await check('dark / manage-user：表头为深色令牌而非白底', async () => {
    const bg = await page.evaluate(() => { const el = document.querySelector('.el-table th.el-table__cell'); return el ? getComputedStyle(el).backgroundColor : null })
    if (bg !== 'rgb(17, 30, 48)') throw Error('table header bg = ' + bg)
  })
  await page.close()
} finally {
  await browser.close()
  const report = {
    date: new Date().toISOString(),
    source: '真实浏览器 5180 + 隔离后端 8997 + 管理员账号（.local/tduck-credentials.json），只读浏览，不提交答卷',
    theme: 'dark only（不再提供浅色切换）',
    checks,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length
  }
  fs.writeFileSync(out + '/results.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({passed: report.passed, failed: report.failed}))
}
if (checks.some((c) => !c.passed)) process.exitCode = 1
