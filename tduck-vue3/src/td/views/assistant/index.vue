<template>
  <section class="assistant-page">
    <header class="chat-toolbar">
      <div class="toolbar-title">
        <span class="assistant-mark" aria-hidden="true"><i class="el-icon-chat-dot-round" /></span>
        <div>
          <h2>聊一聊，也管理你的问卷</h2>
          <p>{{ connected ? '查问卷、做分析、设计新问卷，直接说就好。' : '正在连接…' }}</p>
        </div>
      </div>
      <div class="toolbar-actions">
        <el-button text :disabled="busy" @click="sendExample('你能做什么？')">能力</el-button>
        <el-button text :disabled="busy" @click="historyVisible = true">历史</el-button>
        <el-button class="new-chat-btn" :disabled="busy || !connected" @click="newConversation">新对话</el-button>
      </div>
    </header>
    <el-alert v-if="error" class="assistant-error" :title="error" type="error" :closable="false"><el-button text @click="recover">重试连接</el-button></el-alert>
    <div v-if="formKey" class="context-chip"><span class="context-dot" aria-hidden="true" /><span class="context-text">正在聊：{{ selectedTitle }}</span><el-button text size="small" :disabled="busy" @click="clearContext">清除</el-button></div>
    <div ref="timeline" class="assistant-messages" aria-live="polite">
      <div v-if="!turns.length && !loading" class="assistant-welcome"><div class="welcome-symbol"><i class="el-icon-chat-dot-round" /></div><h3>你好，有什么想聊的？</h3><p>从找到一份问卷，到读懂数据、设计下一次调查。</p><div class="question-examples"><el-button v-for="q in ['你好','列出我的问卷','帮我设计一份大学生食堂满意度问卷，6道题','你能做什么？']" :key="q" :disabled="busy" @click="sendExample(q)">{{ q }}</el-button></div></div>
      <article v-for="turn in turns" :key="turn.id" class="assistant-turn" :data-turn-id="turn.id">
        <div class="turn-row turn-row--user">
          <div class="turn-avatar turn-avatar--user" aria-hidden="true">我</div>
          <div class="turn-body"><div class="question-bubble"><span>你</span><p>{{ turn.question }}</p></div></div>
        </div>
        <div class="turn-row turn-row--assistant">
          <div class="turn-avatar turn-avatar--ai" aria-hidden="true"><i class="el-icon-chat-dot-round" /></div>
          <div class="turn-body"><div class="answer-bubble"><div class="answer-meta"><strong>问卷助手</strong><span v-if="turn.mode === 'REAL'">{{ turn.model }}</span><span v-else-if="turn.mode === 'DEGRADED'">本地降级</span><span class="readonly-chip">只读查询</span></div>
          <p v-if="turn.warning" class="turn-warning">{{ turn.warning }}</p>
          <p v-if="turn.result" class="assistant-answer-text">{{ knowledgeMessage(turn.result) }}</p>
          <p v-else class="assistant-hint">{{ turn.streamStatus || (turn.state === 'FAILED' ? '本次没能完成，可以重新发送。' : turn.state === 'READY' && !busy ? '查询已准备好，点击下方继续。' : turn.plan?.tool==='survey_knowledge' ? '正在检索知识库并请模型整理分析…' : '正在回复…') }}</p>
          <p v-if="turn.result?.generationWarning" class="turn-warning">{{ turn.result.generationWarning }}</p>
          <el-button v-if="turn.state === 'READY' && !busy" @click="resume(turn)">继续查询</el-button>
          <template v-if="turn.result">
            <details v-if="turn.result.kind === 'knowledge_answer'" class="knowledge-answer-scope"><summary>查看依据与范围 · V{{ turn.result.version }} · {{ turn.result.answerCount }} 份答卷</summary><div><el-tag :type="turn.result.generationMode==='REAL'?'success':'warning'">{{ turn.result.generationMode==='REAL'?'知识库检索 · LLM 分析':'已检索 · 分析未完成' }}</el-tag><el-tag v-if="turn.result.simulated" type="warning">包含模拟测试答卷</el-tag><p>V{{ turn.result.version }} · {{ turn.result.answerCount }} 份答卷 · 从 {{ turn.result.documentCount }} 个资料片段中选取 {{ turn.result.retrievedCount }} 条供分析</p><p v-if="turn.result.totalStatisticCount">本次向模型提供 {{ turn.result.providedStatisticCount }} / {{ turn.result.totalStatisticCount }} 道题的统计；按当前模型上下文预算选择相关资料。</p><p v-if="turn.result.excludedEvidenceCount">另有 {{ turn.result.excludedEvidenceCount }} 条开放回答未入库，当前归纳覆盖有限。</p><p>{{ turn.result.retrievalMode }}；模型归纳可通过下方来源核对，片段数量不代表持某种观点的人数。</p></div></details>
            <SurveyAction v-if="turn.result.kind === 'action_proposal'" :result="turn.result" :busy="busy" @decide="confirmAction(turn,$event)" @edit="confirmAndEdit(turn)" />
            <div v-if="turn.result.kind === 'action_result'" class="management-result"><el-tag type="success">已完成</el-tag><el-button v-if="turn.result.action !== 'ARCHIVE'" text @click="useResultContext(turn.result)">继续聊这份问卷</el-button><el-button v-if="turn.result.action !== 'ARCHIVE'" text @click="openEditor(turn.result)">打开问卷</el-button></div>
            <SurveyAnalysis v-if="turn.result.kind === 'statistics' && wantsInlineChart(turn.question)" :result="turn.result" />
            <div v-if="turn.result.kind === 'details'" class="survey-details"><h4>{{ turn.result.title }}</h4><p>{{ turn.result.description }}</p><ol><li v-for="q in turn.result.questions" :key="q.id"><strong>{{ q.label }}</strong><span> · {{ q.type }} · {{ q.required ? '必填' : '选填' }}</span><p v-if="q.scheme?.config?.options">{{ q.scheme.config.options.map(o=>o.label).join(' / ') }}</p></li></ol><el-button size="small" @click="openEditor(turn.result)">打开编辑器</el-button></div>
            <el-table v-if="turn.result.kind === 'versions'" :data="turn.result.versions" size="small"><el-table-column prop="versionNo" label="版本" width="70" /><el-table-column label="状态"><template #default="s">{{ s.row.status === 1 ? '收集中' : '已停止' }}</template></el-table-column><el-table-column prop="answerCount" label="答卷数" /><el-table-column prop="createdAt" label="发布时间" min-width="150" /></el-table>
            <div v-if="turn.result.sharePath" class="share-result"><el-input readonly :model-value="shareUrl(turn.result.sharePath)" aria-label="问卷分享链接" /><el-button size="small" @click="copyShare(turn.result.sharePath)">{{ copyStatus || '复制链接' }}</el-button></div>
            <div v-if="turn.result.kind === 'export'" class="export-result"><el-button type="primary" plain size="small" @click="downloadAnswers(turn.result)">下载答卷 CSV · {{ turn.result.rows.length }} 份</el-button></div>
            <div v-if="turn.result.kind === 'evidence'" class="retrieval-scope"><p>关键词：{{ turn.result.keywords.join('、') }}；扫描 {{ turn.result.scannedAnswerCount }} 份答卷，字面匹配 {{ turn.result.matchedResponseCount }} 条，返回 {{ turn.result.returnedEvidenceCount }} 条原文。超过4000字不展开的匹配共 {{ turn.result.longTextExcludedCount }} 条。</p></div>
            <div v-if="turn.result.kind === 'report' && turn.result.available" class="report-result"><p>报告 {{ turn.result.reportId }} · 人工审核通过</p><p v-for="(t,index) in turn.result.output.themes" :key="index">{{ t.label }}：列出的证据涉及 {{ t.supportAnswerCount }} 份答卷；引用 {{ t.evidenceIds.join('、') }}</p><p v-for="(i,index) in turn.result.output.interpretations" :key="'i'+index">{{ i.text }}</p></div>
            <div v-if="turn.result.citations?.length" class="citation-actions"><el-button v-for="(c,sourceIndex) in turn.result.citations.slice(0,5)" :key="c.id" size="small" plain @click="openCitation(c,turn.result)">来源 {{ sourceIndex+1 }}</el-button><el-button v-if="turn.result.citations.length > 5" size="small" @click="showAllCitations(turn.result)">全部来源</el-button></div>
            <div v-if="turn.result.formKey && Number.isInteger(turn.result.version)" class="result-footer"><span>V{{ turn.result.version }} · {{ date(turn.result.asOf) }}</span><el-button text type="primary" @click="openStatistics(turn.result)">查看统计页</el-button></div>
          </template>
            </div></div>
        </div>
      </article>
    </div>
    <form class="assistant-composer" @submit.prevent="send"><el-input v-model="question" aria-label="给问卷助手发消息" type="textarea" :rows="2" maxlength="1000" :disabled="busy" placeholder="说点什么，例如：分析这份问卷并出图…" @keydown.enter="handleEnter" /><div class="composer-footer"><span>{{ provider.configured ? `${provider.model} · 仅操作自己的问卷；管理操作确认后执行，知识库分析会将检索片段与统计发送给当前模型。` : '模型暂未启用，本地查询与管理预览仍可用。' }}</span><el-button native-type="submit" type="primary" :loading="busy" :disabled="!connected || !question.trim() || busy">发送</el-button></div></form>
    <el-drawer v-model="historyVisible" title="对话历史" size="min(380px, 92vw)" append-to-body class="assistant-history-drawer">
      <div class="conversation-list">
        <div v-for="c in conversations" :key="c.id" class="conversation-item" :class="{ 'is-active': c.id === conversationId }">
          <button class="conversation-main" :disabled="busy" @click="changeConversation(c.id)">
            <span class="conversation-title">{{ c.title }}</span>
            <span class="conversation-time">{{ shortDate(c.updatedAt) }}</span>
          </button>
          <el-button class="conversation-delete" text :disabled="busy" aria-label="删除对话" @click.stop="removeConversation(c)"><i class="el-icon-delete" /></el-button>
        </div>
        <p v-if="!conversations.length" class="conversation-empty">暂无历史对话</p>
      </div>
    </el-drawer>
    <el-dialog v-model="citationVisible" class="assistant-source-dialog" title="查询来源" width="min(720px, 94vw)" append-to-body><div v-if="citation" class="assistant-citation"><el-tag>{{ citation.id }} · {{ citation.kind === 'statistics' ? '后端统计' : citation.kind === 'question' ? '题目背景' : '开放回答（联系方式已过滤）' }}</el-tag><p>问卷 {{ citation.formKey || citationContext.formKey }} · V{{ citation.version || citationContext.version }}</p><p v-if="citation.answerId">答卷 {{ citation.answerId }} · 题目 {{ citation.fieldId }}</p><h4 v-if="citation.question">{{ citation.question }}</h4><blockquote>{{ citation.text }}</blockquote><p class="assistant-hint">原文与数值来自后端。核心开放回答的自发性未经判定；查询时间 {{ date(citationContext.asOf) }}。</p></div></el-dialog>
    <el-dialog v-model="allVisible" title="全部来源" width="min(760px, 94vw)" append-to-body><el-table :data="allCitations" size="small"><el-table-column prop="id" label="来源" width="100" /><el-table-column prop="text" label="原文/说明" min-width="150" show-overflow-tooltip /><el-table-column label="查看" width="70"><template #default="s"><el-button text @click="openCitation(s.row,citationContext)">打开</el-button></template></el-table-column></el-table></el-dialog>
  </section>
</template>

<script setup>
import {ref,onMounted,onBeforeUnmount,nextTick} from 'vue'
import {useRouter,useRoute} from 'vue-router'
import store from '@/store'
import {readAssistantEvents} from '@/assistant/stream'
import {ElMessageBox} from 'element-plus'
import {assistantStatus,assistantConversations,createAssistantConversation,assistantHistory,deleteAssistantConversation,planAssistantQuery,decideAssistantAction} from '@/api/project/assistant'
import SurveyAction from '@/assistant/SurveyAction.vue'
import SurveyAnalysis from '@/assistant/SurveyAnalysis.vue'
import {downloadAnswers} from '@/assistant/download'
import {createSurveyMcpClient} from '@/assistant/mcp-client'
import {knowledgeMessage,wantsInlineChart} from '@/assistant/knowledge'
const route=useRoute(),router=useRouter(),connected=ref(false),loading=ref(false),busy=ref(false),error=ref(''),provider=ref({}),question=ref(''),conversations=ref([]),conversationId=ref(''),turns=ref([]),timeline=ref(null)
const formKey=ref(''),version=ref(null),selectedTitle=ref(''),historyVisible=ref(false),citationVisible=ref(false),citation=ref(null),citationContext=ref({}),allVisible=ref(false),allCitations=ref([])
const copyStatus=ref('')
let client,disposed=false,streamController
const date=v=>v?new Date(v).toLocaleString('zh-CN',{hour12:false}):''
const message=e=>e?.msg||e?.message||'连接中断，请重试。'
onBeforeUnmount(()=>{disposed=true;streamController?.abort();client?.close()})
async function scrollBottom(){await nextTick();if(timeline.value)timeline.value.scrollTop=timeline.value.scrollHeight}
function clearContext(){formKey.value='';version.value=null;selectedTitle.value=''}
async function init(){loading.value=true;error.value='';connected.value=false;client?.close();client=createSurveyMcpClient();try{const [s,list]=await Promise.all([assistantStatus(),assistantConversations(),client.connect()]);if(disposed)return;provider.value=s.data;conversations.value=list.data;const saved=sessionStorage.getItem('assistant-conversation');conversationId.value=list.data.some(c=>c.id===saved)?saved:list.data[0]?.id||'';if(conversationId.value)await loadHistory(true);if(/^[A-Za-z0-9_-]{1,64}$/.test(String(route.query.formKey||''))){formKey.value=String(route.query.formKey);version.value=Number(route.query.version)||null;selectedTitle.value=String(route.query.title||route.query.formKey);question.value=String(route.query.question||'总结这份问卷的答卷').slice(0,1000)}connected.value=true}catch(e){if(!disposed)error.value=message(e)}finally{if(!disposed)loading.value=false}}
async function loadHistory(restore=false){if(!conversationId.value)return;const id=conversationId.value,r=await assistantHistory(id);if(disposed||id!==conversationId.value)return;turns.value=r.data.turns;sessionStorage.setItem('assistant-conversation',id);const last=turns.value[turns.value.length-1];if(last?.result?.kind==='action_result'){if(last.result.action==='ARCHIVE')clearContext();else useResultContext(last.result)}else if(last?.formKey&&(last.result?.kind!=='notice'||last.result?.reason==='UNPUBLISHED')){formKey.value=last.formKey;version.value=last.version||null;selectedTitle.value=last.result?.title||last.formKey}else if(restore)clearContext();await scrollBottom()}
async function newConversation(){if(busy.value)return;busy.value=true;error.value='';try{const r=await createAssistantConversation();if(disposed)return;conversationId.value=r.data.id;sessionStorage.setItem('assistant-conversation',r.data.id);conversations.value=[r.data,...conversations.value].slice(0,20);turns.value=[];clearContext()}catch(e){error.value=message(e)}finally{if(!disposed)busy.value=false}}
async function changeConversation(id){if(busy.value)return;busy.value=true;conversationId.value=id;historyVisible.value=false;try{await loadHistory(true)}catch(e){error.value=message(e)}finally{if(!disposed)busy.value=false}}
const shortDate=v=>{if(!v)return '';const d=new Date(v);return isNaN(d.getTime())?'':d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}
async function removeConversation(c){
  if(busy.value)return
  try{await ElMessageBox.confirm(`删除「${c.title}」？该对话下的消息会一并删除，且不可恢复。`,'删除对话',{type:'warning',confirmButtonText:'删除',cancelButtonText:'取消'})}catch{return}
  busy.value=true;error.value=''
  try{
    await deleteAssistantConversation(c.id)
    conversations.value=conversations.value.filter(x=>x.id!==c.id)
    if(c.id===conversationId.value){
      const next=conversations.value[0]
      if(next){conversationId.value=next.id;sessionStorage.setItem('assistant-conversation',next.id);await loadHistory(true)}
      else{conversationId.value='';turns.value=[];clearContext();sessionStorage.removeItem('assistant-conversation')}
    }
  }catch(e){error.value=message(e)}finally{if(!disposed)busy.value=false}
}
async function recover(){if(!connected.value)return init();error.value='';try{await loadHistory()}catch(e){error.value=message(e)}}
function handleEnter(e){if(e.shiftKey||e.isComposing||e.keyCode===229)return;e.preventDefault();send()}
async function sendExample(q){question.value=q;await send()}
function upsert(t){const i=turns.value.findIndex(x=>x.id===t.id);if(i<0)turns.value.push(t);else turns.value[i]=t}
async function execute(turn){for(let stage=0;stage<3&&turn?.state==='READY';stage++){await client.call(turn.plan.tool,turn.plan.arguments,turn.id);if(disposed)return;await loadHistory();turn=turns.value.find(x=>x.id===turn.id)}}
async function send(){if(busy.value||!connected.value||!question.value.trim())return;busy.value=true;error.value='';const q=question.value.trim(),id=crypto.randomUUID();question.value='';try{if(!conversationId.value){const c=await createAssistantConversation();if(disposed)return;conversationId.value=c.data.id}upsert({id,question:q,state:'PLANNING'});await scrollBottom();streamController=new AbortController();const response=await fetch(process.env.VUE_APP_API_ROOT+'/user/form/assistant/chat/stream',{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream',token:store.state.user.token},body:JSON.stringify({id,conversationId:conversationId.value,question:q,formKey:formKey.value||null,version:q.includes('最新')?null:version.value}),signal:streamController.signal});await readAssistantEvents(response,async(type,data)=>{if(disposed)return;const t=turns.value.find(x=>x.id===id);if(type==='status')t.streamStatus=data.message;if(type==='answer'){t.result={...data.result,message:''};t.mode=data.result.generationMode==='REAL'?'REAL':'LOCAL';t.model=data.result.model}if(type==='delta'){t.result.message+=data.text;await scrollBottom()}});if(disposed)return;await loadHistory();const list=await assistantConversations();if(!disposed)conversations.value=list.data}catch(e){if(!disposed){error.value=message(e);try{await loadHistory()}catch{}if(!turns.value.some(t=>t.id===id))question.value=q}}finally{if(!disposed){busy.value=false;await scrollBottom()}}}
async function resume(t){if(busy.value)return;busy.value=true;error.value='';try{await execute(t);await loadHistory()}catch(e){error.value=message(e);try{await loadHistory()}catch{}}finally{busy.value=false}}
function openCitation(c,r){citation.value=c;citationContext.value=r;citationVisible.value=true}
function showAllCitations(r){allCitations.value=r.citations;citationContext.value=r;allVisible.value=true}
function openStatistics(r){if(/^[A-Za-z0-9_-]{1,64}$/.test(r.formKey)&&Number.isInteger(r.version))router.push({path:'/project/form/statistics',query:{key:r.formKey,version:r.version}})}
function openEditor(r){if(/^[A-Za-z0-9_-]{1,64}$/.test(r.formKey))router.push({path:'/project/form/editor',query:{key:r.formKey}})}
function useResultContext(r){formKey.value=r.formKey;version.value=r.version||null;selectedTitle.value=r.title||r.formKey}
async function confirmAction(turn,confirm){if(busy.value)return;busy.value=true;error.value='';try{await decideAssistantAction(turn.id,confirm);await loadHistory()}catch(e){error.value=message(e);try{await loadHistory()}catch{}}finally{busy.value=false}}
async function confirmAndEdit(turn){if(busy.value)return;busy.value=true;error.value='';try{const response=await decideAssistantAction(turn.id,true);await loadHistory();if(!disposed&&response.data?.kind==='action_result')openEditor(response.data)}catch(e){error.value=message(e);try{await loadHistory()}catch{}}finally{busy.value=false}}
function shareUrl(path){return /^\/s\/[A-Za-z0-9_-]+\?t=[A-Za-z0-9]+$/.test(path)?location.origin+path:''}
async function copyShare(path){try{const url=shareUrl(path);if(!url)throw new Error('分享链接格式不正确');await navigator.clipboard.writeText(url);copyStatus.value='已复制'}catch{error.value='复制失败，请选择链接文本手动复制。'}}
onMounted(init)
</script>

<style scoped>
.knowledge-answer-scope summary{cursor:pointer;color:var(--zy-text-secondary,#667085);font-size:12px}.knowledge-answer-scope>div{padding-top:10px}.knowledge-answer-scope{padding:12px 0;font-size:12px;line-height:1.8;color:var(--zy-text-secondary,#667085)}.knowledge-answer-scope .el-tag{margin:0 8px 8px 0}
.management-result,.share-result,.export-result{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:14px 0}.management-result .el-button{margin:0}.share-result .el-input{flex:1;min-width:160px}.survey-details{font-size:13px;line-height:1.9;overflow-wrap:anywhere}.survey-details li{padding:7px 0}.survey-details span{color:#718191;font-size:11px}
.assistant-page{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.composer-footer span{overflow-wrap:anywhere;min-width:0;flex:1}.composer-footer .el-button{flex:none}
.assistant-page{display:flex;flex-direction:column;height:100%;min-height:0;min-width:0;box-sizing:border-box;overflow:auto;padding:22px 28px 18px;gap:14px;color:#1d2939;background:#f5f7fa}.chat-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;flex:none}.chat-toolbar h2{margin:0 0 6px;font-size:21px}.chat-toolbar p{margin:0;color:#667085;font-size:13px;line-height:1.7}.toolbar-actions{display:flex;gap:8px;flex:none}.toolbar-actions .el-button{margin:0}.context-chip{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#eaf4ef;border-radius:8px;padding:3px 12px;font-size:12px;color:#25624d;flex:none}.context-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.assistant-messages{flex:1;min-height:160px;overflow:auto;padding:4px 4px 12px}.assistant-welcome{text-align:center;padding:10vh 12px;color:#667085}.welcome-symbol{font-size:32px;color:#3370ff}.assistant-welcome h3{font-size:21px;color:#344054}.assistant-welcome p{font-size:14px;line-height:1.8}.question-examples{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:24px}.question-examples .el-button{margin:0}.assistant-turn{margin-bottom:24px}.question-bubble{margin:0 0 12px auto;max-width:78%;width:fit-content;background:#eaf1ff;border:1px solid #dbe6ff;border-radius:12px;padding:12px 16px}.question-bubble span{font-size:11px;color:#667085}.question-bubble p{margin:5px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.8}.answer-bubble{background:white;border:1px solid #e4e7ec;border-radius:12px;padding:16px;overflow:hidden}.answer-meta{display:flex;gap:12px;align-items:center;font-size:13px}.answer-meta span,.assistant-hint{font-size:12px;color:#667085;line-height:1.8}.assistant-answer-text{white-space:pre-wrap;font-size:14px;line-height:1.9;overflow-wrap:anywhere}.turn-warning{color:#8b641a;background:#fff8e8;border-radius:6px;padding:9px;font-size:12px;line-height:1.8}.survey-results article{border-top:1px solid #edf0f4;padding:12px 0;display:flex;align-items:center;justify-content:space-between;gap:12px}.survey-results strong{font-size:14px;overflow-wrap:anywhere}.survey-results p{font-size:12px;color:#667085;margin:5px 0}.stat-count{font-size:15px;font-weight:600;margin:14px 0}.option-stat-question{font-size:12px;border-bottom:1px solid #f0f1f4;padding:8px 0;line-height:1.8}.retrieval-scope,.report-result{font-size:13px;line-height:1.9;overflow-wrap:anywhere}.citation-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.citation-actions .el-button{margin:0}.result-footer{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;color:#667085;font-size:11px;margin-top:12px}.assistant-composer{border:1px solid #dfe5ed;border-radius:12px;padding:12px;background:white;flex:none}.composer-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:9px}.composer-footer span{font-size:11px;color:#667085;line-height:1.7}.assistant-error{flex:none}.assistant-citation{line-height:1.8;overflow-wrap:anywhere}.assistant-citation blockquote{white-space:pre-wrap;background:var(--zy-surface-subtle,#f5f7fa);color:var(--zy-text,#344054);border-left:3px solid #3370ff;padding:14px;margin:16px 0}.conversation-list{display:flex;flex-direction:column;gap:8px}.conversation-list .el-button{justify-content:flex-start;white-space:normal;line-height:1.8;height:auto;text-align:left;margin:0}
@media(max-width:700px){.assistant-page{padding:14px 12px 10px;gap:10px}.chat-toolbar{align-items:flex-start}.chat-toolbar h2{font-size:17px}.chat-toolbar p{font-size:12px}.toolbar-actions{gap:2px}.toolbar-actions .el-button{padding:8px}.assistant-welcome{padding:5vh 8px}.assistant-welcome h3{font-size:19px}.answer-bubble{padding:12px}.assistant-composer{position:sticky;bottom:0;z-index:2;padding:10px}.composer-footer{align-items:flex-end;gap:8px}.composer-footer span{font-size:10px}.question-bubble{max-width:85%}}

/* ===== 布局升级：居中对话列 + 头像分组 + 卡片化结果 + 吸底输入 ===== */
.assistant-page {
  padding: 26px 30px 20px !important;
  gap: 16px !important;
  background-image: var(--zy-page-glow) !important;
}
.assistant-page > * {
  width: 100%;
  max-width: 1080px;
  margin-inline: auto;
}
/* 顶部 */
.chat-toolbar {
  align-items: center !important;
  padding-bottom: 4px;
}
.toolbar-title {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.assistant-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 14px;
  color: #ffffff;
  font-size: 20px;
  background-color: var(--zy-primary-solid);
  background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0) 70%);
  box-shadow: 0 14px 28px -18px rgba(47, 111, 237, 0.95), inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}
.chat-toolbar h2 {
  margin: 0 0 4px !important;
  font-size: 20px !important;
  letter-spacing: 0.01em;
}
.chat-toolbar p {
  margin: 0 !important;
  font-size: 12.5px !important;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  background-color: var(--zy-surface) !important;
  border: 1px solid var(--zy-border) !important;
  box-shadow: var(--zy-shadow-card);
}
.toolbar-actions .el-button {
  margin: 0 !important;
  border-radius: 8px !important;
  color: var(--zy-text-regular) !important;
}
.toolbar-actions .el-button:hover {
  background-color: #1b2a3d !important;
  color: var(--zy-text) !important;
}
.toolbar-actions .new-chat-btn {
  margin-left: 4px !important;
  background-color: var(--zy-primary-solid) !important;
  border: 1px solid transparent !important;
  color: #ffffff !important;
  padding: 8px 14px !important;
}
.toolbar-actions .new-chat-btn:hover {
  background-color: #3f7ef5 !important;
  color: #ffffff !important;
}
/* 上下文条 */
.context-chip {
  justify-content: flex-start !important;
  gap: 10px !important;
  padding: 9px 12px !important;
  border-radius: 12px !important;
  background-color: var(--zy-tint) !important;
  border: 1px solid var(--zy-border) !important;
  color: var(--zy-accent-cyan) !important;
  font-size: 12.5px !important;
}
.context-chip .context-dot {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background-color: var(--zy-accent-cyan);
  box-shadow: 0 0 10px rgba(56, 232, 255, 0.75);
}
.context-chip .context-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.context-chip .el-button {
  color: var(--zy-accent-cyan) !important;
}
/* 消息区 */
.assistant-messages {
  padding: 6px 6px 10px !important;
  scrollbar-width: thin;
  scrollbar-color: var(--zy-border) transparent;
}
.assistant-turn {
  margin-bottom: 26px !important;
}
.assistant-turn:last-child {
  margin-bottom: 8px;
}
.turn-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.turn-row--user {
  flex-direction: row-reverse;
}
.turn-row--assistant {
  margin-top: 14px;
}
.turn-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 600;
}
.turn-avatar--user {
  background-color: var(--zy-surface) !important;
  border: 1px solid var(--zy-border) !important;
  color: var(--zy-text-regular) !important;
}
.turn-avatar--ai {
  background-color: var(--zy-primary-solid);
  color: #ffffff;
  box-shadow: 0 10px 22px -16px rgba(47, 111, 237, 0.95);
}
.turn-body {
  flex: 1 1 auto;
  min-width: 0;
  max-width: min(860px, 92%);
}
.turn-row--user .turn-body {
  flex: 0 1 auto;
  display: flex;
  justify-content: flex-end;
  max-width: min(680px, 82%);
}
/* 气泡 */
.question-bubble {
  margin: 0 !important;
  max-width: 100% !important;
  padding: 11px 16px !important;
  border-radius: 16px 16px 4px 16px !important;
  background-color: var(--zy-tint) !important;
  border: 1px solid var(--zy-border) !important;
}
.question-bubble span {
  display: block;
  font-size: 11px !important;
  letter-spacing: 0.06em;
  opacity: 0.75;
}
.question-bubble p {
  margin: 4px 0 0 !important;
  color: var(--zy-text) !important;
  font-size: 14px !important;
  line-height: 1.75 !important;
}
.answer-bubble {
  width: 100%;
  padding: 0 !important;
  border-radius: 16px 16px 16px 4px !important;
  background-color: var(--zy-surface) !important;
  border: 1px solid var(--zy-border) !important;
  box-shadow: var(--zy-shadow-card) !important;
  overflow: hidden;
}
.answer-meta {
  display: flex !important;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px !important;
  padding: 12px 18px !important;
  border-bottom: 1px solid var(--zy-border-light) !important;
  background-color: var(--zy-surface-subtle) !important;
  font-size: 12.5px !important;
}
.answer-meta strong {
  color: var(--zy-text) !important;
  font-size: 13px;
}
.answer-meta span {
  color: var(--zy-text-secondary) !important;
}
.answer-meta .readonly-chip {
  margin-left: auto;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--zy-border) !important;
  color: var(--zy-text-secondary) !important;
  font-size: 11px;
}
.assistant-answer-text {
  margin: 0;
  padding: 16px 18px 6px !important;
  font-size: 14px !important;
  line-height: 1.85 !important;
  color: var(--zy-text-regular) !important;
}
.answer-bubble > .el-button {
  margin: 0 18px 14px !important;
}
.assistant-hint {
  padding: 0 18px !important;
}
.turn-warning {
  margin: 12px 18px 0 !important;
  padding: 10px 12px !important;
  border-radius: 10px !important;
  background-color: rgba(229, 187, 101, 0.14) !important;
  border: 1px solid rgba(229, 187, 101, 0.32) !important;
  color: #e5bb65 !important;
}
/* 卡片内的表格/折叠面板 */
.answer-bubble .el-table {
  margin: 4px 18px 14px !important;
  width: calc(100% - 36px) !important;
  border-radius: 10px;
  overflow: hidden;
}
.answer-bubble .el-collapse {
  margin: 0 18px 14px !important;
  border-color: var(--zy-border-light) !important;
}
.answer-bubble .el-collapse-item__header,
.answer-bubble .el-collapse-item__wrap {
  background-color: transparent !important;
  border-color: var(--zy-border-light) !important;
  color: var(--zy-text-regular) !important;
}
.answer-bubble > p,
.answer-bubble > div:not(.answer-meta):not(.survey-results):not(.management-result):not(.share-result):not(.export-result):not(.result-footer):not(.citation-actions):not(.retrieval-scope):not(.report-result):not(.survey-details) {
  padding-left: 18px;
  padding-right: 18px;
}
/* 问卷列表：桌面两列卡片 */
.survey-results {
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
  padding: 6px 18px 18px !important;
  margin: 0 !important;
}
.survey-results article {
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 14px !important;
  border: 1px solid var(--zy-border) !important;
  border-top: 1px solid var(--zy-border) !important;
  border-radius: 12px !important;
  background-color: var(--zy-surface-subtle) !important;
  transition: border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease;
}
.survey-results article:hover {
  border-color: rgba(56, 189, 248, 0.34) !important;
  background-color: #1b2a3d !important;
  transform: translateY(-1px);
}
.survey-results article > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.survey-results strong {
  color: var(--zy-text) !important;
  font-size: 13.5px !important;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.survey-results p {
  margin: 0 !important;
  font-size: 11.5px !important;
  color: var(--zy-text-secondary) !important;
}
.survey-results .el-button {
  flex: none;
  border-radius: 9px !important;
  border: 1px solid var(--zy-border) !important;
  background-color: transparent !important;
  color: var(--zy-text-regular) !important;
}
.survey-results .el-button:hover {
  border-color: var(--zy-accent-cyan) !important;
  color: var(--zy-accent-cyan) !important;
}
/* 结果区通用间距 */
.management-result,
.share-result,
.export-result,
.result-footer,
.citation-actions {
  padding: 0 18px 16px !important;
  margin: 0 !important;
}
.retrieval-scope,
.report-result,
.survey-details {
  padding: 0 18px 12px !important;
  margin: 0 !important;
}
.result-footer {
  border-top: 1px dashed var(--zy-border-light);
  padding-top: 12px !important;
}
/* 空状态 */
.assistant-welcome {
  padding: 9vh 12px 6vh !important;
  max-width: 720px;
  margin: 0 auto;
  color: var(--zy-text-secondary) !important;
}
.welcome-symbol {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 17px;
  margin-bottom: 6px;
  color: #ffffff !important;
  font-size: 24px !important;
  background-color: var(--zy-primary-solid);
  background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0) 70%);
  box-shadow: 0 18px 34px -20px rgba(47, 111, 237, 0.95);
}
.assistant-welcome h3 {
  color: var(--zy-text) !important;
  font-size: 20px !important;
  margin: 14px 0 6px;
}
.assistant-welcome p {
  font-size: 13.5px !important;
  line-height: 1.8 !important;
}
.question-examples {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px !important;
  margin-top: 22px !important;
  max-width: 820px;
  margin-inline: auto;
}
.question-examples .el-button {
  margin: 0 !important;
  justify-content: flex-start;
  height: auto !important;
  padding: 12px 14px !important;
  border-radius: 12px !important;
  border: 1px solid var(--zy-border) !important;
  background-color: var(--zy-surface) !important;
  color: var(--zy-text-regular) !important;
  text-align: left;
  white-space: normal;
  line-height: 1.5;
  box-shadow: var(--zy-shadow-card);
}
.question-examples .el-button:hover {
  border-color: var(--zy-accent-cyan) !important;
  color: var(--zy-accent-cyan) !important;
}
/* 输入区：吸底卡片 */
.assistant-composer {
  position: sticky;
  bottom: 0;
  z-index: 3;
  padding: 10px 12px 8px !important;
  border-radius: 16px !important;
  background-color: var(--zy-surface) !important;
  border: 1px solid var(--zy-border) !important;
  box-shadow: var(--zy-shadow-panel) !important;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}
.assistant-composer:focus-within {
  border-color: rgba(56, 189, 248, 0.45) !important;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25), var(--zy-shadow-panel) !important;
}
.assistant-composer .el-textarea__inner {
  min-height: 56px !important;
  padding: 8px 6px !important;
  border: none !important;
  background-color: transparent !important;
  box-shadow: none !important;
  font-size: 14px !important;
  line-height: 1.7 !important;
  resize: none;
}
.composer-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 2px 2px !important;
  border-top: 1px solid var(--zy-border-light);
}
.composer-footer span {
  font-size: 11.5px !important;
  color: var(--zy-text-secondary) !important;
  line-height: 1.6;
}
.composer-footer .el-button {
  border-radius: 10px !important;
  min-width: 84px;
}
/* 窄屏 */
@media (max-width: 900px) {
  .assistant-page {
    padding: 16px 12px 10px !important;
    gap: 12px !important;
  }
  .chat-toolbar {
    flex-direction: column;
    align-items: stretch !important;
    gap: 12px !important;
  }
  .toolbar-title {
    gap: 10px;
  }
  .toolbar-actions {
    width: 100%;
    justify-content: space-between;
  }
  .toolbar-actions .el-button {
    flex: 1;
  }
  .assistant-mark {
    width: 36px;
    height: 36px;
    font-size: 16px !important;
    border-radius: 11px;
  }
  .question-examples {
    grid-template-columns: 1fr !important;
    max-width: none;
  }
  .assistant-welcome {
    padding: 4vh 6px 2vh !important;
  }
  .assistant-welcome h3 {
    font-size: 18px !important;
  }
  .turn-body {
    max-width: 100%;
  }
  .turn-row--user .turn-body {
    max-width: 92%;
  }
  .survey-results {
    grid-template-columns: 1fr !important;
  }
  .assistant-mark {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    font-size: 18px;
  }
  .toolbar-actions {
    padding: 3px;
  }
  .toolbar-actions .el-button {
    padding: 7px 9px !important;
  }
  .chat-toolbar h2 {
    font-size: 17px !important;
  }
  .answer-meta {
    padding: 10px 14px !important;
  }
  .assistant-answer-text {
    padding: 14px 14px 4px !important;
  }
  .survey-results {
    padding: 4px 14px 14px !important;
  }
  .question-examples {
    grid-template-columns: 1fr !important;
  }
}

/* ===== 对话历史列表 ===== */
.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.conversation-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border-radius: 12px;
  border: 1px solid transparent;
  transition: background-color 0.16s ease, border-color 0.16s ease;
}
.conversation-item:hover {
  background-color: #1b2a3d;
  border-color: var(--zy-border);
}
.conversation-item.is-active {
  background-color: var(--zy-tint);
  border-color: rgba(56, 189, 248, 0.34);
}
.conversation-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: inherit;
}
.conversation-main:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.conversation-title {
  font-size: 13.5px;
  color: var(--zy-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conversation-item.is-active .conversation-title {
  color: var(--zy-accent-cyan);
  font-weight: 600;
}
.conversation-time {
  font-size: 11px;
  color: var(--zy-text-secondary);
}
.conversation-delete {
  flex: none;
  color: var(--zy-text-secondary) !important;
  border-radius: 8px !important;
  padding: 6px !important;
}
.conversation-delete:hover {
  color: var(--zy-danger) !important;
  background-color: rgba(231, 138, 149, 0.14) !important;
}
.conversation-empty {
  margin: 0;
  padding: 20px 0;
  text-align: center;
  color: var(--zy-text-secondary);
  font-size: 12.5px;
}
</style>

<style>
.assistant-source-dialog.el-dialog,.assistant-source-dialog .el-dialog__header,.assistant-source-dialog .el-dialog__body{background:var(--zy-surface,#fff)!important;color:var(--zy-text,#344054)!important}.assistant-source-dialog .el-dialog__title,.assistant-source-dialog .el-dialog__headerbtn .el-dialog__close{color:var(--zy-text,#344054)!important}
</style>
