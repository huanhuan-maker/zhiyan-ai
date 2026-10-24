<script setup lang="ts">
import { onMounted, ref } from "vue";
import { request } from "../api/client";
import { clearLanOrigin, lanOrigin, saveLanOrigin } from "../api/sharing";

const input = ref(lanOrigin.value ?? ""), error = ref(""), hint = ref(""), detected = ref<string[]>([]), loading = ref(false);
onMounted(async () => {
  loading.value = true;
  try { detected.value = (await request<{ addresses: string[] }>("/api/system/lan-addresses")).addresses ?? []; }
  catch { hint.value = "未能读取本机网卡地址；可在 PowerShell 运行 ipconfig 手动查看 IPv4。"; }
  finally { loading.value = false; }
});
function save() { const check = saveLanOrigin(input.value); error.value = check.origin ? "" : check.error; }
function clearAll() { clearLanOrigin(); input.value = ""; error.value = ""; }
function pick(address: string) { input.value = address; save(); }
</script>
<template>
  <div class="lan-panel">
    <h3>局域网分享设置</h3>
    <p class="muted">手机与电脑连接同一 Wi-Fi 或电脑热点时，二维码按此地址生成。切换网络（如家里 Wi-Fi ↔ 电脑热点）后修改保存即可；仅保存于此浏览器。</p>
    <div class="lan-form">
      <input v-model="input" placeholder="电脑局域网 IPv4，如 192.168.137.1（自动使用当前端口 5173），或完整地址 http://IP:端口" aria-label="局域网访问地址" @keyup.enter="save" />
      <button type="button" class="secondary" :disabled="loading" @click="save">保存</button>
      <button v-if="lanOrigin" type="button" class="secondary" @click="clearAll">清除</button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else-if="lanOrigin" class="success" role="status">当前局域网地址：{{ lanOrigin }}</p>
    <p v-if="detected.length" class="muted lan-detected">检测到本机 IPv4（点击选用）：
      <button v-for="a in detected" :key="a" type="button" class="text-button" @click="pick(a)">{{ a }}</button>
    </p>
    <p v-if="hint" class="muted">{{ hint }}</p>
  </div>
</template>
