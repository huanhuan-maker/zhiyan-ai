package cn.zhiyan.service;

import cn.zhiyan.dto.SurveyDtos.*;
import cn.zhiyan.entity.*;
import cn.zhiyan.mapper.*;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ResultsService {
    final SurveyService survey; final ResponseService response;
    final ResponseSessionMapper sessions; final AnswerMapper answers;
    public ResultsService(SurveyService survey,ResponseService response,ResponseSessionMapper sessions,AnswerMapper answers) { this.survey=survey; this.response=response; this.sessions=sessions; this.answers=answers; }
    @Transactional(readOnly=true) public Object results(long surveyId,long versionId,String name) {
        survey.owned(surveyId,name,false); var v=survey.version(surveyId,versionId); var draft=survey.decode(v.getSnapshotJson());
        var submitted=sessions.selectList(Wrappers.<ResponseSession>lambdaQuery().eq(ResponseSession::getVersionId,versionId).eq(ResponseSession::getStatus,"SUBMITTED"));
        var ids=submitted.stream().map(ResponseSession::getId).toList();
        var rows=ids.isEmpty()?List.<Answer>of():answers.selectList(Wrappers.<Answer>lambdaQuery().in(Answer::getSessionId,ids));
        var grouped=rows.stream().collect(Collectors.groupingBy(Answer::getQuestionId)); List<Object> stats=new ArrayList<>();
        for(var q:draft.questions()) {
            List<JsonNode> values=grouped.getOrDefault(q.id(),List.of()).stream().map(a->response.node(a.getValueJson())).filter(a->!response.missing(a)).toList();
            int denominator=values.size(); Map<String,Object> item=new LinkedHashMap<>();
            item.put("questionId",q.id()); item.put("text",q.text()); item.put("type",q.type()); item.put("denominator",denominator);
            item.put("total",ids.size()); item.put("missing",ids.size()-denominator); List<Object> bins=new ArrayList<>();
            if(q.type()==Type.SINGLE || q.type()==Type.MULTIPLE) {
                for(var option:q.options()) {
                    long n=values.stream().filter(value->q.type()==Type.SINGLE?value.asText().equals(option.id()):contains(value,option.id())).count();
                    bins.add(bin(option.id(),option.label(),n,denominator));
                }
            } else if(q.type()==Type.SCALE) {
                for(int i=q.min();i<=q.max();i++) { int score=i; long n=values.stream().filter(value->value.intValue()==score).count(); bins.add(bin(""+i,""+i,n,denominator)); }
                item.put("average",denominator==0?null:values.stream().mapToInt(JsonNode::intValue).average().orElseThrow());
            } else {
                item.put("responses",grouped.getOrDefault(q.id(),List.of()).stream().filter(a->!response.missing(response.node(a.getValueJson())))
                        .map(a->Map.of("answerId",a.getId(),"anonymousSessionId",a.getSessionId(),"text",response.node(a.getValueJson()).asText())).toList());
            }
            item.put("options",bins); stats.add(item);
        }
        return Map.of("surveyId",surveyId,"versionId",versionId,"versionNumber",v.getVersionNumber(),"title",draft.title(),"completedCount",ids.size(),"questions",stats,"aiMode","NOT_IMPLEMENTED");
    }
    private boolean contains(JsonNode array,String id) { for(var value:array) if(value.asText().equals(id)) return true; return false; }
    private Object bin(String id,String label,long numerator,int denominator) { return Map.of("id",id,"label",label,"numerator",numerator,"denominator",denominator,"percentage",denominator==0?0.0:Math.round(numerator*1000.0/denominator)/10.0); }
}
