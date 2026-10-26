// Chart theme regression: statistics charts must render in both workbench themes.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require = createRequire(path.resolve('tduck-vue3/package.json'))
const {chromium, expect} = require('@playwright/test')
const fixture = JSON.parse(fs.readFileSync('.local/assistant-simple/acceptance.json', 'utf8').replace(/^\uFEFF/, ''))
if (fixture.backend !== 'http://127.0.0.1:8997') throw Error('Only isolated backend 8997 is allowed')
const out = 'evidence/tduck-full/chart-theme'
fs.mkdirSync(out, {recursive: true})
const LIGHT_TEXT = 'rgb(102, 102, 102)'
const DARK_TEXT = 'rgb(184, 196, 212)'

async function api(url, data, token) {
  const res = await fetch(fixture.backend + url, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {'Content-Type': 'application/json', ...(token ? {token} : {})},
    ...(data === undefined ? {} : {body: JSON.stringify(data)})
  })
  const body = await res.json()
  if (body.code !== 200) throw Error(url + ': ' + body.msg)
  return body.data
}

const token = (await api('/login/account', {account: fixture.owner, password: fixture.password})).token
const browser = await chromium.launch({channel: 'msedge', headless: true})
const checks = []
async function check(name, fn) {
  try {
    const detail = await fn()
    checks.push({name, passed: true, detail})
    console.log('PASS ' + name)
  } catch (e) {
    checks.push({name, passed: false, error: e.message.slice(0, 400)})
    console.log('FAIL ' + name + ': ' + e.message.slice(0, 200))
  }
}
const chartState = (page) => page.evaluate(() => {
  const charts = [...document.querySelectorAll('.echarts')]
  return {
    count: charts.length,
    rendered: charts.filter((el) => el.querySelector('svg, canvas')).length,
    dark: document.documentElement.classList.contains('zy-dark'),
    fills: [...new Set([...document.querySelectorAll('.echarts svg text')].map((el) => getComputedStyle(el).fill))].slice(0, 8)
  }
})

try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}})
  page.setDefaultTimeout(15000)
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e).slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
  // The token is injected on every navigation, but the stored theme is not:
  // the reload check below has to observe what the app restored by itself.
  await page.addInitScript((t) => localStorage.setItem('token', t), token)
  await page.goto('http://127.0.0.1:5180/project/form/statistics?key=' + fixture.forms[0].key, {waitUntil: 'networkidle'})
  await page.evaluate(() => {
    localStorage.setItem('zhiyan-workbench-theme', 'light')
    document.documentElement.classList.remove('zy-dark')
    document.documentElement.style.colorScheme = 'light'
  })
  await page.reload({waitUntil: 'networkidle'})
  await page.getByRole('tab', {name: '访问与收集概览'}).click()
  await page.waitForTimeout(2500)

  await check('light theme renders every statistics chart without a runtime error', async () => {
    const state = await chartState(page)
    if (state.count !== 4) throw Error('expected 4 chart containers, got ' + state.count)
    if (state.rendered !== state.count) throw Error('unrendered charts: ' + JSON.stringify(state))
    const chartError = pageErrors.filter((e) => /getThemedOption|is not a function/.test(e))
    if (chartError.length) throw Error('chart runtime error: ' + chartError[0])
    if (pageErrors.length) throw Error('page error: ' + pageErrors[0])
    return state
  })
  await page.screenshot({path: out + '/01-statistics-light.png', fullPage: true})

  await check('light theme keeps the existing light chart text colours', async () => {
    const state = await chartState(page)
    if (!state.fills.includes(LIGHT_TEXT)) throw Error('light chart text colours: ' + JSON.stringify(state.fills))
  })

  await check('toggling dark repaints charts with dark tokens', async () => {
    await page.locator('.ai-theme-toggle').click()
    await expect(page.locator('html')).toHaveClass(/zy-dark/)
    await page.waitForTimeout(1500)
    const state = await chartState(page)
    if (!state.dark) throw Error('dark class missing')
    if (state.rendered !== state.count) throw Error('charts lost after theme switch: ' + JSON.stringify(state))
    if (!state.fills.includes(DARK_TEXT)) throw Error('dark chart text colours: ' + JSON.stringify(state.fills))
    if (pageErrors.length) throw Error('page error after switch: ' + pageErrors[0])
    return state
  })
  await page.screenshot({path: out + '/02-statistics-dark.png', fullPage: true})

  await check('dark theme survives a reload and keeps charts rendered', async () => {
    await page.reload({waitUntil: 'networkidle'})
    await page.getByRole('tab', {name: '访问与收集概览'}).click()
    await page.waitForTimeout(2500)
    const state = await chartState(page)
    if (!state.dark) throw Error('dark theme not restored from storage')
    if (state.rendered !== state.count) throw Error('charts missing after reload: ' + JSON.stringify(state))
    return state
  })

  await check('switching back to light restores light chart colours', async () => {
    await page.locator('.ai-theme-toggle').click()
    await page.waitForTimeout(1500)
    const state = await chartState(page)
    if (state.dark) throw Error('dark class not removed')
    if (!state.fills.includes(LIGHT_TEXT)) throw Error('light colours not restored: ' + JSON.stringify(state.fills))
    return state
  })

  await check('dark collection tab has no light container blocks left', async () => {
    // 上一步已切回浅色，这里重新切到深色再审计统计页容器。
    await page.locator('.ai-theme-toggle').click()
    await page.waitForTimeout(800)
    await page.goto('http://127.0.0.1:5180/project/form/statistics?key=' + fixture.forms[0].key, {waitUntil: 'networkidle'})
    await page.getByRole('tab', {name: '访问与收集概览'}).click()
    await page.waitForTimeout(2000)
    const blocks = await page.evaluate(() => {
      const lum = (c) => {
        const m = c.match(/rgba?\(([^)]+)\)/)
        if (!m) return null
        const p = m[1].split(',').map(Number)
        if (p.length > 3 && p[3] === 0) return null
        return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]
      }
      const rows = []
      document.querySelectorAll('body *').forEach((el) => {
        const value = lum(getComputedStyle(el).backgroundColor)
        if (value === null || value < 190) return
        const box = el.getBoundingClientRect()
        if (box.width < 40 || box.height < 24) return
        if (!el.className || typeof el.className !== 'string') return
        rows.push(el.className.trim().slice(0, 80))
      })
      return rows
    })
    if (!(await page.evaluate(() => document.documentElement.classList.contains('zy-dark')))) throw Error('dark theme not active for the audit')
    if (blocks.length) throw Error('light blocks remain: ' + JSON.stringify(blocks.slice(0, 5)))
    return {lightBlocks: blocks.length}
  })

  const fatal = consoleErrors.filter((e) => /getThemedOption/.test(e))
  if (fatal.length) {
    checks.push({name: 'console has no getThemedOption error', passed: false, error: fatal[0]})
    console.log('FAIL console has no getThemedOption error')
  } else {
    checks.push({name: 'console has no getThemedOption error', passed: true})
    console.log('PASS console has no getThemedOption error')
  }
} finally {
  await browser.close()
  const report = {
    date: new Date().toISOString(),
    source: 'Real browser on 5180, isolated backend 8997, acceptance fixture .local/assistant-simple/acceptance.json (read-only navigation)',
    checks,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length
  }
  fs.writeFileSync(out + '/results.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({passed: report.passed, failed: report.failed}))
}
if (checks.some((c) => !c.passed)) process.exitCode = 1
