package cn.zhiyan.service;

import cn.zhiyan.entity.UserAccount;
import cn.zhiyan.mapper.UserAccountMapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;

@Service
public class AccountService implements ApplicationRunner {
    private final UserAccountMapper mapper;
    private final String bootstrapName, bootstrapPassword;
    public AccountService(UserAccountMapper mapper, @Value("${app.admin.username}") String name,
                          @Value("${app.admin.password}") String password) {
        this.mapper=mapper; this.bootstrapName=name; this.bootstrapPassword=password;
    }
    @Override public void run(ApplicationArguments args) {
        if(bootstrapName.isBlank() || bootstrapPassword.length()<12) throw new IllegalArgumentException("Configure APP_ADMIN_USER and 12+ character APP_ADMIN_PASSWORD");
        if(find(bootstrapName)==null) register(bootstrapName,bootstrapPassword);
    }
    public UserAccount find(String name) { return mapper.selectOne(Wrappers.<UserAccount>lambdaQuery().eq(UserAccount::getUsername,name)); }
    public long userId(String name) {
        var user=find(name); if(user==null) throw new BusinessException(401,"UNAUTHENTICATED","请重新登录");
        return user.getId();
    }
    @Transactional public void register(String name,String password) {
        if(password.getBytes(StandardCharsets.UTF_8).length>72) throw new BusinessException(400,"INVALID_PASSWORD","密码 UTF-8 长度不能超过 72 字节");
        if(find(name)!=null) throw new BusinessException(409,"USERNAME_TAKEN","用户名已存在");
        var row=new UserAccount(); row.setUsername(name);
        row.setPasswordHash("{bcrypt}"+new BCryptPasswordEncoder().encode(password)); mapper.insert(row);
    }
}
