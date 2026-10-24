<script setup lang="ts">
import { onMounted, ref } from "vue";
import { request } from "../api/client";
import { type Survey } from "../api/surveys";
const surveys = ref<Survey[]>([]), busy = ref(false), loaded = ref(false), error = ref("");
const statusNames: Record<string, string> = { DRAFT: "草稿", OPEN: "回收中", CLOSED: "已关闭" };
async function load() {
  busy.value = true; error.value = "";
  try { surveys.value = await request("/api/surveys"); loaded.value = true; }
  catch (e) { error.value = (e as Error).message; loaded.value = false; surveys.value = []; }
  finally { busy.value = false; }
}
onMounted(load);
</script>
<template>
  <div class="eyebrow">RESEARCH WORKSPACE</div><h1>从一个好问题开始。</h1>
  <p class="intro">创建固定问卷，保留每次发布的独立版本，让回收结果有据可查。</p>
  <section class="hero"><div><span class="pill">M1 · 核心问卷流程</span><h2>把好奇，变成有依据的洞察。</h2><p>手工建卷 · 公开填写 · 保存恢复 · 真实统计<br />本阶段不启用 AI 生成、追问或主题分析。</p><RouterLink to="/surveys/new" class="button">新建调查 <span>＋</span></RouterLink></div><div class="hero-mark" aria-hidden="true"><div class="orbit"></div><span>问</span><i>探索</i><b>证据</b></div></section>
  <div class="section-heading"><h2>我的调查 <span v-if="loaded" class="muted">{{ surveys.length }} 项</span></h2><button class="secondary" :disabled="busy" @click="load">{{ busy ? "读取中…" : "刷新列表" }}</button></div>
  <p v-if="error" class="error" role="alert">{{ error }}。<RouterLink to="/login">前往登录 / 注册 →</RouterLink></p>
  <section v-if="loaded && !surveys.length" class="card empty-state"><h2>还没有调查</h2><p>创建第一份问卷。保存、发布及提交都会使用真实数据库。</p><RouterLink to="/surveys/new" class="button">创建我的第一份调查 →</RouterLink></section>
  <div v-if="loaded" class="survey-grid">
    <article v-for="survey in surveys" :key="survey.id" class="card survey-card">
      <div class="section-heading"><span class="badge">{{ statusNames[survey.status] ?? survey.status }}</span><small class="muted">草稿修订 {{ survey.revision }}</small></div>
      <h2>{{ survey.draft.title }}</h2><p class="clamp-text muted">{{ survey.draft.description || "暂无调查简介" }}</p>
      <p class="muted">{{ survey.draft.questions.length }} 道题 · 更新于 {{ survey.updatedAt?.replace('T', ' ') }}</p>
      <div class="actions"><RouterLink :to="`/surveys/${survey.id}/edit`" class="button">编辑与发布 →</RouterLink><RouterLink v-if="survey.latestVersionId" :to="`/surveys/${survey.id}/results`" class="secondary">查看统计</RouterLink></div>
    </article>
  </div>
</template>
