package com.tduck.cloud.form.mapper;
import org.apache.ibatis.annotations.*;
import java.util.List;
import java.util.Map;
public interface AiDraftSlotMapper {
 @Insert("INSERT IGNORE INTO fm_ai_draft_slot_lock(owner_id) VALUES(#{owner})") int ensureLock(@Param("owner") Long owner);
 @Select("SELECT owner_id FROM fm_ai_draft_slot_lock WHERE owner_id=#{owner} FOR UPDATE") Long lockOwner(@Param("owner") Long owner);
 @Select("SELECT workspace_id AS id, slot_no AS slotNo, CAST(snapshot_json AS CHAR) AS snapshotJson, updated_at AS updatedAt FROM fm_ai_draft_slot WHERE owner_id=#{owner} ORDER BY slot_no") List<Map<String,Object>> list(@Param("owner") Long owner);
 @Select("SELECT workspace_id AS id, slot_no AS slotNo, CAST(snapshot_json AS CHAR) AS snapshotJson, updated_at AS updatedAt FROM fm_ai_draft_slot WHERE owner_id=#{owner} AND workspace_id=#{id}") Map<String,Object> get(@Param("owner") Long owner,@Param("id") String id);
 @Insert("INSERT INTO fm_ai_draft_slot(owner_id,slot_no,workspace_id,snapshot_json,updated_at) VALUES(#{owner},#{slot},#{id},#{snapshot},#{updated})") int insert(@Param("owner") Long owner,@Param("slot") int slot,@Param("id") String id,@Param("snapshot") String snapshot,@Param("updated") String updated);
 @Update("UPDATE fm_ai_draft_slot SET snapshot_json=#{snapshot},updated_at=#{updated} WHERE owner_id=#{owner} AND workspace_id=#{id}") int update(@Param("owner") Long owner,@Param("id") String id,@Param("snapshot") String snapshot,@Param("updated") String updated);
 @Delete("DELETE FROM fm_ai_draft_slot WHERE owner_id=#{owner} AND workspace_id=#{id}") int remove(@Param("owner") Long owner,@Param("id") String id);
}
