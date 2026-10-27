<template>
  <div class="app-container project-page">
    <div class="form-container">
      <div class="project-header">
        <div class="header-left">
          <h2 class="page-title">问卷概览</h2>
          <p class="page-subtitle">共 {{ total || 0 }} 份问卷<span v-if="savedDraft">，另有 1 份 AI 暂存</span></p>
        </div>
        <div class="header-right">
          <el-button class="ai-create-btn" aria-label="AI 建卷" @click="$router.push('/project/form/ai-draft')">
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
        <el-alert v-if="savedDraftError" class="saved-draft-error" type="warning" :closable="false" title="AI 暂存暂时无法读取，问卷列表仍可使用">
          <el-button size="small" @click="loadSavedDraft">重试</el-button>
        </el-alert>
        <article v-if="visibleSavedDraft" class="saved-draft-card" data-testid="saved-ai-draft">
          <div class="saved-draft-content">
            <div class="saved-draft-meta"><span class="saved-draft-badge">AI 暂存</span><span>未发布 · {{ savedDraftQuestionCount }} 题</span></div>
            <h3>{{ savedDraftTitle }}</h3>
            <p>上次暂存：{{ savedDraftTime }}</p>
          </div>
          <el-button type="primary" @click="$router.push({ path: '/project/form/ai-draft', query: { saved: '1' } })">继续编辑</el-button>
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
          v-if="dataShowType == 'card' && (projectList.length || !visibleSavedDraft)"
          v-loading="projectListLoading"
          v-model:project-list="projectList"
          @refresh="queryProjectPage"
        />
        <my-form-table
          v-if="dataShowType == 'table' && (projectList.length || !visibleSavedDraft)"
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
import { createFormRequest, pageFormRequest, updateFormRequest } from '@/api/project/form'
import { getAiDraftWorkspaceRequest } from '@/api/project/ai'
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
      projectListLoading: true,
      projectListError: false,
      savedDraft: null,
      savedDraftError: false,
      pageCurrent: '',
      requestLoading: { pushFormData: false, pushFolderData: false }
    }
  },
  computed: {
    paginationLayout() {
      return this.isMobile ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
    },
    savedDraftTitle() { return this.savedDraft?.snapshot?.result?.title || 'AI 建卷暂存' },
    savedDraftQuestionCount() { return this.savedDraft?.snapshot?.result?.questions?.length || 0 },
    savedDraftTime() { return this.savedDraft?.updatedAt ? dayjs(this.savedDraft.updatedAt).format('YYYY/MM/DD HH:mm') : '时间未知' },
    visibleSavedDraft() {
      if (!this.savedDraft || (this.queryParams.status && Number(this.queryParams.status) !== 1)) return false
      const name = (this.queryParams.name || '').trim().toLowerCase()
      if (name && !this.savedDraftTitle.toLowerCase().includes(name)) return false
      const time = dayjs(this.savedDraft.updatedAt).valueOf()
      if (this.queryParams.beginDateTime && time < dayjs(this.queryParams.beginDateTime).valueOf()) return false
      if (this.queryParams.endDateTime && time > dayjs(this.queryParams.endDateTime).valueOf()) return false
      return true
    }
  },
  created() {
    this.isMobile = window.innerWidth < 768
    this.queryParams.current = 1
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
    async loadSavedDraft() {
      try {
        const res = await getAiDraftWorkspaceRequest()
        this.savedDraft = res.data?.snapshot ? res.data : null
        this.savedDraftError = false
      } catch (e) { this.savedDraftError = true }
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
      pageFormRequest(this.queryParams).then((res) => {
        let { records, total, size } = res.data
        this.projectList = records
        this.total = total
        this.queryParams.size = size
        this.projectListLoading = false
      }).catch(() => {
        this.projectListError = true
        this.projectListLoading = false
      })
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
.saved-draft-error { margin-bottom: 12px; }
.saved-draft-card { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px 20px; margin-bottom: 16px; background: var(--zy-surface); border: 1px solid var(--zy-border); border-left: 3px solid var(--zy-purple); border-radius: var(--zy-radius-md); }
.saved-draft-content { min-width: 0; }
.saved-draft-content h3 { margin: 9px 0 5px; font-size: 15px; line-height: 1.5; overflow-wrap: anywhere; }
.saved-draft-content p, .saved-draft-meta { margin: 0; color: var(--zy-text-secondary); font-size: 12px; }
.saved-draft-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.saved-draft-badge { padding: 2px 8px; color: var(--zy-purple); background: var(--zy-surface-subtle); border-radius: 4px; font-weight: 600; }
.saved-draft-card > .el-button { flex-shrink: 0; }
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
