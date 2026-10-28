package com.tduck.cloud.form.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

/** 每个用户自己的模型供应商配置；不存在时回退到 fm_ai_settings 的系统默认配置。 */
@Getter @Setter @TableName("fm_ai_settings_user")
public class AiSettingsUserEntity {
    @TableId private Long userId;
    private Integer revision;
    private String configJson;
    private String updatedAt;
}
