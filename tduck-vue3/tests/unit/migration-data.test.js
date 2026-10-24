import {describe,it,expect} from 'vitest'
import {createField,formItemConvertData,dbDataConvertForItemJson,visibleFields} from '../../src/td/generator/schema'
import {validateFields,decorateAnswers} from '../../src/td/generator/validation'
describe('TDuck Vue 3 data compatibility',()=>{
 it('requires and retains the text of a selected other option',async()=>{
  const field=createField('RADIO'),id=field.config.formId
  field.config.options.push({value:0,label:'其他',type:'input'})
  expect(await validateFields([field],{[id]:0})).toEqual([{field:id,message:'请输入其他内容'}])
  const model={[id]:0,[id+'other']:'合成测试说明'}
  expect(await validateFields([field],model)).toEqual([])
  expect(decorateAnswers([field],model)).toEqual({...model,[id+'label']:'合成测试说明'})
 })
 it('retains saved identity, array defaults, labels and options on a database round trip',()=>{
  const field=createField('CHECKBOX');field.config.defaultValue=[1];field.config.label='选择偏好'
  const db={...formItemConvertData(field,'test-key'),id:7,sort:100}
  const restored=dbDataConvertForItemJson(db)
  expect(restored.config.formId).toBe(field.config.formId)
  expect(restored.config.defaultValue).toEqual([1]);expect(restored.config.options).toEqual(field.config.options)
  expect(restored.sort).toBe(100)
 })
 it('uses the second condition relation and removes hidden answers from submission',()=>{
  const choice=createField('RADIO'),follow=createField('INPUT'),other=createField('INPUT')
  const rules=[{conditionList:[{formItemId:choice.config.formId,expression:'eq',optionValue:1,relation:'AND'},{formItemId:other.config.formId,expression:'eq',optionValue:'yes',relation:'OR'}],triggerList:[{formItemId:follow.config.formId,type:'show'}]}]
  const model={[choice.config.formId]:2,[other.config.formId]:'yes',[follow.config.formId]:'conditional response'}
  expect(visibleFields([choice,follow,other],model,rules)).toContain(follow)
  model[other.config.formId]='no'
  expect(decorateAnswers(visibleFields([choice,follow,other],model,rules),model)).not.toHaveProperty(follow.config.formId)
 })
 it('validates required questions on every page and nested matrix cells',async()=>{
  const a=createField('INPUT'),page=createField('PAGINATION'),b=createField('MATRIX_INPUT')
  const model={[a.config.formId]:'',[b.config.formId]:{1:{1:'only one cell'}}}
  const errors=await validateFields([a,page,b],model)
  expect(errors.some(e=>e.field===a.config.formId)).toBe(true)
  expect(errors.some(e=>e.field===b.config.formId)).toBe(true)
 })
 it('preserves selection labels for the original backend data list and statistics',()=>{
  const radio=createField('RADIO'),multi=createField('CHECKBOX')
  const answers=decorateAnswers([radio,multi],{[radio.config.formId]:1,[multi.config.formId]:[1,2]})
  expect(answers[radio.config.formId+'label']).toBe('选项一')
  expect(answers[multi.config.formId+'label']).toEqual(['选项一','选项二'])
 })
 it('handles zero numeric answers and rejects invalid configured regular expressions',async()=>{
  const number=createField('NUMBER'),text=createField('INPUT');text.config.regList=[{pattern:'[',message:'bad'}]
  expect(await validateFields([number],{[number.config.formId]:0})).toEqual([])
  expect(await validateFields([text],{[text.config.formId]:'x'})).toEqual([{field:text.config.formId,message:'该题校验规则配置错误'}])
 })
})
