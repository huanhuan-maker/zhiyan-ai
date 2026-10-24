<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { request } from "./api/client";
const health = ref("检查中");
async function refreshHealth() {
  try {
    const data = await request<{ status: string }>("/actuator/health");
    health.value = data.status === "UP" ? "后端与 MySQL 已连接" : "服务未就绪";
  } catch {
    health.value = "后端或 MySQL 未连接";
  }
}
onMounted(refreshHealth);
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <RouterLink to="/" class="brand"
        ><span class="brand-icon">研</span
        ><span
          >知研 <b>AI</b><small>让每一次提问更有价值</small></span
        ></RouterLink
      >
      <p class="nav-label">调研空间</p>
      <nav>
        <RouterLink to="/">◫ <span>发起者工作台</span></RouterLink
        ><RouterLink to="/statistics">◷ <span>环境诊断</span></RouterLink
        ><RouterLink to="/public">↗ <span>公开答题入口</span></RouterLink
        ><RouterLink to="/login">♙ <span>登录与会话</span></RouterLink>
      </nav>
      <div class="stage-note">
        <span class="dot"></span> 当前开发阶段 <strong>M1</strong>
        <p>核心问卷完整流程<br />AI 功能尚未开放</p>
      </div>
      <div class="sidebar-footer">
        知研 AI · 研究型调研平台<br /><span>Vue 3 / Spring Boot / MySQL 8</span>
      </div>
    </aside>
    <main>
      <header class="topbar">
        <span>工作空间 <span class="divider">/</span> 调研管理</span
        ><button class="health" @click="refreshHealth">
          <span :class="['dot', { offline: !health.includes('已连接') }]"></span
          >{{ health }}
        </button>
      </header>
      <div class="content"><RouterView :key="$route.path" /></div>
      <footer>
        知研 AI <span>有限预算 · 中立追问 · 可追溯证据</span
        ><span>M1 / 固定问卷 · 真实数据</span>
      </footer>
    </main>
  </div>
</template>
