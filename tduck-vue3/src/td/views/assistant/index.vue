<template>
  <section class="assistant-page">
    <header class="assistant-heading"><div><h2>问卷查询对话</h2><p>查找问卷、读取统计、定位原文，答案保留来源。</p></div><el-tag :type="connected ? 'success' : 'info'" data-testid="assistant-mcp-status">{{ connected ? '只读工具已连接' : '工具未连接' }}</el-tag></header>
    <el-alert v-if="error" class="assistant-error" :title="error" type="error" :closable="false"><el-button text @click="recover">刷新连接与历史</el-button></el-alert>
    <div class="assistant-controls">
      <div class="scope-row">
        <el-select v-model="conversationId" aria-label="助手对话" placeholder="新对话" :disabled="busy" @change="changeConversation"><el-option v-for="c in conversations" :key="c.id" :value="c.id" :label="c.title" /></el-select>
        <el-button :disabled="busy || !connected" @click="newConversation">新对话</el-button>
        <el-select v-model="formKey" clearable filterable remote :remote-method="searchSurveys" :loading="searching" :disabled="busy || !connected" aria-label="查询问卷" placeholder="搜索或选择自己的问卷" @change="scopeChanged"><el-option v-for="s in surveys" :key="s.formKey" :value="s.formKey" :label="s.title" /></el-select>
        <el-select v-model="version" aria-label="查询版本" :disabled="busy || !formKey"><el-option :value="0" label="最新发布版本" /><el-option v-for="v in versions" :key="v.versionNo" :value="v.versionNo" :label="`V${v.versionNo}${v.status === 1 ? '（收集中）' : '（已停止）'}`" /></el-select>
      </div>
      <div class="mode-row"><el-radio-group v-model="mode" :disabled="busy" aria-label="提问理解方式"><el-radio-button value="LOCAL">本地规则</el-radio-button><el-radio-button value="REAL" :disabled="!provider.configured">AI 理解问题</el-radio-button></el-radio-group><span>{{ mode === 'REAL' ? `${provider.provider} · ${provider.model}` : '不调用模型，适合明确的查询表达' }}</span></div>
      <el-checkbox v-if="mode === 'REAL'" v-model="allowTransfer" :disabled="busy" class="assistant-consent">允许将本对话的提问及所选问卷编号发送给上述模型理解；答卷原文不发送</el-checkbox>
    </div>
    <div class="assistant-scope-note">{{ formKey ? '当前范围：所选问卷，按所选发布版本查询。' : '尚未选择问卷，可先问“列出我的问卷”，再从结果中选择。' }}开放回答采用关键词检索，不是向量语义搜索；助手只读，不修改或发布问卷。</div>

    <div ref="timeline" class="assistant-messages" aria-live="polite">
      <div v-if="!turns.length && !loading" class="assistant-welcome"><div class="welcome-symbol"><i class="el-icon-chat-dot-round" /></div><h3>从一个问题开始</h3><p>选中问卷后，可以继续问它的回收数、均值、相关回答或已审核结论。</p><div class="question-examples"><el-button v-for="q in examples" :key="q" @click="question = q">{{ q }}</el-button></div></div>
      <article v-for="turn in turns" :key="turn.id" class="assistant-turn" :data-turn-id="turn.id">
        <div class="question-bubble"><span>你</span><p>{{ turn.question }}</p></div>
        <div class="answer-bubble">
          <div class="answer-meta"><strong>问卷助手</strong><el-tag size="small" :type="turn.mode === 'REAL' ? 'primary' : 'info'">{{ turn.mode === 'REAL' ? 'AI 理解 · ' + turn.model : turn.mode === 'DEGRADED' ? '已降级本地规则' : '本地规则 · 非模型' }}</el-tag><span v-if="turn.plan?.tool && turn.plan.tool !== 'none'">{{ toolNames[turn.plan.tool] }}</span></div>
          <p v-if="turn.warning" class="turn-warning">{{ turn.warning }}</p>
          <p v-if="turn.result" class="assistant-answer-text">{{ turn.result.message }}</p>
          <p v-else-if="turn.state === 'FAILED'" class="turn-warning">本次未能完成查询，可以重新提问。</p>
          <p v-else class="assistant-hint">{{ turn.state === 'READY' ? '问题已理解，可继续执行只读查询。' : '正在理解或查询；若上次操作中断，可刷新历史或重新提问。' }}</p>
          <el-button v-if="turn.state === 'READY' && turn.plan" :disabled="busy" @click="resume(turn)">继续查询</el-button>
          <template v-if="turn.result">
            <div v-if="turn.result.kind === 'surveys'" class="survey-results"><article v-for="s in turn.result.surveys" :key="s.formKey"><div><strong>{{ s.title }}</strong><p>{{ s.status }} · 创建于 {{ s.createdAt }}</p></div><el-button size="small" :disabled="busy" @click="chooseSurvey(s)">选为当前问卷</el-button></article></div>
            <template v-if="turn.result.kind === 'statistics'">
              <div class="stat-count" data-testid="assistant-answer-count">V{{ turn.result.version }} · {{ turn.result.answerCount }} 份答卷</div>
              <el-table :data="turn.result.statistics" size="small" style="width:100%"><el-table-column prop="label" label="题目" min-width="140" /><el-table-column prop="validCount" label="有效" width="62" /><el-table-column prop="missingCount" label="缺失" width="62" /><el-table-column prop="mean" label="均值" width="72"><template #default="s">{{ s.row.mean ?? '—' }}</template></el-table-column></el-table>
              <el-collapse class="option-statistics"><el-collapse-item title="查看选项人数与有效分母"><div v-for="q in turn.result.statistics" :key="q.fieldId" class="option-stat-question"><strong>{{ q.label }}</strong><p>有效 {{ q.validCount }} · 缺失 {{ q.missingCount }} · 总答卷 {{ q.totalCount }}</p><p v-for="(count,label) in q.map || {}" :key="label">{{ label }}：{{ count }} 人，占本题有效回答 {{ q.percentages?.[label] }}%</p></div><p class="assistant-hint">多选合计可超过100%。条件未展示或无效值计入缺失，不能据此推断总体观点比例。</p></el-collapse-item></el-collapse>
            </template>
            <div v-if="turn.result.kind === 'evidence'" class="retrieval-scope"><el-tag size="small" effect="plain">字面关键词检索</el-tag><p>关键词：{{ turn.result.keywords.join('、') }}；扫描 {{ turn.result.scannedAnswerCount }} 份，匹配 {{ turn.result.matchedResponseCount }} 条，返回 {{ turn.result.returnedEvidenceCount }} 条证据。超过4000字的匹配原文不在本页展开，共 {{ turn.result.longTextExcludedCount }} 条。</p></div>
            <div v-if="turn.result.kind === 'report' && turn.result.available" class="report-result"><p>报告 {{ turn.result.reportId }} · 人工审核通过 · {{ date(turn.result.reportCreatedAt) }}</p><p v-for="(t,index) in turn.result.output.themes" :key="index">{{ t.label }}：列出的证据涉及 {{ t.supportAnswerCount }} 份答卷；引用 {{ t.evidenceIds.join('、') }}</p><p v-for="(i,index) in turn.result.output.interpretations" :key="'i'+index">审核报告中的模型解释：{{ i.text }}</p></div>
            <div v-if="turn.result.citations?.length" class="citation-actions"><el-button v-for="c in turn.result.citations.slice(0,5)" :key="c.id" size="small" plain @click="openCitation(c,turn.result)">来源 {{ c.id }}</el-button><el-button v-if="turn.result.citations.length > 5" size="small" @click="showAllCitations(turn.result)">全部 {{ turn.result.citations.length }} 条来源</el-button></div>
            <div class="result-footer"><span v-if="turn.result.asOf">查询时间 {{ date(turn.result.asOf) }}</span><el-button v-if="turn.result.formKey" text type="primary" @click="openStatistics(turn.result)">打开该版本统计</el-button></div>
          </template>
        </div>
      </article>
    </div>
    <form class="assistant-composer" @submit.prevent="send">
      <el-input v-model="question" aria-label="向问卷助手提问" type="textarea" :rows="2" maxlength="1000" show-word-limit :disabled="busy" placeholder="例如：这份问卷回收了多少答卷？或查找提到“排队”的回答" @keydown.ctrl.enter.prevent="send" />
      <div class="composer-footer"><span>展示最近40条消息、20个对话。历史答案是查询时快照；新提问读取当前数据。</span><el-button native-type="submit" type="primary" :loading="busy" :disabled="!connected || !question.trim() || (mode === 'REAL' && !allowTransfer)">发送查询</el-button></div>
    </form>
    <el-dialog v-model="citationVisible" title="查询来源" width="min(720px, 94vw)" append-to-body><div v-if="citation" class="assistant-citation"><el-tag>{{ citation.id }} · {{ citation.kind === 'statistics' ? '后端统计' : '核心开放回答' }}</el-tag><p>问卷 {{ citation.formKey || citationContext.formKey }} · V{{ citation.version || citationContext.version }}</p><p v-if="citation.answerId">答卷 {{ citation.answerId }} · 题目 {{ citation.fieldId }}</p><h4 v-if="citation.question">{{ citation.question }}</h4><blockquote>{{ citation.text }}</blockquote><p class="assistant-hint">原文和数值来自服务端查询。核心开放回答的自发性及选项提示影响未经判定。</p><p v-if="citationContext.asOf" class="assistant-hint">查询时间 {{ date(citationContext.asOf) }}</p></div></el-dialog>
    <el-dialog v-model="allVisible" title="全部来源" width="min(760px, 94vw)" append-to-body><el-table :data="allCitations" size="small"><el-table-column prop="id" label="来源" width="100" /><el-table-column prop="text" label="原文/说明" min-width="150" show-overflow-tooltip /><el-table-column label="查看" width="70"><template #default="s"><el-button text @click="openCitation(s.row,citationContext)">打开</el-button></template></el-table-column></el-table></el-dialog>
  </section>
</template>
<script setup>
import {ref,computed,onMounted,onBeforeUnmount,nextTick} from 'vue'
import {useRouter} from 'vue-router'
import {assistantStatus,assistantConversations,createAssistantConversation,assistantHistory,assistantVersions,planAssistantQuery} from '@/api/project/assistant'
import {createSurveyMcpClient} from '@/assistant/mcp-client'
const router=useRouter(),connected=ref(false),loading=ref(false),busy=ref(false),searching=ref(false),error=ref(''),provider=ref({})
const mode=ref('LOCAL'),allowTransfer=ref(false),question=ref(''),conversations=ref([]),conversationId=ref(''),turns=ref([]),surveys=ref([]),formKey=ref(''),version=ref(0),versions=ref([]),timeline=ref(null)
const citationVisible=ref(false),citation=ref(null),citationContext=ref({}),allVisible=ref(false),allCitations=ref([])
const toolNames={search_surveys:'查找问卷',survey_stats:'读取版本统计',search_answers:'检索原文证据',survey_report:'读取已审核报告'}
const examples=computed(()=>formKey.value?['这份问卷回收了多少答卷？','查找提到“排队”的回答','查看已审核报告']:['列出我的问卷','找食堂相关的问卷'])
let client,disposed=false,searchNo=0,scopeNo=0,searchTimer
const date=v=>v?new Date(v).toLocaleString('zh-CN',{hour12:false}):''
const message=e=>e?.msg||(e?.code==='ERR_NETWORK'||e?.message==='Failed to fetch'?'网络连接失败，已保存的对话可刷新恢复':e?.message)||'查询失败，请重试'
onBeforeUnmount(()=>{disposed=true;client?.close();clearTimeout(searchTimer)})
async function scrollBottom(){await nextTick();if(timeline.value)timeline.value.scrollTop=timeline.value.scrollHeight}
async function init(){
 loading.value=true;error.value='';connected.value=false;client?.close();client=createSurveyMcpClient()
 try{
  const [s,list]=await Promise.all([assistantStatus(),assistantConversations(),client.connect()])
  if(disposed)return
  provider.value=s.data;conversations.value=list.data;connected.value=true;mode.value=s.data.configured?'REAL':'LOCAL';allowTransfer.value=false
  if(!conversationId.value)conversationId.value=conversations.value[0]?.id||''
  if(conversationId.value)await loadHistory(true)
  await searchSurveysNow('')
 }catch(e){if(!disposed)error.value=message(e)}finally{if(!disposed)loading.value=false}
}
async function loadHistory(restoreScope=false){
 if(!conversationId.value)return
 const id=conversationId.value,res=await assistantHistory(id);if(disposed||id!==conversationId.value)return
 turns.value=res.data.turns
 if(restoreScope){const last=[...turns.value].reverse().find(t=>t.formKey&&t.result?.kind!=='notice');if(last){await chooseSurvey({formKey:last.formKey,title:last.result?.title||last.formKey},last.version||0)}else{formKey.value='';versions.value=[];version.value=0}}
 await scrollBottom()
}
async function recover(){if(!connected.value)return init();error.value='';try{await loadHistory()}catch(e){error.value=message(e)}}
async function newConversation(){if(busy.value)return;error.value='';try{const r=await createAssistantConversation();if(disposed)return;conversationId.value=r.data.id;conversations.value=[r.data,...conversations.value].slice(0,20);turns.value=[];allowTransfer.value=false}catch(e){error.value=message(e)}}
async function changeConversation(){error.value='';allowTransfer.value=false;try{await loadHistory(true)}catch(e){error.value=message(e)}}
function searchSurveys(query){clearTimeout(searchTimer);searchTimer=setTimeout(()=>searchSurveysNow(query),250)}
async function searchSurveysNow(query){
 const n=++searchNo;searching.value=true
 try{const r=await client.call('search_surveys',{query:query||'',limit:10});if(disposed||n!==searchNo)return;const current=surveys.value.find(s=>s.formKey===formKey.value);surveys.value=r.surveys;if(current&&!surveys.value.some(s=>s.formKey===current.formKey))surveys.value.unshift(current)}catch(e){if(!disposed&&n===searchNo)error.value=message(e)}finally{if(!disposed&&n===searchNo)searching.value=false}
}
async function scopeChanged(){const n=++scopeNo;version.value=0;versions.value=[];if(!formKey.value)return;const key=formKey.value;try{const r=await assistantVersions(key);if(!disposed&&n===scopeNo&&key===formKey.value)versions.value=r.data}catch(e){if(!disposed&&n===scopeNo){error.value=message(e);formKey.value=''}}}
async function chooseSurvey(s,v=0){if(!surveys.value.some(x=>x.formKey===s.formKey))surveys.value.unshift(s);formKey.value=s.formKey;await scopeChanged();if(versions.value.some(x=>x.versionNo===v))version.value=v}
function upsert(turn){const i=turns.value.findIndex(t=>t.id===turn.id);if(i<0)turns.value.push(turn);else turns.value[i]=turn}
async function execute(turn){if(turn.state==='READY'&&turn.plan)await client.call(turn.plan.tool,turn.plan.arguments,turn.id)}
async function send(){
 if(busy.value||!connected.value||!question.value.trim()||(mode.value==='REAL'&&!allowTransfer.value))return
 busy.value=true;error.value='';const q=question.value.trim();question.value='';const id=crypto.randomUUID()
 try{
  if(!conversationId.value){const c=await createAssistantConversation();if(disposed)return;conversationId.value=c.data.id}
  upsert({id,question:q,state:'PLANNING',mode:mode.value});await scrollBottom()
  const r=await planAssistantQuery({id,conversationId:conversationId.value,question:q,formKey:formKey.value||null,version:version.value||null,mode:mode.value,allowQuestionTransfer:allowTransfer.value})
  if(disposed)return;upsert(r.data);await execute(r.data);if(disposed)return
  await loadHistory();const list=await assistantConversations();if(!disposed)conversations.value=list.data
 }catch(e){if(!disposed){error.value=message(e);try{await loadHistory()}catch{}if(!turns.value.some(t=>t.id===id))question.value=q}}
 finally{if(!disposed){busy.value=false;await scrollBottom()}}
}
async function resume(turn){if(busy.value)return;busy.value=true;error.value='';try{await execute(turn);if(!disposed)await loadHistory()}catch(e){if(!disposed){error.value=message(e);try{await loadHistory()}catch{}}}finally{if(!disposed)busy.value=false}}
function openCitation(c,context){citation.value=c;citationContext.value=context;citationVisible.value=true}
function showAllCitations(result){allCitations.value=result.citations;citationContext.value=result;allVisible.value=true}
function openStatistics(result){if(/^[A-Za-z0-9_-]{1,64}$/.test(result.formKey)&&Number.isInteger(result.version))router.push({path:'/project/form/statistics',query:{key:result.formKey,version:result.version}})}
onMounted(init)
</script>
<style scoped>
.assistant-page{display:flex;flex-direction:column;height:100%;min-height:0;min-width:0;box-sizing:border-box;overflow:auto;padding:24px;gap:14px;color:#1d2939;background:#f5f7fa}.assistant-heading{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex:none}.assistant-heading h2{margin:0 0 8px;font-size:23px}.assistant-heading p{margin:0;color:#667085;font-size:13px}.assistant-controls{background:white;border:1px solid #e4e7ec;border-radius:12px;padding:14px;flex:none}.scope-row{display:flex;flex-wrap:wrap;gap:10px}.scope-row>.el-select:first-child{width:220px}.scope-row>.el-select{width:230px}.scope-row>.el-select:last-child{width:180px}.mode-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:12px}.mode-row>span{font-size:12px;color:#667085}.assistant-consent{height:auto;white-space:normal;align-items:flex-start;margin-top:10px}.assistant-consent :deep(.el-checkbox__label){white-space:normal;line-height:1.7}.assistant-scope-note,.assistant-hint{font-size:12px;color:#667085;line-height:1.8}.assistant-messages{flex:1;min-height:220px;overflow:auto;padding:0 4px 8px}.assistant-welcome{text-align:center;padding:38px 12px;color:#667085}.welcome-symbol{font-size:32px;color:#3370ff}.assistant-welcome h3{color:#344054;font-size:18px}.assistant-welcome p{font-size:13px;line-height:1.8}.question-examples{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:18px}.question-examples .el-button{margin:0}.assistant-turn{margin-bottom:22px}.question-bubble{margin:0 0 10px auto;max-width:80%;background:#eaf1ff;border:1px solid #dbe6ff;border-radius:12px;padding:12px 16px}.question-bubble span{font-size:11px;color:#667085}.question-bubble p{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.8}.answer-bubble{background:white;border:1px solid #e4e7ec;border-radius:12px;padding:16px;overflow:hidden}.answer-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px}.answer-meta>span{font-size:12px;color:#667085}.assistant-answer-text{white-space:pre-wrap;font-size:14px;line-height:1.9;overflow-wrap:anywhere}.turn-warning{color:#996515;background:#fff8e8;border-radius:6px;padding:10px;font-size:12px;line-height:1.8}.survey-results>article{border-top:1px solid #f0f1f4;padding:12px 0;display:flex;justify-content:space-between;gap:12px;align-items:center}.survey-results strong{font-size:14px;overflow-wrap:anywhere}.survey-results p{font-size:12px;color:#667085;margin:5px 0 0}.stat-count{font-size:15px;font-weight:600;margin:14px 0}.option-statistics{margin-top:10px}.option-stat-question{font-size:12px;border-bottom:1px solid #f0f1f4;padding:8px 0;line-height:1.8}.option-stat-question p{margin:5px 0}.retrieval-scope,.report-result{font-size:13px;line-height:1.9;overflow-wrap:anywhere}.citation-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.citation-actions .el-button{margin-left:0;max-width:100%;overflow:hidden;text-overflow:ellipsis}.result-footer{display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;font-size:11px;color:#667085;margin-top:12px}.assistant-composer{border:1px solid #e4e7ec;border-radius:12px;padding:14px;background:white;flex:none}.composer-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px}.composer-footer>span{font-size:11px;color:#667085;line-height:1.7}.assistant-citation{line-height:1.8;overflow-wrap:anywhere}.assistant-citation blockquote{white-space:pre-wrap;background:#f5f7fa;border-left:3px solid #3370ff;padding:14px;margin:16px 0}.assistant-error{flex:none}
@media(max-width:700px){.assistant-page{padding:12px;gap:10px}.assistant-heading h2{font-size:20px}.assistant-heading p{line-height:1.6}.assistant-controls{padding:12px}.scope-row>.el-select,.scope-row>.el-select:first-child,.scope-row>.el-select:last-child{width:100%}.scope-row>.el-select:first-child{width:calc(100% - 90px)}.scope-row>.el-button{margin-left:0}.answer-bubble{padding:12px}.question-bubble{max-width:90%;padding:10px 12px}.assistant-consent :deep(.el-checkbox__label){font-size:12px}.assistant-heading>.el-tag{font-size:11px}.survey-results>article{align-items:flex-start;flex-wrap:wrap}.composer-footer{align-items:flex-end}.assistant-messages{min-height:230px}.assistant-composer{padding:12px}.answer-meta .el-tag{max-width:100%;white-space:normal;height:auto;line-height:1.6}}
</style>
<style scoped>
@media(max-width:700px){
  .scope-row{display:grid;grid-template-columns:minmax(0,1fr) 80px}
  .scope-row>.el-select:first-child{width:100%;min-width:0;grid-column:1}
  .scope-row>.el-button{width:80px;min-width:0;grid-column:2}
  .scope-row>.el-select:nth-of-type(2),.scope-row>.el-select:last-child{width:100%;min-width:0;grid-column:1 / -1}
  .assistant-messages{min-height:160px}
  .assistant-composer{position:sticky;bottom:0;z-index:2}
}
</style>
