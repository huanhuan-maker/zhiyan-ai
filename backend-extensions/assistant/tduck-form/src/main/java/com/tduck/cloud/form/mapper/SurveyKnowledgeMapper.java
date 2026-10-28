package com.tduck.cloud.form.mapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tduck.cloud.form.entity.SurveyKnowledgeEntity;
import org.apache.ibatis.annotations.*;
public interface SurveyKnowledgeMapper extends BaseMapper<SurveyKnowledgeEntity> {
    @Insert("INSERT INTO fm_survey_knowledge(id,owner_id,form_key,version_no,fingerprint,snapshot_json,indexed_at) VALUES(#{id},#{ownerId},#{formKey},#{versionNo},#{fingerprint},#{snapshotJson},#{indexedAt}) ON DUPLICATE KEY UPDATE fingerprint=VALUES(fingerprint),snapshot_json=VALUES(snapshot_json),indexed_at=VALUES(indexed_at)")
    int saveSnapshot(SurveyKnowledgeEntity row);
}
