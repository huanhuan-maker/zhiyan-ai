<template>
 <el-form label-position="top" :disabled="disabled" @input="$emit('change')" @change="$emit('change')">
  <el-form-item label="题目标题"><FormTinymce v-model:value="item.config.label" :disabled="disabled" @update:value="$emit('change')"/></el-form-item>
  <el-form-item label="必填"><el-switch v-model="item.config.required"/></el-form-item>
  <el-form-item label="显示标题"><el-switch v-model="item.config.showLabel"/></el-form-item>
  <el-form-item v-if="!item.config.displayType" label="提示文字"><el-input v-model="item.placeholder"/></el-form-item>
  <el-form-item v-if="!item.config.displayType" label="默认值"><el-input :model-value="defaultText" @update:model-value="setDefault"/></el-form-item>
  <template v-if="item.config.options">
   <el-form-item label="选项来源" v-if="'optionsType' in item.config"><el-radio-group v-model="item.config.optionsType"><el-radio :value="0">静态</el-radio><el-radio :value="1">动态</el-radio></el-radio-group></el-form-item>
   <template v-if="item.config.optionsType===1"><el-form-item v-for="(label,key) in dynamicLabels" :key="key" :label="label"><el-input v-model="item.config.dynamicOptions[key]"/></el-form-item></template>
   <el-form-item v-else label="选项设置"><div v-for="(op,i) in item.config.options" :key="i" class="field-option-editor"><el-input v-model="op.label" placeholder="选项文字"/><el-input v-if="['IMAGE_SELECT','IMAGE_CAROUSEL'].includes(item.typeId)" v-model="op.image" placeholder="图片地址"/><el-input v-if="'value' in op" v-model="op.value" placeholder="选项值"/><el-button :disabled="i===0" @click="move(item.config.options,i,-1)">↑</el-button><el-button @click="item.config.options.splice(i,1);changed()">删除</el-button></div><el-button @click="addOption">添加选项</el-button><el-button v-if="['RADIO','CHECKBOX'].includes(item.typeId)" @click="addOther">添加“其他”选项</el-button></el-form-item>
  </template>
  <template v-if="item.table">
   <el-form-item label="矩阵行"><div v-for="(row,i) in item.table.rows" :key="row.id" class="field-option-editor"><el-input v-model="row.label"/><el-button @click="item.table.rows.splice(i,1);changed()">删除</el-button></div><el-button @click="addMatrix('rows')">添加行</el-button></el-form-item>
   <el-form-item v-if="item.table.columns" label="矩阵列"><div v-for="(col,i) in item.table.columns" :key="col.id" class="field-option-editor"><el-input v-model="col.label"/><el-button @click="item.table.columns.splice(i,1);changed()">删除</el-button></div><el-button @click="addMatrix('columns')">添加列</el-button></el-form-item>
   <el-form-item v-if="item.table.level" label="量表级数"><el-input-number v-model="item.table.level" :min="1" :max="10"/></el-form-item>
  </template>
  <el-form-item v-if="item.typeId==='SORT'" label="排序选项"><div v-for="(op,i) in item.sortList" :key="op.value" class="field-option-editor"><el-input v-model="op.label"/><el-button @click="item.sortList.splice(i,1);changed()">删除</el-button></div><el-button @click="item.sortList.push({value:Date.now(),label:'新选项'});changed()">添加排序项</el-button></el-form-item>
  <template v-if="item.typeId==='SUB_FORM'"><el-divider>子表单字段</el-divider><el-select v-model="childType"><el-option v-for="child in childTypes" :key="child.typeId" :label="child.config.label" :value="child.typeId"/></el-select><el-button @click="item.childList.push(createField(childType));changed()">添加字段</el-button><el-collapse><el-collapse-item v-for="(child,i) in item.childList" :key="child.config.formId" :title="plain(child.config.label)"><FieldSettings :item="child" :disabled="disabled" @change="changed"/><el-button type="danger" @click="item.childList.splice(i,1);changed()">删除子字段</el-button></el-collapse-item></el-collapse></template>
  <el-form-item v-if="item.typeId==='DATE'" label="日期类型"><el-select v-model="item.type"><el-option v-for="(label,value) in dateTypes" :key="value" :value="value" :label="label"/></el-select></el-form-item>
  <el-form-item v-for="key in scalarKeys" :key="key" :label="labels[key]||key"><el-switch v-if="typeof item[key]==='boolean'" v-model="item[key]"/><el-input-number v-else-if="numericKeys.includes(key)||typeof item[key]==='number'" v-model="item[key]"/><el-input v-else v-model="item[key]" :type="key==='content'?'textarea':'text'"/></el-form-item>
  <el-form-item v-for="key in configScalarKeys" :key="key" :label="labels[key]||key"><el-switch v-if="typeof item.config[key]==='boolean'" v-model="item.config[key]"/><el-input-number v-else-if="typeof item.config[key]==='number'" v-model="item.config[key]"/><el-input v-else v-model="item.config[key]"/></el-form-item>
  <el-form-item v-if="item.textConfig" v-for="(value,key) in item.textConfig" :key="key" :label="textLabels[key]||key"><el-input v-model="item.textConfig[key]"/></el-form-item>
  <el-form-item label="占用列数（24 列布局）"><el-slider v-model="item.config.span" :min="1" :max="24"/></el-form-item>
  <el-divider>校验规则</el-divider><div v-for="(rule,i) in item.config.regList" :key="i" class="field-option-editor"><el-input v-model="rule.pattern" placeholder="正则表达式"/><el-input v-model="rule.message" placeholder="错误提示"/><el-button @click="item.config.regList.splice(i,1);changed()">删除</el-button></div><el-button @click="item.config.regList.push({pattern:'',message:''});changed()">添加校验规则</el-button>
 </el-form>
</template>
<script setup>
import {computed,ref} from 'vue'
import FormTinymce from '@/components/tinymce/index.vue'
import {createField,definitions} from './schema'
const props=defineProps({item:{type:Object,required:true},disabled:Boolean}),emit=defineEmits(['change'])
const changed=()=>emit('change'),plain=v=>String(v||'').replace(/<[^>]*>/g,'')
const childType=ref('INPUT'),childTypes=Object.values(definitions).filter(x=>['INPUT','TEXTAREA','NUMBER','DATE','RADIO','CHECKBOX','SELECT','RATE'].includes(x.typeId))
const labels={min:'最小值',max:'最大值',step:'步长',precision:'小数位数',minlength:'最小长度',maxlength:'最大长度',multiple:'多选',filterable:'可搜索',clearable:'可清空',disabled:'禁用',readonly:'只读',notRepeat:'不允许重复',limit:'最多文件数',accept:'允许文件类型',src:'图片地址',fit:'图片适应方式',alt:'图片说明',content:'内容',color:'颜色',separator:'分隔符','allow-half':'允许半分','show-text':'显示辅助文字','show-score':'显示分数','show-word-limit':'显示字数','show-all-levels':'显示完整路径',inline:'横向排列',border:'选项边框',otherRequired:'“其他”内容必填',showVoteResult:'显示投票结果',buttonText:'按钮文字',fileSize:'文件大小（MB）',requireDetailAddr:'填写详细地址',height:'图片高度',longAndLat:'显示经纬度',defaultNowTime:'默认当前时间'}
const dynamicLabels={url:'选项接口地址',dataPath:'数据路径',valueField:'值字段',labelField:'文字字段',childrenField:'子级字段'}
const textLabels={prevBtnText:'上一页文字',nextBtnText:'下一页文字',tips:'提示文字',clearBtnText:'清空按钮文字',confirmBtnText:'确认按钮文字',backBtnText:'回撤按钮文字',reSignBtnText:'重签按钮文字'}
const dateTypes={date:'日期',datetime:'日期时间',daterange:'日期范围',datetimerange:'时间范围',year:'年',month:'月'}
const numericKeys=['min','max','step','precision','minlength','maxlength','limit']
const scalarKeys=computed(()=>Object.keys(props.item).filter(k=>k in labels&&k!=='type'&&k!=='placeholder'&&['string','number','boolean'].includes(typeof props.item[k])||numericKeys.includes(k)&&props.item[k]==null))
const configScalarKeys=computed(()=>Object.keys(props.item.config).filter(k=>k in labels&&['string','number','boolean'].includes(typeof props.item.config[k])))
const defaultText=computed(()=>props.item.config.defaultValue==null?'':typeof props.item.config.defaultValue==='object'?JSON.stringify(props.item.config.defaultValue):props.item.config.defaultValue)
function setDefault(v){try{props.item.config.defaultValue=JSON.parse(v)}catch{props.item.config.defaultValue=v}changed()}
function addOption(){const ops=props.item.config.options;const n=Math.max(0,...ops.map(x=>Number(x.value)||0))+1;ops.push({label:`选项${n}`,value:n});changed()}
function addOther(){props.item.config.options.push({label:'其他',value:0,type:'input'});changed()}
function addMatrix(key){const arr=props.item.table[key],id=Math.max(0,...arr.map(x=>Number(x.id)||0))+1;arr.push({id,label:`${key==='rows'?'行':'列'}${id}`});changed()}
function move(arr,i,d){[arr[i],arr[i+d]]=[arr[i+d],arr[i]];changed()}
</script>
<style scoped>.field-option-editor{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.field-option-editor .el-input{flex:1;min-width:80px}</style>
