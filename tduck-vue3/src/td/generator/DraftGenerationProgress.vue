<template>
  <section v-if="state !== 'idle'" class="draft-generation-progress" aria-label="AI 建卷进度" data-testid="generation-progress">
    <div class="generation-heading">
      <div><span class="generation-eyebrow">AI 建卷 · 本次请求</span><h2>{{ heading }}</h2></div>
      <span class="generation-elapsed" aria-label="已用时间">{{ elapsedLabel }}<small>已用时间</small></span>
    </div>
    <div class="generation-request"><p><strong>调查目标</strong>{{ input.goal }}</p><div><span>目标人群：{{ input.audience }}</span><span>期望 {{ input.questionCount }} 题</span></div></div>
    <ol class="generation-steps" :style="{ '--step-progress': progress + '%' }" aria-label="生成步骤">
      <li v-for="step in stepStates" :key="step.label" :class="{ done: step.done, active: step.active, failed: step.failed, reviewing: selected === step.index }">
        <button type="button" class="generation-step" :aria-pressed="selected === step.index" :aria-label="'第 ' + (step.index + 1) + ' 步：' + step.label" @click="selectStep(step.index)">
          <span class="generation-step-mark">
            <span v-if="step.done" class="generation-step-check" aria-hidden="true">✓</span>
            <span v-else-if="step.failed" aria-hidden="true">×</span>
            <span v-else>{{ String(step.index + 1).padStart(2, '0') }}</span>
          </span>
          <span class="generation-step-label">{{ step.label }}</span>
        </button>
      </li>
    </ol>
    <transition name="step-detail">
      <p v-if="detail" class="generation-step-detail" role="note">
        <strong>{{ detail.title }}</strong><span>{{ detail.message }}</span><time v-if="detail.at">{{ detail.at }}</time>
      </p>
    </transition>
    <div class="generation-status-row">
      <AiStatus v-if="state === 'running'" class="generation-status" :message="message" :elapsed-ms="elapsed" />
      <div v-else class="generation-status" role="status">{{ message }}</div>
      <button v-if="canReplay" type="button" class="generation-replay" data-testid="generation-replay" @click="toggleReplay">{{ replaying ? '停止回看' : '回看流程' }}</button>
    </div>
    <p v-if="unavailable && state === 'running'" class="generation-note">详细进度暂不可用，正在等待本次生成返回。</p>
    <p v-if="state === 'running'" class="generation-tip"><strong>建卷提示</strong>{{ tips[Math.floor(elapsed / 12000) % tips.length] }}</p>
    <p v-if="state === 'running' && elapsed >= 30000" class="generation-note">等待已超过 30 秒，题目较多或模型响应较慢时会更久。当前输入和原草稿已保留。</p>
    <div v-if="state === 'failed'" class="generation-failure"><p>{{ error || '本次生成暂未完成，可以重试。' }}</p><el-button type="primary" plain @click="$emit('retry')">重试生成</el-button></div>
    <details v-if="events.length" class="generation-event-log"><summary>查看本次流程记录</summary><ul><li v-for="(event, i) in events" :key="i"><time>{{ (event.elapsedMs / 1000).toFixed(1) }}s</time>{{ event.message }}</li></ul></details>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AiStatus from '../components/AiStatus/index.vue'
import { GENERATION_STEPS, activeStep, stepProgress, stepRecord, stepStates as deriveStepStates } from './generation-steps'
const props = defineProps({ state: { type: String, default: 'idle' }, input: { type: Object, default: () => ({}) }, events: { type: Array, default: () => [] }, elapsed: { type: Number, default: 0 }, unavailable: Boolean, error: String })
defineEmits(['retry'])
const steps = GENERATION_STEPS
const tips = ['题目多时需要更长时间，生成完成后仍可逐题编辑或让 AI 单独优化。', '单选选项应尽量互斥并覆盖主要情况，避免受访者找不到合适的答案。', '评分题适合比较感受强弱，开放题可以补充选项没有覆盖的经历。', '草稿完成后可以先预览填写体验，再暂存或导入编辑器。']
const phase = computed(() => props.events.at(-1)?.phase || 'REGISTERED')
const stepStates = computed(() => deriveStepStates(props.state, phase.value, props.events))
const progress = computed(() => stepProgress(props.state, phase.value, props.events))
const heading = computed(() => ({ running: '正在为你设计问卷', succeeded: '草稿已就绪', clarification: '需要补充一点调查需求', failed: '本次生成未完成' }[props.state] || '正在提交需求'))
const message = computed(() => props.state === 'failed' ? '输入和原有草稿已保留' : props.state === 'succeeded' ? '生成与检查已完成，接下来可以逐题审核' : props.state === 'clarification' ? '请根据下方问题补充信息后再生成' : props.unavailable ? '正在等待生成结果' : props.events.at(-1)?.message || '正在提交调查需求')
const elapsedLabel = computed(() => { const s = Math.max(0, Math.floor(props.elapsed / 1000)); return s < 60 ? s + ' 秒' : Math.floor(s / 60) + ' 分 ' + s % 60 + ' 秒' })
const selected = ref(null)
const detail = computed(() => {
  if (selected.value === null) return null
  const record = stepRecord(props.events, selected.value)
  return { title: steps[selected.value], message: record?.message || '这一步还没有记录', at: record ? (record.elapsedMs / 1000).toFixed(1) + 's' : '' }
})
function selectStep(index) {
  stopReplay()
  selected.value = selected.value === index ? null : index
}
const replaying = ref(false)
const canReplay = computed(() => props.state !== 'running' && props.events.length > 1)
let replayTimer = null
function stopReplay() { clearInterval(replayTimer); replayTimer = null; replaying.value = false }
function toggleReplay() {
  if (replaying.value) { stopReplay(); return }
  if (!canReplay.value) return
  replaying.value = true
  selected.value = 0
  replayTimer = setInterval(() => {
    if (selected.value === null || selected.value >= steps.length - 1) { stopReplay(); return }
    selected.value += 1
  }, 1100)
}
watch(() => props.state, (value) => { if (value === 'running') { stopReplay(); selected.value = null } })
onBeforeUnmount(stopReplay)
</script>
<style scoped>
.draft-generation-progress{padding:24px;margin-top:18px;border:1px solid var(--zy-border);border-radius:14px;background:var(--zy-surface);color:var(--zy-text);overflow:hidden}
.generation-heading{display:flex;justify-content:space-between;gap:18px;align-items:center}.generation-eyebrow{font-size:11px;letter-spacing:.6px;color:var(--zy-purple)}.generation-heading h2{margin:7px 0 0;font-size:20px;font-weight:600}.generation-elapsed{flex-shrink:0;font-size:22px;font-variant-numeric:tabular-nums;color:var(--zy-primary);text-align:right}.generation-elapsed small{display:block;font-size:11px;color:var(--zy-text-secondary);margin-top:3px}
.generation-request{margin:20px 0;padding:14px 16px;background:var(--zy-surface-subtle);border-radius:8px;font-size:12px;color:var(--zy-text-regular)}.generation-request p{margin:0 0 10px;line-height:1.8;overflow-wrap:anywhere}.generation-request strong{color:var(--zy-text-secondary);margin-right:12px;font-weight:500}.generation-request>div{display:flex;gap:20px;flex-wrap:wrap;color:var(--zy-text-secondary)}
.generation-steps{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:0;margin:26px 0 22px;list-style:none}
.generation-steps::before,.generation-steps::after{content:'';position:absolute;top:14px;left:14px;right:calc(25% - 21px);height:2px;border-radius:2px;background:var(--zy-border);pointer-events:none;z-index:0}
.generation-steps::after{right:auto;width:calc(var(--step-progress,0%) - 28px);max-width:calc(100% - 28px);background:linear-gradient(90deg,var(--zy-primary),var(--zy-accent-cyan));transition:width .6s cubic-bezier(.22,1,.36,1);opacity:.9}
.generation-steps li{position:relative;min-width:0}
.generation-step{position:relative;z-index:1;display:flex;flex-direction:column;align-items:flex-start;gap:7px;width:100%;padding:0;color:var(--zy-text-secondary);font-size:12px;font-family:inherit;text-align:left;background:none;border:0;cursor:pointer;border-radius:8px}
.generation-step:focus-visible{outline:2px solid var(--zy-primary);outline-offset:4px}
.generation-step-mark{display:flex;justify-content:center;align-items:center;flex-shrink:0;width:28px;height:28px;border:1px solid var(--zy-border);border-radius:50%;font-size:11px;font-variant-numeric:tabular-nums;background:var(--zy-surface);transition:border-color .25s ease,color .25s ease,background-color .25s ease,transform .25s ease}
.generation-step:hover .generation-step-mark{border-color:var(--zy-primary);color:var(--zy-primary)}
.generation-step-label{width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.done .generation-step-mark{color:var(--zy-accent);border-color:var(--zy-accent);background:var(--zy-surface)}
.done .generation-step-check{display:block;font-size:13px;line-height:1;animation:step-pop .34s cubic-bezier(.34,1.56,.64,1) both}
.active .generation-step{color:var(--zy-primary);font-weight:600}
.active .generation-step-mark{position:relative;border-color:var(--zy-primary);color:var(--zy-primary);background:var(--zy-surface);box-shadow:0 0 0 4px rgba(47,111,237,.16)}
.active .generation-step-mark::after{content:'';position:absolute;inset:-5px;border:1px solid var(--zy-primary);border-radius:50%;opacity:0;animation:step-ring 1.8s ease-out infinite}
.failed .generation-step{color:var(--zy-danger)}
.failed .generation-step-mark{border-color:var(--zy-danger);color:var(--zy-danger);animation:step-shake .4s ease}
.reviewing .generation-step-mark{box-shadow:0 0 0 3px rgba(56,232,255,.18)}
.generation-step-detail{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin:0 0 18px;padding:10px 14px;font-size:12px;line-height:1.75;color:var(--zy-text-regular);background:var(--zy-surface-subtle);border:1px solid var(--zy-border-light);border-left:2px solid var(--zy-accent-cyan);border-radius:8px}
.generation-step-detail strong{color:var(--zy-text);font-weight:600}.generation-step-detail span{min-width:0;overflow-wrap:anywhere}.generation-step-detail time{flex:none;font-variant-numeric:tabular-nums;color:var(--zy-text-secondary)}
.step-detail-enter-active,.step-detail-leave-active{transition:opacity .22s ease,transform .22s ease}
.step-detail-enter-from,.step-detail-leave-to{opacity:0;transform:translateY(-4px)}
.generation-status-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.generation-status{font-size:13px;line-height:1.7;min-width:0}
.generation-replay{flex:none;padding:4px 12px;font-size:12px;font-family:inherit;color:var(--zy-text-secondary);cursor:pointer;background:transparent;border:1px solid var(--zy-border);border-radius:999px;transition:color .2s ease,border-color .2s ease,background-color .2s ease}
.generation-replay:hover{color:var(--zy-primary);border-color:var(--zy-primary);background:var(--zy-primary-soft,rgba(47,111,237,.12))}
.generation-replay:focus-visible{outline:2px solid var(--zy-primary);outline-offset:2px}
.generation-tip{display:flex;gap:10px;line-height:1.8;font-size:12px;margin:17px 0 0;color:var(--zy-text-secondary)}.generation-tip strong{flex-shrink:0;color:var(--zy-purple);font-weight:500}.generation-note{font-size:12px;color:var(--zy-text-secondary);line-height:1.8;margin:12px 0 0}.generation-failure{font-size:13px;line-height:1.8;color:var(--zy-danger)}.generation-event-log{margin-top:16px;font-size:12px;color:var(--zy-text-secondary)}.generation-event-log summary{cursor:pointer}.generation-event-log ul{padding:0;list-style:none;line-height:1.8}.generation-event-log li{display:flex;gap:12px;margin:6px 0}.generation-event-log time{flex-shrink:0;min-width:40px;font-variant-numeric:tabular-nums}
@keyframes step-pop{0%{transform:scale(.4);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes step-ring{0%{opacity:.55;transform:scale(.85)}70%{opacity:0;transform:scale(1.25)}100%{opacity:0;transform:scale(1.25)}}
@keyframes step-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
@media (prefers-reduced-motion: reduce){.generation-steps::after,.generation-step-mark,.step-detail-enter-active,.step-detail-leave-active{transition:none}.done .generation-step-check,.active .generation-step-mark::after,.failed .generation-step-mark{animation:none}.active .generation-step-mark::after{opacity:.35}}
@media (max-width:600px){.draft-generation-progress{padding:18px 15px}.generation-heading h2{font-size:17px}.generation-elapsed{font-size:18px}.generation-steps{grid-template-columns:1fr 1fr;gap:14px}.generation-steps::before,.generation-steps::after{display:none}.generation-tip{display:block}.generation-tip strong{display:block;margin-bottom:4px}.generation-step-label{white-space:normal}.generation-status-row{gap:8px}.generation-step-detail{padding:8px 10px}}
</style>
