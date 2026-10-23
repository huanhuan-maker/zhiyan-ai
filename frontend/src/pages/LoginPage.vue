<script setup lang="ts">
import { onMounted, ref } from "vue";
import { login, logout, request, type User } from "../api/client";
const username = ref("researcher"),
  password = ref(""),
  user = ref<User>(),
  error = ref(""),
  busy = ref(false);
onMounted(async () => {
  try {
    user.value = await request("/api/auth/me");
  } catch {
    /* anonymous is expected */
  }
});
async function submit() {
  busy.value = true;
  error.value = "";
  try {
    await login(username.value, password.value);
    password.value = "";
    user.value = await request("/api/auth/me");
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function signout() {
  busy.value = true;
  error.value = "";
  try {
    await logout();
    user.value = undefined;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="eyebrow">RESEARCHER ACCESS</div>
  <h1>登录调研空间</h1>
  <p class="intro">M0 最小会话框架 · 使用本地 .env 中配置的发起者账户。</p>
  <section class="card login-card">
    <template v-if="user"
      ><span class="pill">会话有效</span>
      <h2>{{ user.username }}，你已登录。</h2>
      <p>角色：{{ user.role }}。会话 30 分钟无操作过期。</p>
      <RouterLink to="/statistics" class="button">打开数据库诊断 →</RouterLink
      ><button class="secondary" :disabled="busy" @click="signout">
        退出登录
      </button></template
    >
    <form v-else @submit.prevent="submit">
      <label
        >用户名<input
          v-model="username"
          autocomplete="username"
          required
          maxlength="100" /></label
      ><label
        >密码<input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required /></label
      ><button class="button" :disabled="busy">
        {{ busy ? "正在登录…" : "登录工作空间 →" }}
      </button>
    </form>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p class="muted">
      当前账户由服务端环境变量配置，不提供注册；账户入库及完整用户管理留待 M1。
    </p>
  </section>
</template>
