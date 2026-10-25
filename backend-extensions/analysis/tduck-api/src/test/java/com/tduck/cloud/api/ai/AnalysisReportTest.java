package com.tduck.cloud.api.ai;

import com.tduck.cloud.form.analysis.*;
import com.tduck.cloud.form.ai.*;
import com.tduck.cloud.form.entity.*;
import com.tduck.cloud.form.mapper.*;
import com.tduck.cloud.form.service.*;
import com.tduck.cloud.common.exception.BaseException;
import org.junit.Test;
import java.util.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

public class AnalysisReportTest {
    private final List<Map<String,Object>> evidence=Arrays.asList(
        map("id","E1","answerId","100","fieldId","a","text","排队较久"),
        map("id","E2","answerId","100","fieldId","b","text","排队较久"),
        map("id","E3","answerId","101","fieldId","a","text","排队较久"));
    private static final String VALID="{\"themes\":[{\"label\":\"排队体验\",\"evidenceIds\":[\"E1\",\"E2\",\"E3\"]}],\"interpretations\":[{\"text\":\"部分入选回答提到了排队体验，需进一步核实具体情境\",\"evidenceIds\":[\"E1\"]}]}";
    private void rejected(String value) {try{AnalysisOutputValidator.validate(value,evidence);fail("untrusted output accepted");}catch(BaseException expected){}}
    @Test public void countUsesDistinctAnswersNotModelCountsOrCitations() {
        Map<String,Object> result=AnalysisOutputValidator.validate(VALID,evidence);
        Map<String,Object> theme=((List<Map<String,Object>>)result.get("themes")).get(0);
        assertEquals(2L,theme.get("supportAnswerCount")); assertEquals("MODEL_INFERRED_UNCONFIRMED",theme.get("classification"));
    }
    @Test public void fabricatedEvidenceRejected(){rejected(VALID.replace("E3","E999"));}
    @Test public void duplicateEvidenceRejected(){rejected(VALID.replace("E3","E1"));}
    @Test public void fabricatedQuotesRejected(){rejected(VALID.replace("\"label\":","\"quote\":\"捏造原文\",\"label\":"));}
    @Test public void modelCannotOverrideBackendNumbers(){rejected(VALID.replace("\"label\":","\"supportAnswerCount\":999,\"label\":"));}
    @Test public void numericInterpretationRejected(){rejected(VALID.replace("部分入选回答","90%的受访者"));}
    @Test public void unsupportedEmptyThemeRejected(){rejected("{\"themes\":[],\"interpretations\":[]}");}
    @Test public void badJsonAndExtraRootKeysRejected(){rejected("not json");rejected(VALID.replace("{\"themes\":","{\"total\":999,\"themes\":"));}
    @Test public void interpretationNeedsKnownReferences(){rejected(VALID.replace("\"evidenceIds\":[\"E1\"]","\"evidenceIds\":[]"));}
    @Test public void exactGroupingKeepsQuestionsSeparate() {
        List<Map<String,Object>> themes=(List<Map<String,Object>>)AnalysisOutputValidator.local(evidence).get("themes");
        assertEquals(2,themes.size());assertEquals(2L,themes.get(0).get("supportAnswerCount"));assertEquals("EXACT_TEXT_GROUP",themes.get(0).get("classification"));
    }
    @Test public void markdownEscapesActiveHtmlLinksAndTables(){String escaped=AnalysisMarkdown.text("<script>alert(1)</script>[x](javascript:x)|");assertFalse(escaped.contains("<script>"));assertTrue(escaped.contains("\\["));assertTrue(escaped.contains("\\|"));}
    @Test public void missingTransferAuthorizationNeverCallsModel() {
        OpenAiCompatibleProvider provider=mock(OpenAiCompatibleProvider.class);
        AnalysisReportService service=new AnalysisReportService(mock(AnalysisSnapshotService.class),mock(AnalysisReportMapper.class),mock(AnalysisReviewMapper.class),provider);
        try{service.generate("test",1,"REAL",false,null);fail();}catch(BaseException expected){}verifyNoInteractions(provider);
    }
    @Test public void providerFailureDoesNotPersistReport() {
        AnalysisSnapshotService snapshots=mock(AnalysisSnapshotService.class);AnalysisReportMapper mapper=mock(AnalysisReportMapper.class);
        OpenAiCompatibleProvider provider=mock(OpenAiCompatibleProvider.class);
        when(snapshots.capture("test",1)).thenReturn(map("answerCount",2,"evidence",evidence,"fingerprint","same"));when(provider.available()).thenReturn(true);
        when(provider.complete(any(),any())).thenThrow(new AiProviderException("synthetic timeout"));
        try{new AnalysisReportService(snapshots,mapper,mock(AnalysisReviewMapper.class),provider).generate("test",1,"REAL",true,"same");fail();}catch(BaseException expected){}
        verify(provider).complete(any(),any());
        verifyNoInteractions(mapper);
    }
    @Test public void invalidModelOutputDoesNotPersistReport() {
        AnalysisSnapshotService snapshots=mock(AnalysisSnapshotService.class);AnalysisReportMapper mapper=mock(AnalysisReportMapper.class);
        OpenAiCompatibleProvider provider=mock(OpenAiCompatibleProvider.class);
        when(snapshots.capture("test",1)).thenReturn(map("answerCount",2,"evidence",evidence,"fingerprint","same"));when(provider.available()).thenReturn(true);when(provider.complete(any(),any())).thenReturn(VALID.replace("E3","E999"));
        try{new AnalysisReportService(snapshots,mapper,mock(AnalysisReviewMapper.class),provider).generate("test",1,"REAL",true,"same");fail();}catch(BaseException expected){}
        verify(provider).complete(any(),any());
        verifyNoInteractions(mapper);
    }
    @Test public void snapshotReportsSelectionCoverageAndNeverTruncatesQuote() {
        UserFormVersionService versions=mock(UserFormVersionService.class);UserFormDataMapper answers=mock(UserFormDataMapper.class);FormDashboardService statistics=mock(FormDashboardService.class);
        UserFormVersionEntity version=new UserFormVersionEntity().setFormSnapshot(map("name","test")).setItemsSnapshot(Collections.emptyList());
        UserFormItemEntity field=new UserFormItemEntity();field.setFormItemId("q");field.setType(com.tduck.cloud.form.entity.enums.FormItemTypeEnum.TEXTAREA);field.setLabel("体验");
        when(versions.byNo("test",1)).thenReturn(version);when(versions.itemsOf(version)).thenReturn(Collections.singletonList(field));
        List<UserFormDataEntity> rows=new ArrayList<>();
        for(int i=0;i<202;i++){UserFormDataEntity row=new UserFormDataEntity();row.setId((long)i);row.setOriginalData(map("q",i==0?String.join("",Collections.nCopies(2001,"长")):"完整原文"));rows.add(row);}
        when(answers.selectList(any())).thenReturn(rows);when(statistics.formReportAnalysis("test",1)).thenReturn(Collections.emptyList());
        Map<String,Object> snapshot=new AnalysisSnapshotService(versions,answers,statistics).capture("test",1);
        assertEquals(202,snapshot.get("openResponseCount"));assertEquals(200,snapshot.get("includedEvidenceCount"));assertEquals(2,snapshot.get("excludedEvidenceCount"));
        assertEquals("完整原文",((List<Map<String,Object>>)snapshot.get("evidence")).get(0).get("text"));
    }
    @Test public void nonExistingVersionRejectedRatherThanUsingLatest() {
        try{new AnalysisSnapshotService(mock(UserFormVersionService.class),mock(UserFormDataMapper.class),mock(FormDashboardService.class)).capture("test",99);fail();}catch(BaseException expected){}
    }
    @Test public void duplicateKeysAndTrailingOutputRejected(){rejected(VALID+"{}");rejected(VALID.replace("\"themes\":","\"themes\":[],\"themes\":"));}
    @Test public void deepUntrustedJsonIsRejectedBeforeDeserialization(){rejected(String.join("",Collections.nCopies(1000,"["))+"0"+String.join("",Collections.nCopies(1000,"]")));}
    @Test public void changedInputCannotBeSentUnderOldTransferAcknowledgment() {
        AnalysisSnapshotService snapshots=mock(AnalysisSnapshotService.class);AnalysisReportMapper mapper=mock(AnalysisReportMapper.class);OpenAiCompatibleProvider provider=mock(OpenAiCompatibleProvider.class);
        when(snapshots.capture("test",1)).thenReturn(map("answerCount",2,"evidence",evidence,"fingerprint","new"));
        try{new AnalysisReportService(snapshots,mapper,mock(AnalysisReviewMapper.class),provider).generate("test",1,"REAL",true,"old");fail();}catch(BaseException expected){}
        verifyNoInteractions(provider,mapper);
    }
}
