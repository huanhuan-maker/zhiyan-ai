package cn.zhiyan.service;

import cn.zhiyan.dto.SurveyDtos.*;
import cn.zhiyan.entity.*;
import cn.zhiyan.mapper.*;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ResponseService {
    final SurveyService survey; final ResponseSessionMapper sessions; final AnswerMapper answers;
    public ResponseService(SurveyService survey,ResponseSessionMapper sessions,AnswerMapper answers) { this.survey=survey; this.sessions=sessions; this.answers=answers; }
    @Transactional public Object start(String publicToken,Consent input) {
        if(!input.consent()) throw new BusinessException(400,"CONSENT_REQUIRED","同意数据用途说明后才能参与");
        var v=survey.publicVersion(publicToken);
        Survey s=survey.lockSurvey(v.getSurveyId());
        SurveyService.ensureOpen(s); var currentVersion=survey.lockVersion(s.getId(),v.getId());
        if(!currentVersion.getTokenHash().equals(SurveyService.hash(publicToken))) throw SurveyService.missing();
        SurveyService.ensureVersionOpen(currentVersion); String token=SurveyService.randomToken(); var row=new ResponseSession();
        row.setSurveyId(s.getId()); row.setVersionId(v.getId()); row.setTokenHash(SurveyService.hash(token)); row.setAiConsent(input.aiConsent());
        row.setStatus("IN_PROGRESS"); row.setExpiresAt(LocalDateTime.now().plusDays(7)); sessions.insert(row);
        return Map.of("sessionToken",token,"versionId",v.getId(),"expiresAt",row.getExpiresAt());
    }
    ResponseSession session(String token,boolean lock) {
        SurveyService.validToken(token);
        var row=sessions.selectOne(Wrappers.<ResponseSession>lambdaQuery().eq(ResponseSession::getTokenHash,SurveyService.hash(token)));
        if(row==null) throw SurveyService.missing();
        if(lock) {
            // All mutating public operations lock the survey before session to serialize close/complete safely.
            Survey currentSurvey=survey.lockSurvey(row.getSurveyId());
            row=sessions.selectOne(Wrappers.<ResponseSession>lambdaQuery().eq(ResponseSession::getId,row.getId()).last("FOR UPDATE"));
            // A current locking read must govern closure, not an earlier repeatable-read snapshot.
            if(!"SUBMITTED".equals(row.getStatus())) {
                SurveyService.ensureOpen(currentSurvey);
                SurveyService.ensureVersionOpen(survey.lockVersion(row.getSurveyId(),row.getVersionId()));
            }
        }
        if(row.getExpiresAt().isBefore(LocalDateTime.now())) throw new BusinessException(410,"SESSION_EXPIRED","填写会话已过期，请重新开始");
        return row;
    }
    public Object restore(String token) {
        var row=session(token,false); var v=survey.version(row.getSurveyId(),row.getVersionId());
        // Read-only view; `collecting` tells the restored page whether save/submit are still accepted.
        boolean collecting="OPEN".equals(survey.surveyRow(row.getSurveyId()).getStatus()) && "OPEN".equals(v.getStatus());
        Map<String,JsonNode> values=new LinkedHashMap<>();
        for(var a:answers.selectList(Wrappers.<Answer>lambdaQuery().eq(Answer::getSessionId,row.getId()))) values.put(a.getQuestionId(),node(a.getValueJson()));
        return Map.of("status",row.getStatus(),"versionId",v.getId(),"versionNumber",v.getVersionNumber(),"survey",survey.decode(v.getSnapshotJson()),"answers",values,"aiConsent",row.getAiConsent(),"collecting",collecting);
    }
    public JsonNode node(String text) { return survey.decodeNode(text); }
    public boolean missing(JsonNode value) { return value==null || value.isNull() || value.isTextual() && value.asText().isBlank() || value.isArray() && value.isEmpty(); }
    void validateValue(Question q,JsonNode value,boolean requiredCheck) {
        if(value!=null && value.isArray() && q.type()!=Type.MULTIPLE)
            throw new BusinessException(400,"INVALID_ANSWER","答案类型、选项或范围不合法："+q.text());
        if(missing(value)) {
            if(requiredCheck && q.required()) throw new BusinessException(400,"REQUIRED_ANSWER","请回答必填题："+q.text());
            return;
        }
        Set<String> options=new HashSet<>(q.options().stream().map(Option::id).toList());
        boolean valid=switch(q.type()) {
            case SINGLE -> value.isTextual() && options.contains(value.asText());
            case MULTIPLE -> {
                Set<String> seen=new HashSet<>(); boolean ok=value.isArray() && value.size()<=options.size();
                if(value.isArray()) for(JsonNode item:value) ok=ok && item.isTextual() && options.contains(item.asText()) && seen.add(item.asText());
                yield ok;
            }
            case SCALE -> value.isIntegralNumber() && value.canConvertToInt() && value.intValue()>=q.min() && value.intValue()<=q.max();
            case OPEN -> value.isTextual() && value.asText().length()<=5000;
        };
        if(!valid) throw new BusinessException(400,"INVALID_ANSWER","答案类型、选项或范围不合法："+q.text());
    }
    void writable(ResponseSession row) {
        if(!"IN_PROGRESS".equals(row.getStatus())) throw new BusinessException(409,"ALREADY_SUBMITTED","答卷已经提交，不能再次修改");
    }
    void save(ResponseSession row,Question question,JsonNode value) {
        var existing=answers.selectOne(Wrappers.<Answer>lambdaQuery().eq(Answer::getSessionId,row.getId()).eq(Answer::getQuestionId,question.id()).last("FOR UPDATE"));
        if(existing==null) { existing=new Answer(); existing.setSessionId(row.getId()); existing.setQuestionId(question.id()); existing.setValueJson(survey.encode(value)); answers.insert(existing); }
        else { existing.setValueJson(survey.encode(value)); existing.setUpdatedAt(LocalDateTime.now()); answers.updateById(existing); }
    }
    @Transactional public Object answer(String token,AnswerInput input) {
        var row=session(token,true); writable(row); var draft=survey.decode(survey.version(row.getSurveyId(),row.getVersionId()).getSnapshotJson());
        var q=draft.questions().stream().filter(question->question.id().equals(input.questionId())).findFirst().orElseThrow(SurveyService::missing);
        validateValue(q,input.value(),false); save(row,q,input.value()); return Map.of("saved",true);
    }
    @Transactional public Object complete(String token,Complete input) {
        var row=session(token,true);
        if("SUBMITTED".equals(row.getStatus())) return Map.of("status","SUBMITTED","versionId",row.getVersionId());
        writable(row); var draft=survey.decode(survey.version(row.getSurveyId(),row.getVersionId()).getSnapshotJson());
        Map<String,Question> byId=new LinkedHashMap<>(); for(var q:draft.questions()) byId.put(q.id(),q);
        if(!byId.keySet().containsAll(input.answers().keySet())) throw new BusinessException(400,"UNKNOWN_QUESTION","提交包含不属于当前发布版本的题目");
        Map<String,JsonNode> values=new HashMap<>();
        for(var answer:answers.selectList(Wrappers.<Answer>lambdaQuery().eq(Answer::getSessionId,row.getId()).last("FOR UPDATE"))) values.put(answer.getQuestionId(),node(answer.getValueJson()));
        values.putAll(input.answers());
        for(var q:draft.questions()) validateValue(q,values.get(q.id()),true);
        for(var entry:input.answers().entrySet()) save(row,byId.get(entry.getKey()),entry.getValue());
        row.setStatus("SUBMITTED"); row.setCompletedAt(LocalDateTime.now()); sessions.updateById(row);
        return Map.of("status","SUBMITTED","versionId",row.getVersionId());
    }
}
