<template>
  <el-form ref="form" :model="formModel" :disabled="formConf.disabled" label-position="top" class="native-form">
    <template v-for="(field,i) in shown" :key="field.config.formId">
      <el-form-item :data-question-type="field.typeId" :style="{gridColumn:`span ${field.config.span||24}`}" :prop="field.config.formId" :rules="rules(field)" :error="fieldErrors[field.config.formId]">
        <template v-if="field.config.showLabel!==false" #label>
          <span v-if="formConf.theme?.showNumber">{{i+1}}. </span><span v-html="safe(field.config.label)"/>
        </template>
        <QuestionField v-model="formModel[field.config.formId]" :models="formModel" :item="field" :form-key="formConf.formKey" :disabled="formConf.disabled"/>
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
import {ref,reactive,computed,watch,nextTick} from 'vue'
import DOMPurify from 'dompurify'
import QuestionField from './QuestionField.vue'
import {clone,visibleFields} from './schema'
import {validateFields,decorateAnswers} from './validation'
const props=defineProps({formConf:{type:Object,default:()=>({fields:[]})},pageFormModel:{type:Object,default:()=>({})}})
const emit=defineEmits(['submit','change'])
const form=ref(),page=ref(0),submitting=ref(false),formModel=reactive({}),fieldErrors=reactive({})
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
  emit('submit',{formModel:decorateAnswers(visible.value,formModel),formId:props.formConf.formId,formKey:props.formConf.formKey,done:()=>{submitting.value=false}})
}
function reset(){form.value.resetFields();page.value=0}
defineExpose({formModel,submit,reset,validate:()=>check(visible.value)})
</script>
