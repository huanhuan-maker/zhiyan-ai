import Schema from 'async-validator'
const empty=v=>v==null||v===''||(Array.isArray(v)&&!v.length)||(typeof v==='object'&&!Object.keys(v).length)
export async function validateFields(fields,model){
 const errors=[]
 for(const field of fields){
  if(field.config.displayType||field.typeId==='PAGINATION')continue
  const id=field.config.formId,value=model[id]
  if(field.config.required&&empty(value)){errors.push({field:id,message:'此题为必填项目'});continue}
  if(empty(value))continue
  if(['RADIO','CHECKBOX'].includes(field.typeId)&&field.config.otherRequired!==false&&(value===0||Array.isArray(value)&&value.includes(0))&&empty(model[id+'other']))errors.push({field:id,message:'请输入其他内容'})
  const rules=[]
  for(const r of field.config.regList||[]){try{rules.push({pattern:new RegExp(r.pattern),message:r.message||'格式不正确'})}catch{errors.push({field:id,message:'该题校验规则配置错误'})}}
  if(['INPUT','TEXTAREA'].includes(field.typeId)){if(field.minlength!=null)rules.push({type:'string',min:field.minlength,message:`至少输入 ${field.minlength} 个字符`});if(field.maxlength!=null)rules.push({type:'string',max:field.maxlength,message:`最多输入 ${field.maxlength} 个字符`})}
  if(rules.length)try{await new Schema({[id]:rules}).validate({[id]:value})}catch(e){errors.push(...e.errors)}
  if(field.config.required&&field.typeId.startsWith('MATRIX_'))for(const row of field.table.rows){if(field.typeId==='MATRIX_INPUT'){for(const col of field.table.columns)if(empty(value?.[row.id]?.[col.id]))errors.push({field:id,message:'请填写所有矩阵单元格'})}else if(empty(value?.[row.id]))errors.push({field:id,message:'请完成所有矩阵行'})}
  if(field.typeId==='SUB_FORM')for(const row of value||[])for(const e of await validateFields(field.childList||[],row))errors.push({...e,field:id})
 }
 return errors
}
export function decorateAnswers(fields,model,resolvedOptions={}){
 const result={}
 const find=(options,value)=>{for(const op of options||[]){if(String(op.value)===String(value))return op.label;const child=find(op.children,value);if(child!==undefined)return child}}
 for(const field of fields){if(field.config.displayType||field.typeId==='PAGINATION')continue;const id=field.config.formId,value=model[id];result[id]=value;if(['RADIO','CHECKBOX','SELECT','CASCADER','IMAGE_SELECT'].includes(field.typeId)){const label=v=>find(resolvedOptions[id]||field.config.options,v)??'';result[id+'label']=Array.isArray(value)?value.map(label):label(value)}if(field.typeId==='SUB_FORM')result[id]=(value||[]).map(row=>decorateAnswers(field.childList||[],row,resolvedOptions))}
 for(const field of fields){
  const id=field.config.formId,value=model[id]
  if(['RADIO','CHECKBOX'].includes(field.typeId)&&(value===0||Array.isArray(value)&&value.includes(0))){
   const other=model[id+'other']||'';result[id+'other']=other
   const label=v=>Number(v)===0?other:find(resolvedOptions[id]||field.config.options,v)??''
   result[id+'label']=Array.isArray(value)?value.map(label):label(value)
  }
 }
 return result
}
