package com.tduck.cloud.form.mapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tduck.cloud.form.entity.AiDraftWorkspaceEntity;
import org.apache.ibatis.annotations.*;
public interface AiDraftWorkspaceMapper extends BaseMapper<AiDraftWorkspaceEntity> {
    @Insert("INSERT INTO fm_ai_draft_workspace(owner_id,snapshot_json,updated_at) VALUES(#{owner},#{snapshot},#{updated}) ON DUPLICATE KEY UPDATE snapshot_json=VALUES(snapshot_json),updated_at=VALUES(updated_at)")
    int saveSnapshot(@Param("owner") Long owner,@Param("snapshot") String snapshot,@Param("updated") String updated);
}
