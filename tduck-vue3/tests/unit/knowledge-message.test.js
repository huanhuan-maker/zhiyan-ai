import {it,expect} from 'vitest'
import {knowledgeMessage} from '../../src/td/assistant/knowledge'
it('shortens source labels without replacing partial IDs or altering the saved result',()=>{
 const result={kind:'knowledge_answer',message:'证据 [A123-field1]，统计 [S1、S10]，不应替换 S100。',citations:[{id:'A123-field1'},{id:'S1'},{id:'S10'}]}
 expect(knowledgeMessage(result)).toBe('证据 [来源1]，统计 [来源2、来源3]，不应替换 S100。')
 expect(result.message).toContain('A123-field1')
})
it('keeps ordinary messages and missing data readable',()=>{expect(knowledgeMessage({kind:'chat',message:'S1 是一个示例'})).toBe('S1 是一个示例');expect(knowledgeMessage(null)).toBe('')})
