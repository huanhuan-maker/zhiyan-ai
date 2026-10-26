import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const out='evidence/tduck-full/assistant-workspace',cache='.local/assistant-workspace/persistence.json'
const f=JSON.parse(fs.readFileSync('.local/assistant-simple/acceptance.json','utf8').replace(/^\uFEFF/,'')),run=JSON.parse(fs.readFileSync('.local/assistant-workspace/run.json','utf8')),credentials=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
const base='http://127.0.0.1:8997',hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
const login=await fetch(base+'/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:f.owner,password:f.password})}).then(r=>r.json());assert.equal(login.code,200)
async function api(url){const r=await fetch(base+url,{headers:{token:login.data.token}}).then(r=>r.json());assert.equal(r.code,200,r.msg);return r.data}
assert.match(run.conversationId,/^[a-f0-9-]{36}$/)
const history=await api('/user/form/assistant/conversations/'+run.conversationId)
const sql=`SELECT a.turn_id,a.action,a.decision,JSON_UNQUOTE(JSON_EXTRACT(a.result_json,'$.kind')) FROM fm_assistant_action a JOIN fm_assistant_turn t ON a.turn_id=t.id WHERE t.conversation_id='${run.conversationId}' ORDER BY a.turn_id`
const audit=execFileSync('D:/MySQL/MySQL Server 8.0/bin/mysql.exe',['--host=127.0.0.1','--user=root','--default-character-set=utf8mb4','--raw','-N','-B','tduck_vue3_dev','--execute='+sql],{encoding:'utf8',env:{...process.env,MYSQL_PWD:credentials.mysqlRootPassword},stdio:['pipe','pipe','pipe']}).trim().split(/\r?\n/)
assert.ok(audit.length>=12);assert.equal(new Set(audit.map(x=>x.split('\t')[0])).size,audit.length)
const proposal=history.turns.find(t=>t.id===run.designId);assert.equal(proposal.result.kind,'action_proposal')
const stats=history.turns.find(t=>t.result?.kind==='statistics');assert.equal(stats.result.answerCount,4)
const state={historyHash:hash(history),auditHash:hash(audit),auditRows:audit.length,formHash:hash(await api('/user/form/'+run.key)),turns:history.turns.length}
if(process.argv.includes('--capture')){fs.writeFileSync(cache,JSON.stringify(state));console.log('Captured persisted conversation, unsaved design proposal, chart snapshot and action audit fingerprints.')}
else{assert.deepEqual(state,JSON.parse(fs.readFileSync(cache,'utf8')));const result={date:new Date().toISOString(),passed:4,failed:0,checks:['Conversation with chart statistics unchanged after JVM restart','Unconfirmed real-model design proposal still pending','Confirmed questionnaire changes persist','One immutable audit row per action decision'],...state};fs.writeFileSync(out+'/persistence.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))}
