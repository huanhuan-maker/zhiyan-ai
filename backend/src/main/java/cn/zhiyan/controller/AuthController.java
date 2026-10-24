package cn.zhiyan.controller;

import java.security.Principal;
import java.util.Map;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import cn.zhiyan.service.AccountService;
import cn.zhiyan.dto.SurveyDtos;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AccountService accounts;
    public AuthController(AccountService accounts) { this.accounts=accounts; }
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,String> register(@Valid @RequestBody SurveyDtos.Credentials body) {
        accounts.register(body.username(),body.password()); return Map.of("username",body.username());
    }
    @GetMapping("/csrf") public Map<String, String> csrf(CsrfToken token) {
        return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
    }
    @GetMapping("/me") public Map<String, String> me(Principal principal) {
        return Map.of("username", principal.getName(), "role", "RESEARCHER");
    }
}
