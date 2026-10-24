<template>
  <el-input v-if="['INPUT','TEXTAREA'].includes(type)" :model-value="modelValue" :type="type==='TEXTAREA'?'textarea':'text'" :rows="4" :placeholder="item.placeholder" :maxlength="item.maxlength" :minlength="item.minlength" :show-word-limit="item['show-word-limit']" :disabled="disabled||item.disabled" :readonly="item.readonly" @update:model-value="update" />
  <el-input-number v-else-if="type==='NUMBER'" :model-value="modelValue" :min="item.min??undefined" :max="item.max??undefined" :step="item.step||1" :precision="item.precision??undefined" :disabled="disabled" @update:model-value="update"/>
  <el-radio-group v-else-if="type==='RADIO'||(type==='IMAGE_SELECT'&&!item.multiple)" :model-value="modelValue" :disabled="disabled" @update:model-value="update"><el-radio v-for="op in options" :key="op.value" :value="op.value" :border="item.config.border"><img v-if="op.image" :src="op.image" width="100"/>{{text(op.label)}}</el-radio></el-radio-group>
  <el-checkbox-group v-else-if="type==='CHECKBOX'||type==='IMAGE_SELECT'" :model-value="Array.isArray(modelValue)?modelValue:[]" :min="item.min??undefined" :max="item.max??undefined" :disabled="disabled||optionsLoading" @update:model-value="changeSelection"><el-checkbox v-for="op in options" :key="op.value" :value="op.value" :border="item.config.border"><img v-if="op.image" :src="op.image" width="100"/>{{text(op.label)}}</el-checkbox></el-checkbox-group>
  <el-select v-else-if="type==='SELECT'" :model-value="modelValue" :multiple="item.multiple" :filterable="item.filterable" :clearable="item.clearable" :disabled="disabled" :placeholder="item.placeholder" @update:model-value="update"><el-option v-for="op in options" :key="op.value" :label="text(op.label)" :value="op.value"/></el-select>
  <el-cascader v-else-if="type==='CASCADER'" :model-value="modelValue" :options="options" :props="item.props?.props" :disabled="disabled" @update:model-value="update"/>
  <div v-else-if="type==='PROVINCE_CITY'"><el-cascader :model-value="modelValue?.cascadeValue" :options="regions" :disabled="disabled" @update:model-value="update({...modelValue,cascadeValue:$event})"/><el-input v-if="item.config.requireDetailAddr" :model-value="modelValue?.detailAddr" placeholder="详细地址" :disabled="disabled" @update:model-value="update({...modelValue,detailAddr:$event})"/></div>
  <el-date-picker v-else-if="type==='DATE'" :model-value="modelValue" :type="item.type||'date'" :value-format="dateFormat" :format="dateFormat" :disabled="disabled" @update:model-value="update"/>
  <el-rate v-else-if="type==='RATE'" :model-value="Number(modelValue)||0" :max="item.max||5" :allow-half="item['allow-half']" :show-score="item['show-score']" :disabled="disabled" @update:model-value="update"/>
  <el-slider v-else-if="type==='SLIDER'" :model-value="Number(modelValue)||0" :min="item.min||0" :max="item.max||100" :step="item.step||1" :disabled="disabled" @update:model-value="update"/>
  <el-divider v-else-if="type==='DIVIDER'">{{item.content}}</el-divider>
  <div v-else-if="type==='DESC_TEXT'" v-html="safeHtml(safe(item.content))"/>
  <el-image v-else-if="type==='IMAGE'" :src="item.src" :fit="item.fit||'contain'" style="max-width:100%"/>
  <el-carousel v-else-if="type==='IMAGE_CAROUSEL'" :height="`${item.config.height||300}px`"><el-carousel-item v-for="(op,i) in options" :key="i"><el-image :src="op.image" fit="contain" style="height:100%;width:100%"/></el-carousel-item></el-carousel>
  <el-upload v-else-if="['UPLOAD','IMAGE_UPLOAD'].includes(type)" :action="`/tduck-api/form/file/upload/${formKey}`" :headers="headers" :accept="item.accept" :limit="item.limit||2" :multiple="item.multiple" :disabled="disabled" :file-list="Array.isArray(modelValue)?modelValue:[]" :before-upload="beforeUpload" :on-success="uploaded" :on-error="uploadError" :on-remove="removed"><el-button>点击上传</el-button></el-upload>
  <div v-else-if="type==='SIGN_PAD'"><canvas ref="signatureCanvas" width="480" height="180" style="border:1px solid #ddd;max-width:100%;touch-action:none"/><div><el-button :disabled="disabled" @click="pad?.clear();update('')">清除</el-button><el-button :disabled="disabled" @click="saveSignature">确认签名</el-button></div><el-image v-if="modelValue" :src="modelValue" style="height:70px"/></div>
  <div v-else-if="type==='SORT'"><div v-for="(op,i) in sortValue" :key="op.value" class="sort-row">{{op.label}}<el-button :disabled="disabled||i===0" @click="moveSort(i,-1)">↑</el-button><el-button :disabled="disabled||i===sortValue.length-1" @click="moveSort(i,1)">↓</el-button></div></div>
  <table v-else-if="type.startsWith('MATRIX_')" class="question-matrix"><thead v-if="type==='MATRIX_INPUT'"><tr><th/><th v-for="col in item.table.columns" :key="col.id">{{col.label}}</th></tr></thead><tbody><tr v-for="row in item.table.rows" :key="row.id"><th>{{row.label}}</th><template v-if="type==='MATRIX_INPUT'"><td v-for="col in item.table.columns" :key="col.id"><el-input :model-value="modelValue?.[row.id]?.[col.id]" :disabled="disabled" @update:model-value="matrixCell(row.id,col.id,$event)"/></td></template><td v-else-if="type==='MATRIX_SELECT'"><component :is="item.multiple?'el-checkbox-group':'el-radio-group'" :model-value="modelValue?.[row.id]??(item.multiple?[]:null)" :disabled="disabled" @update:model-value="matrixRow(row.id,$event)"><component :is="item.multiple?'el-checkbox':'el-radio'" v-for="col in item.table.columns" :key="col.id" :value="col.label">{{col.label}}</component></component></td><td v-else><el-rate :model-value="modelValue?.[row.id]||0" :max="item.table.level||5" :disabled="disabled" @update:model-value="matrixRow(row.id,$event)"/></td></tr></tbody></table>
  <div v-else-if="type==='SUB_FORM'"><div v-for="(row,i) in modelValue||[]" :key="i" class="sub-form-row"><div v-for="child in item.childList" :key="child.config.formId"><label>{{text(child.config.label)}}</label><QuestionField :item="child" :models="row" :form-key="formKey" :disabled="disabled" :model-value="row[child.config.formId]" @update:model-value="subCell(i,child.config.formId,$event)"/></div><el-button :disabled="disabled" @click="update(modelValue.filter((_,n)=>n!==i))">删除行</el-button></div><el-button :disabled="disabled" @click="update([...(modelValue||[]),{}])">添加一行</el-button></div>
  <div v-else-if="type==='INPUT_MAP'"><el-input :model-value="modelValue?.address||''" placeholder="地址" :disabled="disabled" @update:model-value="update({...modelValue,address:$event})"/><el-button :disabled="disabled" @click="locate">获取当前位置</el-button><span v-if="modelValue?.lng">{{modelValue.lng}}, {{modelValue.lat}}</span></div>
  <div v-else-if="type==='PHONE_VERIFICATION'"><el-input v-model="phone" placeholder="手机号" :disabled="disabled"/><el-button :disabled="disabled||smsBusy" @click="sendCode">发送验证码</el-button><el-input v-model="smsCode" placeholder="验证码" :disabled="disabled"/><el-button :disabled="disabled" @click="checkCode">验证</el-button><span v-if="modelValue">已验证</span></div>
  <el-alert v-else-if="type!=='PAGINATION'" type="error" :closable="false" :title="`无法识别题型：${type}`"/>
  <span v-if="optionsLoading" role="status">选项加载中…</span>
  <el-alert v-if="optionsError" type="error" :closable="false" :title="optionsError"><el-button @click="loadOptions">重试加载选项</el-button></el-alert>
  <el-input v-if="['RADIO','CHECKBOX'].includes(type)&&(modelValue===0||Array.isArray(modelValue)&&modelValue.includes(0))" :model-value="models[item.config.formId+'other']" placeholder="请输入其他内容" :disabled="disabled" @update:model-value="models[item.config.formId+'other']=$event"/>
</template>
<script setup>
import {computed,ref,onMounted,onBeforeUnmount,watch,inject} from 'vue'
import SignaturePad from 'signature_pad'
import DOMPurify from 'dompurify'
import {ElMessage} from 'element-plus'
import api from '@/api'
import store from '@/store'
import areaData from 'china-area-data'
import {remoteOptions,exclusiveSelection} from './options'
const props=defineProps({item:{type:Object,required:true},modelValue:null,models:{type:Object,default:()=>({})},formKey:String,disabled:Boolean})
const emit=defineEmits(['update:modelValue'])
const update=value=>emit('update:modelValue',value)
const type=computed(()=>props.item.typeId),options=ref([]),regions=ref([]),phone=ref(''),smsCode=ref(''),smsBusy=ref(false)
const disabled=computed(()=>props.disabled||props.item.disabled)
const resolvedOptions=inject('tdResolvedOptions',null),optionsLoading=ref(false),optionsError=ref('')
let optionsRequest,requestVersion=0
function setOptions(value){options.value=value;if(resolvedOptions)resolvedOptions[props.item.config.formId]=value}
watch(()=>props.item.config.options,value=>{if(props.item.config.optionsType!==1)setOptions(value||[])},{immediate:true,deep:true})
watch(()=>JSON.stringify([props.item.config.optionsType,props.item.config.dynamicOptions]),loadOptions,{immediate:true})
async function loadOptions(){
  optionsRequest?.abort();const version=++requestVersion;optionsError.value=''
  if(props.item.config.optionsType!==1){optionsLoading.value=false;setOptions(props.item.config.options||[]);return}
  setOptions([])
  const config=props.item.config.dynamicOptions||{}
  if(!config.url){optionsLoading.value=false;optionsError.value='请配置动态选项接口地址';return}
  optionsRequest=new AbortController();const controller=optionsRequest
  optionsLoading.value=true
  const timeout=setTimeout(()=>controller.abort(),15000)
  try{
    const response=await fetch(config.url,{signal:controller.signal})
    if(!response.ok)throw new Error(`HTTP ${response.status}`)
    const rows=remoteOptions(await response.json(),config)
    if(version===requestVersion)setOptions(rows)
  }catch(error){if(version===requestVersion)optionsError.value=`选项加载失败：${error.name==='AbortError'?'请求超时':error.message}`}
  finally{clearTimeout(timeout);if(version===requestVersion)optionsLoading.value=false}
}
function changeSelection(value){update(exclusiveSelection(Array.isArray(props.modelValue)?props.modelValue:[],value,props.item.config))}
const safe=value=>DOMPurify.sanitize(String(value||'')),text=value=>String(value||'').replace(/<[^>]*>/g,'')
const dateFormat=computed(()=>(props.item['value-format']||'YYYY-MM-DD').replace(/yyyy/g,'YYYY').replace(/dd/g,'DD'))
const headers=computed(()=>({token:store.state.user.token||''}))
const signatureCanvas=ref();let pad
onMounted(()=>{if(signatureCanvas.value){pad=new SignaturePad(signatureCanvas.value,{penColor:props.item.color||'#000'});if(disabled.value)pad.off()}if(type.value==='PROVINCE_CITY'){const tree=(code,depth)=>Object.entries(areaData[code]||{}).map(([id,label])=>({label,value:label,...(depth<2&&Object.keys(areaData[id]||{}).length?{children:tree(id,depth+1)}:{})}));regions.value=tree('86',0)}})
watch(disabled,value=>{if(pad)value?pad.off():pad.on()})
onBeforeUnmount(()=>{pad?.off();requestVersion++;optionsRequest?.abort()})
function beforeUpload(file){const max=props.item.config.fileSize||10;if(file.size>max*1024*1024){ElMessage.error(`文件不能超过 ${max} MB`);return false}return true}
function uploaded(res,file){if(res.code!==200){ElMessage.error(res.msg||'上传失败');return}const value=typeof res.data==='string'?{url:res.data}:res.data;update([...(props.modelValue||[]),{...value,name:file.name,url:value.url||value.fileUrl}])}
const uploadError=()=>ElMessage.error('上传失败，请重试')
function removed(file){update((props.modelValue||[]).filter(x=>x.url!==file.url))}
async function saveSignature(){if(!pad||pad.isEmpty()){ElMessage.warning('请先签名');return}const blob=await(await fetch(pad.toDataURL())).blob();const data=new FormData();data.append('file',blob,'signature.png');const res=await api.post(`/form/file/upload/${props.formKey}`,data,{headers:{'Content-Type':undefined}});update(typeof res.data==='string'?res.data:res.data.url)}
const sortValue=computed(()=>props.modelValue?.length?props.modelValue:props.item.sortList||[])
function moveSort(i,delta){const arr=sortValue.value.slice();[arr[i],arr[i+delta]]=[arr[i+delta],arr[i]];update(arr)}
function matrixRow(row,value){update({...props.modelValue,[row]:value})}
function matrixCell(row,col,value){matrixRow(row,{...props.modelValue?.[row],[col]:value})}
function subCell(i,key,value){const arr=(props.modelValue||[]).map(x=>({...x}));arr[i][key]=value;update(arr)}
function locate(){navigator.geolocation.getCurrentPosition(p=>update({...props.modelValue,lng:p.coords.longitude,lat:p.coords.latitude}),()=>ElMessage.error('无法获取位置，请允许浏览器定位或填写地址'))}
async function sendCode(){smsBusy.value=true;try{await api.get('/form/common/phone/code',{params:{phoneNumber:phone.value}});ElMessage.success('验证码已发送')}finally{smsBusy.value=false}}
async function checkCode(){await api.post('/form/common/phone/code/check',{phoneNumber:phone.value,code:smsCode.value});update(phone.value)}
</script>
