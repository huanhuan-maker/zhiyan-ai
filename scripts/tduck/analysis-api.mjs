// M4-R: real HTTP/MyBatis-Plus/MySQL; synthetic survey and answers only.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { allComponents } from '../../tduck-vue3/src/td/generator/config.js'
const fixture = JSON.parse(fs.readFileSync('.local/tduck-dev/acceptance.json','utf8').replace(/^\uFEFF/,''))
const base = 'http://127.0.0.1:8997', out = 'evidence/tduck-full/analysis', checks = []
fs.mkdirSync(out,{recursive:true})
let owner, other, key, ids = {}, version, reportId
async function api(url,data,token=owner,headers={}) {
  const r = await fetch(base+url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{token}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})})
  return r.json()
}
async function ok(url,data,token,headers){const r=await api(url,data,token,headers);assert.equal(r.code,200,url+': '+r.msg);return r.data}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail});console.log('PASS '+name)}catch(e){checks.push({name,passed:false,error:e.message.slice(0,350)});console.log('FAIL '+name+': '+e.message.slice(0,180))}}
const research = '/user/form/research'
try {
  owner=(await ok('/login/account',{account:fixture.owner,password:fixture.password},null)).token
  other=(await ok('/login/account',{account:fixture.other,password:fixture.password},null)).token
  if(process.argv.includes('--replay')) {
    const saved=JSON.parse(fs.readFileSync('.local/tduck-ui-review/analysis-run.json','utf8'))
    key=saved.key;reportId=saved.reportId
    await check('report, snapshot and audit persist after a real backend restart',async()=>{
      const r=await ok(research+'/reports/'+saved.reportId)
      assert.equal(r.id,saved.reportId);assert.equal(r.revision,saved.revision);assert.equal(r.status,saved.status)
      assert.deepEqual(r.snapshot,saved.snapshot);assert.equal(r.reviews.length,saved.auditCount)
      return {reportId:r.id,version:r.versionNo,status:r.status,revision:r.revision}
    })
    await check('nonempty human review history also survives the backend restart',async()=>{
      assert.ok(saved.audited?.reviews.length>0)
      const r=await ok(research+'/reports/'+saved.audited.id)
      assert.equal(r.status,saved.audited.status);assert.equal(r.revision,saved.audited.revision);assert.deepEqual(r.reviews,saved.audited.reviews)
      return {reviewedReportId:r.id,status:r.status,revision:r.revision,eventCount:r.reviews.length}
    })
  } else {
    const created=await ok('/user/form/create',{name:'Synthetic M4-R 校园设施体验 '+Date.now(),type:0});key=typeof created==='string'?created:created.formKey
    const definitions=allComponents.flatMap(g=>g.list)
    for(const [index,type] of ['RADIO','CHECKBOX','RATE','TEXTAREA'].entries()) {
      const scheme=JSON.parse(JSON.stringify(definitions.find(i=>i.typeId===type)))
      const id='analysis'+Date.now()+index;ids[type]=id;scheme.config.formId=id;scheme.config.required=false;scheme.config.label=type==='TEXTAREA'?'请描述校园设施的使用体验和建议':type==='RATE'?'整体体验评分':'校园设施体验 '+type
      if(['RADIO','CHECKBOX'].includes(type))scheme.config.options=[{label:'A',value:1},{label:'B',value:2}]
      await ok('/user/form/item/create',{formKey:key,formItemId:id,type,label:scheme.config.label,required:false,span:24,showLabel:true,scheme})
    }
    version=await ok('/user/form/publish',{formKey:key})
    const submit=(v,rating,text,choice=1)=>ok('/user/form/data/public/create',{formKey:key,formType:0,versionToken:v.shareToken,submitUa:{},completeTime:1000,
      originalData:{[ids.RADIO]:choice,[ids.RADIO+'label']:choice===1?'A':choice===2?'B':'',[ids.CHECKBOX]:choice===1?[1,2]:choice===2?[2]:[],[ids.CHECKBOX+'label']:choice===1?['A','B']:choice===2?['B']:[],[ids.RATE]:rating,[ids.TEXTAREA]:text}},null,{'X-Submission-Key':randomUUID()})
    await submit(version,4,'晚餐排队时间比较长，希望增加取餐窗口。')
    await submit(version,2,'晚餐排队时间比较长，希望增加取餐窗口。',2)
    await submit(version,0,'',0)
    let snapshot,report
    await check('published version statistics use true valid/missing denominators and backend means',async()=>{
      snapshot=await ok(`${research}/snapshot?formKey=${key}&version=1`)
      assert.equal(snapshot.answerCount,3)
      const scale=snapshot.statistics.find(q=>q.typeCode==='RATE'),multi=snapshot.statistics.find(q=>q.typeCode==='CHECKBOX')
      assert.equal(scale.mean,3);assert.equal(scale.validCount,2);assert.equal(scale.missingCount,1)
      assert.equal(multi.percentages.A,50);assert.equal(multi.percentages.B,100)
      assert.equal(snapshot.openResponseCount,2);assert.equal(snapshot.includedEvidenceCount,2);assert.equal(snapshot.excludedEvidenceCount,0)
      return {answers:3,validScale:2,missingScale:1,mean:scale.mean,multiPercentages:multi.percentages}
    })
    await check('anonymous, other owner and nonexistent versions cannot read report inputs',async()=>{
      assert.notEqual((await api(`${research}/snapshot?formKey=${key}&version=1`,undefined,null)).code,200)
      assert.notEqual((await api(`${research}/snapshot?formKey=${key}&version=1`,undefined,other)).code,200)
      assert.notEqual((await api(`${research}/snapshot?formKey=${key}&version=999`)).code,200)
    })
    await check('local grouping saves a labelled report without invoking AI',async()=>{
      report=await ok(research+'/reports',{formKey:key,version:1,mode:'LOCAL'});reportId=report.id
      assert.equal(report.mode,'LOCAL');assert.equal(report.model,'exact-text-v1');assert.equal(report.status,'PENDING');assert.equal(report.dataChanged,false)
      assert.equal(report.output.themes.length,1);assert.equal(report.output.themes[0].supportAnswerCount,2)
      assert.equal(report.output.themes[0].classification,'EXACT_TEXT_GROUP')
      return {reportId:report.id,supportAnswerCount:2,mode:report.mode}
    })
    await check('every reference resolves to an exact persisted core answer with provenance',async()=>{
      const e=Object.fromEntries(report.snapshot.evidence.map(x=>[x.id,x]))
      const credentials=JSON.parse(fs.readFileSync('.local/tduck-credentials.json','utf8').replace(/^\uFEFF/,''))
      for(const t of report.output.themes)for(const id of t.evidenceIds){
        const ref=e[id];assert.ok(ref);assert.match(ref.answerId,/^[0-9]+$/)
        const raw=execFileSync('D:/MySQL/MySQL Server 8.0/bin/mysql.exe',['--host=127.0.0.1','--user=root','--default-character-set=utf8mb4','--raw','-N','-B','tduck_vue3_dev','--execute=SELECT original_data FROM fm_user_form_data WHERE id='+ref.answerId],{encoding:'utf8',env:{...process.env,MYSQL_PWD:credentials.mysqlRootPassword},stdio:['pipe','pipe','pipe']})
        assert.equal(JSON.parse(raw)[ref.fieldId],ref.text);assert.equal(ref.source,'CORE_OPEN_RESPONSE');assert.ok(ref.attribution.includes('未经判定'))
      }
    })
    await check('report detail, history, generation, review and both exports reject other owners',async()=>{
      for(const path of [`/reports/${report.id}`,`/reports?formKey=${key}&version=1`,`/reports/${report.id}/export?format=json`,`/reports/${report.id}/export?format=markdown`])assert.notEqual((await api(research+path,undefined,other)).code,200)
      assert.notEqual((await api(research+'/reports',{formKey:key,version:1,mode:'LOCAL'},other)).code,200)
      assert.notEqual((await api(research+`/reports/${report.id}/review`,{status:'APPROVED',revision:0,note:'Synthetic unauthorized'},other)).code,200)
    })
    await check('real model transfer requires explicit authorization before calling provider',async()=>{assert.notEqual((await api(research+'/reports',{formKey:key,version:1,mode:'REAL',allowModelTransfer:false})).code,200)})
    await check('review validates status and note, then persists an audit event',async()=>{
      assert.notEqual((await api(research+`/reports/${report.id}/review`,{status:'PENDING',revision:0,note:'invalid'})).code,200)
      assert.notEqual((await api(research+`/reports/${report.id}/review`,{status:'APPROVED',revision:0,note:''})).code,200)
      report=await ok(research+`/reports/${report.id}/review`,{status:'APPROVED',revision:0,note:'Synthetic review: 核对原文和后端分母，相同文本组匹配。'})
      assert.equal(report.revision,1);assert.equal(report.status,'APPROVED');assert.equal(report.reviews.length,1)
    })
    await check('concurrent reviews do not overwrite an accepted revision',async()=>{
      const result=await Promise.all(['A','B'].map(note=>api(research+`/reports/${report.id}/review`,{status:'APPROVED',revision:1,note:'Synthetic concurrency '+note})))
      assert.equal(result.filter(r=>r.code===200).length,1)
      report=await ok(research+'/reports/'+report.id);assert.equal(report.revision,2);assert.equal(report.reviews.length,2)
    })
    await check('Markdown and JSON exports include source, version, denominators, evidence and review status',async()=>{
      for(const format of ['markdown','json']){
        const r=await fetch(`${base}${research}/reports/${report.id}/export?format=${format}`,{headers:{token:owner}})
        assert.equal(r.status,200);assert.ok(r.headers.get('content-disposition').includes('attachment'))
        const body=await r.text();assert.ok(body.includes(report.id));assert.ok(body.includes('exact-text-v1'));assert.ok(body.includes('晚餐排队'))
        if(format==='json'){const data=JSON.parse(body);assert.equal(data.snapshot.statistics.find(q=>q.typeCode==='RATE').mean,3);assert.equal(data.status,'APPROVED')}
        else {assert.ok(body.includes('缺失'));assert.ok(body.includes('总体比例'));fs.writeFileSync(out+'/synthetic-report.md',body)}
      }
    })
    await submit(version,5,'图书馆插座不够，希望增加插座。')
    await check('new answer marks saved report stale without rewriting its original snapshot',async()=>{
      const r=await ok(research+'/reports/'+report.id);assert.equal(r.dataChanged,true);assert.equal(r.snapshot.answerCount,3)
      const live=await ok(`${research}/snapshot?formKey=${key}&version=1`);assert.equal(live.answerCount,4)
      assert.notEqual((await api(research+`/reports/${report.id}/review`,{status:'APPROVED',revision:r.revision,note:'Synthetic stale approval'})).code,200)
      report=await ok(research+`/reports/${report.id}/review`,{status:'REJECTED',revision:r.revision,note:'Synthetic stale rejection: 已增加答卷，需重生成。'});assert.equal(report.status,'REJECTED')
    })
    await check('changed generation inputs cannot be sent to model under an earlier preview acknowledgment',async()=>{
      const before=(await ok(`${research}/reports?formKey=${key}&version=1`)).length
      const denied=await api(research+'/reports',{formKey:key,version:1,mode:'REAL',allowModelTransfer:true,snapshotFingerprint:snapshot.fingerprint})
      assert.notEqual(denied.code,200);assert.ok(denied.msg.includes('输入已变化'))
      assert.equal((await ok(`${research}/reports?formKey=${key}&version=1`)).length,before)
    })
    await ok('/user/form/stop',{formKey:key});version=await ok('/user/form/publish',{formKey:key})
    await submit(version,5,'<img src=x onerror="window.analysisXss=1"> Synthetic 安全原文，图书馆插座不够。')
    await check('republished versions isolate answers, statistics and report history',async()=>{
      const v2=await ok(`${research}/snapshot?formKey=${key}&version=2`);assert.equal(v2.answerCount,1);assert.equal(v2.statistics.find(q=>q.typeCode==='RATE').mean,5)
      const old=await ok(`${research}/snapshot?formKey=${key}&version=1`);assert.equal(old.answerCount,4)
      assert.equal((await ok(`${research}/reports?formKey=${key}&version=2`)).length,0)
      assert.ok((await ok(`${research}/reports?formKey=${key}&version=1`)).every(r=>r.versionNo===1))
    })
    let realReport
    if(process.argv.includes('--real'))await check('actual configured model returns validated citations for synthetic answers',async()=>{
      const status=await ok(research+'/status');assert.equal(status.configured,true)
      const preview=await ok(`${research}/snapshot?formKey=${key}&version=2`)
      realReport=await ok(research+'/reports',{formKey:key,version:2,mode:'REAL',allowModelTransfer:true,snapshotFingerprint:preview.fingerprint})
      assert.equal(realReport.mode,'REAL');assert.equal(realReport.model,status.model);assert.ok(realReport.output.themes.length)
      for(const theme of realReport.output.themes)assert.ok(theme.evidenceIds.every(id=>realReport.snapshot.evidence.some(e=>e.id===id)))
      fs.writeFileSync(out+'/real-provider.json',JSON.stringify({date:new Date().toISOString(),reportId:realReport.id,provider:realReport.provider,model:realReport.model,mode:realReport.mode,themes:realReport.output.themes,source:'Actual provider; synthetic answers only; references validated server-side'},null,2)+'\n')
      return {provider:realReport.provider,model:realReport.model,reportId:realReport.id}
    })
    await check('local mode stays available alongside configured real provider',async()=>{
      report=await ok(research+'/reports',{formKey:key,version:2,mode:'LOCAL'});assert.equal(report.mode,'LOCAL');assert.equal(report.snapshot.answerCount,1);reportId=report.id
    })
    fs.writeFileSync('.local/tduck-ui-review/analysis-run.json',JSON.stringify({key,reportId:report.id,version:2,ids,status:report.status,revision:report.revision,auditCount:report.reviews.length,snapshot:report.snapshot,realReportId:realReport?.id},null,2))
  }
}catch(e){checks.push({name:'API setup and completion',passed:false,error:e.message.slice(0,350)});console.log('FAIL '+e.message.slice(0,180))}
finally{
  const result={date:new Date().toISOString(),source:'Real Spring Boot/MyBatis-Plus/MySQL; synthetic survey and answers',formKey:key,reportId,checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length}
  fs.writeFileSync(out+(process.argv.includes('--replay')?'/restart-results.json':'/api-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,failed:result.failed}));if(result.failed)process.exitCode=1
}
