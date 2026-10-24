import {createVNode,render,nextTick} from 'vue'
let context
export function setOverlayContext(value){context=value}
export function mountOverlay(Component,options={}){
 const host=document.createElement('div');document.body.append(host)
 const Original=Component.data
 const node=createVNode({...Component,data(){return {...(Original?Original.call(this):{}),...options}},methods:{...Component.methods,closeOverlay(){render(null,host);host.remove()}}})
 node.appContext=context;render(node,host)
 nextTick(()=>{if(node.component?.proxy)node.component.proxy.visible=true})
 return node.component.proxy
}
