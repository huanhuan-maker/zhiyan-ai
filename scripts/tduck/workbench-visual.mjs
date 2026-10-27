// 全站深色回归：登录前后所有路由都必须是深色，且没有浅色残留 / 低对比文字。
// 唯一允许的白色：二维码画布（扫码功能需要白底）。
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require = createRequire(path.resolve('tduck-vue3/package.json'))
const {chromium} = require('@playwright/test')
const cred = JSON.parse(fs.readFileSync('.local/tduck-credentials.json', 'utf8').replace(/^\uFEFF/, ''))
const out = 'evidence/tduck-full/workbench-visual'
fs.mkdirSync(out, {recursive: true})
const FORM_KEY = process.env.FORM_KEY || 'cYtMpVqA'
// 收集中状态的问卷，用来验证公开填写页渲染真实题目后的深色与对比度
const PUBLIC_FORM_KEY = process.env.PUBLIC_FORM_KEY || 'dUJev0eA'

const AUTH_PAGES = [
  {name: 'home', url: '/home'},
  {name: 'member', url: '/home/member'},
  {name: 'assistant', url: '/home/assistant'},
  {name: 'manage-user', url: '/manage/user'},
  {name: 'manage-system', url: '/manage/system'},
  {name: 'project-my', url: '/project/my'},
  {name: 'form-editor', url: '/project/form/editor?key=' + FORM_KEY},
  {name: 'form-logic', url: '/project/form/logic?key=' + FORM_KEY},
  {name: 'form-theme', url: '/project/form/theme?key=' + FORM_KEY},
  {name: 'form-setting', url: '/project/form/setting?key=' + FORM_KEY},
  {name: 'form-publish', url: '/project/form/publish?key=' + FORM_KEY},
  {name: 'form-data', url: '/project/form/data?key=' + FORM_KEY},
  {name: 'form-statistics', url: '/project/form/statistics?key=' + FORM_KEY},
  {name: 'form-preview', url: '/project/form/preview?key=' + FORM_KEY},
  {name: 'form-ai-draft', url: '/project/form/ai-draft?key=' + FORM_KEY},
  {name: 'notfound', url: '/this-path-does-not-exist'}
]
const ANON_PAGES = [
  {name: 'login', url: '/login'},
  {name: 'forget-password', url: '/forget/password'},
  {name: 'account-validate', url: '/account/validate'},
  {name: 'public-fill', url: '/s/' + PUBLIC_FORM_KEY},
  {name: 'public-write', url: '/s/' + FORM_KEY},
  {name: 'public-write-project', url: '/project/write?key=' + FORM_KEY},
  {name: 'public-result', url: '/project/public/result?key=' + FORM_KEY}
]
// 二维码画布需要白底才能扫码，是唯一允许的白色元素；头像字母为装饰元素
const CONTRAST_ALLOWLIST = ['avatar-text']
const LIGHT_LEAK_ALLOWLIST = ['qrcode-canvas']

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
    if (!el.childNodes.length || CONTRAST_ALLOWLIST.some((t) => String(el.className || '').includes(t))) return
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
    lowContrast: lowContrast.slice(0, 10), lowContrastCount: lowContrast.length
  }
}

const browser = await chromium.launch({channel: 'msedge', headless: true})
const checks = []
const check = async (name, fn) => {
  try { const detail = await fn(); checks.push({name, passed: true, detail}); console.log('PASS ' + name) }
  catch (e) { checks.push({name, passed: false, error: e.message.slice(0, 400)}); console.log('FAIL ' + name + ': ' + e.message.slice(0, 200)) }
}

const runPages = async (pages, initScript) => {
  const page = await browser.newPage({viewport: {width: 1600, height: 900}})
  page.setDefaultTimeout(25000)
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e).slice(0, 160)))
  if (initScript) await page.addInitScript(initScript, {token: login.data.token, info: {name: 'admin', admin: true, email: cred.adminEmail}})
  for (const def of pages) {
    await page.goto('http://127.0.0.1:5180' + def.url, {waitUntil: 'networkidle'}).catch(() => {})
    await page.waitForTimeout(1800)
    const state = await page.evaluate(auditPage, {CONTRAST_ALLOWLIST, LIGHT_LEAK_ALLOWLIST})
    await page.screenshot({path: out + '/dark-' + def.name + '.png'})
    await check('dark / ' + def.name + '：深色生效且无换肤入口', async () => {
      if (!state.dark) throw Error('zy-dark missing')
      if (state.toggles !== 0) throw Error('theme toggles: ' + state.toggles)
    })
    await check('dark / ' + def.name + '：无运行时报错', async () => { if (pageErrors.length) throw Error(pageErrors[0]) })
    await check('dark / ' + def.name + '：没有浅色残留块', async () => {
      if (state.lightBlockCount) throw Error(JSON.stringify(state.lightBlocks))
    })
    await check('dark / ' + def.name + '：正文文字对比度 >= 4.5', async () => {
      if (state.lowContrastCount) throw Error(JSON.stringify(state.lowContrast))
    })
  }
  await page.close()
}

try {
  await runPages(AUTH_PAGES, ({token, info}) => {
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify(info))
  })
  await runPages(ANON_PAGES, null)
} finally {
  await browser.close()
  const report = {
    date: new Date().toISOString(),
    source: '真实浏览器 5180 + 隔离后端 8997（登录态用管理员账号，公开页用匿名）',
    theme: 'dark only（无浅色切换）',
    allowlist: {lightLeak: LIGHT_LEAK_ALLOWLIST, contrast: CONTRAST_ALLOWLIST},
    checks,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length
  }
  fs.writeFileSync(out + '/results.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({passed: report.passed, failed: report.failed}))
}
if (checks.some((c) => !c.passed)) process.exitCode = 1
