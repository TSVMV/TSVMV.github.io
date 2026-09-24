---
title: cinema：把二进制执行过程变成可回放的电影
date: 2026-09-25 11:00:00
categories: [系统&内核]
tags: [逆向, pwn, 二进制, trace, Unicorn]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg54.jpg
---

调试二进制的时候，经常会想"刚才那一步寄存器是什么样的"。strace 能告诉你发生了什么系统调用，但没法回答某一帧的完整状态——寄存器、内存、调用栈，以及它和前后帧的关系。gdb 能单步，但往前退一步几乎不可能。

cinema（放映机）就是解决这个问题的：把二进制的执行过程录下来，任意一帧都可以瞬间回去看。

<!-- more -->

## 核心思路

基于 Unicorn Engine 做指令级事件采集。程序跑的时候，每条指令执行前后的状态都被记录下来。但如果每条指令都存完整快照，百万级事件的轨迹文件会大到没法用。

所以用了快照 + dirty page 追踪：间隔几何增长地做快照（快照数是对数级于事件数），中间帧通过从最近快照回放事件来恢复。事件回放不重新执行指令，只是重放记录的状态变化，所以很快。

这意味着任意帧 seek 都是 O(log n) 的，反向单步也能做。

## 能做什么

record：录制一个静态 ELF x86_64 二进制的执行过程，输出 .ctrace 轨迹文件（FNV-1a 校验，百万级事件量级）。

info：查看轨迹元信息——入口地址、事件数、快照数、基页数、镜像哈希、最终输出。

trace：按事件类型过滤查看（比如只看 syscall）。

frame：查看任意一帧的完整状态——所有寄存器、指定内存区域的内容、当前输出、正在执行的指令。

tui：Textual 交互界面，可以翻帧、搜索、过滤。

export：导出 HTML 静态报告，方便分享。

```console
$ cinema record hello_static --out hello.ctrace
recorded hello.ctrace (144021 bytes)

$ cinema info hello.ctrace
entry        0x401000
events       28
final frame  28
snapshots    0
base pages   35
  exit(0)
  output: 'hello, winVpwn\n'

$ cinema frame hello.ctrace 13 --mem 0x402000:32
       frame 13
rip     0x40101e
rax     0x1
rsi     0x402000
rdx     0xf
memory 0x402000: 68 65 6c 6c 6f 2c 20 77 69 6e 56 70 77 6e 0a 00 ...
```

## 当前边界

内核面向静态 ET_EXEC x86_64 镜像和确定性 syscall 集合（write、exit、exit_group）。文件、网络、信号、动态链接还在后续阶段。CI 只在 Linux 上验证。

被录制的二进制在 Unicorn 沙箱中运行，不触碰宿主文件系统和网络，运行权限不高于宿主进程。用于 CTF 题目、教学、以及自己拥有的软件。

复用了 winVpwn 的 ELF 加载和 syscall 分发。

项目地址：[github.com/TSVMV/cinema](https://github.com/TSVMV/cinema)。
