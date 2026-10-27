package com.tduck.cloud.api.ai;

import com.tduck.cloud.form.assistant.*;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.entity.AssistantConversationEntity;
import com.tduck.cloud.form.mapper.*;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

public class AssistantHistoryDeleteTest {
    private static final String ID = "11111111-1111-1111-1111-111111111111";
    private AssistantChatService service(AssistantConversationMapper conversations, AssistantTurnMapper turns) {
        return new AssistantChatService(conversations, turns, mock(AssistantPlanner.class), mock(AssistantTools.class));
    }
    private AssistantConversationEntity ownedBy(Long owner) {
        AssistantConversationEntity c = new AssistantConversationEntity();
        c.setId(ID); c.setOwnerId(owner); c.setTitle("测试对话");
        return c;
    }
    private void reject(Runnable fn){try{fn.run();fail("Unexpected delete accepted");}catch(BaseException expected){}}

    @Test public void ownerDeletesTheConversationTogetherWithItsTurns() {
        AssistantConversationMapper conversations = mock(AssistantConversationMapper.class);
        AssistantTurnMapper turns = mock(AssistantTurnMapper.class);
        when(conversations.selectById(ID)).thenReturn(ownedBy(7L));
        Map<String,Object> result = service(conversations, turns).delete(ID, 7L);
        assertEquals(ID, result.get("id"));
        assertEquals(Boolean.TRUE, result.get("deleted"));
        verify(turns).delete(any());
        verify(conversations).delete(any());
    }

    @Test public void anotherUsersConversationIsRejectedAndKept() {
        AssistantConversationMapper conversations = mock(AssistantConversationMapper.class);
        AssistantTurnMapper turns = mock(AssistantTurnMapper.class);
        when(conversations.selectById(ID)).thenReturn(ownedBy(8L));
        reject(() -> service(conversations, turns).delete(ID, 7L));
        verify(turns, never()).delete(any());
        verify(conversations, never()).delete(any());
    }

    @Test public void missingOrMalformedIdIsRejected() {
        AssistantConversationMapper conversations = mock(AssistantConversationMapper.class);
        AssistantTurnMapper turns = mock(AssistantTurnMapper.class);
        when(conversations.selectById(ID)).thenReturn(null);
        reject(() -> service(conversations, turns).delete(ID, 7L));
        reject(() -> service(conversations, turns).delete("not-a-uuid", 7L));
        verify(conversations, never()).delete(any());
        verify(turns, never()).delete(any());
    }
}
