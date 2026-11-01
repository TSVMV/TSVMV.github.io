---
title: PwnHunter：我把 CTF PWN 题做成了自动解题引擎
date: 2026-11-01 12:00:00
categories: [CTF]
tags: [CTF, Pwn, 自动化, Docker, 工具]
cover: /img/anime/mahoyo.jpg
---

> 项目地址：[github.com/TSVMV/pwnhunter](https://github.com/TSVMV/pwnhunter) · 仅用于 CTF 训练平台与授权环境

做 PWN 题的时间分配大概是这样的：`checksec` 查保护、cyclic 算偏移、认 libc 版本、套模板写 exp、本地调通、远程打 flag——这些**套路化操作占了七成时间**，真正考验思路的"这个洞怎么利用"只占三成。

于是我把那七成做成了引擎。pwnhunter 是一个 CTF PWN 自动解题引擎：给定题目附件（ELF / libc / 源码）与远程实例地址，自动完成侦察、漏洞探测、exploit 生成、本地验证与远程 flag 获取，产出可以直接人工接管的 pwntools 脚本和解题报告。

<!-- more -->

## 五步流水线

```
附件 ─► triage ─► 动态探针 ─► 策略注册表(feasible→build) ─► 本地验证(容器) ─► 远程收割
                     │                                            │
                     └── 失败自分析 ◄──────────────────────────────┘
```

**① triage（侦察）**：保护机制、架构、符号表、libc 版本识别，先建立题目的完整档案。

**② 动态探针**：不只是静态看。引擎会在 gdb 里跑真实进程——cyclic 算溢出偏移、canary smash-oracle 验证是否有金丝雀、格式化字符串扫描测回显漏洞。探针产出的数据直接喂给下一步。

**③ 策略引擎**：一张策略注册表，每条策略先判 `feasible`（当前保护组合下是否可行）再 `build`（生成 exploit）。可行就构建，不可行换下一条，不会浪费时间在不可能的路上。

**④ 本地验证**：所有动态执行都在 Docker 引擎容器里完成（gdb 调试、编译、被测进程），exploit 先在容器里对本地靶机验证通过才算数。

**⑤ 远程收割**：验证过的 exp 打远程实例，拿 flag。失败了会自动产出 `analysis.md`——探针数据 + 规则化的下一步建议，像队友交接文档一样可直接人工接管。

## 已实现的九类策略

| 策略 | 说明 |
|------|------|
| ret2win | 经典返回到 win 函数 |
| ret2magic | 局部变量魔数覆盖 |
| shellcode-callbuf / shellcode-bss | shellcode 注入两种落点 |
| pie-partial | 1 字节窗口判定 + 4bit ASLR 爆破 |
| ret2plt | 借 PLT 泄漏再打 |
| ret2libc | 泄漏 libc 基址构造 ROP |
| fmtstr-got | 格式化字符串改 GOT |
| canary-fmtstr | 格式化串泄漏 canary 后组合利用 |
| canary-brute | fork 服务器单连接逐字节爆破 |

除了策略本身，还有一层**通用机制**在所有策略下生效：

- **gdb 断点成功判据**——win 函数不回显 flag 也能通过控制流验证成功与否；
- **栈对齐自愈**——`movaps` 引发的 16 字节对齐崩溃自动补 `ret` 平衡；
- **recvn 防 `\n` 截断**——泄漏数据不会被换行提前掐断；
- **flag 判定与 exploit 生成彻底解耦**——判定逻辑独立，不会因为 flag 格式差异误判 exp 失败。

## 自愈与失败自分析

自动解题最怕的是"跑不通就死"。pwnhunter 有三层兜底：

1. **源码附件编译矩阵**：有源码的题自动编译 PIE±、canary± 的变体，哪个能复现远程行为用哪个；
2. **远程偏移盲测重试**：本地偏移和远程对不上时自动在远程重测；
3. **libc 不匹配远程探针**：给的 libc 和远程不符时，用探针结果自行修正。

失败也不白跑——每次 solve 产出 `runs/<题名>-<时间戳>/`：`triage.json`、`exploit.py`、各策略产物、`transcript.log`，失败时另有 `analysis.md`（探针数据 + 建议下一步），成功时是 `writeup.md` + `flag.txt`。

## 黑盒模式：没有附件也能测

`blackbox` 子命令只凭远程端点做盲测：banner 指纹、回显行为、格式化字符串探测、崩溃偏移。对一次性服务（连一次就断的）会如实报告预言机不可用，不会假装测过。

## 怎么用

```bash
# 依赖：Docker Desktop、Python 3.10+（pwntools/capstone/pyelftools 等）
python -m pip install -e . --no-deps
python -m pwnhunter env build      # 构建引擎镜像（Ubuntu 22.04 + pwntools + gdb + gcc + AFL++）

python -m pwnhunter web --open             # 本地面板：任务队列 / run 历史 / 失败分析
python -m pwnhunter exp ./pwn -o exp.py    # 一键出 EXP（不发起攻击）
python -m pwnhunter solve ./pwn --remote h:p --libc ./libc.so.6   # 全自动解题
python -m pwnhunter blackbox --remote h:p  # 纯黑盒盲测
python -m pwnhunter triage ./pwn           # 只看保护与符号报告
python -m pwnhunter env destroy            # 一键清理全部 Docker 资源
```

所有 Docker 资源打 `pwnhunter=1` 标签，`env destroy` 一键清理，不留垃圾。国内网络内置了镜像源（Docker 1panel / apt aliyun / pip tsinghua），构建不走玄学网络。

## 测试怎么做的

```bash
python tests/test_solve.py     # 7 类自建靶场端到端（远程拿 flag）
python tests/test_real.py      # ROP Emporium 真题 2 道
python tests/test_blackbox.py  # 黑盒盲探 2 道
```

自建靶场覆盖九类策略的典型组合，真题用 ROP Emporium 交叉验证，黑盒模式单独成套。

## 路线图

PIE-aware fmtstr · SROP · 栈迁移 · ret2dlresolve · ORW/seccomp · BROP · 堆自动化（glibc arena 模型）· 远程 banner 指纹自动选编译变体

堆自动化是大头，glibc 的 arena 模型值得单开一篇博客细说，敬请期待。

## 边界声明

- 引擎**仅用于 CTF 训练平台与授权环境**，攻击动作只对 `solve` 显式给出的远程地址发起；
- 本地面板只监听 `127.0.0.1`；
- 平台对接脚本（如 QingCen 平台驱动）的凭据一律走环境变量，不落盘。

工具代码已开源：[github.com/TSVMV/pwnhunter](https://github.com/TSVMV/pwnhunter)，欢迎交流，Issue/PR 均可。
