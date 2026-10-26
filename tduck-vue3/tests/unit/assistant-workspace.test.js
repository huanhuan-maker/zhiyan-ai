import {describe,it,expect} from 'vitest'
import {csvCell} from '../../src/td/assistant/download'
import {selectedSurveyQuestion} from '../../src/td/assistant/selection'

describe('answer export treats formulas as data',()=>{
  it('neutralizes formulas even after whitespace or control characters',()=>{
    for(const input of ['=HYPERLINK("bad")',' +1','\t@SUM(A1)','\r-2','\u0001=1'])expect(csvCell(input)).toBe('"\''+input.replaceAll('"','""')+'"')
  })
  it('preserves Chinese, quotes, multiline and structured answers',()=>{
    expect(csvCell('食堂\n"排队"')).toBe('"食堂\n""排队"""')
    expect(csvCell(['满意','方便'])).toBe('"[""满意"",""方便""]"')
    expect(csvCell(null)).toBe('""')
  })
})
describe('choosing a survey preserves the intended operation',()=>{
  it('asks for a proposal rather than returning statistics for a management request',()=>{
    expect(selectedSurveyQuestion('删除我的问卷')).toBe('把这份问卷移入回收站')
    expect(selectedSurveyQuestion('停止收集我的问卷')).toBe('停止这份问卷的收集')
    expect(selectedSurveyQuestion('复制校园问卷')).toBe('复制这份问卷')
  })
  it('keeps export version and share intent',()=>{
    expect(selectedSurveyQuestion('导出校园问卷V1')).toBe('导出这份问卷 V1的答卷')
    expect(selectedSurveyQuestion('获取链接')).toBe('获取这份问卷的分享链接')
  })
  it('keeps chart type, frozen version and the quoted question after choosing a survey',()=>{
    expect(selectedSurveyQuestion('基于“食堂调查”V1中“餐食满意度”生成饼图')).toBe('基于这份问卷 V1中“餐食满意度”的生成饼图')
    expect(selectedSurveyQuestion('基于“食堂调查”生成数据图')).toBe('基于这份问卷生成数据图')
    expect(selectedSurveyQuestion('查看最新版本的回收趋势图')).toBe('基于这份问卷最新版本生成回收趋势图')
  })
})
