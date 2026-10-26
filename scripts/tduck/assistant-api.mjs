// Independent HTTP MCP client + real MySQL integration. Only synthetic forms and answers are created.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {allComponents} from '../../tduck-vue3/src/td/generator/config.js'
const f=JSON.parse(fs.readFileSync(process.env.TDUCK_ASSISTANT_FIXTURE||'.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),base='http://127.0.0.1:8997',out=process.env.TDUCK_ASSISTANT_OUTPUT||'evidence/tduck-full/assistant',checks=[]
const savedRunPath=process.env.TDUCK_ASSISTANT_RUN||'.local/assistant-review/run.json'
fs.mkdirSync(out,{recursive:true});let owner,other,key,foreign,version,ids={},conversation,turn,seq=0
async function raw(url,data,token=owner,headers={}){return fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json())}
async function api(url,data,token,headers){const r=await raw(url,data,token,headers);assert.equal(r.code,200,url+': '+r.msg);return r.data}
async function rpc(method,params={},opts={}){
 const body=opts.body??JSON.stringify({jsonrpc:'2.0',...(!opts.notification?{id:++seq}:{}),method,params})
 const r=await fetch(base+'/assistant-mcp',{method:opts.httpMethod||'POST',headers:{'Content-Type':'application/json',Accept:opts.accept||'application/json, text/event-stream',...(opts.token===null?{}:{Authorization:'Bearer '+(opts.token||owner)}),...(method!=='initialize'?{'MCP-Protocol-Version':opts.protocol||'2025-06-18'}:{}),...(opts.origin?{Origin:opts.origin}:{})},...((opts.httpMethod||'POST')==='POST'?{body}:{})})
 return {status:r.status,body:r.status===202?null:await r.json()}
}
async function tool(name,args,turnId,token){const r=await rpc('tools/call',{name,arguments:args,...(turnId?{_meta:{assistantTurnId:turnId}}:{})},{token});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.result.isError,false,JSON.stringify(r.body.result));return r.body.result.structuredContent}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,450)});console.log('FAIL '+name+': '+e.message.slice(0,180))}}
const rest='/user/form/assistant'
async function addForm(name,token=owner){const r=await api('/user/form/create',{name,type:0},token);return typeof r==='string'?r:r.formKey}
async function question(form,type,id,label,token=owner){const scheme=JSON.parse(JSON.stringify(allComponents.flatMap(g=>g.list).find(q=>q.typeId===type)));scheme.config.formId=id;scheme.config.label=label;scheme.config.required=false;if(['RADIO','CHECKBOX'].includes(type))scheme.config.options=[{label:'A',value:1},{label:'B',value:2}];await api('/user/form/item/create',{formKey:form,formItemId:id,type,label,required:false,span:24,showLabel:true,scheme},token)}
const submit=(form,v,data)=>api('/user/form/data/public/create',{formKey:form,versionToken:v.shareToken,formType:0,originalData:data,submitUa:{},completeTime:1000},null,{'X-Submission-Key':randomUUID()})
function coreHash(form){assert.match(form,/^[A-Za-z0-9]+$/);const c=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''));const raw=execFileSync('D:/MySQL/MySQL Server 8.0/bin/mysql.exe',['--host=127.0.0.1','--user=root','--default-character-set=utf8mb4','--raw','-N','-B','tduck_vue3_dev',`--execute=SELECT id,version_no,original_data FROM fm_user_form_data WHERE form_key='${form}' ORDER BY id`],{encoding:'utf8',env:{...process.env,MYSQL_PWD:c.mysqlRootPassword},stdio:['pipe','pipe','pipe']});return createHash('sha256').update(raw).digest('hex')}
try{
 owner=(await api('/login/account',{account:f.owner,password:f.password},null)).token;other=(await api('/login/account',{account:f.other,password:f.password},null)).token
 if(process.argv.includes('--replay')){
  const saved=JSON.parse(fs.readFileSync(savedRunPath,'utf8'));key=saved.key
  await check('conversation and sourced tool result survive a real backend restart',async()=>{const h=await api(rest+'/conversations/'+saved.conversationId);const found=h.turns.find(t=>t.id===saved.turnId);assert.ok(found);assert.equal(found.state,'SUCCEEDED');assert.deepEqual(found.result,saved.result);return{conversationId:saved.conversationId,turnId:saved.turnId,tool:found.plan.tool}})
  await check('browser-created dialogue and citations also persist across backend restart',async()=>{const ui=JSON.parse(fs.readFileSync('.local/assistant-review/ui-run.json','utf8'));const h=await api(rest+'/conversations/'+ui.conversationId);const found=h.turns.find(t=>t.id===ui.turnId);assert.equal(found.state,'SUCCEEDED');assert.deepEqual(found.result,ui.result);assert.ok(found.result.citations.length);return{conversationId:ui.conversationId,turnId:ui.turnId}})
  await check('stateless MCP can reinitialize after restart and read the current version',async()=>{const init=await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'restart-test',version:'1'}});assert.equal(init.body.result.protocolVersion,'2025-06-18');assert.equal((await rpc('notifications/initialized',{}, {notification:true})).status,202);const current=await tool('survey_stats',{formKey:key});assert.equal(current.version,2);assert.equal(current.answerCount,1)})
 }else{
  const run=Date.now(),prefix='Synthetic assistant '+run;key=await addForm(prefix+' campus');foreign=await addForm(prefix+' other owner',other)
  for(const [i,type]of ['RADIO','CHECKBOX','RATE','TEXTAREA'].entries()){ids[type]='assistant'+run+i;await question(key,type,ids[type],type==='TEXTAREA'?'校园设施有哪些体验和建议？':type==='RATE'?'校园体验评分':type+'体验')}
  version=await api('/user/form/publish',{formKey:key})
  const answer=(rate,text,choice=1)=>({[ids.RADIO]:choice,[ids.RADIO+'label']:choice===1?'A':choice===2?'B':'',[ids.CHECKBOX]:choice===1?[1,2]:choice===2?[2]:[],[ids.CHECKBOX+'label']:choice===1?['A','B']:choice===2?['B']:[],[ids.RATE]:rate,[ids.TEXTAREA]:text})
  await submit(key,version,answer(4,'Synthetic <img src=x onerror="window.assistantXss=1"> 食堂排队等待时间较长。'))
  await submit(key,version,answer(2,'Synthetic 希望食堂排队更有序。',2));await submit(key,version,answer(0,'',0))
  const originalHash=coreHash(key)
  await check('real MCP initialization, initialized notification and tools discovery complete',async()=>{
   const init=await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'independent-http-test',version:'1'}});assert.equal(init.status,200);assert.equal(init.body.result.protocolVersion,'2025-06-18')
   assert.equal((await rpc('notifications/initialized',{}, {notification:true})).status,202)
   const list=await rpc('tools/list');assert.equal(list.status,200);assert.equal(list.body.result.tools.length,4);assert.ok(list.body.result.tools.every(t=>t.annotations.readOnlyHint&&!t.annotations.destructiveHint));return{tools:list.body.result.tools.map(t=>t.name)}
  })
  await check('MCP transport rejects anonymous and forged credentials with HTTP 401',async()=>{assert.equal((await rpc('tools/list',{}, {token:null})).status,401);assert.equal((await rpc('tools/list',{}, {token:'synthetic-invalid-token'})).status,401)})
  await check('MCP Origin, Accept, method, JSON and protocol boundaries are enforced',async()=>{
   assert.equal((await rpc('tools/list',{}, {origin:'https://untrusted.example.test'})).status,403)
   assert.equal((await rpc('tools/list',{}, {accept:'application/json'})).status,406)
   assert.equal((await rpc('tools/list',{}, {httpMethod:'GET'})).status,405)
   assert.equal((await rpc('tools/list',{}, {protocol:'unsupported'})).status,400)
   assert.equal((await rpc('tools/list',{}, {body:'not-json'})).body.error.code,-32700)
   assert.equal((await rpc('tools/list',{}, {body:'[]'})).body.error.code,-32600)
   assert.equal((await rpc('tools/list',{}, {body:'['.repeat(2000)+'0'+']'.repeat(2000)})).body.error.code,-32600)
   assert.equal((await rpc('unknown_method')).body.error.code,-32601)
  })
  await check('survey search filters ownership before returning any records',async()=>{const result=await tool('search_surveys',{query:prefix,limit:10});assert.equal(result.total,1);assert.deepEqual(result.surveys.map(s=>s.formKey),[key])})
  await check('statistics tool reads true version totals, valid/missing denominators and mean',async()=>{const r=await tool('survey_stats',{formKey:key,version:1});assert.equal(r.answerCount,3);const scale=r.statistics.find(q=>q.typeCode==='RATE'),multi=r.statistics.find(q=>q.typeCode==='CHECKBOX');assert.equal(scale.mean,3);assert.equal(scale.validCount,2);assert.equal(scale.missingCount,1);assert.equal(multi.percentages.A,50);assert.equal(multi.percentages.B,100);assert.ok(r.statistics.every(q=>!('responses'in q)));return{version:r.version,answers:r.answerCount,mean:scale.mean}})
  await check('cross-owner scopes, arbitrary owner arguments and unavailable versions are denied',async()=>{
   const denied=await rpc('tools/call',{name:'survey_stats',arguments:{formKey:foreign}});assert.equal(denied.body.result.isError,true)
   assert.equal((await rpc('tools/call',{name:'search_surveys',arguments:{ownerId:1}})).body.error.code,-32602)
   assert.equal((await rpc('tools/call',{name:'survey_stats',arguments:{formKey:key,version:999}})).body.result.isError,true)
  })
  await check('keyword retrieval returns exact source text and separates matches from returned evidence',async()=>{const r=await tool('search_answers',{formKey:key,version:1,keywords:['排队'],limit:1});assert.equal(r.matchedResponseCount,2);assert.equal(r.matchedAnswerCount,2);assert.equal(r.returnedEvidenceCount,1);assert.equal(r.retrievalMode,'KEYWORD_LITERAL');assert.ok(r.citations[0].text.includes('assistantXss'));assert.equal(r.citations[0].fieldId,ids.TEXTAREA);assert.equal(r.citations[0].source,'CORE_OPEN_RESPONSE');return{matches:2,returned:1,mode:r.retrievalMode}})
  await check('write tools, SQL arguments and out-of-range limits cannot execute',async()=>{for(const [name,args]of [['delete_survey',{formKey:key}],['survey_stats',{formKey:key,sql:'DROP TABLE fm_user_form'}],['search_surveys',{limit:999}]])assert.equal((await rpc('tools/call',{name,arguments:args})).body.error.code,-32602);const r=await tool('search_surveys',{query:"%' OR 1=1 --"});assert.equal(r.total,0)})
  await check('report tool excludes pending candidates and returns only fresh approved reports',async()=>{
   assert.equal((await tool('survey_report',{formKey:key,version:1})).available,false)
   const report=await api('/user/form/research/reports',{formKey:key,version:1,mode:'LOCAL'})
   assert.equal((await tool('survey_report',{formKey:key,version:1})).available,false)
   await api('/user/form/research/reports/'+report.id+'/review',{status:'APPROVED',revision:0,note:'Synthetic assistant fixture: 已核对来源和本地分组范围。'})
   const r=await tool('survey_report',{formKey:key,version:1});assert.equal(r.available,true);assert.equal(r.reportId,report.id);assert.ok(r.citations.length)
  })
  conversation=await api(rest+'/conversations',{})
  const planBody={id:randomUUID(),conversationId:conversation.id,question:'这份问卷回收了多少答卷？',formKey:key,version:1,mode:'LOCAL'}
  await check('a saved local plan executes through HTTP MCP and appears in owner history',async()=>{turn=await api(rest+'/plan',planBody);assert.equal(turn.state,'READY');assert.equal(turn.plan.tool,'survey_stats');await tool(turn.plan.tool,turn.plan.arguments,turn.id);const h=await api(rest+'/conversations/'+conversation.id);const t=h.turns.find(t=>t.id===turn.id);assert.equal(t.state,'SUCCEEDED');assert.equal(t.result.answerCount,3);assert.ok(t.result.citations.length)})
  await check('plan and tool retries are idempotent and cannot overwrite question or arguments',async()=>{
   const again=await api(rest+'/plan',planBody);assert.equal(again.id,turn.id);assert.equal(again.state,'SUCCEEDED')
   const before=await tool(again.plan.tool,again.plan.arguments,again.id);assert.equal(before.answerCount,3)
   assert.notEqual((await raw(rest+'/plan',{...planBody,question:'Synthetic different request'})).code,200)
   assert.equal((await rpc('tools/call',{name:'survey_stats',arguments:{formKey:key,version:999},_meta:{assistantTurnId:again.id}})).body.result.isError,true)
   assert.equal((await api(rest+'/conversations/'+conversation.id)).turns.filter(t=>t.id===again.id).length,1)
  })
  await check('other users cannot read conversations, plan in them or replay private turn IDs',async()=>{
   assert.notEqual((await raw(rest+'/conversations/'+conversation.id,undefined,other)).code,200)
   assert.notEqual((await raw(rest+'/plan',{...planBody,id:randomUUID()},other)).code,200)
   assert.equal((await rpc('tools/call',{name:turn.plan.tool,arguments:turn.plan.arguments,_meta:{assistantTurnId:turn.id}},{token:other})).body.result.isError,true)
  })
  await check('real planner requires question-transfer acknowledgment',async()=>{assert.notEqual((await raw(rest+'/plan',{...planBody,id:randomUUID(),mode:'REAL',allowQuestionTransfer:false})).code,200)})
  if(process.argv.includes('--real'))await check('actual configured model plans a read tool and authoritative results remain backend facts',async()=>{
   const status=await api(rest+'/status');assert.equal(status.configured,true)
   const r=await api(rest+'/plan',{...planBody,id:randomUUID(),question:'请查询当前所选问卷的回收数、评分均值和有效回答数。',mode:'REAL',allowQuestionTransfer:true})
   assert.equal(r.mode,'REAL',r.warning);assert.equal(r.model,status.model);assert.equal(r.plan.tool,'survey_stats')
   const result=await tool(r.plan.tool,r.plan.arguments,r.id);assert.equal(result.statistics.find(q=>q.typeCode==='RATE').mean,3)
   fs.writeFileSync(out+'/real-planner.json',JSON.stringify({date:new Date().toISOString(),source:'Actual model planning; synthetic question and selected identifier only; no answers in planner input',model:r.model,provider:r.provider,mode:r.mode,tool:r.plan.tool,version:result.version,answerCount:result.answerCount,turnId:r.id},null,2)+'\n')
  })
  await check('unsupported write request remains a notice without invoking a write tool',async()=>{const r=await api(rest+'/plan',{...planBody,id:randomUUID(),question:'帮我删除全部问卷'});assert.equal(r.state,'SUCCEEDED');assert.equal(r.plan.tool,'none');assert.equal((await api('/user/form/'+key)).formKey,key)})
  await check('read-only tool and dialogue operations do not alter original answer rows',async()=>{assert.equal(coreHash(key),originalHash)})
  await submit(key,version,answer(5,'Synthetic 增加座位和排队指引。'))
  await check('new queries read changed data while earlier chat answers remain labelled snapshots',async()=>{assert.equal((await tool('survey_stats',{formKey:key,version:1})).answerCount,4);const h=await api(rest+'/conversations/'+conversation.id);assert.equal(h.turns.find(t=>t.id===turn.id).result.answerCount,3);const r=await tool('survey_report',{formKey:key,version:1});assert.equal(r.available,false);assert.equal(r.dataChanged,true)})
  await check('archiving a source hides stored answer text on subsequent history reads',async()=>{
   const isolated=await addForm('Synthetic assistant archival '+run);await question(isolated,'TEXTAREA','archival'+run,'Synthetic archival question');const v=await api('/user/form/publish',{formKey:isolated});await submit(isolated,v,{['archival'+run]:'Synthetic private-archival-marker'})
   const c=await api(rest+'/conversations',{}),p=await api(rest+'/plan',{id:randomUUID(),conversationId:c.id,question:'查找提到“private-archival-marker”的回答',formKey:isolated,version:1,mode:'LOCAL'})
   await tool(p.plan.tool,p.plan.arguments,p.id);assert.ok(JSON.stringify(await api(rest+'/conversations/'+c.id)).includes('Synthetic private-archival-marker'))
   await api('/user/form/stop',{formKey:isolated});await api('/user/form/logic/delete',{formKey:isolated})
   const hidden=await api(rest+'/conversations/'+c.id);assert.equal(hidden.turns[0].result.kind,'notice');assert.ok(!JSON.stringify(hidden).includes('Synthetic private-archival-marker'))
  })
  const latestReport=await api('/user/form/research/reports',{formKey:key,version:1,mode:'LOCAL'});await api('/user/form/research/reports/'+latestReport.id+'/review',{status:'APPROVED',revision:0,note:'Synthetic assistant fixture: 更新答卷后重新审核。'})
  await check('default latest version and explicitly selected historical version never mix answers',async()=>{
   await api('/user/form/stop',{formKey:key});const newer=await api('/user/form/publish',{formKey:key});await submit(key,newer,answer(5,'Synthetic 新版照明建议。'))
   const latest=await tool('survey_stats',{formKey:key});assert.equal(latest.version,2);assert.equal(latest.answerCount,1)
   const old=await tool('survey_stats',{formKey:key,version:1});assert.equal(old.answerCount,4);assert.equal(old.statistics.find(q=>q.typeCode==='RATE').mean,3.67)
   assert.equal((await tool('search_answers',{formKey:key,version:2,keywords:['排队']})).matchedResponseCount,0)
   assert.equal((await tool('survey_report',{formKey:key,version:1})).available,true)
  })
  const history=await api(rest+'/conversations/'+conversation.id),saved=history.turns.find(t=>t.id===turn.id)
  fs.writeFileSync(savedRunPath,JSON.stringify({key,foreign,version:version.versionNo,ids,conversationId:conversation.id,turnId:turn.id,result:saved.result,reportId:latestReport.id},null,2))
 }
}catch(e){checks.push({name:'setup and completion',passed:false,error:e.message.slice(0,450)});console.log('FAIL '+e.message.slice(0,180))}
finally{const result={date:new Date().toISOString(),source:'Real HTTP MCP and Spring Boot/MyBatis-Plus/MySQL; synthetic inputs only',formKey:key,checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length};fs.writeFileSync(out+(process.argv.includes('--replay')?'/restart-results.json':'/api-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,failed:result.failed}));if(result.failed)process.exitCode=1}
