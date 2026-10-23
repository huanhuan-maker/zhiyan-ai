<script setup lang="ts">
import { onMounted, ref } from "vue";
import ConnectionChart from "../components/ConnectionChart.vue";
import { createCheck, request, type SystemCheck } from "../api/client";
const rows = ref<SystemCheck[]>([]),
  count = ref<number>(),
  message = ref("M0 环境联通验证"),
  error = ref(""),
  busy = ref(false),
  loaded = ref(false);
async function load() {
  loaded.value = false;
  const [list, summary] = await Promise.all([
    request<SystemCheck[]>("/api/system-checks"),
    request<{ count: number }>("/api/system-checks/summary"),
  ]);
  rows.value = list;
  count.value = summary.count;
  loaded.value = true;
}
async function refresh() {
  busy.value = true;
  error.value = "";
  try {
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function insert() {
  busy.value = true;
  error.value = "";
  try {
    await createCheck(message.value);
    await load();
  } catch (e) {
    error.value = (e as Error).message;
    loaded.value = false;
  } finally {
    busy.value = false;
  }
}
onMounted(refresh);
</script>
<template>
  <div class="eyebrow">ENVIRONMENT DIAGNOSTICS</div>
  <h1>让连接，真实发生。</h1>
  <p class="intro">
    开发环境联通演示 · 图表只展示诊断记录数量，不代表任何调查结果。
  </p>
  <div class="notice compact">
    <strong>真实数据链</strong
    ><span>Vue 3 → Spring Boot → MyBatis-Plus → MySQL 8</span>
  </div>
  <p v-if="error" role="alert" class="error">
    {{ error }}。<RouterLink to="/login">前往登录</RouterLink>
  </p>
  <section class="card">
    <div class="section-heading">
      <h2>写入一条诊断记录</h2>
      <button class="secondary" :disabled="busy" @click="refresh">
        刷新数据库
      </button>
    </div>
    <form class="inline-form" @submit.prevent="insert">
      <input
        v-model="message"
        aria-label="诊断消息"
        required
        maxlength="200"
        placeholder="输入 1–200 字的诊断消息"
      /><button class="button" :disabled="busy || !message.trim()">
        {{ busy ? "处理中…" : "写入并读取 →" }}
      </button>
    </form>
    <p class="muted">
      提交后刷新或重启服务，记录应继续存在。仅保存非敏感的测试文本。
    </p>
  </section>
  <section class="card chart-card">
    <div class="section-heading">
      <h2>开发环境联通演示</h2>
      <span class="badge">Apache ECharts</span>
    </div>
    <template v-if="loaded && count !== undefined"
      ><p>
        MySQL 当前共
        <strong>{{ count }}</strong>
        条诊断记录，来源：/api/system-checks/summary
      </p>
      <ConnectionChart :count="count"
    /></template>
    <p v-else class="empty-state">
      {{ busy ? "正在读取 MySQL…" : "尚未读取到数据，请登录并检查服务连接。" }}
    </p>
  </section>
  <section class="card">
    <h2>最近 20 条诊断记录</h2>
    <div v-if="loaded" class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>消息</th>
            <th>数据库写入时间（上海）</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.id }}</td>
            <td>{{ row.message }}</td>
            <td>{{ row.createdAt.replace("T", " ") }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="3">真实空状态：暂无诊断记录。</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="muted">数据未加载，不显示缓存结果。</p>
  </section>
</template>
