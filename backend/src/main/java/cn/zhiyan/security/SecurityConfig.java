package cn.zhiyan.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import jakarta.servlet.http.HttpServletResponse;

@Configuration
public class SecurityConfig {
    @Bean InMemoryUserDetailsManager users(@Value("${app.admin.username}") String username,
                                          @Value("${app.admin.password}") String password) {
        if (username.isBlank() || password.length() < 12) {
            throw new IllegalArgumentException("APP_ADMIN_USER must be set and APP_ADMIN_PASSWORD must contain at least 12 characters");
        }
        return new InMemoryUserDetailsManager(User.withUsername(username)
                .password("{bcrypt}" + new BCryptPasswordEncoder().encode(password)).roles("RESEARCHER").build());
    }
    @Bean SecurityFilterChain security(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/api/auth/csrf", "/api/auth/login", "/error").permitAll()
                .requestMatchers("/api/**").hasRole("RESEARCHER").anyRequest().denyAll())
            .formLogin(form -> form.loginProcessingUrl("/api/auth/login")
                .successHandler((req, res, auth) -> res.setStatus(HttpServletResponse.SC_NO_CONTENT))
                .failureHandler((req, res, ex) -> json(res, 401, "INVALID_CREDENTIALS", "用户名或密码错误")))
            .logout(logout -> logout.logoutUrl("/api/auth/logout")
                .logoutSuccessHandler((req, res, auth) -> res.setStatus(HttpServletResponse.SC_NO_CONTENT)))
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((req, res, ex) -> json(res, 401, "UNAUTHENTICATED", "请先登录"))
                .accessDeniedHandler((req, res, ex) -> json(res, 403, "FORBIDDEN", "权限不足或 CSRF 校验失败")));
        return http.build(); // Session fixation protection and CSRF remain enabled.
    }
    private static void json(HttpServletResponse res, int status, String code, String message) throws java.io.IOException {
        res.setStatus(status);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
