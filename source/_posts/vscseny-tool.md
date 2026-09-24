---
title: vscseny：本地静态代码扫描，你的代码有没有危险调用
date: 2026-09-25 12:00:00
categories: [运维开发]
tags: [代码审计, 静态分析, 安全, Go, 工具]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg56.jpg
---

写代码的时候，有些函数调用本身就是危险信号——strcpy、system、eval、硬编码的密钥、弱加密算法。CodeQL 和 SonarQube 功能强，但部署重、要联网、对个人项目来说太重了。

vscseny 是一个本地静态代码扫描器，Go 写的，下载二进制直接跑，不需要运行时。指向你的项目目录，它报告危险调用、弱加密、硬编码密钥和常见错误，按严重程度排序。

<!-- more -->

## 特点

完全离线运行，代码不会上传到任何地方。做安全工具这一点很重要——扫描自己项目的代码不应该经过第三方服务器。

Go 编译成单二进制，Windows 和 Linux 都有，下载解压就能用，不需要装 Python、Node 或者任何运行时。

stdout 是终端时自动打开交互 TUI，可以过滤、排序、翻页、直接在编辑器里打开问题文件。管道输出时是纯文本报告，方便脚本化。也支持 JSON 输出给其他工具消费。

## 检测什么

规则按类别分组，严重程度分 critical/high/medium/low：

注入类：system、popen、eval、exec 类调用，SQL 拼接，命令拼接。

弱加密：MD5、SHA1 用于安全场景，DES、3DES、ECB 模式，硬编码密钥和 IV，随机数用 math/rand 而不是 crypto/rand。

危险函数：strcpy、strcat、sprintf、gets 等缓冲区溢出风险函数，未检查的返回值。

硬编码：密码、API key、token、私钥出现在源码里。

权限和路径：chmod 777、硬编码临时路径、路径拼接未过滤（路径遍历风险）。

## 用法

```console
# 扫描项目，终端自动开 TUI
vscseny /path/to/project

# 强制 TUI
vscseny /path/to/project --tui

# 纯文本报告
vscseny /path/to/project --report

# JSON 输出
vscseny /path/to/project --json

# 列出所有规则
vscseny --list-rules

# 扫描单个文件
vscseny src/app.py
```

TUI 里的命令：`f critical` 按严重程度过滤，`c injection` 按类别过滤，`m strcpy` 匹配文件/规则/代码，`sort sev` 按严重程度排序，`<number>` 查看具体问题详情，`o` 在 $EDITOR 里打开当前问题文件。

项目地址：[github.com/TSVMV/vscseny](https://github.com/TSVMV/vscseny)，Releases 页面下载 Windows/Linux 二进制。
