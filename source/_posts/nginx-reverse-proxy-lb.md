---
title: Nginx 反向代理与负载均衡实战
date: 2026-09-12 15:00:00
categories: [运维, Web服务器]
tags: [Nginx, 反向代理, 负载均衡, 运维, HTTPS]
cover: /img/bg8.jpg
---

## Nginx 是什么

Nginx（发音 engine-x）是一个高性能的 HTTP 和反向代理服务器，由 Igor Sysoev 于 2004 年发布。它以事件驱动的异步非阻塞架构著称，能在单机上支撑数万甚至数十万的并发连接，是目前全球使用最广泛的 Web 服务器之一。

Nginx 的典型用途：

- **静态文件服务**：直接提供 HTML、CSS、JS、图片等静态资源
- **反向代理**：把请求转发给后端应用服务器（Node.js、Python、Java 等）
- **负载均衡**：把流量分发到多个后端实例
- **HTTPS 终端**：SSL/TLS 卸载，后端不用管加密
- **缓存**：缓存静态资源和后端响应，减轻后端压力
- **限流与访问控制**：限制请求速率、IP 黑白名单

<!-- more -->

## 安装与基础配置

### Ubuntu 安装

```bash
sudo apt-get update
sudo apt-get install nginx

# 管理服务
sudo systemctl start nginx
sudo systemctl enable nginx    # 开机自启
sudo systemctl reload nginx    # 重载配置（不中断服务）
sudo nginx -t                   # 测试配置文件语法
```

### 配置文件结构

```
/etc/nginx/
├── nginx.conf              # 主配置文件
├── conf.d/                 # 额外配置目录（*.conf 会被自动包含）
├── sites-available/        # 可用站点配置
└── sites-enabled/          # 已启用站点（通常是 sites-available 的软链接）
```

主配置文件 `nginx.conf` 的核心结构：

```nginx
user www-data;
worker_processes auto;          # 工作进程数，auto 等于 CPU 核心数
pid /run/nginx.pid;

events {
    worker_connections 1024;   # 每个工作进程的最大连接数
    use epoll;                  # Linux 下用 epoll 事件模型
    multi_accept on;            # 一次接受多个新连接
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    sendfile on;                # 高效文件传输
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;      # 长连接超时
    gzip on;                    # 开启 gzip 压缩

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

## 反向代理

反向代理是 Nginx 最常用的功能。客户端请求 Nginx，Nginx 把请求转发给后端服务，再把响应返回给客户端。客户端不知道后端服务的存在，Nginx 是唯一的入口。

### 基础反向代理配置

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;   # 后端服务地址
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 关键代理头说明

| 头 | 作用 |
|----|------|
| `Host` | 原始请求的主机名，后端需要用它做虚拟主机匹配 |
| `X-Real-IP` | 客户端真实 IP |
| `X-Forwarded-For` | 经过的代理链，每经过一个代理追加一个 IP |
| `X-Forwarded-Proto` | 原始请求协议（http/https），后端据此生成正确的 URL |

### 代理超时与缓冲

```nginx
location / {
    proxy_pass http://backend;

    # 超时设置
    proxy_connect_timeout 10s;    # 连接后端超时
    proxy_send_timeout 30s;        # 发送请求给后端超时
    proxy_read_timeout 60s;        # 读取后端响应超时

    # 缓冲设置
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;

    # 大文件上传
    client_max_body_size 50m;
}
```

### WebSocket 代理

WebSocket 需要特殊配置，因为它是长连接且协议会升级：

```nginx
location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;     # 24小时，避免长连接被断开
}
```

## 负载均衡

当单个后端实例扛不住流量时，就需要负载均衡把请求分发到多个实例。

### 基础配置

```nginx
upstream backend_servers {
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
    server 192.168.1.12:3000;
}

server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://backend_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 负载均衡策略

#### 1. 轮询（默认）

请求按顺序轮流分配到每个后端，适合后端实例性能相近的场景。

#### 2. 加权轮询

性能好的机器分配更多请求：

```nginx
upstream backend {
    server 192.168.1.10:3000 weight=3;   # 3/6 的请求
    server 192.168.1.11:3000 weight=2;   # 2/6
    server 192.168.1.12:3000 weight=1;   # 1/6
}
```

#### 3. ip_hash

同一个客户端 IP 的请求始终发到同一个后端，解决会话保持问题（但不推荐，因为客户端 IP 可能变化，且负载不均）：

```nginx
upstream backend {
    ip_hash;
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
}
```

更好的会话保持方案是用 Redis 等集中式存储共享会话，而不是依赖负载均衡。

#### 4. least_conn

把请求发给当前活跃连接数最少的后端，适合请求处理时间差异大的场景：

```nginx
upstream backend {
    least_conn;
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
}
```

### 健康检查与故障转移

```nginx
upstream backend {
    server 192.168.1.10:3000 max_fails=3 fail_timeout=30s;
    server 192.168.1.11:3000 max_fails=3 fail_timeout=30s backup;
    server 192.168.1.12:3000 down;
}
```

- `max_fails=3`：30 秒内失败 3 次就标记为不可用
- `fail_timeout=30s`：不可用状态持续 30 秒后重新尝试
- `backup`：备用服务器，只有主服务器都不可用时才启用
- `down`：标记为下线，不参与负载

注意：Nginx 开源版的健康检查是被动的（根据请求失败判断），主动健康检查（定期发探测请求）需要 Nginx Plus 商业版，或者用第三方模块。

## HTTPS 配置

### 用 Let's Encrypt 免费证书

```bash
# 安装 certbot
sudo apt-get install certbot python3-certbot-nginx

# 自动获取证书并配置 Nginx
sudo certbot --nginx -d example.com -d www.example.com

# 自动续期（certbot 会自动添加定时任务）
sudo certbot renew --dry-run   # 测试续期
```

### 手动配置 HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS（强制 HTTPS，谨慎开启）
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
```

## 静态资源优化

### gzip 压缩

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;          # 压缩级别 1-9，6 是速度和压缩率的平衡
gzip_min_length 1024;       # 小于 1KB 的文件不压缩
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
```

### 静态文件缓存

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|svg|webp)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}

location ~* \.(css|js)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
}

location ~* \.(woff|woff2|ttf|otf|eot)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 静态文件服务

```nginx
server {
    listen 80;
    server_name static.example.com;
    root /var/www/static;

    location / {
        try_files $uri $uri/ =404;
        autoindex off;
    }
}
```

## 安全加固

### 隐藏版本号

```nginx
server_tokens off;    # 隐藏 Nginx 版本号
```

### 限制请求方法

```nginx
if ($request_method !~ ^(GET|HEAD|POST|PUT|DELETE)$) {
    return 405;
}
```

### 防止 DDoS / 限流

```nginx
# 限制每个 IP 的连接数
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
limit_conn conn_limit 20;

# 限制请求速率（每秒 10 个请求，突发 20 个）
limit_req_zone $binary_remote_addr zone=req_limit:10m rate=10r/s;
limit_req zone=req_limit burst=20 nodelay;
```

### IP 黑白名单

```nginx
# 白名单
location /admin {
    allow 192.168.1.0/24;
    allow 10.0.0.0/8;
    deny all;
}

# 黑名单
location / {
    deny 192.168.1.100;
    allow all;
}
```

## 性能调优

### worker 进程与连接

```nginx
worker_processes auto;           # 等于 CPU 核心数
worker_cpu_affinity auto;        # 绑定 CPU 核心，减少上下文切换
worker_rlimit_nofile 65535;      # 每个 worker 的最大文件描述符

events {
    worker_connections 10240;    # 每个 worker 的最大连接数
    use epoll;
    multi_accept on;
}
```

最大并发连接数 = worker_processes × worker_connections。

### 系统级调优

`/etc/sysctl.conf`：

```conf
# 最大文件描述符
fs.file-max = 1000000

# TCP 优化
net.ipv4.tcp_max_syn_backlog = 65535
net.core.netdev_max_backlog = 65535
net.core.somaxconn = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535

# 缓冲区
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144
net.core.wmem_max = 16777216
```

执行 `sudo sysctl -p` 生效。

## 常用运维命令

```bash
nginx -t                    # 测试配置文件语法
nginx -s reload             # 平滑重载配置
nginx -s reopen             # 重新打开日志文件
nginx -s stop               # 快速停止
nginx -s quit               # 优雅停止（处理完当前请求）

# 查看实时连接状态
netstat -an | grep :80 | wc -l

# 查看 Nginx 状态（需开启 stub_status）
curl http://localhost/nginx_status
```

开启状态监控：

```nginx
location /nginx_status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    deny all;
}
```

## 常见问题

### 502 Bad Gateway

Nginx 能连接但后端没有响应，常见原因：
- 后端服务挂了
- 后端服务端口不对
- 防火墙阻止了 Nginx 到后端的连接
- 后端处理太慢，超时了

### 504 Gateway Timeout

Nginx 等后端响应超时，增大 `proxy_read_timeout`，或者优化后端性能。

### 413 Request Entity Too Large

上传文件超过了 `client_max_body_size` 限制，调大这个值。

### 静态文件 404

检查 `root` 或 `alias` 配置是否正确，文件路径是否存在，权限是否正确。

## 总结

Nginx 是运维和后端开发的必备技能。掌握反向代理、负载均衡、HTTPS、静态资源优化、安全加固和性能调优，就能搭建出高性能、高可用的 Web 服务入口。

Nginx 的配置虽然看起来多，但核心逻辑很清晰：`http` 块定义全局，`server` 块定义虚拟主机，`location` 块定义 URL 匹配规则。理解了这个三层结构，再查文档就能应对绝大多数场景。
