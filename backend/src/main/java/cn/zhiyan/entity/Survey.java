package cn.zhiyan.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("surveys")
public class Survey {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long ownerId;
    private String draftJson;
    private String status;
    private Long latestVersionId;
    private Integer revision;
    private java.time.LocalDateTime createdAt;
    private java.time.LocalDateTime updatedAt;
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public String getDraftJson() { return draftJson; }
    public void setDraftJson(String draftJson) { this.draftJson = draftJson; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getLatestVersionId() { return latestVersionId; }
    public void setLatestVersionId(Long latestVersionId) { this.latestVersionId = latestVersionId; }
    public Integer getRevision() { return revision; }
    public void setRevision(Integer revision) { this.revision = revision; }
    public java.time.LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(java.time.LocalDateTime createdAt) { this.createdAt = createdAt; }
    public java.time.LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(java.time.LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
