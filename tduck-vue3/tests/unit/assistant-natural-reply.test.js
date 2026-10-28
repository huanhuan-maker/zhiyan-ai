import {it,expect} from 'vitest'
import {selectedSurveyQuestion} from '../../src/td/assistant/selection'
import {wantsInlineChart} from '../../src/td/assistant/knowledge'
it('preserves the actual question after selecting a survey',()=>{
 expect(selectedSurveyQuestion('哪个选项人数最多')).toContain('哪个选项人数最多')
 expect(selectedSurveyQuestion('哪个评分最高')).toContain('哪个评分最高')
 expect(selectedSurveyQuestion('评分分布是什么样的')).toContain('评分分布是什么样的')
})
it('does not replace a focused analysis with a generic summary',()=>{
 const question=selectedSurveyQuestion('分析低评分的人最关心什么')
 expect(question).toContain('低评分的人最关心什么')
 expect(question).not.toContain('回收统计')
})
it('replaces the chosen survey name while retaining the requested topic',()=>{
 const question=selectedSurveyQuestion('分析“校园调查”里学生对活动时间的反馈','校园调查')
 expect(question).toContain('活动时间的反馈')
 expect(question).not.toContain('校园调查')
})
it('opens chart panels only for explicit positive requests',()=>{
 expect(wantsInlineChart('查一下这份问卷的回收统计')).toBe(false)
 expect(wantsInlineChart('不用图表，只告诉我回收数')).toBe(false)
 expect(wantsInlineChart('给我柱状图')).toBe(true)
 expect(selectedSurveyQuestion('不要饼图，改成柱状图')).toContain('柱状图')
})
