package com.tduck.cloud.form.ai;

import com.tduck.cloud.form.aiconfig.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import static com.tduck.cloud.form.aiconfig.AiSettingsService.Selection;

/** Compatibility facade for all existing AI callers; settings now come from MySQL. */
@Component
public class OpenAiCompatibleProvider implements AiProvider {
    private final AiSettingsService settings;
    private final AiTransport transport;
    private final Selection legacy;
    private final ThreadLocal<Selection> invocation=new ThreadLocal<>();
    @Autowired public OpenAiCompatibleProvider(AiSettingsService settings,AiTransport transport){this.settings=settings;this.transport=transport;this.legacy=null;}
    // Preserve the old constructor for existing non-Spring tests and failure fixtures.
    public OpenAiCompatibleProvider(String name,String base,String key,String model,int timeout) {
        settings=null;transport=new AiTransport();
        AiSettings.Provider p=new AiSettings.Provider();p.setName(name);p.setBaseUrl(base);p.setTimeoutMs(timeout);p.setOutputTokenParameter("max_tokens");
        AiSettings.Model m=new AiSettings.Model();m.setModelId(model);legacy=new Selection(p,m,key);
    }
    private Selection resolve(){return settings==null?legacy:settings.selected(com.tduck.cloud.common.util.SecurityUtils.getUserId());}
    private Selection current(){Selection s=invocation.get();return s==null?resolve():s;}
    @Override public boolean available(){Selection s=resolve();invocation.remove();if(s!=null)invocation.set(s);return s!=null&&s.key!=null&&!s.key.isEmpty()&&s.provider.getBaseUrl()!=null&&!s.provider.getBaseUrl().isEmpty()&&s.model.getModelId()!=null&&!s.model.getModelId().isEmpty();}
    @Override public String providerName(){Selection s=current();return s==null?"未启用真实模型":s.provider.getName();}
    @Override public String model(){Selection s=current();return s==null?"未选择":s.model.getModelId();}
    public int historyTurns(){Selection s=current();return s==null?0:s.model.getHistoryTurns();}
    public int inputBudget(){Selection s=current();return s==null?0:Math.max(0,s.model.getContextWindow()-s.model.getMaxOutputTokens()-1024);}
    @Override public String complete(String systemPrompt,String inputJson){return transport.complete(current(),systemPrompt,inputJson);}
}
