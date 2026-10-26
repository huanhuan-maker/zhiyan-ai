package com.tduck.cloud.form.mapper;

import org.apache.ibatis.annotations.*;
import com.tduck.cloud.form.entity.AssistantTurnEntity;

public interface AssistantActionMapper {
    @Select("SELECT id, owner_id AS ownerId, state, result_json AS resultJson FROM fm_assistant_turn WHERE id=#{id} FOR UPDATE")
    @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE)
    AssistantTurnEntity lockTurn(@Param("id") String id);
    @Select("SELECT id FROM fm_user_form WHERE form_key=#{key} FOR UPDATE")
    Long lockForm(@Param("key") String key);
    @Insert("INSERT INTO fm_assistant_action(turn_id,owner_id,action,decision,proposal_json,result_json,created_at) VALUES(#{id},#{owner},#{action},#{decision},#{proposal},#{result},#{created})")
    int audit(@Param("id") String id,@Param("owner") Long owner,@Param("action") String action,@Param("decision") String decision,@Param("proposal") String proposal,@Param("result") String result,@Param("created") String created);
}
