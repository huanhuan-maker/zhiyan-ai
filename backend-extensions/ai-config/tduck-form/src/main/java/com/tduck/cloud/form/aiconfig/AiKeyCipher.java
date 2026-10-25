package com.tduck.cloud.form.aiconfig;

import com.tduck.cloud.common.exception.BaseException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.*;

@Component
public class AiKeyCipher {
    private final String path;
    public AiKeyCipher(@Value("${ai.config-key-file:./ai-config.key}") String path) { this.path = path; }
    private byte[] key() throws Exception {
        byte[] value = Base64.getDecoder().decode(new String(Files.readAllBytes(Paths.get(path)), StandardCharsets.US_ASCII).trim());
        if (value.length != 32) throw new IllegalArgumentException();
        return value;
    }
    public String encrypt(String text) {
        try {
            byte[] iv = new byte[12]; new SecureRandom().nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key(), "AES"), new GCMParameterSpec(128, iv));
            byte[] encrypted = c.doFinal(text.getBytes(StandardCharsets.UTF_8));
            byte[] all = Arrays.copyOf(iv, iv.length + encrypted.length);
            System.arraycopy(encrypted, 0, all, iv.length, encrypted.length);
            return Base64.getEncoder().encodeToString(all);
        } catch (Exception e) { throw new BaseException("无法加密模型密钥，请检查服务端 ai-config.key，未保存配置"); }
    }
    public String decrypt(String text) {
        if (text == null || text.isEmpty()) return "";
        try {
            byte[] all = Base64.getDecoder().decode(text);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key(), "AES"), new GCMParameterSpec(128, Arrays.copyOf(all, 12)));
            return new String(c.doFinal(Arrays.copyOfRange(all, 12, all.length)), StandardCharsets.UTF_8);
        } catch (Exception e) { throw new BaseException("无法读取模型密钥，请恢复对应的服务端加密文件或重新填写API Key"); }
    }
}
