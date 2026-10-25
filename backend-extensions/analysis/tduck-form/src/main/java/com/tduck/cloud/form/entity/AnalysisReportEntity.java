package com.tduck.cloud.form.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("fm_analysis_report")
public class AnalysisReportEntity {
    @TableId(type = IdType.INPUT)
    private String id;
    private String formKey;
    private Integer versionNo;
    private String snapshotHash;
    private String mode;
    private String provider;
    private String model;
    private String status;
    private Integer revision;
    private String snapshotJson;
    private String outputJson;
    private String reviewNote;
    private String createdAt;
}
