---
title: Linux性能讲解—系统性能分析与调优实战
date: 2026-09-11 20:40:00
categories: [Linux, 运维]
tags: [Linux, 性能调优, 运维, eBPF, 内核]
cover: /img/bg8.jpg
---

## 性能分析的方法论

Linux 系统性能问题的排查不是靠"感觉"，而是靠一套系统的方法论。Brendan Gregg（Netflix 高级性能架构师）提出的 USE 方法和 Linux 性能工具图谱是行业标准。

### USE 方法

对每一个资源，检查：
- **Utilization（利用率）**：资源忙于工作的时间比例
- **Saturation（饱和度）**：资源排队等待的程度
- **Errors（错误）**：资源的错误计数

资源包括：CPU、内存、磁盘 IO、网络、文件描述符、内核连接等。

### 性能分析的层次

```
应用层      → 应用代码、算法、数据库查询
  ↓
运行时层    → JVM/Node/Python GC、线程池、连接池
  ↓
系统调用层  → syscall 频率、延迟、错误
  ↓
内核层      → 调度器、内存管理、网络栈、IO 栈
  ↓
硬件层      → CPU 缓存、内存带宽、磁盘、网卡
```

性能问题可能出现在任何一层，需要从上层往下逐层排查。

<!-- more -->

## CPU 性能分析

### 1. 整体 CPU 状况

```bash
# 负载平均值（1/5/15分钟）
uptime

# CPU 整体使用情况（1秒刷新一次，共3次）
vmstat 1 3

# 每个 CPU 核心的使用情况
mpstat -P ALL 1

# 进程级 CPU 使用
top -H          # 显示线程
pidstat 1       # 每秒统计进程 CPU
pidstat -t 1    # 线程级统计
```

### 2. CPU 性能指标解读

`vmstat` 输出的关键列：
- `r`：运行队列长度（正在运行 + 等待 CPU 的进程数）。如果持续大于 CPU 核心数，说明 CPU 饱和
- `us`：用户态 CPU 时间百分比
- `sy`：内核态 CPU 时间百分比。如果 sy 很高（>20%），说明系统调用或内核操作频繁
- `wa`：IO 等待时间。如果 wa 很高，说明 CPU 在等磁盘 IO，瓶颈在磁盘而不是 CPU
- `id`：空闲时间

### 3. CPU 火焰图

火焰图是分析 CPU 性能的最强大工具，可以直观看到 CPU 时间花在了哪些函数上。

```bash
# 用 perf 采样（30秒，99Hz）
perf record -F 99 -a -g -- sleep 30
perf script > out.perf

# 生成火焰图（需要 FlameGraph 工具）
git clone https://github.com/brendangregg/FlameGraph
stackcollapse-perf.pl out.perf | flamegraph.pl > flamegraph.svg

# 用浏览器打开 flamegraph.svg
```

火焰图的读法：
- 横轴：采样数量（代表 CPU 时间占比），越宽表示占用 CPU 越多
- 纵轴：调用栈深度，从下到上是调用关系
- 点击某个方块可以放大查看细节

### 4. 调度器分析

```bash
# 查看调度器统计
cat /proc/schedstat

# 进程调度延迟（等待 CPU 的时间）
pidstat -d 1

# 上下文切换频率
vmstat 1  # cs 列
```

如果上下文切换频率很高（>10000/s），可能是：
- 线程数过多
- 锁竞争激烈
- IO 频繁导致线程阻塞/唤醒

### 5. CPU 调优

```bash
# CPU 频率调控（性能模式）
cpupower frequency-set -g performance

# CPU 亲和性（绑定进程到指定 CPU 核心）
taskset -c 0,1,2,3 ./myapp

# 隔离 CPU 核心（不让调度器把普通进程调度到这些核心上）
# 在 /etc/default/grub 中添加 isolcpus=4-7
# 然后用 taskset 把关键进程绑定到隔离核心

# 关闭超线程（对延迟敏感的应用）
echo off > /sys/devices/system/cpu/smt/control
```

## 内存性能分析

### 1. 整体内存状况

```bash
# 内存使用情况
free -h

# 详细内存统计
cat /proc/meminfo

# 进程级内存使用
ps aux --sort=-%mem | head -20
pmap -x <pid>    # 进程内存映射
smem -tk          # 按 PSS（比例集大小）统计，更准确
```

### 2. 关键内存指标

- `MemAvailable`：真正可用的内存（不是 MemFree，因为 Linux 会用空闲内存做缓存）
- `SwapUsed`：如果 swap 使用量持续增长，说明物理内存不足
- `Dirty`：等待写回磁盘的脏页。如果很高，说明磁盘写入跟不上
- `PageTables`：页表占用的内存。如果很高（>1GB），可能是内存碎片或进程过多
- `Slab`：内核 slab 分配器占用的内存（dentry、inode 等缓存）

### 3. 内存泄漏检测

```bash
# 用 valgrind 检测内存泄漏（开发环境，性能开销大）
valgrind --leak-check=full --show-leak-kinds=all ./myapp

# 用 gperftools（生产环境，开销小）
LD_PRELOAD=/usr/lib/libtcmalloc.so HEAPPROFILE=./heap ./myapp
pprof --pdf ./myapp heap.0001.heap > heap.pdf

# 用 eBPF 跟踪内存分配
bpftrace -e 'uprobe:/lib/x86_64-linux-gnu/libc.so.6:malloc { @[ustack]=count(); }'

# 观察进程内存增长
watch -n 1 'ps -o pid,rss,vsz,comm -p <pid>'
```

### 4. Swap 调优

```bash
# 查看 swappiness（0-100，值越大越积极使用 swap）
cat /proc/sys/vm/swappiness

# 数据库等延迟敏感应用设为 1 或 10
echo 1 > /proc/sys/vm/swappiness

# 永久设置
echo 'vm.swappiness = 1' >> /etc/sysctl.conf
```

### 5. 大页（HugePages）

对于内存密集型应用（数据库、Java），大页可以减少 TLB miss：

```bash
# 查看大页配置
cat /proc/meminfo | grep Huge

# 配置 1000 个 2MB 大页
echo 1000 > /proc/sys/vm/nr_hugepages

# 透明大页（THP）
# 数据库应用通常建议关闭 THP（可能导致延迟抖动）
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag
```

## 磁盘 IO 性能分析

### 1. 整体 IO 状况

```bash
# 磁盘 IO 统计
iostat -xz 1 3

# 进程级 IO
pidstat -d 1
iotop -o        # 只显示正在做 IO 的进程

# IO 延迟分析
iostat -x 1     # await 列是平均 IO 延迟（毫秒）
```

### 2. 关键 IO 指标

- `r/s`、`w/s`：每秒读/写次数（IOPS）
- `rkB/s`、`wkB/s`：每秒读/写数据量（吞吐量）
- `await`：平均 IO 延迟（队列等待 + 设备服务时间）。SSD 应 <1ms，HDD 应 <10ms
- `%util`：设备繁忙时间百分比。如果持续 >80%，说明磁盘可能是瓶颈
- `aqu-sz`：平均队列深度。如果很高，说明 IO 在排队

### 3. IO 延迟分析

```bash
# 用 eBPF 跟踪 IO 延迟分布
biolatency -m 10 1    # 按毫秒统计 IO 延迟分布

# 跟踪慢 IO（>10ms）
biosnoop -Q 10

# 文件系统级延迟
filetop -C 1 10        # 按文件统计 IO
```

### 4. 磁盘调优

```bash
# 查看 IO 调度器
cat /sys/block/sda/queue/scheduler

# SSD 用 none 或 mq-deadline，HDD 用 bfq
echo mq-deadline > /sys/block/sda/queue/scheduler

# 调整队列深度
echo 256 > /sys/block/sda/queue/nr_requests

# 调整预读（大文件顺序读调大）
blockdev --setra 4096 /dev/sda

# 文件系统挂载选项
# noatime：不更新访问时间，减少写 IO
# data=writeback：ext4 数据写回模式，性能更好但安全性降低
mount -o noatime,data=writeback /dev/sda1 /mnt
```

## 网络性能分析

### 1. 整体网络状况

```bash
# 网络接口统计
ip -s link
ifconfig -s

# 网络连接统计
ss -s
ss -tlnp     # 监听的 TCP 端口
ss -ti        # TCP 连接详情（含拥塞控制、重传等）

# 网络流量实时监控
iftop -i eth0
nload eth0
vnstat -i eth0
```

### 2. TCP 性能指标

```bash
# TCP 统计
nstat -az | grep Tcp
cat /proc/net/snmp | grep Tcp
```

关键指标：
- `TcpRetransSegs`：重传段数。重传率 >0.1% 说明网络有问题
- `TcpExtListenOverflows`：监听队列溢出。如果增长，说明应用 accept 太慢或 backlog 太小
- `TcpExtTCPSynRetrans`：SYN 重传。三次握手失败
- `TcpExtTCPTimeouts`：TCP 超时

### 3. 网络延迟分析

```bash
# 基础连通性和延迟
ping -c 10 target.com

# 路由路径延迟
mtr --report target.com
traceroute target.com

# TCP 握手延迟（不发送数据）
curl -o /dev/null -s -w "TCP连接: %{time_connect}s\nTLS握手: %{time_appconnect}s\n首字节: %{time_starttransfer}s\n总时间: %{time_total}s\n" https://target.com

# 用 eBPF 跟踪 TCP 连接延迟
tcplife -T
tcpconnlat 1 10    # TCP 连接延迟（毫秒）
```

### 4. 网络调优

```bash
# 增大监听队列（高并发服务器）
echo 4096 > /proc/sys/net/core/somaxconn
echo 4096 > /proc/sys/net/ipv4/tcp_max_syn_backlog

# TCP 缓冲区
echo 'net.core.rmem_max = 16777216' >> /etc/sysctl.conf
echo 'net.core.wmem_max = 16777216' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_rmem = 4096 87380 16777216' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_wmem = 4096 65536 16777216' >> /etc/sysctl.conf

# 拥塞控制算法（BBR 对高延迟高带宽网络更好）
echo bbr > /proc/sys/net/ipv4/tcp_congestion_control
echo 'net.core.default_qdisc = fq' >> /etc/sysctl.conf

#  TIME_WAIT 复用（高并发短连接服务器）
echo 1 > /proc/sys/net/ipv4/tcp_tw_reuse
echo 30 > /proc/sys/net/ipv4/tcp_fin_timeout

# 文件描述符限制
echo '* soft nofile 65535' >> /etc/security/limits.conf
echo '* hard nofile 65535' >> /etc/security/limits.conf
```

## eBPF 性能工具

eBPF 是现代 Linux 性能分析的利器，可以在内核态高效收集数据，不需要重新编译内核。

### 常用 eBPF 工具（BCC / bpftrace）

```bash
# 安装 BCC 工具集
sudo apt install bpfcc-tools linux-headers-$(uname -r)

# 系统调用统计（按进程）
syscount -p <pid> 1 10

# 系统调用延迟
funclatency -u do_sys_open 1 10

# 进程执行跟踪（谁在执行什么命令）
execsnoop -T

# 文件打开跟踪
opensnoop -p <pid>

# TCP 重传跟踪
tcpretrans -l

# 页面错误跟踪
pagefaults -p <pid> 1 10

# 调度器延迟（进程等待 CPU 的时间）
runqlat -m 1 10

# 锁竞争分析
mutexlock -p <pid> 1 10
```

### bpftrace 一行命令

```bash
# 跟踪所有进程的 execve 系统调用
bpftrace -e 'tracepoint:syscalls:sys_enter_execve { printf("%s: %s\n", comm, str(args->filename)); }'

# 统计系统调用频率
bpftrace -e 'tracepoint:syscalls:sys_enter_* { @[probe] = count(); } interval:s:10 { print(@); clear(@); }'

# 跟踪慢文件打开（>10ms）
bpftrace -e 'kprobe:do_sys_open { @start[tid] = nsecs; } kretprobe:do_sys_open /@start[tid]/ { $dur = (nsecs - @start[tid]) / 1000000; if ($dur > 10) { printf("%s: %dms\n", comm, $dur); } delete(@start[tid]); }'
```

## 性能基准测试

### CPU 基准

```bash
# 编译性能基准
time make -j$(nproc)

# 7z 基准
7z b

# sysbench CPU
sysbench cpu --cpu-max-prime=20000 run
```

### 内存基准

```bash
# 内存带宽
sysbench memory --memory-block-size=1M --memory-total-size=10G run

# 内存延迟
lmbench/lat_mem_rd 100M 512
```

### 磁盘基准

```bash
# 顺序读（跳过缓存）
fio --name=read --filename=/dev/sda --rw=read --bs=1M --direct=1 --iodepth=32 --runtime=60

# 随机读写（IOPS）
fio --name=randrw --filename=/dev/sda --rw=randrw --rwmixread=70 --bs=4k --direct=1 --iodepth=32 --runtime=60 --numjobs=4

# 延迟测试
fio --name=latency --filename=/dev/sda --rw=randread --bs=4k --direct=1 --iodepth=1 --runtime=60
```

### 网络基准

```bash
# 带宽测试（iperf3）
# 服务端
iperf3 -s
# 客户端
iperf3 -c server_ip -t 60 -P 4

# 延迟和抖动
ping -c 100 -i 0.2 server_ip

# 应用层吞吐（HTTP）
wrk -t4 -c100 -d30s https://target.com
```

## 性能问题排查清单

```
系统慢？
  │
  ├─ CPU 高？
  │   ├─ us 高 → 应用代码问题，用火焰图分析
  │   ├─ sy 高 → 系统调用频繁，用 strace/syscount 分析
  │   ├─ wa 高 → 磁盘 IO 瓶颈，看 iostat
  │   └─ si/hi 高 → 中断处理，看 /proc/interrupts
  │
  ├─ 内存不足？
  │   ├─ swap 使用增长 → 物理内存不足，找内存泄漏
  │   ├─ OOM killer 触发 → dmesg | grep oom
  │   └─ 缓存占用高 → 正常，Linux 会用空闲内存做缓存
  │
  ├─ 磁盘慢？
  │   ├─ %util > 80% → 磁盘饱和
  │   ├─ await 高 → IO 延迟大
  │   └─ 队列深 → 应用 IO 太多或磁盘太慢
  │
  ├─ 网络慢？
  │   ├─ 重传率高 → 网络质量差
  │   ├─ 连接队列溢出 → 应用 accept 慢或 backlog 小
  │   ├─ TIME_WAIT 多 → 短连接太多，考虑长连接/连接池
  │   └─ 带宽打满 → 流量过大
  │
  └─ 都不高但还是慢？
      ├─ 锁竞争 → perf lock / mutexlock
      ├─ 调度延迟 → runqlat
      ├─ 数据库慢查询 → 开启慢查询日志
      └─ 应用层问题 → 应用性能分析（APM）
```

## 总结

Linux 性能分析是一门系统性的工程，需要掌握从硬件到应用的全栈知识。核心方法论是：
1. **USE 方法**：对每个资源检查利用率、饱和度、错误
2. **从整体到局部**：先看整体资源状况，再深入到具体进程和函数
3. **用数据说话**：不要靠感觉，用工具收集准确的性能数据
4. **火焰图**：CPU 性能分析的首选工具
5. **eBPF**：现代 Linux 性能分析的利器，可以深入内核态收集数据

性能调优的关键是**找到真正的瓶颈**，而不是盲目调参数。很多性能问题的根因在应用层（慢查询、算法低效、内存泄漏），而不是系统层。先定位瓶颈，再有针对性地调优，才能事半功倍。
