package cn.zhiyan.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;

public final class SurveyDtos {
    private SurveyDtos() { }
    public enum Type { SINGLE, MULTIPLE, SCALE, OPEN }
    public record Option(@NotBlank @Pattern(regexp="[a-zA-Z0-9_-]{1,64}") String id,
                         @NotBlank @Size(max=200) String label) { }
    public record Question(@NotBlank @Pattern(regexp="[a-zA-Z0-9_-]{1,64}") String id,
                           @NotNull Type type, @NotBlank @Size(max=500) String text,
                           boolean required, boolean allowFollowup,
                           @NotNull @Size(max=30) List<@NotNull @Valid Option> options,
                           @Min(0) @Max(100) Integer min, @Min(1) @Max(100) Integer max) { }
    public record Draft(@NotBlank @Size(max=150) String title,
                        @NotNull @Size(max=2000) String description,
                        @NotBlank @Size(max=2000) String privacyNotice,
                        @NotNull @Size(min=1,max=50) List<@NotNull @Valid Question> questions,
                        @Min(0) @Max(3) int perQuestionFollowupLimit,
                        @Min(0) @Max(10) int totalFollowupLimit) { }
    public record Update(@NotNull @Valid Draft draft, @Min(1) int revision) { }
    public record Consent(@AssertTrue boolean consent, boolean aiConsent) { }
    public record AnswerInput(@NotBlank @Size(max=64) String questionId, @NotNull JsonNode value) { }
    public record Complete(@NotNull @Size(max=50) Map<String, JsonNode> answers) { }
    public record Credentials(@NotBlank @Pattern(regexp="[a-zA-Z0-9_-]{3,60}") String username,
                              @NotBlank @Size(min=12,max=72) String password) { }
}
