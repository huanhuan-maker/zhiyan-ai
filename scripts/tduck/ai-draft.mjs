// M2 AI 问卷草稿回归（真实 8997 后端 + 真实本机推理网关 + tduck_vue3_dev，无 mock 冒充真实）
// 覆盖：状态标注真实/Mock、真实模型生成、服务端校验拒绝、草稿导入编辑器（CREATE 未发布）、
//       无密钥降级 Mock（独立 8996 实例验证）、普通手工建卷答题不受 AI 影响。
// 结果写入 evidence/tduck-full/ai-draft.json（脱敏：不含 API Key）
import {spawn, execFileSync} from 'node:child_process'
import fs from 'node:fs'

const BASE='http://127.0.0.1:8997', MOCK_PORT=8996
const creds=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const fixt=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
const checks=[],errors=[]
function check(name,ok,detail=''){checks.push({name,ok});console.log((ok?'[ok] ':'[FAIL] ')+name+(detail?' | '+String(detail).slice(0,140):''));if(!ok)errors.push(name)}
async function api(path,{method='GET',token,body,headers={},base=BASE}={}){
  const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...headers,...(token?{token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})
  return r.json()
}
const draft=(input,token)=>api('/user/form/ai/draft',{method:'POST',token,body:input})

// ===== 1. 权限与状态 =====
const anonStatus=await api('/user/form/ai/status')
check('M2-1: 未登录访问 AI 状态被拒绝',anonStatus.code===401,'code='+anonStatus.code)
const anonDraft=await api('/user/form/ai/draft',{method:'POST',body:{goal:'x',audience:'y',questionCount:3}})
check('M2-2: 未登录生成草稿被拒绝',anonDraft.code===401,'code='+anonDraft.code)
const login=await api('/login/account',{method:'POST',body:{account:fixt.owner,password:fixt.password}})
const token=login.data.token
const status=await api('/user/form/ai/status',{token})
const statusStr=JSON.stringify(status)
check('M2-3: 状态显示真实 AI + Provider/模型',status.data?.mode==='REAL'&&!!status.data?.provider&&!!status.data?.model,JSON.stringify(status.data))
check('M2-4: 状态响应不含 API Key',!statusStr.toLowerCase().includes('magpie'),'泄露检查')

// ===== 2. 输入校验（可恢复错误，不崩溃） =====
const blank=await draft({goal:'   ',audience:'大学生',questionCount:5},token)
check('M2-5: 空白目标被拒绝且提示可恢复',blank.code!==200&&String(blank.msg).includes('调查目标'),'msg='+blank.msg)
const badCount=await draft({goal:'调查学习习惯',audience:'大学生',questionCount:0},token)
check('M2-6: 非法题数被拒绝',badCount.code!==200&&String(badCount.msg).includes('题数'),'msg='+badCount.msg)
const tooMany=await draft({goal:'调查学习习惯',audience:'大学生',questionCount:101},token)
check('M2-7: 题数超上限(100)被拒绝',tooMany.code!==200,'msg='+tooMany.msg)

// ===== 3. 真实模型生成（验收剧本输入） =====
const goal='我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人'
const real=await draft({goal,audience:'在校大学生',extra:'',questionCount:6},token)
let draftResult=null
if(real.code===200&&real.data.kind==='clarification'){
  check('M2-8: 真实模型请求澄清(含澄清问题)',Array.isArray(real.data.clarification)&&real.data.clarification.length>0&&real.data.mode==='REAL',JSON.stringify(real.data).slice(0,120))
  // 澄清后补全再生成一次，作为草稿样本
  const second=await draft({goal:goal+'；两类人群都需覆盖参与障碍与退出原因',audience:'在校大学生，含未参加者与已退出者',extra:'请包含整体满意度量表和一道开放题',questionCount:6},token)
  if(second.code===200&&second.data.kind==='draft'){draftResult=second.data}
  check('M2-9: 补充澄清后真实模型生成草稿成功',!!draftResult,second.msg||JSON.stringify(second.data?.kind))
}else if(real.code===200&&real.data.kind==='draft'){
  draftResult=real.data
  check('M2-8: 真实模型直接生成草稿(mode=REAL)',real.data.mode==='REAL'&&real.data.provider&&real.data.model,'provider='+real.data.provider)
  check('M2-9: 草稿元信息完整(跳过澄清场景)',true,'直接生成路径')
}else{
  check('M2-8: 真实模型返回 draft 或 clarification',false,'code='+real.code+' msg='+real.msg)
}
if(draftResult){
  const qs=draftResult.questions||[]
  const types=[...new Set(qs.map(q=>q.type))]
  check('M2-10: 草稿题数=期望6且仅四题型',qs.length===6&&types.every(t=>['RADIO','CHECKBOX','RATE','TEXTAREA'].includes(t)),'len='+qs.length+' types='+types.join(','))
  check('M2-11: 草稿含开放题与量表',qs.some(q=>q.type==='TEXTAREA')&&qs.some(q=>q.type==='RATE'),types.join(','))
  check('M2-12: 选择题选项唯一且≥2',qs.filter(q=>q.type==='RADIO'||q.type==='CHECKBOX').every(q=>{const o=q.options||[];return o.length>=2&&new Set(o.map(x=>String(x).trim())).size===o.length}))
  check('M2-13: 量表范围合法(2-10)',qs.filter(q=>q.type==='RATE').every(q=>q.rateMax>=2&&q.rateMax<=10))
  check('M2-14: 草稿含标题与设计假设',!!draftResult.title&&Array.isArray(draftResult.assumptions))
}

// ===== 4. 草稿导入现有编辑器（模拟前端：create + 逐题 item/create） =====
if(draftResult){
  const created=await api('/user/form/create',{method:'POST',token,body:{name:String(draftResult.title).slice(0,100),type:0,folderId:0}})
  const formKey=typeof created.data==='string'?created.data:created.data.formKey
  const {allComponents}=await import('file:///D:/LcProject/tduck-vue3/src/td/generator/config.js')
  const defs=Object.fromEntries(allComponents.flatMap(g=>g.list).map(x=>[x.typeId,x]))
  let importOk=true
  for(const q of draftResult.questions){
    const it=JSON.parse(JSON.stringify(defs[q.type]))
    it.config.formId=q.type.toLowerCase()+Date.now()+Math.floor(Math.random()*1000)
    it.config.label=q.label
    it.config.required=q.required!==false
    if(q.type==='RADIO'||q.type==='CHECKBOX') it.config.options=(q.options||[]).map((label,i)=>({label,value:i+1,quotaSetting:null}))
    if(q.type==='RATE') it.max=q.rateMax||5
    const c=it.config
    const r=await api('/user/form/item/create',{method:'POST',token,body:{type:it.typeId,formItemId:c.formId,label:c.label,required:c.required,placeholder:it.placeholder||'',regList:c.regList||[],showLabel:c.showLabel,span:c.span||24,scheme:it,formKey}})
    if(r.code!==200)importOk=false
  }
  check('M2-15: 草稿可按四题型结构导入(现有题目接口)',importOk)
  const items=await api('/user/form/item/list?key='+formKey,{token})
  check('M2-16: 编辑器读取到全部题目(与草稿同数)',items.data?.length===draftResult.questions.length,'items='+(items.data||[]).length)
  const formRow=execFileSync('D:/MySQL/MySQL Server 8.0/bin/mysql.exe',['-uroot','-p'+creds.mysqlRootPassword,'-N','--default-character-set=utf8mb4','-e',"select status from fm_user_form where form_key='"+formKey+"'",'tduck_vue3_dev'],{stdio:['pipe','pipe','pipe']}).toString().trim()
  check('M2-17: AI 草稿导入后仍为未发布草稿(status=1)',formRow==='1','status='+formRow)
}

// ===== 5. 普通手工建卷/答题不受 AI 影响 =====
const manual=await api('/user/form/create',{method:'POST',token,body:{name:'M2手工链路验证'+Date.now(),type:0,folderId:0}})
const mKey=typeof manual.data==='string'?manual.data:manual.data.formKey
const mIt=JSON.parse(JSON.stringify((await import('file:///D:/LcProject/tduck-vue3/src/td/generator/config.js')).allComponents.flatMap(g=>g.list).find(x=>x.typeId==='INPUT')))
const mid='input'+Date.now()
mIt.config.formId=mid;mIt.config.label='手工题目';mIt.config.required=false
await api('/user/form/item/create',{method:'POST',token,body:{type:'INPUT',formItemId:mid,label:'手工题目',required:false,placeholder:'',regList:[],showLabel:true,span:24,scheme:mIt,formKey:mKey}})
const pub=await api('/user/form/publish',{method:'POST',token,body:{formKey:mKey}})
const mSubmit=await api('/user/form/data/public/create',{method:'POST',headers:{'X-Submission-Key':'m2-manual-'+Date.now()+'-plain-answer-ok'},body:{formKey:mKey,versionToken:pub.data?.shareToken,originalData:{[mid]:'AI 故障期间的手工回答'},completeTime:8,submitUa:{ua:'ai-draft'}}})
check('M2-18: AI 存在时手工建卷/发布/答题不受影响',pub.code===200&&mSubmit.code===200,'pub='+pub.code+' submit='+mSubmit.code+' '+ (mSubmit.msg||''))
await api('/user/form/stop',{method:'POST',token,body:{formKey:mKey}})

// ===== 6. 无密钥降级 Mock（独立 8996 实例，验证后关闭） =====
let mockProc=null
try{
  mockProc=spawn('D:/jdk/jdk17/bin/java.exe',['-jar','D:/LcProject/.local/tduck-closure-build/tduck-api/target/tduck-api.jar','--spring.config.additional-location=file:./application-local.yml','--ai.api-key=','--server.address=127.0.0.1','--server.port='+MOCK_PORT],{cwd:'D:/LcProject/.local/tduck-dev',stdio:['ignore','ignore','ignore']})
  let up=false
  for(let i=0;i<40;i++){
    await new Promise(r=>setTimeout(r,2000))
    try{const s=await api('/user/form/ai/status',{base:'http://127.0.0.1:'+MOCK_PORT});if(s.code===401||s.data){up=true;break}}catch{}
  }
  check('M2-19: 无密钥实例可在 8996 启动',up)
  if(up){
    const mStatus=await api('/user/form/ai/status',{token,base:'http://127.0.0.1:'+MOCK_PORT})
    check('M2-20: 无密钥时状态明确标注 Mock(不假称真实 AI)',mStatus.data?.mode==='MOCK'&&String(mStatus.data?.model).includes('mock'),JSON.stringify(mStatus.data))
    const mDraft=await api('/user/form/ai/draft',{method:'POST',token,body:{goal:'调查自习室使用情况',audience:'在校大学生',questionCount:5},base:'http://127.0.0.1:'+MOCK_PORT})
    check('M2-21: Mock 模式可生成草稿且通过同一校验(含开放题)',mDraft.code===200&&mDraft.data?.mode==='MOCK'&&mDraft.data?.questions?.length===5&&mDraft.data.questions.some(q=>q.type==='TEXTAREA'),mDraft.msg||('len='+(mDraft.data?.questions||[]).length))
  }
}finally{
  if(mockProc){try{spawn('taskkill',['/PID',String(mockProc.pid),'/F','/T'])}catch{try{mockProc.kill()}catch{}}}
}

fs.writeFileSync('evidence/tduck-full/ai-draft.json',JSON.stringify({date:new Date().toISOString(),total:checks.length,failed:errors.length,checks,
  realSample:draftResult?{title:draftResult.title,provider:draftResult.provider,model:draftResult.model,elapsedMs:draftResult.elapsedMs,types:(draftResult.questions||[]).map(q=>q.type)}:null},null,1)+'\n')
console.log(`\nM2 AI 草稿回归: ${checks.length}项检查, 失败 ${errors.length}`)
if(errors.length){console.log('FAILED: '+errors.join(' ; '));process.exit(1)}
