<template><img :src="url" :width="size" :height="size" alt="二维码" /></template>
<script setup>
import {ref,watch} from 'vue'
import QRCode from 'qrcode'
const props=defineProps({text:String,size:{type:Number,default:160},margin:{type:Number,default:1},callback:Function})
const url=ref('')
watch(()=>[props.text,props.size,props.margin],async()=>{url.value=await QRCode.toDataURL(props.text||' ',{width:props.size,margin:props.margin});props.callback?.(url.value)},{immediate:true})
</script>
