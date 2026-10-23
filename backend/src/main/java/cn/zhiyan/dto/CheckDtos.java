package cn.zhiyan.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public final class CheckDtos {
    private CheckDtos() { }
    public record Create(@NotBlank @Size(max = 200) String message) { }
    public record View(Long id, String message, LocalDateTime createdAt) { }
}
