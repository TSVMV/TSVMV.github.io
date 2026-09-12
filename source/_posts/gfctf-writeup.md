---
title: GFCTF WP
date: 2026-09-11 21:00:00
categories: [CTF]
tags: [CTF]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/banner3.jpg
---

## 比赛概况

参加了 **GFCTF** 网络安全夺旗赛，所在队伍 **vov** 最终排名 **#21**。

本次比赛共解出 **12 道题**，覆盖 Web、Pwn、Reverse、Crypto 四个方向：

| 方向 | 解题数 | 题目 |
|------|--------|------|
| **Web** | 2 | Object Loader、Template Factory |
| **Pwn** | 3 | ZSCC、Keysafe、BABYPWN |
| **Reverse** | 2 | just_sm4、Quick_Js |
| **Crypto** | 5 | BabyRSA、Reused Keystream、Predictable、Twice、Leaky Prime |

<!-- more -->

## 部分题目考点速览

### Web

**Object Loader** — Spring Boot Java 反序列化
- 核心入口 `POST /api/import`，接收 Base64 编码的 Java 序列化对象
- 黑名单绕过：`SafeObjectInputStream` 过滤了 `InvokerTransformer`、`Runtime`、`ProcessBuilder` 等关键类
- 利用链：**CC3 链（InstantiateTransformer）** + **CC6 链（HashSet）** 触发
- 关键技巧：在恶意字节码的 `static{}` 块中读取 `/flag` 文件，包装为 `RuntimeException` 抛出，最终在 HTTP 错误响应中回显 Flag

**Template Factory** — Flask + Jinja2 SSTI
- `/render?tpl=` 端点存在服务端模板注入
- 严格 WAF 过滤了大量关键字和关键字符
- 绕过技巧：
  - 从 `(request|string)` 中提取字符，用 `~` 拼接任意字符串
  - 负数索引从字符串末尾计数，注入 URL 查询参数获取缺失字符
  - `|attr(var)` 变量化绕过 WAF（WAF 只检查字面关键字）
  - `dict[变量]` 变量化方括号访问
  - `|map(attribute=var)` 利用 Jinja2 属性查找机制

### Pwn

- **ZSCC** — 自定义结构体漏洞利用
- **Keysafe** — 密钥管理服务相关漏洞
- **BABYPWN** — 基础栈溢出 / ret2text 类入门题

### Reverse

- **just_sm4** — SM4 国密算法逆向，还原加密逻辑后解密 Flag
- **Quick_Js** — QuickJS 引擎相关逆向，分析字节码或脚本逻辑

### Crypto

- **BabyRSA** — RSA 基础攻击（小公钥指数 / 质因数分解）
- **Reused Keystream** — 流密码密钥重用攻击，多组密文异或恢复明文
- **Predictable** — 可预测随机数发生器攻击，还原 PRNG 状态
- **Twice** — RSA 相关攻击（可能涉及共模或低解密指数）
- **Leaky Prime** — 部分质数泄露攻击，利用已知高位/低位通过 Coppersmith 恢复完整质数

## 完整 Writeup 下载

详细的题目分析、利用链推导、Exploit 代码和 Flag 已整理为 PDF：

📥 **[下载 GFCTF Writeup.pdf](/downloads/gfctf-wp.pdf)**

> PDF 包含每道题的完整解题过程、核心代码片段和 Flag，适合学习参考。

## 总结

这次比赛整体质量不错，Web 方向的两道题都很有代表性（Java 反序列化黑名单绕过 + SSTI WAF 绕过），Crypto 出了 5 道题覆盖面很广。后续会把其中比较有代表性的题目单独拆出来写详细题解。

继续加油，下次比赛争取更高排名！
