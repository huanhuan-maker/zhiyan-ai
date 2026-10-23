package cn.zhiyan.controller;

import cn.zhiyan.dto.CheckDtos;
import cn.zhiyan.service.SystemCheckService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/system-checks")
public class SystemCheckController {
    private final SystemCheckService service;
    public SystemCheckController(SystemCheckService service) { this.service = service; }
    @GetMapping public List<CheckDtos.View> latest() { return service.latest(); }
    @GetMapping("/summary") public Map<String, Long> summary() { return Map.of("count", service.count()); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public CheckDtos.View create(@Valid @RequestBody CheckDtos.Create body) { return service.create(body.message()); }
}
