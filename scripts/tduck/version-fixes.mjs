// M1 缺陷回归（真实 8997 后端 + tduck_vue3_dev，无 mock）
// 覆盖三项缺陷的预期契约（修复前应失败，修复后全部通过）：
//   缺陷2 版本快照不完整：版本必须冻结 表单名称/描述/逻辑，旧链接不受改名与新逻辑影响
//   缺陷3 跨版本提交回执冲突：同一会话键在不同版本各自计数，v2 提交不得被 v1 回执吞掉
//   缺陷4 历史答卷使用当前题目展示：答卷详情/数据字段/数据列表必须按答卷所属版本渲染
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'

const BASE='http://127.0.0.1:8997'
const MYSQL='D:/MySQL/MySQL Server 8.0/bin/mysql.exe'
const creds=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const fixt=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
const checks=[],errors=[]
const mask=t=>{t=String(t);return t.length>12?t.slice(0,6)+'…'+t.slice(-4):t}
function check(name,ok,detail=''){checks.push({name,ok});console.log((ok?'[ok] ':'[FAIL] ')+name+(detail?' | '+mask(String(detail)):''));if(!ok)errors.push(name)}
function sql(q){return execFileSync(MYSQL,['-uroot','-p'+creds.mysqlRootPassword,'-N','-B','--default-character-set=utf8mb4','-e',q,'tduck_vue3_dev'],{stdio:['pipe','pipe','pipe']}).toString().trim()}
function sqlSafe(q){try{return sql(q)}catch(e){return 'SQLERR:'+String(e.message||e).split('\n')[0]}}
function sqlRows(q){const out=sql(q);return out?out.split('\n').map(r=>r.replace(/\r$/,'').split('\t')):[]}
async function api(path,{method='GET',token,body,headers={}}={}){
  const r=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',...headers,...(token?{token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})
  return {http:r.status,json:await r.json().catch(()=>null)}
}
async function ok(path,{method='POST',token,body,headers}={}){
  const r=await api(path,{method,token,body,headers})
  if(r.json?.code!==200)throw new Error(path+' 失败: '+r.json?.msg)
  return r.json.data
}
// 题目构造与设计器同构
const {allComponents}=await import('file:///D:/LcProject/tduck-vue3/src/td/generator/config.js')
const clone=v=>JSON.parse(JSON.stringify(v))
const defs=Object.fromEntries(allComponents.flatMap(g=>g.list).map(x=>[x.typeId,x]))
const mk=t=>{const it=clone(defs[t]);it.config.formId=t.toLowerCase()+Date.now()+Math.floor(Math.random()*1000);return it}
const conv=(it,k)=>{const c=it.config;return {type:it.typeId,formItemId:c.formId,label:c.label,required:c.required,placeholder:it.placeholder||'',regList:c.regList||[],showLabel:c.showLabel,span:c.span||24,scheme:it,formKey:k}}

const ownerTok=(await ok('/login/account',{body:{account:fixt.owner,password:fixt.password}})).token
const publish=k=>ok('/user/form/publish',{token:ownerTok,body:{formKey:k}})
const stop=k=>ok('/user/form/stop',{token:ownerTok,body:{formKey:k}})
const submit=(k,tok,key,data)=>api('/user/form/data/public/create',{method:'POST',headers:{'X-Submission-Key':key},body:{formKey:k,versionToken:tok,originalData:data,completeTime:9,submitUa:{ua:'version-fixes'}}})

// ============ 缺陷2：版本快照必须冻结表单名称/描述/逻辑 ============
const fa=await ok('/user/form/create',{token:ownerTok,body:{name:'快照完整性A',folderId:0}})
const ka=typeof fa==='string'?fa:fa.formKey
const radioA=mk('RADIO');radioA.config.label='快照单选题';radioA.config.options=[{label:'选项一',value:1,quotaSetting:null}]
await ok('/user/form/item/create',{token:ownerTok,body:conv(radioA,ka)})
const pa=await publish(ka),t1a=pa.shareToken
const before=await api('/user/form/details/'+ka+'?token='+t1a)
check('缺陷2-基线: 发布时令牌链接标题=快照完整性A',before.json?.data?.form?.name==='快照完整性A'&&before.json?.data?.form?.description!=='改名描述',JSON.stringify(before.json?.data?.form))
// 改名+改描述+新增逻辑（均为草稿层修改，不应影响已发布版本）
await ok('/user/form/update',{token:ownerTok,body:{formKey:ka,name:'快照改名B',description:'改名描述'}})
await ok('/user/form/logic/save',{token:ownerTok,body:{formKey:ka,scheme:[{triggerList:[{formItemId:radioA.config.formId,type:'show'}],conditionList:[{formItemId:radioA.config.formId,expression:'eq',value:'1'}]}]}})
const after=await api('/user/form/details/'+ka+'?token='+t1a)
check('缺陷2-1: 改名后旧令牌链接标题仍为发布时的"快照完整性A"',after.json?.data?.form?.name==='快照完整性A','实际='+after.json?.data?.form?.name)
check('缺陷2-2: 旧令牌链接描述不受改名影响',after.json?.data?.form?.description!=='改名描述','实际='+after.json?.data?.form?.description)
const logicScheme=JSON.stringify(after.json?.data?.formLogic?.scheme||null)
check('缺陷2-3: 发布后新增的逻辑不出现在旧版本链接',logicScheme==='null'||!logicScheme.includes('eq'),JSON.stringify(logicScheme).slice(0,80))
const noTok=await api('/user/form/details/'+ka)
check('缺陷2-4: 无令牌链接=最新发布版本(标题为发布时标题,非草稿改名)',noTok.json?.data?.form?.name==='快照完整性A','实际='+noTok.json?.data?.form?.name)
const snapCols=sqlSafe("select concat(form_snapshot is not null,',',logic_snapshot is not null,',',theme_snapshot is not null) from fm_user_form_version where form_key='"+ka+"' and version_no=1")
check('缺陷2-5: fm_user_form_version 存在并填充 form/logic/theme 快照列',!snapCols.startsWith('SQLERR')&&snapCols.split(',').every(x=>x==='1'),snapCols)
// 清理：停收，表单留库（答卷0份，不影响验收口径）
await stop(ka)

// ============ 缺陷3：同一会话键跨版本不得互相吞答卷 ============
const fb=await ok('/user/form/create',{token:ownerTok,body:{name:'跨版本回执冲突',folderId:0}})
const kb=typeof fb==='string'?fb:fb.formKey
const inB=mk('INPUT');inB.config.label='回执冲突填空';inB.config.required=false
await ok('/user/form/item/create',{token:ownerTok,body:conv(inB,kb)})
const pb1=await publish(kb),t1b=pb1.shareToken
const K='glm53-fix-'+Date.now()+'-cross-version-key'
const s1=await submit(kb,t1b,K,{[inB.config.formId]:'v1回答'})
check('缺陷3-基线: v1 会话键提交成功',s1.json?.code===200&&s1.json.data?.replayed===false,s1.json?.msg)
const id1=s1.json.data.id
const s1b=await submit(kb,t1b,K,{[inB.config.formId]:'v1回答重放'})
check('缺陷3-1: 同版本同键重放幂等(返回同一答卷号)',s1b.json?.code===200&&s1b.json.data?.replayed===true&&s1b.json.data?.id===id1,JSON.stringify(s1b.json?.data))
await stop(kb)
inB.config.label='回执冲突填空(修订)'
await ok('/user/form/item/update',{token:ownerTok,body:conv(inB,kb)})
const pb2=await publish(kb),t2b=pb2.shareToken
const s2=await submit(kb,t2b,K,{[inB.config.formId]:'v2回答'})
check('缺陷3-2: 同一会话键在 v2 提交生成新答卷(不被 v1 回执吞掉)',s2.json?.code===200&&s2.json.data?.replayed===false&&s2.json.data?.id!==id1,JSON.stringify(s2.json?.data))
const id2=s2.json?.data?.id
const s2b=await submit(kb,t2b,K,{[inB.config.formId]:'v2回答重放'})
check('缺陷3-3: v2 同键重放幂等(返回 v2 答卷号)',s2b.json?.code===200&&s2b.json.data?.replayed===true&&s2b.json.data?.id===id2,JSON.stringify(s2b.json?.data))
const receipts=sqlSafe("select count(*) from fm_public_submission where form_key='"+kb+"'")
check('缺陷3-4: 回执表按版本分键存储(该问卷2条回执)',receipts==='2','回执数='+receipts)
const bothB=sqlRows("select version_no from fm_user_form_data where form_key='"+kb+"' order by version_no").map(r=>r[0]).join(',')
check('缺陷3-5: v1/v2 各留1份答卷(version_no=1,2)',bothB==='1,2','实际='+bothB)
await stop(kb)

// ============ 缺陷4：历史答卷按所属版本渲染 ============
const fc=await ok('/user/form/create',{token:ownerTok,body:{name:'历史答卷版本展示',folderId:0}})
const kc=typeof fc==='string'?fc:fc.formKey
const rc=mk('RADIO');rc.config.label='旧题目Q';rc.config.options=[{label:'旧A',value:1,quotaSetting:null},{label:'旧B',value:2,quotaSetting:null}]
await ok('/user/form/item/create',{token:ownerTok,body:conv(rc,kc)})
const pc1=await publish(kc),t1c=pc1.shareToken
const idQ=rc.config.formId
const c1=await submit(kc,t1c,'glm53-fix-'+Date.now()+'-historical-v1-answer',{[idQ]:1,[idQ+'label']:'旧A'})
check('缺陷4-基线: v1 提交成功',c1.json?.code===200,c1.json?.msg)
const dataId1=c1.json.data.id
await stop(kc)
rc.config.label='新题目Q';rc.config.options=[{label:'新X',value:1,quotaSetting:null},{label:'新Y',value:2,quotaSetting:null}]
await ok('/user/form/item/update',{token:ownerTok,body:conv(rc,kc)})
const pc2=await publish(kc),t2c=pc2.shareToken
const c2=await submit(kc,t2c,'glm53-fix-'+Date.now()+'-historical-v2-answer',{[idQ]:1,[idQ+'label']:'新X'})
check('缺陷4-基线: v2 提交成功',c2.json?.code===200,c2.json?.msg)
const dataId2=c2.json.data.id
const det1=await api('/user/form/data/details/'+dataId1,{token:ownerTok})
const det1Labels=(det1.json?.data?.formFields||[]).map(x=>x.label).join(',')
check('缺陷4-1: v1 答卷详情按 v1 题目渲染(旧题目Q,非新题目Q)',det1.json?.code===200&&det1Labels.includes('旧题目Q')&&!det1Labels.includes('新题目Q'),'labels='+det1Labels)
const det2=await api('/user/form/data/details/'+dataId2,{token:ownerTok})
const det2Labels=(det2.json?.data?.formFields||[]).map(x=>x.label).join(',')
check('缺陷4-2: v2 答卷详情按 v2 题目渲染(新题目Q)',det2.json?.code===200&&det2Labels.includes('新题目Q'),'labels='+det2Labels)
const f1=await api('/user/form/fields/'+kc+'?version=1',{token:ownerTok})
const f1Labels=(f1.json?.data||[]).map(x=>x.label).join(',')
check('缺陷4-3: 数据页字段接口 version=1 返回 v1 题目(旧题目Q/旧A)',f1.json?.code===200&&f1Labels.includes('旧题目Q')&&!f1Labels.includes('新题目Q'),'labels='+f1Labels)
const f2=await api('/user/form/fields/'+kc+'?version=2',{token:ownerTok})
const f2Labels=(f2.json?.data||[]).map(x=>x.label).join(',')
check('缺陷4-4: 数据页字段接口 version=2 返回 v2 题目(新题目Q/新X)',f2.json?.code===200&&f2Labels.includes('新题目Q'),'labels='+f2Labels)
const q1=await api('/user/form/data/query',{method:'POST',token:ownerTok,body:{formKey:kc,current:0,size:100,versionNo:1}})
const q1rows=q1.json?.data?.rows||[]
check('缺陷4-5: 数据列表 versionNo=1 仅含 v1 答卷(1份,值为旧A)',q1.json?.code===200&&q1.json.data.total===1&&q1rows.some(r=>String(r[idQ+'label'])==='旧A'),'total='+q1.json?.data?.total)
const q2=await api('/user/form/data/query',{method:'POST',token:ownerTok,body:{formKey:kc,current:0,size:100,versionNo:2}})
check('缺陷4-6: 数据列表 versionNo=2 仅含 v2 答卷(1份,值为新X)',q2.json?.code===200&&q2.json.data.total===1&&(q2.json.data.rows||[]).some(r=>String(r[idQ+'label'])==='新X'),'total='+q2.json?.data?.total)
const qAll=await api('/user/form/data/query',{method:'POST',token:ownerTok,body:{formKey:kc,current:0,size:100}})
check('缺陷4-7: 不带版本参数保持兼容(返回全部2份)',qAll.json?.code===200&&qAll.json.data.total===2,'total='+qAll.json?.data?.total)
const vList=await api('/user/form/versions?key='+kc,{token:ownerTok})
const v1r=(vList.json?.data||[]).find(x=>x.versionNo===1),v2r=(vList.json?.data||[]).find(x=>x.versionNo===2)
check('缺陷4-8: 版本列表各版本答卷数正确(v1=1,v2=1)',v1r?.answerCount===1&&v2r?.answerCount===1,JSON.stringify(vList.json?.data))
await stop(kc)

fs.writeFileSync('evidence/tduck-full/version-fixes.json',JSON.stringify({date:new Date().toISOString(),total:checks.length,failed:errors.length,checks},null,1)+'\n')
console.log(`\nM1缺陷回归: ${checks.length}项检查, 失败 ${errors.length}`)
if(errors.length){console.log('FAILED: '+errors.join(' ; '));process.exit(1)}
