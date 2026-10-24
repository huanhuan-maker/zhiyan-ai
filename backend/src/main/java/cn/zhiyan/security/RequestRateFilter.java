package cn.zhiyan.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Local single-node fixed-window guard. No trust in client-supplied proxy headers. */
@Component @Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestRateFilter extends OncePerRequestFilter {
    private record Bucket(long minute,int count) { }
    private final ConcurrentHashMap<String,Bucket> buckets=new ConcurrentHashMap<>();
    @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
        String path=req.getRequestURI();
        if(!req.getMethod().equals("POST") || !(path.startsWith("/api/auth/") || path.startsWith("/api/public/"))) { chain.doFilter(req,res); return; }
        long minute=System.currentTimeMillis()/60000;
        if(buckets.size()>10000) buckets.entrySet().removeIf(e->e.getValue().minute()<minute);
        String key=req.getRemoteAddr()+(path.startsWith("/api/auth/")?":auth":":public");
        Bucket b=buckets.compute(key,(k,old)->old==null || old.minute()!=minute?new Bucket(minute,1):new Bucket(minute,old.count()+1));
        int limit=path.startsWith("/api/auth/")?100:300;
        if(b.count()>limit) { res.setStatus(429); res.setHeader("Retry-After","60"); res.setContentType("application/json;charset=UTF-8"); res.getWriter().write("{\"code\":\"RATE_LIMITED\",\"message\":\"请求过于频繁，请稍后重试\"}"); return; }
        chain.doFilter(req,res);
    }
}
