<template>
 <div class="biz-form-wrapper" :style="pageStyle">
  <div class="biz-form">
   <el-alert v-if="error" type="error" :title="error" :closable="false"/>
   <template v-else-if="loaded">
    <div v-if="formConf.theme?.logoImg" :style="{textAlign:formConf.theme.logoPosition||'left'}"><img :src="formConf.theme.logoImg" alt="表单标识" style="max-width:180px;max-height:100px"/></div>
    <img v-if="formConf.theme?.headImgUrl" :src="formConf.theme.headImgUrl" alt="" style="width:100%;border-radius:8px"/>
    <div class="native-form-heading">
     <h2 v-if="formConf.theme?.showTitle!==false" v-html="safe(formConf.title)"/>
     <div v-if="formConf.theme?.showDescribe!==false" v-html="safe(formConf.description)"/>
    </div>
    <GenerateForm ref="generateForm" :form-conf="formConf" :page-form-model="initialModel" @change="saveDraft" @submit="submit"/>
    <div class="form-support">{{formConfig.supportText}}</div>
   </template>
   <el-skeleton v-else :rows="5" animated/>
  </div>
 </div>
</template>
<script setup>
import {ref,reactive,computed,watch} from 'vue'
import DOMPurify from 'dompurify'
import api from '@/api'
import GenerateForm from './GenerateForm.vue'
import {dbDataConvertForItemJson} from './schema'
import {getFormData,saveFormData} from '@/utils/db'
const props=defineProps({formConfig:{type:Object,default:()=>({})}}),emit=defineEmits(['submit','completed'])
const formConf=reactive({fields:[],formBtns:true}),loaded=ref(false),error=ref(''),generateForm=ref()
const safe=value=>DOMPurify.sanitize(String(value||''))
const initialModel=computed(()=>{if(props.formConfig.formModel)return props.formConfig.formModel;if(props.formConfig.preview||!props.formConfig.setting?.saveNotSubmitStatus)return {};try{return getFormData(props.formConfig.formKey)||{}}catch{return {}}})
function saveDraft(model){if(!props.formConfig.preview&&props.formConfig.setting?.saveNotSubmitStatus)try{saveFormData(model,props.formConfig.formKey)}catch{}}
const pageStyle=computed(()=>({
 '--el-color-primary':formConf.theme?.themeColor||'#3370ff',
 backgroundColor:formConf.theme?.backgroundColor||'#f5f7fa',
 backgroundImage:formConf.theme?.backgroundImg?`url("${encodeURI(formConf.theme.backgroundImg).replaceAll('"','%22')}")`:'none',
 backgroundSize:'cover',minHeight:'100%',padding:'1px'
}))
watch(()=>props.formConfig.formKey,async key=>{
 if(!key)return
 loaded.value=false;error.value=''
 try{
  const token=props.formConfig.versionToken
  const res=await api.get(`${Number(props.formConfig.formKind)===2?'/form/template/details/':'/user/form/details/'}${encodeURIComponent(key)}${token?'?token='+encodeURIComponent(token):''}`)
  const d=res.data;if(!d)throw new Error('问卷不存在或已被删除')
  Object.assign(formConf,{formKey:key,formType:d.form?.type??d.formType,formId:d.form?.id,title:d.form?.name||props.formConfig.name,description:d.form?.description,fields:(d.formItems||[]).map(dbDataConvertForItemJson),theme:d.userFormTheme||{},logicRules:d.formLogic?.scheme||d.userFormLogic?.scheme||d.logic?.scheme||[],formBtns:props.formConfig.showBtns!==false,
   version:d.version??null,versionStatus:d.versionStatus??null,versionShareToken:d.shareToken??null,
   allowFollowup:props.formConfig.allowFollowup===true&&!props.formConfig.preview,versionToken:token||'',writePassword:props.formConfig.writePassword||''})
  loaded.value=true;emit('completed')
 }catch(e){error.value=e.msg||e.message||'加载失败'}
},{immediate:true})
function submit(data){emit('submit',data);if(props.formConfig.preview)data.done?.()}
defineExpose({formConf,generateForm})
</script>
