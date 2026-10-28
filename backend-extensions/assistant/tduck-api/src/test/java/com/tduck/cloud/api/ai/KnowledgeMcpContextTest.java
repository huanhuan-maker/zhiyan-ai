package com.tduck.cloud.api.ai;
import com.tduck.cloud.api.web.filter.AssistantMcpFilter;
import com.tduck.cloud.account.service.UserTokenService;
import com.tduck.cloud.account.util.JwtUtils;
import com.tduck.cloud.form.assistant.*;
import com.tduck.cloud.common.util.SecurityUtils;
import io.jsonwebtoken.Jwts;
import org.junit.Test;
import org.springframework.mock.web.*;
import org.springframework.web.context.request.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.Assert.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;
public class KnowledgeMcpContextTest {
    @Test public void authenticatedMcpIdentityReachesProviderAndIsClearedAfterRequest() throws Exception {
        JwtUtils jwt=mock(JwtUtils.class);UserTokenService tokens=mock(UserTokenService.class);AssistantMcpProtocol protocol=mock(AssistantMcpProtocol.class);AssistantRateLimit rates=mock(AssistantRateLimit.class);
        when(jwt.getHeader()).thenReturn("token");when(jwt.getClaimByToken("synthetic-valid-token")).thenReturn(Jwts.claims().setSubject("22").setExpiration(new Date(System.currentTimeMillis()+60000)));when(tokens.verifyToken("synthetic-valid-token",22L)).thenReturn(true);
        when(protocol.handle(any(),eq(22L),any())).thenAnswer(invocation->{assertEquals(Long.valueOf(22),SecurityUtils.getUserId());return AssistantMcpProtocol.result(1,map());});
        RequestContextHolder.resetRequestAttributes();MockHttpServletRequest request=new MockHttpServletRequest("POST","/assistant-mcp");request.addHeader("token","synthetic-valid-token");request.addHeader("Accept","application/json, text/event-stream");request.setContentType("application/json");request.setContent("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}".getBytes("UTF-8"));MockHttpServletResponse response=new MockHttpServletResponse();
        new AssistantMcpFilter(jwt,tokens,protocol,rates).doFilter(request,response,new MockFilterChain());assertEquals(200,response.getStatus());verify(protocol).handle(any(),eq(22L),any());assertNull(RequestContextHolder.getRequestAttributes());
    }
}
