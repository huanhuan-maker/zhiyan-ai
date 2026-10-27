package com.tduck.cloud.form.ai;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.mapper.AiDraftSlotMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import java.time.Instant;
import java.util.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;
@Service @RequiredArgsConstructor
public class AiDraftSlotsService {
 private final AiDraftSlotMapper mapper;
 private Map<String,Object> format(Map<String,Object> row){if(row==null)return null;return map("id",row.get("id"),"slot",((Number)row.get("slotNo")).intValue(),"snapshot",read((String)row.get("snapshotJson")),"updatedAt",row.get("updatedAt"));}
 private void validId(String id){try{if(id==null||!UUID.fromString(id).toString().equals(id))throw new IllegalArgumentException();}catch(IllegalArgumentException e){throw new BaseException("暂存编号不正确");}}
 public List<Map<String,Object>> list(Long owner){List<Map<String,Object>> out=new ArrayList<>();for(Map<String,Object> row:mapper.list(owner))out.add(format(row));return out;}
 public Map<String,Object> get(Long owner,String id){validId(id);Map<String,Object> row=format(mapper.get(owner,id));if(row==null)throw new BaseException("暂存不存在或已移除");return row;}
 @Transactional(isolation=Isolation.READ_COMMITTED) public Map<String,Object> create(Long owner,Map<String,Object> snapshot){AiDraftWorkspaceService.validate(snapshot);lock(owner);Set<Integer> used=new HashSet<>();for(Map<String,Object> row:mapper.list(owner))used.add(((Number)row.get("slotNo")).intValue());int slot=1;while(used.contains(slot))slot++;if(slot>3)throw new BaseException("最多暂存3份问卷，请先移除不需要的暂存");String now=Instant.now().toString(),id=UUID.randomUUID().toString();mapper.insert(owner,slot,id,write(snapshot),now);return map("id",id,"slot",slot,"updatedAt",now);}
 @Transactional(isolation=Isolation.READ_COMMITTED) public Map<String,Object> update(Long owner,String id,Map<String,Object> snapshot){validId(id);AiDraftWorkspaceService.validate(snapshot);lock(owner);String now=Instant.now().toString();if(mapper.update(owner,id,write(snapshot),now)!=1)throw new BaseException("暂存不存在或已移除，请另存为新暂存");return map("id",id,"updatedAt",now);}
 @Transactional(isolation=Isolation.READ_COMMITTED) public void remove(Long owner,String id){validId(id);lock(owner);if(mapper.remove(owner,id)!=1)throw new BaseException("暂存不存在或已移除");}
 private void lock(Long owner){mapper.ensureLock(owner);mapper.lockOwner(owner);}
}
