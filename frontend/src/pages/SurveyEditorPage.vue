<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import QuestionInput from "../components/QuestionInput.vue";
import { mutate, request } from "../api/client";
import { getShares, newDraft, newId, newQuestion, rememberShare, typeNames, type AnswerValue, type Draft, type Question, type QuestionType, type ShareLink, type Survey, type Version } from "../api/surveys";
const route = useRoute(), router = useRouter();
const surveyId = ref<number>(), revision = ref(1), draft = ref<Draft>(newDraft()), versions = ref<Version[]>([]), status = ref("DRAFT");
const busy = ref(false), loading = ref(false), error = ref(""), notice = ref(""), preview = ref(false), shares = ref<ShareLink[]>([]), saved = ref("");
const previewAnswers = ref<Record<string, AnswerValue>>({});
const changed = computed(() => JSON.stringify(draft.value) !== saved.value);
const statusNames: Record<string, string> = { DRAFT: "未发布", OPEN: "回收中", CLOSED: "已关闭" };
function assign(data: Survey) {
  surveyId.value = data.id; revision.value = data.revision; draft.value = data.draft; status.value = data.status;
  versions.value = data.versions ?? versions.value; shares.value = getShares(data.id); saved.value = JSON.stringify(data.draft);
}
async function load() {
  if (!route.params.id) return;
  loading.value = true; error.value = "";
  try { assign(await request<Survey>(`/api/surveys/${route.params.id}`)); }
  catch (e) { error.value = (e as Error).message; }
  finally { loading.value = false; }
}
onMounted(load);
function beforeUnload(e: BeforeUnloadEvent) { if(changed.value && !busy.value) { e.preventDefault(); e.returnValue = ""; } }
window.addEventListener("beforeunload", beforeUnload);
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));
onBeforeRouteLeave(() => !changed.value || busy.value || window.confirm("草稿尚未保存，离开将丢失本次修改。确定离开？"));
function add(type: QuestionType) { if(draft.value.questions.length < 50) draft.value.questions.push(newQuestion(type)); }
function changeType(q: Question) {
  const choice = q.type === "SINGLE" || q.type === "MULTIPLE";
  if(choice && q.options.length < 2) q.options = [{id:newId("o"),label:""},{id:newId("o"),label:""}];
  if(!choice) q.options = [];
  q.min = q.type === "SCALE" ? 1 : null; q.max = q.type === "SCALE" ? 5 : null;
  if(q.type !== "OPEN") q.allowFollowup = false;
}
function move(index: number, direction: number) {
  const other = index + direction;
  if(other < 0 || other >= draft.value.questions.length) return;
  const [q] = draft.value.questions.splice(index, 1); if(q) draft.value.questions.splice(other, 0, q);
}
function validate() {
  if(!draft.value.title.trim() || !draft.value.privacyNotice.trim()) throw new Error("请填写问卷标题和参与说明。");
  if(!draft.value.questions.length) throw new Error("请至少添加一道题。");
  for(const [i,q] of draft.value.questions.entries()) {
    if(!q.text.trim()) throw new Error(`请填写第 ${i+1} 题的题目。`);
    if(q.type === "SINGLE" || q.type === "MULTIPLE") {
      if(q.options.length < 2 || q.options.some(o => !o.label.trim())) throw new Error(`第 ${i+1} 题至少需要两个非空选项。`);
      if(new Set(q.options.map(o=>o.label.trim())).size !== q.options.length) throw new Error(`第 ${i+1} 题选项不能重复。`);
    }
    if(q.type === "SCALE" && (q.min === null || q.max === null || q.max <= q.min || q.max - q.min > 20)) throw new Error(`第 ${i+1} 题量表须递增，跨度不超过 20。`);
  }
}
async function persist() {
  validate();
  const data = surveyId.value
    ? await mutate<Survey>(`/api/surveys/${surveyId.value}`, { draft: draft.value, revision: revision.value }, "PUT")
    : await mutate<Survey>("/api/surveys", draft.value);
  assign(data); return data;
}
async function save() {
  busy.value=true; error.value=""; notice.value="";
  try { await persist(); notice.value="草稿已保存到数据库，刷新后可继续编辑。";
    if(!route.params.id) await router.replace(`/surveys/${surveyId.value}/edit`);
  } catch(e) { error.value=(e as Error).message; } finally {busy.value=false;}
}
async function publish() {
  if(!window.confirm("将当前草稿保存并发布为独立版本。发布版本的核心题将冻结，后续编辑只影响新版本。确认发布？")) return;
  busy.value=true; error.value=""; notice.value="";
  try {
    if(changed.value || !surveyId.value) await persist();
    const result = await mutate<{versionId:number;versionNumber:number;publicPath:string}>(`/api/surveys/${surveyId.value}/publish`,{revision:revision.value});
    const link = {versionId:result.versionId,versionNumber:result.versionNumber,url:new URL(result.publicPath,window.location.origin).href};
    const retained = rememberShare(surveyId.value!,link); shares.value=[link,...shares.value.filter(s=>s.versionId!==link.versionId)];
    status.value="OPEN"; notice.value=`版本 ${result.versionNumber} 已发布。请复制保存分享链接。${retained ? "此浏览器已保留链接。" : "浏览器未允许本地保存，请立即手动复制链接。"}`;
    const data=await request<Survey>(`/api/surveys/${surveyId.value}`); versions.value=data.versions??[];
    // Preserve the one-time link in this view when local storage is unavailable.
    if(!route.params.id && retained) await router.replace(`/surveys/${surveyId.value}/edit`);
  }catch(e){error.value=(e as Error).message;}finally{busy.value=false;}
}
async function closeSurvey() {
  if(!window.confirm("关闭后所有已发布版本都停止接收答案。历史统计会保留。确认关闭？")) return;
  busy.value=true; error.value="";notice.value="";
  try{await mutate(`/api/surveys/${surveyId.value}/close`);status.value="CLOSED";notice.value="调查已关闭，历史答卷仍可查看。";}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}
}
async function copy(url:string) {
  try {await navigator.clipboard.writeText(url);notice.value="分享链接已复制。";}catch {notice.value="自动复制不可用，请选中文本框中的完整链接手动复制。";}
}
function reloadDraft() { if(!changed.value || window.confirm('重新读取会覆盖未保存的草稿，确认继续？')) void load(); }
</script>
<template>
  <div class="eyebrow">SURVEY STUDIO</div>
  <div class="section-heading"><h1>{{ surveyId ? '编辑调查' : '创建一份新调查' }}</h1><RouterLink to="/" class="text-link">← 我的调查</RouterLink></div>
  <p class="intro">先设计清楚的核心问题。发布版本将独立保存，旧链接和答案不会被草稿编辑改变。</p>
  <p v-if="error" class="error" role="alert">{{ error }} <RouterLink to="/login">登录</RouterLink><button v-if="route.params.id" class="text-button" type="button" @click="reloadDraft">重新读取数据库草稿</button></p>
  <p v-if="notice" class="success" role="status">{{ notice }}</p>
  <p v-if="loading" class="card">正在读取问卷…</p>
  <template v-else-if="!route.params.id || surveyId">
    <div class="editor-toolbar card"><div><span class="badge">{{ statusNames[status] }}</span> <span class="muted">修订 {{ revision }} · {{ changed ? '尚未保存' : '已保存' }}</span></div><div class="actions"><button class="secondary" :disabled="busy" @click="preview=!preview">{{ preview ? '返回编辑' : '预览问卷' }}</button><button class="button" :disabled="busy" @click="save">{{ busy ? '处理中…' : '保存草稿' }}</button><button class="button" :disabled="busy" @click="publish">保存并发布</button></div></div>
    <section v-if="shares.length" class="card share-panel"><h2>分享已发布版本</h2><p class="muted">分享链接只在发布时返回。此处显示本浏览器保存的链接；请另外保存以免清理浏览器后丢失。管理登录凭证不会保存在此。</p><div v-for="link in shares" :key="link.versionId" class="share-row"><label>版本 {{ link.versionNumber }}<input :value="link.url" readonly aria-label="完整公开分享链接" @focus="($event.target as HTMLInputElement).select()" /></label><button type="button" class="secondary" @click="copy(link.url)">复制链接</button><a :href="link.url" target="_blank" rel="noopener" class="text-link">打开答题 ↗</a></div></section>
    <section v-if="versions.length" class="card"><div class="section-heading"><h2>发布记录</h2><div class="actions"><RouterLink :to="`/surveys/${surveyId}/results`" class="text-link">查看版本统计 →</RouterLink><button v-if="status==='OPEN'" class="secondary danger" :disabled="busy" @click="closeSurvey">关闭调查</button></div></div><p class="muted">共 {{ versions.length }} 个冻结版本。{{ !shares.length ? '当前浏览器没有保留历史公开链接；服务器只保存链接摘要，不能再次读取原链接。' : '' }}</p><span v-for="v in versions" :key="v.id" class="badge version-badge">V{{v.versionNumber}} · {{v.publishedAt?.replace('T',' ')}}</span></section>
    <section v-if="preview" class="card preview-panel"><span class="pill">草稿预览 · 不保存答案、不计入回收</span><h2>{{draft.title || '未命名调查'}}</h2><p class="preserve-text">{{draft.description}}</p><div class="notice preserve-text">{{draft.privacyNotice}}</div><div v-for="(q,index) in draft.questions" :key="q.id" class="preview-question"><h3>{{index+1}}. {{q.text || '未填写题干'}} <span v-if="q.required" class="required">*</span></h3><QuestionInput :question="q" v-model="previewAnswers[q.id]" /></div></section>
    <form v-else class="editor-form" @submit.prevent="save">
      <fieldset :disabled="busy" class="editor-fieldset">
        <section class="card"><h2>调查基本信息</h2><label>问卷标题 <span class="required">*</span><input v-model="draft.title" required maxlength="150" placeholder="例如：校园图书馆使用体验" /></label><label>调查简介<textarea v-model="draft.description" maxlength="2000" rows="3" placeholder="告诉参与者这次调研想了解什么"></textarea></label><label>参与与数据用途说明 <span class="required">*</span><textarea v-model="draft.privacyNotice" required maxlength="2000" rows="4"></textarea></label><p class="muted">参与者必须主动同意此说明，才能创建匿名填写会话。</p></section>
        <section v-for="(q,index) in draft.questions" :key="q.id" class="card question-editor">
          <div class="section-heading"><h2>问题 {{index+1}}</h2><div class="actions"><button type="button" class="secondary" :disabled="index===0" :aria-label="`上移第${index+1}题`" @click="move(index,-1)">↑</button><button type="button" class="secondary" :disabled="index===draft.questions.length-1" :aria-label="`下移第${index+1}题`" @click="move(index,1)">↓</button><button type="button" class="secondary danger" :disabled="draft.questions.length<=1" @click="draft.questions.splice(index,1)">删除题目</button></div></div>
          <div class="field-grid"><label>题型<select v-model="q.type" @change="changeType(q)"><option v-for="(name,type) in typeNames" :key="type" :value="type">{{name}}</option></select></label><label class="check-label"><input v-model="q.required" type="checkbox" /> 必填题</label></div>
          <label>题目内容<input v-model="q.text" required maxlength="500" placeholder="使用清晰、中立的问法" /></label>
          <div v-if="q.type==='SINGLE' || q.type==='MULTIPLE'" class="option-editor"><label v-for="(option,oi) in q.options" :key="option.id">选项 {{oi+1}}<div class="actions"><input v-model="option.label" required maxlength="200" :placeholder="`选项 ${oi+1} 的文本`" /><button type="button" class="secondary danger" :disabled="q.options.length<=2" :aria-label="`删除选项${oi+1}`" @click="q.options.splice(oi,1)">移除</button></div></label><button type="button" class="secondary" :disabled="q.options.length>=30" @click="q.options.push({id:newId('o'),label:''})">＋ 添加选项</button></div>
          <div v-if="q.type==='SCALE'" class="field-grid"><label>最低分<input v-model.number="q.min" type="number" min="0" max="99" required /></label><label>最高分<input v-model.number="q.max" type="number" min="1" max="100" required /></label><p class="muted">最高分需大于最低分，跨度不超过 20。</p></div>
          <label v-if="q.type==='OPEN'" class="check-label"><input v-model="q.allowFollowup" type="checkbox" /> 预留此题的 AI 追问许可（后续阶段启用，本阶段不会追问）</label>
        </section>
        <section class="card"><h2>继续添加问题</h2><div class="actions"><button v-for="(name,type) in typeNames" :key="type" type="button" class="secondary" :disabled="draft.questions.length>=50" @click="add(type)">＋ {{name}}</button></div><p class="muted">最多 50 题。题目和选项使用稳定标识，调整顺序不会改变答案关联。</p></section>
        <details class="card"><summary>预留追问设置（M1 不调用 AI）</summary><p class="muted">仅保存配置，AI 问卷设计、追问和主题分析尚未实现。</p><div class="field-grid"><label>每道开放题上限<input v-model.number="draft.perQuestionFollowupLimit" type="number" min="0" max="3" /></label><label>全问卷追问上限<input v-model.number="draft.totalFollowupLimit" type="number" min="0" max="10" /></label></div></details>
        <div class="actions bottom-actions"><button type="submit" class="button">保存草稿</button><span class="muted">{{changed?'请保存后再离开。':'当前草稿已与数据库一致。'}}</span></div>
      </fieldset>
    </form>
  </template>
</template>
