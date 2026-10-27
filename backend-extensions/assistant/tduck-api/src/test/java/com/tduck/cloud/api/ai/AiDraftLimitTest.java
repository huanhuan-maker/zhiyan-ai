package com.tduck.cloud.api.ai;

import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.ai.*;
import com.tduck.cloud.form.assistant.*;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

public class AiDraftLimitTest {
    private AiDraftInput input(int count){AiDraftInput i=new AiDraftInput();i.setGoal("合成问卷边界验收");i.setAudience("合成验收对象");i.setQuestionCount(count);return i;}
    private void rejected(Runnable action){try{action.run();fail("Over-limit input accepted");}catch(BaseException expected){}}
    @Test public void maximumAndMockGenerationAcceptExactlyOneHundredQuestions(){
        assertEquals(100,AiDraftValidator.MAX_QUESTIONS);
        Map<String,Object> result=new AiDraftService(new OpenAiCompatibleProvider("unused","","","",1000),new MockAiProvider()).generate(input(100));
        assertEquals("MOCK",result.get("mode"));assertEquals(100,((List<?>)result.get("questions")).size());
    }
    @Test public void oneHundredAndOneIsRejectedBeforeCallingAnyProvider(){rejected(()->new AiDraftService(null,null).generate(input(101)));}
    @Test public void assistantSchemaAndArgumentValidationAgreeOnOneHundred(){
        Map<String,Object> tool=AssistantTools.definitions().stream().filter(x->"design_survey".equals(x.get("name"))).findFirst().get();
        Map<?,?> properties=(Map<?,?>)((Map<?,?>)tool.get("inputSchema")).get("properties");assertEquals(100,((Map<?,?>)properties.get("questionCount")).get("maximum"));
        AssistantTools.validateArguments("design_survey",map("goal","合成验收","questionCount",100));
        rejected(()->AssistantTools.validateArguments("design_survey",map("goal","合成验收","questionCount",101)));
    }
    @Test public void naturalLanguageDoesNotDropTheLeadingDigitOfOneHundred(){
        for(String text:Arrays.asList("帮我设计一份100道题的问卷","生成一份问卷，100题","创建100个题的调查")){
            Map<String,Object> plan=AssistantPlanner.local(text,null,null);assertEquals("design_survey",plan.get("tool"));assertEquals(100,((Map<?,?>)plan.get("arguments")).get("questionCount"));
        }
    }
    @Test public void assistantCanPrepareOneHundredQuestionsButCannotExceedTheLimit(){
        List<Map<String,Object>> questions=new ArrayList<>();for(int n=1;n<=100;n++)questions.add(map("type","TEXTAREA","label","合成题目"+n,"required",false));
        assertEquals(100,AssistantWorkspace.normalizedQuestions(questions).size());questions.add(map("type","TEXTAREA","label","合成题目101"));rejected(()->AssistantWorkspace.normalizedQuestions(questions));
    }
}
