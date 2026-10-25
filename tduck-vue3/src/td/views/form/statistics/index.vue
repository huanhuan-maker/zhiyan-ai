<template>
  <div class="statistics-workspace">
    <header class="statistics-heading">
      <div><h2>统计与分析</h2><p>查看真实回收结果，沿原文核查归纳与解释。</p></div>
      <el-button :loading="loading" @click="loadVersions">刷新版本</el-button>
    </header>
    <el-alert v-if="error" :title="error" type="error" :closable="false"><el-button text @click="loadVersions">重试</el-button></el-alert>
    <div v-if="activeName !== 'collection' && versions.length" class="statistics-version">
      <label for="statistics-version-input">发布版本</label>
      <el-select id="statistics-version-input" v-model="version" aria-label="统计发布版本">
        <el-option v-for="v in versions" :key="v.versionNo" :value="v.versionNo" :label="`V${v.versionNo} · ${v.status === 1 ? '收集中' : '已停止'} · ${v.answerCount}份答卷`" />
      </el-select>
      <span>题目、答卷、统计与报告按同一版本关联</span>
    </div>
    <el-tabs v-model="activeName" class="statistics-content">
      <el-tab-pane label="题目统计" name="analysis" lazy>
        <analysis v-if="version" :key="`a-${$route.query.key}-${version}-${refreshKey}`" :version-no="version" />
        <el-empty v-else-if="!loading && !error" description="发布问卷并收集答卷后，可按版本查看统计" />
      </el-tab-pane>
      <el-tab-pane label="主题与报告" name="research" lazy>
        <research v-if="version" :key="`r-${$route.query.key}-${version}-${refreshKey}`" :version-no="version" />
        <el-empty v-else-if="!loading && !error" description="请先发布问卷，报告将绑定发布版本" />
      </el-tab-pane>
      <el-tab-pane label="访问与收集概览" name="collection" lazy>
        <el-alert title="此处保留历史概览：回收量按最新发布版本；访问、趋势、设备与来源为问卷全版本口径，不用于所选版本的报告。" type="info" :closable="false" />
        <chart />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
<script>
import analysis from './analysis.vue'
import chart from './chart.vue'
import research from './research.vue'
import { listFormVersionsRequest } from '@/api/project/publish'
export default {
  name: 'ProjectStatistics', components: { analysis, chart, research },
  data: () => ({ activeName: 'analysis', versions: [], version: null, loading: false, error: '', refreshKey: 0 }),
  watch: { '$route.query.key': 'loadVersions' },
  mounted() { this.loadVersions() },
  methods: {
    async loadVersions() {
      const key = this.$route.query.key
      this.loading = true; this.error = ''
      try {
        const res = await listFormVersionsRequest(key)
        if (this.$route.query.key !== key) return
        this.versions = res.data || []
        if (!this.versions.some(v => v.versionNo === this.version)) this.version = this.versions[0]?.versionNo ?? null
        this.refreshKey++
      } catch { this.error = '发布版本加载失败，请重试' }
      finally { this.loading = false }
    }
  }
}
</script>
<style scoped>
.statistics-workspace{height:100%;min-width:0;display:flex;flex-direction:column;padding:24px;box-sizing:border-box;overflow:auto;background:#f5f7fa;color:#1d2939}
.statistics-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.statistics-heading h2{font-size:23px;margin:0 0 8px}.statistics-heading p{margin:0;color:#667085;font-size:13px}
.statistics-version{display:flex;align-items:center;flex-wrap:wrap;gap:12px;background:white;border:1px solid #e4e7ec;border-radius:12px;padding:16px}.statistics-version .el-select{width:270px;max-width:100%}.statistics-version span{font-size:12px;color:#667085}
.statistics-content{margin-top:12px;min-height:0;flex:1;overflow:visible}.statistics-content :deep(.el-tabs__content){overflow:visible}.statistics-content :deep(.el-tabs__nav-wrap){background:white;padding:0 12px;border-radius:8px}
@media(max-width:600px){.statistics-workspace{padding:12px}.statistics-heading{align-items:flex-start}.statistics-heading h2{font-size:20px}.statistics-version{padding:12px;gap:8px}.statistics-version .el-select{width:100%}.statistics-heading p{line-height:1.6}.statistics-content :deep(.el-tabs__item){padding:0 10px;font-size:13px}}
</style>
