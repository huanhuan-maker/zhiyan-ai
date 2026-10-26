<template>
  <section v-loading="loading" class="ai-settings">
    <header class="settings-heading"><div><h2>模型供应商</h2><p>统一管理问卷助手、AI 建卷与报告使用的模型。保存后立即生效。</p></div><el-switch v-model="form.enabled" active-text="启用真实 AI" :disabled="loading" /></header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <div class="settings-toolbar"><el-button type="primary" plain @click="addProvider">添加供应商</el-button><el-button :disabled="loading || saving" @click="reload">重新加载</el-button><span>{{ dirty ? '有未保存的更改' : '已与服务端同步' }} · {{ modelCount }} 个模型</span></div>
    <el-empty v-if="!form.providers.length" description="添加你的模型供应商，支持自定义网关与模型 ID" />
    <article v-for="p in form.providers" :key="p.id" class="provider-card" data-testid="provider-card">
      <div class="card-heading"><h3>{{ p.name || '新供应商' }}</h3><el-button type="danger" text @click="removeProvider(p)">移除供应商</el-button></div>
      <div class="fields provider-fields">
        <label>供应商名称<el-input v-model="p.name" maxlength="80" placeholder="例如：我的模型网关" /></label>
        <label>API 协议<el-select v-model="p.protocol" data-testid="provider-protocol"><el-option label="OpenAI Chat Completions" value="OPENAI_CHAT" /><el-option label="OpenAI Responses" value="OPENAI_RESPONSES" /><el-option label="Anthropic Messages" value="ANTHROPIC" /></el-select></label>
        <label class="wide">Base URL<el-input v-model="p.baseUrl" placeholder="例如：https://api.openai.com/v1（不含 /chat/completions）" /></label>
        <label class="wide">API Key<el-input v-model="p.apiKey" type="password" show-password autocomplete="new-password" :placeholder="p.hasApiKey ? '已保存密钥，留空保持；更换地址或协议时请重新填写' : '输入此供应商的 API Key'" /><small>{{ p.hasApiKey ? '已保存密钥 · 不回显原值' : '尚未配置密钥' }}</small></label>
        <label>请求超时（秒）<input v-model.number="p.timeoutSeconds" type="number" min="1" max="120" /></label>
        <label v-if="p.protocol === 'OPENAI_CHAT'">输出上限参数<el-select v-model="p.outputTokenParameter"><el-option label="max_completion_tokens（标准）" value="max_completion_tokens" /><el-option label="max_tokens（兼容网关）" value="max_tokens" /></el-select></label>
      </div>
      <p class="field-hint">一个供应商共用地址和密钥，可添加多个模型。Base URL 只填写 API 根地址；请求失败会提示，不会自动改换协议或隐藏参数。</p>
      <section v-for="m in p.models" :key="m.id" class="model-card" data-testid="model-card">
        <div class="card-heading"><strong>{{ m.name || '自定义模型' }}</strong><div class="model-actions"><el-tag v-if="form.defaultModelId === m.id" type="success" effect="plain">默认模型</el-tag><el-button v-else size="small" @click="form.defaultModelId = m.id">设为默认模型</el-button><el-button type="danger" text size="small" @click="removeModel(p,m)">移除模型</el-button></div></div>
        <div class="fields model-fields">
          <label>显示名称<el-input v-model="m.name" maxlength="80" placeholder="例如：日常查询" /></label>
          <label data-testid="model-id">模型 ID<el-input v-model="m.modelId" maxlength="150" placeholder="填写供应商实际支持的模型 ID" /></label>
          <label>思考强度<el-select v-model="m.reasoningEffort" data-testid="reasoning-effort"><el-option v-for="o in effortOptions(p.protocol)" :key="o.value" :label="o.label" :value="o.value" /></el-select></label>
          <label>上下文窗口（Token）<input v-model.number="m.contextWindow" type="number" min="1024" max="2097152" step="1024" /></label>
          <label>最大输出 Token<input v-model.number="m.maxOutputTokens" type="number" min="64" max="262144" step="64" /></label>
          <label>历史提问轮数<input v-model.number="m.historyTurns" type="number" min="0" max="20" /></label>
        </div>
        <p class="field-hint">强度是否支持取决于具体模型；“跟随模型默认”不发送思考参数。{{ p.protocol === 'ANTHROPIC' ? '显式强度使用 adaptive thinking + effort；none 关闭思考，旧模型请用默认。' : 'none / minimal 等值也需要模型支持。' }} 输出上限包含思考开销。</p>
        <el-button :loading="testing === m.id" :disabled="dirty || !!testing || saving || !p.hasApiKey" size="small" @click="testModel(m)">测试连接</el-button><small v-if="testResults[m.id]" class="test-result">{{ testResults[m.id] }}</small>
      </section>
      <el-button plain @click="addModel(p)">添加模型</el-button>
    </article>
    <div class="settings-notes"><p>上下文窗口是本系统请求预算，不会扩展模型真实容量；按 UTF-8 字节加消息开销保守估算，超限会拒绝请求，不会截断题目或证据。</p><p>历史轮数仅影响问卷助手：携带当前对话最近几轮提问及普通聊天回复，不携带答卷原文或问卷工具结果；0 表示每次独立提问。默认模型供三项 AI 功能共用，普通答题不受配置开关影响。</p></div>
    <footer class="save-bar"><el-button type="primary" :loading="saving" :disabled="loading || !!testing" @click="save">保存全部配置</el-button><span>密钥仅提交到服务端加密保存；测试连接请先保存。</span></footer>
  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { getAiSettings, saveAiSettings, testAiModel } from '@/api/ai-settings'
const form = ref({ enabled: false, revision: 0, defaultModelId: '', providers: [] })
const loading = ref(true), saving = ref(false), dirty = ref(false), error = ref(''), testing = ref(''), testResults = ref({})
let applying = false
watch(form, () => { if (!applying) dirty.value = true }, { deep: true })
const modelCount = computed(() => form.value.providers.reduce((sum, p) => sum + p.models.length, 0))
const efforts = [{value:'auto',label:'跟随模型默认'}, {value:'none',label:'关闭 / 无 · none'}, {value:'minimal',label:'极低 · minimal'}, {value:'low',label:'低 · low'}, {value:'medium',label:'中 · medium'}, {value:'high',label:'高 · high'}, {value:'xhigh',label:'很高 · xhigh'}, {value:'max',label:'最高 · max'}]
function effortOptions(protocol) { return efforts.filter(e => protocol !== 'ANTHROPIC' || e.value !== 'minimal') }
async function apply(data) { applying = true; form.value = data; for (const p of data.providers) { p.apiKey = ''; p.timeoutSeconds = p.timeoutMs / 1000 } await nextTick(); applying = false; dirty.value = false; testResults.value = {} }
async function reload() { loading.value = true; error.value = ''; try { const r = await getAiSettings(); await apply(r.data) } catch (e) { error.value = e?.msg || e?.message || '模型配置加载失败，请重新加载' } finally { loading.value = false } }
function addProvider() { if (form.value.providers.length >= 20) return ElMessage.warning('最多20个供应商'); const p = { id: crypto.randomUUID(), name: '', protocol: 'OPENAI_CHAT', baseUrl: '', apiKey: '', hasApiKey: false, timeoutSeconds: 60, timeoutMs: 60000, outputTokenParameter: 'max_completion_tokens', models: [] }; form.value.providers.push(p); addModel(p) }
function addModel(p) { if (p.models.length >= 30) return ElMessage.warning('每个供应商最多30个模型'); const m = { id: crypto.randomUUID(), name: '', modelId: '', reasoningEffort: 'auto', contextWindow: 32768, maxOutputTokens: 8192, historyTurns: 6 }; p.models.push(m); if (!form.value.defaultModelId) form.value.defaultModelId = m.id }
function removeModel(p,m) { p.models = p.models.filter(x => x.id !== m.id); if (form.value.defaultModelId === m.id) form.value.defaultModelId = '' }
function removeProvider(p) { if (p.models.some(m => m.id === form.value.defaultModelId)) form.value.defaultModelId = ''; form.value.providers = form.value.providers.filter(x => x.id !== p.id) }
async function save() { saving.value = true; error.value = ''; try { const payload = JSON.parse(JSON.stringify(form.value)); for (const p of payload.providers) { p.timeoutMs = p.timeoutSeconds * 1000; delete p.timeoutSeconds; delete p.hasApiKey } const r = await saveAiSettings(payload); await apply(r.data); ElMessage.success('模型配置已保存') } catch (e) { error.value = e?.msg || e?.message || '模型配置保存失败' } finally { saving.value = false } }
async function testModel(m) { testing.value = m.id; testResults.value[m.id] = ''; try { const r = await testAiModel(m.id); testResults.value[m.id] = `连接成功 · ${r.data.elapsedMs} ms` } catch (e) { testResults.value[m.id] = e?.msg || e?.message || '连接失败' } finally { testing.value = '' } }
onMounted(reload)
</script>

<style scoped>
.ai-settings :deep(.el-button.el-button--danger){color:#b42318;background-color:#fff1f0;border:1px solid #ffd0cc;font-weight:500}
.ai-settings :deep(.el-button.el-button--danger:hover),.ai-settings :deep(.el-button.el-button--danger:focus-visible){color:#912018;background-color:#ffe1dd;border-color:#ffb3aa}
.ai-settings :deep(.el-button.el-button--danger:focus-visible){outline:2px solid #b42318;outline-offset:2px}
.ai-settings{max-width:1100px;padding:18px 0;color:#243449;min-width:0}.settings-heading,.card-heading,.settings-toolbar,.model-actions,.save-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.settings-heading,.card-heading{justify-content:space-between}.settings-heading h2{font-size:22px;margin:0 0 8px}.settings-heading p,.field-hint,.settings-notes,.save-bar span,.settings-toolbar>span{color:#66758b;font-size:12px;line-height:1.8}.settings-toolbar{margin:24px 0 18px}.settings-toolbar .el-button+.el-button{margin-left:0}.provider-card{border:1px solid #dfe5ee;border-radius:12px;padding:20px;margin-bottom:20px;background:#fff}.card-heading h3{margin:0;font-size:17px}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:18px 0}.fields label{display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:500;min-width:0}.fields .wide{grid-column:1/-1}.fields :deep(.el-select){width:100%}.fields input[type=number]{box-sizing:border-box;border:1px solid #d8dfe8;border-radius:5px;padding:9px 12px;color:inherit;font:inherit;width:100%;height:34px;background:white}.fields input[type=number]:focus{outline:1px solid #3370ff}.fields small,.test-result{color:#63758b;font-size:12px;font-weight:400}.model-card{padding:18px;background:#f7f9fc;border:1px solid #e5eaf1;border-radius:8px;margin:18px 0}.model-fields{grid-template-columns:repeat(3,minmax(0,1fr))}.model-actions .el-button{margin:0}.test-result{display:inline-block;margin-left:12px;overflow-wrap:anywhere}.settings-notes{margin:16px 0}.save-bar{border-top:1px solid #e6eaf0;padding:20px 0;background:white}.ai-settings :deep(.el-alert){margin-top:16px}
@media(max-width:700px){.ai-settings{padding:12px 0}.provider-card{padding:12px}.model-card{padding:12px}.fields,.model-fields{grid-template-columns:minmax(0,1fr)}.card-heading{align-items:flex-start}.model-actions{gap:6px}.settings-heading{align-items:flex-start}.settings-heading h2{font-size:19px}.save-bar{position:sticky;bottom:0;z-index:3}.test-result{margin:10px 0;display:block}}
</style>
