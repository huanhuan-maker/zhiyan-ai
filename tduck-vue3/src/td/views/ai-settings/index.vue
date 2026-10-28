<template>
  <div class="app-container ai-settings-page">
    <div class="settings-card">
      <DeepSeekConfig scope="mine" />
    </div>
  </div>
</template>

<script>
import DeepSeekConfig from '@/views/manage/system/subconfig/DeepSeekConfig.vue'

export default {
  name: 'MyAiSettings',
  components: { DeepSeekConfig }
}
</script>

<style lang="scss" scoped>
.ai-settings-page {
  width: 100%;
  max-width: 1180px;
  min-height: 100%;
  padding: 24px 32px 48px;
  margin: 0 auto;
  color: var(--zy-text);
  font-family: var(--zy-font-family);
}
.settings-card {
  padding: 20px 22px 8px;
  background: var(--zy-surface);
  border: 1px solid var(--zy-border);
  border-radius: var(--zy-radius-lg);
  box-shadow: var(--zy-shadow-card);
}
@media (max-width: 767px) {
  .ai-settings-page { padding: 20px 14px 36px; }
  .settings-card { padding: 16px 14px 4px; }
}
</style>
