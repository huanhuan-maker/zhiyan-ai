<template>
  <div class="app-container ai-draft-container">
    <el-card shadow="never" class="input-card">
      <template #header>
        <div class="card-header">
          <span class="title">AI 生成问卷草稿</span>
          <span v-if="status" class="ai-status">
            <el-tag :type="status.mode === 'REAL' ? 'success' : 'warning'" size="small" effect="dark">
              {{ status.mode === 'REAL' ? '真实 AI' : 'Mock 模式' }}
            </el-tag>
            <span class="status-text">{{ status.provider }} · {{ status.model }}</span>
            <el-tooltip v-if="status.mode !== 'REAL'" content="未配置真实 AI 密钥时使用本地模板生成，内容未经真实模型；手工建卷不受影响" placement="top">
              <i class="el-icon-warning-outline"></i>
            </el-tooltip>
          </span>
        </div>
      </template>

      <el-form ref="form" :model="form" label-width="90px" @submit.prevent>
        <el-form-item label="调查目标" required>
          <el-input
            v-model="form.goal"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="例：我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人"
          />
        </el-form-item>
        <el-form-item label="目标人群" required>
          <el-input v-model="form.audience" maxlength="100" placeholder="例：在校大学生" />
        </el-form-item>
        <el-form-item label="补充信息">
          <el-input v-model="form.extra" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="可选：已有假设、必须覆盖的方面、措辞要求等" />
        </el-form-item>
        <el-form-item label="期望题数" required>
          <el-input-number v-model="form.questionCount" :min="1" :max="30" />
        </el-form-item>
      </el-form>

      <div class="actions">
        <el-button type="primary" :loading="generating" :disabled="importing" @click="generate">生成草稿</el-button>
        <el-button v-if="result" :disabled="generating || importing" @click="reset">清空结果</el-button>
        <span class="hint">AI 仅生成可编辑草稿，不写库、不发布；发布由你在编辑器里手动完成</span>
      </div>
    </el-card>

    <el-card v-if="result && result.kind === 'clarification'" shadow="never" class="result-card">
      <template #header><div class="card-header"><span class="title">目标需要澄清</span></div></template>
      <el-alert type="warning" :closable="false" title="AI 认为当前调查目标过于含糊，建议先澄清以下问题再生成" />
      <ol class="clarify-list">
        <li v-for="(q, i) in result.clarification" :key="i">{{ q }}</li>
      </ol>
      <div v-if="result.assumptions && result.assumptions.length" class="assumptions">
        <strong>初步假设（供参考）：</strong>
        <ul>
          <li v-for="(a, i) in result.assumptions" :key="i">{{ a }}</li>
        </ul>
      </div>
      <el-button type="primary" plain @click="focusGoal">补充目标信息后重新生成</el-button>
    </el-card>

    <el-card v-if="result && result.kind === 'draft'" shadow="never" class="result-card">
      <template #header>
        <div class="card-header">
          <span class="title">草稿预览（{{ result.questions.length }} 题）</span>
          <span class="status-text">{{ result.provider }} · {{ result.model }} · 用时 {{ result.elapsedMs }}ms</span>
        </div>
      </template>

      <p class="draft-title">{{ result.title }}</p>
      <p v-if="result.description" class="draft-desc">{{ result.description }}</p>

      <el-alert
        v-if="result.warnings && result.warnings.length"
        type="warning"
        :closable="false"
        :title="'人工审核提示（' + result.warnings.length + ' 条）'"
      >
        <div v-for="(w, i) in result.warnings" :key="i">· {{ w }}</div>
      </el-alert>

      <div v-for="(q, i) in result.questions" :key="i" class="question-item">
        <div class="question-line">
          <el-tag size="small" :type="typeTag(q.type).type" effect="plain">{{ typeTag(q.type).label }}</el-tag>
          <strong class="question-label">{{ i + 1 }}. {{ q.label }}</strong>
          <span v-if="q.required" class="required-mark">*</span>
        </div>
        <div v-if="q.type === 'RADIO' || q.type === 'CHECKBOX'" class="option-list">
          <el-tag v-for="(o, j) in q.options" :key="j" size="small" type="info" effect="plain" class="option-chip">{{ o }}</el-tag>
        </div>
        <div v-else-if="q.type === 'RATE'" class="rate-range">量表范围：1 - {{ q.rateMax || 5 }} 分</div>
        <div v-else class="rate-range">开放题（文本回答）</div>
      </div>

      <div v-if="result.assumptions && result.assumptions.length" class="assumptions">
        <strong>设计假设（供审核）：</strong>
        <ul>
          <li v-for="(a, i) in result.assumptions" :key="i">{{ a }}</li>
        </ul>
      </div>
      <div v-if="result.dimensions && result.dimensions.length" class="assumptions">
        <strong>预设调查维度（供审核，不进入题目）：</strong>
        <el-tag v-for="(d, i) in result.dimensions" :key="i" size="small" class="option-chip" type="success" effect="plain">{{ d }}</el-tag>
      </div>

      <div class="actions">
        <el-button :disabled="generating || importing" @click="previewVisible = true">预览答题效果</el-button>
        <el-button type="primary" :loading="importing" :disabled="generating" @click="importToEditor">导入编辑器继续编辑</el-button>
        <el-button :disabled="generating || importing" @click="generate">重新生成</el-button>
      </div>
    </el-card>
    <el-dialog v-model="previewVisible" title="问卷答题预览（不会保存答卷）" width="min(900px, 96vw)" destroy-on-close>
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

export default {
  name: 'AiDraft',
  components: { GenerateForm },
  data() {
    return {
      status: null,
      form: { goal: '', audience: '', extra: '', questionCount: 8 },
      generating: false,
      importing: false,
      previewVisible: false,
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
      } catch (e) {
        /* 本地缓存损坏时忽略，回到空白页 */
      }
    },
    persistDraft() {
      try {
        sessionStorage.setItem('aiDraft:last', JSON.stringify({ form: this.form, result: this.result }))
      } catch (e) {
        /* 存储不可用时静默降级：仅失去刷新保留能力 */
      }
    },
    loadStatus() {
      getAiStatusRequest()
        .then((res) => {
          this.status = res.data
        })
        .catch(() => {
          this.status = null
        })
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
      generateAiDraftRequest({ ...this.form })
        .then((res) => {
          this.result = res.data
          this.persistDraft()
          this.$message.success(res.data.kind === 'draft' ? '草稿已生成，请人工审核' : 'AI 请求澄清，请补充信息')
        })
        .catch((err) => {
          // 超时/网络/服务端校验失败：保留已填表单，可调整后重试或改用手工建卷
          this.$message.error((err && err.message) || '生成失败，可重试或改用手工建卷')
        })
        .finally(() => {
          this.generating = false
        })
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
      return JSON.stringify({
        title: this.result.title,
        description: this.result.description || '',
        questions: this.result.questions
      })
    },
    async importToEditor() {
      if (this.importing || this.generating || this.result?.kind !== 'draft') return
      const questions = this.result.questions
      const title = this.result.title.slice(0, 100)
      const key = this.draftKey()
      let session = null
      try {
        session = JSON.parse(sessionStorage.getItem('aiDraft:import') || 'null')
      } catch (e) {
        session = null
      }
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
          if (!chk || chk.code !== 200 || !chk.data) {
            throw new Error('无法确认原导入问卷，已保留续传记录，请稍后重试')
          }
          if (Number(chk.data.status) !== 1) {
            throw new Error('原导入问卷已不再是未发布草稿。请到“我的项目”确认；需要另建时，请清空结果后重新生成')
          }
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
      } finally {
        this.importing = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.ai-draft-container {
  max-width: 960px;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  margin: 0 auto;
  :deep(.el-input-number) {
    width: 168px;
    .el-input__wrapper { padding: 0 36px; }
    .el-input__inner { padding: 0; width: 100%; min-width: 0; box-sizing: border-box; }
  }
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  .title {
    font-weight: 600;
  }
}
.ai-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  .status-text {
    color: #606266;
    font-size: 13px;
  }
}
.actions {
  margin-top: 8px;
  .hint {
    margin-left: 12px;
    color: #909399;
    font-size: 12px;
  }
}
.result-card {
  margin-top: 16px;
}
.draft-title {
  font-size: 16px;
  font-weight: 600;
  margin: 4px 0;
}
.draft-desc {
  color: #606266;
  margin-top: 0;
}
.question-item {
  padding: 10px 4px;
  border-bottom: 1px dashed #ebeef5;
  .question-line {
    display: flex;
    align-items: center;
    gap: 8px;
    .question-label {
      flex: 1;
    }
    .required-mark {
      color: #f56c6c;
    }
  }
  .option-list {
    margin-top: 6px;
    .option-chip {
      margin-right: 6px;
      margin-bottom: 4px;
    }
  }
  .rate-range {
    margin-top: 6px;
    color: #909399;
    font-size: 13px;
  }
}
.clarify-list {
  margin: 12px 0 8px 20px;
  li {
    margin-bottom: 6px;
  }
}
.assumptions {
  margin-top: 12px;
  color: #606266;
  font-size: 13px;
  ul {
    margin: 4px 0 0 20px;
  }
  .option-chip {
    margin: 4px 6px 0 0;
  }
}
</style>
