import {describe,it,expect} from 'vitest'
import {editedDraftQuestion} from '../../src/td/generator/draft-edit'
const original={type:'RADIO',label:'餐食满意程度',required:true,options:['满意','一般','不满意']}
const other={type:'TEXTAREA',label:'改进建议',required:false,placeholder:'描述具体经历'}
describe('AI draft manual editing keeps user-reviewed content valid',()=>{
  it('returns a detached revision without mutating the original or another question',()=>{
    const questions=[structuredClone(original),structuredClone(other)],before=structuredClone(questions)
    const revision=editedDraftQuestion({...questions[0],label:' 新题干 ',required:false,options:[' 很满意 ','一般','不满意']},questions,0)
    expect(revision.label).toBe('新题干');expect(revision.options[0]).toBe('很满意');expect(revision.required).toBe(false);expect(questions).toEqual(before)
  })
  it('rejects blank, excessively long and duplicate wording that could break import recovery',()=>{
    for(const label of ['', '   ', '长'.repeat(201), ' 改进建议 '])expect(()=>editedDraftQuestion({...original,label},[original,other],0)).toThrow(/题干/)
  })
  it('rejects blank, duplicate, missing and out-of-range options',()=>{
    for(const options of [[],['a'],['a',' '],['a',' a '],Array.from({length:21},(_,i)=>String(i)),['a','长'.repeat(201)]])expect(()=>editedDraftQuestion({...original,options},[original],0)).toThrow(/选项/)
  })
  it('rejects invalid scores and accepts a bounded integer rating range',()=>{
    for(const rateMax of [undefined,0,1,11,3.5,'7'])expect(()=>editedDraftQuestion({type:'RATE',label:'评分',rateMax},[],0)).toThrow(/评分/)
    expect(editedDraftQuestion({type:'RATE',label:'评分',rateMax:7},[],0).rateMax).toBe(7)
  })
  it('removes irrelevant choice and score fields when changing the unpublished question type',()=>{
    const text=editedDraftQuestion({...original,type:'TEXTAREA',rateMax:5,placeholder:' 具体建议 '},[original],0)
    expect(text.options).toBeUndefined();expect(text.rateMax).toBeUndefined();expect(text.placeholder).toBe('具体建议')
    const rating=editedDraftQuestion({...original,type:'RATE',rateMax:7},[original],0);expect(rating.options).toBeUndefined()
  })
  it('blocks unsupported components and oversized answer hints',()=>{
    expect(()=>editedDraftQuestion({...original,type:'SQL'},[],0)).toThrow(/题型/)
    expect(()=>editedDraftQuestion({...other,placeholder:'长'.repeat(201)},[],0)).toThrow(/回答提示/)
  })
})
