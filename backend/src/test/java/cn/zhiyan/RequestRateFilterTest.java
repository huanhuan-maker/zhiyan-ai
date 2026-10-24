package cn.zhiyan;

import cn.zhiyan.security.RequestRateFilter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import static org.assertj.core.api.Assertions.assertThat;

class RequestRateFilterTest {
    @Test void burstIsRateLimitedAndUntrustedForwardedHeaderDoesNotBypassIt() throws Exception {
        var filter=new RequestRateFilter();
        for(int i=0;i<101;i++) {
            var req=new MockHttpServletRequest("POST","/api/auth/login"); req.setRemoteAddr("192.0.2.1"); req.addHeader("X-Forwarded-For","198.51.100."+i);
            var res=new MockHttpServletResponse(); filter.doFilter(req,res,(request,response)->((jakarta.servlet.http.HttpServletResponse)response).setStatus(204));
            assertThat(res.getStatus()).isEqualTo(i<100?204:429);
            if(i==100) assertThat(res.getHeader("Retry-After")).isEqualTo("60");
        }
    }
}
