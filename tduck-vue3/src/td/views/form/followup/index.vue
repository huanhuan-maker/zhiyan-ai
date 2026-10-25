<template>
 <main class="followup-settings" v-loading="loading">
  <el-card shadow="never">
   <template #header><strong>可选追问设置</strong></template>
   <el-alert type="info" :closable="false" title="设置随问卷发布为版本快照。追问只补充受访者自己的回答，不改动已发布核心题；受访者可拒绝或跳过。"/>
   <el-alert v-if="locked" type="warning" :closable="false" title="问卷正在收集，追问设置已冻结。需要修改时，请先停止收集，再编辑并发布新版本。"/>
   <el-form label-position="top" :disabled="locked" class="policy-form">
    <el-form-item label="启用可选追问"><el-switch v-model="policy.enabled"/></el-form-item>
    <el-form-item label="调查目标"><el-input v-model="policy.goal" type="textarea" :rows="2" maxlength="500" placeholder="说明本问卷希望了解什么，作为相关性判断依据"/></el-form-item>
    <el-form-item label="追问策略"><el-radio-group v-model="policy.mode"><el-radio value="RULE" label="RULE">本地语义规则（可重复验证，非模型）</el-radio><el-radio value="LLM" label="LLM">模型辅助决策（失败自动跳过）</el-radio></el-radio-group></el-form-item>
    <div class="budget-fields">
     <el-form-item label="全卷最多追问次数"><el-input-number v-model="policy.totalBudget" :min="0" :max="10"/></el-form-item>
     <el-form-item label="每道开放题最多次数"><el-input-number v-model="policy.perQuestionBudget" :min="0" :max="1"/></el-form-item>
     <el-form-item label="追问时间上限（秒）"><el-input-number v-model="policy.timeBudgetSeconds" :min="60" :max="3600" :step="60"/></el-form-item>
    </div>
    <p class="help">默认每道开放题最多1次、全卷最多3次，为产品默认值。跳过、拒绝或重复请求不会额外扣减；只有实际给出的追问占用次数。</p>
    <el-form-item label="允许追问的开放题">
     <el-checkbox-group v-model="policy.allowedQuestionIds"><el-checkbox v-for="q in questions" :key="q.formItemId" :label="q.formItemId" :value="q.formItemId">{{plain(q.label)}}</el-checkbox></el-checkbox-group>
     <p v-if="!questions.length">请先在编辑器添加开放题并保存。</p>
    </el-form-item>
    <el-button type="primary" :loading="saving" @click="save">保存追问设置</el-button>
   </el-form>
  </el-card>
  <el-card shadow="never" class="records-card">
   <template #header><div class="records-header"><strong>追问决策记录</strong><el-select v-model="selectedVersion" placeholder="发布版本" @change="loadRecords"><el-option v-for="v in versions" :key="v.versionNo" :value="v.versionNo" :label="'V'+v.versionNo"/></el-select><el-button @click="loadRecords">刷新记录</el-button></div></template>
   <p class="help">原回答、追问和回应独立保存。记录用于核查动作与理由，不将有条件追问的频次解释为全体比例。未报告的模型费用显示为未知。</p>
   <el-empty v-if="!records.length" description="此版本暂无追问会话"/>
   <details v-for="s in records" :key="s.id" class="session-record">
    <summary>匿名会话 {{s.id.slice(0,8)}} · {{s.consent?'已同意':'未同意/已撤回'}} · 已用 {{s.used}} 次 · {{s.status}}</summary>
    <article v-for="d in s.decisions" :key="d.id" class="decision-record">
     <strong>源回答 #{{d.sourceAnswerId}} · {{d.action}} / {{d.state}}</strong>
     <p>原回答：{{s.sources.find(x=>x.id===d.sourceAnswerId)?.answerText}}</p>
     <p>理由：{{d.reasonCode}} · 当时剩余 {{d.budgetRemaining}} 次 · {{d.policyVersion}}</p>
     <p>策略/模型：{{d.provider}} · {{d.model}} · {{d.elapsedMs}}ms · 费用{{d.estimatedCostMicros==null?'未知（服务未报告）':d.estimatedCostMicros+'微单位'}}</p>
     <p v-if="d.evidenceQuote">依据原文：{{d.evidenceQuote}}</p>
     <p v-if="d.questionText">中立追问：{{d.questionText}}</p><p v-if="d.responseText">补充回应：{{d.responseText}}</p>
     <small>答卷关联：{{s.answerDataId?'#'+s.answerDataId:'尚未提交核心问卷'}}</small>
    </article>
    <details><summary>状态转移记录</summary><p v-for="e in s.events" :key="e.id">{{e.fromState}} → {{e.toState}} · {{e.reasonCode}} · 源回答 {{e.sourceAnswerId??'—'}}</p></details>
   </details>
  </el-card>
 </main>
</template>
<script setup>
import {ref,reactive,computed,onMounted} from 'vue'
import {useRoute} from 'vue-router'
import {ElMessage} from 'element-plus'
import api from '@/api'
const key=String(useRoute().query.key||''),loading=ref(false),saving=ref(false),status=ref(1),questions=ref([]),versions=ref([]),selectedVersion=ref(),records=ref([])
const policy=reactive({enabled:false,goal:'',mode:'RULE',totalBudget:3,perQuestionBudget:1,timeBudgetSeconds:600,allowedQuestionIds:[]})
const locked=computed(()=>Number(status.value)===2),plain=v=>String(v||'').replace(/<[^>]*>/g,'')
async function loadRecords(){if(!selectedVersion.value)return;const r=await api.get('/user/form/followup/records',{params:{formKey:key,versionNo:selectedVersion.value}});records.value=r.data||[]}
async function save(){saving.value=true;try{await api.post('/user/form/followup/config',{...policy,formKey:key});ElMessage.success('追问设置已保存；发布后对新版本生效')}finally{saving.value=false}}
onMounted(async()=>{loading.value=true;try{const [p,f,q,v]=await Promise.all([api.get('/user/form/followup/config',{params:{formKey:key}}),api.get('/user/form/'+key),api.get('/user/form/item/list',{params:{key}}),api.get('/user/form/versions',{params:{key}})]);Object.assign(policy,p.data);status.value=f.data.status;questions.value=q.data.filter(q=>q.type==='TEXTAREA');versions.value=v.data;selectedVersion.value=v.data[0]?.versionNo;await loadRecords()}finally{loading.value=false}})
</script>
<style scoped>
.followup-settings{height:100%;overflow-y:auto;box-sizing:border-box;padding:20px;max-width:1100px;margin:auto}.policy-form{margin-top:18px}.budget-fields{display:flex;flex-wrap:wrap;gap:24px}.help{color:#64748b;font-size:13px;line-height:1.8}.el-checkbox-group{display:flex;flex-direction:column}.records-card{margin-top:20px}.records-header{display:flex;align-items:center;flex-wrap:wrap;gap:12px}.records-header .el-select{width:120px}.session-record{padding:12px;border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere}.session-record summary{cursor:pointer}.decision-record{padding:12px;background:#f8fafc;margin-top:12px}.decision-record p{margin:6px 0;white-space:pre-wrap}.followup-settings :deep(.el-input-number){width:180px}.followup-settings :deep(.el-input-number .el-input__wrapper){padding:0 36px}.followup-settings :deep(.el-input-number .el-input__inner){padding:0;width:100%;min-width:0;box-sizing:border-box}
</style>
