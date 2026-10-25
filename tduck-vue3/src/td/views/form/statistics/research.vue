<template>
  <section class="research-workspace" v-loading="loading" :data-report-id="report?.id">
    <el-alert v-if="error" class="research-error" :title="error" type="error" :closable="false"><el-button text @click="reload">重新加载</el-button></el-alert>
    <div class="research-panel generation-panel">
      <div class="section-heading"><div><h3>从回答走向可核查的发现</h3><p>生成报告快照，逐条核对证据后再审核。</p></div><el-button :disabled="generating" @click="reload">刷新数据与报告</el-button></div>
      <el-radio-group v-model="mode" aria-label="报告生成方式">
        <el-radio-button value="LOCAL">本地相同回答分组</el-radio-button>
        <el-radio-button value="REAL" :disabled="!provider.configured">真实模型归纳</el-radio-button>
      </el-radio-group>
      <p class="research-hint" v-if="mode === 'LOCAL'">同一道题的相同文本合并展示，最多十二组。此模式不做语义理解，不调用模型。</p>
      <template v-else>
        <p class="research-hint">Provider：{{ provider.provider }} · 模型：{{ provider.model }}。仅发送下方入选的题干、原文及临时证据编号，不发送账号、IP或答卷编号。</p>
        <el-checkbox v-model="allowTransfer" class="transfer-consent">我已确认已有受访者数据处理告知与授权，允许将入选回答发送给上述模型分析</el-checkbox>
      </template>
      <p v-if="!provider.configured" class="research-hint">真实模型未配置，本地统计与分组可正常使用。</p>
      <el-button v-if="currentSnapshot" text type="primary" @click="inputVisible = true">查看本次生成输入（{{ currentSnapshot.includedEvidenceCount }}条证据）</el-button>
      <div class="generation-actions"><el-button type="primary" :loading="generating" :disabled="!currentSnapshot?.answerCount || (mode === 'REAL' && !allowTransfer) || loading" @click="generate">生成报告快照</el-button><span>不会修改题目、答卷或发布状态</span></div>
    </div>

    <div v-if="snapshot" class="research-metrics">
      <div><span>版本答卷</span><strong data-testid="report-answer-count">{{ snapshot.answerCount }}</strong><small>V{{ versionNo }} · 后端统计</small></div>
      <div><span>开放回答</span><strong>{{ snapshot.openResponseCount }}</strong><small>核心开放题非空文本条数</small></div>
      <div><span>入选证据</span><strong>{{ snapshot.includedEvidenceCount }}</strong><small>排除 {{ snapshot.excludedEvidenceCount }} 条</small></div>
      <div><span>覆盖答卷</span><strong>{{ snapshot.coveredAnswerCount }}</strong><small>入选证据涉及的不同答卷</small></div>
    </div>
    <div v-if="snapshot" class="coverage-note">{{ report ? '当前展示报告生成时的快照。' : '当前为生成前的数据预览。' }}按答卷编号和题目顺序选取，最多200条、60000字；单条超2000字不入选。数值统计覆盖该版本全量答卷，主题计数仅指列出证据涉及的答卷，不代表总体比例。</div>

    <div class="research-panel report-selector">
      <label>已保存报告</label>
      <el-select v-model="selectedId" aria-label="已保存报告" placeholder="暂无保存报告" :disabled="generating || !history.length" @change="loadReport">
        <el-option v-for="r in history" :key="r.id" :value="r.id" :label="`${date(r.createdAt)} · ${r.mode === 'REAL' ? '模型归纳' : '本地分组'} · ${statusName(r.status)}`" />
      </el-select><span class="research-hint">展示最近30份，可刷新恢复</span>
    </div>
    <el-alert v-if="report?.dataChanged" class="stale-report" title="答卷已变化或无法核对，当前为历史快照。请重新生成后再审核通过。" type="warning" :closable="false" />
    <template v-if="report">
      <div class="research-panel">
        <div class="section-heading"><div><h3>候选归纳与解释 <el-tag :type="report.status === 'APPROVED' ? 'success' : report.status === 'REJECTED' ? 'danger' : 'warning'">{{ statusName(report.status) }}</el-tag></h3><p>{{ report.provider }} · {{ report.model }} · {{ date(report.createdAt) }}</p></div>
          <div class="export-actions"><el-button @click="download('markdown')">导出 Markdown</el-button><el-button @click="download('json')">导出 JSON</el-button></div>
        </div>
        <p class="research-hint">{{ report.mode === 'REAL' ? '模型提出的候选主题及解释，引用存在不等于语义正确，请逐条检查原文。' : '以下为相同回答分组，不是语义主题。' }}审核通过表示发起者完成复核，不表示经过独立研究验证。</p>
        <el-empty v-if="!report.output.themes.length" description="没有入选开放回答，本报告仅包含数值统计" />
        <article v-for="(theme, index) in report.output.themes" :key="index" class="theme-card">
          <div class="theme-heading"><h4>{{ theme.label }}</h4><el-tag size="small" effect="plain">{{ report.mode === 'REAL' ? '模型候选 · 待核实' : '相同文本组' }}</el-tag></div>
          <p>列出证据涉及 <strong>{{ theme.supportAnswerCount }}</strong> 份不同答卷</p>
          <div class="evidence-links"><el-button v-for="id in theme.evidenceIds" :key="id" size="small" plain @click="showEvidence(id)">查看证据 {{ id }}</el-button></div>
        </article>
        <article v-for="(item, index) in report.output.interpretations" :key="`i-${index}`" class="interpretation-card"><span class="eyebrow">模型解释 · 需人工核实</span><p>{{ item.text }}</p><div class="evidence-links"><el-button v-for="id in item.evidenceIds" :key="id" size="small" text type="primary" @click="showEvidence(id)">{{ id }} 原文</el-button></div></article>
      </div>
      <div class="research-panel review-panel">
        <div class="section-heading"><div><h3>人工审核</h3><p>检查题目、引文、归纳是否相符；说明保存在审核历史中。</p></div><el-button :disabled="generating" @click="openReview">审核此报告</el-button></div>
        <p v-if="report.reviewNote" class="review-note">最近说明：{{ report.reviewNote }}</p>
        <ul v-if="report.reviews.length" class="review-history"><li v-for="r in report.reviews" :key="r.revision">{{ date(r.createdAt) }} · {{ statusName(r.status) }} · {{ r.note }}</li></ul>
        <p v-else class="research-hint">尚无人工审核记录</p>
      </div>
    </template>
    <el-empty v-else-if="!loading" description="尚未选择报告，可先查看证据并生成快照" />

    <div v-if="snapshot" class="research-panel evidence-panel">
      <div class="section-heading"><div><h3>{{ report ? '原文证据快照' : '将用于归纳的证据' }}</h3><p>来自核心开放题；自发性、选项提示影响未经判定。</p></div></div>
      <el-table :data="pageEvidence" row-key="id" size="small" style="width:100%">
        <el-table-column prop="id" label="证据" width="65" />
        <el-table-column prop="question" label="题目" min-width="110" show-overflow-tooltip />
        <el-table-column prop="text" label="回答原文" min-width="140" show-overflow-tooltip />
        <el-table-column label="定位" width="70"><template #default="scope"><el-button text type="primary" @click="showEvidence(scope.row.id)">查看</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-if="snapshot.evidence.length > 10" v-model:current-page="evidencePage" :page-size="10" :total="snapshot.evidence.length" layout="prev,pager,next" small />
    </div>
    <el-dialog v-model="evidenceVisible" title="原文证据定位" width="min(660px, 94vw)" append-to-body>
      <div v-if="activeEvidence" class="evidence-detail"><el-tag>{{ activeEvidence.id }} · 核心开放回答</el-tag><p>问卷 {{ formKey }} / V{{ versionNo }}</p><p>题目 {{ activeEvidence.fieldId }} · 答卷 {{ activeEvidence.answerId }}</p><h4>{{ activeEvidence.question }}</h4><blockquote>{{ activeEvidence.text }}</blockquote><p class="research-hint">{{ activeEvidence.attribution }}。此处原文由后端读取并保存，不由模型编写。</p></div>
    </el-dialog>
    <el-dialog v-model="inputVisible" title="本次生成输入" width="min(720px, 94vw)" append-to-body>
      <p class="research-hint">V{{ versionNo }} · 当前 {{ currentSnapshot?.answerCount }} 份答卷 · 入选 {{ currentSnapshot?.includedEvidenceCount }} 条。真实模型仅接收此处列出的题干、原文与证据编号；统计与账号、IP、答卷编号不发送。</p>
      <div class="input-evidence-list"><article v-for="e in currentSnapshot?.evidence || []" :key="e.id"><strong>{{ e.id }} · {{ e.question }}</strong><p>{{ e.text }}</p></article></div>
    </el-dialog>
    <el-dialog v-model="reviewVisible" title="审核报告" width="min(580px, 94vw)" append-to-body>
      <el-radio-group v-model="reviewStatus"><el-radio value="APPROVED" :disabled="report?.dataChanged">通过</el-radio><el-radio value="REJECTED">驳回</el-radio></el-radio-group>
      <p class="research-hint">审核前请核对数值口径和每条证据。数据变化后只能驳回或重新生成。</p>
      <el-input v-model="reviewNote" aria-label="审核说明" type="textarea" :rows="4" maxlength="1000" show-word-limit placeholder="填写复核依据或需要修正的问题" />
      <template #footer><el-button @click="reviewVisible = false">取消</el-button><el-button type="primary" :loading="reviewing" :disabled="!reviewNote.trim()" @click="saveReview">保存审核</el-button></template>
    </el-dialog>
  </section>
</template>
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { saveAs } from 'file-saver'
import { researchStatus, researchSnapshot, researchReports, researchReport, generateResearch, reviewResearch, exportResearch } from '@/api/project/research'
const props = defineProps({ versionNo: { type: Number, required: true } })
const route = useRoute(), formKey = String(route.query.key)
const loading = ref(false), generating = ref(false), reviewing = ref(false), error = ref(''), mode = ref('LOCAL'), allowTransfer = ref(false)
const provider = ref({}), currentSnapshot = ref(null), report = ref(null), history = ref([]), selectedId = ref(''), evidencePage = ref(1)
const evidenceVisible = ref(false), activeEvidence = ref(null), reviewVisible = ref(false), reviewStatus = ref('APPROVED'), reviewNote = ref('')
const inputVisible = ref(false)
let disposed = false, requestNo = 0
onBeforeUnmount(() => { disposed = true; requestNo++ })
const snapshot = computed(() => report.value?.snapshot || currentSnapshot.value)
const pageEvidence = computed(() => (snapshot.value?.evidence || []).slice((evidencePage.value - 1) * 10, evidencePage.value * 10))
const statusName = status => ({ PENDING: '待审核', APPROVED: '人工审核通过', REJECTED: '已驳回' }[status] || status)
const date = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : ''
const message = e => e?.msg || (e?.code === 'ERR_NETWORK' ? '网络连接失败，已有报告已保留，请恢复连接后重试' : e?.message) || '请求失败，请检查连接后重试'
async function reload() {
  const serial = ++requestNo; loading.value = true; error.value = ''; allowTransfer.value = false
  try {
    const [s, p, h] = await Promise.all([researchSnapshot(formKey, props.versionNo), researchStatus(), researchReports(formKey, props.versionNo)])
    if (disposed || serial !== requestNo) return
    currentSnapshot.value = s.data; provider.value = p.data; history.value = h.data
    const id = history.value.some(r => r.id === selectedId.value) ? selectedId.value : history.value[0]?.id
    if (id) { const r = await researchReport(id); if (disposed || serial !== requestNo) return; report.value = r.data; selectedId.value = id }
    else { report.value = null; selectedId.value = '' }
    evidencePage.value = 1
  } catch (e) { if (!disposed && serial === requestNo) error.value = message(e) }
  finally { if (!disposed && serial === requestNo) loading.value = false }
}
async function loadReport(id) {
  const serial = ++requestNo; loading.value = true; error.value = ''
  try { const r = await researchReport(id); if (!disposed && serial === requestNo) { report.value = r.data; evidencePage.value = 1 } }
  catch (e) { if (!disposed && serial === requestNo) { selectedId.value = report.value?.id || ''; error.value = message(e) } }
  finally { if (!disposed && serial === requestNo) loading.value = false }
}
async function generate() {
  generating.value = true; error.value = ''
  try {
    const r = await generateResearch({ formKey, version: props.versionNo, mode: mode.value, allowModelTransfer: allowTransfer.value, snapshotFingerprint: currentSnapshot.value?.fingerprint })
    if (disposed) return
    report.value = r.data; selectedId.value = r.data.id; evidencePage.value = 1
    const h = await researchReports(formKey, props.versionNo); if (!disposed) history.value = h.data
    ElMessage.success('报告已保存，请核对证据后审核')
  } catch (e) { if (!disposed) error.value = message(e) }
  finally { if (!disposed) { generating.value = false; allowTransfer.value = false } }
}
function showEvidence(id) { activeEvidence.value = snapshot.value?.evidence.find(e => e.id === id); evidenceVisible.value = true }
function openReview() { reviewStatus.value = report.value.dataChanged ? 'REJECTED' : 'APPROVED'; reviewNote.value = ''; reviewVisible.value = true }
async function saveReview() {
  reviewing.value = true
  try {
    const r = await reviewResearch(report.value.id, { status: reviewStatus.value, revision: report.value.revision, note: reviewNote.value })
    if (disposed) return
    report.value = r.data; const item = history.value.find(x => x.id === r.data.id); if (item) Object.assign(item, r.data)
    reviewVisible.value = false; ElMessage.success('审核已保存')
  } catch (e) { if (!disposed) { error.value = message(e); reviewVisible.value = false } }
  finally { if (!disposed) reviewing.value = false }
}
async function download(format) {
  try { const r = await exportResearch(report.value.id, format); saveAs(r.data, `analysis-V${props.versionNo}-${report.value.id}.${format === 'json' ? 'json' : 'md'}`) }
  catch (e) { error.value = message(e) }
}
onMounted(reload)
</script>
<style scoped>
.research-workspace{min-width:0;padding-bottom:24px;color:#1d2939}.research-panel{background:white;border:1px solid #e4e7ec;border-radius:12px;padding:20px;margin-bottom:16px;min-width:0}.section-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}.section-heading h3{margin:0 0 8px;font-size:17px;line-height:1.6}.section-heading p{margin:0;color:#667085;font-size:13px;line-height:1.7}.research-hint,.coverage-note{color:#667085;font-size:12px;line-height:1.8;overflow-wrap:anywhere}.research-error,.stale-report{margin-bottom:16px}.generation-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:16px}.generation-actions span{font-size:12px;color:#667085}.transfer-consent{height:auto;white-space:normal;align-items:flex-start;margin-top:8px}.transfer-consent :deep(.el-checkbox__label){white-space:normal;line-height:1.7}.research-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:12px}.research-metrics>div{background:#fff;border:1px solid #e4e7ec;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px}.research-metrics span{font-size:13px;color:#667085}.research-metrics strong{font-size:28px}.research-metrics small{font-size:11px;color:#667085}.coverage-note{margin-bottom:18px}.report-selector{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.report-selector label{font-size:13px;font-weight:600}.report-selector .el-select{width:390px;max-width:100%}.theme-card{border:1px solid #e4e7ec;border-radius:10px;padding:16px;margin:12px 0;background:#fcfcfd}.theme-heading{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.theme-heading h4{margin:0;line-height:1.6;overflow-wrap:anywhere}.theme-card p{font-size:13px;color:#667085}.evidence-links,.export-actions{display:flex;gap:8px;flex-wrap:wrap}.evidence-links .el-button,.export-actions .el-button{margin-left:0}.interpretation-card{background:#f2f6ff;border-left:3px solid #3370ff;padding:16px;margin-top:14px;font-size:14px;line-height:1.8}.eyebrow{color:#475467;font-size:12px}.review-note,.review-history{font-size:13px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}.review-history{padding-left:18px}.evidence-detail{overflow-wrap:anywhere;line-height:1.8}.evidence-detail blockquote{white-space:pre-wrap;border-left:3px solid #3370ff;margin:16px 0;padding:14px;background:#f5f7fa}.evidence-panel .el-pagination{margin-top:16px}.evidence-panel :deep(.el-table){max-width:100%}
@media(max-width:700px){.research-panel{padding:14px}.research-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.research-metrics>div{padding:12px}.research-metrics strong{font-size:24px}.research-panel :deep(.el-radio-group){display:flex;flex-wrap:wrap}.research-panel :deep(.el-radio-button__inner){font-size:12px;padding:10px}.section-heading{gap:10px}.section-heading h3{font-size:16px}.theme-card{padding:12px}.export-actions{width:100%}.export-actions .el-button{font-size:12px;padding:8px}}
</style>
<style scoped>.input-evidence-list{max-height:55vh;overflow:auto;overflow-wrap:anywhere}.input-evidence-list article{padding:12px 0;border-bottom:1px solid #e4e7ec}.input-evidence-list p{white-space:pre-wrap;line-height:1.7}</style>
