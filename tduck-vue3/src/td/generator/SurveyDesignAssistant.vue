<template>
  <el-button :disabled="disabled || !questions.length || working" @click="openReview">问卷体检</el-button>
  <el-dialog v-model="optimizeVisible" title="AI 单题优化" width="min(920px, 96vw)" class="design-assistant-dialog" :close-on-click-modal="false" append-to-body>
    <div class="design-dialog-content">
      <p class="design-muted">第 {{ index + 1 }} 题 · 保留题型、必填和评分范围，采用后仍需保存草稿。</p>
      <div class="design-presets"><el-button v-for="p in presets" :key="p" size="small" :disabled="working" @click="instruction=p">{{ p }}</el-button></div>
      <el-input v-model="instruction" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="告诉 AI 希望怎样修改这道题" :disabled="working" aria-label="优化要求" />
      <el-button class="design-run" type="primary" :loading="working" :disabled="disabled || locked" @click="optimize">{{ working ? '正在优化' : candidate ? '重新优化' : '生成优化建议' }}</el-button>
      <el-alert v-if="error" :title="error" type="warning" :closable="false" />
      <template v-if="candidate">
        <p class="design-muted" data-testid="optimization-model">{{ identity(candidate) }}</p>
        <el-alert v-if="stale" title="题目或调查需求已变化，请重新优化后再采用。" type="warning" :closable="false" />
        <el-alert v-if="candidate.message" :title="candidate.message" type="warning" :closable="false" />
        <div class="design-comparison">
          <section v-for="side in ['before','after']" :key="side" :class="side" :data-testid="`optimization-${side}`">
            <span class="design-kicker">{{ side === 'before' ? '原题' : '优化候选' }}</span>
            <template v-if="candidate[side]"><h3>{{ candidate[side].label }}</h3><ol v-if="candidate[side].options"><li v-for="(o,n) in candidate[side].options" :key="n">{{ o }}</li></ol><p v-if="candidate[side].rateMax">1–{{ candidate[side].rateMax }} 分</p><p v-if="candidate[side].placeholder">{{ candidate[side].placeholder }}</p></template>
            <p v-else class="design-muted">当前没有有效候选，可重试或继续手动编辑。</p>
          </section>
        </div>
        <div v-if="candidate.reasons?.length" class="design-notes"><strong>调整理由</strong><ul><li v-for="(r,n) in candidate.reasons" :key="n">{{ r }}</li></ul></div>
        <el-alert v-for="(w,n) in [...(candidate.warnings || []), ...(candidate.optionNotice ? [candidate.optionNotice] : [])]" :key="n" :title="w" type="warning" :closable="false" />
      </template>
    </div>
    <template #footer><el-button @click="optimizeVisible=false">取消</el-button><el-button type="primary" :disabled="working || disabled || locked || stale || !candidate?.available" @click="adopt">采用修改</el-button></template>
  </el-dialog>
  <el-dialog v-model="reviewVisible" title="问卷体检" width="min(920px, 96vw)" class="design-assistant-dialog" :close-on-click-modal="false" append-to-body>
    <div class="design-dialog-content">
      <div class="design-review-intro"><div><span class="design-kicker">DESIGN REVIEW</span><h3>逐题发现问题，保留你的判断</h3><p class="design-muted">检查措辞、重复题、选项和题目含义。建议需要结合实际研究目的审核。</p></div><el-button type="primary" :loading="working" :disabled="disabled || !questions.length" @click="review">{{ report ? '重新体检' : '开始体检' }}</el-button></div>
      <el-alert v-if="error" :title="error" type="warning" :closable="false" />
      <template v-if="report">
        <p class="design-muted" data-testid="review-model">{{ identity(report) }} · {{ report.questionCount }} 题 · {{ new Date(report.asOf).toLocaleString() }}</p>
        <el-alert v-if="reportStale" title="问卷内容已变化，这份报告对应修改前内容，请重新体检。" type="warning" :closable="false" />
        <el-alert v-if="report.warning" :title="report.warning" type="warning" :closable="false" />
        <p class="design-summary">{{ report.summary }}</p>
        <p class="design-muted">发现 {{ report.issues.length }} 项待核对建议；检查结果不代表问卷科学有效性已获证明。</p>
        <el-empty v-if="!report.issues.length" description="未发现明确问题，请继续人工审核研究目标和题目内容" />
        <article v-for="(issue,n) in report.issues" :key="n" class="design-issue" data-testid="review-issue">
          <div class="design-issue-tags"><span class="design-category" :class="issue.severity">{{ categories[issue.category] || '设计建议' }}</span><span>第 {{ issue.questionNos.join('、') }} 题</span><span class="design-muted">{{ issue.origin==='AI'?'AI 审阅':'规则检查' }}</span></div>
          <h3>{{ issue.problem }}</h3><p>{{ issue.suggestion }}</p>
          <blockquote v-for="(e,k) in issue.evidence" :key="k">第 {{ e.questionNo }} 题 · {{ e.field==='options'?'选项':'题干' }}：{{ e.quote }}</blockquote>
          <div class="design-issue-actions" v-for="no in issue.questionNos" :key="no"><el-button size="small" :disabled="reportStale" @click="locate(no-1)">定位第 {{ no }} 题</el-button><el-button size="small" type="primary" plain :disabled="reportStale || locked || disabled || !supported(no-1)" @click="fromIssue(no-1,issue.suggestion)">优化第 {{ no }} 题</el-button></div>
        </article>
      </template>
    </div>
    <template #footer><el-button @click="reviewVisible=false">关闭</el-button></template>
  </el-dialog>
</template>
<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { optimizeQuestionRequest, reviewSurveyRequest } from '@/api/project/ai'
import { designSnapshot, designTypes } from './design-assistant'
const props=defineProps({ questions:{type:Array,default:()=>[]}, title:{type:String,default:''}, goal:{type:String,default:''}, audience:{type:String,default:''}, formKey:String, revision:String, locked:Boolean, disabled:Boolean })
const emit=defineEmits(['apply','locate'])
const optimizeVisible=ref(false),reviewVisible=ref(false),working=ref(false),index=ref(0),instruction=ref('措辞更中立，保持原题研究含义'),candidate=ref(null),report=ref(null),error=ref(''),candidateSource=ref(''),reportSource=ref('')
const presets=['措辞更中立','选项更全面且互斥','语言更适合目标人群']
const categories={LEADING:'诱导措辞',DOUBLE_BARRELED:'一题多问',DUPLICATE:'重复内容',OPTION_OVERLAP:'区间重叠',OPTION_MISMATCH:'题干选项不匹配',MISSING_OPTION:'选项覆盖',UNCLEAR:'含义不清',LENGTH:'表达长度',OTHER:'设计建议'}
const payload=()=>({title:props.title,goal:props.goal,audience:props.audience,...(props.formKey?{formKey:props.formKey}:{}),questions:props.questions})
const snapshot=()=>designSnapshot({input:payload(),revision:props.revision})
const stale=computed(()=>Boolean(candidate.value)&&candidateSource.value!==snapshot())
const reportStale=computed(()=>Boolean(report.value)&&reportSource.value!==snapshot())
const supported=i=>designTypes.includes(props.questions[i]?.type)
const identity=r=>`${r.mode==='REAL'?'真实 AI':r.mode==='DEGRADED'?'降级结果':'本地检查'} · ${r.provider || ''}${r.model ? ' · '+r.model : ''}`
let disposed=false
onBeforeUnmount(()=>{disposed=true})
function openOptimize(i,request='措辞更中立，保持原题研究含义'){
  if(working.value||props.disabled||props.locked||!supported(i))return
  index.value=i;instruction.value=request;candidate.value=null;error.value='';optimizeVisible.value=true
}
function openReview(){if(working.value||props.disabled||!props.questions.length)return;error.value='';reviewVisible.value=true}
async function optimize(){
  if(working.value||props.disabled||props.locked)return
  working.value=true;error.value='';candidate.value=null;const source=snapshot(),input=JSON.parse(designSnapshot(payload()))
  try{const r=await optimizeQuestionRequest({...input,questionNo:index.value+1,instruction:instruction.value});if(!disposed){candidate.value=r.data;candidateSource.value=source}}catch{if(!disposed)error.value='优化暂未完成，原题保持不变。请重试或继续手动编辑。'}finally{if(!disposed)working.value=false}
}
async function review(){
  if(working.value||props.disabled)return
  working.value=true;error.value='';const source=snapshot()
  try{const r=await reviewSurveyRequest(JSON.parse(designSnapshot(payload())));if(!disposed){report.value=r.data;reportSource.value=source}}catch{if(!disposed)error.value='体检暂未完成，普通编辑不受影响。请稍后重试。'}finally{if(!disposed)working.value=false}
}
function adopt(){
  if(working.value||props.disabled||props.locked||stale.value||!candidate.value?.available)return
  emit('apply',{index:index.value,question:JSON.parse(JSON.stringify(candidate.value.after))});optimizeVisible.value=false;candidate.value=null
  ElMessage.success('已采用当前题的优化，请保存草稿')
}
function locate(i){if(reportStale.value)return;reviewVisible.value=false;emit('locate',i)}
function fromIssue(i,suggestion){if(reportStale.value||working.value)return;reviewVisible.value=false;openOptimize(i,suggestion.slice(0,500))}
defineExpose({openOptimize,openReview})
</script>
<style>
.design-assistant-dialog.el-dialog{border-radius:14px;background:var(--zy-surface);color:var(--zy-text);max-height:94dvh;margin-top:3dvh}
.design-assistant-dialog.el-dialog .el-dialog__header{padding:22px 24px 14px;border-bottom:1px solid var(--zy-border)}
.design-assistant-dialog.el-dialog .el-dialog__body{padding:20px 24px;max-height:calc(94dvh - 145px);overflow:auto;overflow-x:hidden;color:var(--zy-text)}
.design-assistant-dialog.el-dialog .el-dialog__footer{padding:14px 24px;border-top:1px solid var(--zy-border)}
.design-assistant-dialog.el-dialog .el-dialog__header,.design-assistant-dialog.el-dialog .el-dialog__footer{background:var(--zy-surface);color:var(--zy-text)}
.design-assistant-dialog.el-dialog .el-dialog__header .el-dialog__title{color:var(--zy-text)}
.design-assistant-dialog.el-dialog .el-textarea__inner{background:var(--zy-surface-subtle);color:var(--zy-text);box-shadow:0 0 0 1px var(--zy-border) inset}
.design-assistant-dialog.el-dialog .el-button:not(.el-button--primary){color:var(--zy-text-regular);background:var(--zy-surface-subtle);border-color:var(--zy-border)}
.design-assistant-dialog .design-issue-tags .design-category{display:inline-block;flex:none;width:auto;min-width:48px;height:auto;padding:2px 8px;line-height:20px;font-size:12px;white-space:nowrap;border:1px solid var(--zy-border);border-radius:5px;color:var(--zy-text-regular);background:var(--zy-surface-subtle)}
.design-assistant-dialog .design-issue-tags .design-category.warning{color:#925400;background:#fff7e6;border-color:#f3d59a}
.zy-dark .design-assistant-dialog .design-issue-tags .design-category.warning{color:#f3c888;background:#342d25;border-color:#5a4934}
.zy-dark .design-assistant-dialog .el-alert--warning.is-light{background:#342d25;color:#f3c888;border:1px solid #5a4934}
.design-dialog-content{line-height:1.7;word-break:break-word}
.design-muted{color:var(--zy-text-secondary);font-size:12px}.design-kicker{font-size:11px;color:var(--zy-purple);font-weight:600;letter-spacing:1px}
.design-presets{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.design-presets .el-button{margin:0}.design-run{margin:14px 0}
.design-comparison{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}.design-comparison section{min-width:0;padding:18px;background:var(--zy-surface-subtle);border:1px solid var(--zy-border);border-radius:10px}.design-comparison .after{border-color:var(--zy-primary)}
.design-comparison h3,.design-issue h3{font-size:15px;line-height:1.8;margin:10px 0}.design-comparison ol{padding-left:22px;font-size:13px}.design-notes{font-size:13px}.design-dialog-content .el-alert{margin:12px 0}
.design-review-intro{display:flex;gap:18px;align-items:center;justify-content:space-between}.design-review-intro h3{margin:5px 0;font-size:20px}.design-review-intro p{margin:5px 0}.design-summary{padding:14px 18px;background:var(--zy-surface-subtle);border-radius:8px;font-size:14px}
.design-issue{padding:20px;margin:14px 0;border:1px solid var(--zy-border);border-radius:10px}.design-issue-tags{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12px}.design-issue p{font-size:13px}.design-issue blockquote{margin:8px 0;padding:8px 14px;border-left:3px solid var(--zy-purple);background:var(--zy-surface-subtle);font-size:12px;color:var(--zy-text-secondary)}.design-issue-actions{display:inline-flex;flex-wrap:wrap;gap:8px;margin:8px 12px 0 0}.design-issue-actions .el-button{margin:0}
@media(max-width:767px){.design-comparison{grid-template-columns:1fr}.design-review-intro{align-items:flex-start;flex-direction:column}.design-assistant-dialog.el-dialog .el-dialog__body{padding:16px}.design-issue{padding:14px}}
</style>
