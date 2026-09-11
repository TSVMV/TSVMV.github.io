---
title: Linux 基础命令入门：从零开始掌握终端
date: 2026-09-11 20:40:00
categories: [Linux]
tags: [Linux, 命令行, 运维, 入门]
cover: /img/bg2.jpg
---

## 为什么要学 Linux 命令行？

Linux 是服务器领域的绝对主流，无论是做运维、开发、还是打 CTF，都离不开 Linux。虽然现在有很多图形界面工具，但**命令行（终端）才是 Linux 的灵魂**——它更快、更强大、更适合自动化。

这篇文章带你掌握最常用的 Linux 命令，看完就能在终端里自由穿梭。

<!-- more -->

## 一、文件与目录操作

### pwd — 查看当前所在目录

```bash
pwd
```

输出类似 `/home/tsvmv`，告诉你现在"站在"哪个文件夹里。

### ls — 列出目录内容

```bash
ls          # 列出当前目录的文件和文件夹
ls -l       # 详细列表（权限、大小、时间）
ls -a       # 显示隐藏文件（以 . 开头的文件）
ls -la      # 组合使用：详细列表 + 隐藏文件
ls -lh      # 人性化显示文件大小（K、M、G）
```

### cd — 切换目录

```bash
cd /home        # 切换到 /home 目录
cd ..           # 回到上一级目录
cd ~            # 回到当前用户的家目录
cd -            # 回到上一次所在的目录
cd Documents    # 进入当前目录下的 Documents 文件夹
```

### mkdir — 创建目录

```bash
mkdir test              # 创建名为 test 的文件夹
mkdir -p a/b/c          # 递归创建多级目录
```

### rm — 删除文件或目录

```bash
rm file.txt             # 删除文件
rm -r test/             # 删除目录及其内容（递归）
rm -rf test/            # 强制删除，不提示（⚠️ 慎用！）
```

> ⚠️ **重要提醒**：`rm -rf /` 会删除整个系统！输入 rm 命令前一定要确认路径。Linux 没有回收站，删除后很难恢复。

### cp — 复制

```bash
cp file.txt file2.txt       # 复制文件
cp -r dir1/ dir2/           # 复制目录
```

### mv — 移动或重命名

```bash
mv file.txt /tmp/            # 移动文件到 /tmp
mv oldname.txt newname.txt   # 重命名文件
```

## 二、查看文件内容

### cat — 查看文件全部内容

```bash
cat file.txt
```

### less — 分页查看大文件

```bash
less file.txt
```

在 less 中：
- `空格` 或 `PageDown`：下一页
- `b` 或 `PageUp`：上一页
- `/关键词`：搜索
- `q`：退出

### head / tail — 查看文件开头/结尾

```bash
head file.txt        # 查看前 10 行
head -n 20 file.txt  # 查看前 20 行
tail file.txt        # 查看后 10 行
tail -f log.txt      # 实时跟踪文件变化（看日志常用）
```

## 三、系统与进程

### ps — 查看进程

```bash
ps aux            # 查看所有进程的详细信息
ps aux | grep nginx   # 查找特定进程
```

### top / htop — 实时监控系统

```bash
top       # 实时显示 CPU、内存、进程状态
htop      # 更友好的交互式监控（需要安装）
```

按 `q` 退出。

### kill — 结束进程

```bash
kill 1234        # 结束 PID 为 1234 的进程
kill -9 1234     # 强制结束（SIGKILL）
```

### df / du — 查看磁盘使用

```bash
df -h           # 查看各分区磁盘使用情况
du -sh /path    # 查看某个目录占用的总大小
du -sh *        # 查看当前目录下每个文件/文件夹的大小
```

### free — 查看内存

```bash
free -h         # 人性化显示内存使用情况
```

## 四、网络相关

### ping — 测试网络连通性

```bash
ping google.com
ping -c 4 8.8.8.8    # 只发 4 个包
```

### curl — 发送网络请求

```bash
curl https://example.com          # GET 请求
curl -I https://example.com       # 只看响应头
curl -O https://example.com/file.zip  # 下载文件
```

### wget — 下载文件

```bash
wget https://example.com/file.zip
```

### netstat / ss — 查看网络连接

```bash
ss -tlnp          # 查看所有监听的 TCP 端口
netstat -tlnp     # 同上（旧命令）
```

## 五、权限管理

Linux 文件权限分为三组：**所有者（user）、所属组（group）、其他（other）**，每组有 **读（r）、写（w）、执行（x）** 三种权限。

```bash
ls -l file.txt
# 输出示例：-rwxr-xr-- 1 tsvmv tsvmv 1024 Sep 11 10:00 file.txt
#           ↑  ↑↑↑ ↑↑↑ ↑↑↑
#           |  用户  组   其他
#         文件类型
```

### chmod — 修改权限

```bash
chmod +x script.sh       # 给所有用户添加执行权限
chmod 755 script.sh      # rwxr-xr-x
chmod 644 file.txt       # rw-r--r--
chmod u+w file.txt       # 给所有者添加写权限
```

数字权限速查：
- `r` = 4，`w` = 2，`x` = 1
- `7` = rwx，`6` = rw-，`5` = r-x，`4` = r--

### chown — 修改所有者

```bash
chown user:group file.txt    # 修改文件的所有者和所属组
chown -R user:group dir/     # 递归修改目录下所有文件
```

## 六、实用技巧

### 管道 | — 将一个命令的输出作为另一个命令的输入

```bash
ps aux | grep nginx       # 筛选包含 nginx 的进程
cat file.txt | wc -l      # 统计文件行数
ls -la | less             # 分页查看长列表
```

### 重定向 > 和 >>

```bash
echo "hello" > file.txt    # 覆盖写入（会清空原有内容）
echo "world" >> file.txt   # 追加写入
```

### 历史命令

```bash
history          # 查看所有历史命令
!100             # 执行第 100 条历史命令
!!               # 执行上一条命令
sudo !!          # 用 sudo 执行上一条命令
```

### Tab 补全

输入命令或文件名的前几个字母，按 `Tab` 键自动补全。按两次 `Tab` 会列出所有可能的选项。这是提高效率的关键技巧！

### 快捷键

- `Ctrl + C`：终止当前运行的命令
- `Ctrl + D`：退出当前 shell（相当于 exit）
- `Ctrl + L`：清屏（相当于 clear）
- `Ctrl + A`：光标移到行首
- `Ctrl + E`：光标移到行尾
- `Ctrl + R`：搜索历史命令

## 总结

以上就是 Linux 最常用的基础命令。刚开始可能记不住，但用多了自然就熟了。建议你：

1. 多动手敲，不要只看
2. 遇到不懂的命令用 `man 命令名` 查看手册
3. 把常用命令整理成自己的速查表

下一篇可以深入学习 Shell 脚本、Vim 编辑器、或者 Linux 系统管理。祝你在 Linux 的世界里玩得开心！
