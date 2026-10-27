import fs from 'node:fs'
import assert from 'node:assert/strict'
const base='http://127.0.0.1:8997',root='/user/form/ai/workspace/slots',out='evidence/tduck-full/ai-slots',checks=[],created=new Set()
fs.mkdirSync(out,{recursive:true})
const f=JSON.parse(fs.readFileSync('.local/assistant-simple/acceptance.json','utf8').replace(/^\uFEFF/,''))
async function raw(url,data,token){return fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json())}
async function api(url,data,token){const r=await raw(url,data,token);assert.equal(r.code,200,r.msg);return r.data}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,600)});console.log('FAIL '+name+': '+e.message.slice(0,220))}}
const owner=(await api('/login/account',{account:f.owner,password:f.password})).token,other=(await api('/login/account',{account:f.other,password:f.password})).token
const snapshot=n=>({form:{goal:'合成暂存目标 '+n,audience:'测试',extra:'',questionCount:1},result:{kind:'draft',title:'合成暂存 '+n,description:'',questions:[{type:'TEXTAREA',label:'合成题目 '+n,required:false}],provider:'synthetic',model:'fixture',elapsedMs:1}})
try{
 const initial=await api(root,undefined,owner);assert.equal(initial.length,0,'Synthetic owner has existing slots; no data was changed')
 await check('anonymous calls cannot list or create drafts',async()=>{assert.notEqual((await raw(root)).code,200);assert.notEqual((await raw(root,snapshot(1))).code,200)})
 await check('outdated single-draft clients cannot silently overwrite the old workspace',async()=>{const before=await api('/user/form/ai/workspace',undefined,owner);assert.notEqual((await raw('/user/form/ai/workspace',snapshot(1),owner)).code,200);assert.notEqual((await raw('/user/form/ai/workspace/clear',{},owner)).code,200);assert.deepEqual(await api('/user/form/ai/workspace',undefined,owner),before)})
 let a,b,c
 await check('two distinct drafts persist independently',async()=>{a=await api(root,snapshot(1),owner);created.add(a.id);b=await api(root,snapshot(2),owner);created.add(b.id);assert.notEqual(a.id,b.id);assert.equal((await api(root+'/'+a.id,undefined,owner)).snapshot.result.title,'合成暂存 1');assert.equal((await api(root+'/'+b.id,undefined,owner)).snapshot.result.title,'合成暂存 2')})
 await check('simultaneous creates cannot exceed the three-draft limit',async()=>{const results=await Promise.all([raw(root,snapshot(3),owner),raw(root,snapshot(4),owner)]);const success=results.filter(x=>x.code===200);for(const x of success)created.add(x.data.id);assert.equal(success.length,1);assert.equal(results.filter(x=>x.code!==200).length,1);c=success[0].data;assert.equal((await api(root,undefined,owner)).length,3);return {successful:1,rejected:1}})
 await check('saving one existing draft does not alter the other two',async()=>{await api(root+'/'+a.id,snapshot(5),owner);assert.equal((await api(root+'/'+a.id,undefined,owner)).snapshot.result.title,'合成暂存 5');assert.equal((await api(root+'/'+b.id,undefined,owner)).snapshot.result.title,'合成暂存 2');assert.equal((await api(root,undefined,owner)).length,3)})
 await check('other account cannot read, update or remove a draft',async()=>{for(const [url,data] of [[root+'/'+a.id,undefined],[root+'/'+a.id,snapshot(6)],[root+'/'+a.id+'/remove',{}]])assert.notEqual((await raw(url,data,other)).code,200);assert.equal((await api(root+'/'+a.id,undefined,owner)).snapshot.result.title,'合成暂存 5')})
 await check('removing a slot and reusing its position cannot let a stale ID overwrite the new draft',async()=>{await api(root+'/'+b.id+'/remove',{},owner);created.delete(b.id);const d=await api(root,snapshot(6),owner);created.add(d.id);assert.notEqual(b.id,d.id);assert.equal(b.slot,d.slot);assert.notEqual((await raw(root+'/'+b.id,snapshot(7),owner)).code,200);assert.equal((await api(root+'/'+d.id,undefined,owner)).snapshot.result.title,'合成暂存 6')})
}finally{
 for(const id of created)await raw(root+'/'+id+'/remove',{},owner)
 const report={date:new Date().toISOString(),source:'Authenticated real backend/MySQL, synthetic accounts and snapshots, test-created entries removed.',checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length};fs.writeFileSync(out+'/api.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1
}
