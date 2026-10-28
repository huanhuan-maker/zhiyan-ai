<template>
  <div class="project-card-container">
    <!-- 文件夹行单独渲染成文件夹卡片，不再当普通问卷卡片 -->
    <section v-if="folderItems.length" class="folder-strip" data-testid="folder-strip" aria-label="文件夹列表">
      <article
        v-for="folder in folderItems"
        :key="'folder-' + folder.id"
        v-spotlight
        class="folder-card"
        :class="{ 'is-opening': openingFolderId === folder.id }"
        :data-folder-id="folder.id"
        data-testid="folder-card"
        :data-folder-opening="openingFolderId === folder.id ? 'true' : undefined"
        role="button"
        tabindex="0"
        :aria-label="folderAriaLabel(folder, folderCounts[folder.id])"
        @click="openFolder(folder)"
        @keydown.enter.prevent="openFolder(folder)"
        @keydown.space.prevent="openFolder(folder)"
      >
        <span class="folder-tab" aria-hidden="true" />
        <div class="folder-inner" aria-hidden="true"><span /><span /><span /></div>
        <div class="folder-body">
          <span class="folder-icon" aria-hidden="true"><i class="el-icon-folder" /></span>
          <div class="folder-copy">
            <h3 class="folder-name" :title="folderDisplayName(folder)">{{ folderDisplayName(folder) }}</h3>
            <p class="folder-meta">{{ folderMetaLabel(folderCounts[folder.id]) }}</p>
          </div>
          <span class="folder-open-hint" aria-hidden="true">打开<i class="el-icon-right" /></span>
        </div>
      </article>
    </section>

    <div v-if="surveyItems.length" class="project-card-grid">
      <article
        v-for="(p, index) in surveyItems"
        :key="p.id"
        v-spotlight
        v-reveal="(index % 9) * 45"
        class="project-card-item"
        :data-form-key="p.formKey"
      >
        <div class="card-body">
          <div class="card-topline">
            <span class="form-type-badge" :class="'type-' + p.type">{{ getType(p.type).name || '问卷' }}</span>
            <span class="card-status" :class="'status-' + p.status">{{ getFormStatusName(p.status).statusName }}</span>
          </div>
          <h3 class="card-title" :title="p.textName" @click="toProjectHandle(p, 'editor')">{{ p.textName }}</h3>
          <div class="card-metrics" aria-label="问卷信息">
            <div class="metric-item">
              <span class="metric-value status-value" :class="'status-' + p.status">{{ p.status == 2 ? '收集' : p.status == 3 ? '停止' : '草稿' }}</span>
              <span class="metric-label">状态</span>
            </div>
            <div class="metric-item">
              <span class="metric-value count-value" :class="{ 'count-zero': !p.answerCount }">{{ answerCountLabel(p.answerCount) }}</span>
              <span class="metric-label">收集份数</span>
            </div>
            <div class="metric-item">
              <span class="metric-value time-value">{{ formatDate(p.updateTime || p.createTime) }}</span>
              <span class="metric-label">更新时间</span>
            </div>
          </div>
        </div>
        <div class="card-actions">
          <el-button class="edit-action" @click="toProjectHandle(p, 'editor')"><i class="el-icon-edit" />编辑</el-button>
          <el-button @click="toProjectHandle(p, 'data')"><i class="el-icon-data-analysis" />数据</el-button>
          <el-dropdown trigger="click" placement="bottom-end">
            <button class="more-trigger" aria-label="更多问卷操作"><i class="el-icon-more" /></button>
            <template #dropdown>
              <el-dropdown-menu class="card-more-menu">
                <el-dropdown-item :icon="tdIcon('el-icon-pie-chart')" @click="toProjectHandle(p, 'statistics')">统计分析</el-dropdown-item>
                <el-dropdown-item v-if="p.status == 2" :icon="tdIcon('el-icon-video-pause')" class="text-warning" @click="stopProject(p.formKey)">停止收集</el-dropdown-item>
                <el-dropdown-item v-if="p.status != 2" :icon="tdIcon('el-icon-delete')" class="text-danger" @click="deleteFrom(p.formKey)">删除问卷</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <!-- 按住删除：卡片内浮层，不撑破卡片布局 -->
        <div v-if="holdKey === p.formKey" class="hold-delete-layer" data-testid="hold-delete-panel">
          <div class="hold-delete-copy">
            <p class="hold-delete-title">按住 1 秒删除</p>
            <p class="hold-delete-hint" :id="'hold-delete-hint-' + p.formKey">松手、移开或按 ESC 取消，删除后可在回收站恢复</p>
          </div>
          <div class="hold-delete-actions">
            <button
              ref="holdButton"
              type="button"
              class="hold-delete-button"
              :class="{ 'is-holding': holdingKey === p.formKey }"
              data-hold-duration="1000"
              :aria-label="'按住 1 秒删除问卷：' + (p.textName || '未命名问卷')"
              :aria-describedby="'hold-delete-hint-' + p.formKey"
              @pointerdown.prevent="beginHold(p)"
              @pointerup="cancelHold"
              @pointerleave="cancelHold"
              @pointercancel="cancelHold"
              @keydown.enter.prevent="beginHold(p)"
              @keydown.space.prevent="beginHold(p)"
              @keyup.enter="cancelHold"
              @keyup.space="cancelHold"
            >
              <span class="hold-ring" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="18" height="18">
                  <circle class="hold-ring-track" cx="16" cy="16" r="14" />
                  <circle class="hold-ring-progress" cx="16" cy="16" r="14" />
                </svg>
              </span>
              <span class="hold-delete-label">{{ holdingKey === p.formKey ? '松开即取消' : '按住删除' }}</span>
            </button>
            <button type="button" class="hold-cancel" @click="closeHoldPanel">取消</button>
          </div>
          <p v-if="holdError" class="hold-error" role="alert">{{ holdError }}</p>
        </div>
      </article>
    </div>

    <div v-if="showEmpty" class="empty-view" :class="{ 'is-folder-empty': insideFolder && !filtersActive }" :data-testid="emptyTestId">
      <el-empty :description="emptyTitle">
        <template #image>
          <span class="empty-illustration" aria-hidden="true"><i class="el-icon-folder-opened" /></span>
        </template>
        <template #description>
          <p>{{ emptyTitle }}</p>
          <span>{{ emptyHint }}</span>
        </template>
      </el-empty>
    </div>
  </div>
</template>

<script>
import mixin from './mixin'
import { answerCountLabel } from '@/utils/answerCounts'
import { folderAriaLabel, folderDisplayName, folderMetaLabel, splitFormRecords } from '@/utils/formGroups'

// 按住删除的总时长；进度环动画与计时保持一致。
const HOLD_DELETE_MS = 1000
// 文件夹「打开」动效时长（要求 ≤450ms）。
const FOLDER_OPEN_MS = 380

export default {
  name: 'FormCardList',
  components: {},
  mixins: [mixin],
  props: {
    projectList: { type: Array, default: () => [] },
    // 文件夹行（folder=true）由页面单独请求后传入，与问卷列表分开渲染。
    folders: { type: Array, default: () => [] },
    folderCounts: { type: Object, default: () => ({}) },
    insideFolder: { type: Boolean, default: false },
    folderName: { type: String, default: '' },
    filtersActive: { type: Boolean, default: false },
    type: { type: String, default: '' }
  },
  data() {
    return {
      visible: false,
      openingFolderId: null,
      holdKey: null,
      holdingKey: null,
      holdError: '',
      holdInFlight: false
    }
  },
  computed: {
    getFormStatusName() {
      return function (code) {
        const status = this.projectStatusList.find((item) => item.code == code)
        return { statusName: status?.name || '未知状态', color: status?.color || '#7c8798' }
      }
    },
    // 防御式拆分：即使接口把文件夹行混进问卷列表，也不会被当作问卷卡片渲染。
    folderItems() {
      return splitFormRecords(this.folders).folders
    },
    surveyItems() {
      return splitFormRecords(this.projectList).surveys
    },
    showEmpty() {
      return !this.folderItems.length && !this.surveyItems.length
    },
    emptyTestId() {
      return this.insideFolder && !this.filtersActive ? 'folder-empty' : 'project-empty'
    },
    emptyTitle() {
      if (this.insideFolder && !this.filtersActive) return '这个文件夹还是空的'
      return '暂无符合条件的问卷'
    },
    emptyHint() {
      if (this.insideFolder && !this.filtersActive) {
        return `“${this.folderName || '当前文件夹'}”中还没有问卷，可返回根目录，或用“新建问卷”在此文件夹创建`
      }
      if (this.insideFolder) return '可调整筛选条件，或返回根目录查看其他问卷'
      return '可调整筛选条件，或创建一份新问卷'
    }
  },
  beforeUnmount() {
    if (this.openTimer) clearTimeout(this.openTimer)
    this.clearHoldTimer()
    this.unbindEscape()
  },
  methods: {
    answerCountLabel,
    folderAriaLabel,
    folderDisplayName,
    folderMetaLabel,
    prefersReducedMotion() {
      return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      )
    },
    // 先播打开动效再进入文件夹；reduced-motion 下直接进入。
    openFolder(folder) {
      if (!folder || this.openingFolderId !== null) return
      if (this.prefersReducedMotion()) {
        this.$emit('open-folder', folder)
        return
      }
      this.openingFolderId = folder.id
      this.openTimer = setTimeout(() => {
        this.openTimer = null
        this.openingFolderId = null
        this.$emit('open-folder', folder)
      }, FOLDER_OPEN_MS)
    },
    // 打开按住确认浮层（替代原来的 this.$confirm）。
    deleteFrom(key) {
      const normalized = String(key || '')
      if (!normalized) return
      this.cancelHold()
      this.holdKey = normalized
      this.holdError = ''
      this.bindEscape()
      this.$nextTick(() => {
        const ref = this.$refs.holdButton
        const el = Array.isArray(ref) ? ref[0] : ref
        if (el && typeof el.focus === 'function') el.focus()
      })
    },
    beginHold(record) {
      if (!record || this.holdKey !== record.formKey) return
      if (this.holdInFlight || this.holdingKey === record.formKey) return
      // 不在这里清空 holdError：清空会让浮层高度变化、按钮位移触发 pointerleave，
      // 反而把刚开始的按住取消掉（失败重试时会踩到）。失败提示保留到本次操作结束。
      this.holdingKey = record.formKey
      this.clearHoldTimer()
      this.holdTimer = setTimeout(() => this.finishHold(record), HOLD_DELETE_MS)
    },
    cancelHold() {
      if (this.holdInFlight) return
      this.clearHoldTimer()
      this.holdingKey = null
    },
    finishHold(record) {
      this.clearHoldTimer()
      this.holdingKey = null
      if (this.holdInFlight || !record || this.holdKey !== record.formKey) return
      this.holdInFlight = true
      const task = this.logicDeleteForm(record.formKey)
      Promise.resolve(task)
        .then(() => {
          this.holdInFlight = false
          this.closeHoldPanel()
        })
        .catch(() => {
          this.holdInFlight = false
          // 可见的错误提示留在卡片内，不依赖全局 toast。
          this.holdError = '删除失败，问卷仍在列表中，请重试'
        })
    },
    clearHoldTimer() {
      if (!this.holdTimer) return
      clearTimeout(this.holdTimer)
      this.holdTimer = null
    },
    closeHoldPanel() {
      this.cancelHold()
      this.holdingKey = null
      this.holdKey = null
      this.holdError = ''
      this.unbindEscape()
    },
    bindEscape() {
      if (this.escHandler) return
      this.escHandler = (event) => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        this.closeHoldPanel()
      }
      document.addEventListener('keydown', this.escHandler)
    },
    unbindEscape() {
      if (!this.escHandler) return
      document.removeEventListener('keydown', this.escHandler)
      this.escHandler = null
    }
  }
}
</script>

<style lang="scss" scoped>
.project-card-container { margin-bottom: 8px; }
.folder-strip,
.project-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  width: 100%;
}
.folder-strip {
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.folder-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-top: 9px;
  overflow: hidden;
  cursor: pointer;
  background: linear-gradient(165deg, var(--zy-surface) 0%, var(--zy-surface-subtle) 100%);
  border: 1px solid var(--zy-border);
  border-radius: var(--zy-radius-md);
  transition: transform 0.24s var(--zy-ease-out, ease-out), border-color 0.18s ease, box-shadow 0.24s var(--zy-ease-out, ease-out);
  &:hover {
    border-color: var(--zy-primary);
    box-shadow: var(--zy-shadow-card-hover);
    transform: translateY(-2px);
  }
  &.is-opening {
    border-color: var(--zy-primary);
    box-shadow: var(--zy-ring);
    transform: translateY(-3px);
  }
}
/* 文件夹造型：顶部页签 */
.folder-tab {
  position: absolute;
  top: 0;
  left: 14px;
  width: 42%;
  height: 9px;
  background: linear-gradient(90deg, var(--zy-primary) 0%, var(--zy-accent-cyan) 100%);
  border-radius: 8px 8px 0 0;
  opacity: 0.85;
  transform-origin: right bottom;
  transition: transform 0.3s var(--zy-ease-spring, ease-out);
}
.folder-card.is-opening .folder-tab {
  transform: rotate(-10deg) translateY(-2px);
}
/* 内部问卷卡片滑出 */
.folder-inner {
  position: absolute;
  top: 5px;
  right: 14px;
  left: 46%;
  display: flex;
  flex-direction: column;
  gap: 3px;
  pointer-events: none;
  opacity: 0;
  transform: translateY(10px) scaleX(0.9);
  transition: opacity 0.26s ease, transform 0.3s var(--zy-ease-spring, ease-out);
}
.folder-inner span {
  height: 4px;
  background: var(--zy-border);
  border-radius: 3px;
  transition: background-color 0.26s ease;
}
.folder-inner span:nth-child(2) { margin-left: 10px; }
.folder-inner span:nth-child(3) { margin-right: 12px; }
.folder-card.is-opening .folder-inner {
  opacity: 0.9;
  transform: translateY(-4px) scaleX(1);
}
.folder-card.is-opening .folder-inner span { background: var(--zy-primary); }
.folder-body {
  display: flex;
  gap: 11px;
  align-items: center;
  padding: 9px 14px 14px;
}
.folder-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--zy-accent-cyan);
  font-size: 18px;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: var(--zy-radius-sm);
}
.folder-copy { flex: 1; min-width: 0; }
.folder-name {
  display: -webkit-box;
  margin: 0 0 3px;
  overflow: hidden;
  color: var(--zy-text);
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.45;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.folder-meta { margin: 0; color: var(--zy-text-secondary); font-size: 11.5px; }
.folder-open-hint {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 3px;
  align-items: center;
  color: var(--zy-primary);
  font-size: 11px;
  opacity: 0.78;
  i { transition: transform 0.2s ease; }
}
.folder-card:hover .folder-open-hint,
.folder-card.is-opening .folder-open-hint { opacity: 1; }
.folder-card:hover .folder-open-hint i { transform: translateX(3px); }
.project-card-item {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--zy-surface);
  border: 1px solid var(--zy-border);
  border-radius: var(--zy-radius-md);
  transition: border-color 0.15s ease;
  &:hover { border-color: #cbd5e1; }
}
.card-body { flex: 1; padding: 18px 18px 16px; }
.card-topline { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.form-type-badge {
  padding: 3px 8px;
  color: var(--zy-primary);
  font-size: 11px;
  background: var(--zy-primary-soft);
  border-radius: var(--zy-radius-sm);
  &.type-2 { color: var(--zy-warning); background: #fff7ed; }
  &.type-4 { color: var(--zy-success); background: #f0fdf4; }
  &.type-3 { color: var(--zy-text-secondary); background: var(--zy-surface-subtle); }
}
.card-status {
  color: var(--zy-text-secondary);
  font-size: 12px;
  white-space: nowrap;
  &.status-2 { color: var(--zy-success); }
  &.status-3 { color: var(--zy-text-secondary); }
}
.card-title {
  min-height: 46px;
  margin: 14px 0 15px;
  overflow: hidden;
  color: var(--zy-text);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.55;
  word-break: break-word;
  cursor: pointer;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  &:hover { color: var(--zy-primary); }
}
.card-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr;
  padding-top: 14px;
  border-top: 1px solid var(--zy-border-light);
}
.metric-item { min-width: 0; }
.metric-value {
  display: block;
  margin-bottom: 3px;
  overflow: hidden;
  font-family: var(--zy-font-number);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  &.status-1 { color: var(--zy-warning); }
  &.status-2 { color: var(--zy-success); }
  &.status-3 { color: var(--zy-danger); }
}
.count-value { color: var(--zy-accent-cyan); }
.time-value { color: var(--zy-text-regular); font-size: 12px; }
.metric-label { color: var(--zy-text-secondary); font-size: 11px; }
.card-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 11px 16px;
  background: var(--zy-surface-subtle);
  border-top: 1px solid var(--zy-border-light);
  :deep(.el-button) {
    height: 30px;
    padding: 0 10px;
    margin: 0;
    color: var(--zy-text-regular);
    font-size: 12px;
    background: var(--zy-surface);
    border-color: var(--zy-border);
    border-radius: var(--zy-radius-sm);
    &:hover { color: var(--zy-primary); border-color: #bfdbfe; }
    i { margin-right: 5px; }
  }
  .edit-action { color: var(--zy-primary); }
}
.more-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin-left: auto;
  color: var(--zy-text-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--zy-radius-sm);
  &:hover { color: var(--zy-primary); background: var(--zy-primary-soft); }
}
/* 按住删除浮层 */
.hold-delete-layer {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  justify-content: center;
  padding: 16px;
  background: rgba(9, 16, 27, 0.96);
  backdrop-filter: blur(1.5px);
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px var(--zy-danger);
}
.hold-delete-copy { min-width: 0; }
.hold-delete-title { margin: 0 0 2px; color: var(--zy-text); font-size: 12.5px; font-weight: 600; }
.hold-delete-hint { margin: 0; color: var(--zy-text-secondary); font-size: 11px; line-height: 1.5; }
.hold-delete-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.hold-delete-button {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  color: var(--zy-danger);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: rgba(231, 138, 149, 0.12);
  border: 1px solid var(--zy-danger);
  border-radius: 999px;
  transition: background-color 0.16s ease, color 0.16s ease;
  &:hover { background: rgba(231, 138, 149, 0.2); }
  &.is-holding {
    color: var(--zy-text);
    background: rgba(231, 138, 149, 0.26);
  }
}
.hold-ring { display: inline-flex; width: 18px; height: 18px; }
.hold-ring svg { width: 18px; height: 18px; transform: rotate(-90deg); }
.hold-ring-track { fill: none; stroke: var(--zy-border); stroke-width: 3; }
.hold-ring-progress {
  fill: none;
  stroke: var(--zy-danger);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 88;
  stroke-dashoffset: 88;
}
.hold-delete-button.is-holding .hold-ring-progress { animation: zy-hold-fill 1000ms linear forwards; }
.hold-cancel {
  height: 32px;
  padding: 0 10px;
  color: var(--zy-text-regular);
  font-size: 12px;
  cursor: pointer;
  background: var(--zy-surface-subtle);
  border: 1px solid var(--zy-border);
  border-radius: var(--zy-radius-sm);
  &:hover { color: var(--zy-text); border-color: var(--zy-text-placeholder); }
}
.hold-error { flex-basis: 100%; margin: 0; color: var(--zy-danger); font-size: 11px; line-height: 1.5; }
@keyframes zy-hold-fill {
  from { stroke-dashoffset: 88; }
  to { stroke-dashoffset: 0; }
}
.empty-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  background: var(--zy-surface);
  border: 1px dashed var(--zy-border);
  border-radius: var(--zy-radius-md);
  :deep(.el-empty__description) {
    p { margin-bottom: 6px; color: var(--zy-text-regular); font-size: 14px; }
    span { color: var(--zy-text-secondary); font-size: 12px; }
  }
}
.empty-view.is-folder-empty {
  background: var(--zy-surface-subtle);
  border-color: var(--zy-border);
}
.empty-illustration {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  color: var(--zy-accent-cyan);
  font-size: 38px;
  background: var(--zy-primary-soft);
  border: 1px dashed var(--zy-border);
  border-radius: 50%;
}
@media (max-width: 767px) {
  .project-card-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .folder-strip { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .card-body { padding: 16px; }
  .card-actions { padding: 10px 14px; }
  .hold-delete-layer { right: 6px; bottom: 6px; left: 6px; padding: 9px 10px; }
}
/* reduced-motion：跳过打开动效与进度环动画，但按住 1 秒仍然删除 */
@media (prefers-reduced-motion: reduce) {
  .folder-card,
  .folder-tab,
  .folder-inner,
  .folder-inner span,
  .folder-open-hint i { transition: none !important; }
  .folder-card:hover,
  .folder-card.is-opening { transform: none; }
  .folder-card.is-opening .folder-tab { transform: none; }
  .folder-card.is-opening .folder-inner { opacity: 0.9; transform: none; }
  .hold-delete-button.is-holding .hold-ring-progress { animation: none; stroke-dashoffset: 0; }
}
</style>

<style lang="scss">
.card-more-menu.el-dropdown-menu {
  .el-dropdown-menu__item { border-radius: var(--zy-radius-sm); }
  .text-warning { color: var(--zy-warning); }
  .text-danger { color: var(--zy-danger); }
}
</style>
