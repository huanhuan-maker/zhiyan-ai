<template>
  <section v-if="state !== 'idle'" class="draft-generation-progress" aria-label="AI 建卷进度" data-testid="generation-progress">
    <div class="generation-heading">
      <div><span class="generation-eyebrow">AI 建卷 · 本次请求</span><h2>{{ heading }}</h2></div>
      <span class="generation-elapsed" aria-label="已用时间">{{ elapsedLabel }}<small>已用时间</small></span>
    </div>
    <div class="generation-request"><p><strong>调查目标</strong>{{ input.goal }}</p><div><span>目标人群：{{ input.audience }}</span><span>期望 {{ input.questionCount }} 题</span></div></div>
    <ol class="generation-steps">
      <li v-for="(step,i) in steps" :key="step" :class="{ done: i < activeStep || completed, active: i === activeStep && !completed, failed: state === 'failed' && i === activeStep }">
        <span class="generation-step-mark">{{ i < activeStep || completed ? '✓' : String(i + 1).padStart(2,'0') }}</span><span>{{ step }}</span>
      </li>
    </ol>
    <div class="generation-status" role="status" aria-live="polite"><span v-if="state === 'running'" class="generation-pulse" />{{ message }}</div>
    <div v-if="state === 'running'" class="generation-activity" aria-hidden="true"><span /></div>
    <p v-if="unavailable && state === 'running'" class="generation-note">详细进度暂不可用，正在等待本次生成返回。</p>
    <p v-if="state === 'running'" class="generation-tip"><strong>建卷提示</strong>{{ tips[Math.floor(elapsed / 12000) % tips.length] }}</p>
    <p v-if="state === 'running' && elapsed >= 30000" class="generation-note">等待已超过 30 秒，题目较多或模型响应较慢时会更久。当前输入和原草稿已保留。</p>
    <div v-if="state === 'failed'" class="generation-failure"><p>{{ error || '本次生成暂未完成，可以重试。' }}</p><el-button type="primary" plain @click="$emit('retry')">重试生成</el-button></div>
    <details v-if="events.length" class="generation-event-log"><summary>查看本次流程记录</summary><ul><li v-for="(event,i) in events" :key="i"><time>{{ (event.elapsedMs / 1000).toFixed(1) }}s</time>{{ event.message }}</li></ul></details>
  </section>
</template>
<script setup>
import { computed } from 'vue'
const props=defineProps({state:{type:String,default:'idle'},input:{type:Object,default:()=>({})},events:{type:Array,default:()=>[]},elapsed:{type:Number,default:0},unavailable:Boolean,error:String})
defineEmits(['retry'])
const steps=['需求检查','AI 设计问卷','检查生成结果','草稿就绪']
const tips=['题目多时需要更长时间，生成完成后仍可逐题编辑或让 AI 单独优化。','单选选项应尽量互斥并覆盖主要情况，避免受访者找不到合适的答案。','评分题适合比较感受强弱，开放题可以补充选项没有覆盖的经历。','草稿完成后可以先预览填写体验，再暂存或导入编辑器。']
const phase=computed(()=>props.events.at(-1)?.phase || 'REGISTERED')
const completed=computed(()=>props.state==='succeeded')
const activeStep=computed(()=>{
  const p=props.state==='failed'?props.events.filter(e=>e.phase!=='FAILED').at(-1)?.phase:phase.value
  if(['SUCCEEDED','CLARIFICATION'].includes(p))return 3
  if(p==='VALIDATING')return 2
  if(['MODEL_RUNNING','MOCK_RUNNING'].includes(p))return 1
  return 0
})
const heading=computed(()=>({running:'正在为你设计问卷',succeeded:'草稿已就绪',clarification:'需要补充一点调查需求',failed:'本次生成未完成'}[props.state] || '正在提交需求'))
const message=computed(()=>props.state==='failed'?'输入和原有草稿已保留':props.state==='succeeded'?'生成与检查已完成，接下来可以逐题审核':props.state==='clarification'?'请根据下方问题补充信息后再生成':props.unavailable?'正在等待生成结果':props.events.at(-1)?.message || '正在提交调查需求')
const elapsedLabel=computed(()=>{const s=Math.max(0,Math.floor(props.elapsed/1000));return s<60?s+' 秒':Math.floor(s/60)+' 分 '+s%60+' 秒'})
</script>
<style scoped>
.draft-generation-progress{padding:24px;margin-top:18px;border:1px solid var(--zy-border);border-radius:14px;background:var(--zy-surface);color:var(--zy-text);overflow:hidden}
.generation-heading{display:flex;justify-content:space-between;gap:18px;align-items:center}.generation-eyebrow{font-size:11px;letter-spacing:.6px;color:var(--zy-purple)}.generation-heading h2{margin:7px 0 0;font-size:20px;font-weight:600}.generation-elapsed{flex-shrink:0;font-size:22px;font-variant-numeric:tabular-nums;color:var(--zy-primary);text-align:right}.generation-elapsed small{display:block;font-size:11px;color:var(--zy-text-secondary);margin-top:3px}
.generation-request{margin:20px 0;padding:14px 16px;background:var(--zy-surface-subtle);border-radius:8px;font-size:12px;color:var(--zy-text-regular)}.generation-request p{margin:0 0 10px;line-height:1.8;overflow-wrap:anywhere}.generation-request strong{color:var(--zy-text-secondary);margin-right:12px;font-weight:500}.generation-request>div{display:flex;gap:20px;flex-wrap:wrap;color:var(--zy-text-secondary)}
.generation-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:0;margin:22px 0;list-style:none;gap:10px}.generation-steps li{display:flex;align-items:center;gap:8px;color:var(--zy-text-secondary);font-size:12px;min-width:0}.generation-step-mark{display:flex;justify-content:center;align-items:center;flex-shrink:0;width:28px;height:28px;border:1px solid var(--zy-border);border-radius:50%;font-size:11px;background:var(--zy-surface-subtle)}.generation-steps .done{color:var(--zy-accent)}.generation-steps .active{color:var(--zy-primary);font-weight:600}.generation-steps .active .generation-step-mark{border-color:var(--zy-primary)}.generation-steps .failed{color:var(--zy-danger)}
.generation-status{font-size:13px;line-height:1.7;display:flex;align-items:center;gap:8px}.generation-pulse{width:7px;height:7px;border-radius:50%;background:var(--zy-primary);flex-shrink:0;animation:generation-pulse 1.5s ease-in-out infinite}.generation-activity{height:3px;overflow:hidden;background:var(--zy-surface-subtle);border-radius:4px;margin-top:12px}.generation-activity span{display:block;height:100%;width:28%;background:var(--zy-primary);border-radius:4px;animation:generation-slide 2s ease-in-out infinite}
.generation-tip{display:flex;gap:10px;line-height:1.8;font-size:12px;margin:17px 0 0;color:var(--zy-text-secondary)}.generation-tip strong{flex-shrink:0;color:var(--zy-purple);font-weight:500}.generation-note{font-size:12px;color:var(--zy-text-secondary);line-height:1.8;margin:12px 0 0}.generation-failure{font-size:13px;line-height:1.8;color:var(--zy-danger)}.generation-event-log{margin-top:16px;font-size:12px;color:var(--zy-text-secondary)}.generation-event-log summary{cursor:pointer}.generation-event-log ul{padding:0;list-style:none;line-height:1.8}.generation-event-log li{display:flex;gap:12px;margin:6px 0}.generation-event-log time{flex-shrink:0;min-width:40px;font-variant-numeric:tabular-nums}
@keyframes generation-slide{0%{transform:translateX(-100%)}100%{transform:translateX(460%)}}@keyframes generation-pulse{50%{opacity:.35}}
@media(prefers-reduced-motion:reduce){.generation-activity span,.generation-pulse{animation:none}}
@media(max-width:600px){.draft-generation-progress{padding:18px 15px}.generation-heading h2{font-size:17px}.generation-elapsed{font-size:18px}.generation-steps{grid-template-columns:1fr 1fr;gap:14px}.generation-tip{display:block}.generation-tip strong{display:block;margin-bottom:4px}}
</style>
