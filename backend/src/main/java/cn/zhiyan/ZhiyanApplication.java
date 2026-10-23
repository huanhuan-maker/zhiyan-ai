package cn.zhiyan;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("cn.zhiyan.mapper")
public class ZhiyanApplication {
    public static void main(String[] args) { SpringApplication.run(ZhiyanApplication.class, args); }
}
