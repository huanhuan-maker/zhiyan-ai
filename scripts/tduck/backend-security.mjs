import fs from 'node:fs'
import assert from 'node:assert/strict'
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),base='http://127.0.0.1:8997',checks=[]
async function api(url,data,token,headers={}){return fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{}),...(url.endsWith('/public/create')?{'X-Submission-Key':crypto.randomUUID()}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}).then(r=>r.json())}
async function ok(url,data,token,headers){const v=await api(url,data,token,headers);assert.equal(v.code,200,url+': '+v.msg);return v.data}
const owner=(await ok('/login/account',{account:f.owner,password:f.password})).token,other=(await ok('/login/account',{account:f.other,password:f.password})).token
const make=async(name,t)=>{const v=await ok('/user/form/create',{name,type:0},t);return typeof v==='string'?v:v.formKey}
const a=await make('Synthetic security owner form',owner),b=await make('Synthetic security alternate form',owner),c=await make('Synthetic security other form',other)
const id='input'+Date.now(),field={formKey:a,formItemId:id,type:'INPUT',label:'Synthetic immutable field',required:true,span:24,showLabel:true,scheme:{typeId:'INPUT',config:{formId:id,label:'Synthetic immutable field',required:true,span:24,showLabel:true,regList:[]}}}
await ok('/user/form/item/create',field,owner)
const payload={formKey:a,formType:1,originalData:{[id]:'Synthetic owner answer'},submitUa:{},completeTime:1000}
const data=await ok('/user/form/data/create',payload,owner)
assert.notEqual((await api('/user/form/data/update',{...payload,id:data.id,originalData:{[id]:'Unauthorized mutation'}},other)).code,200)
checks.push('non-owner cannot update a persisted owner answer')
assert.notEqual((await api('/user/form/data/create',{...payload,formKey:a},other)).code,200)
checks.push('authenticated private create requires form ownership')
assert.notEqual((await api('/user/form/data/delete/'+b,[data.id],owner)).code,200)
assert.notEqual((await api('/user/form/data/delete/'+c,[data.id],other)).code,200)
const rows=await ok('/user/form/data/query',{formKey:a,current:0,size:10,filter:{}},owner)
assert.equal(rows.total,1);assert.equal(rows.rows[0][id],'Synthetic owner answer')
checks.push('delete with another form key is rejected; original answer remains unchanged')
await ok('/user/form/setting/save',{formKey:a,passwordWriteStatus:true,writePassword:'SyntheticGate42'},owner)
await ok('/user/form/publish',{formKey:a},owner)
assert.notEqual((await api('/user/form/data/public/create',payload)).code,200)
await ok('/user/form/data/public/create',payload,undefined,{'X-Form-Password':'SyntheticGate42'})
checks.push('password protected public submission is enforced by server, including direct requests')
await ok('/user/form/stop',{formKey:a},owner)
for(const url of ['update','delete','create'])assert.notEqual((await api('/user/form/item/'+url,field,owner)).code,200)
assert.notEqual((await api('/user/form/item/batch/create',[field],owner)).code,200)
await ok('/user/form/update',{formKey:a,name:'Synthetic immutable form',status:1},owner)
assert.equal((await ok('/user/form/'+a,undefined,owner)).status,3)
checks.push('published then stopped core cannot be edited, deleted, appended, batch modified or unlocked through generic update')
fs.writeFileSync('evidence/tduck-full/backend-security.json',JSON.stringify({checks,passed:checks.length,failed:0},null,2));console.log(JSON.stringify({checks,passed:checks.length,failed:0},null,2))
