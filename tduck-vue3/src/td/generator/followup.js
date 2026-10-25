import {reactive,ref,watch,onBeforeUnmount} from 'vue'
import axios from 'axios'

// Public capabilities are kept in this tab. AI errors have no global login/error interceptor.
const client=axios.create({baseURL:process.env.VUE_APP_API_ROOT,timeout:12000})
export function submissionKey(formKey,version){
  const name=`tdSubmission:${formKey}:v${version??'draft'}`
  let key=sessionStorage.getItem(name)
  if(!key){key=crypto.randomUUID();sessionStorage.setItem(name,key)}
  return key
}
export function followupStorageKey(formKey,version){return `tdFollowup:${formKey}:v${version}`}
export function useFollowup(props,formModel){
  const enabled=ref(false),consent=ref(false),ready=ref(false),notice=ref(''),remaining=ref(0),providerLabel=ref('')
  const allowed=ref([]),decisions=reactive({}),busy=reactive({}),replies=reactive({})
  let capability='',storageKey='',timer,disposed=false,revision=0
  async function request(path,data){
    const response=await client.request({url:'/form/followup/'+path,method:data===undefined?'GET':'POST',data,headers:{...(capability?{'X-Followup-Session':capability}:{}),...(props.formConf.writePassword?{'X-Form-Password':props.formConf.writePassword}:{})}})
    if(response.data?.code!==200)throw Error(response.data?.msg||'追问暂时不可用')
    return response.data.data
  }
  function applyState(state,restoreSources=false){
    consent.value=state.consent;remaining.value=state.budgetRemaining
    for(const d of state.decisions||[])decisions[d.questionId]=d
    if(restoreSources)for(const source of state.sources||[]){if(!Object.prototype.hasOwnProperty.call(props.pageFormModel,source.questionId)&&!formModel[source.questionId])formModel[source.questionId]=source.answerText}
    if(state.status==='SUBMITTED'){ready.value=false;notice.value='本次答卷已提交，追问记录已保存'}
    if((state.decisions||[]).some(d=>d.state==='EVALUATING'))schedulePoll()
  }
  function schedulePoll(){
    clearTimeout(timer)
    timer=setTimeout(async()=>{if(disposed||!capability)return;try{applyState(await request('state'))}catch{notice.value='追问暂时不可用，你可以继续填写和提交核心问卷'}},2500)
  }
  watch(()=>[props.formConf.formKey,props.formConf.version,props.formConf.allowFollowup],async()=>{
    const current=++revision;clearTimeout(timer);enabled.value=false;ready.value=false;notice.value='';capability=''
    for(const key of Object.keys(decisions))delete decisions[key]
    const conf=props.formConf
    if(!conf.allowFollowup||!conf.formKey||!conf.version||conf.versionStatus!==1)return
    try{
      const response=await client.get('/form/followup/info',{params:{formKey:conf.formKey,versionToken:conf.versionToken||''}})
      if(current!==revision||response.data?.code!==200||!response.data.data?.enabled)return
      const policy=response.data.data;enabled.value=true;allowed.value=policy.allowedQuestionIds||[];remaining.value=policy.totalBudget
      providerLabel.value=[policy.providerInfo?.provider,policy.providerInfo?.model,`本次追问时间上限 ${Math.ceil(policy.timeBudgetSeconds/60)} 分钟`].filter(Boolean).join(' · ')
      storageKey=followupStorageKey(conf.formKey,conf.version);capability=sessionStorage.getItem(storageKey)||''
      if(capability)applyState(await request('state'),true)
      else{
        const state=await request('session',{formKey:conf.formKey,versionToken:conf.versionToken||'',submissionKey:submissionKey(conf.formKey,conf.version),consent:false})
        capability=state.capability;sessionStorage.setItem(storageKey,capability);applyState(state,true)
      }
      if(current===revision)ready.value=notice.value!=='本次答卷已提交，追问记录已保存'
    }catch{if(current===revision)notice.value='追问暂时不可用；核心问卷仍可正常填写和提交'}
  },{immediate:true})
  async function changeConsent(value){
    const previous=!value
    ready.value=false
    try{const state=await request('consent',{consent:value});applyState(state);ready.value=state.status==='ACTIVE';notice.value=value?'你可随时跳过追问或取消同意':'已选择只填核心问卷，不会将回答发送给模型'}
    catch{consent.value=previous;ready.value=true;notice.value='未能更新追问选择。请稍后重试；可以直接提交核心问卷'}
  }
  async function evaluate(field){
    const id=field.config.formId
    if(!ready.value||!consent.value||busy[id]||decisions[id])return
    busy[id]=true
    try{
      decisions[id]=await request('decide',{questionId:id,answer:String(formModel[id]||'')})
      applyState(await request('state'))
    }catch{notice.value='追问评估未完成，可继续答题或直接提交；已发出的请求不会重复扣预算';schedulePoll()}
    finally{busy[id]=false}
  }
  async function respond(field,skip){
    const id=field.config.formId,d=decisions[id]
    if(!d||busy[id])return
    if(!skip&&!String(replies[id]||'').trim()){notice.value='请填写补充回答，或点击跳过';return}
    busy[id]=true
    try{decisions[id]=await request('respond',{decisionId:d.id,answer:skip?null:replies[id],skip})}
    catch{notice.value='补充回答暂未保存，请重试；不影响核心问卷提交'}finally{busy[id]=false}
  }
  onBeforeUnmount(()=>{disposed=true;revision++;clearTimeout(timer)})
  return {enabled,consent,ready,notice,remaining,providerLabel,allowed,decisions,busy,replies,changeConsent,evaluate,respond}
}
