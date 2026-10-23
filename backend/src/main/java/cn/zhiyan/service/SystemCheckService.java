package cn.zhiyan.service;

import cn.zhiyan.dto.CheckDtos;
import cn.zhiyan.entity.SystemCheck;
import cn.zhiyan.mapper.SystemCheckMapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SystemCheckService {
    private final SystemCheckMapper mapper;
    public SystemCheckService(SystemCheckMapper mapper) { this.mapper = mapper; }
    @Transactional
    public CheckDtos.View create(String message) {
        var row = new SystemCheck();
        row.setMessage(message.strip());
        mapper.insert(row);
        return view(mapper.selectById(row.getId()));
    }
    public List<CheckDtos.View> latest() {
        return mapper.selectList(Wrappers.<SystemCheck>lambdaQuery()
                .orderByDesc(SystemCheck::getId).last("LIMIT 20")).stream().map(this::view).toList();
    }
    public long count() { return mapper.selectCount(null); }
    private CheckDtos.View view(SystemCheck row) {
        return new CheckDtos.View(row.getId(), row.getMessage(), row.getCreatedAt());
    }
}
