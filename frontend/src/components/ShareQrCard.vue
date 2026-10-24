<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import QRCode from "qrcode";
import { lanOrigin } from "../api/sharing";

const props = defineProps<{
  versionNumber: number; publicPath: string; previewUrl: string;
  versionStatus?: string; surveyStatus?: string;
}>();
const canvas = ref<HTMLCanvasElement>(), qrError = ref(""), copied = ref(false);
const shareUrl = computed(() => (props.publicPath.startsWith("/public/") && lanOrigin.value ? lanOrigin.value + props.publicPath : null));
const closed = computed(() => props.versionStatus === "CLOSED" || props.surveyStatus === "CLOSED");
async function render() {
  qrError.value = "";
  const el = canvas.value, url = shareUrl.value;
  if (!el || !url) return;
  try { await QRCode.toCanvas(el, url, { width: 208, margin: 2, errorCorrectionLevel: "M" }); }
  catch { qrError.value = "二维码生成失败，请刷新页面重试。"; }
}
onMounted(render);
watch(shareUrl, () => { copied.value = false; void render(); });
async function copyLink() {
  if (!shareUrl.value) return;
  try { await navigator.clipboard.writeText(shareUrl.value); copied.value = true; }
  catch { qrError.value = "自动复制不可用，请选中文本框中的完整链接手动复制。"; }
}
function download() {
  const el = canvas.value;
  if (!el || !shareUrl.value) return;
  try {
    const link = document.createElement("a");
    link.href = el.toDataURL("image/png");
    link.download = `zhiyan-share-v${props.versionNumber}.png`;
    link.click();
  } catch { qrError.value = "浏览器拒绝了下载；可右键（手机长按）二维码图片另存。"; }
}
</script>
<template>
  <div class="qr-card">
    <div class="qr-side">
      <canvas v-if="shareUrl" ref="canvas" class="qr-canvas" aria-label="问卷分享二维码"></canvas>
      <div v-else class="qr-missing">未配置局域网地址，暂不生成二维码——避免生成手机打不开的二维码。请先在上方“局域网分享设置”填写电脑的局域网 IPv4。</div>
      <p v-if="qrError" class="error" role="alert">{{ qrError }}</p>
    </div>
    <div class="qr-info">
      <h3>版本 {{ versionNumber }} · {{ closed ? '已停止收集' : '收集中' }}</h3>
      <p v-if="closed" class="error">该版本已停止收集：扫码只能看到停止提示，无法再填写或提交。如需继续收集请发布新版本。</p>
      <label>手机局域网链接<input :value="shareUrl ?? '（未配置局域网地址）'" readonly aria-label="手机局域网分享链接" @focus="($event.target as HTMLInputElement).select()" /></label>
      <div class="actions">
        <button type="button" class="secondary" :disabled="!shareUrl" @click="copyLink">{{ copied ? '已复制 ✓' : '复制局域网链接' }}</button>
        <button type="button" class="secondary" :disabled="!shareUrl" @click="download">下载二维码 PNG</button>
        <a v-if="shareUrl" class="text-link" :href="shareUrl" target="_blank" rel="noopener">打开答题页 ↗</a>
      </div>
      <p class="muted qr-preview-line">本机预览（仅此电脑可打开，手机无法访问）：<a class="text-link" :href="previewUrl" target="_blank" rel="noopener">{{ previewUrl }}</a></p>
    </div>
  </div>
</template>
