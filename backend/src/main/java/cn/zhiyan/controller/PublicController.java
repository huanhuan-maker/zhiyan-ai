package cn.zhiyan.controller;

import cn.zhiyan.dto.SurveyDtos.*;
import cn.zhiyan.service.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/public")
public class PublicController {
    private final SurveyService surveys; private final ResponseService responses;
    public PublicController(SurveyService surveys,ResponseService responses) { this.surveys=surveys; this.responses=responses; }
    @GetMapping("/surveys/{token}") public Object survey(@PathVariable String token) { return surveys.publicSurvey(token); }
    @PostMapping("/surveys/{token}/sessions") @ResponseStatus(HttpStatus.CREATED) public Object start(@PathVariable String token,@Valid @RequestBody Consent input) { return responses.start(token,input); }
    @GetMapping("/sessions/{token}") public Object restore(@PathVariable String token) { return responses.restore(token); }
    @PostMapping("/sessions/{token}/answers") public Object answer(@PathVariable String token,@Valid @RequestBody AnswerInput input) { return responses.answer(token,input); }
    @PostMapping("/sessions/{token}/complete") public Object complete(@PathVariable String token,@Valid @RequestBody Complete input) { return responses.complete(token,input); }
}
