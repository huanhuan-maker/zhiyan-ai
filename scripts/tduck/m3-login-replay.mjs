// Never write account/password/token values to evidence.
import fs from 'node:fs'
import assert from 'node:assert/strict'
const f=JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,'')),checks=[]
const results=await Promise.all(Array.from({length:6},()=>fetch('http://127.0.0.1:8997/login/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:f.owner,password:f.password})}).then(r=>r.json()).then(r=>({code:r.code,hasToken:!!r.data?.token}))))
const passed=results.every(r=>r.code===200&&r.hasToken)
fs.mkdirSync('evidence/tduck-full/m3',{recursive:true});fs.writeFileSync('evidence/tduck-full/m3/login-replay.json',JSON.stringify({date:new Date().toISOString(),source:'Six concurrent real logins using private synthetic acceptance fixture; no credentials or tokens exported',passed,results},null,2)+'\n')
console.log(JSON.stringify({passed,codes:results.map(r=>r.code)}));if(!passed)process.exitCode=1
