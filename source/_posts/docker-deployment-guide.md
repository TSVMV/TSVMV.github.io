---
title: Docker 容器化部署从入门到实战
date: 2026-09-12 14:00:00
categories: [运维, 容器化]
tags: [Docker, 容器, 运维, 部署, DevOps]
cover: /img/bg7.jpg
---

## 为什么要用 Docker

在没有容器的时代，部署一个应用意味着要在服务器上手动安装运行环境、配置依赖、处理端口冲突——"在我机器上能跑"是每个运维的噩梦。Docker 通过把应用及其依赖打包成一个标准化的镜像，解决了环境一致性问题。一次构建，到处运行。

Docker 的核心优势：

- **环境一致性**：开发、测试、生产环境完全一致
- **快速部署**：秒级启动，相比传统虚拟机快几个数量级
- **资源隔离**：容器之间互相隔离，互不影响
- **轻量高效**：共享宿主机内核，内存占用远低于虚拟机
- **版本管理**：镜像支持版本标签，回滚方便

<!-- more -->

## 核心概念

### 镜像（Image）

镜像是容器的只读模板，包含运行应用所需的一切：代码、运行时、库、环境变量、配置文件。镜像由多个层（Layer）组成，每层对应 Dockerfile 中的一条指令。这种分层设计使得镜像可以复用和缓存，构建速度快。

### 容器（Container）

容器是镜像的运行实例。你可以把镜像理解为类（Class），容器理解为对象（Object）——同一个镜像可以启动多个容器，它们之间互相隔离。容器本质上是宿主机上的一组进程，通过 Namespace 实现资源隔离，通过 Cgroups 实现资源限制。

### 仓库（Registry）

仓库是存储和分发镜像的地方。Docker Hub 是官方公共仓库，国内可以用阿里云容器镜像服务或网易云镜像加速。企业内部通常会搭建私有仓库（Harbor、Nexus）。

## 安装与配置

### Ubuntu / Debian 安装

```bash
# 卸载旧版本
sudo apt-get remove docker docker-engine docker.io containerd runc

# 安装依赖
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 设置稳定版仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 将当前用户加入 docker 组（免 sudo）
sudo usermod -aG docker $USER
```

### 配置镜像加速

国内访问 Docker Hub 速度较慢，配置镜像加速器：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com",
    "https://docker.mirrors.ustc.edu.cn"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

上面的配置同时限制了容器日志大小，避免日志撑爆磁盘。

## 常用命令速查

```bash
# 镜像操作
docker images                    # 列出本地镜像
docker pull nginx:latest         # 拉取镜像
docker rmi nginx:latest          # 删除镜像
docker build -t myapp:1.0 .      # 构建镜像

# 容器操作
docker ps                        # 列出运行中的容器
docker ps -a                     # 列出所有容器（包括已停止）
docker run -d -p 8080:80 --name web nginx  # 启动容器
docker stop web                  # 停止容器
docker start web                 # 启动已停止的容器
docker restart web               # 重启容器
docker rm web                    # 删除容器（需先停止）
docker rm -f web                 # 强制删除运行中的容器

# 进入容器
docker exec -it web /bin/bash    # 进入运行中的容器
docker logs -f web               # 查看容器日志（实时跟踪）
docker inspect web               # 查看容器详细信息
docker stats                     # 查看容器资源占用

# 数据与网络
docker volume create mydata      # 创建数据卷
docker network create mynet      # 创建自定义网络
```

## Dockerfile 编写实战

Dockerfile 是构建镜像的脚本，每条指令对应镜像的一个层。

### 一个 Node.js 应用的 Dockerfile

```dockerfile
# 第一阶段：构建阶段
FROM node:20-alpine AS builder
WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存
COPY package*.json ./
RUN npm ci --only=production

# 再复制源码
COPY . .
RUN npm run build

# 第二阶段：运行阶段（多阶段构建，减小镜像体积）
FROM node:20-alpine
WORKDIR /app

# 从构建阶段复制产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# 非 root 用户运行，提升安全性
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 编写要点

1. **利用缓存**：把变化频率低的指令（如安装依赖）放在前面，变化频率高的（如复制源码）放在后面
2. **多阶段构建**：构建工具和依赖不需要出现在最终镜像中，能大幅减小体积
3. **非 root 运行**：容器内不要用 root 用户运行应用，降低安全风险
4. **精简基础镜像**：优先用 alpine 版本，体积小、攻击面小
5. **清理缓存**：`apt-get install` 后执行 `rm -rf /var/lib/apt/lists/*`

### .dockerignore

和 .gitignore 类似，排除不需要进入构建上下文的文件：

```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
dist
*.log
```

## Docker Compose 多容器编排

当应用需要多个服务配合（比如 Web + 数据库 + 缓存），用 docker run 一个个启动太麻烦。Docker Compose 用一个 YAML 文件定义和管理多容器应用。

### docker-compose.yml 示例

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped
    networks:
      - appnet

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: appdb
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d appdb"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - appnet

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redisdata:/data
    restart: unless-stopped
    networks:
      - appnet

volumes:
  pgdata:
  redisdata:

networks:
  appnet:
    driver: bridge
```

### Compose 常用命令

```bash
docker compose up -d           # 后台启动所有服务
docker compose down            # 停止并删除所有容器
docker compose logs -f web     # 查看某个服务的日志
docker compose exec web bash   # 进入某个服务的容器
docker compose build           # 重新构建镜像
docker compose pull            # 拉取最新镜像
docker compose ps              # 查看服务状态
```

## 数据持久化

容器是无状态的，容器删除后数据就没了。需要持久化的数据要用数据卷（Volume）或绑定挂载（Bind Mount）。

### 数据卷（推荐）

```bash
# 创建数据卷
docker volume create mydata

# 使用数据卷启动容器
docker run -d -v mydata:/var/lib/mysql mysql:8
```

数据卷由 Docker 管理，存在宿主机的 `/var/lib/docker/volumes/` 目录下，支持跨容器共享和迁移。

### 绑定挂载

```bash
# 将宿主机目录挂载到容器
docker run -d -v /host/path:/container/path nginx
```

绑定挂载直接映射宿主机目录，适合需要在宿主机上直接编辑配置文件的场景（比如 Nginx 配置）。

## 网络模式

Docker 提供多种网络模式：

- **bridge（默认）**：容器连接到一个虚拟网桥，通过 NAT 访问外网，容器之间可以通过 IP 互通
- **host**：容器共享宿主机网络命名空间，性能最好但端口冲突
- **none**：容器没有网络，完全隔离
- **container**：共享另一个容器的网络命名空间

生产环境建议创建自定义 bridge 网络，容器之间可以用服务名互相访问（Docker 内置 DNS）：

```bash
docker network create mynet
docker run -d --name web --network mynet nginx
docker run -d --name api --network mynet node:20
# web 容器内可以直接用 http://api:3000 访问 api 容器
```

## 生产环境最佳实践

### 1. 资源限制

不给容器设置资源限制，一个容器的内存泄漏可能拖垮整台服务器：

```yaml
services:
  web:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 2. 健康检查

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### 3. 安全加固

- 镜像定期扫描漏洞（`docker scan`、Trivy）
- 容器以非 root 用户运行
- 敏感信息用环境变量或 Secrets 管理，不要硬编码在镜像里
- 只暴露必要的端口
- 启用 `--read-only` 根文件系统（应用不需要写文件时）

### 4. 日志管理

容器日志默认存在 `/var/lib/docker/containers/` 下，时间长了会占满磁盘。在 daemon.json 中限制日志大小，或者用 ELK / Loki 统一收集日志。

### 5. 镜像更新

定期更新基础镜像和依赖，修复安全漏洞。可以用 Watchtower 自动更新容器镜像：

```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --schedule "0 0 4 * * *" \
  --cleanup
```

## 常见问题排查

### 容器启动后立即退出

```bash
# 查看容器日志找原因
docker logs <container_id>

# 常见原因：
# 1. 前台进程退出了（Docker 容器需要前台进程保持运行）
# 2. 配置文件错误
# 3. 端口被占用
```

### 无法连接到容器端口

```bash
# 检查端口映射
docker port <container_id>

# 检查容器内服务是否真的在监听
docker exec <container_id> netstat -tlnp

# 检查防火墙
sudo ufw status
```

### 镜像构建慢

- 检查 .dockerignore 是否排除了 node_modules 等大目录
- 利用构建缓存，依赖安装指令放在前面
- 用 BuildKit 加速：`DOCKER_BUILDKIT=1 docker build .`

## 总结

Docker 已经成为现代应用部署的标准工具。掌握 Dockerfile 编写、Docker Compose 编排、数据持久化、网络配置和生产环境最佳实践，就能应对绝大多数部署场景。

下一步可以学习 Kubernetes（K8s）——当容器数量多到需要自动扩缩容、服务发现、滚动更新时，K8s 就是答案。但在那之前，把 Docker 用扎实是基础中的基础。
