// 工作台视觉回归：浅色主题质感 + 深色不出现浅色残留 / 低对比文字。
// 真实浏览器跑 5180，隔离后端 8997，管理员账号来自 .local/tduck-credentials.json。
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require = createRequire(path.resolve('tduck-vue3/package.json'))
const {chromium} = require('@playwright/test')
const cred = JSON.parse(fs.readFileSync('.local/tduck-credentials.json', 'utf8').replace(/^\uFEFF/, ''))
const out = 'evidence/tduck-full/workbench-visual'
fs.mkdirSync(out, {recursive: true})

const PAGES = [
  {name: 'home', url: '/home'},
  {name: 'manage-user', url: '/manage/user'},
  {name: 'manage-system', url: '/manage/system'},
  {name: 'assistant', url: '/home/assistant'}
]
// 允许的低对比：装饰头像字母、禁用按钮、富文本编辑器内部
const CONTRAST_ALLOWLIST = ['avatar-text', 'tox-', 'is-disabled']
const LIGHT_LEAK_ALLOWLIST = ['tox-']

const login = await (await fetch('http://127.0.0.1:8997/login/account', {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({account: cred.adminEmail, password: cred.adminPassword})
})).json()
if (login.code !== 200) throw Error('admin login failed: ' + login.msg)
const userInfo = {name: 'admin', admin: true, email: cred.adminEmail}

const browser = await chromium.launch({channel: 'msedge', headless: true})
const checks = []
async function check(name, fn) {
  try {
    const detail = await fn()
    checks.push({name, passed: true, detail})
    console.log('PASS ' + name)
  } catch (e) {
    checks.push({name, passed: false, error: e.message.slice(0, 500)})
    console.log('FAIL ' + name + ': ' + e.message.slice(0, 220))
  }
}

const auditPage = (cfg) => {
  const {CONTRAST_ALLOWLIST, LIGHT_LEAK_ALLOWLIST} = cfg
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1} }
  const lum = ({r, g, b}) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.6) return c; n = n.parentElement } return parse(getComputedStyle(document.body).backgroundColor) }
  const ratio = (fg, bg) => { const a = lum(fg), b = lum(bg), hi = Math.max(a, b), lo = Math.min(a, b); return (hi + 0.05) / (lo + 0.05) }
  const allow = (el, list) => list.some((token) => [el, ...el.parentElement ? [el.parentElement] : []].some((n) => String(n.className || '').includes(token)))
  const lightBlocks = []
  const lowContrast = []
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el)
    const bg = parse(cs.backgroundColor)
    const box = el.getBoundingClientRect()
    if (bg && bg.a > 0.6 && lum(bg) > 0.72 && box.width >= 40 && box.height >= 24) {
      if (!LIGHT_LEAK_ALLOWLIST.some((t) => String(el.className || '').includes(t))) lightBlocks.push({cls: String(el.className).slice(0, 60), bg: cs.backgroundColor})
    }
    if (!el.childNodes.length || allow(el, CONTRAST_ALLOWLIST)) return
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('')
    if (!text) return
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.5) return
    const fg = parse(cs.color)
    if (!fg || box.width < 8 || box.height < 8) return
    const value = ratio(fg, bgOf(el))
    if (value < 4.5) lowContrast.push({text: text.slice(0, 20), cls: String(el.className).slice(0, 40), ratio: Math.round(value * 100) / 100})
  })
  const probe = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null }
  return {
    dark: document.documentElement.classList.contains('zy-dark'),
    lightBlocks: lightBlocks.slice(0, 10), lightBlockCount: lightBlocks.length,
    lowContrast: lowContrast.slice(0, 10), lowContrastCount: lowContrast.length,
    tableHeaderBg: probe('.el-table th.el-table__cell', 'backgroundColor'),
    homeBg: probe('.home-container', 'backgroundColor'),
    homeImage: (probe('.home-container', 'backgroundImage') || '').slice(0, 40),
    cardBg: probe('.project-card-item', 'backgroundColor'),
    activeNavBg: probe('.menu-item-active', 'backgroundColor'),
    assistantBg: probe('.assistant-page', 'backgroundColor'),
    titleBarWidth: (() => { const el = document.querySelector('.page-title'); if (!el) return null; return getComputedStyle(el, '::before').width })()
  }
}

try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({viewport: {width: 1600, height: 900}})
    page.setDefaultTimeout(20000)
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e).slice(0, 160)))
    await page.addInitScript(({token, th, info}) => {
      localStorage.setItem('token', token)
      localStorage.setItem('userInfo', JSON.stringify(info))
      localStorage.setItem('zhiyan-workbench-theme', th)
    }, {token: login.data.token, th: theme, info: userInfo})
    for (const pageDef of PAGES) {
      await page.goto('http://127.0.0.1:5180' + pageDef.url, {waitUntil: 'networkidle'})
      await page.waitForTimeout(1600)
      const state = await page.evaluate(auditPage, {CONTRAST_ALLOWLIST, LIGHT_LEAK_ALLOWLIST})
      await page.screenshot({path: out + '/' + theme + '-' + pageDef.name + '.png'})

      await check(theme + ' / ' + pageDef.name + '：无运行时报错', async () => {
        if (pageErrors.length) throw Error(pageErrors[0])
      })
      if (theme === 'dark') {
        await check('dark / ' + pageDef.name + '：没有浅色残留块', async () => {
          if (state.lightBlockCount) throw Error(JSON.stringify(state.lightBlocks))
        })
      }
      await check(theme + ' / ' + pageDef.name + '：正文文字对比度 >= 4.5', async () => {
        if (state.lowContrastCount) throw Error(JSON.stringify(state.lowContrast))
      })
      if (pageDef.name === 'manage-user' && theme === 'dark') {
        await check('dark / manage-user：表头是深色令牌而不是白底', async () => {
          if (state.tableHeaderBg !== 'rgb(17, 30, 48)') throw Error('table header bg = ' + state.tableHeaderBg)
        })
      }
      if (pageDef.name === 'home' && theme === 'dark') {
        await check('dark / home：既有深色底值未被改坏', async () => {
          const expected = {homeBg: 'rgb(12, 24, 41)', cardBg: 'rgb(20, 34, 53)', activeNavBg: 'rgb(23, 49, 55)'}
          for (const [key, value] of Object.entries(expected)) if (state[key] !== value) throw Error(key + ' = ' + state[key] + ' expected ' + value)
        })
      }
      if (pageDef.name === 'assistant' && theme === 'dark') {
        await check('dark / assistant：页面底色保持既有深色', async () => {
          if (state.assistantBg !== 'rgb(12, 24, 41)') throw Error('assistant bg = ' + state.assistantBg)
        })
      }
      if (pageDef.name === 'home' && theme === 'light') {
        await check('light / home：画布有分层渐变与标题强调条', async () => {
          if (!/gradient/.test(state.homeImage || '')) throw Error('home background-image = ' + state.homeImage)
          if (!state.titleBarWidth || parseFloat(state.titleBarWidth) < 3) throw Error('title accent bar width = ' + state.titleBarWidth)
        })
      }
    }
    await page.close()
  }
} finally {
  await browser.close()
  const report = {
    date: new Date().toISOString(),
    source: '真实浏览器 5180 + 隔离后端 8997 + 管理员账号（.local/tduck-credentials.json），只读浏览',
    checks,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length
  }
  fs.writeFileSync(out + '/results.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({passed: report.passed, failed: report.failed}))
}
if (checks.some((c) => !c.passed)) process.exitCode = 1
