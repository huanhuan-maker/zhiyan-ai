// 统计页图表与深色容器回归（固定深色主题）。
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require = createRequire(path.resolve('tduck-vue3/package.json'))
const {chromium} = require('@playwright/test')
const fixture = JSON.parse(fs.readFileSync('.local/assistant-simple/acceptance.json', 'utf8').replace(/^\uFEFF/, ''))
if (fixture.backend !== 'http://127.0.0.1:8997') throw Error('Only isolated backend 8997 is allowed')
const out = 'evidence/tduck-full/chart-theme'
fs.mkdirSync(out, {recursive: true})
const DARK_TEXT = 'rgb(184, 196, 212)'

const login = await (await fetch(fixture.backend + '/login/account', {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({account: fixture.owner, password: fixture.password})
})).json()
if (login.code !== 200) throw Error('login failed: ' + login.msg)
const token = login.data.token

const browser = await chromium.launch({channel: 'msedge', headless: true})
const checks = []
const check = async (name, fn) => {
  try { const detail = await fn(); checks.push({name, passed: true, detail}); console.log('PASS ' + name) }
  catch (e) { checks.push({name, passed: false, error: e.message.slice(0, 400)}); console.log('FAIL ' + name + ': ' + e.message.slice(0, 200)) }
}
const chartState = (page) => page.evaluate(() => {
  const charts = [...document.querySelectorAll('.echarts')]
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1} }
  const lum = ({r, g, b}) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const lightBlocks = []
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return
    const c = parse(cs.backgroundColor)
    if (!c || c.a < 0.6 || lum(c) <= 0.72) return
    const r = el.getBoundingClientRect()
    if (r.width >= 40 && r.height >= 24) lightBlocks.push(String(el.className).slice(0, 50))
  })
  return {
    count: charts.length,
    rendered: charts.filter((el) => el.querySelector('svg, canvas')).length,
    dark: document.documentElement.classList.contains('zy-dark'),
    toggles: document.querySelectorAll('.theme-toggle-btn, .header-theme-btn, .ai-theme-toggle').length,
    fills: [...new Set([...document.querySelectorAll('.echarts svg text')].map((el) => getComputedStyle(el).fill))].slice(0, 8),
    lightBlocks: lightBlocks.slice(0, 8),
    lightBlockCount: lightBlocks.length
  }
})

try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}})
  page.setDefaultTimeout(20000)
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e).slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
  await page.addInitScript((t) => localStorage.setItem('token', t), token)
  await page.goto('http://127.0.0.1:5180/project/form/statistics?key=' + fixture.forms[0].key, {waitUntil: 'networkidle'})
  await page.getByRole('tab', {name: '访问与收集概览'}).click()
  await page.waitForTimeout(2500)

  await check('深色下统计图表全部渲染且无运行时报错', async () => {
    const state = await chartState(page)
    if (state.count !== 4) throw Error('expected 4 chart containers, got ' + state.count)
    if (state.rendered !== state.count) throw Error('unrendered charts: ' + JSON.stringify(state))
    const chartError = pageErrors.filter((e) => /getThemedOption|is not a function/.test(e))
    if (chartError.length) throw Error('chart runtime error: ' + chartError[0])
    if (pageErrors.length) throw Error('page error: ' + pageErrors[0])
    return state
  })
  await check('图表文字使用深色令牌且画布无浅色残留', async () => {
    const state = await chartState(page)
    if (!state.fills.includes(DARK_TEXT)) throw Error('chart text colours: ' + JSON.stringify(state.fills))
    if (state.lightBlockCount) throw Error('light blocks: ' + JSON.stringify(state.lightBlocks))
  })
  await check('页面固定深色，且没有主题切换入口', async () => {
    const state = await chartState(page)
    if (!state.dark) throw Error('zy-dark missing')
    if (state.toggles !== 0) throw Error('theme toggles: ' + state.toggles)
  })
  const fatal = consoleErrors.filter((e) => /getThemedOption/.test(e))
  if (fatal.length) {
    checks.push({name: '控制台没有 getThemedOption 报错', passed: false, error: fatal[0]})
    console.log('FAIL 控制台没有 getThemedOption 报错')
  } else {
    checks.push({name: '控制台没有 getThemedOption 报错', passed: true})
    console.log('PASS 控制台没有 getThemedOption 报错')
  }
  await page.screenshot({path: out + '/01-statistics-dark.png', fullPage: true})
  await page.getByRole('tab', {name: '题目统计'}).click()
  await page.waitForTimeout(2000)
  await check('题目统计标签页也没有浅色残留', async () => {
    const state = await chartState(page)
    if (state.lightBlockCount) throw Error('light blocks: ' + JSON.stringify(state.lightBlocks))
  })
  await page.screenshot({path: out + '/02-statistics-analysis-dark.png', fullPage: true})
} finally {
  await browser.close()
  const report = {
    date: new Date().toISOString(),
    source: '真实浏览器 5180 + 隔离后端 8997 + 只读验收账号 fixture',
    theme: 'dark only',
    checks,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length
  }
  fs.writeFileSync(out + '/results.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({passed: report.passed, failed: report.failed}))
}
if (checks.some((c) => !c.passed)) process.exitCode = 1
