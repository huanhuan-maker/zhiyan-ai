import Component from './verification.vue'
import {mountOverlay} from '@/compat/overlays'
export default options=>new Promise((resolve,reject)=>{
 const vm=mountOverlay(Component,{...options,callback:(action,val)=>{vm.closeOverlay();action==='verifySuccess'?resolve(val):reject(new Error('已取消验证'))}})
 vm.$nextTick(()=>vm.$refs.verify?.show())
})
