<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ResultsChart from "../components/ResultsChart.vue";
import { request } from "../api/client";
import { type Results, type Survey, type Version, typeNames } from "../api/surveys";
const route=useRoute(),router=useRouter();
const surveyId=String(route.params.id),versions=ref<Version[]>([]),selected=ref<number>(),result=ref<Results>(),busy=ref(false),error=ref("");
async function refresh(){
  if(!selected.value)return;busy.value=true;error.value="";result.value=undefined;
  try{result.value=await request<Results>(`/api/surveys/${surveyId}/results?versionId=${selected.value}`);await router.replace({query:{versionId:String(selected.value)}});}
  catch(e){error.value=(e as Error).message;}finally{busy.value=false;}
}
onMounted(async()=>{
  busy.value=true;
  try{
    const detail=await request<Survey>(`/api/surveys/${surveyId}`);versions.value=detail.versions??[];
    const query=Number(route.query.versionId);selected.value=versions.value.some(v=>v.id===query)?query:versions.value[0]?.id;
    if(selected.value)await refresh();
  }catch(e){error.value=(e as Error).message;}finally{busy.value=false;}
});
</script>
<template>
  <div class="eyebrow">TRUSTWORTHY RESULTS</div><div class="section-heading"><h1>每一个数字，都有来处。</h1><RouterLink :to="`/surveys/${surveyId}/edit`" class="text-link">← 编辑与发布</RouterLink></div>
  <p class="intro">统计仅包含已成功提交的答卷，按独立发布版本计算；进行中的填写不会计入回收。</p>
  <section class="card"><div class="section-heading"><label class="version-select">发布版本<select v-model.number="selected" :disabled="busy||!versions.length" @change="refresh"><option v-for="v in versions" :key="v.id" :value="v.id">版本 V{{v.versionNumber}} · {{v.publishedAt?.replace('T',' ')}}</option></select></label><button class="secondary" :disabled="busy||!selected" @click="refresh">{{busy?'读取数据库中…':'刷新统计'}}</button></div><p class="muted">选择相同版本，才能比较同一套核心题。数字由服务端读取真实答卷计算，图表与下表使用同一接口数据。</p></section>
  <p v-if="error" class="error" role="alert">{{error}} <RouterLink to="/login">前往登录</RouterLink></p>
  <section v-if="!busy&&!error&&!versions.length" class="card empty-state"><h2>调查尚未发布</h2><p>发布一个版本后，即可查看该版本的回收与逐题统计。</p></section>
  <template v-if="result">
    <section class="card result-summary"><div><span class="pill">V{{result.versionNumber}} · 版本 ID {{result.versionId}}</span><h2>{{result.title}}</h2></div><div class="metric"><strong>{{result.completedCount}}</strong><span>已提交答卷</span></div></section>
    <p v-if="!result.completedCount" class="notice">真实空状态：此版本还没有成功提交的答卷。下方人数为 0，不生成演示结果。</p>
    <section v-for="(q,index) in result.questions" :key="`${result.versionId}:${q.questionId}`" class="card question-result">
      <div class="section-heading"><h2>{{index+1}}. {{q.text}}</h2><span class="badge">{{typeNames[q.type]}}</span></div>
      <div class="denominators"><span>已提交总样本 <b>{{q.total}}</b></span><span>本题有效分母 <b>{{q.denominator}}</b></span><span>缺失 <b>{{q.missing}}</b></span></div>
      <p v-if="q.type==='MULTIPLE'" class="notice compact">多选比例 = 选择该项的有效人数 / 本题有效作答人数；各选项比例之和可能超过 100%。</p>
      <p v-if="q.type==='SCALE'" class="muted">有效评分均值：{{q.average == null ? '暂无有效评分' : q.average.toFixed(2)}}。均值由后端计算。</p>
      <template v-if="q.type!=='OPEN'">
        <ResultsChart :result="q" />
        <div class="table-wrap"><table><thead><tr><th>选项 / 分值</th><th>人数（分子）</th><th>有效分母</th><th>比例</th></tr></thead><tbody><tr v-for="option in q.options" :key="option.id"><td>{{option.label}}</td><td>{{option.numerator}}</td><td>{{option.denominator}}</td><td>{{option.denominator ? `${option.percentage.toFixed(1)}%` : '—（无有效回答）'}}</td></tr></tbody></table></div>
      </template>
      <template v-else><p class="muted">开放题原文，未进行 AI 主题归纳。匿名会话标识仅用于结果核对。</p><article v-for="answer in q.responses" :key="answer.answerId" class="quote"><small class="muted">匿名会话 {{answer.anonymousSessionId}} · 答案 {{answer.answerId}}</small><p class="preserve-text">{{answer.text}}</p></article><p v-if="!q.responses?.length" class="muted">暂无有效开放回答。</p></template>
    </section>
  </template>
</template>
