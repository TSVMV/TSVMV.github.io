---
title: elfpeek：把 ELF/PE 二进制拆成一张结构图
date: 2026-09-25 10:00:00
categories: [运维开发]
tags: [逆向, ELF, PE, 二进制, 工具]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg52.jpg
---

做逆向的时候，拿到一个二进制第一件事就是搞清楚它的骨架——哪些节区、入口在哪、依赖什么库、开了哪些加固。readelf 和 objdump 能用，但输出是纯文本，节区在文件里占多大比例、内存里怎么映射，全靠脑补。

所以写了 elfpeek，把 ELF 和 PE 解析成一张可视化结构图。

<!-- more -->

## 能看什么

文件总览：格式、位宽、端序、类型、机器架构、入口地址。PE 还会显示映像基址和子系统。

加固特性：ELF 这边查 PIE、NX、RELRO（完整还是部分）、Canary、FORTIFY、有没有 RWX 段。PE 这边查 ASLR、DEP、CFG、高熵 VA、SEHOP。这些是拿到二进制第一眼看的东西，加没加保护直接决定后续打法。

文件布局：水平条带，每个节区按文件大小比例着色，一眼看出哪个节区最大、有没有异常膨胀的段（可能藏了东西）。

内存布局：按运行时虚拟地址排序，标注地址区间和权限（RWX）。这个对 pwn 特别有用——哪里可写、哪里可执行，一目了然。

节区表：名称、偏移、地址、大小、标志，附节区熵值。高熵标红，提示可能加壳或压缩。

动态依赖：ELF 查 DT_NEEDED 共享库，PE 查导入动态库。

符号和函数：ELF 导入导出函数摘要，PE 导入导出函数列表。

字符串：可打印字符串提取，按 URL、IP、路径、共享库分类。

## 怎么用

```bash
# 终端摘要
elfpeek /bin/true

# 导出自包含 HTML 结构图（纯 SVG，无 JS，可截图存档）
elfpeek /bin/true --html report.html

# 导出 JSON
elfpeek /bin/true --json report.json
```

HTML 报告是自包含的，纯 SVG 画布局图，不依赖任何外部资源，直接发给别人或者截图存档都行。

## 实现上的选择

纯 Python 标准库，零第三方依赖。用 struct 手工解析 ELF 头、程序头表、节区头表、动态段和符号表，32/64 位、大小端自适应。PE 那边同样手工解析 DOS/COFF/可选头、节区、导入表导出表，含 RVA 到文件偏移换算。

只读解析，不加载不执行二进制里的任何代码。做安全工具这一点很重要——分析恶意样本时不能把样本跑起来。

项目地址：[github.com/TSVMV/elfpeek](https://github.com/TSVMV/elfpeek)，pip install elfpeek 就能用。
