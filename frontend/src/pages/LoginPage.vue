<script setup lang="ts">
import { onMounted, ref } from "vue";
import { login, logout, register, request, type User } from "../api/client";
const username = ref(""), password = ref(""), user = ref<User>(), error = ref(""), notice = ref(""), busy = ref(false), registering = ref(false);
onMounted(async () => { try { user.value = await request("/api/auth/me"); } catch { /* anonymous */ } });
async function submit() {
  busy.value = true; error.value = ""; notice.value = "";
  try {
    if (registering.value) { await register(username.value, password.value); notice.value = "注册成功。"; }
    await login(username.value, password.value); password.value = "";
    user.value = await request("/api/auth/me");
  } catch (e) { error.value = (e as Error).message; }
  finally { busy.value = false; }
}
async function signout() {
  busy.value = true; error.value = "";
  try { await logout(); user.value = undefined; notice.value = "已退出登录。"; }
  catch (e) { error.value = (e as Error).message; }
  finally { busy.value = false; }
}
</script>
<template>
  <div class="eyebrow">RESEARCHER ACCESS</div>
  <h1>{{ registering ? "创建调研发起者账户" : "登录调研空间" }}</h1>
  <p class="intro">你的调查、发布版本和回收结果，仅对你的账户开放。</p>
  <section class="card login-card">
    <template v-if="user">
      <span class="pill">会话有效</span><h2>{{ user.username }}，你已登录。</h2>
      <p>角色：{{ user.role }}。长时间无操作后需重新登录。</p>
      <div class="actions"><RouterLink to="/" class="button">进入我的调查 →</RouterLink><button class="secondary" :disabled="busy" @click="signout">退出登录</button></div>
    </template>
    <template v-else>
      <div class="actions tabs"><button type="button" :class="registering ? 'secondary' : 'button'" @click="registering = false; error = ''">登录</button><button type="button" :class="registering ? 'button' : 'secondary'" @click="registering = true; error = ''">注册</button></div>
      <form @submit.prevent="submit">
        <label>用户名<input v-model="username" autocomplete="username" required minlength="3" maxlength="60" pattern="[a-zA-Z0-9_-]{3,60}" placeholder="3–60 位字母、数字、下划线或短横线" /></label>
        <label>密码<input v-model="password" type="password" :autocomplete="registering ? 'new-password' : 'current-password'" required :minlength="registering ? 12 : undefined" maxlength="72" placeholder="注册密码需 12–72 个字符" /></label>
        <button class="button" :disabled="busy">{{ busy ? "处理中…" : registering ? "注册并登录 →" : "登录工作空间 →" }}</button>
      </form>
    </template>
    <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="notice" role="status" class="success">{{ notice }}</p>
    <p class="muted">登录会话由服务端 Cookie 管理，不在浏览器本地保存密码或管理登录令牌。</p>
  </section>
</template>
