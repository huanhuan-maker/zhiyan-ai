import {createRouter,createWebHistory} from 'vue-router'
import store from '@/store'
const modules=import.meta.glob('./modules/*.js',{eager:true})
const routes=Object.values(modules).flatMap(m=>m.default)
const home=routes.find(r=>r.path==='/home');home.children[0].path=''
routes.find(r=>r.path==='/').redirect='/home'
routes.push({path:'/:pathMatch(.*)*',component:()=>import('@/views/404.vue')})
const router=createRouter({history:createWebHistory(),routes})
router.beforeEach(to=>{
 if(to.matched.some(r=>r.meta.requireLogin)&&!store.getters['user/isLogin'])return {path:'/login',query:{redirect:to.fullPath}}
 if(to.path.startsWith('/manage')||['/project/template/category','/project/theme/category','/project/theme/index'].includes(to.path)){
  let user={};try{user=JSON.parse(store.state.user.userInfo||'{}')}catch{}
  if(!user.admin)return '/home'
 }
 document.title=to.meta.title?`${to.meta.title} - TDuck`:'TDuck'
})
export default router
