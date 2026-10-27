<template>
  <div class="app-container ai-draft-container">
    <header class="draft-page-header">
      <div>
        <div class="page-eyebrow">智能问卷设计</div>
        <h1>AI 建卷</h1>
        <p>描述研究目标，生成可编辑的四题型草稿。请结合研究设计逐题审核。</p>
      </div>
      <span v-if="status" class="ai-status">
        <el-tag :type="status.mode === 'REAL' ? 'success' : 'warning'" size="small" effect="plain">
          {{ status.mode === 'REAL' ? '真实 AI' : 'Mock 模式' }}
        </el-tag>
        <span class="status-text">{{ status.provider }} · {{ status.model }}</span>
        <el-tooltip v-if="status.mode !== 'REAL'" content="未配置真实 AI 密钥时使用本地模板生成，内容未经真实模型；手工建卷不受影响" placement="top">
          <i class="el-icon-warning-outline" />
        </el-tooltip>
      </span>
    </header>

    <el-card shadow="never" class="input-card">
      <template #header>
        <div class="card-header">
          <div class="section-heading">
            <span class="section-number">01</span>
            <div><h2>填写调查需求</h2><p>信息越具体，草稿越贴合你的研究目标</p></div>
          </div>
          <span class="section-caption">支持 1–30 题</span>
        </div>
      </template>
      <el-form ref="form" :model="form" label-position="top" @submit.prevent>
        <el-form-item label="调查目标" required>
          <el-input
            v-model="form.goal"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="例：我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人"
          />
          <div class="field-help">建议说明研究问题、关注的现象和需要区分的群体。</div>
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="目标人群" required>
            <el-input v-model="form.audience" maxlength="100" placeholder="例：在校大学生" />
          </el-form-item>
          <el-form-item label="期望题数" required class="question-count-field">
            <div class="question-count-control">
              <el-input-number v-model="form.questionCount" :min="1" :max="30" aria-label="期望题数" />
              <span>题</span>
            </div>
          </el-form-item>
        </div>
        <el-form-item label="补充信息" class="extra-field">
          <el-input v-model="form.extra" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="可选：已有假设、必须覆盖的方面、措辞要求等" />
        </el-form-item>
      </el-form>
      <div class="actions input-actions">
        <el-button type="primary" :loading="generating" :disabled="importing" aria-label="生成草稿" @click="generate">
          <i v-if="!generating" class="el-icon-magic-stick" />{{ generating ? '正在生成' : '生成草稿' }}
        </el-button>
        <el-button v-if="result" :disabled="generating || importing" @click="reset">清空结果</el-button>
        <span class="hint">AI 仅生成可编辑草稿，不写库、不发布；发布由你在编辑器里手动完成。</span>
      </div>
    </el-card>

    <el-card v-if="result && result.kind === 'clarification'" shadow="never" class="result-card">
      <template #header><div class="card-header"><div class="section-heading"><span class="section-number">02</span><h2>目标需要澄清</h2></div></div></template>
      <el-alert type="warning" :closable="false" title="AI 认为当前调查目标过于含糊，建议先澄清以下问题再生成" />
      <ol class="clarify-list"><li v-for="(q, i) in result.clarification" :key="i">{{ q }}</li></ol>
      <div v-if="result.assumptions && result.assumptions.length" class="assumptions">
        <strong>初步假设（供参考）：</strong>
        <ul><li v-for="(a, i) in result.assumptions" :key="i">{{ a }}</li></ul>
      </div>
      <el-button type="primary" plain @click="focusGoal">补充目标信息后重新生成</el-button>
    </el-card>

    <el-card v-if="result && result.kind === 'draft'" shadow="never" class="result-card">
      <template #header>
        <div class="card-header result-header">
          <div class="section-heading">
            <span class="section-number">02</span>
            <div><h2>审核草稿 <span class="question-total">{{ result.questions.length }} 题</span></h2><p>点击每道题的“编辑题目”单独调整，再预览或导入编辑器</p></div>
          </div>
          <span class="status-text">{{ result.provider }} · {{ result.model }} · 用时 {{ result.elapsedMs }}ms</span>
        </div>
      </template>
      <div class="draft-intro">
        <span class="draft-intro-label">问卷标题</span>
        <h3 class="draft-title">{{ result.title }}</h3>
        <p v-if="result.description" class="draft-desc">{{ result.description }}</p>
        <div class="draft-metrics">
          <div class="draft-metric"><span class="metric-value count-value">{{ result.questions.length }}</span><span class="metric-label">题目</span></div>
          <div class="draft-metric"><span class="metric-value elapsed-value">{{ (result.elapsedMs / 1000).toFixed(1) }}s</span><span class="metric-label">生成用时</span></div>
          <div class="draft-metric"><span class="metric-value warning-value">{{ result.warnings ? result.warnings.length : 0 }}</span><span class="metric-label">审核提示</span></div>
        </div>
      </div>
      <el-alert
        v-if="result.warnings && result.warnings.length"
        type="warning"
        :closable="false"
        :title="'人工审核提示（' + result.warnings.length + ' 条）'"
      >
        <div v-for="(w, i) in result.warnings" :key="i">· {{ w }}</div>
      </el-alert>
      <div class="question-list">
        <div v-for="(q, i) in result.questions" :key="i" class="question-item">
          <div class="question-line">
            <span class="question-index">{{ i + 1 }}</span>
            <strong class="question-label">{{ q.label }}<span v-if="q.required" class="required-mark">*</span></strong>
            <el-tag size="small" :type="typeTag(q.type).type" effect="plain">{{ typeTag(q.type).label }}</el-tag>
            <el-button class="edit-question-button" size="small" :disabled="generating || importing" @click="editQuestion(i)">编辑题目</el-button>
          </div>
          <div v-if="q.type === 'RADIO' || q.type === 'CHECKBOX'" class="option-list">
            <span v-for="(o, j) in q.options" :key="j" class="option-chip"><span class="option-mark" />{{ o }}</span>
          </div>
          <div v-else-if="q.type === 'RATE'" class="rate-range">量表范围：1–{{ q.rateMax || 5 }} 分</div>
          <div v-else class="rate-range">开放题 · 文本回答</div>
        </div>
      </div>
      <el-collapse v-if="(result.assumptions && result.assumptions.length) || (result.dimensions && result.dimensions.length)" class="design-details">
        <el-collapse-item title="查看设计假设与调查维度" name="details">
          <div v-if="result.assumptions && result.assumptions.length" class="assumptions">
            <strong>设计假设（供审核）：</strong>
            <ul><li v-for="(a, i) in result.assumptions" :key="i">{{ a }}</li></ul>
          </div>
          <div v-if="result.dimensions && result.dimensions.length" class="assumptions">
            <strong>预设调查维度（供审核，不进入题目）：</strong>
            <el-tag v-for="(d, i) in result.dimensions" :key="i" size="small" class="dimension-chip" type="info" effect="plain">{{ d }}</el-tag>
          </div>
        </el-collapse-item>
      </el-collapse>
      <div class="actions result-actions">
        <el-button :disabled="generating || importing" aria-label="预览答题效果" @click="previewVisible = true"><i class="el-icon-view" />预览答题效果</el-button>
        <el-button type="primary" :loading="importing" :disabled="generating" aria-label="导入编辑器继续编辑" @click="importToEditor"><i v-if="!importing" class="el-icon-edit" />导入编辑器继续编辑</el-button>
        <el-button :disabled="generating || importing" @click="generate">重新生成</el-button>
      </div>
      <p class="result-note">{{ result.manuallyEdited ? '含手动调整：请重新核对题目与 AI 设计说明是否一致。' : '' }}导入后仍是未发布草稿，不会影响已有问卷、答卷或统计。</p>
    </el-card>

    <DraftQuestionEditor v-model="questionEditorVisible" :question="result?.questions?.[editingIndex]" :questions="result?.questions || []" :index="editingIndex" @save="saveQuestion" />
    <el-dialog v-model="previewVisible" title="问卷答题预览（不会保存答卷）" width="min(900px, 96vw)" destroy-on-close custom-class="draft-preview-dialog">
      <div v-if="result && result.kind === 'draft'" class="draft-answer-preview">
        <h2>{{ result.title }}</h2>
        <p>{{ result.description }}</p>
        <GenerateForm :form-conf="previewForm" @submit="previewSubmitted" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { generateAiDraftRequest, getAiStatusRequest } from '@/api/project/ai'
import { createFormRequest } from '@/api/project/form'
import { getRequest, postRequest } from '@/api/baseRequest'
import { convert, GenerateForm } from '@/generator'
import '@/generator/style.css'
import DraftQuestionEditor from '@/generator/DraftQuestionEditor.vue'

export default {
  name: 'AiDraft',
  components: { GenerateForm, DraftQuestionEditor },
  data() {
    return {
      status: null,
      form: { goal: '', audience: '', extra: '', questionCount: 8 },
      generating: false,
      importing: false,
      previewVisible: false,
      questionEditorVisible: false,
      editingIndex: 0,
      result: null
    }
  },
  created() {
    this.restoreDraft()
    this.loadStatus()
  },
  computed: {
    previewForm() {
      return { fields: (this.result?.questions || []).map(this.createDraftField), formBtns: true, theme: { showNumber: true } }
    }
  },
  methods: {
    editQuestion(index) {
      if (this.generating || this.importing) return
      this.editingIndex = index
      this.questionEditorVisible = true
    },
    saveQuestion(question) {
      if (this.generating || this.importing || this.result?.kind !== 'draft') return
      this.result.questions.splice(this.editingIndex, 1, question)
      this.result.manuallyEdited = true
      this.persistDraft()
      this.$message.success('已保存这道题的修改，其他题目保持原样')
    },
    createDraftField(q) {
      const field = convert.createField(q.type)
      field.config.label = q.label
      field.config.required = q.required !== false
      if (q.type === 'RADIO' || q.type === 'CHECKBOX') {
        field.config.options = q.options.map((label, i) => ({ label, value: i + 1, quotaSetting: null }))
      } else if (q.type === 'RATE') {
        field.max = q.rateMax || 5
      } else {
        field.placeholder = q.placeholder || ''
      }
      return field
    },
    previewSubmitted(data) {
      data.done?.()
      this.$message.success('预览填写完成，没有保存答卷')
    },
    // 草稿与生成时的输入保存在本标签页 sessionStorage，刷新可恢复。
    restoreDraft() {
      try {
        const saved = JSON.parse(sessionStorage.getItem('aiDraft:last') || 'null')
        if (saved && saved.form) this.form = saved.form
        if (saved && saved.result && Array.isArray(saved.result.questions)) this.result = saved.result
      } catch (e) { /* 本地缓存损坏时忽略，回到空白页 */ }
    },
    persistDraft() {
      try {
        sessionStorage.setItem('aiDraft:last', JSON.stringify({ form: this.form, result: this.result }))
      } catch (e) { /* 存储不可用时静默降级：仅失去刷新保留能力 */ }
    },
    loadStatus() {
      getAiStatusRequest().then((res) => { this.status = res.data }).catch(() => { this.status = null })
    },
    typeTag(type) {
      const map = {
        RADIO: { label: '单选', type: 'primary' },
        CHECKBOX: { label: '多选', type: 'success' },
        RATE: { label: '量表', type: 'warning' },
        TEXTAREA: { label: '开放', type: 'info' }
      }
      return map[type] || { label: type, type: 'info' }
    },
    generate() {
      if (this.generating || this.importing) return
      if (!this.form.goal.trim()) {
        this.$message.warning('请先填写调查目标')
        return
      }
      if (!this.form.audience.trim()) {
        this.$message.warning('请先填写目标人群')
        return
      }
      this.generating = true
      generateAiDraftRequest({ ...this.form }).then((res) => {
        this.result = res.data
        this.persistDraft()
        this.$message.success(res.data.kind === 'draft' ? '草稿已生成，请人工审核' : 'AI 请求澄清，请补充信息')
      }).catch((err) => {
        // 超时/网络/服务端校验失败：保留已填表单，可调整后重试或改用手工建卷
        this.$message.error((err && err.message) || '生成失败，可重试或改用手工建卷')
      }).finally(() => { this.generating = false })
    },
    reset() {
      if (this.generating || this.importing) return
      this.result = null
      this.form = { goal: '', audience: '', extra: '', questionCount: 8 }
      sessionStorage.removeItem('aiDraft:last')
      sessionStorage.removeItem('aiDraft:import')
    },
    focusGoal() {
      this.$el.querySelector('.input-card textarea')?.focus()
    },
    // 草稿导入：新建 CREATE 状态问卷 + 逐题走现有题目接口（与编辑器同构），随后进入现有编辑器。
    // 断点续传：导入会话记入 sessionStorage；第 N 题保存失败后重试会复用同一份问卷，
    // 只续传完整内容一致的草稿；重新生成后内容变化须独立导入。
    draftKey() {
      return JSON.stringify({ title: this.result.title, description: this.result.description || '', questions: this.result.questions })
    },
    async importToEditor() {
      if (this.importing || this.generating || this.result?.kind !== 'draft') return
      const questions = this.result.questions
      const title = this.result.title.slice(0, 100)
      const key = this.draftKey()
      let session = null
      try {
        session = JSON.parse(sessionStorage.getItem('aiDraft:import') || 'null')
      } catch (e) { session = null }
      if (session && session.draftKey !== key) {
        const legacyKey = JSON.stringify([this.result.title, questions.map((q) => [q.type, q.label])])
        if (session.draftKey === legacyKey) {
          this.$message.warning('检测到旧版导入记录，无法确认内容是否一致。请先到“我的项目”检查原问卷；需要另建时，请清空结果后重新生成')
          return
        }
        this.$message.warning('草稿内容已变化，将单独导入。上一份已保存的草稿仍可在“我的项目”中管理')
        session = null
      }
      this.importing = true
      let formKey = ''
      let saved = 0
      try {
        if (session && session.formKey) {
          // 查询失败不等于问卷不存在：保留续传记录，禁止自动另建。
          let chk
          try {
            chk = await getRequest('/user/form/' + session.formKey)
          } catch (e) {
            throw new Error('暂时无法确认原导入问卷状态，已保留续传记录。请恢复网络或登录状态后重试，不会自动新建问卷')
          }
          if (!chk || chk.code !== 200 || !chk.data) throw new Error('无法确认原导入问卷，已保留续传记录，请稍后重试')
          if (Number(chk.data.status) !== 1) throw new Error('原导入问卷已不再是未发布草稿。请到“我的项目”确认；需要另建时，请清空结果后重新生成')
          formKey = session.formKey
        }
        if (!formKey) {
          const res = await createFormRequest({ name: title, description: this.result.description || '', type: 0, folderId: 0 })
          formKey = typeof res.data === 'string' ? res.data : res.data.formKey
          sessionStorage.setItem('aiDraft:import', JSON.stringify({ draftKey: key, formKey }))
        }
        const list = await getRequest('/user/form/item/list', { key: formKey })
        const done = new Set((list.data || []).map((x) => x.type + '|' + x.label))
        saved = done.size
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i]
          if (done.has(q.type + '|' + q.label)) continue
          try {
            await postRequest('/user/form/item/create', convert.formItemConvertData(this.createDraftField(q), formKey))
            saved++
          } catch (e) {
            throw new Error('第 ' + (i + 1) + ' 题保存失败：已保存 ' + saved + '/' + questions.length + ' 题。可重试“导入编辑器”自动续传剩余题目，不会重复建卷')
          }
        }
        this.$message.success('已创建问卷草稿（未发布），正在打开编辑器')
        this.$router.push({ path: '/project/form/editor', query: { key: formKey } })
      } catch (e) {
        this.$message.error((e && (e.message || e.msg)) || '导入失败，可重试导入或改用手工建卷')
      } finally { this.importing = false }
    }
  }
}
</script>

<style lang="scss" scoped>
.ai-draft-container {
  width: 100%;
  max-width: 1160px;
  height: 100%;
  padding: 26px 32px 44px;
  margin: 0 auto;
  overflow-x: hidden;
  overflow-y: auto;
  color: var(--zy-text);
  font-family: var(--zy-font-family);
}
.draft-page-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
.page-eyebrow { margin-bottom: 4px; color: var(--zy-purple); font-size: 11px; font-weight: 500; }
.draft-page-header h1 { margin: 0 0 5px; font-size: 18px; font-weight: 600; }
.draft-page-header p { margin: 0; color: var(--zy-text-secondary); font-size: 12px; line-height: 1.6; }
.ai-status { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-end; max-width: 360px; }
.status-text { color: var(--zy-text-secondary); font-size: 11px; line-height: 1.5; word-break: break-word; }
:deep(.el-card) { background: var(--zy-surface); border-color: var(--zy-border); border-radius: var(--zy-radius-md); }
:deep(.el-card__header) { padding: 17px 22px; border-bottom-color: var(--zy-border-light); }
:deep(.el-card__body) { padding: 22px; }
.card-header { display: flex; gap: 16px; align-items: center; justify-content: space-between; }
.section-heading { display: flex; gap: 10px; align-items: flex-start; }
.section-heading h2 { margin: 0; font-size: 15px; font-weight: 600; line-height: 22px; }
.section-heading p { margin: 3px 0 0; color: var(--zy-text-secondary); font-size: 11px; font-weight: 400; line-height: 1.6; }
.section-number { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; width: 24px; height: 22px; color: var(--zy-purple); font-family: var(--zy-font-number); font-size: 11px; font-weight: 600; background: #f3e8ff; border-radius: var(--zy-radius-sm); }
.section-caption { color: var(--zy-text-secondary); font-size: 12px; white-space: nowrap; }
:deep(.el-form-item) { margin-bottom: 18px; }
:deep(.el-form-item__label) { height: auto; padding-bottom: 8px; color: var(--zy-text-regular); font-size: 12px; font-weight: 500; line-height: 20px; }
:deep(.el-input__wrapper), :deep(.el-textarea__inner) { background: var(--zy-surface-subtle); border-radius: var(--zy-radius-sm); box-shadow: 0 0 0 1px var(--zy-border) inset; }
:deep(.el-textarea__inner) { padding: 10px 12px; line-height: 1.7; }
:deep(.el-input__inner), :deep(.el-textarea__inner) { font-family: var(--zy-font-family); font-size: 13px; }
.field-help { margin-top: 7px; color: var(--zy-text-secondary); font-size: 11px; line-height: 1.6; }
.form-grid { display: grid; grid-template-columns: minmax(0, 1fr) 200px; gap: 24px; }
.question-count-control { display: flex; gap: 10px; align-items: center; color: var(--zy-text-regular); font-size: 13px; }
:deep(.el-input-number) { width: 168px; }
:deep(.el-input-number .el-input__wrapper) { padding: 0 38px; }
:deep(.el-input-number .el-input__inner) { width: 100%; min-width: 0; padding: 0; font-family: var(--zy-font-number); font-weight: 600; color: var(--zy-purple); }
.extra-field { margin-bottom: 4px !important; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.actions :deep(.el-button) { min-height: 36px; padding: 0 14px; margin: 0; font-weight: 500; border-radius: var(--zy-radius-sm); }
.actions :deep(.el-button i) { margin-right: 6px; }
.actions :deep(.el-button--primary) { color: #fff; background: var(--zy-primary); border-color: var(--zy-primary); }
.actions :deep(.el-button--primary:hover) { background: var(--zy-primary-hover); border-color: var(--zy-primary-hover); }
.actions :deep(.el-button:not(.el-button--primary)) { color: var(--zy-text-regular); background: rgba(255, 255, 255, 0.78); border-color: var(--zy-border); backdrop-filter: blur(10px); }
.input-actions { padding-top: 17px; border-top: 1px solid var(--zy-border-light); }
.hint { flex: 1; min-width: 220px; color: var(--zy-text-secondary); font-size: 11px; line-height: 1.7; }
.result-card { margin-top: 16px; }
.result-header { align-items: flex-start; }
.result-header > .status-text { max-width: 250px; padding-top: 2px; text-align: right; }
.question-total { margin-left: 6px; color: var(--zy-text-secondary); font-size: 12px; font-weight: 400; }
.draft-intro { padding: 0 0 18px; margin-bottom: 4px; border-bottom: 1px solid var(--zy-border-light); }
.draft-intro-label { display: block; margin-bottom: 6px; color: var(--zy-text-secondary); font-size: 11px; }
.draft-title { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.6; }
.draft-desc { margin: 8px 0 0; color: var(--zy-text-regular); font-size: 13px; line-height: 1.8; white-space: pre-wrap; }
.draft-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.draft-metric { padding: 11px 12px; background: var(--zy-surface-subtle); border: 1px solid var(--zy-border-light); border-radius: var(--zy-radius-sm); }
.metric-value { display: block; margin-bottom: 3px; font-family: var(--zy-font-number); font-size: 16px; font-weight: 650; }
.count-value { color: var(--zy-primary); }
.elapsed-value { color: var(--zy-purple); }
.warning-value { color: var(--zy-warning); }
.metric-label { color: var(--zy-text-secondary); font-size: 11px; }
.question-item { padding: 16px 0; border-bottom: 1px solid var(--zy-border-light); }
.question-line { display: flex; gap: 10px; align-items: flex-start; }
.edit-question-button { flex-shrink: 0; margin: 0; }
.question-index { flex-shrink: 0; min-width: 22px; padding-top: 2px; color: var(--zy-purple); font-family: var(--zy-font-number); font-size: 12px; font-weight: 600; }
.question-label { flex: 1; min-width: 0; font-size: 14px; font-weight: 500; line-height: 1.7; word-break: break-word; }
.required-mark { margin-left: 4px; color: var(--zy-danger); }
.option-list { display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 10px 0 0 32px; }
.option-chip { display: inline-flex; gap: 7px; align-items: center; color: var(--zy-text-regular); font-size: 12px; line-height: 1.6; }
.option-mark { width: 10px; height: 10px; border: 1px solid #b8c0ce; border-radius: 50%; }
.rate-range { padding: 8px 0 0 32px; color: var(--zy-text-secondary); font-size: 12px; }
.design-details { margin-top: 8px; border: 0; }
:deep(.design-details .el-collapse-item__header) { height: 40px; color: var(--zy-text-regular); font-size: 12px; border: 0; }
:deep(.design-details .el-collapse-item__wrap) { border: 0; }
.assumptions { color: var(--zy-text-regular); font-size: 13px; line-height: 1.7; }
.assumptions ul { padding-left: 18px; margin: 8px 0 16px; }
.dimension-chip { margin: 8px 6px 0 0; }
.result-actions { padding-top: 18px; margin-top: 4px; border-top: 1px solid var(--zy-border-light); }
.result-note { margin: 11px 0 0; color: var(--zy-text-secondary); font-size: 11px; line-height: 1.7; }
.clarify-list { padding-left: 20px; line-height: 1.8; }
.clarify-list li { margin-bottom: 8px; }
.draft-answer-preview { max-width: 760px; margin: 0 auto; }
.draft-answer-preview > h2 { font-size: 22px; line-height: 1.5; }
.draft-answer-preview > p { color: var(--zy-text-regular); line-height: 1.8; }
@media (max-width: 767px) {
  .ai-draft-container { padding: 22px 14px 36px; }
  .draft-page-header { align-items: flex-start; flex-direction: column; gap: 12px; }
  .draft-page-header h1 { font-size: 17px; }
  .ai-status { justify-content: flex-start; max-width: 100%; }
  :deep(.el-card__header), :deep(.el-card__body) { padding: 17px 15px; }
  .section-caption { display: none; }
  .form-grid { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .question-count-control { justify-content: flex-start; }
  .draft-metrics { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .input-actions { align-items: stretch; }
  .input-actions .hint { flex-basis: 100%; min-width: 0; }
  .result-header { flex-direction: column; }
  .result-header > .status-text { max-width: 100%; text-align: left; }
  .result-actions { align-items: stretch; flex-direction: column; }
  .result-actions :deep(.el-button) { width: 100%; }
  .option-list { gap: 7px 14px; }
  .question-line { flex-wrap: wrap; }
  .question-line .question-label { flex-basis: calc(100% - 34px); }
  .question-line > .el-tag { margin-left: 32px; }
}
</style>

<style lang="scss">
.draft-preview-dialog {
  border-radius: var(--zy-radius-md);
  .el-dialog__title { font-size: 16px; }
  .el-dialog__body { max-height: calc(100dvh - 140px); overflow-y: auto; }
}
@media (max-width: 767px) {
  .draft-preview-dialog .el-dialog__body { padding: 16px; }
}
</style>
