// M2 缺陷修复回归（先补回归，再修复）：
//  缺陷1 生成耗时超过 30 秒时浏览器不超时（axios 全局 30s 是根因；静态护栏 + 31.5s 浏览器实测 + 31s 慢速 Provider 端到端）
//  缺陷2 草稿导入保真：导入→编辑器→刷新后 名称/描述/题干/必填/选项/量表范围/填写提示 全部保留；草稿页自身刷新不丢
//  缺陷3 第 N 题保存失败后重试：断点续传，不重复建卷、不留残缺问卷
// 说明：草稿生成响应为「显式标注的合成夹具」用于确定性回归（不冒充真实模型输出）；
//       建卷、逐题落库、编辑器加载、刷新全部走真实 5180 前端 + 8997 隔离后端 + tduck_vue3_dev。
// 证据：evidence/tduck-full/m2-fixes.json + 截图 24~27。
import {createRequire} from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import {spawn} from 'node:child_process'
import http from 'node:http'
const require = createRequire(path.resolve('tduck-vue3/package.json'))
const {chromium} = require('@playwright/test')
const fixt = JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json', 'utf8').replace(/^\uFEFF/, ''))
if (fixt.backend !== 'http://127.0.0.1:8997') throw Error('仅允许隔离后端 8997')
const FRONT = 'http://127.0.0.1:5180'
const RUN = Date.now().toString(36)
const checks = []
const errors = []
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail: String(detail).slice(0, 300) })
  console.log((ok ? '[ok] ' : '[FAIL] ') + name + (detail ? ' | ' + String(detail).slice(0, 150) : ''))
  if (!ok) errors.push(name)
}
let token
async function api(url, data) {
  const r = await fetch(fixt.backend + url, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { token } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) })
  })
  const b = await r.json()
  if (b.code !== 200) throw Error(url + ': ' + b.msg)
  return b.data
}
{ // node 侧 API 断言用的夹具登录（与 UI 登录相互独立）
  const lg = await fetch(fixt.backend + '/login/account', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: fixt.owner, password: fixt.password })
  }).then(r => r.json())
  if (lg.code !== 200) throw Error('夹具登录失败: ' + lg.msg)
  token = lg.data.token
}

// —— 合成草稿夹具（页面会显示 provider 为回归夹具，非真实模型）——
const fidelityDraft = {
  kind: 'draft', mode: 'REAL', provider: '回归夹具(合成响应·非真实模型)', model: 'fixture-no-model', elapsedMs: 1,
  title: '保真回归问卷' + RUN,
  description: '回归描述：验证导入后刷新不丢失信息 ' + RUN,
  warnings: [], assumptions: [], dimensions: [],
  questions: [
    { type: 'RADIO', label: '单选必填题' + RUN, required: true, options: ['选项甲', '选项乙', '选项丙'] },
    { type: 'CHECKBOX', label: '多选题' + RUN, required: true, options: ['多选一', '多选二', '多选三', '多选四'] },
    { type: 'RATE', label: '量表七分题' + RUN, required: true, rateMax: 7 },
    { type: 'TEXTAREA', label: '开放必填题' + RUN, required: true, placeholder: '请描述你的真实感受' },
    { type: 'RADIO', label: '单选选填题' + RUN, required: false, options: ['可不选甲', '可不选乙'] },
    { type: 'TEXTAREA', label: '开放选填题' + RUN, required: false, placeholder: '选填提示语' }
  ]
}
const resumeDraft = {
  kind: 'draft', mode: 'REAL', provider: '回归夹具(合成响应·非真实模型)', model: 'fixture-no-model', elapsedMs: 1,
  title: '断点续传问卷' + RUN, description: '续传场景描述',
  warnings: [], assumptions: [], dimensions: [],
  questions: [1, 2, 3, 4, 5, 6].map(n => ({
    type: n % 3 === 1 ? 'RADIO' : n % 3 === 2 ? 'CHECKBOX' : n % 3 === 0 && n < 6 ? 'TEXTAREA' : 'RATE',
    label: '续传第' + n + '题' + RUN, required: true,
    ...(n % 3 === 1 ? { options: ['续传甲', '续传乙'] } : n % 3 === 2 ? { options: ['续A', '续B', '续C'] } : n % 3 === 0 && n < 6 ? { placeholder: '续传填写提示' + n } : { rateMax: 5 })
  }))
}
const refreshDraft = {
  kind: 'draft', mode: 'REAL', provider: '回归夹具(合成响应·非真实模型)', model: 'fixture-no-model', elapsedMs: 1,
  title: '续传刷新问卷' + RUN, description: '刷新后续传场景描述',
  warnings: [], assumptions: [], dimensions: [],
  questions: [1, 2, 3, 4, 5, 6].map(n => ({
    type: n <= 2 ? 'RADIO' : n <= 4 ? 'CHECKBOX' : 'TEXTAREA',
    label: '刷新第' + n + '题' + RUN, required: true,
    ...(n <= 2 ? { options: ['刷甲', '刷乙'] } : n <= 4 ? { options: ['刷A', '刷B', '刷C'] } : { placeholder: '刷新提示' + n })
  }))
}
const slowDraft = {
  kind: 'draft', title: '慢速生成问卷' + RUN, description: '慢速 Provider 链路验证',
  warnings: [], assumptions: [], dimensions: [],
  questions: [1, 2, 3, 4, 5, 6].map(n => ({
    type: n % 2 ? 'RADIO' : 'TEXTAREA', label: '慢速第' + n + '题' + RUN, required: true,
    ...(n % 2 ? { options: ['慢甲', '慢乙'] } : { placeholder: '慢速提示' + n })
  }))
}

// ========== T1 静态护栏 ==========
const aiJs = fs.readFileSync('tduck-vue3/src/td/api/project/ai.js', 'utf8')
const tmo = /generateAiDraftRequest[\s\S]*?timeout:\s*(\d+)/.exec(aiJs)
check('T1-1: AI 生成请求显式放宽超时(>=120s，仅该请求)', !!tmo && +tmo[1] >= 120000, tmo ? 'timeout=' + tmo[1] : 'ai.js 未传 timeout')
const vite = fs.readFileSync('tduck-vue3/vite.config.ts', 'utf8')
const px = /proxyTimeout:\s*(\d+)/.exec(vite)
check('T1-2: 开发代理超时 >=120s', !!px && +px[1] >= 120000, px ? px[1] : 'missing')
const axiosIdx = fs.readFileSync('tduck-vue3/src/td/api/index.js', 'utf8')
const g30 = /timeout:\s*(\d+)/.exec(axiosIdx)
check('T1-3: 其他请求全局默认超时保持 30s(未整体放宽)', !!g30 && +g30[1] === 30000, g30 ? g30[1] : 'missing')

// ========== 浏览器回归（Playwright Edge 无头）==========
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const pageErrors = []
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)))
const phase = { draft: fidelityDraft, delayMs: 0, failAt: 0, failConsumed: false, formCreateCount: 0, itemCreateCount: 0 }
const resetPhase = () => { phase.failAt = 0; phase.failConsumed = false; phase.formCreateCount = 0; phase.itemCreateCount = 0 }
await page.route('**/tduck-api/user/form/ai/draft*', async route => {
  if (phase.delayMs) await new Promise(r => setTimeout(r, phase.delayMs))
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, msg: '成功', data: phase.draft }) })
})
await page.route('**/tduck-api/user/form/item/create*', async route => {
  phase.itemCreateCount++
  if (phase.failAt && phase.itemCreateCount === phase.failAt && !phase.failConsumed) {
    phase.failConsumed = true
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 500, msg: '模拟第N题保存失败(回归夹具)' }) })
  } else await route.continue()
})
await page.route('**/tduck-api/user/form/create*', async route => { phase.formCreateCount++; await route.continue() })

const GOAL_PH = '例：我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人'
async function login() {
  await page.goto(FRONT + '/login')
  await page.waitForTimeout(1200)
  await page.getByPlaceholder('请输入手机号 / 邮箱').fill(fixt.owner)
  await page.getByPlaceholder('请输入密码').fill(fixt.password)
  await page.getByRole('button', { name: '登 录' }).click()
  await page.waitForTimeout(2500)
}
async function openDraftPage() { await page.goto(FRONT + '/project/form/ai-draft'); await page.waitForTimeout(1500) }
async function clearResultIfShown() {
  const btn = page.getByRole('button', { name: '清空结果' })
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(600) }
}
async function fillAndGenerate(goal) {
  await page.getByPlaceholder(GOAL_PH).fill(goal)
  await page.getByPlaceholder('例：在校大学生').fill('回归夹具人群')
  await page.getByRole('spinbutton').fill('6')
  await page.getByRole('button', { name: '生成草稿' }).click()
}
async function waitPreview(timeoutMs) { // 返回 'preview' | 'error' | 'timeout'
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    await page.waitForTimeout(1000)
    const body = await page.locator('body').innerText().catch(() => '')
    if (body.includes('草稿预览')) return 'preview'
    if (await page.locator('.el-message--error').count()) return 'error'
  }
  return 'timeout'
}
const importBtn = () => page.getByRole('button', { name: '导入编辑器继续编辑' })
async function itemsOf(formKey) { return api('/user/form/item/list?key=' + formKey) }
async function formByName(name) {
  // 与前端列表页同参（后端对缺失 folderId 会 NPE，须显式传 0）
  const d = await api('/user/form/page?current=1&size=50&folderId=0&name=' + encodeURIComponent(name))
  return d.records || d.list || d || []
}

try {
  await login()

  // ===== 缺陷1：T2 生成 31.5s 浏览器不超时 =====
  resetPhase(); phase.delayMs = 31500
  await openDraftPage()
  await fillAndGenerate('超时回归：本请求将被夹具延迟 31.5 秒才返回')
  const t0 = Date.now()
  const outcome = await waitPreview(60000)
  const elapsed = Date.now() - t0
  check('T2-1: 31.5s 延迟返回后草稿预览正常渲染(浏览器不超时)', outcome === 'preview', 'outcome=' + outcome + ' elapsed=' + elapsed + 'ms')
  if (outcome === 'preview') {
    const n = await page.locator('.question-item').count()
    check('T2-2: 延迟返回的草稿为完整 6 题', n === 6, 'count=' + n)
    await page.screenshot({ path: 'evidence/tduck-full/24-timeout-31s-success.png', fullPage: true })
  } else {
    check('T2-2: 延迟返回的草稿为完整 6 题', false, '预览未出现，跳过')
  }
  phase.delayMs = 0

  // ===== 缺陷2：F1 导入保真 + 刷新保留 =====
  resetPhase(); phase.draft = fidelityDraft
  await openDraftPage(); await clearResultIfShown()
  if ((await page.locator('.result-card').count()) === 0) await fillAndGenerate('保真回归目标')
  check('F1-0: 草稿预览就绪', (await waitPreview(15000)) === 'preview')
  await importBtn().click()
  await page.waitForURL(/project\/form\/editor/, { timeout: 20000 }).catch(() => {})
  const fKey = new URL(page.url()).searchParams.get('key') || ''
  check('F1-1: 导入后跳转编辑器并获得 formKey', !!fKey, page.url())
  if (fKey) {
    await page.waitForTimeout(2000)
    const cards = page.locator('.question-card')
    check('F1-2: 编辑器载入 6 题', (await cards.count()) === 6, 'cards=' + (await cards.count()))
    await page.reload(); await page.waitForTimeout(2500)
    const cards2 = page.locator('.question-card')
    check('F1-3: 刷新后仍为 6 题', (await cards2.count()) === 6, 'cards=' + (await cards2.count()))
    const firstCard = await cards2.first().innerText().catch(() => '')
    const fifthCard = await cards2.nth(4).innerText().catch(() => '')
    check('F1-4: 刷新后题干与必填标记保留(第1题必填)', firstCard.includes('单选必填题' + RUN) && firstCard.includes('*'), firstCard.slice(0, 60).replace(/\n/g, ' '))
    check('F1-5: 选填题无必填标记(第5题)', fifthCard.includes('单选选填题' + RUN) && !fifthCard.includes('*'), fifthCard.slice(0, 60).replace(/\n/g, ' '))
    await page.screenshot({ path: 'evidence/tduck-full/25-import-refresh-fidelity.png', fullPage: true })
    // API 级逐题保真
    const items = await itemsOf(fKey)
    const seqOk = items.map(x => x.label).join('|') === fidelityDraft.questions.map(q => q.label).join('|')
    check('F1-6: 刷新后题目顺序与草稿一致', seqOk, items.map(x => x.label).join('|').slice(0, 120))
    const form = await api('/user/form/' + fKey)
    check('F1-7: 问卷名称保留', form.name === fidelityDraft.title, form.name)
    check('F1-8: 问卷描述保留(872d82e 版本丢失项)', (form.description || '') === fidelityDraft.description, (form.description || '').slice(0, 60))
    let fidelityDetail = []
    for (const q of fidelityDraft.questions) {
      const it = items.find(x => x.label === q.label)
      if (!it) { fidelityDetail.push('missing:' + q.label); continue }
      if (it.type !== q.type) fidelityDetail.push(q.label + ' type=' + it.type)
      if (!!it.required !== !!q.required) fidelityDetail.push(q.label + ' required=' + it.required)
      const sch = typeof it.scheme === 'string' ? JSON.parse(it.scheme) : (it.scheme || {})
      if (q.options) {
        const got = ((sch.config || {}).options || []).map(o => o.label).join('|')
        if (got !== q.options.join('|')) fidelityDetail.push(q.label + ' options=' + got)
      }
      if (q.type === 'RATE' && String(sch.max) !== String(q.rateMax)) fidelityDetail.push(q.label + ' max=' + sch.max)
      if (q.type === 'TEXTAREA' && (it.placeholder || '') !== q.placeholder) fidelityDetail.push(q.label + ' ph=' + it.placeholder)
    }
    check('F1-9: 每题 题型/必填/选项/量表范围/填写提示 逐项保留', fidelityDetail.length === 0, fidelityDetail.join(' ; ').slice(0, 200))
    check('F1-10: 全程仅创建 1 份问卷', phase.formCreateCount === 1, 'createForm=' + phase.formCreateCount)
  }

  // ===== 缺陷2：F2/F3 草稿页自身刷新保留 / 清空 =====
  await openDraftPage(); await clearResultIfShown()
  await fillAndGenerate('草稿页刷新保留回归')
  check('F2-1: 生成后预览出现', (await waitPreview(15000)) === 'preview')
  await page.reload(); await page.waitForTimeout(2000)
  const restored = await page.locator('.result-card .question-item').count()
  const goalVal = await page.getByPlaceholder(GOAL_PH).inputValue().catch(() => '')
  check('F2-2: 刷新后草稿预览仍在(6题)', restored === 6, 'items=' + restored)
  check('F2-3: 刷新后已填的调查目标保留', goalVal === '草稿页刷新保留回归', goalVal.slice(0, 40))
  await clearResultIfShown()
  await page.reload(); await page.waitForTimeout(1500)
  check('F3-1: 清空结果后刷新无残留草稿', (await page.locator('.result-card').count()) === 0)

  // ===== 缺陷3：R1 第 4 题失败 → 重试续传 =====
  resetPhase(); phase.draft = resumeDraft; phase.failAt = 4
  await openDraftPage(); await clearResultIfShown()
  await fillAndGenerate('断点续传回归')
  check('R1-0: 草稿预览就绪', (await waitPreview(15000)) === 'preview')
  await importBtn().click()
  let errTexts = []
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000)
    if (await page.locator('.el-message--error').count()) {
      await page.waitForTimeout(500) // 等组件级续传提示与全局提示都入列
      const c = await page.locator('.el-message--error').count()
      for (let j = 0; j < c; j++) errTexts.push(await page.locator('.el-message--error').nth(j).innerText().catch(() => ''))
      break
    }
  }
  check('R1-1: 第4题失败时给出含续传指引的可恢复提示(非静默)', errTexts.some(t => t.includes('续传')), errTexts.join(' / ').slice(0, 100))
  check('R1-2: 失败后停留在草稿页', !page.url().includes('/editor'), page.url())
  check('R1-3: 失败重试前仅创建 1 份问卷', phase.formCreateCount === 1, 'createForm=' + phase.formCreateCount)
  let r1Key = ''
  if (phase.formCreateCount >= 1) {
    const recs = await formByName(resumeDraft.title)
    if (recs.length === 1) {
      r1Key = recs[0].formKey
      const its = await itemsOf(r1Key)
      check('R1-4: 中断时问卷只含前 3 题', its.length === 3, 'items=' + its.length + ' labels=' + its.map(x => x.label).join(',').slice(0, 100))
    } else check('R1-4: 中断时问卷只含前 3 题', false, '同名问卷数=' + recs.length)
    await page.screenshot({ path: 'evidence/tduck-full/26-resume-error.png', fullPage: true })
  }
  if (await importBtn().count()) {
    await importBtn().click()
    await page.waitForURL(/project\/form\/editor/, { timeout: 25000 }).catch(() => {})
    check('R1-5: 重试后进入编辑器', page.url().includes('/project/form/editor'), page.url())
    if (page.url().includes('/project/form/editor')) {
      await page.waitForTimeout(2000)
      const n = await page.locator('.question-card').count()
      check('R1-6: 重试后编辑器 6 题齐全', n === 6, 'cards=' + n)
      const key2 = new URL(page.url()).searchParams.get('key') || r1Key
      const its2 = await itemsOf(key2)
      check('R1-7: 重试后题目顺序完整且无重复(6题=L1..L6)', its2.length === 6 && its2.map(x => x.label).join('|') === resumeDraft.questions.map(q => q.label).join('|'), its2.map(x => x.label).join('|').slice(0, 140))
      check('R1-8: 全程仅 1 次 createForm(无重复建卷)', phase.formCreateCount === 1, 'createForm=' + phase.formCreateCount)
      const recs2 = await formByName(resumeDraft.title)
      check('R1-9: 项目列表同名问卷仅 1 份(无残缺副本)', recs2.length === 1, 'count=' + recs2.length)
      await page.screenshot({ path: 'evidence/tduck-full/27-resume-complete.png', fullPage: true })
    }
  } else {
    check('R1-5: 重试后进入编辑器', false, '首次导入未被中断(拦截未生效)，页面已离开草稿页')
    check('R1-6: 重试后编辑器 6 题齐全', false, '跳过：无可重试中断')
    check('R1-7: 重试后题目顺序完整且无重复(6题=L1..L6)', false, '跳过：无可重试中断')
    check('R1-8: 全程仅 1 次 createForm(无重复建卷)', phase.formCreateCount === 1, 'createForm=' + phase.formCreateCount)
    const recs2 = await formByName(resumeDraft.title)
    check('R1-9: 项目列表同名问卷仅 1 份(无残缺副本)', recs2.length === 1, 'count=' + recs2.length)
  }

  // ===== 缺陷3：R2 失败后刷新页面再续传 =====
  resetPhase(); phase.draft = refreshDraft; phase.failAt = 3
  await openDraftPage(); await clearResultIfShown()
  await fillAndGenerate('刷新后续传回归')
  check('R2-0: 草稿预览就绪', (await waitPreview(15000)) === 'preview')
  await importBtn().click()
  for (let i = 0; i < 18; i++) { await page.waitForTimeout(1000); if (await page.locator('.el-message--error').count()) break }
  await page.reload(); await page.waitForTimeout(2000)
  const kept = await page.locator('.result-card .question-item').count()
  check('R2-1: 中断失败后刷新页面草稿仍在(导入会话可续)', kept === 6, 'items=' + kept)
  if (kept === 6) {
    await importBtn().click()
    await page.waitForURL(/project\/form\/editor/, { timeout: 25000 }).catch(() => {})
    check('R2-2: 刷新后重试进入编辑器', page.url().includes('/project/form/editor'), page.url())
    if (page.url().includes('/project/form/editor')) {
      const k = new URL(page.url()).searchParams.get('key')
      const its = await itemsOf(k)
      check('R2-3: 刷新后续传完成 6 题无重复', its.length === 6 && its.map(x => x.label).join('|') === refreshDraft.questions.map(q => q.label).join('|'), its.map(x => x.label).join('|').slice(0, 140))
      check('R2-4: 全程仅 1 次 createForm', phase.formCreateCount === 1, 'createForm=' + phase.formCreateCount)
      const recs = await formByName(refreshDraft.title)
      check('R2-5: 同名问卷仅 1 份', recs.length === 1, 'count=' + recs.length)
    }
  } else {
    check('R2-2: 刷新后重试进入编辑器', false, '跳过：刷新后草稿未保留，无法重试')
    check('R2-3: 刷新后续传完成 6 题无重复', false, '跳过')
    check('R2-4: 全程仅 1 次 createForm', phase.formCreateCount === 1, 'createForm=' + phase.formCreateCount)
    const recs = await formByName(refreshDraft.title)
    check('R2-5: 同名问卷仅 1 份', recs.length === 1, 'count=' + recs.length)
  }
  check('B-1: 全程无前端页面错误', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))
} catch (e) {
  check('B-2: 浏览器流程完整性(无未捕获异常)', false, String(e && e.message).slice(0, 200))
} finally {
  await browser.close()
}

// ========== T3：慢速 Provider 端到端(31s) —— 证明 后端+Provider 链路 >30s 仍可用 ==========
{
  const stub = http.createServer((req, res) => {
    let buf = ''
    req.on('data', c => buf += c)
    req.on('end', () => {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(slowDraft) } }] }))
      }, 31000)
    })
  })
  await new Promise(r => stub.listen(0, '127.0.0.1', r))
  const port = stub.address().port
  const child = spawn('D:/jdk/jdk17/bin/java.exe', [
    '-jar', 'D:/LcProject/.local/tduck-closure-build/tduck-api/target/tduck-api.jar',
    '--spring.config.additional-location=file:./application-local.yml',
    '--ai.base-url=http://127.0.0.1:' + port + '/v1', '--ai.api-key=slow-stub-key', '--ai.model=group/group', '--ai.timeout-ms=90000',
    '--server.address=127.0.0.1', '--server.port=8996'
  ], { cwd: 'D:/LcProject/.local/tduck-dev', stdio: 'ignore', detached: false })
  try {
    let st = null, tk = ''
    for (let i = 0; i < 27; i++) {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const lg = await fetch('http://127.0.0.1:8996/login/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: fixt.owner, password: fixt.password }) }).then(r => r.json())
        if (lg.code === 200) {
          tk = lg.data.token
          st = await fetch('http://127.0.0.1:8996/user/form/ai/status', { headers: { token: tk } }).then(r => r.json())
          if (st.code === 200 && st.data.mode === 'REAL') break
        }
      } catch {}
    }
    check('T3-1: 8996 慢速实例就绪且为真实 AI 模式', !!st && st.code === 200 && st.data.mode === 'REAL', st ? JSON.stringify(st.data).slice(0, 120) : '未就绪')
    if (st && st.code === 200 && st.data.mode === 'REAL') {
      const t0 = Date.now()
      const r = await fetch('http://127.0.0.1:8996/user/form/ai/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json', token: tk },
        body: JSON.stringify({ goal: '慢速生成回归：stub 将延迟 31 秒返回', audience: '回归夹具人群', extra: '', questionCount: 6 })
      }).then(r => r.json())
      const ms = Date.now() - t0
      check('T3-2: 31s 慢速 Provider 生成成功(后端链路不超时)', r.code === 200 && r.data && r.data.kind === 'draft', 'code=' + r.code + ' msg=' + (r.msg || '').slice(0, 80))
      check('T3-3: 实际耗时 >=30s 且在 90s 超时内', ms >= 30000 && ms < 90000, ms + 'ms')
      if (r.code === 200 && r.data && r.data.questions) {
        check('T3-4: 慢速链路草稿 6 题通过服务端校验', r.data.questions.length === 6, 'n=' + r.data.questions.length)
      }
    }
  } catch (e) {
    check('T3-0: 慢速实例流程完整性(无未捕获异常)', false, String(e && e.message).slice(0, 200))
  } finally {
    await new Promise(res => spawn('taskkill', ['/PID', String(child.pid), '/F', '/T'], { stdio: 'ignore' }).on('close', res))
    stub.close()
  }
}

fs.writeFileSync('evidence/tduck-full/m2-fixes.json', JSON.stringify({
  date: new Date().toISOString(), run: RUN, frontend: FRONT, backend: fixt.backend,
  note: '草稿生成响应为显式标注的合成夹具；建卷/逐题落库/编辑器/刷新/慢速实例均为真实链路。不包含任何密钥。',
  total: checks.length, failed: errors.length, checks
}, null, 1) + '\n')
console.log('\nM2 修复回归: ' + checks.length + ' 项检查, 失败 ' + errors.length)
if (errors.length) { console.log('FAILED: ' + errors.join(' ; ')); process.exit(1) }
