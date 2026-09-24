---
title: vllixn：一条命令给 Linux 主机做安全体检
date: 2026-09-25 11:30:00
categories: [运维开发]
tags: [Linux, 安全, 运维, 蓝队, 基线]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg55.jpg
---

管服务器的时候，经常需要快速判断一台机器安不安全。网上的基线检查工具不少，但要么依赖一堆第三方库，要么输出英文报告看不懂，要么会偷偷改你系统配置。

vllixn 是我写的只读 Linux 主机安全体检工具。一条命令跑完，输出中文报告、分类雷达图和 0-100 评分。

<!-- more -->

## 检查范围

九大分类，覆盖 Linux 主机安全的主要面：

账户：UID 0 别名、空口令、系统账户可登录 shell、重复 UID、sudo NOPASSWD、authorized_keys 权限、口令有效期、默认 umask、PAM 口令复杂度、登录失败锁定。

SSH：root 登录、口令认证、空口令、端口转发、X11 转发、MaxAuthTries、协议 1、LoginGraceTime、ClientAliveInterval、登录用户范围、HostbasedAuthentication。含 Include 子配置的解析。

文件权限：/etc/passwd、shadow、sudoers 等敏感文件的权限检查，系统目录和家目录全局可写，高风险 SUID/SGID。

网络：对外监听端口（明文协议和数据服务单独定级），nftables/iptables/ufw/firewalld 活动规则。

服务：systemd 开机启用的高风险服务，/etc/rc.local，cron/at 访问控制。

内核：网络加固（syncookies、IPv6 重定向）、信息泄露、ASLR、文件系统保护，四组 sysctl 参数。

补丁：依据 apt/dnf 更新日志判断超过 60 天未安装更新。

启动：GRUB 配置权限、高危内核模块黑名单、core dump 限制。

审计：SELinux/AppArmor 运行状态、auditd、时间同步、日志持久化。

## 评分

每个未通过项按严重程度扣分：严重 -25、高 -12、中 -5、低 -2，下限 0 分。

等级：90 优秀 / 75 良好 / 60 一般 / 40 较差 / 其余危险。

跳过的检查项不计分。HTML 报告额外提供各分类独立雷达图，一眼看出短板在哪。

## 只读

全程只读，不写任何系统配置。只读取文件元数据和白名单内的只读命令（ss、sysctl、systemctl、nft、iptables、ufw、firewall-cmd、getenforce、auditctl、timedatectl 等）。

非 root 也能跑，需要读 /etc/shadow、防火墙规则的检查会标记为跳过并说明原因。

## 基线对比

可以和上一次报告对比，看哪些问题是新增的、哪些已经修了。持续跟踪加固进展很方便。

```bash
# 本机体检
vllixn

# 导出 HTML 报告（含雷达图，纯 SVG 无 JS）
vllixn --html report.html

# 忽略误报项
vllixn --ignore ssh.x11_forwarding

# 与上次报告对比
vllixn --baseline last.json --html now.html

# 对挂载的镜像目录做离线分析
vllixn --root /mnt/target-image
```

纯 Python 标准库，零第三方依赖。pip install vllixn 就能用。

项目地址：[github.com/TSVMV/vllixn](https://github.com/TSVMV/vllixn)。
