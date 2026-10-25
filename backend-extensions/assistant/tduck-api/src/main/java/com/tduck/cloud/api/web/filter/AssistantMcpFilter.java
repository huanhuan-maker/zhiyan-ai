package com.tduck.cloud.api.web.filter;

import com.tduck.cloud.account.service.UserTokenService;
import com.tduck.cloud.account.util.JwtUtils;
import com.tduck.cloud.form.assistant.*;
import com.tduck.cloud.common.exception.BaseException;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import javax.servlet.*;
import javax.servlet.http.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

/** Dedicated MCP transport handles auth itself, before legacy REST-envelope interceptors. */
@Component @Order(-100) @RequiredArgsConstructor
public class AssistantMcpFilter extends OncePerRequestFilter {
    private final JwtUtils jwt;
    private final UserTokenService tokens;
    private final AssistantMcpProtocol protocol;
    private final AssistantRateLimit rates;
    @Override protected boolean shouldNotFilter(HttpServletRequest request){return !"/assistant-mcp".equals(request.getRequestURI());}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws IOException {
        response.setCharacterEncoding("UTF-8");response.setContentType("application/json");response.setHeader("Cache-Control","no-store");
        String origin=request.getHeader("Origin");
        if(origin!=null&&!Arrays.asList("http://127.0.0.1:5180","http://localhost:5180","http://127.0.0.1:4180","http://localhost:4180","http://127.0.0.1:8997","http://localhost:8997").contains(origin)){send(response,403,map("error","Origin not allowed"));return;}
        String token=request.getHeader("Authorization");token=token!=null&&token.startsWith("Bearer ")?token.substring(7):request.getHeader(jwt.getHeader());
        Long owner=null;
        try{Claims claim=jwt.getClaimByToken(token);if(claim!=null&&!jwt.isTokenExpired(claim.getExpiration())){Long candidate=Long.valueOf(claim.getSubject());if(tokens.verifyToken(token,candidate))owner=candidate;}}catch(Exception ignored){}
        if(owner==null){response.setHeader("WWW-Authenticate","Bearer realm=\"zhiyan-assistant\"");send(response,401,map("error","Authentication required"));return;}
        try{rates.check(owner,"mcp",120);}catch(BaseException e){send(response,429,map("error",e.getMessage()));return;}
        if(!"POST".equals(request.getMethod())){response.setHeader("Allow","POST");send(response,405,map("error","This stateless server provides JSON POST responses, no SSE stream or persistent session"));return;}
        String accept=request.getHeader("Accept");if(accept==null||!accept.contains("application/json")||!accept.contains("text/event-stream")){send(response,406,map("error","Accept application/json and text/event-stream"));return;}
        if(request.getContentType()==null||!request.getContentType().toLowerCase(Locale.ROOT).startsWith("application/json")){send(response,415,map("error","Content-Type must be application/json"));return;}
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;
        while((n=request.getInputStream().read(buffer))!=-1){bytes.write(buffer,0,n);if(bytes.size()>65536){send(response,413,map("error","Request too large"));return;}}
        Map<String,Object> body;
        String json=new String(bytes.toByteArray(),StandardCharsets.UTF_8);
        if(!withinDepth(json)){send(response,400,AssistantMcpProtocol.error(null,-32600,"JSON nesting exceeds the transport limit"));return;}
        try{Object parsed=JSON.readValue(json,Object.class);if(!(parsed instanceof Map)){send(response,400,AssistantMcpProtocol.error(null,-32600,"Single JSON-RPC object required"));return;}body=(Map<String,Object>)parsed;}
        catch(Exception e){send(response,400,AssistantMcpProtocol.error(null,-32700,"Invalid JSON"));return;}
        Map<String,Object> result;
        try{result=protocol.handle(body,owner,request.getHeader("MCP-Protocol-Version"));}
        catch(Exception e){send(response,500,AssistantMcpProtocol.error(body.get("id"),-32603,"Internal tool error"));return;}
        if(result==null){response.setStatus(202);return;}
        send(response,result.containsKey("error")?400:200,result);
    }
    public static boolean withinDepth(String text){
        int depth=0;boolean quoted=false,escaped=false;
        for(char c:text.toCharArray()){if(escaped){escaped=false;continue;}if(quoted&&c=='\\'){escaped=true;continue;}if(c=='"'){quoted=!quoted;continue;}if(!quoted&&(c=='{'||c=='[')&&++depth>20)return false;if(!quoted&&(c=='}'||c==']'))depth--;}
        return true;
    }
    private void send(HttpServletResponse response,int status,Object value)throws IOException{response.setStatus(status);response.getWriter().write(write(value));}
}
