package com.tduck.cloud.form.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("fm_analysis_review")
public class AnalysisReviewEntity {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String reportId;
    private Long actorId;
    private String status;
    private Integer revision;
    private String note;
    private String createdAt;
}
