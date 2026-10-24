package cn.zhiyan.controller;

import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import cn.zhiyan.service.BusinessException;
import org.springframework.dao.DuplicateKeyException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(BusinessException.class)
    ResponseEntity<Map<String,Object>> business(BusinessException ex) {
        Map<String,Object> body=new java.util.LinkedHashMap<>();
        body.put("code",ex.getCode()); body.put("message",ex.getMessage()); body.putAll(ex.getDetails());
        return ResponseEntity.status(ex.getStatus()).body(body);
    }
    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<Map<String,String>> duplicate(DuplicateKeyException ex) {
        return ResponseEntity.status(409).body(Map.of("code","CONFLICT","message","记录已存在，请刷新后重试"));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
            org.springframework.web.bind.MissingServletRequestParameterException.class})
    ResponseEntity<Map<String, String>> invalid(Exception ex) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_INPUT", "message", "输入格式或长度不符合要求，请检查必填项与取值范围"));
    }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<Map<String, String>> database(DataAccessException ex) {
        return ResponseEntity.status(503).body(Map.of("code", "DATABASE_UNAVAILABLE", "message", "MySQL 不可用，请检查服务与连接配置"));
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> unexpected(Exception ex) {
        return ResponseEntity.internalServerError().body(Map.of("code", "INTERNAL_ERROR", "message", "服务发生错误，请联系维护者"));
    }
}
