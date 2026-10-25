package com.tduck.cloud.form.aiconfig;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.entity.AiSettingsEntity;
import com.tduck.cloud.form.mapper.AiSettingsMapper;
import org.springframework.core.env.Environment;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.time.Instant;
import java.util.*;

@Service
public class AiSettingsService {
    public static final ObjectMapper JSON = new ObjectMapper();
    private final AiSettingsMapper mapper;
    private final AiKeyCipher cipher;
    private final Environment env;
    public AiSettingsService(AiSettingsMapper mapper, AiKeyCipher cipher, Environment env) { this.mapper=mapper; this.cipher=cipher; this.env=env; }

    public synchronized AiSettings load() {
        AiSettingsEntity row=mapper.selectById(1L);
        if(row==null) {
            AiSettings initial=new AiSettings();
            String base=env.getProperty("ai.base-url", ""), key=env.getProperty("ai.api-key", ""), model=env.getProperty("ai.model", "");
            if(!base.isEmpty() && !key.isEmpty() && !model.isEmpty()) {
                AiSettings.Provider p=new AiSettings.Provider();p.setId(UUID.randomUUID().toString());
                p.setName(env.getProperty("ai.provider-name", "现有服务端供应商"));p.setBaseUrl(base);
                p.setTimeoutMs(env.getProperty("ai.timeout-ms", Integer.class, 60000));p.setEncryptedKey(cipher.encrypt(key));
                p.setOutputTokenParameter("max_tokens");
                AiSettings.Model m=new AiSettings.Model();m.setId(UUID.randomUUID().toString());m.setName(model);m.setModelId(model);
                p.getModels().add(m);initial.getProviders().add(p);initial.setDefaultModelId(m.getId());initial.setEnabled(true);
            }
            row=new AiSettingsEntity();row.setId(1L);row.setRevision(0);row.setConfigJson(write(initial));row.setUpdatedAt(Instant.now().toString());
            try { mapper.insert(row); } catch(DuplicateKeyException e) { row=mapper.selectById(1L); }
        }
        AiSettings value=read(row.getConfigJson());value.setRevision(row.getRevision());return value;
    }

    public Map<String,Object> view() { return safe(load()); }
    @SuppressWarnings("unchecked")
    public static Map<String,Object> safe(AiSettings value) {
        Map<String,Object> result=JSON.convertValue(value,Map.class);
        for(Map<String,Object> p:(List<Map<String,Object>>)result.get("providers")) {
            p.put("hasApiKey",p.get("encryptedKey")!=null&&!String.valueOf(p.get("encryptedKey")).isEmpty());
            p.remove("apiKey");p.remove("encryptedKey");p.remove("clearApiKey");
        }
        return result;
    }

    public synchronized Map<String,Object> save(AiSettings input,Long actor) {
        AiSettings old=load();if(input==null||input.getRevision()!=old.getRevision())throw new BaseException("配置已被更新，请重新加载后修改，未覆盖其他人的设置");
        if(input.getProviders()==null||input.getProviders().size()>20)throw new BaseException("最多配置20个供应商");
        Map<String,AiSettings.Provider> previous=new HashMap<>();for(AiSettings.Provider p:old.getProviders())previous.put(p.getId(),p);
        for(AiSettings.Provider p:input.getProviders()) {
            if(p==null)throw new BaseException("供应商不能为空");
            AiSettings.Provider before=previous.get(p.getId());
            String typed=p.getApiKey();p.setEncryptedKey(before==null?null:before.getEncryptedKey());
            if(typed!=null&&!typed.trim().isEmpty()) {
                if(typed.length()>4096||typed.matches("(?s).*[\\r\\n].*"))throw new BaseException("API Key格式不正确");
                p.setEncryptedKey(cipher.encrypt(typed.trim()));
            } else if(p.isClearApiKey()) p.setEncryptedKey(null);
            else if(before!=null&&(!Objects.equals(before.getBaseUrl(),p.getBaseUrl())||!Objects.equals(before.getProtocol(),p.getProtocol())))throw new BaseException("修改供应商地址或协议后，请重新填写API Key以确认目标");
            p.setApiKey(null);p.setClearApiKey(false);
        }
        validate(input);
        AiSettingsEntity row=new AiSettingsEntity();row.setConfigJson(write(input));row.setRevision(old.getRevision()+1);row.setUpdatedBy(actor);row.setUpdatedAt(Instant.now().toString());
        int n=mapper.update(row,Wrappers.<AiSettingsEntity>lambdaUpdate().eq(AiSettingsEntity::getId,1L).eq(AiSettingsEntity::getRevision,old.getRevision()));
        if(n!=1)throw new BaseException("配置发生并发更新，请重新加载");
        return view();
    }

    public static void validate(AiSettings value) {
        Set<String> ids=new HashSet<>();boolean found=false;
        for(AiSettings.Provider p:value.getProviders()) {
            if(p==null)throw new BaseException("供应商不能为空");id(p.getId(),ids);text(p.getName(),80,"供应商名称");
            if(!Arrays.asList("OPENAI_CHAT","OPENAI_RESPONSES","ANTHROPIC").contains(p.getProtocol()))throw new BaseException("不支持的API协议");
            endpoint(p.getBaseUrl());if(p.getTimeoutMs()<1000||p.getTimeoutMs()>120000)throw new BaseException("超时范围为1000–120000毫秒");
            if(!Arrays.asList("max_tokens","max_completion_tokens").contains(p.getOutputTokenParameter()))throw new BaseException("输出参数不正确");
            if(p.getModels()==null||p.getModels().size()>30)throw new BaseException("每个供应商最多30个模型");
            for(AiSettings.Model m:p.getModels()) {
                if(m==null)throw new BaseException("模型不能为空");id(m.getId(),ids);text(m.getName(),80,"模型显示名");text(m.getModelId(),150,"模型ID");
                if(!Arrays.asList("auto","none","minimal","low","medium","high","xhigh","max").contains(m.getReasoningEffort())||("ANTHROPIC".equals(p.getProtocol())&&"minimal".equals(m.getReasoningEffort())))throw new BaseException("该协议不支持此思考强度");
                if(m.getContextWindow()<1024||m.getContextWindow()>2097152||m.getMaxOutputTokens()<64||m.getMaxOutputTokens()>262144||m.getMaxOutputTokens()>=m.getContextWindow())throw new BaseException("上下文为1024–2097152，输出为64–262144且必须小于上下文窗口");
                if(m.getHistoryTurns()<0||m.getHistoryTurns()>20)throw new BaseException("历史提问轮数为0–20");
                if(Objects.equals(m.getId(),value.getDefaultModelId())) {found=true;if(value.isEnabled()&&(p.getEncryptedKey()==null||p.getEncryptedKey().isEmpty()))throw new BaseException("默认模型的供应商尚未配置API Key");}
            }
        }
        if((value.isEnabled()||value.getDefaultModelId()!=null&&!value.getDefaultModelId().isEmpty())&&!found)throw new BaseException("请选择存在的默认模型");
    }
    private static void id(String s,Set<String> ids){if(s==null||!s.matches("[a-f0-9-]{36}")||!ids.add(s))throw new BaseException("配置编号不正确或重复");}
    private static void text(String s,int max,String label){if(s==null||s.trim().isEmpty()||s.length()>max||s.matches("(?s).*[\\p{Cntrl}].*"))throw new BaseException(label+"格式不正确");}
    public static URI endpoint(String s) {
        try {URI u=new URI(s);if(s.length()>500||!Arrays.asList("http","https").contains(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null||u.getQuery()!=null||u.getFragment()!=null||"169.254.169.254".equals(u.getHost()))throw new Exception();return u;}
        catch(Exception e){throw new BaseException("Base URL需为不含凭据、查询参数或片段的HTTP(S)地址");}
    }

    public Selection selected() {
        AiSettings s=load();if(!s.isEnabled())return null;
        for(AiSettings.Provider p:s.getProviders())for(AiSettings.Model m:p.getModels())if(m.getId().equals(s.getDefaultModelId())&&p.getEncryptedKey()!=null)return selection(p,m);
        return null;
    }
    public Selection byId(String id) {
        for(AiSettings.Provider p:load().getProviders())for(AiSettings.Model m:p.getModels())if(m.getId().equals(id))return selection(p,m);
        throw new BaseException("模型不存在，请先保存配置");
    }
    private Selection selection(AiSettings.Provider p,AiSettings.Model m){return new Selection(p,m,cipher.decrypt(p.getEncryptedKey()));}
    public static class Selection {
        public final AiSettings.Provider provider; public final AiSettings.Model model; public final String key;
        public Selection(AiSettings.Provider p,AiSettings.Model m,String k){provider=p;model=m;key=k;}
    }
    private static String write(AiSettings s){try{return JSON.writeValueAsString(s);}catch(Exception e){throw new BaseException("模型配置无法保存");}}
    private static AiSettings read(String s){try{return JSON.readValue(s,AiSettings.class);}catch(Exception e){throw new BaseException("模型配置无法读取，请检查迁移状态");}}
}
