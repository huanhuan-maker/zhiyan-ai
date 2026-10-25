<template>
  <div class="project-card-container">
    <div v-if="projectList.length" class="project-card-grid">
      <article v-for="p in projectList" :key="p.id" class="project-card-item">
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
              <span class="metric-value type-value">{{ getType(p.type).code || '1' }}</span>
              <span class="metric-label">类型编号</span>
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
      </article>
    </div>
    <div v-else class="empty-view">
      <el-empty description="暂无符合条件的问卷">
        <template #description><p>暂无符合条件的问卷</p><span>可调整筛选条件，或创建一份新问卷</span></template>
      </el-empty>
    </div>
  </div>
</template>

<script>
import mixin from './mixin'

export default {
  name: 'FormCardList',
  components: {},
  mixins: [mixin],
  props: {
    projectList: { type: Array, default: () => [] },
    type: { type: String, default: '' }
  },
  data() {
    return { visible: false }
  },
  computed: {
    getFormStatusName() {
      return function (code) {
        const status = this.projectStatusList.find((item) => item.code == code)
        return { statusName: status?.name || '未知状态', color: status?.color || '#7c8798' }
      }
    }
  },
  methods: {
    deleteFrom(key) {
      this.$confirm('移除后，该问卷将不再显示在“我的问卷”中，是否继续？', '移除问卷', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => this.logicDeleteForm(key)).catch(() => {})
    }
  }
}
</script>

<style lang="scss" scoped>
.project-card-container { margin-bottom: 8px; }
.project-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  width: 100%;
}
.project-card-item {
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
.type-value { color: var(--zy-purple); }
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
@media (max-width: 767px) {
  .project-card-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .card-body { padding: 16px; }
  .card-actions { padding: 10px 14px; }
}
</style>

<style lang="scss">
.card-more-menu.el-dropdown-menu {
  .el-dropdown-menu__item { border-radius: var(--zy-radius-sm); }
  .text-warning { color: var(--zy-warning); }
  .text-danger { color: var(--zy-danger); }
}
</style>
