// Synthetic acceptance demo only. Never modifies existing surveys.
// Archived after the user retired this product direction.
import fs from 'node:fs'
import {allComponents} from '../../tduck-vue3/src/td/generator/config.js'
throw Error('追问方向已停用，演示脚本仅作历史归档，不再创建或调用追问问卷')
function createField(type){const item=structuredClone(allComponents.flatMap(g=>g.list).find(q=>q.typeId===type));item.config.formId=type.toLowerCase()+Date.now()+Math.floor(Math.random()*1000);item.vModel=item.config.formId;return item}
function formItemConvertData(item,formKey){const c=item.config;return {type:item.typeId,formItemId:c.formId,label:c.label,required:c.required,placeholder:item.placeholder||'',showLabel:c.showLabel,span:24,scheme:item,formKey}}
const mode=process.argv[2]||'RULE'
if(!['RULE','LLM'].includes(mode))throw Error('Choose RULE or LLM')
const privateDemoFile=mode==='LLM'?'.local/tduck-full-audit/m3-demo-real.json':'.local/tduck-full-audit/m3-demo.json'
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''));let token
async function api(url,data){const r=await fetch('http://127.0.0.1:8997'+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{} )},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json());if(r.code!==200)throw Error(url+': '+r.msg);return r.data}
token=(await api('/login/account',{account:f.owner,password:f.password})).token
if(mode==='LLM'&&(await api('/user/form/ai/status')).mode!=='REAL')throw Error('Real model is not configured; use RULE or configure the server first')
const made=await api('/user/form/create',{name:mode==='LLM'?'M3 真实模型追问体验（合成样例）':'M3 可选追问体验（合成样例）',description:'这是功能体验样例，可用虚构内容试填，并随时跳过补充问题。',type:0}),key=typeof made==='string'?made:made.formKey
const open=[]
for(const [type,label] of [['RADIO','你是否使用过校园公共服务？'],['CHECKBOX','你使用过哪些校园服务？'],['RATE','你对校园服务的总体满意度'],['TEXTAREA','你认为食堂哪里需要改善？'],['TEXTAREA','请描述一次具体的食堂经历'],['TEXTAREA','你为什么使用或不使用图书馆？']]){
 const q=createField(type);q.config.label=label;q.config.required=type==='TEXTAREA'&&open.length===0
 if(type==='RADIO')q.config.options=[{label:'使用过',value:1},{label:'未使用过',value:2}]
 if(type==='CHECKBOX')q.config.options=[{label:'食堂',value:1},{label:'图书馆',value:2},{label:'其他',value:3}]
 if(type==='TEXTAREA')open.push(q.config.formId)
 await api('/user/form/item/create',formItemConvertData(q,key))
}
await api('/user/form/setting/save',{formKey:key,saveNotSubmitStatus:true})
await api('/user/form/followup/config',{formKey:key,enabled:true,goal:'合成验收：了解食堂和图书馆的使用体验、具体情境和受访者自己提出的线索',totalBudget:2,perQuestionBudget:1,timeBudgetSeconds:600,mode,allowedQuestionIds:open})
const v=await api('/user/form/publish',{formKey:key})
const demo={formKey:key,versionNo:v.versionNo,ownerUrl:'http://localhost:5180/project/form/followup?key='+key,publicUrl:`http://localhost:5180/s/${key}?t=${v.shareToken}`,mode,notes:mode==='RULE'?'Synthetic demo; local deterministic rule provider, not a model.':'Synthetic demo; configured real model classifies actions and server renders neutral prompts.'}
fs.writeFileSync(privateDemoFile,JSON.stringify(demo,null,2)+'\n')
console.log(JSON.stringify({formKey:key,versionNo:v.versionNo,mode,urlStoredIn:privateDemoFile}))
