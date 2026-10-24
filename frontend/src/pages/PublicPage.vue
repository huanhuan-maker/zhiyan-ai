<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import QuestionInput from "../components/QuestionInput.vue";
import { mutate, request } from "../api/client";
import { type AnswerValue, type PublicSurvey, type Session, typeNames } from "../api/surveys";
const route = useRoute();
const token = String(route.params.token ?? ""), storageKey = `zhiyan:session:${token}`;
const data = ref<PublicSurvey>(), answers = ref<Record<string, AnswerValue>>({}), consent = ref(false), aiConsent = ref(false);
const sessionToken = ref(""), status = ref(""), busy = ref(false), loading = ref(false), error = ref(""), notice = ref(""), saved = ref("{}"), restoreFailed = ref(false), stopped = ref(false);
const dirty = computed(() => status.value === "IN_PROGRESS" && JSON.stringify(answers.value) !== saved.value);
const answeredCount = computed(() => data.value?.survey.questions.filter(q=>!isMissing(answers.value[q.id])).length ?? 0);
function isMissing(value: AnswerValue | undefined) { return value === undefined || value === null || typeof value === 'string' && !value.trim() || Array.isArray(value) && !value.length; }
function storedToken() {try{return sessionStorage.getItem(storageKey)??"";}catch{return "";}}
function rememberSession(value:string) {try{sessionStorage.setItem(storageKey,value);return true;}catch{return false;}}
async function restore(value:string) {
  const restored=await request<Session>(`/api/public/sessions/${value}`);
  if(data.value && data.value.versionId !== restored.versionId) throw new Error("填写会话与分享版本不一致，请重新开始。");
  data.value=restored; answers.value=restored.answers; aiConsent.value=restored.aiConsent; sessionToken.value=value;
  status.value=restored.status; saved.value=JSON.stringify(answers.value); consent.value=true; restoreFailed.value=false;
  stopped.value=restored.collecting===false;
  if(restored.collecting===false)
    notice.value=restored.status==='SUBMITTED'?'这份答卷已提交成功，无需重复提交。':'此调查或该发布版本已停止收集：以下内容仅供查看已保存的答案，不能再保存或提交。';
  else
    notice.value=restored.status==='SUBMITTED'?'这份答卷已提交成功，无需重复提交。':'已从数据库恢复保存的答案。尚未点击保存的内容不会跨刷新恢复。';
}
async function load() {
  if(!token) return;
  loading.value=true; error.value="";
  // The public token may be dead (rotated) or closed; a saved session can still restore, so never skip it.
  let surveyError="";
  try { data.value=await request<PublicSurvey>(`/api/public/surveys/${token}`); }
  catch(e){ surveyError=(e as Error).message; data.value=undefined; }
  const previous=storedToken();
  if(previous) {
    try{await restore(previous);}
    catch(e){
      restoreFailed.value=true;
      error.value=surveyError
        ? `分享链接已失效（${surveyError}）。此前保存的填写会话也未能恢复：${(e as Error).message} 如仍在填写中，请保留原标签页；如需重新参与，请向发起者索取新链接。`
        : `恢复填写会话失败：${(e as Error).message}`;
    }
  } else if(surveyError) {
    error.value=`${surveyError} 链接可能无效、调查已关闭，或已被发起者轮换（旧链接立即失效）。如需参与，请向发起者索取最新链接。`;
  }
  loading.value=false;
}
onMounted(load);
function beforeUnload(e:BeforeUnloadEvent){if(dirty.value&&!busy.value){e.preventDefault();e.returnValue="";}}
window.addEventListener('beforeunload',beforeUnload);onBeforeUnmount(()=>window.removeEventListener('beforeunload',beforeUnload));
onBeforeRouteLeave(()=>!dirty.value||busy.value||window.confirm('还有未保存的答案，离开后将丢失这些修改。确认离开？'));
async function retryRestore(){busy.value=true;error.value="";try{await restore(storedToken());}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
function restart(){if(!window.confirm('重新开始会创建一份新的匿名填写会话，原会话不会被删除。确认继续？'))return;try{sessionStorage.removeItem(storageKey);}catch{/* unavailable storage */}restoreFailed.value=false;stopped.value=false;sessionToken.value="";status.value="";answers.value={};consent.value=false;notice.value="";error.value="";}
async function start() {
  busy.value=true;error.value="";notice.value="";
  try {
    const result=await mutate<{sessionToken:string}>(`/api/public/surveys/${token}/sessions`,{consent:consent.value,aiConsent:aiConsent.value});
    sessionToken.value=result.sessionToken;status.value="IN_PROGRESS";saved.value=JSON.stringify(answers.value);
    notice.value=rememberSession(result.sessionToken)?'填写会话已建立。请在本标签页填写，并点击“保存进度”后再刷新。':'浏览器禁止会话存储，刷新将无法恢复本次填写。请保持此页并完成提交。';
  }catch(e){error.value=(e as Error).message;}finally{busy.value=false;}
}
function normalizedAnswers(){return Object.fromEntries((data.value?.survey.questions??[]).map(q=>[q.id,isMissing(answers.value[q.id])?null:answers.value[q.id]]));}
async function saveProgress() {
  if(!data.value||stopped.value)return;busy.value=true;error.value="";notice.value="";
  const snapshot=JSON.parse(JSON.stringify(answers.value)) as Record<string,AnswerValue>;
  try{
    for(const q of data.value.survey.questions){const value=snapshot[q.id];await mutate(`/api/public/sessions/${sessionToken.value}/answers`,{questionId:q.id,value:isMissing(value)?'':value});}
    saved.value=JSON.stringify(snapshot);notice.value='全部答案已保存到数据库。现在刷新本标签页可恢复，尚未计入回收统计。';
  }catch(e){error.value=`保存未完成：${(e as Error).message}。请保留此页并重试；成功保存的题目仍会保留。`;}finally{busy.value=false;}
}
async function complete(){
  if(!data.value||stopped.value)return;busy.value=true;error.value="";notice.value="";
  try{
    for(const [index,q] of data.value.survey.questions.entries()){if(q.required&&isMissing(answers.value[q.id]))throw new Error(`请回答第 ${index+1} 道必填题：${q.text}`);}
    const result=await mutate<{status:string}>(`/api/public/sessions/${sessionToken.value}/complete`,{answers:normalizedAnswers()});
    status.value=result.status;saved.value=JSON.stringify(answers.value);notice.value='答卷已成功提交并保存。感谢参与！';
  }catch(e){error.value=(e as Error).message;}finally{busy.value=false;}
}
</script>
<template>
  <div class="eyebrow">PUBLIC SURVEY</div>
  <template v-if="!token"><h1>公开答题入口</h1><section class="card empty-state"><span class="empty-icon">↗</span><h2>通过分享链接参与调查</h2><p>请打开发起者提供的完整问卷链接。每个链接对应一份冻结的发布版本。</p><RouterLink to="/" class="text-link">返回工作台 →</RouterLink></section></template>
  <template v-else>
    <p v-if="loading" class="card">正在读取问卷…</p>
    <p v-if="error" class="error" role="alert">{{error}}</p><p v-if="notice" class="success" role="status">{{notice}}</p>
    <section v-if="!loading&&!data" class="card empty-state"><h2>当前问卷无法填写</h2><p>链接可能无效、调查已关闭、链接已被发起者轮换，或服务暂不可用。可重试读取，或联系问卷发起者索取最新链接。</p><button class="secondary" @click="load">重试读取</button></section>
    <template v-if="data&&!loading">
      <section class="card survey-intro"><span class="pill">发布版本 V{{data.versionNumber}} · 匿名填写</span><h1>{{data.survey.title}}</h1><p class="preserve-text">{{data.survey.description}}</p><p class="muted">共 {{data.survey.questions.length}} 道题。带 * 为必填，其他题可跳过。本阶段不调用 AI。</p></section>
      <section v-if="restoreFailed" class="card"><h2>请选择如何继续</h2><p>已保存的会话暂时未恢复。重试不会创建新答卷；重新开始会创建另一份会话。</p><div class="actions"><button class="button" :disabled="busy" @click="retryRestore">重试恢复</button><button class="secondary" :disabled="busy" @click="restart">重新开始</button></div></section>
      <form v-else-if="!sessionToken" class="card" @submit.prevent="start"><h2>参与与数据用途说明</h2><p class="preserve-text consent-notice">{{data.survey.privacyNotice}}</p><label class="check-label"><input v-model="consent" type="checkbox" required /> 我已阅读说明，自愿参与本次调查</label><label class="check-label"><input v-model="aiConsent" type="checkbox" /> 我愿意参与 AI 追问（可拒绝，不影响普通答题）</label><p class="muted">M1 阶段只记录你的选择，不会发送回答至模型，也不会触发 AI 追问。</p><button class="button" :disabled="busy||!consent">{{busy?'建立会话中…':'同意并开始填写 →'}}</button></form>
      <section v-else-if="status==='SUBMITTED'" class="card empty-state"><span class="empty-icon">✓</span><h2>提交成功，感谢你的分享。</h2><p>这份答卷已提交到数据库。刷新仍会显示提交成功，不会新增回收次数。</p><p class="muted">发布版本 V{{data.versionNumber}} · 为保证数据完整，已提交答案不能继续修改。</p></section>
      <form v-else @submit.prevent="complete">
        <div class="answer-progress"><span>已填写 {{answeredCount}} / {{data.survey.questions.length}} 题</span><span>{{dirty?'有未保存的修改':'当前进度已保存'}} · AI {{aiConsent?'已同意，但本阶段不启用':'已拒绝'}}</span></div>
        <fieldset :disabled="busy" class="editor-fieldset"><section v-for="(q,index) in data.survey.questions" :key="q.id" class="card respondent-question"><div class="section-heading"><span class="badge">{{typeNames[q.type]}}</span><span class="muted">{{q.required?'必填':'可跳过'}}</span></div><h2>{{index+1}}. {{q.text}} <span v-if="q.required" class="required">*</span></h2><QuestionInput :question="q" v-model="answers[q.id]" /></section></fieldset>
        <div class="card submit-panel"><p v-if="stopped" class="error" role="alert">此调查或该发布版本已停止收集，不能再保存或提交；以上为已保存内容的只读视图。</p><p v-else class="muted">点击保存后才会跨刷新恢复。最终提交前请检查答案，提交后不可修改。</p><div class="actions"><button type="button" class="secondary" :disabled="busy||stopped" @click="saveProgress">{{busy?'处理中…':'保存进度'}}</button><button type="submit" class="button" :disabled="busy||stopped">{{busy?'处理中…':'确认提交答卷 →'}}</button></div></div>
      </form>
    </template>
  </template>
</template>
