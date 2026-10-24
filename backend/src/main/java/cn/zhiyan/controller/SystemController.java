package cn.zhiyan.controller;

import java.util.*;
import org.springframework.web.bind.annotation.*;

/** Local-machine network facts for owners configuring LAN share links. Login required; read-only. */
@RestController @RequestMapping("/api/system")
public class SystemController {
    @GetMapping("/lan-addresses") public Map<String,Object> lanAddresses() { return Map.of("addresses", lanIpv4()); }
    static List<String> lanIpv4() {
        List<String> out=new ArrayList<>();
        try {
            for(var networks=java.net.NetworkInterface.getNetworkInterfaces(); networks.hasMoreElements(); ) {
                var network=networks.nextElement();
                if(!network.isUp()||network.isLoopback()) continue;
                for(var addresses=network.getInetAddresses(); addresses.hasMoreElements(); ) {
                    var address=addresses.nextElement();
                    if(address instanceof java.net.Inet4Address && !address.isLoopbackAddress() && !address.isLinkLocalAddress())
                        out.add(address.getHostAddress());
                }
            }
        } catch(java.net.SocketException ex) { /* keep whatever was enumerated before the failure */ }
        Collections.sort(out);
        return out;
    }
}
