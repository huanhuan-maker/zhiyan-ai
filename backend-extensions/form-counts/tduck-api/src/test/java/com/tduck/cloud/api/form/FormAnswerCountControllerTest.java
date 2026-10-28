package com.tduck.cloud.api.form;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.tduck.cloud.api.web.controller.FormAnswerCountController;
import com.tduck.cloud.common.util.Result;
import com.tduck.cloud.form.entity.UserFormEntity;
import com.tduck.cloud.form.service.UserFormDataService;
import com.tduck.cloud.form.service.UserFormService;
import org.junit.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 我的问卷卡片「收集份数」接口：只返回本人问卷、缺省 0 份、拒绝超量请求。
 */
public class FormAnswerCountControllerTest {

    private final UserFormService formService = mock(UserFormService.class);
    private final UserFormDataService dataService = mock(UserFormDataService.class);
    private final FormAnswerCountController controller = new FormAnswerCountController(formService, dataService);

    private static UserFormEntity form(String key, Long userId) {
        UserFormEntity entity = new UserFormEntity();
        entity.setFormKey(key);
        entity.setUserId(userId);
        return entity;
    }

    @Test
    @SuppressWarnings("unchecked")
    public void returnsAnswerCountsForOwnedFormsOnly() {
        when(formService.list(any(Wrapper.class))).thenReturn(List.of(form("k1", 7L), form("k2", 7L)));
        when(dataService.listMaps(any(Wrapper.class))).thenReturn(List.of(
                Map.of("form_key", "k1", "answer_count", 5L),
                Map.of("form_key", "k2", "answer_count", 0L)));

        Result<?> result = controller.answerCounts(7L, "k1,k2,someone-else");

        assertEquals(200, result.getCode());
        Map<String, Long> data = (Map<String, Long>) result.getData();
        assertEquals(2, data.size());
        assertFalse(data.containsKey("someone-else"));
        assertEquals(Long.valueOf(5L), data.get("k1"));
        assertEquals(Long.valueOf(0L), data.get("k2"));
    }

    @Test
    @SuppressWarnings("unchecked")
    public void missingRowMeansZeroAnswers() {
        when(formService.list(any(Wrapper.class))).thenReturn(List.of(form("k1", 7L)));
        when(dataService.listMaps(any(Wrapper.class))).thenReturn(Collections.emptyList());

        Result<?> result = controller.answerCounts(7L, " k1 , k1 ");

        assertEquals(200, result.getCode());
        Map<String, Long> data = (Map<String, Long>) result.getData();
        assertEquals(1, data.size());
        assertEquals(Long.valueOf(0L), data.get("k1"));
    }

    @Test
    public void emptyKeysNeverTouchTheDatabase() {
        Result<?> result = controller.answerCounts(7L, "   ");

        assertEquals(200, result.getCode());
        assertTrue(((Map<?, ?>) result.getData()).isEmpty());
        verify(formService, never()).list(any(Wrapper.class));
        verify(dataService, never()).listMaps(any(Wrapper.class));
    }

    @Test
    public void rejectsOversizedBatch() {
        StringBuilder keys = new StringBuilder();
        for (int i = 0; i < 101; i++) {
            if (i > 0) keys.append(',');
            keys.append('k').append(i);
        }

        Result<?> result = controller.answerCounts(7L, keys.toString());

        assertEquals(500, result.getCode());
        assertEquals("一次最多查询 100 份问卷", result.getMsg());
        verify(formService, never()).list(any(Wrapper.class));
    }
}
