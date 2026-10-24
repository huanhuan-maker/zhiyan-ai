package cn.zhiyan.controller;

import cn.zhiyan.dto.SurveyDtos.*;
import cn.zhiyan.service.SurveyService;
import cn.zhiyan.service.ResultsService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/surveys")
public class SurveyController {
    private final SurveyService service; private final ResultsService results;
    public SurveyController(SurveyService service,ResultsService results) { this.service=service; this.results=results; }
    @GetMapping public Object list(Principal p) { return service.list(p.getName()); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public Object create(@Valid @RequestBody Draft body,Principal p) { return service.create(body,p.getName()); }
    @GetMapping("/{id}") public Object detail(@PathVariable long id,Principal p) { return service.detail(id,p.getName()); }
    @PutMapping("/{id}") public Object update(@PathVariable long id,@Valid @RequestBody Update body,Principal p) { return service.update(id,body,p.getName()); }
    public record Publish(int revision) { }
    @PostMapping("/{id}/publish") public Object publish(@PathVariable long id,@RequestBody Publish body,Principal p) { return service.publish(id,body.revision(),p.getName()); }
    @PostMapping("/{id}/close") public Object close(@PathVariable long id,Principal p) { return service.close(id,p.getName()); }
    @GetMapping("/{id}/results") public Object results(@PathVariable long id,@RequestParam long versionId,Principal p) { return results.results(id,versionId,p.getName()); }
}
