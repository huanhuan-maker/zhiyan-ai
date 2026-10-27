package com.tduck.cloud.api.ai;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.ai.AiDraftSlotsService;
import com.tduck.cloud.form.mapper.AiDraftSlotMapper;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;
public class AiDraftSlotsTest {
 private final AiDraftSlotMapper mapper=mock(AiDraftSlotMapper.class);
 private final AiDraftSlotsService service=new AiDraftSlotsService(mapper);
 private Map<String,Object> snapshot(){return map("form",map("goal","合成", "audience","测试", "extra","", "questionCount",1),"result",null);}
 private void reject(Runnable fn){try{fn.run();fail("expected rejection");}catch(BaseException expected){}}
 @Test public void creationAllocatesFirstFreeSlotAndLocksOwner(){when(mapper.list(5L)).thenReturn(Arrays.asList(map("slotNo",1),map("slotNo",3)));Map<String,Object> r=service.create(5L,snapshot());assertEquals(2,r.get("slot"));UUID.fromString((String)r.get("id"));verify(mapper).ensureLock(5L);verify(mapper).lockOwner(5L);verify(mapper).insert(eq(5L),eq(2),eq((String)r.get("id")),anyString(),anyString());}
 @Test public void fourthDraftIsRejectedWithoutWrite(){when(mapper.list(5L)).thenReturn(Arrays.asList(map("slotNo",1),map("slotNo",2),map("slotNo",3)));reject(()->service.create(5L,snapshot()));verify(mapper,never()).insert(anyLong(),anyInt(),anyString(),anyString(),anyString());}
 @Test public void unknownOrForeignIdentifierCannotBeReadOrUpdated(){String id=UUID.randomUUID().toString();when(mapper.get(5L,id)).thenReturn(null);reject(()->service.get(5L,id));reject(()->service.update(5L,id,snapshot()));verify(mapper).get(5L,id);verify(mapper).update(eq(5L),eq(id),anyString(),anyString());}
 @Test public void removedIdentifierCannotAccidentallyTargetAReusedSlot(){String old=UUID.randomUUID().toString();reject(()->service.update(5L,old,snapshot()));verify(mapper).update(eq(5L),eq(old),anyString(),anyString());}
 @Test public void malformedIdentifiersAndOversizedInputsAreRejected(){reject(()->service.get(5L,"1"));Map<String,Object> bad=snapshot();bad.put("ownerId",9);reject(()->service.create(5L,bad));verifyNoInteractions(mapper);}
 @Test public void readingReturnsOnlyOwnedRowsAndActualStoredContent(){String id=UUID.randomUUID().toString();when(mapper.list(5L)).thenReturn(Arrays.asList(map("id",id,"slotNo",2,"snapshotJson",write(snapshot()),"updatedAt","2026-01-01")));List<Map<String,Object>> rows=service.list(5L);assertEquals(1,rows.size());assertEquals(id,rows.get(0).get("id"));assertEquals(snapshot(),rows.get(0).get("snapshot"));verify(mapper).list(5L);}
}
