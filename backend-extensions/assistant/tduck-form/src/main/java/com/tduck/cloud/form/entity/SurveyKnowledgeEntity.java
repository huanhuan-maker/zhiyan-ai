package com.tduck.cloud.form.entity;
import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
@Data @TableName("fm_survey_knowledge")
public class SurveyKnowledgeEntity {
    @TableId(type=IdType.INPUT) private String id;
    private Long ownerId;
    private String formKey;
    private Integer versionNo;
    private String fingerprint;
    private String snapshotJson;
    private String indexedAt;
}
