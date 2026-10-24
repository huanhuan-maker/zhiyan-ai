<template>
  <el-form label-position="top" :disabled="disabled" @input="changed" @change="changed">
    <el-form-item label="题目标题"><el-input :model-value="title" type="textarea" :rows="2" placeholder="请输入题目" @update:model-value="setTitle" /></el-form-item>
    <el-form-item label="必填"><el-switch v-model="item.config.required" /></el-form-item>
    <template v-if="['RADIO','CHECKBOX'].includes(item.typeId)">
      <el-form-item v-if="item.config.optionsType!==1" label="选项">
        <div v-for="(option,index) in item.config.options" :key="option.value" class="simple-option">
          <el-input v-model="option.label" :placeholder="`选项 ${index+1}`" />
          <el-button :disabled="item.config.options.length<=2" aria-label="删除选项" @click="item.config.options.splice(index,1);changed()">删除</el-button>
        </div>
        <el-button @click="addOption">添加选项</el-button>
      </el-form-item>
      <el-alert v-else title="此题使用动态选项，可在更多设置中调整。" type="info" :closable="false" />
    </template>
    <template v-if="item.typeId==='RATE'">
      <el-form-item label="量表分值"><el-select v-model="item.max"><el-option v-for="value in [5,7,10]" :key="value" :value="value" :label="`1–${value} 分`" /></el-select></el-form-item>
      <p class="simple-hint">适合满意度、认同程度等评分。</p>
    </template>
    <el-form-item v-if="['INPUT','TEXTAREA'].includes(item.typeId)" label="填写提示"><el-input v-model="item.placeholder" placeholder="例如：请描述你的经历或建议" /></el-form-item>
  </el-form>
  <el-collapse :key="item.config.formId" class="extra-settings">
    <el-collapse-item title="更多设置" name="more"><FieldSettings :item="item" :disabled="disabled" @change="changed" /></el-collapse-item>
  </el-collapse>
</template>
<script setup>
import {computed} from 'vue'
import unescape from 'lodash/unescape'
import FieldSettings from './FieldSettings.vue'
const props=defineProps({item:{type:Object,required:true},disabled:Boolean})
const emit=defineEmits(['change']),changed=()=>emit('change')
const title=computed(()=>unescape(String(props.item.config.label||'').replace(/<[^>]*>/g,'')))
function setTitle(value){props.item.config.label=value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');changed()}
function addOption(){const options=props.item.config.options,value=Math.max(0,...options.map(option=>Number(option.value)||0))+1;options.push({value,label:`选项${options.length+1}`});changed()}
</script>
<style scoped>
.simple-option{display:flex;gap:8px;margin-bottom:8px;width:100%}.simple-hint{color:#8492a6;font-size:13px}.extra-settings{margin:20px 0}
</style>
