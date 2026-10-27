<template>
  <div class="ai-studio" data-testid="ai-studio">
    <header class="studio-hero">
      <div class="hero-copy">
        <span class="hero-eyebrow">AI 建卷 · 从研究想法到可编辑问卷</span>
        <h1>用一句话描述你的研究，<span class="hero-accent">剩下的交给 AI</span></h1>
        <p class="hero-sub">AI 只产出可编辑草稿：题型、选项与量表都在这里定稿，再导入编辑器发布；不会直接写库或发布问卷。</p>
      </div>
      <div class="hero-side">
        <span v-if="status" class="ai-status">
          <el-tooltip :content="status.provider + ' · ' + status.model" placement="bottom">
            <el-tag :type="status.mode === 'REAL' ? 'success' : 'warning'" size="small" effect="plain">
              {{ status.mode === 'REAL' ? '真实 AI' : 'Mock 模式' }}
            </el-tag>
          </el-tooltip>
          <span class="status-text">{{ status.provider }}</span>
        </span>
        <span v-else class="status-text">模型状态读取中…</span>
        <span class="hero-count">已保留 {{ variants.length }} / 3 个候选</span>
      </div>
    </header>

    <section class="composer-card" aria-label="填写调查需求">
      <div class="composer-field">
        <label for="studio-goal" class="field-label">调查目标</label>
        <el-input
          id="studio-goal"
          v-model="form.goal"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          resize="none"
          placeholder="例：我想研究大学生为什么不想参加社团，需要区分没参加过和已经退出两类人"
        />
      </div>
      <div class="composer-grid">
        <div class="composer-field">
          <label for="studio-audience" class="field-label">目标人群</label>
          <el-input id="studio-audience" v-model="form.audience" maxlength="100" placeholder="例：在校大学生" />
        </div>
        <div class="composer-field composer-count">
          <span class="field-label">期望题数</span>
          <div class="count-chips" role="group" aria-label="期望题数">
            <button
              v-for="size in countOptions"
              :key="size"
              type="button"
              class="count-chip"
              :class="{ active: form.questionCount === size }"
              :aria-pressed="form.questionCount === size"
              @click="form.questionCount = size"
            >
              {{ size }}
            </button>
          </div>
        </div>
      </div>
      <div class="composer-field">
        <label for="studio-extra" class="field-label">补充信息 <span class="field-optional">可选</span></label>
        <el-input id="studio-extra" v-model="form.extra" maxlength="500" placeholder="已有假设、必须覆盖的方面、措辞要求等" />
      </div>
      <div class="composer-actions">
        <el-button
          type="primary"
          class="generate-btn"
          :loading="generating"
          :disabled="handoff"
          data-testid="studio-generate"
          @click="generate(false)"
        >
          <i v-if="!generating" class="el-icon-magic-stick" />
          {{ generating ? '正在生成' : variants.length ? '再生成一版' : '生成问卷' }}
        </el-button>
        <span class="composer-hint">每次生成约 20–60 秒；最多保留 3 个候选并排对比，逐个丢弃不想要的版本。</span>
      </div>
      <div class="idea-row">
        <span class="idea-label">没想好？试试</span>
        <button v-for="(idea, i) in ideas" :key="i" type="button" class="idea-chip" @click="useIdea(idea)">
          {{ idea.goal }}
        </button>
      </div>
    </section>

    <DraftGenerationProgress
      ref="generationProgress"
      :state="generationState"
      :input="generationInput"
      :events="generationEvents"
      :elapsed="generationElapsed"
      :unavailable="progressUnavailable"
      :error="generationError"
      @retry="generate(false)"
    />

    <section v-if="clarification" class="clarify-card" aria-label="AI 请求澄清">
      <header>
        <span class="clarify-mark">!</span>
        <div><h2>AI 认为目标还需要补充</h2><p>按下面的问题补充调查目标，再生成一次会更贴合研究设计。</p></div>
      </header>
      <ol class="clarify-list"><li v-for="(q, i) in clarification.questions" :key="i">{{ q }}</li></ol>
      <div v-if="clarification.assumptions && clarification.assumptions.length" class="clarify-assumptions">
        <strong>初步假设（供参考）</strong>
        <ul><li v-for="(a, i) in clarification.assumptions" :key="i">{{ a }}</li></ul>
      </div>
      <el-button type="primary" plain @click="focusGoal">补充目标后重新生成</el-button>
    </section>

    <section v-if="variants.length" class="variants-section" aria-label="候选草稿">
      <div class="section-bar">
        <div><h2>候选草稿</h2><p>对比题量与题型结构，选一份继续精修；其余可直接丢弃。</p></div>
        <span class="section-count">{{ variants.length }} / 3</span>
      </div>
      <div class="variant-grid">
        <article
          v-for="(variant, i) in variants"
          :key="variant.id"
          class="variant-card"
          :class="{ selected: selectedIndex === i }"
          data-testid="studio-variant"
          @click="selectedIndex = i"
        >
          <header class="variant-head">
            <span class="variant-badge">{{ letters[i] }}</span>
            <span class="variant-time">{{ variant.letter || '' }}{{ formatTime(variant.createdAt) }}</span>
            <button type="button" class="variant-discard" aria-label="丢弃这份候选" @click.stop="discard(i)">丢弃</button>
          </header>
          <h3 class="variant-title">{{ variant.result.title }}</h3>
          <p class="variant-structure">{{ structureLabel(variant.result) }}</p>
          <div class="variant-metrics">
            <div><strong>{{ variant.result.questions.length }}</strong><span>题目</span></div>
            <div><strong>{{ (variant.result.elapsedMs / 1000).toFixed(1) }}s</strong><span>用时</span></div>
            <div><strong :class="{ warn: (variant.result.warnings || []).length }">{{ (variant.result.warnings || []).length }}</strong><span>提示</span></div>
          </div>
          <footer class="variant-actions">
            <el-button type="primary" size="small" :loading="handoff" :disabled="handoff" @click.stop="openWorkspace(i)">继续精修</el-button>
            <el-button size="small" :disabled="handoff" @click.stop="selectedIndex = i">查看题目</el-button>
          </footer>
        </article>
      </div>

      <article v-if="current" class="detail-panel" aria-label="题目预览">
        <header class="detail-head">
          <div>
            <span class="detail-eyebrow">候选 {{ letters[selectedIndex] }} · {{ current.result.questions.length }} 题</span>
            <h3>{{ current.result.title }}</h3>
            <p v-if="current.result.description" class="detail-desc">{{ current.result.description }}</p>
          </div>
          <div class="detail-actions">
            <el-button :loading="handoff" :disabled="handoff || importing" @click="openWorkspace(selectedIndex)">逐题精修</el-button>
            <el-button type="primary" :loading="importing" :disabled="handoff || importing" data-testid="studio-import" @click="importToEditor(selectedIndex)">导入编辑器</el-button>
          </div>
        </header>
        <ol class="detail-questions">
          <li v-for="(q, i) in current.result.questions" :key="i" class="detail-question">
            <span class="q-index">{{ i + 1 }}</span>
            <div class="q-body">
              <p class="q-label">{{ q.label }}<span v-if="q.required" class="q-required">*</span></p>
              <div v-if="q.type === 'RADIO' || q.type === 'CHECKBOX'" class="q-options">
                <span v-for="(o, j) in q.options" :key="j" class="q-option" :class="{ multi: q.type === 'CHECKBOX' }">{{ o }}</span>
              </div>
              <span v-else-if="q.type === 'RATE'" class="q-note">量表 1–{{ q.rateMax || 5 }} 分</span>
              <span v-else class="q-note">开放题 · 文本回答</span>
            </div>
            <el-tag size="small" effect="plain" :type="typeTag(q.type).type">{{ typeTag(q.type).label }}</el-tag>
          </li>
        </ol>
        <div v-if="(current.result.warnings || []).length" class="detail-warnings">
          <strong>人工审核提示（{{ current.result.warnings.length }} 条）</strong>
          <ul><li v-for="(w, i) in current.result.warnings" :key="i">· {{ w }}</li></ul>
        </div>
        <p class="detail-note">继续精修会带着这份草稿打开 AI 工作台：可以逐题编辑、让 AI 单独优化某道题、预览答题体验，确认后再导入编辑器。导入后仍是未发布草稿。</p>
      </article>
    </section>

    <section v-else-if="!generating" class="studio-guide" aria-label="使用方式">
      <div v-for="(step, i) in guideSteps" :key="i" class="guide-step">
        <span class="guide-index">0{{ i + 1 }}</span>
        <h3>{{ step.title }}</h3>
        <p>{{ step.text }}</p>
      </div>
    </section>

    <section class="draft-box" aria-label="我的 AI 草稿">
      <div class="section-bar">
        <div><h2>我的 AI 草稿</h2><p>暂存在当前账号的草稿，随时接着编辑或导入。</p></div>
        <span v-if="drafts.length" class="section-count">{{ drafts.length }} 份</span>
      </div>
      <div v-if="draftsError" class="draft-error">
        <span>草稿列表暂时无法读取。</span>
        <el-button size="small" @click="loadDrafts">重试</el-button>
      </div>
      <div v-else-if="drafts.length" class="draft-grid">
        <article v-for="draft in drafts" :key="draft.id" class="draft-card" data-testid="studio-draft">
          <div class="draft-meta">
            <span class="draft-badge">AI 草稿</span>
            <span>未发布 · {{ draft.snapshot?.result?.questions?.length || 0 }} 题</span>
          </div>
          <h3>{{ draft.snapshot?.result?.title || 'AI 建卷暂存' }}</h3>
          <p class="draft-time">上次暂存 {{ draft.updatedAt ? formatTime(draft.updatedAt) : '时间未知' }}</p>
          <footer class="draft-actions">
            <el-button size="small" type="primary" @click="continueDraft(draft)">继续编辑</el-button>
            <el-button size="small" @click="removeDraft(draft)">移除</el-button>
          </footer>
        </article>
      </div>
      <p v-else class="draft-empty">还没有暂存草稿。生成后点「继续精修」，在工作台右上角点「暂时保存」，草稿就会出现在这里。</p>
    </section>
  </div>
</template>

<script>
import { generateAiDraftRequest, startAiDraftProgressRequest, getAiDraftProgressRequest, getAiStatusRequest, createAiDraftSlotRequest, listAiDraftSlotsRequest, removeAiDraftSlotRequest } from '@/api/project/ai'
import DraftGenerationProgress from '@/generator/DraftGenerationProgress.vue'
import { importDraftToEditor } from '@/generator/ai-draft-import'
import sha256 from 'crypto-js/sha256'
import dayjs from 'dayjs'

const IDEAS = [
  { goal: '大学生为什么不愿意参加社团活动，区分从没参加过和已经退出的人', audience: '在校大学生', questionCount: 10 },
  { goal: '新入职员工在入职三个月内最需要哪些支持，哪些支持实际没有到位', audience: '入职三个月内的员工', questionCount: 8 },
  { goal: '社区食堂的用餐满意度，最需要改进的是哪些方面', audience: '社区 60 岁以上居民', questionCount: 10 },
  { goal: '线上课程的学习体验，哪些环节最容易让人放弃', audience: '上过线上课程的成年人', questionCount: 12 }
]

export default {
  name: 'AiCreateStudio',
  components: { DraftGenerationProgress },
  data() {
    return {
      status: null,
      form: { goal: '', audience: '', extra: '', questionCount: 10 },
      countOptions: [6, 8, 10, 12, 16, 20],
      ideas: IDEAS,
      variants: [],
      selectedIndex: 0,
      letters: ['A', 'B', 'C'],
      clarification: null,
      generating: false,
      generationState: 'idle',
      generationInput: {},
      generationEvents: [],
      generationElapsed: 0,
      generationError: '',
      progressUnavailable: false,
      generationRun: 0,
      generationStartedAt: 0,
      generationTimer: null,
      progressPoll: null,
      handoff: false,
      importing: false,
      drafts: [],
      draftsError: false,
      guideSteps: [
        { title: '描述研究目标', text: '写清研究问题、关注的现象和需要区分的群体，信息越具体草稿越贴合。' },
        { title: '对比候选草稿', text: '保留最多 3 个候选，横向比较题量与题型结构，留下最贴合的一份。' },
        { title: '精修后导入', text: '在工作台逐题编辑或让 AI 优化单题，确认后导入编辑器再发布。' }
      ]
    }
  },
  computed: {
    current() {
      return this.variants[this.selectedIndex] || null
    }
  },
  created() {
    this.restoreSession()
    this.loadStatus()
    this.loadDrafts()
  },
  beforeUnmount() {
    this.generationRun++
    this.stopGenerationTracking()
  },
  methods: {
    ownerKey() { return sha256(localStorage.getItem('token') || '').toString() },
    sessionKey() { return 'aiStudio:' + this.ownerKey() },
    restoreSession() {
      try {
        const saved = JSON.parse(sessionStorage.getItem(this.sessionKey()) || 'null')
        if (!saved) return
        if (saved.form) this.form = { ...this.form, ...saved.form }
        if (Array.isArray(saved.variants)) this.variants = saved.variants
        if (this.variants.length) this.selectedIndex = this.variants.length - 1
      } catch (e) { /* 缓存损坏时回到空白输入 */ }
    },
    persistSession() {
      try {
        sessionStorage.setItem(this.sessionKey(), JSON.stringify({ form: this.form, variants: this.variants }))
      } catch (e) { /* 存储不可用时仅失去刷新保留能力 */ }
    },
    loadStatus() {
      getAiStatusRequest().then((res) => { this.status = res.data }).catch(() => { this.status = null })
    },
    loadDrafts() {
      listAiDraftSlotsRequest()
        .then((res) => { this.drafts = res.data || []; this.draftsError = false })
        .catch(() => { this.draftsError = true })
    },
    formatTime(value) {
      const time = dayjs(value)
      return time.isValid() ? time.format('MM/DD HH:mm') : ''
    },
    typeTag(type) {
      const map = {
        RADIO: { label: '单选', type: 'primary' },
        CHECKBOX: { label: '多选', type: 'success' },
        RATE: { label: '量表', type: 'warning' },
        TEXTAREA: { label: '开放', type: 'info' },
        INPUT: { label: '填空', type: 'info' }
      }
      return map[type] || { label: type, type: 'info' }
    },
    structureLabel(result) {
      const names = { RADIO: '单选', CHECKBOX: '多选', RATE: '量表', TEXTAREA: '开放', INPUT: '填空' }
      const counts = {}
      for (const q of result.questions || []) counts[q.type] = (counts[q.type] || 0) + 1
      return Object.entries(counts).map(([type, count]) => count + ' ' + (names[type] || type)).join(' · ')
    },
    useIdea(idea) {
      this.form = { goal: idea.goal, audience: idea.audience, extra: '', questionCount: idea.questionCount }
      this.persistSession()
      this.focusGoal()
    },
    focusGoal() {
      this.$nextTick(() => this.$el.querySelector('#studio-goal textarea')?.focus())
    },
    stopGenerationTracking() {
      clearInterval(this.generationTimer)
      clearTimeout(this.progressPoll)
      this.generationTimer = null
      this.progressPoll = null
    },
    async pollGenerationProgress(id, run, repeat = true) {
      if (run !== this.generationRun || (repeat && !this.generating)) return
      try {
        const res = await getAiDraftProgressRequest(id)
        if (run !== this.generationRun) return
        const events = res.data?.events || []
        if (events.length >= this.generationEvents.length) this.generationEvents = events
        this.progressUnavailable = false
      } catch (e) {
        if (run === this.generationRun) this.progressUnavailable = true
      } finally {
        if (repeat && this.generating && run === this.generationRun) {
          clearTimeout(this.progressPoll)
          this.progressPoll = setTimeout(() => this.pollGenerationProgress(id, run), 1800)
        }
      }
    },
    validate() {
      if (!this.form.goal.trim()) { this.$message.warning('请先填写调查目标'); return false }
      if (!this.form.audience.trim()) { this.$message.warning('请先填写目标人群'); return false }
      return true
    },
    async generate() {
      if (this.generating || this.handoff) return
      if (!this.validate()) return
      if (this.variants.length >= 3) {
        this.$message.warning('最多同时保留 3 个候选，请先丢弃其中一份再生成')
        return
      }
      this.clarification = null
      this.generating = true
      this.generationState = 'running'
      this.generationInput = { ...this.form }
      this.generationEvents = []
      this.generationError = ''
      this.progressUnavailable = false
      this.generationStartedAt = Date.now()
      this.generationElapsed = 0
      const run = ++this.generationRun
      this.stopGenerationTracking()
      this.generationTimer = setInterval(() => { this.generationElapsed = Date.now() - this.generationStartedAt }, 1000)
      this.persistSession()
      let progressId
      try {
        try {
          const started = await startAiDraftProgressRequest()
          progressId = started.data?.id
        } catch (e) { this.progressUnavailable = true }
        if (run !== this.generationRun) return
        if (progressId) this.pollGenerationProgress(progressId, run)
        const res = await generateAiDraftRequest({ ...this.generationInput }, progressId)
        if (run !== this.generationRun) return
        const data = res.data || {}
        if (data.kind === 'draft') {
          this.variants.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            form: { ...this.generationInput },
            result: data,
            createdAt: new Date().toISOString()
          })
          this.selectedIndex = this.variants.length - 1
          this.persistSession()
          this.generationState = 'idle'
          this.$message.success('草稿已生成，请人工审核题目')
          this.$nextTick(() => this.$el.querySelector('.variants-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
        } else {
          this.clarification = { questions: data.clarification || [], assumptions: data.assumptions || [] }
          this.generationState = 'clarification'
        }
      } catch (err) {
        if (run !== this.generationRun) return
        this.generationState = 'failed'
        this.generationError = err?.msg || err?.message || '生成失败，可重试或改用手工建卷'
      } finally {
        if (run === this.generationRun) {
          this.generating = false
          this.generationElapsed = Date.now() - this.generationStartedAt
          this.stopGenerationTracking()
          if (progressId) this.pollGenerationProgress(progressId, run, false)
        }
      }
    },
    discard(index) {
      this.variants.splice(index, 1)
      if (this.selectedIndex >= this.variants.length) this.selectedIndex = Math.max(0, this.variants.length - 1)
      this.persistSession()
    },
    // 交付给工作台：先把候选存成账号草稿槽，再打开已有工作台页，避免复制一套编辑逻辑。
    async openWorkspace(index) {
      const variant = this.variants[index]
      if (!variant || this.handoff) return
      this.handoff = true
      try {
        const res = await createAiDraftSlotRequest({ form: variant.form, result: variant.result })
        const slotId = res.data?.id
        if (!slotId) throw new Error('草稿保存失败，请重试')
        this.loadDrafts()
        this.$router.push({ path: '/project/form/ai-draft', query: { draft: slotId } })
      } catch (e) {
        this.$message.error(e?.msg || e?.message || '无法打开工作台，请重试')
      } finally {
        this.handoff = false
      }
    },
    // 直接导入：与工作台共用 @/generator/ai-draft-import，得到一份未发布问卷后进入编辑器。
    async importToEditor(index) {
      const variant = this.variants[index]
      if (!variant || this.importing || this.handoff) return
      this.importing = true
      try {
        const formKey = await importDraftToEditor({
          result: variant.result,
          cacheKey: this.sessionKey() + ':variant:' + variant.id,
          warn: (text) => this.$message.warning(text)
        })
        if (!formKey) return
        this.$message.success('已创建问卷草稿（未发布），正在打开编辑器')
        this.$router.push({ path: '/project/form/editor', query: { key: formKey } })
      } catch (e) {
        this.$message.error((e && (e.message || e.msg)) || '导入失败，可重试导入或改用手工建卷')
      } finally {
        this.importing = false
      }
    },
    continueDraft(draft) {
      this.$router.push({ path: '/project/form/ai-draft', query: { draft: draft.id } })
    },
    async removeDraft(draft) {
      try {
        await this.$confirm('移除后这份暂存将无法恢复，已导入的问卷不受影响。确定移除吗？', '移除 AI 草稿', {
          type: 'warning',
          confirmButtonText: '移除',
          cancelButtonText: '取消'
        })
      } catch (e) { return }
      try {
        await removeAiDraftSlotRequest(draft.id)
        await this.loadDrafts()
        this.$message.success('已移除草稿')
      } catch (e) {
        this.$message.error('移除失败，请重试')
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.ai-studio {
  width: 100%;
  max-width: 1180px;
  padding: 26px 32px 48px;
  margin: 0 auto;
  color: var(--zy-text);
  font-family: var(--zy-font-family);
}
.studio-hero {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 26px 28px;
  margin-bottom: 18px;
  overflow: hidden;
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(56, 189, 248, 0.16), transparent 58%),
    radial-gradient(90% 120% at 100% 0%, rgba(124, 58, 237, 0.18), transparent 62%),
    var(--zy-surface);
  border: 1px solid var(--zy-border);
  border-radius: var(--zy-radius-lg);
  box-shadow: var(--zy-shadow-panel);
  &::after {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: '';
    background-image: linear-gradient(var(--zy-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--zy-grid-line) 1px, transparent 1px);
    background-size: 46px 46px;
    mask-image: radial-gradient(80% 120% at 0% 0%, #000 0%, transparent 72%);
  }
}
.hero-copy { position: relative; z-index: 1; max-width: 680px; }
.hero-eyebrow { display: block; margin-bottom: 10px; color: var(--zy-accent-cyan); font-size: 11px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; }
.hero-copy h1 { margin: 0 0 10px; font-size: 27px; font-weight: 650; line-height: 1.35; letter-spacing: 0.2px; }
.hero-accent { color: var(--zy-primary); }
.hero-sub { margin: 0; color: var(--zy-text-secondary); font-size: 12.5px; line-height: 1.8; }
.hero-side { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.ai-status { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: flex-end; }
.status-text { color: var(--zy-text-secondary); font-size: 11px; }
.hero-count { color: var(--zy-text-secondary); font-size: 11px; }

.composer-card {
  padding: 22px 24px;
  margin-bottom: 18px;
  background: var(--zy-surface);
  border: 1px solid var(--zy-border);
  border-radius: var(--zy-radius-lg);
  box-shadow: var(--zy-shadow-card);
}
.composer-field { margin-bottom: 16px; }
.field-label { display: block; margin-bottom: 8px; color: var(--zy-text-regular); font-size: 12px; font-weight: 500; }
.field-optional { margin-left: 4px; color: var(--zy-text-placeholder); font-size: 11px; font-weight: 400; }
:deep(.el-textarea__inner),
:deep(.el-input__wrapper) {
  background: var(--zy-surface-subtle);
  border-radius: var(--zy-radius-sm);
  box-shadow: 0 0 0 1px var(--zy-border) inset;
}
:deep(.el-textarea__inner) { padding: 11px 13px; font-family: var(--zy-font-family); font-size: 13px; line-height: 1.8; }
:deep(.el-input__inner) { font-family: var(--zy-font-family); font-size: 13px; }
.composer-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
.composer-count { min-width: 0; }
.count-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.count-chip {
  min-width: 46px;
  height: 34px;
  padding: 0 12px;
  color: var(--zy-text-regular);
  font-family: var(--zy-font-number);
  font-size: 13px;
  cursor: pointer;
  background: var(--zy-surface-subtle);
  border: 1px solid var(--zy-border);
  border-radius: var(--zy-radius-sm);
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
  &:hover { color: var(--zy-text); border-color: var(--zy-primary); }
  &.active {
    color: var(--zy-text);
    font-weight: 600;
    background: var(--zy-primary-soft);
    border-color: var(--zy-primary);
    box-shadow: var(--zy-ring);
  }
}
.composer-actions { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; padding-top: 4px; }
.generate-btn { min-height: 40px; padding: 0 22px; font-weight: 600; border-radius: var(--zy-radius-sm); }
.generate-btn i { margin-right: 7px; }
.composer-hint { flex: 1; min-width: 240px; color: var(--zy-text-secondary); font-size: 11px; line-height: 1.7; }
.idea-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding-top: 16px; margin-top: 16px; border-top: 1px solid var(--zy-border-light); }
.idea-label { color: var(--zy-text-secondary); font-size: 11px; }
.idea-chip {
  max-width: 100%;
  padding: 6px 12px;
  overflow: hidden;
  color: var(--zy-text-regular);
  font-family: inherit;
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: var(--zy-surface-subtle);
  border: 1px solid var(--zy-border-light);
  border-radius: 999px;
  transition: color 0.15s ease, border-color 0.15s ease;
  &:hover { color: var(--zy-primary); border-color: var(--zy-primary); }
}

.clarify-card {
  padding: 20px 22px;
  margin-bottom: 18px;
  background: var(--zy-surface);
  border: 1px solid var(--zy-border);
  border-left: 3px solid var(--zy-warning);
  border-radius: var(--zy-radius-md);
  header { display: flex; gap: 12px; align-items: flex-start; }
  h2 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
  p { margin: 0; color: var(--zy-text-secondary); font-size: 12px; line-height: 1.7; }
}
.clarify-mark { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; width: 24px; height: 24px; color: var(--zy-warning); font-weight: 700; background: var(--zy-surface-subtle); border: 1px solid var(--zy-warning); border-radius: 50%; }
.clarify-list { padding-left: 20px; margin: 14px 0 6px; font-size: 13px; line-height: 1.9; }
.clarify-assumptions { margin-bottom: 16px; color: var(--zy-text-regular); font-size: 12px; line-height: 1.8; ul { padding-left: 18px; margin: 6px 0 0; } }

.section-bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; justify-content: space-between; margin-bottom: 14px;
  h2 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
  p { margin: 0; color: var(--zy-text-secondary); font-size: 12px; line-height: 1.7; }
}
.section-count { color: var(--zy-text-secondary); font-family: var(--zy-font-number); font-size: 12px; }

.variants-section { margin-bottom: 26px; }
.variant-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.variant-card {
  display: flex;
  flex-direction: column;
  padding: 16px 17px;
  cursor: pointer;
  background: var(--zy-surface);
  border: 1px solid var(--zy-border);
  border-radius: var(--zy-radius-md);
  box-shadow: var(--zy-shadow-card);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
  &:hover { border-color: var(--zy-primary); box-shadow: var(--zy-shadow-card-hover); transform: translateY(-1px); }
  &.selected { border-color: var(--zy-primary); box-shadow: var(--zy-ring); }
}
.variant-head { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
.variant-badge { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; color: var(--zy-primary); font-family: var(--zy-font-number); font-size: 11px; font-weight: 700; background: var(--zy-primary-soft); border-radius: 6px; }
.variant-time { flex: 1; color: var(--zy-text-secondary); font-size: 11px; }
.variant-discard { padding: 2px 6px; color: var(--zy-text-secondary); font-family: inherit; font-size: 11px; cursor: pointer; background: transparent; border: 0; border-radius: 4px; &:hover { color: var(--zy-danger); background: var(--zy-surface-subtle); } }
.variant-title { margin: 0 0 6px; overflow: hidden; font-size: 14px; font-weight: 600; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.variant-structure { margin: 0 0 12px; color: var(--zy-text-secondary); font-size: 11px; line-height: 1.7; }
.variant-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 10px 0; margin-bottom: 12px; border-top: 1px solid var(--zy-border-light); border-bottom: 1px solid var(--zy-border-light);
  div { display: flex; flex-direction: column; gap: 2px; }
  strong { color: var(--zy-primary); font-family: var(--zy-font-number); font-size: 16px; font-weight: 650; &.warn { color: var(--zy-warning); } }
  span { color: var(--zy-text-secondary); font-size: 10.5px; }
}
.variant-actions { display: flex; gap: 8px; margin-top: auto; :deep(.el-button) { flex: 1; margin: 0; } }

.detail-panel { padding: 20px 22px; margin-top: 16px; background: var(--zy-surface); border: 1px solid var(--zy-border); border-radius: var(--zy-radius-lg); box-shadow: var(--zy-shadow-card); }
.detail-head { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid var(--zy-border-light);
  h3 { margin: 4px 0 0; font-size: 17px; font-weight: 600; line-height: 1.6; }
}
.detail-eyebrow { color: var(--zy-accent-cyan); font-family: var(--zy-font-number); font-size: 11px; letter-spacing: 0.4px; }
.detail-desc { margin: 7px 0 0; color: var(--zy-text-regular); font-size: 12.5px; line-height: 1.8; }
.detail-actions { display: flex; flex-shrink: 0; gap: 8px; }
.detail-questions { padding: 0; margin: 5px 0 0; list-style: none; }
.detail-question { display: flex; gap: 12px; align-items: flex-start; padding: 14px 0; border-bottom: 1px solid var(--zy-border-light); &:last-child { border-bottom: 0; } }
.q-index { flex-shrink: 0; min-width: 24px; color: var(--zy-primary); font-family: var(--zy-font-number); font-size: 12px; font-weight: 600; }
.q-body { flex: 1; min-width: 0; }
.q-label { margin: 0; font-size: 13.5px; font-weight: 500; line-height: 1.7; word-break: break-word; }
.q-required { margin-left: 4px; color: var(--zy-danger); }
.q-options { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; }
.q-option { display: inline-flex; gap: 6px; align-items: center; color: var(--zy-text-regular); font-size: 12px; line-height: 1.6;
  &::before { width: 9px; height: 9px; content: ''; border: 1px solid var(--zy-text-placeholder); border-radius: 50%; }
  &.multi::before { border-radius: 2px; }
}
.q-note { display: inline-block; margin-top: 7px; color: var(--zy-text-secondary); font-size: 11.5px; }
.detail-warnings { padding: 13px 15px; margin-top: 14px; color: var(--zy-text-regular); font-size: 12px; line-height: 1.8; background: var(--zy-surface-subtle); border: 1px solid var(--zy-border-light); border-radius: var(--zy-radius-sm);
  ul { padding-left: 4px; margin: 6px 0 0; list-style: none; }
}
.detail-note { margin: 14px 0 0; color: var(--zy-text-secondary); font-size: 11px; line-height: 1.7; }

.studio-guide { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 26px; }
.guide-step { padding: 18px; background: var(--zy-surface); border: 1px dashed var(--zy-border); border-radius: var(--zy-radius-md);
  h3 { margin: 6px 0 6px; font-size: 13.5px; font-weight: 600; }
  p { margin: 0; color: var(--zy-text-secondary); font-size: 11.5px; line-height: 1.75; }
}
.guide-index { color: var(--zy-primary); font-family: var(--zy-font-number); font-size: 11px; font-weight: 700; letter-spacing: 1px; }

.draft-box { padding-top: 22px; border-top: 1px solid var(--zy-border-light); }
.draft-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.draft-card { padding: 16px 17px; background: var(--zy-surface); border: 1px solid var(--zy-border); border-radius: var(--zy-radius-md); box-shadow: var(--zy-shadow-card);
  h3 { margin: 8px 0 6px; overflow: hidden; font-size: 13.5px; font-weight: 600; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
}
.draft-meta { display: flex; gap: 8px; align-items: center; color: var(--zy-text-secondary); font-size: 11px; }
.draft-badge { padding: 2px 7px; color: var(--zy-accent); font-size: 10.5px; background: var(--zy-tint); border-radius: 4px; }
.draft-time { margin: 0 0 12px; color: var(--zy-text-secondary); font-size: 11px; }
.draft-actions { display: flex; gap: 8px; :deep(.el-button) { margin: 0; } }
.draft-empty { padding: 18px 20px; margin: 0; color: var(--zy-text-secondary); font-size: 12px; line-height: 1.8; background: var(--zy-surface-subtle); border: 1px dashed var(--zy-border); border-radius: var(--zy-radius-md); }
.draft-error { display: flex; gap: 12px; align-items: center; padding: 14px 16px; color: var(--zy-text-regular); font-size: 12px; background: var(--zy-surface-subtle); border: 1px solid var(--zy-border); border-radius: var(--zy-radius-md); }

@media (max-width: 1023px) {
  .variant-grid, .draft-grid, .studio-guide { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 767px) {
  .ai-studio { padding: 20px 14px 36px; }
  .studio-hero { padding: 20px 17px; }
  .hero-copy h1 { font-size: 21px; }
  .hero-side { align-items: flex-start; }
  .composer-card { padding: 17px 15px; }
  .composer-grid { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .variant-grid, .draft-grid, .studio-guide { grid-template-columns: minmax(0, 1fr); }
  .detail-panel { padding: 17px 15px; }
  .detail-actions { width: 100%; :deep(.el-button) { flex: 1; margin: 0; } }
  .idea-row { gap: 6px; }
  .idea-chip { white-space: normal; }
}
</style>
