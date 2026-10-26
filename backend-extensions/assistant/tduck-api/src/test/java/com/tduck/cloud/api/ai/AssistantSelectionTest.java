package com.tduck.cloud.api.ai;

import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.assistant.*;
import com.tduck.cloud.form.entity.*;
import com.tduck.cloud.form.mapper.*;
import com.tduck.cloud.form.service.UserFormVersionService;
import com.tduck.cloud.form.analysis.AnalysisSnapshotService;
import org.junit.Test;
import java.util.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class AssistantSelectionTest {
    @org.junit.BeforeClass public static void initializeMapperMetadata(){org.apache.ibatis.builder.MapperBuilderAssistant builder=new org.apache.ibatis.builder.MapperBuilderAssistant(new com.baomidou.mybatisplus.core.MybatisConfiguration(),"selection-unit-test");builder.setCurrentNamespace(AssistantTurnMapper.class.getName());com.baomidou.mybatisplus.core.metadata.TableInfoHelper.initTableInfo(builder,AssistantTurnEntity.class);}
    private AssistantTools tools(UserFormMapper forms,UserFormVersionService versions){return new AssistantTools(forms,mock(UserFormDataMapper.class),versions,mock(AnalysisSnapshotService.class),mock(AnalysisReportMapper.class));}
    private UserFormEntity ownForm(){UserFormEntity f=new UserFormEntity();f.setFormKey("owned");f.setUserId(22L);f.setName("Synthetic draft");return f;}
    @Test public void unpublishedSurveyUsesADistinctDomainResult(){UserFormMapper forms=mock(UserFormMapper.class);when(forms.selectOne(any())).thenReturn(ownForm());try{tools(forms,mock(UserFormVersionService.class)).call("survey_stats",map("formKey","owned"),22L);fail();}catch(AssistantTools.UnpublishedSurvey expected){}}
    @Test public void missingExplicitVersionIsNotMistakenForAnUnpublishedSurvey(){UserFormMapper forms=mock(UserFormMapper.class);when(forms.selectOne(any())).thenReturn(ownForm());try{tools(forms,mock(UserFormVersionService.class)).call("survey_stats",map("formKey","owned","version",999),22L);fail();}catch(BaseException e){assertFalse(e instanceof AssistantTools.UnpublishedSurvey);}}
    @Test public void chatPersistsAnExplanationWithoutInventingZeroStatistics(){AssistantTurnMapper turns=mock(AssistantTurnMapper.class);AssistantTools tools=mock(AssistantTools.class);AssistantTurnEntity t=new AssistantTurnEntity();t.setId(UUID.randomUUID().toString());t.setOwnerId(22L);t.setScopeFormKey("owned");t.setState("READY");t.setPlanJson(write(map("tool","survey_stats","arguments",map("formKey","owned"))));when(turns.selectById(t.getId())).thenReturn(t);when(turns.update(any(),any())).thenReturn(1);when(tools.requireOwned("owned",22L)).thenReturn(ownForm());when(tools.call(eq("survey_stats"),any(),eq(22L))).thenThrow(new AssistantTools.UnpublishedSurvey());Map<String,Object> r=new AssistantChatService(mock(AssistantConversationMapper.class),turns,mock(AssistantPlanner.class),tools).execute(t.getId(),"survey_stats",map("formKey","owned"),22L);assertEquals("notice",r.get("kind"));assertEquals("UNPUBLISHED",r.get("reason"));assertTrue(r.get("message").toString().contains("尚未发布"));assertFalse(r.containsKey("answerCount"));assertFalse(r.containsKey("version"));assertEquals(Collections.emptyList(),r.get("citations"));verify(turns,times(2)).update(any(),any());}
    @Test public void draftExplanationCannotBypassOwnership(){AssistantTurnMapper turns=mock(AssistantTurnMapper.class);AssistantTools tools=mock(AssistantTools.class);AssistantTurnEntity t=new AssistantTurnEntity();t.setId(UUID.randomUUID().toString());t.setOwnerId(22L);t.setScopeFormKey("foreign");when(turns.selectById(t.getId())).thenReturn(t);when(tools.requireOwned("foreign",22L)).thenThrow(new BaseException("not owned"));try{new AssistantChatService(mock(AssistantConversationMapper.class),turns,mock(AssistantPlanner.class),tools).execute(t.getId(),"survey_stats",map("formKey","foreign"),22L);fail();}catch(BaseException expected){}verify(tools,never()).call(any(),any(),any());verify(turns,never()).update(any(),any());}
}
