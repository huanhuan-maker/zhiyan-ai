package cn.zhiyan.service;

import cn.zhiyan.dto.SurveyDtos.*;
import cn.zhiyan.entity.*;
import cn.zhiyan.mapper.*;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SurveyService {
    final SurveyMapper surveys; final SurveyVersionMapper versions; final AuditEventMapper audits;
    final AccountService accounts; final ObjectMapper json;
    public SurveyService(SurveyMapper surveys,SurveyVersionMapper versions,AuditEventMapper audits,AccountService accounts,ObjectMapper json) {
        this.surveys=surveys; this.versions=versions; this.audits=audits; this.accounts=accounts; this.json=json;
    }
    public String encode(Object value) {
        try { return json.writeValueAsString(value); } catch(JsonProcessingException ex) { throw new IllegalStateException(ex); }
    }
    public Draft decode(String value) {
        try { return json.readValue(value,Draft.class); } catch(JsonProcessingException ex) { throw new IllegalStateException(ex); }
    }
    public com.fasterxml.jackson.databind.JsonNode decodeNode(String value) {
        try { return json.readTree(value); } catch(JsonProcessingException ex) { throw new IllegalStateException(ex); }
    }
    public Survey lockSurvey(long id) { return surveys.selectOne(Wrappers.<Survey>lambdaQuery().eq(Survey::getId,id).last("FOR UPDATE")); }
    static BusinessException missing() { return new BusinessException(404,"NOT_FOUND","资源不存在或无权访问"); }
    public Survey owned(long id,String username,boolean lock) {
        var query=Wrappers.<Survey>lambdaQuery().eq(Survey::getId,id).eq(Survey::getOwnerId,accounts.userId(username));
        if(lock) query.last("FOR UPDATE");
        Survey row=surveys.selectOne(query); if(row==null) throw missing(); return row;
    }
    public SurveyVersion version(long surveyId,long versionId) {
        var row=versions.selectById(versionId); if(row==null || row.getSurveyId()!=surveyId) throw missing(); return row;
    }
    public SurveyVersion lockVersion(long surveyId,long versionId) {
        var row=versions.selectOne(Wrappers.<SurveyVersion>lambdaQuery().eq(SurveyVersion::getId,versionId)
                .eq(SurveyVersion::getSurveyId,surveyId).last("FOR UPDATE"));
        if(row==null) throw missing(); return row;
    }
    public void validate(Draft draft) {
        Set<String> ids=new HashSet<>();
        for(Question q:draft.questions()) {
            if(!ids.add(q.id())) throw new BusinessException(400,"DUPLICATE_QUESTION","题目 ID 不能重复");
            boolean choice=q.type()==Type.SINGLE || q.type()==Type.MULTIPLE;
            if(choice && q.options().size()<2) throw new BusinessException(400,"INVALID_OPTIONS","选择题至少需要两个选项");
            if(!choice && !q.options().isEmpty()) throw new BusinessException(400,"INVALID_OPTIONS","非选择题不能包含选项");
            Set<String> optionIds=new HashSet<>(),labels=new HashSet<>();
            for(Option option:q.options()) if(!optionIds.add(option.id()) || !labels.add(option.label().strip())) throw new BusinessException(400,"DUPLICATE_OPTION","选项 ID 或文本不能重复");
            if(q.type()==Type.SCALE && (q.min()==null || q.max()==null || q.min()>=q.max() || q.max()-q.min()>20)) throw new BusinessException(400,"INVALID_SCALE","量表上下限须递增，跨度不超过 20");
            if(q.type()!=Type.OPEN && q.allowFollowup()) throw new BusinessException(400,"INVALID_FOLLOWUP","当前仅开放题可预留追问许可");
        }
    }
    Map<String,Object> view(Survey row) {
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("id",row.getId()); result.put("draft",decode(row.getDraftJson())); result.put("status",row.getStatus());
        result.put("revision",row.getRevision()); result.put("latestVersionId",row.getLatestVersionId()); result.put("updatedAt",row.getUpdatedAt());
        return result;
    }
    public List<Map<String,Object>> list(String name) { return surveys.selectList(Wrappers.<Survey>lambdaQuery().eq(Survey::getOwnerId,accounts.userId(name)).orderByDesc(Survey::getUpdatedAt)).stream().map(this::view).toList(); }
    public Map<String,Object> detail(long id,String name) {
        Survey row=owned(id,name,false); Map<String,Object> out=view(row);
        out.put("versions",versions.selectList(Wrappers.<SurveyVersion>lambdaQuery().eq(SurveyVersion::getSurveyId,id).orderByDesc(SurveyVersion::getVersionNumber))
                .stream().map(v->Map.of("id",v.getId(),"versionNumber",v.getVersionNumber(),"publishedAt",v.getPublishedAt(),"status",v.getStatus())).toList());
        return out;
    }
    @Transactional public Map<String,Object> create(Draft draft,String name) {
        validate(draft); Survey row=new Survey(); row.setOwnerId(accounts.userId(name)); row.setDraftJson(encode(draft));
        row.setRevision(1); row.setStatus("DRAFT"); surveys.insert(row); audit(row,"CREATE"); return view(surveys.selectById(row.getId()));
    }
    @Transactional public Map<String,Object> update(long id,Update input,String name) {
        validate(input.draft()); Survey row=owned(id,name,true);
        if(row.getRevision()!=input.revision()) throw new BusinessException(409,"STALE_DRAFT","草稿已被其他页面修改，请重新加载");
        row.setDraftJson(encode(input.draft())); row.setRevision(row.getRevision()+1); row.setUpdatedAt(LocalDateTime.now());
        surveys.updateById(row); audit(row,"UPDATE_DRAFT"); return view(row);
    }
    @Transactional public Map<String,Object> publish(long id,int revision,String name) {
        Survey row=owned(id,name,true);
        if(row.getRevision()!=revision) throw new BusinessException(409,"STALE_DRAFT","请保存并刷新草稿后再发布");
        validate(decode(row.getDraftJson()));
        SurveyVersion previous=row.getLatestVersionId()==null?null:versions.selectById(row.getLatestVersionId());
        if(previous!=null && decode(previous.getSnapshotJson()).equals(decode(row.getDraftJson())))
            throw new BusinessException(409,"ALREADY_PUBLISHED","该草稿已发布；核心题变化后再创建新版本，丢失分享链接时可在发布记录中轮换该版本链接",
                    Map.of("versionId",previous.getId(),"versionNumber",previous.getVersionNumber()));
        String token=randomToken(); SurveyVersion v=new SurveyVersion(); v.setSurveyId(id); v.setSnapshotJson(row.getDraftJson());
        v.setVersionNumber(previous==null?1:previous.getVersionNumber()+1); v.setTokenHash(hash(token)); v.setStatus("OPEN"); versions.insert(v);
        row.setLatestVersionId(v.getId()); row.setStatus("OPEN"); row.setUpdatedAt(LocalDateTime.now()); surveys.updateById(row); audit(row,"PUBLISH");
        return Map.of("versionId",v.getId(),"versionNumber",v.getVersionNumber(),"publicToken",token,"publicPath","/public/"+token);
    }
    @Transactional public Map<String,Object> close(long id,String name) {
        Survey row=owned(id,name,true);
        versions.update(null,Wrappers.<SurveyVersion>lambdaUpdate().eq(SurveyVersion::getSurveyId,id)
                .eq(SurveyVersion::getStatus,"OPEN").set(SurveyVersion::getStatus,"CLOSED"));
        row.setStatus("CLOSED"); row.setUpdatedAt(LocalDateTime.now()); surveys.updateById(row); audit(row,"CLOSE"); return view(row);
    }
    void audit(Survey row,String action) { var event=new AuditEvent(); event.setActorId(row.getOwnerId()); event.setSurveyId(row.getId()); event.setAction(action); audits.insert(event); }
    public SurveyVersion publicVersion(String token) {
        validToken(token); SurveyVersion v=versions.selectOne(Wrappers.<SurveyVersion>lambdaQuery().eq(SurveyVersion::getTokenHash,hash(token)));
        if(v==null) throw missing(); return v;
    }
    public static void ensureOpen(Survey row) {
        if(row==null || !"OPEN".equals(row.getStatus())) throw new BusinessException(410,"SURVEY_CLOSED","调查已关闭，无法继续填写或提交");
    }
    public static void ensureVersionOpen(SurveyVersion v) {
        if(v==null || !"OPEN".equals(v.getStatus())) throw new BusinessException(410,"VERSION_CLOSED","该发布版本已停止收集，请使用发起者提供的最新分享链接");
    }
    public Map<String,Object> publicSurvey(String token) {
        SurveyVersion v=publicVersion(token); ensureOpen(surveys.selectById(v.getSurveyId())); ensureVersionOpen(v);
        return Map.of("versionId",v.getId(),"versionNumber",v.getVersionNumber(),"survey",decode(v.getSnapshotJson()),"aiMode","NOT_IMPLEMENTED");
    }
    @Transactional public Map<String,Object> rotateToken(long id,long versionId,String name) {
        Survey row=owned(id,name,true); SurveyVersion v=lockVersion(id,versionId);
        String token=randomToken(); v.setTokenHash(hash(token)); versions.updateById(v); audit(row,"ROTATE_TOKEN");
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("versionId",v.getId()); out.put("versionNumber",v.getVersionNumber());
        out.put("publicToken",token); out.put("publicPath","/public/"+token);
        out.put("versionStatus",v.getStatus()); out.put("surveyStatus",row.getStatus());
        return out;
    }
    public static String randomToken() { byte[] data=new byte[32]; new SecureRandom().nextBytes(data); return Base64.getUrlEncoder().withoutPadding().encodeToString(data); }
    public static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
    public static void validToken(String token) { if(token==null || !token.matches("[A-Za-z0-9_-]{43}")) throw missing(); }
}
