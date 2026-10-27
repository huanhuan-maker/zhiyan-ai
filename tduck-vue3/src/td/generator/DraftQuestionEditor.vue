<template>
  <el-dialog :model-value="modelValue" :title="`编辑第 ${index + 1} 题`" width="min(620px, 94vw)" append-to-body destroy-on-close :close-on-click-modal="false" class="draft-question-dialog" @update:model-value="$emit('update:modelValue', $event)">
    <p class="edit-intro">修改当前草稿中的这道题，其他题目保持原样。</p>
    <el-form v-if="draft" label-position="top" @submit.prevent="save">
      <el-form-item label="题干" required><el-input v-model="draft.label" aria-label="题干" type="textarea" :rows="3" maxlength="200" show-word-limit /></el-form-item>
      <div class="edit-settings"><el-form-item label="题型"><el-select v-model="draft.type" aria-label="题型" @change="changeType"><el-option label="单选题" value="RADIO" /><el-option label="多选题" value="CHECKBOX" /><el-option label="评分题" value="RATE" /><el-option label="开放题" value="TEXTAREA" /></el-select></el-form-item><el-form-item label="是否必填"><el-switch v-model="draft.required" aria-label="必填" /><span class="required-description">{{ draft.required ? '必填' : '选填' }}</span></el-form-item></div>
      <el-form-item v-if="['RADIO', 'CHECKBOX'].includes(draft.type)" label="选项（2～20 个）" required>
        <div class="edit-options"><div v-for="(_, i) in draft.options" :key="i" class="edit-option"><span>{{ i + 1 }}</span><el-input v-model="draft.options[i]" :aria-label="`选项 ${i + 1}`" maxlength="200" /><el-button text type="danger" :aria-label="`删除选项 ${i + 1}`" :disabled="draft.options.length <= 2" @click="draft.options.splice(i, 1)">删除</el-button></div><el-button :disabled="draft.options.length >= 20" @click="draft.options.push('')">添加选项</el-button></div>
      </el-form-item>
      <el-form-item v-if="draft.type === 'RATE'" label="评分范围"><span class="rate-start">1 至</span><el-input-number v-model="draft.rateMax" aria-label="评分上限" :min="2" :max="10" :precision="0" /><span class="rate-start">分</span></el-form-item>
      <el-form-item v-if="draft.type === 'TEXTAREA'" label="回答提示"><el-input v-model="draft.placeholder" aria-label="回答提示" maxlength="200" placeholder="选填，例如：请结合具体经历描述" /></el-form-item>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    </el-form>
    <template #footer><div class="edit-footer"><span>保存到当前草稿，导入编辑器后保存为问卷。</span><div><el-button @click="$emit('update:modelValue', false)">取消</el-button><el-button type="primary" @click="save">保存修改</el-button></div></div></template>
  </el-dialog>
</template>
<script setup>
import {ref,watch} from 'vue'
import {editedDraftQuestion} from './draft-edit'
const props=defineProps({modelValue:Boolean,question:Object,questions:{type:Array,default:()=>[]},index:{type:Number,default:0}})
const emit=defineEmits(['update:modelValue','save'])
const draft=ref(null),error=ref('')
watch(()=>props.modelValue,open=>{if(open&&props.question){draft.value=JSON.parse(JSON.stringify(props.question));draft.value.required=props.question.required!==false;error.value=''}},{immediate:true})
function changeType(){error.value='';if(['RADIO','CHECKBOX'].includes(draft.value.type)&&(!draft.value.options||draft.value.options.length<2))draft.value.options=['选项一','选项二'];if(draft.value.type==='RATE'&&!draft.value.rateMax)draft.value.rateMax=5}
function save(){if(!draft.value)return;try{const question=editedDraftQuestion(draft.value,props.questions,props.index);emit('save',question);emit('update:modelValue',false)}catch(e){error.value=e.message}}
</script>
<style>
.draft-question-dialog{--el-dialog-bg-color:var(--zy-surface,#fff);color:var(--zy-text,#243247);border-radius:12px}.draft-question-dialog .el-dialog__body{max-height:calc(100dvh - 220px);overflow-y:auto}.draft-question-dialog .edit-intro{margin:0 0 18px;color:var(--zy-text-secondary,#667085);font-size:12px;line-height:1.7}.draft-question-dialog .edit-settings{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}.draft-question-dialog .edit-options{width:100%;min-width:0}.draft-question-dialog .edit-option{display:flex;align-items:center;gap:10px;margin-bottom:10px}.draft-question-dialog .edit-option>span{flex:none;width:16px;color:var(--zy-text-secondary,#667085)}.draft-question-dialog .edit-option .el-input{flex:1;min-width:0}.draft-question-dialog .edit-option .el-button{flex:none;margin:0}.draft-question-dialog .required-description,.draft-question-dialog .rate-start{margin:0 8px;font-size:12px;color:var(--zy-text-secondary,#667085)}.draft-question-dialog .edit-footer{display:flex;gap:14px;align-items:center;justify-content:space-between}.draft-question-dialog .edit-footer>span{font-size:11px;color:var(--zy-text-secondary,#667085);line-height:1.6;text-align:left}.draft-question-dialog .edit-footer>div{display:flex;flex:none;gap:10px}.draft-question-dialog .edit-footer .el-button{margin:0}
.draft-question-dialog.el-dialog .el-dialog__header,.draft-question-dialog.el-dialog .el-dialog__footer{background:var(--zy-surface,#fff);border-color:var(--zy-border-light,#edf0f4)}.draft-question-dialog.el-dialog .el-dialog__header .el-dialog__title{color:var(--zy-text,#243247)}
.draft-question-dialog .edit-option .el-button--danger.is-text{color:#b42318;background:#fff1f0;border:1px solid #ffd1cc}.draft-question-dialog .edit-option .el-button--danger.is-text:hover{background:#ffe4e0}.draft-question-dialog .edit-option .el-button--danger.is-disabled{color:#a88783;background:var(--zy-surface-subtle,#f8f9fb);border-color:var(--zy-border,#e4e7ec)}
.zy-dark .draft-question-dialog .edit-option .el-button--danger.is-text:not(.is-disabled){color:#f4a6ad;background:#342633;border-color:#603b47}
@media(max-width:600px){.draft-question-dialog{margin-top:4vh}.draft-question-dialog .edit-settings{gap:14px}.draft-question-dialog .edit-footer{align-items:stretch;flex-direction:column}.draft-question-dialog .edit-footer>div{justify-content:flex-end}.draft-question-dialog .el-dialog__body{max-height:calc(100dvh - 235px)}}
</style>
