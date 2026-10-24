import {createApp,h} from 'vue'
import ElementPlus,{ElMessage,ElMessageBox,ElNotification} from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import dayjs from 'dayjs'
import Cookies from 'js-cookie'
import DOMPurify from 'dompurify'
import App from './App.vue'
import router from './router'
import store,{pinia} from './store'
import api from './api'
import Process from './components/HandleProcess/process'
import {parseTime,resetForm,download} from './utils/tduck'
import {setOverlayContext} from './compat/overlays'
import '@/assets/styles/index.scss'
import '@/assets/legacy-icons/icon.css'
import './assets/icons'
import VxeTable from 'vxe-table'
import VxeUI from 'vxe-pc-ui'
import 'vxe-pc-ui/lib/style.css'
import 'vxe-table/lib/style.css'
const app=createApp(App)
app.use(pinia).use(router).use(ElementPlus,{locale:zhCn,zIndex:3000}).use(VxeUI).use(VxeTable)
Object.assign(app.config.globalProperties,{$api:api,$store:store,$dayjs:dayjs,$cookies:Cookies,$message:ElMessage,$confirm:ElMessageBox.confirm,$prompt:ElMessageBox.prompt,$alert:ElMessageBox.alert,$notify:ElNotification,$process:Process,parseTime,resetForm,download,
 safeHtml:value=>DOMPurify.sanitize(String(value||'')),
 tdIcon:(name)=>({render:()=>h('i',{class:name})}),
 msgSuccess:msg=>ElMessage.success(msg),msgError:msg=>ElMessage.error(msg),msgWarning:msg=>ElMessage.warning(msg),msgInfo:msg=>ElMessage.info(msg),
 $set:(obj,key,value)=>(obj[key]=value),$delete:(obj,key)=>delete obj[key]
})
for(const m of Object.values(import.meta.glob('./components/**/index.vue',{eager:true})))if(m.default.name)app.component(m.default.name,m.default)
app.directive('clipboard',{mounted(el,binding){if(binding.arg&&binding.arg!=='copy')return;el.__copyValue=binding.value;el.__copy=()=>navigator.clipboard.writeText(String(el.__copyValue||'')).then(()=>ElMessage.success('复制成功')).catch(()=>ElMessage.error('复制失败，请手动复制'));el.addEventListener('click',el.__copy)},updated(el,binding){if(!binding.arg||binding.arg==='copy')el.__copyValue=binding.value},unmounted(el,binding){if((!binding.arg||binding.arg==='copy')&&el.__copy)el.removeEventListener('click',el.__copy)}})
app.directive('focus',{mounted:el=>el.querySelector('input')?.focus()})
app.directive('preventReClick',{mounted(el,binding){el.addEventListener('click',()=>{el.disabled=true;setTimeout(()=>{el.disabled=false},binding.value||1000)})}})
app.directive('re-click',{mounted(el){el.addEventListener('click',()=>{el.disabled=true;setTimeout(()=>{el.disabled=false},1000)})}})
setOverlayContext(app._context)
app.mount('#app')
