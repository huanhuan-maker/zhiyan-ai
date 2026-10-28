<template><div v-loading="loading" class="native-designer"><section class="designer-palette"><h3>添加题目</h3><p class="palette-hint">选择题型，开始设计问卷</p><div class="palette-grid simple-palette"><button v-for="item in coreTypes" :key="item.typeId" :disabled="locked||busy" draggable="true" @dragstart="dragType=item.typeId" @click="add(item.typeId)"><strong>{{item.label}}</strong><span>{{item.description}}</span></button></div></section><section class="designer-canvas" @dragover.prevent @drop.prevent="drop"><div class="designer-title"><strong>表单设计</strong><SurveyDesignAssistant ref="designAssistant" :questions="designQuestions" :revision="JSON.stringify(fields)" :title="text(info.name)" :form-key="formKey" :locked="locked" :disabled="loading || busy" @apply="applyOptimization" @locate="locateQuestion" /><el-tag :type="dirty?'warning':'success'">{{dirty?'有未保存修改':'已保存'}}</el-tag><el-button :loading="busy" :disabled="locked" type="primary" @click="saveAll">保存</el-button></div><el-alert v-if="locked" type="warning" title="问卷正在收集，当前版本题目已冻结。停止收集后可编辑草稿，再发布为新版本；历史答卷保持原版本。" :closable="false"/><div class="designer-info" aria-label="问卷标题"><FormTinymce v-if="!loading" v-model:value="info.name" inline :disabled="locked" placeholder="问卷标题" @update:value="dirty=true"/></div><div class="designer-info"><FormTinymce v-if="!loading" v-model:value="info.description" inline :disabled="locked" placeholder="问卷描述" @update:value="dirty=true"/></div><el-empty v-if="!fields.length" description="点击左侧题型或拖到这里添加题目"/><article v-for="(field,i) in fields" :key="field.config.formId" class="question-card" :class="{selected:selected===i}" :draggable="!locked" @dragstart.stop="dragIndex=i;dragType=''" @dragover.prevent @drop.stop.prevent="dropAt(i)" @click="selected=i"><strong>{{i+1}}. {{text(field.config.label)}} <span v-if="field.config.required" style="color:#ef4444">*</span></strong><div class="field-preview"><QuestionField :item="field" :model-value="field.config.defaultValue" :form-key="formKey" disabled/></div><div class="question-tools"><el-button :disabled="locked || busy || !designTypes.includes(field.typeId)" @click.stop="designAssistant.openOptimize(i)">AI 优化</el-button><el-button :disabled="locked||busy||i===0" @click.stop="move(i,-1)">上移</el-button><el-button :disabled="locked||busy||i===fields.length-1" @click.stop="move(i,1)">下移</el-button><el-button :disabled="locked||busy" @click.stop="copy(i)">复制</el-button><el-button :disabled="locked||busy" type="danger" plain @click.stop="remove(i)">删除</el-button></div></article></section><section class="designer-config"><h3>题目设置</h3><div v-if="active"><SimpleFieldSettings :item="active" :disabled="locked" @change="dirty=true"/><el-button type="primary" :loading="busy" :disabled="locked" @click="saveAll">保存设置</el-button></div><el-empty v-else description="请选择题目"/></section><RailToc :items="railItems" container=".designer-canvas" anchor-selector=".question-card" :offset="16" @select="selectRailItem"/></div></template>
<script setup>
import {ref,reactive,computed,onMounted,onBeforeUnmount,watch,provide} from 'vue'
import {useRoute,onBeforeRouteLeave} from 'vue-router'
import {ElMessage,ElMessageBox} from 'element-plus'
import api from '@/api'
import QuestionField from './QuestionField.vue'
import SimpleFieldSettings from './SimpleFieldSettings.vue'
import FormTinymce from '@/components/tinymce/index.vue'
import SurveyDesignAssistant from './SurveyDesignAssistant.vue'
import RailToc from '@/components/RailToc/index.vue'
import { buildRailItems } from '@/components/RailToc/rail'
import { toDesignQuestion, applyDesignQuestion, designTypes } from './design-assistant'
const coreTypes=[
 {typeId:'RADIO',label:'单选题',description:'从选项中选择一项'},
 {typeId:'CHECKBOX',label:'多选题',description:'可以选择多个选项'},
 {typeId:'RATE',label:'量表题',description:'用 1–5 分表达感受'},
 {typeId:'TEXTAREA',label:'开放题',description:'用文字描述经历或建议'}
]
import {clone,createField,formItemConvertData,dbDataConvertForItemJson} from './schema'
defineProps({questionMode:Boolean})
const route=useRoute(),formKey=String(route.query.key||'')
const designAssistant=ref(null)
const fields=ref([]),info=reactive({}),selected=ref(-1),loading=ref(false),busy=ref(false),dirty=ref(false)
provide('tdResolvedOptions',reactive({}))
let dragType='',dragIndex=-1
const active=computed(()=>fields.value[selected.value]),locked=computed(()=>Number(info.status)===2),text=v=>String(v||'').replace(/<[^>]*>/g,'')
const defaultText=computed(()=>typeof active.value?.config.defaultValue==='object'?JSON.stringify(active.value.config.defaultValue):active.value?.config.defaultValue??'')
function setDefault(value){try{active.value.config.defaultValue=JSON.parse(value)}catch{active.value.config.defaultValue=value}dirty.value=true}
async function load(){loading.value=true;try{const [form,items]=await Promise.all([api.get(`/user/form/${formKey}`),api.get('/user/form/item/list',{params:{key:formKey}})]);Object.assign(info,form.data);fields.value=items.data.map(dbDataConvertForItemJson);selected.value=fields.value.length?0:-1;dirty.value=false}finally{loading.value=false}}
const designQuestions=computed(()=>fields.value.map(toDesignQuestion))
// 右侧题目导航轨：序号/标签跟题目卡片一一对应，点击滚动到题卡并选中该题（不影响保存与排序逻辑）。
const railItems=computed(()=>buildRailItems(fields.value,{anchorPrefix:'designer-question',labelOf:field=>text(field.config&&field.config.label),idOf:field=>field.config&&field.config.formId}))
function applyOptimization({index,question}){if(locked.value||busy.value||loading.value)return;fields.value.splice(index,1,applyDesignQuestion(fields.value[index],question));selected.value=index;dirty.value=true}
function locateQuestion(i){selected.value=i;document.querySelectorAll('.native-designer .question-card')[i]?.scrollIntoView({behavior:'smooth',block:'center'})}
function selectRailItem(item){const i=Number(item&&item.index)-1;if(i>=0&&i<fields.value.length)selected.value=i}
onMounted(load)
watch(fields,()=>{if(!loading.value)dirty.value=true},{deep:true,flush:'sync'})
async function add(type){if(locked.value||busy.value)return;busy.value=true;try{const item=createField(type);item.config.label=coreTypes.find(entry=>entry.typeId===type)?.label||item.config.label;const res=await api.post('/user/form/item/create',formItemConvertData(item,formKey));item.sort=res.data.sort;fields.value.push(item);selected.value=fields.value.length-1}catch{}finally{busy.value=false}}
async function saveAll(){if(locked.value||busy.value)return;busy.value=true;try{await api.post('/user/form/update',{formKey,name:info.name,description:info.description});for(const item of fields.value)await api.post('/user/form/item/update',formItemConvertData(item,formKey));dirty.value=false;ElMessage.success('已保存')}finally{busy.value=false}}
async function remove(i){await ElMessageBox.confirm('确定删除该题目？','删除题目',{type:'warning'});busy.value=true;try{await api.post('/user/form/item/delete',formItemConvertData(fields.value[i],formKey));fields.value.splice(i,1);selected.value=Math.min(i,fields.value.length-1)}finally{busy.value=false}}
async function copy(i){if(locked.value)return;const item=clone(fields.value[i]);item.config.formId=createField(item.typeId).config.formId;item.vModel=item.config.formId;delete item.dId;const res=await api.post('/user/form/item/create',formItemConvertData(item,formKey));item.sort=res.data.sort;fields.value.push(item);selected.value=fields.value.length-1}
async function reorder(from,to){if(locked.value||busy.value||from===to)return;busy.value=true;const prev=fields.value.slice();try{const [item]=fields.value.splice(from,1);fields.value.splice(to,0,item);const res=await api.post('/user/form/item/sort',{formKey,formItemId:item.config.formId,beforePosition:fields.value[to-1]?.sort,afterPosition:fields.value[to+1]?.sort});item.sort=res.data.sort;selected.value=to;if(res.data.refreshAll)await load()}catch{fields.value=prev}finally{busy.value=false}}
function move(i,d){return reorder(i,i+d)}
async function drop(){if(dragType)await add(dragType);dragType='';dragIndex=-1}
async function dropAt(i){if(dragType){await add(dragType);await reorder(fields.value.length-1,i)}else if(dragIndex>=0)await reorder(dragIndex,i);dragType='';dragIndex=-1}
function addOption(){const ops=active.value.config.options;const next=Math.max(0,...ops.map(x=>Number(x.value)||0))+1;ops.push({label:`选项${next}`,value:next});dirty.value=true}
onBeforeRouteLeave(async()=>{if(!dirty.value)return true;try{await ElMessageBox.confirm('当前修改尚未保存，是否离开？','未保存修改',{type:'warning'});return true}catch{return false}})
const beforeUnload=e=>{if(dirty.value){e.preventDefault();e.returnValue=''}}
window.addEventListener('beforeunload',beforeUnload);onBeforeUnmount(()=>window.removeEventListener('beforeunload',beforeUnload))
</script>
<style scoped>
.designer-title,.question-tools{flex-wrap:wrap}
.question-tools .el-button{margin-left:0}
/* 右侧题目导航轨通道：仅桌面宽度留白，窄屏 rail 隐藏后不占空间 */
@media (min-width:1100px){.native-designer .designer-canvas{padding-right:64px}}
</style>
