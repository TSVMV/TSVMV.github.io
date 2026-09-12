---
title: Nginx讲解—高性能Web服务器架构与深度调优
date: 2026-09-12 15:00:00
categories: [运维, Web服务器]
tags: [Nginx, 性能调优, 反向代理, 负载均衡, 内核参数]
cover: /img/bg4.jpg
---

## Nginx 的架构本质

Nginx 的高性能不是偶然的，而是基于三个核心架构设计：

1. **事件驱动的异步非阻塞模型**：一个 worker 进程用 epoll 处理数万并发连接，不需要为每个连接创建线程
2. **多进程 + 单线程 worker**：master 进程管理 worker，worker 进程单线程处理请求，避免锁竞争
3. **请求处理阶段化**：把请求处理分成 11 个阶段（POST_READ、SERVER_REWRITE、FIND_CONFIG、REWRITE、POST_REWRITE、PREACCESS、ACCESS、POST_ACCESS、PRECONTENT、CONTENT、LOG），每个模块可以在不同阶段介入

理解 Nginx 的关键是理解**它为什么快**——不是因为它用了什么黑科技，而是因为它避免了传统 Web 服务器（Apache prefork）的性能杀手：线程/进程创建开销、上下文切换、锁竞争、阻塞 IO。

<!-- more -->

## 事件驱动模型深度解析

### worker 进程的工作循环

```
while (true) {
    // 1. 处理事件（epoll_wait 返回的就绪事件）
    events = epoll_wait(epfd, event_list, max_events, timeout);
    
    // 2. 逐个处理事件
    for each event in events:
        if (event is new connection):
            accept() → 创建新连接 → 注册到 epoll
        if (event is readable):
            读取请求 → 处理 → 生成响应
        if (event is writable):
            发送响应数据
        if (event is timer):
            处理超时事件
    
    // 3. 处理定时器（红黑树管理的定时器）
    expire_timers();
}
```

关键：worker 进程永远不会阻塞——所有 IO 都是非阻塞的，等待 IO 时可以处理其他连接。这就是为什么一个 worker 能处理数万并发连接。

### epoll 的优势

Nginx 在 Linux 上使用 epoll 作为事件通知机制。相比传统的 select/poll：

- **select**：最多 1024 个文件描述符，每次调用都要拷贝整个 fd 集合，O(n) 遍历
- **poll**：没有 1024 限制，但仍然是 O(n) 遍历
- **epoll**：用红黑树管理 fd，就绪事件用链表存储，O(1) 插入/删除，只返回就绪事件，不需要遍历所有 fd

epoll 的两个模式：
- **LT（Level Triggered，水平触发）**：只要 fd 就绪，每次 epoll_wait 都会返回。Nginx 默认用 LT，更安全
- **ET（Edge Triggered，边缘触发）**：只在状态变化时返回一次。性能更好，但需要一次性读完所有数据，否则可能丢失事件

### 惊群问题与解决

当多个 worker 进程都在监听同一个端口时，新连接到来会唤醒所有 worker（惊群），但只有一个能 accept 成功，其他被无谓唤醒。

Nginx 的解决：
1. **accept_mutex**（旧方案）：worker 进程竞争一个互斥锁，只有拿到锁的 worker 才把监听 fd 加入 epoll
2. **SO_REUSEPORT**（新方案，Linux 3.9+）：内核层面的负载均衡，每个 worker 绑定同一个端口，内核自动把连接分配给不同的 worker。性能更好，已成为默认

## 性能调优的层次

### 第一层：worker 进程与连接

```nginx
# worker 进程数，auto 等于 CPU 核心数
worker_processes auto;

# 绑定 CPU 核心（减少上下文切换和缓存失效）
worker_cpu_affinity auto;

# 每个 worker 的最大文件描述符
worker_rlimit_nofile 65535;

events {
    # 每个 worker 的最大并发连接数
    worker_connections 10240;
    
    # 使用 epoll
    use epoll;
    
    # 一次接受多个新连接
    multi_accept on;
}
```

最大并发连接数 = worker_processes × worker_connections。但实际能支撑的并发还受限于文件描述符限制和内存。

### 第二层：内核参数调优

```bash
# /etc/sysctl.conf

# 最大文件描述符
fs.file-max = 1000000

# 网络核心参数
net.core.somaxconn = 65535           # 监听队列长度
net.core.netdev_max_backlog = 65535   # 网络设备队列
net.core.rmem_default = 262144         # 接收缓冲区默认
net.core.rmem_max = 16777216           # 接收缓冲区最大
net.core.wmem_default = 262144         # 发送缓冲区默认
net.core.wmem_max = 16777216           # 发送缓冲区最大

# TCP 参数
net.ipv4.tcp_max_syn_backlog = 65535   # SYN 队列
net.ipv4.tcp_fin_timeout = 30           # FIN 超时
net.ipv4.tcp_tw_reuse = 1               # TIME_WAIT 复用
net.ipv4.ip_local_port_range = 1024 65535  # 本地端口范围
net.ipv4.tcp_rmem = 4096 87380 16777216   # TCP 接收缓冲区
net.ipv4.tcp_wmem = 4096 65536 16777216   # TCP 发送缓冲区
net.ipv4.tcp_mtu_probing = 1            # MTU 探测
net.ipv4.tcp_slow_start_after_idle = 0  # 空闲后不重新慢启动
net.core.default_qdisc = fq              # 队列调度算法（配合 BBR）
net.ipv4.tcp_congestion_control = bbr    # 拥塞控制算法
```

```bash
# 应用配置
sysctl -p

# 文件描述符限制（/etc/security/limits.conf）
* soft nofile 65535
* hard nofile 65535
```

### 第三层：HTTP 优化

```nginx
http {
    # 高效文件传输（零拷贝，sendfile）
    sendfile on;
    
    # 发送 TCP 包时合并小包（减少包数量）
    tcp_nopush on;
    
    # 禁用 Nagle 算法（减少延迟，配合 tcp_nopush）
    tcp_nodelay on;
    
    # 长连接超时
    keepalive_timeout 65;
    keepalive_requests 1000;  # 一个长连接最多处理的请求数
    
    # 客户端请求头超时
    client_header_timeout 10s;
    client_body_timeout 10s;
    
    # 发送响应超时
    send_timeout 10s;
    
    # 客户端请求体大小限制
    client_max_body_size 50m;
    
    # 哈希表大小（域名多时调大）
    server_names_hash_bucket_size 64;
    server_names_hash_max_size 2048;
    
    # MIME 类型
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
}
```

### 第四层：gzip / Brotli 压缩

```nginx
http {
    # gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;          # 压缩级别 1-9，6 是速度和压缩率的平衡
    gzip_min_length 1024;       # 小于 1KB 不压缩
    gzip_buffers 16 8k;
    gzip_http_version 1.1;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/json
        application/xml
        application/rss+xml
        image/svg+xml
        font/ttf
        font/otf;
    
    # Brotli 压缩（需要 ngx_brotli 模块，压缩率比 gzip 高 15-25%）
    # brotli on;
    # brotli_comp_level 6;
    # brotli_types text/plain text/css application/json application/javascript;
}
```

### 第五层：静态资源缓存

```nginx
server {
    # 图片缓存 30 天
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # CSS/JS 缓存 7 天
    location ~* \.(css|js)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # 字体缓存 30 天
    location ~* \.(woff|woff2|ttf|otf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # HTML 不缓存（动态内容）
    location ~* \.html$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

### 第六层：代理优化

```nginx
http {
    # 上游服务器（后端应用）
    upstream backend {
        # 负载均衡策略：least_conn（最少连接）、ip_hash、weight
        least_conn;
        
        server 10.0.0.1:8080 max_fails=3 fail_timeout=30s;
        server 10.0.0.2:8080 max_fails=3 fail_timeout=30s;
        server 10.0.0.3:8080 backup;  # 备用服务器
        
        # 长连接（Nginx 与后端之间保持长连接，减少握手开销）
        keepalive 32;
        keepalive_timeout 60s;
        keepalive_requests 1000;
    }
    
    server {
        location / {
            proxy_pass http://backend;
            
            # 代理 HTTP 版本（1.1 支持长连接）
            proxy_http_version 1.1;
            
            # 清除 Connection 头（否则长连接不生效）
            proxy_set_header Connection "";
            
            # 传递真实客户端信息
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # 超时设置
            proxy_connect_timeout 5s;    # 连接后端超时
            proxy_send_timeout 30s;       # 发送请求超时
            proxy_read_timeout 60s;       # 读取响应超时
            
            # 缓冲设置
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
            proxy_busy_buffers_size 8k;
            
            # 失败重试
            proxy_next_upstream error timeout http_500 http_502 http_503;
            proxy_next_upstream_tries 2;
        }
    }
}
```

### 第七层：SSL/TLS 优化

```nginx
server {
    listen 443 ssl http2;
    
    # 证书
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # 协议（禁用 SSLv3、TLS 1.0、1.1）
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # 加密套件（优先 ECDHE，支持前向保密）
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # SSL 会话缓存（减少握手开销）
    ssl_session_cache shared:SSL:10m;   # 10MB 缓存，约 40000 个会话
    ssl_session_timeout 1d;
    ssl_session_tickets off;              # 禁用会话票据（更安全）
    
    # OCSP Stapling（减少证书验证时间）
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 1.1.1.1 valid=300s;
    resolver_timeout 5s;
    
    # ECDH 曲线
    ssl_ecdh_curve X25519:prime256v1:secp384r1;
    
    # HSTS（强制 HTTPS）
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
}
```

## 高级功能

### 1. 限流

```nginx
http {
    # 按 IP 限流（10r/s，突发 20）
    limit_req_zone $binary_remote_addr zone=req_limit:10m rate=10r/s;
    
    # 按 IP 限制连接数
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
    
    server {
        location /api/ {
            limit_req zone=req_limit burst=20 nodelay;
            limit_conn conn_limit 20;
        }
    }
}
```

### 2. 访问控制

```nginx
server {
    # IP 黑白名单
    location /admin/ {
        allow 10.0.0.0/8;
        allow 192.168.0.0/16;
        deny all;
    }
    
    # 基础认证
    location /protected/ {
        auth_basic "Restricted";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
```

### 3. 缓存代理

```nginx
http {
    # 缓存路径和配置
    proxy_cache_path /var/cache/nginx
        levels=1:2
        keys_zone=my_cache:10m
        max_size=1g
        inactive=60m
        use_temp_path=off;
    
    server {
        location / {
            proxy_pass http://backend;
            proxy_cache my_cache;
            proxy_cache_valid 200 10m;    # 200 响应缓存 10 分钟
            proxy_cache_valid 404 1m;     # 404 缓存 1 分钟
            proxy_cache_use_stale error timeout updating http_500 http_502 http_503;
            proxy_cache_lock on;           # 防止缓存击穿
            add_header X-Cache-Status $upstream_cache_status;
        }
    }
}
```

### 4. WebSocket 代理

```nginx
server {
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;  # 24 小时，避免长连接断开
        proxy_send_timeout 86400;
    }
}
```

## 性能监控与诊断

### 1. stub_status 模块

```nginx
server {
    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
}
```

输出：
```
Active connections: 1234
server accepts handled requests
 56789 56789 123456
Reading: 10 Writing: 20 Waiting: 1204
```

- `Active connections`：当前活跃连接数
- `accepts`：总接受连接数
- `handled`：总处理连接数
- `requests`：总请求数
- `Reading`：正在读取请求头的连接
- `Writing`：正在发送响应的连接
- `Waiting`：保持长连接等待请求的连接

### 2. 关键指标监控

- **QPS（每秒请求数）**：`requests` 差值 / 时间
- **并发连接数**：`Active connections`
- **连接队列**：`ss -lnt` 中 Recv-Q 列
- **错误率**：5xx 响应占比
- **响应时间**：上游响应时间（`$upstream_response_time`）
- **带宽**：网络接口流量

### 3. 日志优化

```nginx
http {
    # 自定义日志格式（包含响应时间）
    log_format detailed '$remote_addr - $remote_user [$time_local] '
                        '"$request" $status $body_bytes_sent '
                        '"$http_referer" "$http_user_agent" '
                        'rt=$request_time uct="$upstream_connect_time" '
                        'uht="$upstream_header_time" urt="$upstream_response_time"';
    
    access_log /var/log/nginx/access.log detailed;
    
    # 静态资源不记录日志（减少 IO）
    location ~* \.(jpg|png|css|js)$ {
        access_log off;
    }
}
```

## 常见性能问题排查

### 1. 高 CPU 使用率

- 检查 worker_processes 是否等于 CPU 核心数
- 用 perf 火焰图分析 CPU 时间花在哪里
- 检查是否有过多的正则匹配（location 配置）
- 检查 SSL 握手开销（是否启用了会话缓存）

### 2. 高内存使用率

- 检查 worker_connections 是否过大（每个连接约占 10KB 内存）
- 检查 proxy_buffer_size / proxy_buffers 是否过大
- 检查缓存（proxy_cache）是否占用过多
- 检查是否有内存泄漏（长时间运行后内存持续增长）

### 3. 高延迟

- 检查上游响应时间（`$upstream_response_time`）
- 检查网络延迟（ping、mtr）
- 检查 DNS 解析时间（resolver 配置）
- 检查 SSL 握手时间（是否启用了 OCSP Stapling、会话缓存）
- 检查是否有磁盘 IO 瓶颈（静态文件读取）

### 4. 连接数打满

- 检查 worker_connections 是否足够
- 检查文件描述符限制（ulimit -n）
- 检查 keepalive_timeout 是否过长（长连接占用）
- 检查是否有慢客户端（发送/接收数据很慢，占用连接）

## Nginx 与其他 Web 服务器对比

| 特性 | Nginx | Apache (event MPM) | Caddy |
|------|-------|---------------------|-------|
| 架构 | 事件驱动，异步非阻塞 | 事件驱动，多线程 | 事件驱动，Go 协程 |
| 静态文件 | 极快 | 快 | 快 |
| 动态内容 | 需反向代理 | 可直接处理（mod_php） | 需反向代理 |
| 配置 | 复杂但灵活 | 复杂 | 简单（自动 HTTPS） |
| 模块 | 需编译时加载 | 运行时加载 | Go 插件 |
| 社区 | 最大 | 大 | 增长中 |

## 总结

Nginx 的高性能源于其事件驱动的异步非阻塞架构、多进程单线程 worker 设计、以及请求处理的阶段化模型。性能调优是一个系统性工程，需要从七个层次入手：worker 进程配置、内核参数、HTTP 优化、压缩、缓存、代理优化、SSL 优化。

调优的关键是**先找到瓶颈，再有针对性地调参数**。不要盲目复制网上的"最优配置"——不同的场景（静态文件、反向代理、API 网关、CDN 节点）有不同的最优配置。用数据说话，用监控验证，才能找到真正适合自己的配置。

Nginx 是一个功能极其丰富的 Web 服务器，本文覆盖了性能调优的核心内容，但还有很多高级功能（Lua 脚本、WAF、流量镜像、A/B 测试等）值得深入学习。掌握 Nginx 的原理和调优方法，是每个运维和后端开发者的必备技能。
