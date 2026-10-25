package com.tduck.cloud.form.entity;
import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
@Data @TableName("fm_assistant_conversation")
public class AssistantConversationEntity {
    @TableId(type=IdType.INPUT) private String id;
    private Long ownerId;
    private String title;
    private String createdAt;
    private String updatedAt;
}
