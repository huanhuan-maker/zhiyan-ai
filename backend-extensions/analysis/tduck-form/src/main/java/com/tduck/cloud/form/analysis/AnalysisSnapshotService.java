package com.tduck.cloud.form.analysis;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.entity.*;
import com.tduck.cloud.form.mapper.UserFormDataMapper;
import com.tduck.cloud.form.service.*;
import com.tduck.cloud.form.util.HtmlUtils;
import com.tduck.cloud.form.vo.FormReportVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

@Service
@RequiredArgsConstructor
public class AnalysisSnapshotService {
    private final UserFormVersionService versions;
    private final UserFormDataMapper answers;
    private final FormDashboardService statistics;

    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ, propagation=Propagation.REQUIRES_NEW)
    public Map<String,Object> capture(String formKey, int versionNo) {
        UserFormVersionEntity version=versions.byNo(formKey,versionNo);
        if(version==null) throw new BaseException("请先发布问卷并选择存在的发布版本");
        List<UserFormDataEntity> rows=answers.selectList(Wrappers.<UserFormDataEntity>lambdaQuery()
            .eq(UserFormDataEntity::getFormKey,formKey).eq(UserFormDataEntity::getVersionNo,versionNo)
            .orderByAsc(UserFormDataEntity::getId).last("limit 5001"));
        if(rows.size()>5000) throw new BaseException("本轮报告支持单版本最多5000份答卷；原答卷与统计仍可使用");
        List<Map<String,Object>> evidence=new ArrayList<>(), source=new ArrayList<>();
        List<UserFormItemEntity> fields=versions.itemsOf(version);
        int totalOpen=0,characters=0;
        Set<String> covered=new HashSet<>();
        for(UserFormDataEntity row:rows) {
            source.add(map("id",String.valueOf(row.getId()),"answers",row.getOriginalData()));
            for(UserFormItemEntity field:fields) {
                if(field.getType()==null||!("INPUT".equals(field.getType().name())||"TEXTAREA".equals(field.getType().name()))
                    ||Boolean.TRUE.equals(field.getDisplayType())) continue;
                Object value=row.getOriginalData()==null?null:row.getOriginalData().get(field.getFormItemId());
                if(!(value instanceof String)||((String)value).trim().isEmpty()) continue;
                String text=(String)value; totalOpen++;
                if(evidence.size()>=200||text.length()>2000||characters+text.length()>60000) continue;
                characters+=text.length(); covered.add(String.valueOf(row.getId()));
                evidence.add(map("id","E"+(evidence.size()+1),"answerId",String.valueOf(row.getId()),
                    "fieldId",field.getFormItemId(),"question",HtmlUtils.cleanHtmlTag(field.getLabel()),"text",text,
                    "source","CORE_OPEN_RESPONSE","attribution","核心开放题回答；自发性与选项提示影响未经判定"));
            }
        }
        List<FormReportVO.Analysis> stats=statistics.formReportAnalysis(formKey,versionNo);
        Map<String,Object> snap=map("formKey",formKey,"versionNo",versionNo,
            "title",HtmlUtils.cleanHtmlTag(String.valueOf(version.getFormSnapshot()==null?"问卷":version.getFormSnapshot().getOrDefault("name","问卷"))),
            "answerCount",rows.size(),"statistics",stats,"evidence",evidence,"openResponseCount",totalOpen,
            "includedEvidenceCount",evidence.size(),"excludedEvidenceCount",totalOpen-evidence.size(),
            "coveredAnswerCount",covered.size(),"evidenceLimit",200,"characterLimit",60000);
        snap.put("fingerprint",fingerprint(write(map("form",version.getFormSnapshot(),"items",version.getItemsSnapshot(),"rows",source))));
        return snap;
    }
    public static String fingerprint(String value) {
        try {
            byte[] digest=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex=new StringBuilder(); for(byte b:digest) hex.append(String.format("%02x",b&255)); return hex.toString();
        } catch(Exception e) { throw new IllegalStateException(e); }
    }
}
