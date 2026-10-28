import {describe,it,expect} from 'vitest'
import {selectedSurveyQuestion} from '../../src/td/assistant/selection'

describe('selecting a questionnaire from chat results',()=>{
  it('replaces the global questionnaire count request with a single-survey statistics request',()=>expect(selectedSurveyQuestion('我现在有多少份问卷')).toBe('查一下这份问卷的回收统计'))
  it('does not repeat catalogue/list searches',()=>expect(selectedSurveyQuestion('找出我全部的问卷')).toBe('查一下这份问卷的回收统计'))
  it('preserves a mean query without repeating a name search',()=>expect(selectedSurveyQuestion('查找食堂问卷的评分均值')).toBe('查看这份问卷的评分均值'))
  it('preserves the report intent',()=>expect(selectedSurveyQuestion('找一下校园问卷的已审核报告')).toBe('查看这份问卷的已审核报告'))
  it('uses the quoted answer keyword rather than a quoted questionnaire name',()=>expect(selectedSurveyQuestion('查找“食堂调查”问卷里提到“排队”的回答')).toBe('查看这份问卷中提到“排队”的回答'))
  it('supports an unquoted answer keyword',()=>expect(selectedSurveyQuestion('查找提到排队的回答')).toBe('查看这份问卷中提到“排队”的回答'))
  it('preserves an explicitly requested historical version and rating intent',()=>expect(selectedSurveyQuestion('查V1版本的评分')).toBe('关于这份问卷 V1，查V1版本的评分'))
  it('preserves a latest-version request',()=>expect(selectedSurveyQuestion('最新版本的统计')).toBe('查一下这份问卷最新版本的回收统计'))
})
