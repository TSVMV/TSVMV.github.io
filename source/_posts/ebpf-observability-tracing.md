---
title: eBPF 可观测性实战：从零编写系统调用追踪工具
date: 2026-09-13 02:00:00
categories: [内核技术, 可观测性]
tags: [eBPF, Linux, 可观测性]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg17.jpg
---

## eBPF 是什么

eBPF（extended Berkeley Packet Filter）是 Linux 内核中的一个革命性技术。它允许用户在不修改内核源码、不加载内核模块的情况下，在内核中运行沙箱化的小程序。这些程序可以挂载到各种内核钩子点上——系统调用、函数入口/出口、网络事件、跟踪点、性能计数器——实现网络过滤、性能分析、安全监控、可观测性等功能。

eBPF 的核心价值在于：**安全、高效、动态**。安全是因为 eBPF 程序在内核虚拟机中运行，有验证器（verifier）确保不会崩溃内核；高效是因为程序直接在内核态运行，不需要用户态/内核态切换；动态是因为可以在运行时加载和卸载，不需要重启系统或重新编译内核。

<!-- more -->

## eBPF 架构

### 执行流程

```
用户空间                          内核空间
┌─────────────┐               ┌─────────────────────┐
│  eBPF 程序  │  clang/llvm  │  eBPF 字节码         │
│  (C 语言)   │ ────────────> │                     │
└─────────────┘               │  ┌───────────────┐  │
                              │  │  Verifier     │  │
                              │  │  (验证器)      │  │
                              │  └───────────────┘  │
┌─────────────┐               │  ┌───────────────┐  │
│ 加载工具     │  bpf()       │  │  JIT 编译器    │  │
│ (bpftool/   │ ────────────> │  │  → 原生机器码  │  │
│  ip/xdp)    │               │  └───────────────┘  │
└─────────────┘               │  ┌───────────────┐  │
                              │  │  挂载到钩子点   │  │
┌─────────────┐               │  │  (kprobe/trace│  │
│ 数据处理     │ <──────────── │  │   point/xdp)  │  │
│ (perf buffer│   环形缓冲区   │  └───────────────┘  │
│  /ring map) │               │                     │
└─────────────┘               └─────────────────────┘
```

### 验证器（Verifier）

验证器是 eBPF 安全的核心。它会静态分析 eBPF 字节码，确保：
- 程序不会崩溃内核（空指针解引用、越界访问）
- 程序不会无限循环（有界循环）
- 程序不会访问未初始化的内存
- 程序使用的辅助函数参数类型正确
- 程序不会泄露内核地址（指针运算受限）

### 地图（Maps）

Maps 是 eBPF 程序和用户空间之间共享数据的机制，也是 eBPF 程序之间共享数据的方式。常见的 Map 类型：

- `BPF_MAP_TYPE_HASH`：哈希表，键值对存储
- `BPF_MAP_TYPE_ARRAY`：数组，索引访问
- `BPF_MAP_TYPE_PERCPU_HASH`：每 CPU 哈希表，无锁高性能
- `BPF_MAP_TYPE_RINGBUF`：环形缓冲区，高性能事件输出
- `BPF_MAP_TYPE_PERF_EVENT_ARRAY`：perf 事件数组
- `BPF_MAP_TYPE_LRU_HASH`：LRU 淘汰的哈希表
- `BPF_MAP_TYPE_STACK_TRACE`：栈追踪存储

### 程序类型

eBPF 程序有多种类型，决定了它能挂载到哪里、能访问哪些数据：

- `BPF_PROG_TYPE_KPROBE`：内核函数动态跟踪
- `BPF_PROG_TYPE_TRACEPOINT`：内核静态跟踪点
- `BPF_PROG_TYPE_XDP`：网络数据包最早处理点
- `BPF_PROG_TYPE_SOCKET_FILTER`：socket 过滤器
- `BPF_PROG_TYPE_CGROUP_SKB`：cgroup 网络控制
- `BPF_PROG_TYPE_PERF_EVENT`：性能事件
- `BPF_PROG_TYPE_LSM`：Linux 安全模块
- `BPF_PROG_TYPE_RAW_TRACEPOINT`：原始跟踪点

## 环境准备

### 内核版本要求

eBPF 的功能随内核版本快速演进，建议使用 5.4+ 内核，完整功能需要 5.10+。

```bash
# 检查内核版本
uname -r

# 检查 eBPF 支持
ls /sys/kernel/btf/vmlinux  # BTF（BPF Type Format），5.4+ 支持
cat /proc/config.gz | gunzip | grep CONFIG_BPF
```

### 安装依赖

```bash
# Ubuntu / Debian
sudo apt-get install -y \
    bpfcc-tools linux-headers-$(uname -r) \
    clang llvm libelf-dev libbpf-dev \
    bpftool build-essential

# libbpf（推荐，比 BCC 更轻量）
git clone https://github.com/libbpf/libbpf
cd libbpf/src && make && sudo make install
```

### 开发框架选择

| 框架 | 特点 | 适用场景 |
|------|------|----------|
| **BCC** | Python/Lua 前端，编译在运行时，开发快 | 快速原型、脚本工具 |
| **libbpf + CO-RE** | C 语言，预编译，一次编译到处运行 | 生产环境、高性能工具 |
| **bpftrace** | 高级脚本语言，类似 awk | 快速诊断、一行命令 |
| **Aya** | Rust 语言 eBPF 库 | Rust 生态 |
| **libbpf-rs** | Rust 绑定 libbpf | Rust 用户空间工具 |

本文使用 **libbpf + CO-RE**（Compile Once - Run Everywhere），这是目前生产环境的标准做法。

## 实战：编写系统调用追踪工具

我们要编写一个工具，追踪系统中所有进程的 `execve` 系统调用（即程序执行），记录进程名、PID、命令行参数，并输出到用户空间。

### 项目结构

```
execsnoop/
├── execsnoop.bpf.c    # eBPF 内核程序（C）
├── execsnoop.c        # 用户空间加载程序（C）
├── execsnoop.h        # 共享头文件
└── Makefile
```

### 共享头文件

```c
// execsnoop.h
#ifndef __EXECSNOOP_H
#define __EXECSNOOP_H

#define TASK_COMM_LEN 16
#define MAX_ARGS_LEN 256

// 发送到用户空间的事件结构
struct event {
    int pid;
    int ppid;
    int uid;
    char comm[TASK_COMM_LEN];   // 进程名
    char args[MAX_ARGS_LEN];    // 命令行参数
};

#endif
```

### eBPF 内核程序

```c
// execsnoop.bpf.c
#include "vmlinux.h"          // 内核类型定义，由 bpftool 生成
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_core_read.h>
#include "execsnoop.h"

// 环形缓冲区：用于向用户空间发送事件
struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 256 * 1024);  // 256KB
} rb SEC(".maps");

// 跟踪 execve 系统调用的进入点
// 使用 raw_tracepoint 比 kprobe 更稳定、性能更好
SEC("raw_tracepoint/sys_enter")
int tracepoint__sys_enter(struct bpf_raw_tracepoint_args *ctx)
{
    // sys_enter 的参数结构
    // 第一个参数是系统调用号
    long syscall_id = ctx->args[0];

    // 只关注 execve (59) 和 execveat (322)
    if (syscall_id != 59 && syscall_id != 322)
        return 0;

    // 在 ring buffer 中预留事件空间
    struct event *e = bpf_ringbuf_reserve(&rb, sizeof(*e), 0);
    if (!e)
        return 0;

    // 获取当前进程信息
    u64 pid_tgid = bpf_get_current_pid_tgid();
    u64 uid_gid = bpf_get_current_uid_gid();
    e->pid = pid_tgid >> 32;       // PID 在高 32 位
    e->uid = uid_gid;               // UID 在低 32 位

    // 获取进程名
    bpf_get_current_comm(&e->comm, sizeof(e->comm));

    // 获取父进程 PID（需要读取 task_struct）
    struct task_struct *task = (struct task_struct *)bpf_get_current_task();
    e->ppid = BPF_CORE_READ(task, real_parent, tgid);

    // 读取命令行参数
    // sys_enter 的 args[1] 是第一个参数（filename），args[2] 是 argv
    // 这里简化处理：读取 filename 作为 args
    const char *filename = (const char *)ctx->args[1];
    bpf_probe_read_user_str(&e->args, sizeof(e->args), filename);

    // 提交事件到用户空间
    bpf_ringbuf_submit(e, 0);

    return 0;
}

char LICENSE[] SEC("license") = "GPL";
```

### 关键技术点解析

#### 1. raw_tracepoint vs kprobe

`kprobe` 可以动态跟踪几乎任何内核函数，但它需要在运行时解析符号，且内核函数签名可能随版本变化。`raw_tracepoint` 跟踪内核中预定义的静态跟踪点，更稳定、性能更好，且参数结构固定。`sys_enter` 跟踪点在每次系统调用进入时触发，参数中包含系统调用号和所有参数。

#### 2. BPF_CORE_READ 宏

`BPF_CORE_READ` 是 CO-RE 的核心宏，它可以安全地读取内核结构体的字段，自动处理不同内核版本中结构体布局的变化。它的原理是利用 BTF（BPF Type Format）信息，在加载时重定位字段偏移。

```c
// 等价于 task->real_parent->tgid，但安全且跨内核版本
e->ppid = BPF_CORE_READ(task, real_parent, tgid);
```

#### 3. ring buffer vs perf buffer

`BPF_MAP_TYPE_RINGBUF`（环形缓冲区）是较新的 Map 类型，相比传统的 perf buffer：
- 支持变长事件
- 无额外的数据拷贝（reserve/commit 模式）
- 内存占用更小
- 顺序保证更好

#### 4. bpf_probe_read_user_str

eBPF 程序不能直接解引用用户空间指针（验证器会拒绝），必须用 `bpf_probe_read_user()` 或 `bpf_probe_read_user_str()` 来读取用户空间内存。这是 eBPF 安全模型的一部分——防止内核程序访问非法的用户空间地址导致崩溃。

### 用户空间程序

```c
// execsnoop.c
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <bpf/libbpf.h>
#include "execsnoop.h"
#include "execsnoop.skel.h"  // 由 bpftool 生成的脚手架

static int running = 1;

static void sig_handler(int sig)
{
    running = 0;
}

// 环形缓冲区事件回调
static int handle_event(void *ctx, void *data, size_t data_sz)
{
    const struct event *e = data;

    printf("%-7d %-7d %-7d %-16s %s\n",
           e->pid, e->ppid, e->uid, e->comm, e->args);

    return 0;
}

int main(int argc, char **argv)
{
    struct execsnoop_bpf *skel;
    struct ring_buffer *rb = NULL;
    int err;

    signal(SIGINT, sig_handler);
    signal(SIGTERM, sig_handler);

    // 加载并验证 eBPF 程序
    skel = execsnoop_bpf__open_and_load();
    if (!skel) {
        fprintf(stderr, "Failed to open BPF skeleton\n");
        return 1;
    }

    // 创建环形缓冲区消费者
    rb = ring_buffer__new(bpf_map__fd(skel->maps.rb),
                           handle_event, NULL, NULL);
    if (!rb) {
        fprintf(stderr, "Failed to create ring buffer\n");
        goto cleanup;
    }

    printf("%-7s %-7s %-7s %-16s %s\n",
           "PID", "PPID", "UID", "COMM", "ARGS");
    printf("------------------------------------------------------------\n");

    // 事件循环
    while (running) {
        err = ring_buffer__poll(rb, 100 /* timeout ms */);
        if (err == -EINTR)
            break;
        if (err < 0) {
            fprintf(stderr, "Error polling ring buffer: %d\n", err);
            break;
        }
    }

cleanup:
    ring_buffer__free(rb);
    execsnoop_bpf__destroy(skel);
    return 0;
}
```

### Makefile

```makefile
# Makefile
CLANG ?= clang
CFLAGS := -g -O2 -Wall -Werror
ARCH := $(shell uname -m | sed 's/x86_64/x86/')

# 生成 vmlinux.h（内核类型定义）
vmlinux.h:
	bpftool btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h

# 编译 eBPF 程序为目标文件
execsnoop.bpf.o: execsnoop.bpf.c vmlinux.h execsnoop.h
	$(CLANG) $(CFLAGS) -target bpf -D__TARGET_ARCH_$(ARCH) \
		-c execsnoop.bpf.c -o $@

# 生成用户空间脚手架
execsnoop.skel.h: execsnoop.bpf.o
	bpftool gen skeleton $< > $@

# 编译用户空间程序
execsnoop: execsnoop.c execsnoop.skel.h execsnoop.h
	$(CC) $(CFLAGS) execsnoop.c -o $@ -lbpf -lelf -lz

all: execsnoop

clean:
	rm -f execsnoop execsnoop.bpf.o execsnoop.skel.h vmlinux.h

.PHONY: all clean
```

### 编译运行

```bash
make
sudo ./execsnoop

# 输出示例：
# PID     PPID    UID     COMM             ARGS
# ------------------------------------------------------------
# 12345   12300   1000    bash             /bin/ls
# 12346   12345   1000    ls               /usr/bin/ls
# 12347   12300   0       sudo             /usr/bin/apt update
```

## 进阶：过滤与统计

### 按进程名过滤

在内核程序中添加过滤，只跟踪特定进程：

```c
// 过滤 Map：用户空间写入要跟踪的进程名
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 128);
    __type(key, char[TASK_COMM_LEN]);
    __type(value, __u8);
} filter_map SEC(".maps");

SEC("raw_tracepoint/sys_enter")
int tracepoint__sys_enter(struct bpf_raw_tracepoint_args *ctx)
{
    // ... 获取 comm ...
    char comm[TASK_COMM_LEN];
    bpf_get_current_comm(&comm, sizeof(comm));

    // 如果过滤 Map 非空且当前进程不在其中，跳过
    __u8 *v = bpf_map_lookup_elem(&filter_map, comm);
    __u32 key = 0;
    __u32 *count = bpf_map_lookup_elem(&filter_map, &key);
    if (count && *count > 0 && !v)
        return 0;

    // ... 后续处理 ...
}
```

### 系统调用统计

用 per-CPU 数组统计每个系统调用的次数：

```c
struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __uint(max_entries, 512);  // 系统调用号最大约 450
    __type(key, __u32);
    __type(value, __u64);
} syscall_count SEC(".maps");

SEC("raw_tracepoint/sys_enter")
int count_syscalls(struct bpf_raw_tracepoint_args *ctx)
{
    long id = ctx->args[0];
    __u32 key = (__u32)id;
    __u64 *count = bpf_map_lookup_elem(&syscall_count, &key);
    if (count)
        __sync_fetch_and_add(count, 1);  // 原子加
    return 0;
}
```

用户空间读取统计：

```c
// 读取 per-CPU 数组，汇总每个 CPU 的计数
for (int i = 0; i < 512; i++) {
    __u64 total = 0;
    for (int cpu = 0; cpu < num_cpus; cpu++) {
        __u64 val;
        bpf_map_lookup_elem(fd, &i, &val);  // per-CPU 需要特殊读取
        total += val;
    }
    if (total > 0)
        printf("syscall %d: %llu\n", i, total);
}
```

## eBPF 在安全领域的应用

### 1. 入侵检测

监控异常的系统调用模式：
- 非 root 进程调用 `setuid(0)`
- 进程读取 `/etc/shadow`
- 异常的网络连接（连接到已知恶意 IP）
- 容器内进程挂载宿主机文件系统

### 2. 运行时安全（Falco）

Falco 是基于 eBPF 的云原生运行时安全工具，它用 eBPF 监控系统调用，根据规则检测异常行为：

```yaml
- rule: Shell in container
  desc: 容器中执行了 shell
  condition: container.id != host and proc.name in (bash, sh, zsh)
  output: "容器中执行了 shell: %proc.name (user=%user.name)"
  priority: WARNING
```

### 3. 恶意行为追踪

用 eBPF 追踪进程的完整生命周期：fork → exec → 网络连接 → 文件操作，构建进程行为图谱，用于恶意软件分析和溯源。

## 性能考虑

### eBPF 的开销

eBPF 程序在内核态运行，每个被跟踪的事件都会触发 eBPF 程序执行。对于高频事件（如网络包、调度事件），开销可能很大：

- `sys_enter` 跟踪点：每个系统调用触发，约 1-5% CPU 开销
- `kprobe`：比 tracepoint 慢，约 5-10% 开销
- `XDP`：在网络驱动层处理，性能极高（百万 PPS）
- 采样模式（perf event with sampling）：可以大幅降低开销

### 优化技巧

1. **尽早过滤**：在 eBPF 程序开头就过滤掉不关心的事件，减少后续处理
2. **使用 per-CPU Map**：避免锁竞争
3. **使用 ring buffer**：比 perf buffer 更高效
4. **避免复杂循环**：验证器限制循环次数，复杂循环会被拒绝
5. **使用 BPF 编译器优化**：`-O2` 优化，去除死代码
6. **批量处理**：尽量在一次 eBPF 调用中完成更多工作

## 调试技巧

### 1. bpf_trace_printk

在 eBPF 程序中用 `bpf_trace_printk()` 打印调试信息，输出到 `/sys/kernel/debug/tracing/trace_pipe`：

```c
bpf_trace_printk("pid=%d comm=%s\n", pid, comm);
```

```bash
sudo cat /sys/kernel/debug/tracing/trace_pipe
```

### 2. bpftool

```bash
# 查看已加载的 eBPF 程序
sudo bpftool prog show

# 查看 Map
sudo bpftool map show

# 查看 Map 内容
sudo bpftool map dump id 123

# 查看 eBPF 程序的字节码
sudo bpftool prog dump xlated id 123

# 查看验证器日志（加载失败时）
sudo bpftool prog load ./prog.bpf.o /sys/fs/bpf/prog verbose
```

### 3. 验证器错误解读

验证器错误信息通常很长，关键看：
- `R1=...` 等寄存器状态：验证器跟踪的寄存器类型和范围
- `invalid mem access`：非法内存访问（越界、空指针）
- `infinite loop`：无限循环（有界循环需要用已知的循环变量）
- `function calls are not allowed`：不允许的函数调用（需要用 BPF 辅助函数）

## 学习路径

1. **基础**：理解 eBPF 架构、验证器、Maps、程序类型
2. **工具使用**：学习 bpftrace、BCC 工具集（execsnoop、opensnoop、biolatency 等）
3. **编程入门**：用 BCC 或 libbpf 写简单的跟踪程序
4. **深入内核**：理解内核数据结构（task_struct、file、sk_buff），学会用 BPF_CORE_READ
5. **高级主题**：XDP 网络编程、LSM 安全模块、eBPF 程序的性能优化
6. **生产实践**：CO-RE、BTF、版本兼容性、部署和监控

## 推荐资源

- [eBPF 官方文档](https://ebpf.io/)
- [libbpf 编程指南](https://nakryiko.com/posts/libbpf-bootstrap/)
- BPF Performance Tools（Brendan Gregg 著）—— eBPF 可观测性圣经
- [bpftrace 参考指南](https://github.com/iovisor/bpftrace/blob/master/docs/reference_guide.md)
- [Cilium 项目](https://cilium.io/)—— eBPF 网络和安全的标杆项目
- [Falco](https://falco.org/)—— 基于 eBPF 的运行时安全

## 总结

eBPF 是 Linux 内核过去十年最重要的技术创新之一。它把内核变成了一个可编程的平台，让开发者可以在不修改内核的情况下实现网络、安全、可观测性等各种功能。从简单的系统调用追踪到复杂的容器网络（Cilium）、运行时安全（Falco）、高性能负载均衡，eBPF 的应用场景在不断扩展。

掌握 eBPF 需要理解内核数据结构、C 语言编程、以及 eBPF 特有的验证器约束。但一旦掌握，你就拥有了在内核层面观测和控制整个系统的能力——这是传统工具无法做到的。对于安全研究者来说，eBPF 既是强大的防御工具（入侵检测、系统监控），也可能成为攻击工具（rootkit、信息窃取），理解它的原理和限制是非常有价值的。
