<template><el-dialog :model-value="value" title="裁剪图片" width="550px" @update:model-value="$emit('update:value',$event)"><input type="file" accept="image/*" @change="load"/><canvas ref="canvas" width="400" height="250" style="max-width:100%"/><template #footer><el-button @click="$emit('update:value',false)">取消</el-button><el-button type="primary" :disabled="!ready" @click="upload">确定上传</el-button></template></el-dialog></template>
<script setup>
import {ref} from 'vue'
import api from '@/api'
const props=defineProps({value:Boolean,url:String,params:Object,headers:Object,field:{type:String,default:'file'},width:{type:Number,default:200},height:{type:Number,default:200}})
const emit=defineEmits(['update:value','crop-success','crop-upload-success','crop-upload-fail'])
const canvas=ref(),ready=ref(false)
function load(e){const file=e.target.files?.[0];if(!file)return;const image=new Image();image.onload=()=>{const c=canvas.value;c.width=props.width;c.height=props.height;const k=Math.max(c.width/image.width,c.height/image.height);c.getContext('2d').drawImage(image,(c.width-image.width*k)/2,(c.height-image.height*k)/2,image.width*k,image.height*k);URL.revokeObjectURL(image.src);ready.value=true};image.src=URL.createObjectURL(file)}
function upload(){emit('crop-success',canvas.value.toDataURL('image/png'));canvas.value.toBlob(async blob=>{try{const body=new FormData();body.append(props.field,blob,'crop.png');for(const[k,v]of Object.entries(props.params||{}))body.append(k,v);const response=await api.post((props.url||'/user/file/upload').replace(/^\/tduck-api/,''),body,{headers:{...props.headers,'Content-Type':undefined}});emit('crop-upload-success',response,props.field);emit('update:value',false)}catch(error){emit('crop-upload-fail',error,props.field)}},'image/png')}
</script>
