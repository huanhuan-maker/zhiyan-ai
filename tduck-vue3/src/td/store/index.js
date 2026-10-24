import { createPinia, defineStore } from 'pinia'
import { computed } from 'vue'
export const pinia = createPinia()
const modules = Object.fromEntries(Object.entries(import.meta.glob('./modules/*.js', {eager:true})).map(([p,m])=>[p.split('/').pop().slice(0,-3),m.default]))
const useState = defineStore('tduck', {state:()=>Object.fromEntries(Object.entries(modules).map(([k,m])=>[k,m.state]))})
const state = useState(pinia)
const getters = {}
for (const [name,m] of Object.entries(modules)) for(const [key,get] of Object.entries(m.getters||{})) {
 const value=computed(()=>get(state[name],getters,state))
 Object.defineProperty(getters,`${name}/${key}`,{get:()=>value.value})
}
const store={state,getters,
 commit(type,payload){const [name,key]=type.split('/');modules[name].mutations[key](state[name],payload)},
 dispatch(type,payload){const [name,key]=type.split('/');return Promise.resolve(modules[name].actions[key]({state:state[name],rootState:state,getters,commit:(key,data)=>store.commit(key.includes('/')?key:`${name}/${key}`,data),dispatch:(key,data)=>store.dispatch(key.includes('/')?key:`${name}/${key}`,data)},payload))}
}
export default store
