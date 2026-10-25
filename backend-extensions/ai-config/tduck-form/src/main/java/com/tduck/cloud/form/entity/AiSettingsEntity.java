package com.tduck.cloud.form.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @TableName("fm_ai_settings")
public class AiSettingsEntity {
    @TableId private Long id;
    private Integer revision;
    private String configJson;
    private Long updatedBy;
    private String updatedAt;
}
