package com.tduck.cloud.api.ai;

import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.ai.AiDraftWorkspaceService;
import com.tduck.cloud.form.entity.AiDraftWorkspaceEntity;
import com.tduck.cloud.form.mapper.AiDraftWorkspaceMapper;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

public class AiDraftWorkspaceTest {
    private Map<String,Object> snapshot(){return map("form",map("goal","","audience","","extra","","questionCount",100),"result",null);}
    private void reject(Map<String,Object> value){try{AiDraftWorkspaceService.validate(value);fail("Invalid snapshot accepted");}catch(BaseException expected){}}
    @Test public void incompleteGenerationInputsCanBeSavedBeforeAnyAiCall(){AiDraftWorkspaceService.validate(snapshot());}
    @Test public void editedOneHundredQuestionDraftAcceptsEmptyOptionalHints(){Map<String,Object> snapshot=snapshot();List<Object> questions=new ArrayList<>();for(int n=1;n<=100;n++)questions.add(map("type","TEXTAREA","label","合成题"+n,"required",false,"placeholder",""));snapshot.put("result",map("kind","draft","title","合成暂存","description","","questions",questions,"manuallyEdited",true));AiDraftWorkspaceService.validate(snapshot);questions.add(map("type","TEXTAREA","label","101"));reject(snapshot);}
    @Test public void callerCannotChooseAnOwnerOrSmuggleArbitraryFields(){Map<String,Object> snapshot=snapshot();snapshot.put("ownerId",999);reject(snapshot);}
    @Test public void storageLimitCountsUtf8BytesRatherThanChineseCharacters(){Map<String,Object> snapshot=snapshot();snapshot.put("result",map("kind","clarification","clarification",Collections.singletonList(String.join("",Collections.nCopies(180000,"字")))));reject(snapshot);}
    @Test public void countsAndIncompleteSnapshotInputLengthsAreBounded(){for(Object count:Arrays.asList(0,101,1.5,"100")){Map<String,Object> value=snapshot();((Map<String,Object>)value.get("form")).put("questionCount",count);reject(value);}Map<String,Object> value=snapshot();((Map<String,Object>)value.get("form")).put("goal",String.join("",Collections.nCopies(501,"a")));reject(value);}
    @Test public void readingUsesOnlyTheAuthenticatedOwnersPrimaryKey(){AiDraftWorkspaceMapper mapper=mock(AiDraftWorkspaceMapper.class);AiDraftWorkspaceEntity row=new AiDraftWorkspaceEntity();row.setOwnerId(22L);row.setSnapshotJson(write(snapshot()));row.setUpdatedAt("2026-10-27T00:00:00Z");when(mapper.selectById(22L)).thenReturn(row);Map<String,Object> result=new AiDraftWorkspaceService(mapper).get(22L);assertEquals(snapshot(),result.get("snapshot"));verify(mapper).selectById(22L);verifyNoMoreInteractions(mapper);}
    @Test public void saveAndClearUseTheAuthenticatedOwnerWithoutCreatingAQuestionnaire(){AiDraftWorkspaceMapper mapper=mock(AiDraftWorkspaceMapper.class);AiDraftWorkspaceService service=new AiDraftWorkspaceService(mapper);assertNotNull(service.save(22L,snapshot()).get("updatedAt"));verify(mapper).saveSnapshot(eq(22L),eq(write(snapshot())),anyString());service.clear(22L);verify(mapper).deleteById((java.io.Serializable)22L);verifyNoMoreInteractions(mapper);}
}
