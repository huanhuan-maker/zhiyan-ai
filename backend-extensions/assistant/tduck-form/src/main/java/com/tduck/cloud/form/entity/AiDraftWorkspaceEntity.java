package com.tduck.cloud.form.entity;
import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
@Data @TableName("fm_ai_draft_workspace")
public class AiDraftWorkspaceEntity {
    @TableId(type=IdType.INPUT) private Long ownerId;
    private String snapshotJson;
    private String updatedAt;
}
