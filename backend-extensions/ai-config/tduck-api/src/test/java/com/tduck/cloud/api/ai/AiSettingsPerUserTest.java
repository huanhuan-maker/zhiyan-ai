package com.tduck.cloud.api.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.aiconfig.*;
import com.tduck.cloud.form.entity.AiSettingsEntity;
import com.tduck.cloud.form.entity.AiSettingsUserEntity;
import com.tduck.cloud.form.mapper.AiSettingsMapper;
import com.tduck.cloud.form.mapper.AiSettingsUserMapper;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.env.MockEnvironment;

import java.util.*;

import static org.junit.Assert.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 每个账号用自己的请求地址与 API Key 配置模型：首次保存继承系统密钥、并发保护、个人配置优先。
 */
public class AiSettingsPerUserTest {

    private static final String PROVIDER_ID = "11111111-1111-1111-1111-111111111111";
    private static final String MODEL_ID = "22222222-2222-2222-2222-222222222222";

    private AiSettings config(String modelId, String baseUrl, boolean enabled) {
        AiSettings s = new AiSettings();
        s.setEnabled(enabled);
        AiSettings.Provider p = new AiSettings.Provider();
        p.setId(PROVIDER_ID);
        p.setName("Synthetic");
        p.setBaseUrl(baseUrl);
        p.setProtocol("OPENAI_CHAT");
        p.setEncryptedKey("CIPHER-KEY");
        AiSettings.Model m = new AiSettings.Model();
        m.setId(MODEL_ID);
        m.setName("Synthetic model");
        m.setModelId(modelId);
        p.getModels().add(m);
        s.getProviders().add(p);
        s.setDefaultModelId(MODEL_ID);
        return s;
    }

    private AiSettingsEntity globalRow(AiSettings cfg) throws Exception {
        AiSettingsEntity row = new AiSettingsEntity();
        row.setId(1L);
        row.setRevision(5);
        row.setConfigJson(AiSettingsService.JSON.writeValueAsString(cfg));
        return row;
    }

    private AiSettingsService service(AiSettingsMapper mapper, AiSettingsUserMapper userMapper, AiKeyCipher cipher) {
        return new AiSettingsService(mapper, userMapper, cipher, new MockEnvironment());
    }

    @Test
    public void firstSaveCreatesPersonalRowAndKeepsInheritedCiphertext() throws Exception {
        AiSettingsMapper mapper = mock(AiSettingsMapper.class);
        AiSettingsUserMapper userMapper = mock(AiSettingsUserMapper.class);
        when(mapper.selectById(1L)).thenReturn(globalRow(config("global-model", "http://127.0.0.1:3425/v1", true)));
        when(userMapper.selectById(7L)).thenReturn(null);
        AiKeyCipher cipher = mock(AiKeyCipher.class);
        when(cipher.encrypt(any())).thenReturn("NEW-CIPHER");
        AiSettingsService svc = service(mapper, userMapper, cipher);

        AiSettings input = config("my-model", "http://127.0.0.1:3425/v1", true);
        input.getProviders().get(0).setApiKey("");

        svc.saveOwn(input, 7L);

        ArgumentCaptor<AiSettingsUserEntity> captor = ArgumentCaptor.forClass(AiSettingsUserEntity.class);
        verify(userMapper).insert(captor.capture());
        AiSettingsUserEntity saved = captor.getValue();
        assertEquals(Long.valueOf(7L), saved.getUserId());
        assertEquals(Integer.valueOf(0), saved.getRevision());
        assertTrue(saved.getConfigJson().contains("CIPHER-KEY"));
        assertFalse(saved.getConfigJson().contains("sk-"));
        assertNull(input.getProviders().get(0).getApiKey());
    }

    @Test
    public void stalePersonalRevisionNeverOverwrites() throws Exception {
        AiSettingsMapper mapper = mock(AiSettingsMapper.class);
        AiSettingsUserMapper userMapper = mock(AiSettingsUserMapper.class);
        when(mapper.selectById(1L)).thenReturn(globalRow(config("global-model", "http://127.0.0.1:3425/v1", true)));
        AiSettingsUserEntity own = new AiSettingsUserEntity();
        own.setUserId(7L);
        own.setRevision(2);
        own.setConfigJson(AiSettingsService.JSON.writeValueAsString(config("mine", "http://127.0.0.1:3425/v1", true)));
        when(userMapper.selectById(7L)).thenReturn(own);
        AiSettingsService svc = service(mapper, userMapper, mock(AiKeyCipher.class));

        AiSettings input = config("mine", "http://127.0.0.1:3425/v1", true);
        input.setRevision(1);
        try {
            svc.saveOwn(input, 7L);
            fail("stale revision accepted");
        } catch (BaseException expected) {
            verify(userMapper, never()).update(any(), any());
            verify(userMapper, never()).insert(any(AiSettingsUserEntity.class));
        }
    }

    @Test
    public void personalSelectionWinsAndMissingKeyFallsBackToGlobal() throws Exception {
        AiSettingsMapper mapper = mock(AiSettingsMapper.class);
        AiSettingsUserMapper userMapper = mock(AiSettingsUserMapper.class);
        when(mapper.selectById(1L)).thenReturn(globalRow(config("global-model", "http://127.0.0.1:3425/v1", true)));
        AiSettingsUserEntity own = new AiSettingsUserEntity();
        own.setUserId(7L);
        own.setRevision(0);
        own.setConfigJson(AiSettingsService.JSON.writeValueAsString(config("my-model", "http://example.test/v1", true)));
        when(userMapper.selectById(7L)).thenReturn(own);
        AiKeyCipher cipher = mock(AiKeyCipher.class);
        when(cipher.decrypt(any())).thenReturn("synthetic-key");
        AiSettingsService svc = service(mapper, userMapper, cipher);

        assertEquals("my-model", svc.selected(7L).model.getModelId());
        assertEquals("global-model", svc.selected(8L).model.getModelId());
        assertTrue(svc.byId(MODEL_ID, 7L).provider.getBaseUrl().contains("example.test"));
    }

    @Test
    public void disabledPersonalConfigDoesNotSilentlyUseGlobalModel() throws Exception {
        AiSettingsMapper mapper = mock(AiSettingsMapper.class);
        AiSettingsUserMapper userMapper = mock(AiSettingsUserMapper.class);
        when(mapper.selectById(1L)).thenReturn(globalRow(config("global-model", "http://127.0.0.1:3425/v1", true)));
        AiSettingsUserEntity own = new AiSettingsUserEntity();
        own.setUserId(7L);
        own.setRevision(0);
        own.setConfigJson(AiSettingsService.JSON.writeValueAsString(config("my-model", "http://example.test/v1", false)));
        when(userMapper.selectById(7L)).thenReturn(own);
        assertNull(service(mapper, userMapper, mock(AiKeyCipher.class)).selected(7L));
    }

    @Test
    public void viewInheritsGlobalUntilTheUserSaves() throws Exception {
        AiSettingsMapper mapper = mock(AiSettingsMapper.class);
        AiSettingsUserMapper userMapper = mock(AiSettingsUserMapper.class);
        when(mapper.selectById(1L)).thenReturn(globalRow(config("global-model", "http://127.0.0.1:3425/v1", true)));
        when(userMapper.selectById(7L)).thenReturn(null);
        Map<String, Object> view = service(mapper, userMapper, mock(AiKeyCipher.class)).viewOwn(7L);
        assertEquals(true, view.get("inherited"));
        assertEquals(0, view.get("revision"));
        String text = String.valueOf(view);
        assertFalse(text.contains("CIPHER-KEY"));
        assertTrue(text.contains("hasApiKey=true"));
    }

    @Test
    public void browserEchoedViewFieldsAreIgnored() throws Exception {
        JsonNode node = AiSettingsService.JSON.readTree("{\"revision\":0,\"enabled\":false,\"inherited\":true,\"providers\":[{\"id\":\"" + PROVIDER_ID + "\",\"name\":\"x\",\"baseUrl\":\"http://127.0.0.1:1/v1\",\"hasApiKey\":true,\"models\":[]}],\"defaultModelId\":\"\"}");
        AiSettings parsed = AiSettingsService.JSON.treeToValue(node, AiSettings.class);
        assertEquals(1, parsed.getProviders().size());
        assertEquals("x", parsed.getProviders().get(0).getName());
    }
}
