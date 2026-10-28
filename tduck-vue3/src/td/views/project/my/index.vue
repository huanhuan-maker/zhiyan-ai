<template>
  <div class="app-container project-page">
    <div class="form-container">
      <section class="ai-strip" aria-label="AI 建卷入口">
        <div class="ai-strip-copy">
          <span class="ai-strip-tag"><i class="el-icon-magic-stick" /> AI 建卷</span>
          <h2>用一句话生成一份可编辑问卷</h2>
          <p>描述研究目标与人群，AI 给出题型、选项和量表；对比候选后逐题精修，再导入编辑器发布。</p>
        </div>
        <div class="ai-strip-actions">
          <el-button type="primary" class="ai-strip-btn" aria-label="进入 AI 建卷" @click="$router.push({ path: '/home/ai' })">
            开始 AI 建卷
            <i class="el-icon-right" />
          </el-button>
        </div>
      </section>

      <div class="project-header">
        <div class="header-left">
          <h2 class="page-title">问卷概览</h2>
          <p class="page-subtitle">共 <AnimatedNumber :value="total || 0" /> 份问卷<span v-if="folderList.length">，<AnimatedNumber :value="folderList.length" /> 个文件夹</span><span v-if="savedDrafts.length && !queryParams.folderId">，另有 <AnimatedNumber :value="savedDrafts.length" /> 份 AI 暂存</span></p>
        </div>
        <div class="header-right">
          <el-button class="ai-create-btn" aria-label="AI 建卷" @click="newAiDraft">
            <i class="el-icon-magic-stick" />
            AI 建卷
          </el-button>
          <el-button class="create-btn" type="primary" aria-label="新建问卷" :icon="tdIcon('el-icon-plus')" @click="createFormVisible = true">
            新建问卷
          </el-button>
        </div>
      </div>

      <section class="filter-view" aria-label="问卷筛选">
        <div class="status-filter" role="group" aria-label="按状态筛选">
          <button
            v-for="status in projectStatusList"
            :key="status.code"
            type="button"
            class="status-filter-item"
            :class="{ active: queryParams.status === status.code }"
            :aria-pressed="queryParams.status === status.code"
            @click="handleStatusChange(status.code)"
          >
            {{ status.name }}
          </button>
        </div>
        <div class="toolbar-right">
          <el-input
            v-model="queryParams.name"
            placeholder="搜索问卷名称"
            class="search-input"
            :prefix-icon="tdIcon('el-icon-search')"
            clearable
            aria-label="搜索问卷名称"
            @keyup.enter="queryProjectPage"
            @clear="queryProjectPage"
          />
          <el-popover placement="bottom-end" width="340" trigger="click" popper-class="date-filter-popover">
            <div class="date-filter-panel">
              <div class="panel-title">按更新时间筛选</div>
              <el-date-picker
                v-model="queryParams.beginDateTime"
                placeholder="开始时间"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
              <div class="date-to">至</div>
              <el-date-picker
                v-model="queryParams.endDateTime"
                :default-time="'23:59:59'"
                placeholder="结束时间"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
              <div class="panel-actions">
                <el-button @click="clearDateFilter">重置</el-button>
                <el-button type="primary" @click="applyDateFilter">应用筛选</el-button>
              </div>
            </div>
            <template #reference>
              <el-button
                :icon="tdIcon('el-icon-date')"
                class="date-btn"
                :class="{ active: queryParams.beginDateTime || queryParams.endDateTime }"
              >
                时间筛选
              </el-button>
            </template>
          </el-popover>
          <div class="view-switch" role="group" aria-label="视图切换">
            <button
              type="button"
              class="switch-btn"
              :class="{ active: dataShowType == 'card' }"
              aria-label="卡片视图"
              :aria-pressed="dataShowType == 'card'"
              @click="dataShowType = 'card'"
            >
              <i class="el-icon-menu" />
            </button>
            <button
              type="button"
              class="switch-btn"
              :class="{ active: dataShowType == 'table' }"
              aria-label="列表视图"
              :aria-pressed="dataShowType == 'table'"
              @click="dataShowType = 'table'"
            >
              <i class="el-icon-tickets" />
            </button>
          </div>
        </div>
      </section>

      <div class="content-view">
        <nav v-if="queryParams.folderId" class="folder-breadcrumb" data-testid="folder-breadcrumb" aria-label="当前文件夹路径">
          <button type="button" class="crumb-root" @click="goRoot">
            <i class="el-icon-back" aria-hidden="true" />
            根目录
          </button>
          <span class="crumb-separator" aria-hidden="true">/</span>
          <span class="crumb-current" aria-current="page">{{ currentFolderTitle }}</span>
          <el-button class="crumb-back-btn" data-testid="folder-back" @click="goRoot">返回根目录</el-button>
        </nav>
        <div v-if="dataShowType == 'table' && !queryParams.folderId && folderList.length" class="folder-chip-bar" aria-label="文件夹">
          <span class="folder-chip-label">文件夹</span>
          <button
            v-for="folder in folderList"
            :key="'folder-chip-' + folder.id"
            type="button"
            class="folder-chip"
            :data-folder-id="folder.id"
            :aria-label="folderAriaLabel(folder, folderCounts[folder.id])"
            @click="enterFolder(folder)"
          >
            <i class="el-icon-folder" aria-hidden="true" />
            <span class="folder-chip-name">{{ folderDisplayName(folder) }}</span>
            <span class="folder-chip-meta">{{ folderMetaLabel(folderCounts[folder.id]) }}</span>
          </button>
        </div>
        <el-alert v-if="savedDraftError && !queryParams.folderId" class="saved-draft-error" type="warning" :closable="false" title="AI 暂存暂时无法读取，问卷列表仍可使用">
          <el-button size="small" @click="loadSavedDraft">重试</el-button>
        </el-alert>
        <!-- AI 暂存是全局草稿，不属于任何文件夹，进入文件夹后不展示 -->
        <article v-for="draft in visibleDraftCards" :key="draft.id" class="saved-draft-card" data-testid="saved-ai-draft">
          <div class="saved-draft-content">
            <div class="saved-draft-meta"><span class="saved-draft-badge">AI 暂存</span><span>未发布 · {{ draft.snapshot?.result?.questions?.length || 0 }} 题</span></div>
            <h3>{{ draft.snapshot?.result?.title || 'AI 建卷暂存' }}</h3>
            <p>上次暂存：{{ draft.updatedAt ? formatSavedTime(draft.updatedAt) : '时间未知' }}</p>
          </div>
          <div class="saved-draft-actions"><el-button @click="removeSavedDraft(draft)">移除暂存</el-button><el-button type="primary" @click="$router.push({ path: '/project/form/ai-draft', query: { draft: draft.id } })">继续编辑</el-button></div>
        </article>
        <el-alert
          v-if="projectListError"
          class="project-list-error"
          type="error"
          :closable="false"
          title="问卷列表暂时加载失败，已保留当前页面内容"
        >
          <template #default>
            <el-button size="small" type="danger" plain @click="queryProjectPage">重试</el-button>
          </template>
        </el-alert>
        <form-card-list
          v-if="dataShowType == 'card' && (projectList.length || folderList.length || queryParams.folderId || !visibleSavedDrafts.length)"
          v-loading="projectListLoading"
          v-model:project-list="projectList"
          :folders="folderList"
          :folder-counts="folderCounts"
          :inside-folder="queryParams.folderId > 0"
          :folder-name="currentFolderTitle"
          :filters-active="filtersActive"
          @open-folder="enterFolder"
          @refresh="queryProjectPage"
        />
        <my-form-table
          v-if="dataShowType == 'table' && (projectList.length || !visibleSavedDrafts.length)"
          v-loading="projectListLoading"
          v-model:project-list="projectList"
          @refresh="queryProjectPage"
        />
      </div>
      <div class="project-page-view">
        <el-pagination
          v-if="total > 0"
          v-model:current-page="queryParams.current"
          v-model:page-size="queryParams.size"
          :page-sizes="pageSizes"
          :total="total"
          background
          :layout="paginationLayout"
          @size-change="handleSizeChange"
          @current-change="queryProjectPage"
        />
      </div>
    </div>

    <el-dialog
      v-model="createFormVisible"
      custom-class="create-form-dialog"
      title="新建问卷"
      width="min(480px, calc(100vw - 32px))"
      append-to-body
    >
      <div class="dialog-body">
        <p class="dialog-description">先填写基本信息，进入编辑器后可添加单选、多选、量表和开放题。</p>
        <el-form ref="createForm" :model="formData" label-position="top">
          <el-form-item :rules="[{ required: true, message: '名称不能为空' }]" label="问卷名称" prop="name">
            <el-input v-model="formData.name" placeholder="例如：大学生学习体验调查" autocomplete="off" />
          </el-form-item>
          <el-form-item label="问卷说明" prop="description">
            <el-input
              v-model="formData.description"
              :rows="3"
              placeholder="说明调查目的和填写注意事项（可选）"
              autocomplete="off"
              type="textarea"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="createFormVisible = false">取消</el-button>
          <el-button type="primary" :loading="requestLoading.pushFormData" @click="createFormHandle">创建并编辑</el-button>
        </span>
      </template>
    </el-dialog>
    <chat-form-dialog ref="chatFormDialog" />
  </div>
</template>

<script>
import { createFormRequest, listFormAnswerCountRequest, pageFormRequest, updateFormRequest } from '@/api/project/form'
import { applyAnswerCounts } from '@/utils/answerCounts'
import { folderAriaLabel, folderDisplayName, folderMetaLabel } from '@/utils/formGroups'
import { listAiDraftSlotsRequest, removeAiDraftSlotRequest } from '@/api/project/ai'
import dayjs from 'dayjs'
import FormCardList from './card'
import mixin from './mixin'
import MyFormTable from './table'
import ChatFormDialog from '@/views/ai/form/ChatFormDialog.vue'

export default {
  name: 'MyProject',
  components: { MyFormTable, FormCardList, ChatFormDialog },
  mixins: [mixin],
  data() {
    return {
      isMobile: false,
      initializedSize: false,
      pageSizes: [12, 24, 36, 48],
      createFormVisible: null,
      dataShowType: 'card',
      total: 0,
      queryParams: { current: 1, size: 12, name: '', beginDateTime: null, endDateTime: null, status: null, folderId: 0 },
      formData: { description: '', name: '未命名问卷', type: 0 },
      projectList: [],
      // 文件夹行单独请求（folder=1），与问卷列表分开渲染，不计入「共 N 份问卷」。
      folderList: [],
      folderCounts: {},
      activeFolderName: '',
      answerCountToken: 0,
      folderCountToken: 0,
      projectRequestToken: 0,
      projectListLoading: true,
      projectListError: false,
      savedDrafts: [],
      savedDraftError: false,
      pageCurrent: '',
      requestLoading: { pushFormData: false, pushFolderData: false }
    }
  },
  computed: {
    paginationLayout() {
      return this.isMobile ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
    },
    currentFolderTitle() {
      return this.activeFolderName || '文件夹'
    },
    // 文件夹内如果没有筛选条件却一条问卷都没有，就是真正的空文件夹。
    filtersActive() {
      return Boolean(
        (this.queryParams.name || '').trim() ||
          this.queryParams.status ||
          this.queryParams.beginDateTime ||
          this.queryParams.endDateTime
      )
    },
    // AI 暂存是全局草稿，不属于任何文件夹，进入文件夹后不展示。
    visibleDraftCards() {
      return this.queryParams.folderId ? [] : this.visibleSavedDrafts
    },
    visibleSavedDrafts() {
      if (this.queryParams.status && Number(this.queryParams.status) !== 1) return []
      const name = (this.queryParams.name || '').trim().toLowerCase()
      return this.savedDrafts.filter(draft => {
        if (name && !(draft.snapshot?.result?.title || 'AI 建卷暂存').toLowerCase().includes(name)) return false
        const time = dayjs(draft.updatedAt).valueOf()
        if (this.queryParams.beginDateTime && time < dayjs(this.queryParams.beginDateTime).valueOf()) return false
        if (this.queryParams.endDateTime && time > dayjs(this.queryParams.endDateTime).valueOf()) return false
        return true
      })
    }
  },
  created() {
    this.isMobile = window.innerWidth < 768
    this.queryParams.current = 1
    // 支持刷新/分享带 folderId 的地址，直接落在对应文件夹。
    const routeFolderId = Number(this.$route.query.folderId)
    if (Number.isFinite(routeFolderId) && routeFolderId > 0) {
      this.queryParams.folderId = routeFolderId
      this.activeFolderName = String(this.$route.query.folderName || '')
    }
  },
  watch: {
    // 浏览器前进/后退时同步文件夹状态。
    '$route.query.folderId'(value) {
      const id = Number(value) || 0
      if (id === this.queryParams.folderId) return
      this.queryParams.folderId = id
      this.queryParams.current = 1
      this.activeFolderName = id ? String(this.$route.query.folderName || '') : ''
      this.queryProjectPage()
    }
  },
  mounted() {
    this.loadSavedDraft()
    this.initResizeObserver()
  },
  beforeUnmount() {
    if (this.resizeObserver) this.resizeObserver.disconnect()
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler)
  },
  methods: {
    folderAriaLabel,
    folderDisplayName,
    folderMetaLabel,
    async loadSavedDraft() {
      try {
        const res = await listAiDraftSlotsRequest()
        this.savedDrafts = res.data || []
        this.savedDraftError = false
      } catch (e) { this.savedDraftError = true }
    },
    formatSavedTime(value) { return dayjs(value).format('YYYY/MM/DD HH:mm') },
    // 收集份数单独批量查询：失败时列表照常显示，卡片用占位符而不是假 0。
    loadAnswerCounts(records) {
      const keys = (records || []).map((item) => item.formKey).filter(Boolean)
      if (!keys.length) return
      const token = ++this.answerCountToken
      listFormAnswerCountRequest(keys)
        .then((res) => {
          if (token !== this.answerCountToken) return
          this.projectList = applyAnswerCounts(this.projectList, res.data || {})
        })
        .catch(() => {})
    },
    newAiDraft() { this.$router.push({ path: '/home/ai' }) },
    async removeSavedDraft(draft) {
      try { await this.$confirm('移除后这份暂存将无法恢复，确定移除吗？已导入的问卷不受影响。', '移除暂存', { type: 'warning', confirmButtonText: '移除', cancelButtonText: '取消' }) } catch (e) { return }
      try { await removeAiDraftSlotRequest(draft.id); await this.loadSavedDraft(); this.$message.success('已移除暂存') } catch (e) { this.$message.error('移除失败，请重试') }
    },
    initResizeObserver() {
      let timer = null
      const container = this.$el.querySelector('.form-container')
      if (container && window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver((entries) => {
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => {
            for (let entry of entries) this.updatePageSizeByWidth(entry.contentRect.width)
          }, 200)
        })
        this.resizeObserver.observe(container)
      } else {
        this.checkScreenSize()
        this.resizeHandler = () => {
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => this.checkScreenSize(), 200)
        }
        window.addEventListener('resize', this.resizeHandler)
      }
    },
    updatePageSizeByWidth(containerWidth) {
      this.isMobile = window.innerWidth < 768
      let cols = Math.floor((containerWidth + 20) / 300)
      if (cols < 1) cols = 1
      const newSize = cols * 3
      if (this.queryParams.size !== newSize) {
        this.queryParams.size = newSize
        this.pageSizes = [newSize, newSize * 2, newSize * 3, newSize * 4]
        if (this.initializedSize) this.queryParams.current = 1
        this.initializedSize = true
        this.queryProjectPage()
      } else if (!this.initializedSize) {
        this.initializedSize = true
        this.queryProjectPage()
      }
    },
    checkScreenSize() {
      const container = this.$el.querySelector('.form-container')
      this.updatePageSizeByWidth(container ? container.clientWidth : window.innerWidth - 48)
    },
    handleSizeChange(val) {
      this.queryParams.size = val
      this.queryParams.current = 1
      this.queryProjectPage()
    },
    createFormHandle() {
      this.$refs['createForm'].validate((valid) => {
        if (!valid) return false
        this.formData.folderId = this.queryParams.folderId || 0
        this.requestLoading.pushFormData = true
        createFormRequest({ ...this.formData, name: `<h2 style="text-align: center;">${this.formData.name}</h2>` })
          .then((res) => {
            this.toProjectHandle(res.data, 'editor')
            this.requestLoading.pushFormData = false
          })
          .catch(() => { this.requestLoading.pushFormData = false })
      })
    },
    queryProjectPage() {
      this.projectListError = false
      this.projectListLoading = true
      const requestToken = ++this.projectRequestToken
      const insideFolder = this.queryParams.folderId > 0
      // 问卷列表排除文件夹行（folder=0），「共 N 份问卷」只统计问卷本身。
      const surveyRequest = pageFormRequest({ ...this.queryParams, folder: 0 })
      // 文件夹只在根目录展示；单独请求，size 取 50 足够覆盖当前账号的文件夹。
      const folderRequest = insideFolder
        ? Promise.resolve(null)
        : pageFormRequest({ current: 1, size: 50, folder: 1, folderId: 0, name: this.queryParams.name || undefined })
      Promise.all([surveyRequest, folderRequest])
        .then(([res, folderRes]) => {
          if (requestToken !== this.projectRequestToken) return
          const data = (res && res.data) || {}
          const records = Array.isArray(data.records) ? data.records : []
          this.projectList = records
          this.total = Number(data.total) || 0
          if (data.size) this.queryParams.size = data.size
          if (folderRes) {
            const folderRecords = folderRes.data && Array.isArray(folderRes.data.records) ? folderRes.data.records : []
            this.folderList = folderRecords
            this.loadFolderCounts(folderRecords)
          } else {
            this.folderList = []
          }
          this.projectListLoading = false
          this.loadAnswerCounts(records)
        })
        .catch(() => {
          if (requestToken !== this.projectRequestToken) return
          this.projectListError = true
          this.projectListLoading = false
        })
    },
    // 文件夹内部问卷数：逐个用 folderId 查询 total；失败或数量过多时保持未知（显示「文件夹」而不是假 0）。
    loadFolderCounts(folders) {
      const list = (folders || []).filter((folder) => folder && folder.id !== null && folder.id !== undefined).slice(0, 12)
      const token = ++this.folderCountToken
      if (!list.length) {
        this.folderCounts = {}
        return
      }
      Promise.all(
        list.map((folder) =>
          pageFormRequest({ current: 1, size: 1, folder: 0, folderId: folder.id })
            .then((res) => [folder.id, res && res.data ? res.data.total : null])
            .catch(() => [folder.id, null])
        )
      ).then((pairs) => {
        if (token !== this.folderCountToken) return
        const counts = {}
        pairs.forEach(([id, total]) => {
          if (total === null || total === undefined) return
          counts[id] = Number(total)
        })
        this.folderCounts = counts
      })
    },
    enterFolder(folder) {
      const id = Number(folder && folder.id)
      if (!Number.isFinite(id) || id <= 0) return
      this.activeFolderName = folderDisplayName(folder)
      this.queryParams.folderId = id
      this.queryParams.current = 1
      this.syncFolderQuery()
      this.queryProjectPage()
    },
    goRoot() {
      if (!this.queryParams.folderId) return
      this.queryParams.folderId = 0
      this.queryParams.current = 1
      this.activeFolderName = ''
      this.syncFolderQuery()
      this.queryProjectPage()
    },
    syncFolderQuery() {
      const query = { ...this.$route.query }
      if (this.queryParams.folderId) {
        query.folderId = String(this.queryParams.folderId)
        query.folderName = this.activeFolderName
      } else {
        delete query.folderId
        delete query.folderName
      }
      const nextFolderId = query.folderId || ''
      const nextFolderName = query.folderName || ''
      if (String(this.$route.query.folderId || '') === nextFolderId && String(this.$route.query.folderName || '') === nextFolderName) return
      this.$router.replace({ path: this.$route.path, query }).catch(() => {})
    },
    handleStatusChange(statusCode) {
      this.queryParams.status = statusCode
      this.queryParams.current = 1
      this.queryProjectPage()
    },
    clearDateFilter() {
      this.queryParams.beginDateTime = null
      this.queryParams.endDateTime = null
      this.queryProjectPage()
    },
    applyDateFilter() {
      this.queryParams.current = 1
      this.queryProjectPage()
    }
  }
}
</script>

<style lang="scss" scoped>
.project-page {
  width: 100%;
  max-width: 1520px;
  min-height: 100%;
  padding: 28px 32px 42px;
  margin: 0 auto;
  color: var(--zy-text);
  font-family: var(--zy-font-family);
}
.form-container { width: 100%; }
.ai-strip {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  margin-bottom: 18px;
  overflow: hidden;
  background:
    radial-gradient(110% 150% at 0% 0%, rgba(56, 189, 248, 0.15), transparent 58%),
    radial-gradient(80% 130% at 100% 0%, rgba(124, 58, 237, 0.16), transparent 62%),
    var(--zy-surface);
  border: 1px solid var(--zy-border);
  border-radius: var(--zy-radius-lg);
  box-shadow: var(--zy-shadow-card);
  &::after {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: '';
    background-image: linear-gradient(var(--zy-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--zy-grid-line) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: radial-gradient(80% 130% at 0% 0%, #000 0%, transparent 74%);
  }
}
.ai-strip-copy { position: relative; z-index: 1; min-width: 0;
  h2 { margin: 8px 0 6px; font-size: 17px; font-weight: 600; }
  p { max-width: 640px; margin: 0; color: var(--zy-text-secondary); font-size: 12px; line-height: 1.75; }
}
.ai-strip-tag {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 3px 10px;
  color: var(--zy-accent-cyan);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 999px;
}
.ai-strip-actions { position: relative; z-index: 1; display: flex; flex-shrink: 0; gap: 10px; align-items: center; }
.header-right :deep(.ai-strip-btn) { height: 38px; padding: 0 18px; color: #fff; background: var(--zy-primary-solid); border-color: var(--zy-primary-solid); box-shadow: var(--zy-ring); }
.header-right :deep(.ai-strip-btn:hover) { background: var(--zy-primary); border-color: var(--zy-primary); }
.ai-strip :deep(.ai-strip-btn) { height: 38px; padding: 0 18px; margin: 0; font-weight: 600; color: #fff; background: var(--zy-primary-solid); border-color: var(--zy-primary-solid); border-radius: var(--zy-radius-sm); box-shadow: var(--zy-ring); }
.ai-strip :deep(.ai-strip-btn:hover) { background: var(--zy-primary); border-color: var(--zy-primary); }
.ai-strip :deep(.ai-strip-btn i) { margin-left: 6px; }
.project-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
}
.page-title { margin: 0 0 5px; font-size: 17px; font-weight: 600; }
.page-subtitle { margin: 0; color: var(--zy-text-secondary); font-size: 12px; line-height: 1.6; }
.header-right { display: flex; flex-shrink: 0; gap: 10px; align-items: center; }
.header-right :deep(.el-button) {
  height: 36px;
  padding: 0 15px;
  margin: 0;
  font-weight: 500;
  border-radius: var(--zy-radius-sm);
}
.ai-create-btn { color: var(--zy-text-regular); background: var(--zy-surface); border-color: var(--zy-border); }
.ai-create-btn:hover { color: var(--zy-primary); background: var(--zy-primary-soft); border-color: #bfdbfe; }
.ai-create-btn i { margin-right: 6px; color: var(--zy-purple); }
.create-btn { color: #fff; background: var(--zy-primary); border-color: var(--zy-primary); }
.create-btn:hover { background: var(--zy-primary-hover); border-color: var(--zy-primary-hover); }
.filter-view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  background: var(--zy-surface);
  border: 1px solid var(--zy-border);
  border-radius: var(--zy-radius-md);
}
.status-filter { display: flex; flex-shrink: 0; gap: 6px; }
.status-filter-item {
  min-height: 32px;
  padding: 0 11px;
  color: var(--zy-text-regular);
  font-size: 12px;
  cursor: pointer;
  background: var(--zy-surface-subtle);
  border: 1px solid var(--zy-border);
  border-radius: var(--zy-radius-sm);
  &:hover { color: var(--zy-text); border-color: #cbd5e1; }
  &.active { color: var(--zy-primary); font-weight: 500; background: var(--zy-primary-soft); border-color: #bfdbfe; }
}
.toolbar-right { display: flex; gap: 10px; align-items: center; min-width: 0; }
.search-input { width: 220px; }
.search-input :deep(.el-input__wrapper) { box-shadow: 0 0 0 1px var(--zy-border) inset; }
.toolbar-right :deep(.el-button) { height: 34px; margin: 0; border-radius: var(--zy-radius-sm); }
.date-btn { color: var(--zy-text-regular); border-color: var(--zy-border); }
.date-btn.active { color: var(--zy-primary); background: var(--zy-primary-soft); border-color: #bfdbfe; }
.view-switch { display: flex; gap: 2px; padding-left: 10px; border-left: 1px solid var(--zy-border); }
.switch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--zy-text-secondary);
  font-size: 13px;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--zy-radius-sm);
  &:hover { color: var(--zy-primary); background: var(--zy-surface-subtle); }
  &.active { color: var(--zy-primary); background: var(--zy-primary-soft); }
}
.content-view { min-height: 240px; margin-top: 16px; }
.folder-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: var(--zy-surface);
  border: 1px solid var(--zy-border);
  border-left: 3px solid var(--zy-primary);
  border-radius: var(--zy-radius-md);
}
.crumb-root {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 4px 8px;
  color: var(--zy-text-regular);
  font-size: 12px;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--zy-radius-sm);
  &:hover { color: var(--zy-primary); background: var(--zy-primary-soft); }
}
.crumb-separator { color: var(--zy-text-placeholder); font-size: 12px; }
.crumb-current {
  overflow: hidden;
  color: var(--zy-text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-word;
}
.crumb-back-btn {
  height: 30px;
  margin: 0 0 0 auto;
  color: var(--zy-text-regular);
  font-size: 12px;
  background: var(--zy-surface-subtle);
  border-color: var(--zy-border);
  border-radius: var(--zy-radius-sm);
}
.crumb-back-btn:hover { color: var(--zy-primary); border-color: var(--zy-primary); }
.folder-chip-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: var(--zy-surface);
  border: 1px solid var(--zy-border);
  border-radius: var(--zy-radius-md);
}
.folder-chip-label { color: var(--zy-text-secondary); font-size: 12px; }
.folder-chip {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  max-width: 100%;
  padding: 6px 10px;
  color: var(--zy-text-regular);
  font-size: 12px;
  cursor: pointer;
  background: var(--zy-surface-subtle);
  border: 1px solid var(--zy-border);
  border-radius: 999px;
  i { color: var(--zy-accent-cyan); }
  &:hover { color: var(--zy-primary); border-color: var(--zy-primary); }
}
.folder-chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.folder-chip-meta { color: var(--zy-text-secondary); font-size: 11px; }
.saved-draft-error { margin-bottom: 12px; }
.saved-draft-card { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px 20px; margin-bottom: 16px; background: var(--zy-surface); border: 1px solid var(--zy-border); border-left: 3px solid var(--zy-purple); border-radius: var(--zy-radius-md); }
.saved-draft-content { min-width: 0; }
.saved-draft-content h3 { margin: 9px 0 5px; font-size: 15px; line-height: 1.5; overflow-wrap: anywhere; }
.saved-draft-content p, .saved-draft-meta { margin: 0; color: var(--zy-text-secondary); font-size: 12px; }
.saved-draft-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.saved-draft-badge { padding: 2px 8px; color: var(--zy-purple); background: var(--zy-surface-subtle); border-radius: 4px; font-weight: 600; }
.saved-draft-card > .el-button { flex-shrink: 0; }
.saved-draft-actions { display: flex; flex-shrink: 0; gap: 8px; }
.saved-draft-actions :deep(.el-button) { margin: 0; }
.project-page-view { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 28px; }
@media (max-width: 1100px) and (min-width: 768px) {
  .project-page { padding: 24px; }
  .filter-view { align-items: flex-start; flex-direction: column; }
  .toolbar-right { width: 100%; }
  .search-input { flex: 1; }
}
@media (max-width: 767px) {
  .project-page { padding: 20px 14px 34px; }
  .project-header { flex-direction: column; gap: 16px; align-items: stretch; }
  .page-title { font-size: 16px; }
  .page-subtitle { font-size: 11px; }
  .header-right { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .header-right :deep(.el-button) { width: 100%; padding: 0 10px; }
  .filter-view { flex-direction: column; gap: 12px; padding: 12px; }
  .status-filter { width: 100%; }
  .status-filter-item { flex: 1; padding: 0 4px; }
  .toolbar-right { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; width: 100%; }
  .search-input { width: 100%; }
  .date-btn { width: 36px; padding: 0; overflow: hidden; font-size: 0; }
  .date-btn :deep(i) { margin: 0; font-size: 14px; }
  .view-switch { gap: 0; padding-left: 7px; }
  .switch-btn { width: 30px; }
  .content-view { margin-top: 12px; }
  .folder-breadcrumb { padding: 8px 10px; gap: 6px; }
  .crumb-back-btn { margin-left: 0; }
  .folder-chip-bar { gap: 6px; padding: 8px 10px; }
  .saved-draft-card { align-items: flex-start; flex-direction: column; padding: 16px; }
  .project-page-view { justify-content: flex-start; overflow-x: auto; }
}
</style>

<style lang="scss">
.date-filter-popover {
  padding: 18px !important;
  border-color: var(--zy-border) !important;
  border-radius: var(--zy-radius-md) !important;
  box-shadow: var(--zy-shadow-popup) !important;
  .panel-title { margin-bottom: 14px; font-size: 14px; font-weight: 600; }
  .date-to { margin: 8px 0; color: var(--zy-text-secondary); font-size: 12px; text-align: center; }
  .panel-actions { display: flex; justify-content: flex-end; margin-top: 16px; }
}
.create-form-dialog {
  overflow: hidden;
  border-radius: var(--zy-radius-lg) !important;
  box-shadow: var(--zy-shadow-popup) !important;
  .el-dialog__header { padding: 22px 24px 14px; margin: 0; border-bottom: 1px solid var(--zy-border-light); }
  .el-dialog__title { color: var(--zy-text); font-size: 17px; font-weight: 600; }
  .el-dialog__body { padding: 20px 24px; }
  .dialog-description { margin: 0 0 20px; color: var(--zy-text-secondary); font-size: 13px; line-height: 1.7; }
  .el-form-item__label { color: var(--zy-text-regular); font-size: 13px; font-weight: 500; }
  .el-input__wrapper, .el-textarea__inner { border-radius: var(--zy-radius-sm); box-shadow: 0 0 0 1px var(--zy-border) inset; }
  .el-dialog__footer { padding: 16px 24px 20px; border-top: 1px solid var(--zy-border-light); }
  .el-button { border-radius: var(--zy-radius-sm); }
}
</style>
