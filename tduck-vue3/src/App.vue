<script setup lang="ts">
import { RouterView, RouterLink, useRoute, useRouter } from "vue-router";
import { watch } from "vue";
import { useAuth } from "./stores/auth";
const auth = useAuth();
const route = useRoute();
const router = useRouter();
watch(
  () => auth.token,
  (token) => {
    if (token) void auth.restore().catch(() => {});
  },
  { immediate: true }
);
function logout() {
  auth.logout();
  void router.replace("/login");
}
</script>
<template>
  <RouterView v-if="route.meta.public" />
  <div v-else class="shell">
    <aside class="sidebar">
      <RouterLink to="/forms" class="brand"
        ><span class="brand-mark">知</span
        ><span
          >知研<span class="brand-en">RESEARCH STUDIO</span></span
        ></RouterLink
      >
      <div class="workspace-label">调研空间 <span>01</span></div>
      <nav aria-label="主导航">
        <RouterLink
          to="/forms"
          :class="{ active: route.path.startsWith('/forms') }"
          ><span class="nav-symbol">▦</span>问卷工作台<span class="nav-arrow"
            >↗</span
          ></RouterLink
        >
        <RouterLink to="/about" :class="{ active: route.path === '/about' }"
          ><span class="nav-symbol">◎</span>版本与迁移</RouterLink
        >
      </nav>
      <div class="sidebar-note">
        <span class="tiny-dot"></span> VUE 3 · 第一阶段
        <p>从每一个问题开始，<br />让研究更进一步。</p>
      </div>
      <div class="profile">
        <span class="avatar">{{ (auth.user?.name || "研").slice(0, 1) }}</span>
        <div>
          <strong>{{ auth.user?.name || "调研用户" }}</strong
          ><small>我的工作空间</small>
        </div>
        <button
          class="logout"
          @click="logout"
          aria-label="退出登录"
          title="退出登录"
        >
          ↪
        </button>
      </div>
    </aside>
    <div class="main-area">
      <header class="topbar">
        <span
          >工作空间 <span class="separator">/</span>
          {{ route.path === "/about" ? "版本与迁移" : "问卷管理" }}</span
        ><span class="topbar-badge"
          >知研 × TDuck <span class="tiny-dot"></span
        ></span>
        <button class="mobile-logout" @click="logout" aria-label="退出登录">退出登录 ↪</button>
      </header>
      <main class="content"><RouterView :key="route.fullPath" /></main>
      <footer>
        知研 · 智能深度调研 <span>以问题为起点，以理解为方向</span>
      </footer>
    </div>
  </div>
</template>
