<template>
  <el-form ref="form" :model="formModel" :disabled="formConf.disabled" label-position="top" class="native-form">
    <section v-if="followupEnabled" class="followup-consent">
      <strong>可选补充追问</strong>
      <p>这份问卷可在开放题后提出中立追问。只有同意后，相关回答才会用于追问决策；如使用模型，回答会发送至服务端配置的模型服务。你可以拒绝、跳过或随时取消，不影响提交。</p>
      <small>{{providerLabel}} · 剩余 {{followupRemaining}} 次 · 每道开放题最多一次</small>
      <el-checkbox v-model="followupConsent" :disabled="!followupReady" @change="changeFollowupConsent">我同意参与可选追问</el-checkbox>
      <p v-if="followupNotice" role="status">{{followupNotice}}</p>
    </section>
    <template v-for="(field,i) in shown" :key="field.config.formId">
      <el-form-item :data-question-type="field.typeId" :style="{gridColumn:`span ${field.config.span||24}`}" :prop="field.config.formId" :rules="rules(field)" :error="fieldErrors[field.config.formId]">
        <template v-if="field.config.showLabel!==false" #label>
          <span v-if="formConf.theme?.showNumber">{{i+1}}. </span><span v-html="safe(field.config.label)"/>
        </template>
        <QuestionField v-model="formModel[field.config.formId]" :models="formModel" :item="field" :form-key="formConf.formKey" :disabled="formConf.disabled"/>
        <section v-if="followupEnabled && field.typeId==='TEXTAREA' && followupAllowed.includes(field.config.formId)" class="followup-panel" :data-followup-for="field.config.formId">
          <template v-if="!followupDecisions[field.config.formId]">
            <el-button v-if="followupConsent" :disabled="!followupReady || !String(formModel[field.config.formId]||'').trim()" :loading="followupBusy[field.config.formId]" @click="evaluateFollowup(field)">继续此题（可选追问）</el-button>
            <small v-else>已选择只填核心题，追问不会影响提交。</small>
          </template>
          <template v-else-if="followupDecisions[field.config.formId].state==='ASKED'">
            <p class="followup-question">补充问题：{{followupDecisions[field.config.formId].questionText}}</p>
            <el-input v-model="followupReplies[field.config.formId]" type="textarea" :rows="2" :maxlength="4000" placeholder="补充回答，可跳过" />
            <div class="followup-actions"><el-button :loading="followupBusy[field.config.formId]" @click="respondFollowup(field,false)">保存补充回答</el-button><el-button :disabled="followupBusy[field.config.formId]" @click="respondFollowup(field,true)">跳过追问</el-button></div>
          </template>
          <small v-else-if="followupDecisions[field.config.formId].state==='EVALUATING'">正在评估是否需要追问；你可以继续答题或直接提交。</small>
          <small v-else-if="followupDecisions[field.config.formId].state==='REPLIED'">补充回答已保存，原回答保持独立。</small>
          <small v-else-if="followupDecisions[field.config.formId].state==='DECLINED'">已跳过，不会再弹出同一追问。</small>
          <small v-else-if="['MODEL_FAILURE','INVALID_MODEL_OUTPUT','NO_KEY'].includes(followupDecisions[field.config.formId].reasonCode)">追问服务暂不可用，本题已跳过，不影响提交。</small>
          <small v-else>本题不再追问，可继续填写。</small>
        </section>
      </el-form-item>
    </template>
    <div v-if="formConf.formBtns!==false" class="form-actions">
      <el-button v-if="page>0" :disabled="submitting" @click="page--">上一页</el-button>
      <el-button v-if="page<pages.length-1" type="primary" @click="next">下一页</el-button>
      <el-button v-else-if="formConf.theme?.showSubmitBtn!==false" type="primary" :loading="submitting" @click="submit">{{formConf.theme?.submitBtnText||'提交'}}</el-button>
      <el-button v-if="formConf.resetBtn" @click="reset">重置</el-button>
    </div>
  </el-form>
</template>
<script setup>
import {ref,reactive,computed,watch,nextTick,provide} from 'vue'
import DOMPurify from 'dompurify'
import QuestionField from './QuestionField.vue'
import {clone,visibleFields} from './schema'
import {validateFields,decorateAnswers} from './validation'
import {useFollowup} from './followup'
const props=defineProps({formConf:{type:Object,default:()=>({fields:[]})},pageFormModel:{type:Object,default:()=>({})}})
const emit=defineEmits(['submit','change'])
const form=ref(),page=ref(0),submitting=ref(false),formModel=reactive({}),fieldErrors=reactive({})
const {enabled:followupEnabled,consent:followupConsent,ready:followupReady,notice:followupNotice,remaining:followupRemaining,providerLabel,
 allowed:followupAllowed,decisions:followupDecisions,busy:followupBusy,replies:followupReplies,changeConsent:changeFollowupConsent,evaluate:evaluateFollowup,respond:respondFollowup}=useFollowup(props,formModel)
const resolvedOptions=reactive({})
provide('tdResolvedOptions',resolvedOptions)
const safe=value=>DOMPurify.sanitize(String(value||''))
watch(()=>props.formConf.fields,fields=>{
  for(const f of fields||[]){
    const id=f.config.formId
    if(!(id in formModel))formModel[id]=clone(props.pageFormModel[id]??f.config.defaultValue??(['CHECKBOX','UPLOAD','IMAGE_UPLOAD','SUB_FORM'].includes(f.typeId)?[]:''))
    if(props.pageFormModel[id+'other']!==undefined&&!(id+'other' in formModel))formModel[id+'other']=props.pageFormModel[id+'other']
    if(f.typeId==='SORT'&&!formModel[id]?.length)formModel[id]=clone(f.sortList||[])
  }
},{immediate:true,deep:true})
watch(formModel,v=>emit('change',v),{deep:true})
const visible=computed(()=>visibleFields(props.formConf.fields||[],formModel,props.formConf.logicRules||[]))
const pages=computed(()=>{
  const out=[[]]
  for(const f of visible.value){if(f.typeId==='PAGINATION'){if(out.at(-1).length)out.push([])}else out.at(-1).push(f)}
  return out.filter((a,i)=>a.length||i===0)
})
const shown=computed(()=>pages.value[Math.min(page.value,pages.value.length-1)]||[])
function rules(f){return f.config.required&&!f.config.displayType?[{required:true,message:'此题为必填项目',trigger:'change'}]:[]}
async function check(fields){
  for(const key of Object.keys(fieldErrors))delete fieldErrors[key]
  const errors=await validateFields(fields,formModel)
  for(const error of errors)fieldErrors[error.field]=error.message
  if(errors.length){
    const target=pages.value.findIndex(rows=>rows.some(f=>f.config.formId===errors[0].field))
    if(target>=0)page.value=target
    await nextTick()
    form.value?.scrollToField(errors[0].field)
  }
  return !errors.length
}
async function next(){if(await check(shown.value))page.value++}
async function submit(){
  if(submitting.value)return
  if(!await check(visible.value))return
  submitting.value=true
  emit('submit',{formModel:getAnswers(),formId:props.formConf.formId,formKey:props.formConf.formKey,done:()=>{submitting.value=false}})
}
function reset(){form.value.resetFields();page.value=0}
const getAnswers=()=>decorateAnswers(visible.value,formModel,resolvedOptions)
defineExpose({formModel,submit,reset,getAnswers,validate:()=>check(visible.value)})
</script>
<style scoped>
.followup-consent{grid-column:span 24;padding:16px;margin-bottom:20px;background:#f0f7ff;border-radius:8px;line-height:1.7}
.followup-consent p{margin:6px 0}.followup-consent small{display:block;color:#475569}.followup-consent .el-checkbox{white-space:normal;height:auto;min-height:36px}
.followup-panel{width:100%;padding:12px;margin-top:10px;box-sizing:border-box;background:#f8fafc;border-left:3px solid #409eff;border-radius:4px}
.followup-panel small{color:#64748b}.followup-question{margin:0 0 8px}.followup-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
</style>
