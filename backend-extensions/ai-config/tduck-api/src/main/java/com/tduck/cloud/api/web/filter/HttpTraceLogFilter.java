package com.tduck.cloud.api.web.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.web.filter.OncePerRequestFilter;
import javax.servlet.*;
import javax.servlet.http.*;
import java.io.IOException;

/** Safe replacement for upstream optional tracing. Never read credentials or bodies. */
@Slf4j
public class HttpTraceLogFilter extends OncePerRequestFilter implements Ordered {
    @Override public int getOrder(){return LOWEST_PRECEDENCE-10;}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException {
        long start=System.nanoTime();
        try {chain.doFilter(request,response);}
        finally {
            String path=request.getRequestURI().replaceAll("[\\r\\n]","");
            if(path.length()>240)path=path.substring(0,240);
            log.info("HTTP {} {} status={} elapsedMs={}",request.getMethod(),path,response.getStatus(),(System.nanoTime()-start)/1000000);
        }
    }
}
