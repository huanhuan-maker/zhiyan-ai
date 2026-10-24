<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "../stores/auth";
import { errorMessage } from "../api/client";
import { safeRedirect } from "../router";
const route = useRoute();
const router = useRouter();
const auth = useAuth();
const account = ref("");
const password = ref("");
const busy = ref(false);
const error = ref("");
async function submit() {
  if (busy.value) return;
  error.value = "";
  if (!account.value.trim() || !password.value) {
    error.value = "请填写账号和密码";
    return;
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.value.trim()) &&
    !/^1\d{10}$/.test(account.value.trim())
  ) {
    error.value = "请输入邮箱或手机号";
    return;
  }
  busy.value = true;
  try {
    await auth.login(account.value.trim(), password.value);
    if (auth.token) await router.replace(safeRedirect(route.query.redirect));
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    password.value = "";
    busy.value = false;
  }
}
</script>
<template>
  <div class="login-page">
    <section class="login-story">
      <div class="brand">
        <span class="brand-mark">知</span
        ><span>知研<span class="brand-en">RESEARCH STUDIO</span></span>
      </div>
      <div class="story-copy">
        <div class="eyebrow">GOOD RESEARCH STARTS WITH A QUESTION</div>
        <h1>每一个好问题，<br />都通向更深的理解<span>。</span></h1>
        <p>整理问卷，连接真实的声音。<br />在知研，开启下一次有意义的探索。</p>
      </div>
      <div class="story-art" aria-hidden="true">
        <div class="art-orbit"></div>
        <div class="art-card">
          <span>RESEARCH NOTES</span><i></i><i></i><i></i><b>Q.</b>
          <div class="art-bars">
            <em></em><em></em><em></em><em></em><em></em>
          </div>
        </div>
        <span class="art-star">✳</span>
      </div>
      <div class="story-footer">知研 × TDuck <span>让调研，回归理解</span></div>
    </section>
    <section class="login-panel">
      <div class="login-box">
        <span class="eyebrow teal">YOUR RESEARCH WORKSPACE</span>
        <h2>欢迎回来</h2>
        <p class="muted">登录你的账号，继续探索与发现。</p>
        <el-alert
          v-if="route.query.reason === 'expired'"
          title="登录已过期，请重新登录"
          type="warning"
          :closable="false"
          show-icon
        />
        <form @submit.prevent="submit" class="login-form">
          <label for="account">邮箱 / 手机号</label
          ><el-input
            id="account"
            v-model="account"
            name="account"
            autocomplete="username"
            placeholder="请输入邮箱或手机号"
            size="large"
            maxlength="100"
            :disabled="busy"
          />
          <label for="password">密码</label
          ><el-input
            id="password"
            v-model="password"
            name="password"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            size="large"
            show-password
            maxlength="128"
            :disabled="busy"
          />
          <div v-if="error" role="alert" class="error-box">{{ error }}</div>
          <el-button
            type="primary"
            native-type="submit"
            size="large"
            :loading="busy"
            class="login-submit"
            >进入工作台 <span>→</span></el-button
          >
        </form>
        <p class="login-hint">
          使用现有 TDuck 账号登录。首次使用须先在原版入口完成初始密码修改。
        </p>
      </div>
      <span class="login-copyright">知研 · 智能深度调研 / Vue 3</span>
    </section>
  </div>
</template>
