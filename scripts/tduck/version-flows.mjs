// M1 版本快照机制回归（真实 8997 后端 + tduck_vue3_dev，无 mock）
// 覆盖：发布生成不可变版本+随机令牌链接 → 收集中冻结/停收可改 → 重发 v2 自动关闭 v1
//       → 旧令牌链接加载 v1 旧内容并拒绝提交 → 答卷按版本绑定 → 旧答案不变 → 统计按版本口径
import {execFileSync} from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const assert=(c,m)=>{if(!c)throw new Error(m)}
const BASE='http://127.0.0.1:8997'
const MYSQL='D:/MySQL/MySQL Server 8.0/bin/mysql.exe'
// 凭据一律取自 .local（不入库）：数据库口令见 tduck-credentials.json，测试账号见 tduck-dev/acceptance.json
const creds=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const fixt=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
const checks=[],errors=[]
function check(name,ok,detail=''){checks.push({name,ok,detail});console.log((ok?'[ok] ':'[FAIL] ')+name+(detail?' | '+detail:''));if(!ok)errors.push(name)}
function sql(q){return execFileSync(MYSQL,['-uroot','-p'+creds.mysqlRootPassword,'-N','-B','--default-character-set=utf8mb4','-e',q,'tduck_vue3_dev'],{stdio:['pipe','pipe','pipe']}).toString().trim()}
function sqlRows(q){const out=sql(q);return out?out.split('\n').map(r=>r.split('\t')):[]}
async function api(path,{method='GET',token,body,headers={}}={}){
  const r=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',...headers,...(token?{token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})
  return {http:r.status,json:await r.json().catch(()=>null)}
}
// 题目构造与设计器同构（复用 generator 默认配置）
const {allComponents}=await import('file:///D:/LcProject/tduck-vue3/src/td/generator/config.js')
const clone=v=>JSON.parse(JSON.stringify(v))
const defs=Object.fromEntries(allComponents.flatMap(g=>g.list).map(x=>[x.typeId,x]))
const mk=t=>{const it=clone(defs[t]);it.config.formId=t.toLowerCase()+Date.now()+Math.floor(Math.random()*1000);return it}
const conv=(it,k)=>{const c=it.config;return {type:it.typeId,formItemId:c.formId,label:c.label,required:c.required,placeholder:it.placeholder||'',regList:c.regList||[],showLabel:c.showLabel,span:c.span||24,scheme:it,formKey:k}}

const login=await api('/login/account',{method:'POST',body:{account:fixt.owner,password:fixt.password}})
assert(login.json?.code===200,'测试账号登录失败: '+login.json?.msg)
const token=login.json.data.token

// ===== 1. 建卷 → 发布 v1（生成快照+令牌） =====
const created=await api('/user/form/create',{method:'POST',token,body:{name:'GLM53版本机制验收'+Date.now(),folderId:0}})
assert(created.json?.code===200,'建卷失败: '+created.json?.msg)
const key=created.json.data.formKey
const fR=mk('RADIO');fR.config.label='版本验收单选';fR.config.required=true
fR.config.options=[{label:'旧选项A',value:1,quotaSetting:null},{label:'旧选项B',value:2,quotaSetting:null}]
const fT=mk('TEXTAREA');fT.config.label='版本验收开放题';fT.config.required=false
for(const f of [fR,fT]){const r=await api('/user/form/item/create',{method:'POST',token,body:conv(f,key)});assert(r.json?.code===200,'建题失败: '+r.json?.msg)}
const idR=fR.config.formId,idT=fT.config.formId
const pub1=await api('/user/form/publish',{method:'POST',token,body:{formKey:key}})
assert(pub1.json?.code===200&&pub1.json.data?.shareToken,'发布未返回版本令牌: '+JSON.stringify(pub1.json))
const t1=pub1.json.data.shareToken,v1=pub1.json.data.versionNo
check('发布生成 v1 并返回版本号+24位随机分享令牌',v1===1&&/^[A-Za-z0-9]{24}$/.test(t1),'v='+v1+' token='+t1.slice(0,8)+'...')
const editDuringRelease=await api('/user/form/item/update',{method:'POST',token,body:conv(fR,key)})
check('收集中改题被拒(题目冻结)',editDuringRelease.json?.code!==200&&String(editDuringRelease.json?.msg||'').includes('冻结'),'msg='+editDuringRelease.json?.msg)
const d1=await api('/user/form/details/'+key+'?token='+t1)
check('令牌链接读取 v1 快照(2题,含旧选项A)',d1.json?.data?.version===1&&d1.json.data.formItems.length===2&&d1.json.data.formItems.some(i=>String(i.scheme?.config?.options?.[0]?.label).includes('旧选项A')))
const dNoToken=await api('/user/form/details/'+key)
check('无令牌链接服务最新发布版本(兼容旧链接)',dNoToken.json?.data?.version===1)
const s1=await api('/user/form/data/public/create',{method:'POST',headers:{'X-Submission-Key':'glm53-ver-'+Date.now()+'-aaaaaaaaaaaa'},body:{formKey:key,versionToken:t1,originalData:{[idR]:1,[idR+'label']:'旧选项A',[idT]:'v1时代的回答'},completeTime:11,submitUa:{ua:'version-flows'}}})
assert(s1.json?.code===200,'v1提交失败: '+s1.json?.msg)
const r1Id=s1.json.data.id
const bind1=sqlRows(`select version_no from fm_user_form_data where id=${r1Id}`)[0][0]
check('v1 答卷绑定 version_no=1',bind1==='1','version_no='+bind1)

// ===== 2. 停收 → 改草稿 → 重发 v2 =====
const stop=await api('/user/form/stop',{method:'POST',token,body:{formKey:key}})
assert(stop.json?.code===200,'停收失败: '+stop.json?.msg)
fR.config.label='版本验收单选（修订版）'
fR.config.options=[{label:'新选项甲',value:1,quotaSetting:null},{label:'新选项乙',value:2,quotaSetting:null}]
const editAfterStop=await api('/user/form/item/update',{method:'POST',token,body:conv(fR,key)})
check('停收后可修改草稿题目',editAfterStop.json?.code===200,'msg='+editAfterStop.json?.msg)
const fN=mk('INPUT');fN.config.label='v2新增题';fN.config.required=false
const addNew=await api('/user/form/item/create',{method:'POST',token,body:conv(fN,key)})
check('停收后可新增题目',addNew.json?.code===200,'msg='+addNew.json?.msg)
const idN=fN.config.formId
const pub2=await api('/user/form/publish',{method:'POST',token,body:{formKey:key}})
assert(pub2.json?.code===200&&pub2.json.data?.shareToken,'v2发布失败: '+pub2.json?.msg)
const t2=pub2.json.data.shareToken,v2=pub2.json.data.versionNo
check('重新发布生成 v2 与新令牌',v2===2&&t2!==t1,'v='+v2)
const vList=await api('/user/form/versions?key='+key,{token})
const v1Row=(vList.json.data||[]).find(x=>x.versionNo===1),v2Row=(vList.json.data||[]).find(x=>x.versionNo===2)
check('版本列表: v1已停止/v2收集中/v1答卷1份',v1Row?.status===2&&v2Row?.status===1&&v1Row?.answerCount===1,JSON.stringify(vList.json.data))

// ===== 3. 旧链接加载旧版内容；旧版本拒绝提交；新链接 v2 =====
const dOld=await api('/user/form/details/'+key+'?token='+t1)
const oldLabels=(dOld.json?.data?.formItems||[]).map(i=>i.label).join(' / ')
check('旧令牌链接仍加载 v1 内容(旧标题,无新题)',dOld.json?.data?.version===1&&dOld.json.data.versionStatus===2&&dOld.json.data.formItems.length===2&&!oldLabels.includes('修订版')&&!oldLabels.includes('v2新增题'),oldLabels)
const oldOpts=(dOld.json?.data?.formItems||[]).find(i=>i.type==='RADIO')?.scheme?.config?.options?.map(o=>o.label).join(',')
check('v1 快照未被改题污染(选项仍为旧选项A/B)',oldOpts==='旧选项A,旧选项B',String(oldOpts))
const oldSubmit=await api('/user/form/data/public/create',{method:'POST',headers:{'X-Submission-Key':'glm53-ver-old-'+Date.now()+'-bbbbbbbb'},body:{formKey:key,versionToken:t1,originalData:{[idR]:2,[idR+'label']:'旧选项B'},completeTime:5,submitUa:{ua:'version-flows-old'}}})
check('旧版本提交被服务端拒绝',oldSubmit.json?.code!==200&&String(oldSubmit.json?.msg||'').includes('停止'),'msg='+oldSubmit.json?.msg)
const dNew=await api('/user/form/details/'+key+'?token='+t2)
const newLabels=(dNew.json?.data?.formItems||[]).map(i=>i.label).join(' / ')
check('新令牌链接加载 v2 内容(修订标题+新增题)',dNew.json?.data?.version===2&&dNew.json.data.versionStatus===1&&dNew.json.data.formItems.length===3&&newLabels.includes('修订版')&&newLabels.includes('v2新增题'),newLabels)
const s2=await api('/user/form/data/public/create',{method:'POST',headers:{'X-Submission-Key':'glm53-ver2-'+Date.now()+'-cccccccc'},body:{formKey:key,versionToken:t2,originalData:{[idR]:1,[idR+'label']:'新选项甲',[idN]:'v2的新回答'},completeTime:7,submitUa:{ua:'version-flows-v2'}}})
assert(s2.json?.code===200,'v2提交失败: '+s2.json?.msg)
const bind2=sqlRows(`select version_no from fm_user_form_data where id=${s2.json.data.id}`)[0][0]
check('v2 答卷绑定 version_no=2',bind2==='2','version_no='+bind2)
const r1Row=sqlRows(`select original_data from fm_user_form_data where id=${r1Id}`)[0][0]
check('v1 旧答案原文在改题与 v2 发布后不变',r1Row.includes('v1时代的回答')&&r1Row.includes('旧选项A'))

// ===== 4. 统计按版本口径 =====
const aV1=await api('/user/form/report/analysis?formKey='+key+'&version=1',{token})
const v1Radio=aV1.json.data.find(a=>a.label==='版本验收单选')
check('统计(v1): 标题为旧标题,仅v1答卷,旧选项A=1',v1Radio?.totalCount===1&&v1Radio?.map?.['旧选项A']===1&&v1Radio?.map?.['新选项甲']===undefined,JSON.stringify(v1Radio?.map))
const aV2=await api('/user/form/report/analysis?formKey='+key+'&version=2',{token})
const v2Radio=aV2.json.data.find(a=>a.label.includes('修订版'))
check('统计(v2): 标题为修订版,仅v2答卷,新选项甲=1',v2Radio?.totalCount===1&&v2Radio?.map?.['新选项甲']===1&&v2Radio?.map?.['旧选项A']===undefined,JSON.stringify(v2Radio?.map))
const aDef=await api('/user/form/report/analysis?formKey='+key,{token})
check('统计(默认口径)=最新版本v2',aDef.json.data.some(a=>a.label.includes('修订版'))&&!aDef.json.data.some(a=>a.label==='版本验收单选'))
const statsDef=await api('/user/form/report/stats?formKey='+key,{token})
check('stats 默认口径=v2(1份,返回版本标识)',Number(statsDef.json.data.completeCount)===1&&statsDef.json.data.versionNo===2,'count='+statsDef.json.data.completeCount+' versionNo='+statsDef.json.data.versionNo)
const badToken=await api('/user/form/details/'+key+'?token=invalid-token-xyz')
check('无效令牌被拒绝',badToken.json?.code!==200,'code='+badToken.json?.code)

console.log(`\n版本机制回归: ${checks.length}项检查, 失败 ${errors.length}`)
if(errors.length){console.log('FAILED: '+errors.join(' ; '));process.exit(1)}
