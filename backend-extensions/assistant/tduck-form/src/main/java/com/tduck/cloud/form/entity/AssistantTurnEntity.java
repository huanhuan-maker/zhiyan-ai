package com.tduck.cloud.form.entity;
import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
@Data @TableName("fm_assistant_turn")
public class AssistantTurnEntity {
    @TableId(type=IdType.INPUT) private String id;
    private String conversationId;
    private Long ownerId;
    private String question;
    private String scopeFormKey;
    private Integer scopeVersion;
    private String planJson;
    private String resultJson;
    private String state;
    private String mode;
    private String provider;
    private String model;
    private String warning;
    private String createdAt;
}
