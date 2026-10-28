package com.tduck.cloud.form.aiconfig;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;
import java.util.*;

/** Private persistence DTO. Never return this object directly from an API. */
@Getter @Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiSettings {
    private int revision;
    private boolean enabled;
    private String defaultModelId;
    private List<Provider> providers = new ArrayList<>();

    @Getter @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Provider {
        private String id;
        private String name;
        private String protocol = "OPENAI_CHAT";
        private String baseUrl;
        private String apiKey;
        private String encryptedKey;
        private boolean clearApiKey;
        private int timeoutMs = 60000;
        private String outputTokenParameter = "max_completion_tokens";
        private List<Model> models = new ArrayList<>();
    }

    @Getter @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Model {
        private String id;
        private String name;
        private String modelId;
        private String reasoningEffort = "auto";
        private int contextWindow = 32768;
        private int maxOutputTokens = 8192;
        private int historyTurns = 6;
    }
}
