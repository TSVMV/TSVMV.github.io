---
title: 青岑靶场密码学WP ——1
date: 2026-09-13 12:00:00
categories: [CTF]
tags: [CTF, 密码学, WP]
cover: /img/bg22.jpg
---

# 青岑 CTF crypto WriteUp ——1

> 来源：青岑网安 CTF（ctf.qingcen.net）
>
> 新手做题推荐使用青岑靶场

---

## 目录

- [初识 RSA](#初识-rsa)
- [Copper!!!](#copper)
- [随机数之旅 1](#随机数之旅-1)
- [SageMath 使用指南](#sagemath-使用指南)
- [DLP_1](#dlp_1)
- [FHE: 0&1](#fhe-01)
- [置换](#置换)
- [唯一表示](#唯一表示)
- [RSA_revenge](#rsa_revenge)
- [CBC 之舞](#cbc-之舞)
- [被泄露的素数](#被泄露的素数)
- [随机数之旅 3](#随机数之旅-3)
- [GCL](#gcl)
- [独一无二](#独一无二)
- [随机数之旅 4](#随机数之旅-4)
- [共轭迷宫](#共轭迷宫)
- [三重密钥锁](#三重密钥锁)
- [简约但不简单](#简约但不简单)
- [随机数之旅 1.3](#随机数之旅-13)
- [随机数之旅 1.9](#随机数之旅-19)
- [随机数之旅 2](#随机数之旅-2)
- [Weil 的噪声与秩序](#weil-的噪声与秩序)
- [随机数之旅 3.9](#随机数之旅-39)
- [[Cry] DLP](#cry-dlp)
- [随机数之旅 3.6](#随机数之旅-36)
- [final_R](#final_r)
- [Poly](#poly)
- [LFSR](#lfsr)
- [baby_next](#baby_next)
- [Diffie-Hellman](#diffie-hellman)
- [Ez_RSA](#ez_rsa)
- [Vigenere](#vigenere)
- [Vigenere Advanced](#vigenere-advanced)
- [Ez_LLL](#ez_lll)
- [ez_lattice](#ez_lattice)
- [Ez_wiener](#ez_wiener)
- [ez_DES](#ez_des)
- [lit_elgamal_handshake](#lit_elgamal_handshake)
- [rsa_neighbor](#rsa_neighbor)
- [ezAES](#ezaes)
- [ez_det](#ez_det)
- [ezlegendre](#ezlegendre)
- [ezHalfGCD](#ezhalfgcd)
- [tiny_key_aes](#tiny_key_aes)
- [Ez_ECC](#ez_ecc)
- [Twin Orbit](#twin-orbit)
- [Lunar LCG](#lunar-lcg)
- [Phobos Padding](#phobos-padding)

---

## 初识 RSA

### 题目信息

- 题号：46
- 类型：RSA：模数 n=p³q² 与 p 高位泄露

### 题面

MD5 码怎么解呢？好像有在线工具。

加密脚本构造了一个非常规的 RSA：

```python
from Crypto.Util.number import *
import hashlib

key=b'??????'                  # 6 字节未知
assert len(key)==6
KEY = hashlib.md5(key).hexdigest().encode()   # 已知

flag=b'flag{?????????????}'
m=bytes_to_long(flag)
e=65537
p=getPrime(512)
q=getPrime(512)
n=pow(p,3)* pow(q,2)          # 模数非两个素数之积
c=pow(m,e,n)
P=p^(bytes_to_long(key))      # p 与 key 异或后泄露

print("KEY=",KEY)
print("P=",P)
print("n=",n)
print("c=",c)
```

### 分析

本题目的是掩饰 `p` 的泄露。三处薄弱点叠加：

1. `n = p³q²` 意味着欧拉函数不再是 `(p-1)(q-1)`，但构造上给了我们恢复 `p` 的线索；
2. `key` 仅 6 字节，且其 MD5 值已知，是可解空间极小的弱口令枚举；
3. `P = p ⊕ key` 中 `key` 的比特长度远小于 `p`（48 bit vs 512 bit），异或只扰动 `p` 的低 48 位，高位完好保留。

攻击路径：先枚举 `key` 还原 `p`，再由 `n = p³q²` 解 `q`，最后用通用解密公式 `m = c^d mod n`，其中 `phi = p²(p-1) · q(q-1)`。

### 解题步骤

**Step 1 — 枚举 key**

`key` 为 6 位字符串，特征空间取小写字母 + 数字（36 字符），全集 `36⁶ ≈ 2.18×10⁹`，逐一遍历并计算 `md5(key)` 与 `KEY` 比对。此规模在 Python 秒级跑完，无需字典。

**Step 2 — 还原 p**

```python
p = P ^ int_from_bytes(key)
```

由于 `key < 2^48`，`bytes_to_long(key)` 的高位全 0，异或等价于只翻转 `p` 的低 48 bit。由此直接得到 `p`。

**Step 3 — 恢复 q**

由 `n = p³q²` 得 `q² = n / p³`，对 `n // p³` 开平方根即得 `q`（注意用 `iroot` 后再验证补齐）。

**Step 4 — 解密**

对非常规模数，欧拉函数按质因数重数计算：

```python
phi = p*p*(p-1) * q*(q-1)
d = inverse(e, phi)
m = pow(c, d, n)
```

### EXP

```python
from Crypto.Util.number import long_to_bytes, inverse
import hashlib, gmpy2, itertools, string

KEY = '5ae9b7f211e23aac3df5f2b8f3b8eada'
P   = 8950704257708450266553505566662195919814660677796969745141332884563215887576312397012443714881729945084204600427983533462340628158820681332200645787691506
n   = 44446616188218819786207128669544260200786245231084315865332960254466674511396013452706960167237712984131574242297631824608996400521594802041774252109118569706894250996931000927100268277762882754652796291883967540656284636140320080424646971672065901724016868601110447608443973020392152580956168514740954659431174557221037876268055284535861917524270777789465109449562493757855709667594266126482042307573551713967456278514060120085808631486752297737122542989222157016105822237703651230721732928806660755347805734140734412060262304703945060273095463889784812104712104670060859740991896998661852639384506489736605859678660859641869193937584995837021541846286340552602342167842171089327681673432201518271389316638905030292484631032669474635442148203414558029464840768382970333
c   = 42481263623445394280231262620086584153533063717448365833463226221868120488285951050193025217363839722803025158955005926008972866584222969940058732766011030882489151801438753030989861560817833544742490630377584951708209970467576914455924941590147893518967800282895563353672016111485919944929116082425633214088603366618022110688943219824625736102047862782981661923567377952054731667935736545461204871636455479900964960932386422126739648242748169170002728992333044486415920542098358305720024908051943748019208098026882781236570466259348897847759538822450491169806820787193008018522291685488876743242619977085369161240842263956004215038707275256809199564441801377497312252051117441861760886176100719291068180295195677144938101948329274751595514805340601788344134469750781845
e = 65537

for tup in itertools.product(string.ascii_lowercase + string.digits, repeat=6):
    kb = ''.join(tup).encode()
    if hashlib.md5(kb).hexdigest() == KEY:
        key = tup_digit = int.from_bytes(kb, 'big')
        break
p = P ^ key
q = gmpy2.iroot(n // (p**3), 2)[0]
while q**2 != n // (p**3):
    q += 1
phi = p*p*(p-1)*q*(q-1)
d = inverse(e, phi)
print(long_to_bytes(pow(c, d, n)).decode())
```

### FLAG

```
flag{ECC_1s_4w3s0m3_but_n0t_perf3ct}
```

---

## Copper!!!

### 题目信息

- 题号：495
- 类型：RSA 已知 p 高位 Coppersmith

### 题面

1024 位 RSA，`e = 65537`。给出 `gift = p >> 242 << 242`，即 p 的高 270 位已知，低 242 位未知。

### 分析

1024 位 RSA 泄露了 `p` 的高 270 位，仅低 242 位未知。把未知部分视作多项式 `f(x) = gift + x` 的小根（`x < 2^242`），Coppersmith 定理在 `beta = 0.5` 时允许恢复约 `N^{0.25}` 量级的小根，调小 `epsilon = 0.01` 可把求解上界撑到 `2^242`。求得 `x0` 后恢复完整 `p`，`q = n // p` 常规解密。

### 解题步骤

1. 设 `p = gift + x0`，`x0 < 2^242`，即求 `f(x) = gift + x` 在模 p 意义下的小根。
2. Coppersmith（beta = 0.5）求根：默认 `epsilon = beta/8` 只能覆盖约 2^192，需调小 `epsilon = 0.01` 以扩大 X 到 2^242。
3. 关键细节：sage 实现先将 `f` 转成整系数多项式再构建格（`change_ring(ZZ)`），移位多项式 `x^j * N^(m-i) * f^i` 与 `x^i * f^m` 的系数用整数；若取模 N 会导致前 `m*δ` 行为全零。
4. 解出 `x0` 得 `P = gift + x0`，`Q = n // P`，常规 RSA 解密。

### EXP

```python
R.<x> = PolynomialRing(Zmod(n))
p = high_p + x
x0 = p.small_roots(X=2^242, beta=0.5, epsilon=0.01)[0]
P = int(p(x0))
Q = n // P
assert n == P * Q
d = inverse_mod(65537, (P-1) * (Q-1))
print(long_to_bytes(power_mod(c, d, n)))
```

### FLAG

```
flag{C0pp3r_4nd_mu1t1pl3_pr0gr3ss1ng!!!}
```

---

## 随机数之旅 1

### 题目信息

- 题号：47
- 类型：随机数 / PRNG 预测
- FLAG：动态 FLAG

### 题面

真正的大中衔接 belike.

```python
import uuid
from Crypto.Util.number import getPrime, bytes_to_long
import random

flag = "flag{" + str(uuid.uuid4()) + "}"
message_int = bytes_to_long(flag.encode())

p = getPrime(message_int.bit_length() + 3)
a = getPrime(p.bit_length())

print(f"a = {a}")
print(f"p = {p}")

hint_values = [random.randint(1, p - 1)]

for _ in range(5):
    next_value = (a * hint_values[-1] + message_int) % p
    hint_values.append(next_value)

print("hint =", hint_values)
```

### 分析

生成器是 `GF(p)` 上的一阶仿射递推（左位移寄存器的一种离散形式）：

```
h_{i+1} = a·h_i + m  (mod p)
```

其中 `m` 是明文对应的大整数。`a, p` 与整条 `hint` 序列全部公开。这一结构与 LCG（线性同余生成器）同源——只要两个相邻状态已知，累加的常数 `m` 立即被移除：

```
m ≡ h_1 − a·h_0  (mod p)
```

单次模差分解即可，无需恢复种子 `h_0` 以外的任何信息。flag 是 UUID 形式，明文比特数 ≈ 3 × 37 字节，`p` 恰好取 `message_int.bit_length()+3` 位素数，保证 `0 ≤ m < p` 的还原唯一性。

### 解题步骤

1. 取 `hint[0]` 与 `hint[1]`；
2. 计算 `m = (hint[1] − a·hint[0]) mod p`；
3. `long_to_bytes(m)` 还原 flag。

### EXP

```python
from Crypto.Util.number import long_to_bytes

a    = 295789025762601408173828135835543120874436321839537374211067344874253837225114998888279895650663245853
p    = 516429062949786265253932153679325182722096129240841519231893318711291039781759818315309383807387756431
hint = [184903644789477348923205958932800932778350668414212847594553173870661019334816268921010695722276438808,
        289189387531555679675902459817169546843094450548753333994152067745494929208355954578346190342131249104,
        511308006207171169525638257022520734897714346965062712839542056097960669854911764257355038593653419751,
        166071289874864336172698289575695453201748407996626084705840173384834203981438122602851131719180238215,
        147110858646297801442262599376129381380715215676113653296571296956264538908861108990498641428275853815,
        414834276462759739846090124494902935141631458647045274550722758670850152829207904420646985446140292244]

m = (hint[1] - a*hint[0]) % p
print(long_to_bytes(m).decode())
```

### FLAG

```
flag{c3bc3ead-01e3-491b-aa2d-d2f042449fd6}
```

---

## SageMath 使用指南

### 题目信息

- 题号：48
- 类型：SageMath 有限群阶数计算

### 题面

Sage 9.3.

题目用 SageMath 的置换群与矩阵群接口定义了一连串经典有限群，将其阶数连续乘入 `key`，最后对阶数乘积的二进制表示截取前 `42×8` 位，与密文 `c` 逐位异或：

```python
# Sage 9.3

key=1
G = PSL(2, 11)
key*=G.order()
G = CyclicPermutationGroup(11)
key*=G.order()
G = AlternatingGroup(114)
key*=G.order()
G = PSL(4, 7)
key*=G.order()
G = PSU(3, 4)
key*=G.order()
G = MathieuGroup(12)
key*=G.order()

c=91550542840025722520458836108112308924742424464072171170891749838108012046397534151231852770095499011

key=(int(str(bin(key))[2:][0:42*8],2))
m=c^^key
f=[]
while m>0:
    x=m%256
    f.append(chr(x))
    m//=256
f.reverse()
flag="".join(i for i in f )
print(flag)
```

### 分析

核心是把「群阶」当作密钥材料。若逐群调用 Sage 的 `.order()` 虽直观，但从阶数公式入手完全等价，且不需要依赖 Sage 运行时：

- `PSL(2, q)`：公式 `q(q²−1)/gcd(2, q−1)`，对奇素 `q=11` 即 `(11³−11)/2 = 660`
- `CyclicPermutationGroup(11)`：循环群 `C₁₁`，阶 11
- `AlternatingGroup(114)`：交错群 `A₁₁₄`，阶 `114!/2`
- `PSL(4, q)`：射影特殊线性群，阶 `q^{n(n-1)/2}·∏_{i=2..n}(qⁿ−1) / gcd(n, q−1)`，代入 `n=4,q=7`
- `PSU(3, q)`：射影特殊酉群，阶 `q³·(q²−1)·(q³+1) / gcd(n, q+1)`，代入 `n=3,q=4`
- `MathieuGroup(12)`：马修群 `M₁₂`，阶 95040（经典结论）

`key` 约 705 bit，`bin` 截断到前 336 bit 后与 `c` 异或，`long_to_bytes` 反碱化即可。由于异倒在 42 字节块内，`m < 2^336` 恰为 flag 的字节长度。

### 解题步骤

1. 依次按阶数公式计算六个群的阶并连乘；
2. 对乘积取 `bin(key)[2:][0:336]`，转回整数作为实际 key；
3. `m = c ^ key`；
4. 逐字节 `%256` 收集并反转得到明文。

### EXP

```python
import math

key = 1

# PSL(2, 11)
key *= (11**3 - 11) // 2

# CyclicPermutationGroup(11)
key *= 11

# AlternatingGroup(114)
key *= math.factorial(114) // 2

# PSL(4, 7)
n, q = 4, 7
key *= q**(n*(n-1)//2) * math.prod(q**i - 1 for i in range(2, n+1)) // math.gcd(n, q-1)

# PSU(3, 4)
n, q = 3, 4
key *= q**3 * (q**2 - 1) * (q**3 + 1) // math.gcd(n, q+1)

# MathieuGroup(12)
key *= 95040

c = 91550542840025722520458836108112308924742424464072171170891749838108012046397534151231852770095499011
k2 = int(bin(key)[2:][:42*8], 2)
m = c ^ k2

f = bytearray()
while m > 0:
    f.append(m % 256)
    m //= 256
f.reverse()
print("".join(chr(x) for x in f))
```

### FLAG

```
flag{e142d08c-7e7d-43ed-b5ad-af51ffc512ee}
```

---

## DLP_1

### 题目信息

- 题号：50
- 类型：离散对数（DLP）

### 题面

SageMath 中好像有现成的工具？

题目把 18 字节的 flag 内容切成三份（每份 6 字节），对三个 48 位素数模分别求离散对数给出密文：

```python
from Crypto.Util.number import *
from sympy import primerange

def prime_factors(n):
    res, d = [], 2
    while d * d <= n:
        while n % d == 0:
            res.append(d)
            n //= d
        d += 1 if d == 2 else 2
    if n > 1: res.append(n)
    return res

def find_primitive_root(p):
    phi = p - 1
    facs = set(prime_factors(phi))
    for g in range(2, p):
        if all(pow(g, phi // q, p) != 1 for q in facs):
            return g

flag = b'flag{??????????????????}'   # len == 24
inner = flag[5:-1]
n = len(inner) // 3
parts = [inner[i*n:(i+1)*n] for i in range(3)]

p, g, h = [], [], []
for i in range(3):
    p.append(getPrime(48))
    g.append(find_primitive_root(p[i]))
    x = bytes_to_long(parts[i])
    h.append(pow(g[i], x, p[i]))

print(p)
print(g)
print(h)
```

输出数据：

```
p=[189869646048037, 255751809593851, 216690843046819]
g=[5, 3, 3]
h=[78860859934701, 89478248978180, 81479747246082]
```

### 分析

这是经典的离散对数问题（DLP）：已知 `g`、`h`、`p`，求 `x` 使 `g^x ≡ h (mod p)`。单个模数仅 48 位，群阶 `p−1` 约 48 位，远小于可直接用大步小步算法（Baby-step Giant-step，BSGS）暴力求解的量级（O(√p) ≈ 2²⁴），无需 Pohlig-Hellman。

需要注意一个细节：明文分片是 6 字节，对应整数范围 0~2⁴⁸；而 `dlog` 只给出 `x mod (p−1)`。若真实分片数值恰好落在 `[p−1, 2⁴⁸)` 区间，需要沿周期候选 `x₀ + k·(p−1)` 内寻找可打印的字节串。

### 解题步骤

1. 对每一组 `(g, h, p)` 用 BSGS 求小于 `p−1` 的 `x₀`（标准实现，大步存表、小步查 `h·g^(-im)`）；
2. 枚举候选 `x = x₀ + k·(p−1)`（`k` 从 0 起，直至超过 2⁴⁸），用 `long_to_bytes(x, 6)` 还原为字节并筛选可打印 ASCII；
3. 拼接三段得 18 字节内文，包上 `flag{...}`。

### EXP

```python
from math import isqrt
from Crypto.Util.number import long_to_bytes

p = [189869646048037, 255751809593851, 216690843046819]
g = [5, 3, 3]
h = [78860859934701, 89478248978180, 81479747246082]

def bsgs(g, h, p):
    m = isqrt(p - 1) + 1
    baby = {}
    cur = 1
    for j in range(m):
        baby.setdefault(cur, j)
        cur = cur * g % p
    ginv_m = pow(g, p - 1 - m, p)          # g^(-m)
    cur = h
    for i in range(m):
        if cur in baby:
            x = i * m + baby[cur]
            if pow(g, x, p) == h:
                return x
        cur = cur * ginv_m % p
    return None

def printable(bs):
    return all(32 <= b < 127 for b in bs)

inner = b""
for i in range(3):
    x0 = bsgs(g[i], h[i], p[i])
    assert x0 is not None
    k = 0
    chosen = None
    while x0 + k * (p[i] - 1) < (1 << 48):
        x = x0 + k * (p[i] - 1)
        seg = long_to_bytes(x, 6)
        if printable(seg):
            chosen = seg
            break
        k += 1
    assert chosen is not None
    inner += chosen

print(inner)
print(b"flag{" + inner + b"}")
```

输出：

```
b'I_l0v3_DLPPPPP^.^!'
b'flag{I_l0v3_DLPPPPP^.^!}'
```

### FLAG

```
flag{I_l0v3_DLPPPPP^.^!}
```

内文三段拼接为 `I_l0v3` + `_DLPPP` + `PP^.^!`，共 18 字符，与题设 `len(flag)==24` 吻合。

---

## FHE: 0&1

### 题目信息

- 题号：51
- 类型：全同态加密 FHE 比特加密
- FLAG：动态 FLAG

### 题面

千里之堤，溃于蚁穴。

题目生成一个 128 位素数 `p`，对 flag 的每个比特独立做一次加解密：

- 公钥 `pk_i = p * rand_multiplier + rand_offset`，其中 `rand_multiplier ∈ [p/4, p/2]`、`rand_offset ∈ [1, 10]`；
- 密文 `c_i = bit + small_noise + large_noise`，其中 `small_noise = 2 * randint(1, p // 2^64)`（偶数），`large_noise = p * randint(p//4, p//2)`（p 的整数倍）。

附件给 `pk.txt`（336 个公钥）与 `c.txt`（336 个密文）。

### 分析

两道突破口：

1. **求素数 `p`**：`pk_i ≡ rand_offset_i (mod p)`，且 `rand_offset_i ∈ [1, 10]`。取三个公钥分别减去 1~10 内的偏移做三元 GCD：
   `gcd(pk_0 − r₀, pk_1 − r₁, pk_2 − r₂) = p · gcd(a_0, a_1, a_2)`，三个大素数在 `[p/4, p/2]` 内随机，GCD 大概率恰为 `p`。用 `gmpy2.is_prime` 过滤 128 位素数即得 `p`。
2. **奇偶性泄露明文比特**：`c_i mod p = bit + small_noise`（`large_noise` 因是 `p` 的倍数被消去，且 `small_noise < p` 无需取模）。`small_noise` 是偶数，所以 `(c_i mod p) 的奇偶性 = bit`，直接读出明文。

### 解题步骤

1. 枚举 `r₀, r₁, r₂ ∈ [1, 10]` 共 1000 组，对 `(pk_0 − r₀, pk_1 − r₁, pk_2 − r₂)` 求 GCD，选出 128 位素数即 `p`；
2. 逐条 `bits[i] = (c_i % p) & 1`；
3. 按 8 个一组组字节转 ASCII，得明文，包上 `flag{}`。

### EXP

```python
import ast, math
import gmpy2

pk = ast.literal_eval(open('pk.txt').read())
c  = ast.literal_eval(open('c.txt').read())

p = None
for r0 in range(1, 11):
    for r1 in range(1, 11):
        for r2 in range(1, 11):
            g = math.gcd(math.gcd(pk[0] - r0, pk[1] - r1), pk[2] - r2)
            if 126 <= g.bit_length() <= 130 and gmpy2.is_prime(g):
                p = int(g)
                break
        if p:
            break
    if p:
        break

bits = [(ci % p) & 1 for ci in c]

out = []
for i in range(0, len(bits), 8):
    byte = 0
    for b in bits[i:i+8]:
        byte = byte * 2 + b
    out.append(chr(byte))
print(''.join(out))
```

### FLAG

```
flag{3235c1ab-6830-480f-b5e0-39be40b94a7d}
```

---

## 置换

### 题目信息

- 题号：52
- 类型：置换群与轮换表示

### 题面

我一看数学就头疼怎么办？把解密出的文本用 `flag{}` 包裹即为最终 FLAG。

题目介绍「置换」（permutation）与轮换表示法，定义了一个 `S_26` 上的复合置换作用于 `A=1 ... Z=26` 的字母：

```
F = (1 2 3 4 5 6 7)(8 9 10 11 12 13 14) ∘ (1 3 5 7)(2 4 6)(8 10 12 14)
```

约定 `σ₂ ∘ σ₁(x) = σ₂(σ₁(x))`，即先作用右侧置换再作用左侧。

密文：

```
SUFK_D_SJNPHA_PARNUTDTJOI_WJHH_GACJIJTAHY_IOT_STUNP_YOU.
```

### 分析

按「A=1 ... Z=26」编码，每个轮换 `(a b c …)` 表示 `a→b, b→c, …, 末→a`。F 是两个轮换组的复合，逐字母做值域映射即可得到置换表；非字母字符（`_`、`.`）不参与置换、原样保留。解密即求逆映射 `F⁻¹`：把密文每个字母替换为「F 映射中指向该字母的原文字母」。

### 解题步骤

1. 按轮换生成 F 的完整映射 `1..26`；
2. 构造逆映射 `F⁻¹`；
3. 对密文逐字符：若为 A–Z 则替换为 `F⁻¹(值)`，否则原样保留；
4. 包上 `flag{}`。

### EXP

```python
def apply_cycles(v, cycles):
    for cyc in cycles:
        if v in cyc:
            return cyc[(cyc.index(v) + 1) % len(cyc)]
    return v

L = [[1,2,3,4,5,6,7],[8,9,10,11,12,13,14]]
R = [[1,3,5,7],[2,4,6],[8,10,12,14]]

F_map = {}
for v in range(1, 27):
    F_map[v] = apply_cycles(apply_cycles(v, R), L)
F_inv = {fv: v for v, fv in F_map.items()}

cipher = "SUFK_D_SJNPHA_PARNUTDTJOI_WJHH_GACJIJTAHY_IOT_STUNP_YOU."

def dec(ch):
    o = ord(ch)
    return chr(64 + F_inv[o - 64]) if 65 <= o <= 90 else ch

plain = ''.join(dec(ch) for ch in cipher)
print("flag{" + plain + "}")
```

输出：

```
flag{SUCH_A_SIMPLE_PERMUTATION_WILL_DEFINITELY_NOT_STUMP_YOU.}
```

对明文重新施加 F 可得回原密文，校验一致。

### FLAG

```
flag{SUCH_A_SIMPLE_PERMUTATION_WILL_DEFINITELY_NOT_STUMP_YOU.}
```

---

## 唯一表示

### 题目信息

- 题号：49
- 类型：中国剩余定理（CRT）
- FLAG：动态 FLAG

### 题面

不要把鸡蛋放在同一个篮子里。

题目把整数 `message_int` 对递增素数序列「切分」为一组余数，直到这些余数 + 模数能通过中国剩余定理（CRT）唯一重建原值。模数集合从 `[2]` 开始，逐个追加素数，直到 `crt(moduli, remainders)` 恰好等于原整数为止。附件给出 54 个余数：

```python
from sympy.ntheory.modular import crt
from Crypto.Util.number import bytes_to_long
from sympy import primerange
import uuid

flag = "flag{" + str(uuid.uuid4()) + "}"
message_int = bytes_to_long(flag.encode())

def fun(n: int):
    used_primes = [2]
    prime_index = 1
    while True:
        remainders = [n % p for p in used_primes]
        reconstructed, _ = crt(used_primes, remainders)
        if reconstructed == n:
            return remainders
        used_primes.append(primes[prime_index])
        prime_index += 1

c = fun(message_int)
print(c)
```

输出（54 个余数，对应前 54 个素数从 2 起）：

```
[1, 2, 2, 4, 0, 2, 11, 11, 8, 23, 1, 30, 35, 0, 18, 30, 55, 60, 29, 42, 8, 13, 49, 11, 69, 26, 8, 73, 84, 67, 100, 9, 77, 72, 127, 49, 57, 74, 70, 129, 146, 45, 35, 180, 196, 101, 100, 146, 100, 194, 2, 161, 35, 155]
```

### 分析

「不要把所有鸡蛋放在同一个篮子」是字面隐喻：单个素数模的余数无法唯一确定一个任意大的整数（模 `p` 的余数只有 `p` 个可能），但把整数对一篮子互素模（素数序列）取余后，**中国剩余定理**保证只要模数乘积大于目标值，余数组就唯一确定原值。这是经典的多模数编码 / 模差分解。明文是 37 字节的 UUID flag（约 296 bit），54 个素数的乘积约 700 bit，远超明文规模，因此重建唯一。

### 解题步骤

1. 取前 `len(c)` 个素数（从 2 起）作为模数序列；
2. `crt(moduli, c)` 一次重建大整数；
3. `long_to_bytes` 转回字节得 flag。

### EXP

```python
from sympy import primerange
from sympy.ntheory.modular import crt
from Crypto.Util.number import long_to_bytes

c = [1, 2, 2, 4, 0, 2, 11, 11, 8, 23, 1, 30, 35, 0, 18, 30, 55, 60, 29, 42,
     8, 13, 49, 11, 69, 26, 8, 73, 84, 67, 100, 9, 77, 72, 127, 49, 57,
     74, 70, 129, 146, 45, 35, 180, 196, 101, 100, 146, 100, 194, 2, 161,
     35, 155]

primes = list(primerange(2, 114514))[:len(c)]
m, _ = crt(primes, c)
print(long_to_bytes(m).decode())
```

### FLAG

```
flag{9c8589c2-aecb-4ec4-b027-654bc322e2d1}
```

---

## RSA_revenge

### 题目信息

- 题号：53
- 类型：RSA：素数幂模 + Fermat 提示

### 题面

把 flag 拆成前后两半分别加密：前半段走 par1（模 `n1` 为三个 512 位素数各自的小幂乘积），后半段走 par2（模 `n2` 为三个 512 位素数乘积，并附带三个 hint）。题面脚本：

```python
def par1(m):
    lst = []                                  # 3 个 512-bit 素数
    while len(lst) < 3:
        prime = getPrime(512)
        if prime not in lst:
            lst.append(prime); print(prime)
    n1 = 1
    for prime in lst:
        tmp = random.randint(2, 7)           # 每个素数提升到 2~7 次幂
        n1 *= prime ** tmp
    e = 65537
    c1 = pow(m, e, n1)
    print(f"list：{lst}"); print(f"n1={n1}"); print(f"c1={c1}")

def par2(m):
    p2 = getPrime(512); q2 = getPrime(512); r2 = getPrime(512)
    n2 = p2 * q2 * r2
    hint1 = pow(m, p2 * q2, n2)
    hint2 = pow(m, r2, n2)                   # "怎么用 hint1/hint2？试 Fermat"
    hint3 = p2 + q2                          # "知道 p+q 和 p*q 能做什么？"
    e = 65537
    c2 = pow(m, e, n2)
    print(f"n2={n2}"); print(f"hint1={hint1}"); print(f"hint2={hint2}")
    print(f"hint3={hint3}"); print(f"c2={c2}")
```

附件给出 `list=[p1,p2a,p3]`、`n1`、`c1`、`n2`、`hint1`、`hint2`、`hint3`、`c2` 全部数值。

### 分析

**par1**：`n1 = p1^a * p2^b * p3^c`，各素因子 512 位，幂次 `a,b,c ∈ [2,7]`。素因子本身已泄露，只需确定每个素数在 `n1` 中的精确幂次：从 `n1` 中连续整除该素数计数即可。对每个素因子 `p^k` 单独求 `d = e^-1 mod φ(p^k)`（`φ(p^k)=p^(k-1)(p-1)`），解 `m ≡ c1^d (mod p^k)`，再用 CRT 在互素模 `p1^a, p2^b, p3^c` 上合并。

**par2**：`n2 = p2*q2*r2`（三个 512 位素数），`hint3 = p2+q2`，`hint2 = m^r2 mod n2`，`c2 = m^e mod n2`（`e=65537`）。直接分解 1535 位的 `n2` 不现实。关键在 `hint2`：

- `hint2 = m^r2 (mod n2)`，所以 `hint2^e = m^(r2*e) (mod n2)`；
- 对素因子 `r2`，由 Fermat 小定理 `m^(r2-1) ≡ 1 (mod r2)`，得 `m^(r2*e) = (m^e)^(r2) ≡ m^e (mod r2)`；
- 而 `c2 = m^e (mod n2)`，模 `r2` 取余就是 `m^e (mod r2)`；
- 因此 `hint2^e - c2 ≡ 0 (mod r2)`，即 **`r2 | (hint2^e - c2)`**。

对 `p2, q2` 该同余不成立（它们不整除这个差），故 `gcd(n2, hint2^e - c2)` 恰好取出 `r2`。得到 `r2` 后，`p2*q2 = n2/r2`，又已知 `hint3 = p2+q2`，于是

```
φ(n2) = (p2-1)(q2-1)(r2-1)
      = (p2*q2 - p2 - q2 + 1) * (r2-1)
      = ((n2/r2) - hint3 + 1) * (r2-1)
```

求出 `φ(n2)` 后，`d2 = e^-1 mod φ(n2)`，`m2 = c2^d2 mod n2` 即后半明文。

### 解题步骤

1. par1：对 `list` 中每个素数数其 `n1` 中的幂次；分别对 `p^k` 解 RSA；CRT 合并得 `m1`。
2. par2：`r2 = gcd(n2, hint2^e - c2)`；`φ(n2) = (n2/r2 - hint3 + 1)*(r2-1)`；`d2 = e^-1 mod φ(n2)`；`m2 = c2^d2 mod n2`。
3. `m1`、`m2` 拼回 flag。

### EXP

```python
import re
from gmpy2 import mpz, gcd, is_prime
from Crypto.Util.number import long_to_bytes, inverse
from sympy.ntheory.modular import crt

src = open('[Cry]RSA_revenge.py').read()   # 附件原文，含全部数值
e = 65537

# ---- Part 1 ----
n1  = int(re.search(r'n1=(\d+)', src).group(1))
c1  = int(re.search(r'c1=(\d+)', src).group(1))
lst = [int(x) for x in re.search(r'list：\[(\d+),\s*(\d+),\s*(\d+)\]', src).groups()]

def ppow_in(n, p):
    a = 0
    while n % p == 0:
        n //= p; a += 1
    return a

res, mods = [], []
for p in lst:
    k   = ppow_in(n1, p)                 # 该素数在 n1 中的幂次
    phi = p ** (k - 1) * (p - 1)
    d   = inverse(e, phi)
    res.append(pow(c1, d, p ** k))
    mods.append(p ** k)

m1, _ = crt(mods, res)
print("m1:", long_to_bytes(m1))

# ---- Part 2 ----
n2  = mpz(re.search(r'n2=(\d+)', src).group(1))
h2  = mpz(re.search(r'hint2=(\d+)', src).group(1))
h3  = mpz(re.search(r'hint3=(\d+)', src).group(1))
c2i = int(re.search(r'c2=(\d+)', src).group(1))

# Fermat: r2 | (hint2^e - c2)
r2 = gcd(n2, h2 ** e - c2i)
assert is_prime(r2)

p2q2 = n2 // r2                              # = p2 * q2
phi2 = int(r2 - 1) * int(p2q2 - h3 + 1)      # (p2-1)(q2-1)(r2-1), 用 hint3=p2+q2
d2   = pow(e, -1, phi2)
m2   = pow(c2i, d2, int(n2))
print("m2:", long_to_bytes(m2))

flag = long_to_bytes(m1).decode() + long_to_bytes(m2).decode()
print("FLAG:", flag)
```

输出：

```
m1: b'flag{Ooooo6_y0u_kn0w_F3rm'
m2: b'@t_and_Eu13r_v3ry_w3ll!!}'
FLAG: flag{Ooooo6_y0u_kn0w_F3rm@t_and_Eu13r_v3ry_w3ll!!}
```

### FLAG

```
flag{Ooooo6_y0u_kn0w_F3rm@t_and_Eu13r_v3ry_w3ll!!}
```

---

## CBC 之舞

### 题目信息

- 题号：54
- 类型：AES-CBC 密文块置换

### 题面

截获了「影子信使」组织的两段 AES-CBC 通信。该方案在标准 CBC 之外，把 4 个密文块按某个不含不动点的置换 `perm` 洗成 `c1` 再解回 `m1`，声称"即使多给一对明密文也无法推断其他信息"。附件给出：

```python
IV1 (hex): 1e5d251ea78ef68a1282079fd028c747
IV2 (hex): 18777ae4c1a29f4c5db8ba6c5dfe72f1
m1 (hex): f560fd28ed5c5ce7d952eb44b47007e702f42dbb54540dfc78467f48933dbb01
          ebcf520fd3d23a211d3b4e8c06261966cb178525c25b8058ff792e0f251d3d15
c1 (hex): caf7bc1223c17f848aec854a87b8958d4c518f7287663bfae0b6a5a1e0f0eb95
          b50c9ea6789a7d77fda5f50d1b8a2183b40cab693ebacf32a9b59faf3b0084ff
c2 (hex): b40cab693ebacf32a9b59faf3b0084ffcaf7bc1223c17f848aec854a87b8958d
          b50c9ea6789a7d77fda5f50d1b8a21834c518f7287663bfae0b6a5a1e0f0eb95
```

加密流程（来自附件 `task.py`）：

```python
# c2 是 pad(m2) 的 AES-CBC 加密（key=K, iv=IV2）
# perm 是 [0,1,2,3] 的洗牌且无不动点
c1_blocks = [c2_blocks[i] for i in perm]
c1 = b''.join(c1_blocks)
# m1 是 c1 用 (K, IV1) 的 CBC 解密结果
m1 = AES.new(K, CBC, IV1).decrypt(c1)
```

### 分析

`m1` 不是"洗过序的 m2 明文"，而是 **CBC 链被打乱后的中间量**。设 `AESdec_K(x)` 记块解密，`c2` 的 4 个块为 `cb[0..3]`，则：

- `c1` 的块 `c1b[j] = cb[perm[j]]`，所以它的前驱块 `c1_{j-1} = cb[perm[j-1]]`（`j=0` 时前驱是 `IV1`）。
- CBC 解密：`m1b[j] = AESdec_K(c1b[j]) ⊕ (IV1 if j==0 else c1b[j-1])`。
- 而 `AESdec_K(cb[perm[j]])` 恰好是对 `cb[perm[j]]` 的标准解密量。

由于 `cb[i]` 是 `pad(m2)` 的 CBC 密文，标准关系是 `P[i] = AESdec_K(cb[i]) ⊕ (IV2 if i==0 else cb[i-1])`，其中 `P` 就是 `pad(m2)`。把 `m1` 拆块代回即可求出每一块 `P[i]`，拼起来 unpad 得到 `m2` 明文。全程无需 key。

### 解题步骤

1. 由 `c1`、`c2` 块匹配求出 `perm`：对每个 `c1b[j]`，在 `cb` 中定位下标（本例 `perm=[1,3,2,0]`）。
2. 对每个 `j`：`D = m1b[j] ⊕ (IV1 if j==0 else c1b[j-1])`，即 `AESdec_K(cb[perm[j]])`。
3. 还原 `P[perm[j]] = D ⊕ (IV2 if perm[j]==0 else cb[perm[j]-1])`。
4. 按 `0..3` 拼 `P`，unpad 得 `m2`。

### EXP

```python
from Crypto.Util.Padding import unpad

IV1 = bytes.fromhex("1e5d251ea78ef68a1282079fd028c747")
IV2 = bytes.fromhex("18777ae4c1a29f4c5db8ba6c5dfe72f1")
m1  = bytes.fromhex("f560fd28ed5c5ce7d952eb44b47007e702f42dbb54540dfc78467f48933dbb01"
                    "ebcf520fd3d23a211d3b4e8c06261966cb178525c25b8058ff792e0f251d3d15")
c1  = bytes.fromhex("caf7bc1223c17f848aec854a87b8958d4c518f7287663bfae0b6a5a1e0f0eb95"
                    "b50c9ea6789a7d77fda5f50d1b8a2183b40cab693ebacf32a9b59faf3b0084ff")
c2  = bytes.fromhex("b40cab693ebacf32a9b59faf3b0084ffcaf7bc1223c17f848aec854a87b8958d"
                    "b50c9ea6789a7d77fda5f50d1b8a21834c518f7287663bfae0b6a5a1e0f0eb95")

cb  = [c2[i:i+16] for i in range(0, len(c2), 16)]
c1b = [c1[i:i+16] for i in range(0, len(c1), 16)]
m1b = [m1[i:i+16] for i in range(0, len(m1), 16)]

perm = [cb.index(blk) for blk in c1b]          # 块级置换
def xor(a, b):
    return bytes(x ^ y for x, y in zip(a, b))

P = [None] * 4
for j in range(4):
    D = xor(m1b[j], IV1 if j == 0 else c1b[j-1])   # AESdec_K(cb[perm[j]])
    p = perm[j]
    P[p] = xor(D, IV2 if p == 0 else cb[p-1])       # 还原 pad(m2) 的第 p 块

m2 = b''.join(P)
print(unpad(m2, 16).decode())
```

输出：

```
flag{cbc_dancing_1s_the_best_XD_miaowu~_wangang~}
```

### FLAG

```
flag{cbc_dancing_1s_the_best_XD_miaowu~_wangang~}
```

---

## 被泄露的素数

### 题目信息

- 题号：55
- 类型：RSA 素数高位泄露

### 题面

RSA 公钥参数 `n`、`e` 与密文 `ciphertext.bin` 直接给出，同时泄露了素数 `p` 的部分高位内容 `partial_p.txt`。题目源码：

```python
from Crypto.Util.number import *
import gmpy2
nbits = 2048
p = getPrime(nbits//2)
q = getPrime(nbits//2)
n = p*q
e = 65537

p_bits = int(p).bit_length()          # 1024
high_bit_count = int(p_bits * 2 / 3)  # 682
p_high = p >> (p_bits - high_bit_count)   # p 右移 342，保留高 682 位
mask = (1 << (high_bit_count - 3)) - 1    # (1<<679)-1
p_high_masked = p_high & mask             # 再截断最高 3 位

with open("public_key.pem", "w") as f:
    f.write(f"n = {n}\ne = {e}")
with open("partial_p.txt", "w") as f:
    hex_str = hex(p_high_masked)[2:]
    f.write("???" + hex_str)
c = pow(bytes_to_long(flag), e, n)
with open("ciphertext.bin", "wb") as f:
    f.write(long_to_bytes(c))
```

### 分析

泄露流程是"先右移 `342` 位丢掉 `p` 的低位，再用 `(1<<679)-1` 做与运算把最高 3 位也抹掉"。因此泄露的其实是 `p` 的**中间 679 位**（`bit[342..1020]`），缺失的部分是：

- 低 342 位（完全未知）；
- 最高 3 位（`bit[1021..1023]`，可枚举，且 `bit1023` 必为 1，从 `100` 枚举到 `111` 即可）。

恢复策略：枚举最高 3 位补全得到 682 位的 `p_high`，设 `p = (p_high << 342) + x`，其中未知量 `x < 2^342`。因为 `p | n`，这是一个典型的 Coppersmith"已知高位恢复素因子"问题——对一元多项式 `f(x) = (p_high<<342) + x` 求小根 `x0`，使 `f(x0)` 整除 `n`。已知高位比例约 `682/1024 ≈ 0.666`，远大于阈值，Coppersmith（LLL）可解。附件给出：

```
partial_p (去掉 ???) = 5708...d6d43b   (679 bit)
```

### 解题步骤

1. 读出 `n = 2193...72937`，`e = 65537`，密文字节，以及 `p_masked`（679 bit hex）。
2. 枚举最高 3 位 `i ∈ {4,5,6,7}`（二进制 `100~111`），拼出 682 位 `p_high = int(bin(i)[2:] + bin(p_masked)[2:], 2)`。
3. 令 `p0 = p_high << 342`，对 `f(x) = p0 + x` 跑 Coppersmith 求 `x0 < 2^342` 使 `p0+x0 | n`。
4. 取 `p = p0 + x0`，`q = n // p`，正常 RSA 解密。
5. 本题在 `i=6`（`110`）时解出。

### EXP

```python
import math, mpmath as mp
from fpylll import IntegerMatrix, LLL
from Crypto.Util.number import long_to_bytes, inverse

mp.mp.dps = 2000

def poly_mul(a, b):
    r = [0]*(len(a)+len(b)-1)
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            r[i+j] += x*y
    return r

def poly_pow(p, k):
    r = [1]
    for _ in range(k):
        r = poly_mul(r, p)
    return r

def small_roots_p(p0, N, X, beta=0.4):
    """单变量 Coppersmith：求 x0<X 使 (p0+x0)|N，取 LLL 第一行多项式整数根。"""
    delta = 1
    epsilon = beta / 8
    m = int(math.ceil(max(beta**2/(delta*epsilon), 7*beta/delta)))
    t = int(math.floor(delta*m*(1/beta - 1)))
    ncols = delta*m + t
    f = [p0, 1]
    g = []
    for i in range(m):
        g.append([c * (N**(m-i)) for c in poly_pow(f, i)])
    fm = poly_pow(f, m)
    for i in range(t):
        g.append([0]*i + fm)
    mat = IntegerMatrix(len(g), ncols)
    for gi, gg in enumerate(g):
        for j in range(min(len(gg), ncols)):
            if gg[j]:
                mat[gi, j] = gg[j] * (X**j)
    LLL.reduction(mat)
    row = [mat[0, c] for c in range(ncols)]
    cff = [row[j] // (X**j) for j in range(ncols)]
    roots = mp.polyroots([mp.mpf(c) for c in cff[::-1]], maxsteps=1000, extraprec=2000)
    for rt in roots:
        if abs(rt.imag) < mp.mpf('1e-500') and abs(rt.real - mp.nint(rt.real)) < mp.mpf('1e-500'):
            x0 = int(mp.nint(rt.real))
            if 0 < x0 < X and N % (p0 + x0) == 0:
                return x0
    return None

n   = int(open('public_key.pem').read().split('n = ')[1].split('\n')[0].strip())
e   = 65537
hx  = open('partial_p.txt').read().strip()[3:]       # 去掉 ???
p_masked = int(hx, 16)
phstr = bin(p_masked)[2:]                            # 679 bit

X = 1 << 342
for i in range(4, 8):                                # 枚举最高 3 bit
    p_high = int(bin(i)[2:] + phstr, 2)
    p0 = p_high << 342
    x0 = small_roots_p(p0, n, X, beta=0.4)
    if x0 is not None:
        p = p0 + x0
        q = n // p
        print('p bits:', p.bit_length(), 'q bits:', q.bit_length())
        c = int.from_bytes(open('ciphertext.bin', 'rb').read(), 'big')
        d = inverse(e, (p-1)*(q-1))
        print('FLAG:', long_to_bytes(pow(c, d, n)).decode())
        break
```

输出：

```
p bits: 1024 q bits: 1024
FLAG: flag{wh3n_th3_m0dul3_i3_bi9_en0ugh_U_c@n_c0ns1der_u3ing_coppersmith}
```

### FLAG

```
flag{wh3n_th3_m0dul3_i3_bi9_en0ugh_U_c@n_c0ns1der_u3ing_coppersmith}
```

---

## 随机数之旅 3

### 题目信息

- 题号：56
- 类型：欠定线性方程组
- FLAG：动态 FLAG

### 题面

用来自定义写法生成一组欠定线性方程组，flag 的每个字符作为未知数：

```python
p = random_prime(2**20)
m = len(flag) - 1
A = matrix(Zmod(p), m, len(flag), [random.randint(p//2, p-1) for _ in range(m*len(flag))])
x = vector([ord(i) for i in flag])
b = A * x
```

输出 `p`、`A`（(m × m+1) 矩阵）、`b`。本题 `p = 5323`，`A` 为 41×42 矩阵，flag 长 42。

### 分析

方程数 m = 41 比未知数 n = 42 少一个，秩满时为 **1 维欠定系统**。写成

```
A_left · x_left + a·x_{n-1} ≡ b  (mod p)
```

令最后一个字符 `x_{n-1} = t` 为自由参数，所有解可表示为 `x(t) = x0 + t·xk (mod p)`。因为 flag 的每个字符必须是可打印 ASCII（32~126），而 `t ∈ [0, p)` 只有 5323 个候选，直接遍历即可筛出唯一解。

### 解题步骤

1. 将 `A` 拆成前 41 列 `A_left` 与最后一列向量 `a`。
2. 模 p 求逆解出 `x0 = A_left⁻¹·b` 与 `xk = -A_left⁻¹·a`。
3. 对 `t = 0..p-1` 计算 `x(t) = (x0 + t·xk) mod p`，当全部落在 32~126 且以 `flag{` 开头即命中。
4. 命中 `t = 125`。

### EXP

```python
import ast

lines = open('output.txt').read().splitlines()
p = int(lines[0])
A = [list(r) for r in ast.literal_eval(lines[1])]
b = ast.literal_eval(lines[2])
rows = len(b); n = len(A[0])

def inv_mod(a, mod): return pow(a, -1, mod)

def solve_linear(Mr, rhs, p):
    N = len(Mr)
    M = [Mr[i][:] + [rhs[i]] for i in range(N)]
    for c in range(N):
        piv = next(i for i in range(c, N) if M[i][c] % p != 0)
        M[c], M[piv] = M[piv], M[c]
        inv = inv_mod(M[c][c] % p, p)
        M[c] = [(x * inv) % p for x in M[c]]
        for i in range(N):
            if i != c and M[i][c] % p != 0:
                f = M[i][c] % p
                M[i] = [(vi - f*vj) % p for vi, vj in zip(M[i], M[c])]
    return [M[i][N] for i in range(N)]

A_left = [row[:n-1] for row in A]
a = [row[n-1] for row in A]
x0 = solve_linear(A_left, b, p)
xk = [(-v) % p for v in solve_linear(A_left, a, p)]

for t in range(p):
    x = [(x0[i] + t*xk[i]) % p for i in range(rows)] + [t % p]
    if all(32 <= c <= 126 for c in x):
        s = ''.join(chr(c) for c in x)
        if s.startswith('flag{'):
            print('t =', t)
            print('FLAG:', s)
            break
```

输出：

```
t = 125
FLAG: flag{1f59622f-ccbc-45c0-b9f5-731a51343027}
```

### FLAG

```
flag{1f59622f-ccbc-45c0-b9f5-731a51343027}
```

---

## GCL

### 题目信息

- 题号：57
- 类型：广义线性同余生成器 GCL
- FLAG：动态 FLAG

### 题面

加密流程给出公共参数：`c = m ^ key` 与 10 个"礼物"数值，来自一个 GCL（Generalized LCG）生成器：

```python
p = getPrime(length+1)
a = random.randint(2, p-1)
b = random.randint(2, p-1)
s = random.randint(2, p-1)
gift = []                                  # 收集连续 10 个 s 值
while len(gift) < 10:
    s = (a * inverse(s, p) + b) % p
    if s != 0:
        gift.append(s)
key = (a * inverse(s, p) + b) % p          # key = s_11
return m ^ key, gift
```

### 分析

递推为分式变换 `s_{k+1} = a/s_k + b (mod p)`，p、a、b 都不公开。对三个连续项有：

```
s_{k+1}·s_k  ≡ a + b·s_k        (1)
s_{k+2}·s_{k+1} ≡ a + b·s_{k+1}  (2)
```

(2) - (1) 消去 a：

```
b ≡ s_{k+1}·(s_{k+2} - s_k) / (s_{k+1} - s_k)   (mod p)
```

任意两个不同 k 得到的 `B` 值同余于 b，其差为 p 的倍数。先精确计算有理数 `B_k`，再对差取 gcd，即可恢复素数 p；之后反解出 a、b，算出 key = s_11。

### 解题步骤

1. 对 `k = 0..7` 构造有理数 `B_k = gift[k+1]·(gift[k+2]-gift[k]) / (gift[k+1]-gift[k])`。
2. `p = gcd(B_k - B_0)`，剔除偶然小因子后为素数。
3. 由 `s_1,s_2,s_3` 反解 `b`，再由 `a = s_1·s_2 - b·s_1` 得 `a`。
4. `key = a/s_10 + b`，`m = c ⊕ key`。
5. 转字节即得 flag。

### EXP

```python
from fractions import Fraction
from math import gcd
import gmpy2
from Crypto.Util.number import long_to_bytes

c = 18160008429568445340421193226402615775962630020115351294214303830750860843808409781742323237344243089
gift = [131865585354798388503853664204045577497186238155562615801484830104683890877181087005834317031942408283,
        109059933499981578098773732552241207995570220834770592696583461488231579239704140357451421969855041379,
        98201806091494704187082836852065059816140437191793644297243874711016194459625411781009291718075199135,
        18757271931319533257322147585629190099147626954402651433709338855513752753972712032016018862573500407,
        44414575833831572247180084691462875843855281105693674992974405001127527490917389843309074213475473796,
        119230797767846495009095216222595719657467391997837145037599770904490776264420156248960485317227292047,
        55025298938239176714746988606097305944000798467396224542466354530737718336537150422546120714654987068,
        61108071970379547679922902146574052023820080507110885404335008795305785800023228103358713867748030391,
        73121196162106845765032066055951000614569505693120119413603886103757507878101072263238094066564654117,
        41442768650713930642944746020790921582963259300977583069055974755273373804142970727737438848232141888]

def B(k):
    return Fraction(gift[k+1]*(gift[k+2]-gift[k]), gift[k+1]-gift[k])

Bs = [B(k) for k in range(8)]
g = 0
for k in range(1, 8):
    diff = Bs[k] - Bs[0]
    g = gcd(g, int(diff.numerator))
p = g
for pr in (2, 3, 5, 7, 11, 13, 17, 19, 23):
    while p % pr == 0:
        p //= pr
assert gmpy2.is_prime(p)

s1, s2, s3 = gift[0], gift[1], gift[2]
b = (s2 * (s3 - s1) % p) * pow(s2 - s1, -1, p) % p
a = (s1 * s2 - b * s1) % p
key = (a * pow(gift[9], -1, p) + b) % p          # key = s_11
print(long_to_bytes(c ^ key).decode())
```

输出：

```
flag{2eac1c79-8abd-465e-82f4-96beffed69e4}
```

### FLAG

```
flag{2eac1c79-8abd-465e-82f4-96beffed69e4}
```

---

## 独一无二

### 题目信息

- 题号：58
- 类型：AES-ECB + 随机碰撞
- FLAG：动态 FLAG

### 题面

题目先把随机 16 字节 `d` 作为 AES-ECB 密钥加密 flag 得到 `ct`，然后用 `d` 的数值 `D = b2l(d)` 作为 ECDSA 私钥，对两条已知消息用**同一个随机数 k** 各签了一次名：

```python
d = os.urandom(16);  D = b2l(d)
ct = AES.key(d).ECB_encrypt(pad(flag, 16))
E = EllipticCurve(Zmod(p), [A, B]);  G = E.gens()[0]
k = random.randint(1, n-1);  Q = k*G;  r = int(Q[0]) % n
s1 = (k^-1 * (e1 + r*D)) % n
s2 = (k^-1 * (e2 + r*D)) % n
```

### 分析

两次签名共用 nonce `k`，因此 `r` 相同，构成经典的 **ECDSA nonce reuse**。因为两次签名两条式子只有 `e` 不同，可以做差消去 `D` 直接解出 `k`，再代入任意一式解出私钥 `D`：

```
s1 - s2 ≡ k^-1·(e1 - e2)   (mod n)
k      ≡ (e1 - e2)/(s1 - s2)
D      ≡ (s1·k - e1)/r
```

`D` 即 AES 密钥的整数值，还原出 16 字节后直接解密 `ct`。两条消息原文就写在源码里。

### 解题步骤

1. 两式相减解出 nonce `k`，再反代解出私钥 `D`。
2. `D` 转 16 字节作为 AES-ECB 密钥。
3. 解密 `ct` 并 `unpad`。

### EXP

```python
from Crypto.Util.number import long_to_bytes as l2b, bytes_to_long as b2l
from Crypto.Util.Padding import unpad
from Crypto.Cipher import AES

ct = bytes.fromhex('d17f52da7a9c54b87b1b0973bc4a3623166ece646dd6762905413387c531fc9d23e5f2494091c39677ae5dc35566d1ee')
n = 278302096557935581738338462024559946959
r = 264579573280920819291511588977260661069
s1 = 157195048165685698821267525173525379816
s2 = 61286613457098845815723227657607632607
e1 = b2l(b"If you used the same random number when signing,")
e2 = b2l(b" then you need to be careful.")

k = ((e1 - e2) * pow(s1 - s2, -1, n)) % n     # nonce reuse
D = ((s1 * k - e1) * pow(r, -1, n)) % n       # 私钥

key = l2b(D).rjust(16, b'\0')                 # AES key
print('FLAG:', unpad(AES.new(key, AES.MODE_ECB).decrypt(ct), 16).decode())
```

输出：

```
FLAG: flag{035755ac-ba88-401d-93d3-d13607aa7387}
```

### FLAG

```
flag{035755ac-ba88-401d-93d3-d13607aa7387}
```

---

## 随机数之旅 4

### 题目信息

- 题号：59
- 类型：随机数 / PRNG 预测
- FLAG：动态 FLAG

### 题面

生成逻辑：`p = getPrime(32)`，flag 每 3 个字符切一块，`c = [b2l(块.encode())]`（14 块），取 14 个随机 `x` 初值后做 100 次线性递推：

```python
p = getPrime(32)
pieces = [flag[i:i+3] for i in range(0, len(flag), 3)]
c = [bytes_to_long(x.encode()) for x in pieces]       # 14 个未知系数
x = [random.randint(1, p-1) for _ in range(14)]
for i in range(100):
    s = sum(c[i]*x[-14+i] for i in range(14))
    x.append(s % p)
print(x[-28:])
```

### 分析

输出 `x[-28:]` 是最后 28 个状态。递推式是 14 阶线性齐次模递推：

```
x[t+14] ≡ c0·x[t] + c1·x[t+1] + … + c13·x[t+13]  (mod p)
```

未知数只有系数 `c0..c13`（每块 3 字节 ASCII，`≈ 2^24 < p`）。把 `t = 0..13` 代入，得到 14 个方程、14 个未知数的模线性方程组，直接高斯消元即可。因为 `c` 每个都 < p 且是 3 字节字节串，可从解直接拼回 flag。

### 解题步骤

1. 取给出的 28 个值 `xs[0..27]`，前 14 个为基态，`xs[14+j]` 为递推结果。
2. 对 `j = 0..13` 列出 `Σ c[i]·xs[j+i] ≡ xs[14+j] (mod p)`。
3. 模 p 高斯消元解得 `c0..c13`。
4. 每个 `c` 用 `long_to_bytes` 转回 3 字节拼出 flag。

### EXP

```python
from Crypto.Util.number import long_to_bytes

p = 3028255493
xs = [2981540507, 1806477191, 1912594455, 2801509477, 401085215, 818458584,
      2397034605, 2120401989, 2008340439, 66147874, 1558789534, 2187085801,
      671267991, 2930313508, 924435370, 902711250, 1226810076, 769329795,
      2328739529, 1228810265, 1382003520, 1967489557, 2811050420, 1008248532,
      1643249997, 639108823, 449982542, 1325050025]
n = 14

M = [[xs[j+i] % p for i in range(n)] + [xs[14+j] % p] for j in range(n)]
for col in range(n):
    piv = next(r for r in range(col, n) if M[r][col] % p != 0)
    M[col], M[piv] = M[piv], M[col]
    iv = pow(M[col][col] % p, -1, p)
    M[col] = [(v * iv) % p for v in M[col]]
    for r in range(n):
        if r != col and M[r][col] % p != 0:
            f = M[r][col] % p
            M[r] = [(a - f*b) % p for a, b in zip(M[r], M[col])]
c = [M[i][n] for i in range(n)]

print('FLAG:', ''.join(long_to_bytes(ci).decode('latin1') for ci in c))
```

输出：

```
FLAG: flag{188a9250-bd02-4746-8ddd-a32d9c1bb11a}
```

### FLAG

```
flag{188a9250-bd02-4746-8ddd-a32d9c1bb11a}
```

---

## 共轭迷宫

### 题目信息

- 题号：60
- 类型：四元数密钥交换

### 题面

基于四元数的密钥交换。flag 每 9 字节切成四段，转大整数作为四元数 `g` 的四分量；`a`、`b` 是分别绕 `g` 虚部方向旋转 45°、60° 的单位四元数（弱密钥生成），各方用共轭法交换：

```python
g = Quaternion(w, x, y, z)                      # w,x,y,z 为 flag 四段整数
P_A = a * g * a.inv()                           # Alice 公钥
P_B = b * g * b.inv()                           # Bob 公钥
K = a * P_B * a.inv()                           # 共享密钥
```

题目给出 `norm_squared = w²+x²+y²+z²`、共享密钥 `K` 各分量、以及 flag 每段整数**后 6 位十进制数**。

### 分析

`a` 的旋转轴正是 `g` 的虚部方向，对 `g` 做共轭 `a·g·a⁻¹` 不会改变该方向上的分量，标量分量也不变，因此 `a·g·a⁻¹ = g`，进而 `P_A = P_B = g`。共享密钥：

```
K = a·P_B·a⁻¹ = a·g·a⁻¹ = g            （单位化后的 g）
```

所以直接用 `K 各分量 × ||g||`（即 `sqrt(norm_squared)`）就能还原 `g` 四个整数分量。`g` 是单位四元数，`K` 的每个分量乘以范数得原始整数；小数截断误差用"后 6 位十进制数"对齐修正。

### 解题步骤

1. `norm = sqrt(norm_squared)`。
2. 每个 K 分量 × norm 向下取整，再微调使末 6 位等于题给数值（分量为正，可单调递减调整）。
3. 还原四个整数，各转 9 字节拼回 `flag{...}`。

### EXP

```python
from decimal import Decimal, getcontext

getcontext().prec = 60

nsq = Decimal('15960922284361974605582033637987025644912788')
K = ('0.47292225874042030771896799291807799271678994351844',
     '0.44018598307489329918958641928841974350737975182974',
     '0.54174915328248053441099670537355485876445440400706',
     '0.53766968708489053913141352127029842443636489064268')
tails = [271603, 292847, 939167, 994109]

norm = nsq.sqrt()
parts = []
for v, t in zip(K, tails):
    comp = int(Decimal(v) * norm)
    while comp % 1000000 != t:
        comp -= 1
    parts.append(comp)

print('FLAG:', b''.join(p.to_bytes(9, 'big') for p in parts).decode())
```

输出：

```
FLAG: flag{hav3_U_f1nd_ouT_@bout_tr1ck?XD}
```

### FLAG

```
flag{hav3_U_f1nd_ouT_@bout_tr1ck?XD}
```

---

## 三重密钥锁

### 题目信息

- 题号：61
- 类型：格 CVP（三重 HNP）

### 题面

flag 三等分转大整数，得到三个 ~128 位的密钥 `a, b, c`，在 512 位素数 `p` 下线性组合后校验：

```python
p = random_prime(2^512, lbound=2^511)
a, b, c = encode_flag_to_abc(flag)      # 每段 < 2^128
k = random.randint(1, p-1); m = random.randint(1, p-1); n = random.randint(1, p-1)
f = (k*a + m*b + n*c) % p               # 公开 p,k,m,n,f
```

### 分析

已知 `f ≡ k·a + m·b + n·c (mod p)`，未知 `a,b,c ≈ 2^128`。这是一个三重 HNP，可化为 **4 维格上的最近向量问题 (CVP)**：对任意整数 `a,b,c,t`，格点 `(k·a + m·b + n·c + t·p, a, b, c)` 属于由 `(k,1,0,0)、(m,0,1,0)、(n,0,0,1)、(p,0,0,0)` 生成的格。目标向量 `(f,0,0,0)` 的最近格点就是 `(f,a,b,c)`（第一坐标恰为 `f` 因 `ka+mb+nc ≡ f`）。

LLL 约简后跑 Babai 最近平面算法即可得到 `a,b,c`，转字节拼回 flag。

### 解题步骤

1. 用求得 `a,b,c` 构造 4×4 格基矩阵，LLL 约简。
2. Gram-Schmidt 精确正交化，对目标 `(f,0,0,0)` 从高维到低维做 Babai 最近平面。
3. 取出向量后三个坐标 `(a,b,c)`，验证 `k·a+m·b+n·c ≡ f (mod p)`。
4. 各自转字节拼接即得 flag。

### EXP

```python
from fractions import Fraction
from fpylll import IntegerMatrix, LLL
from Crypto.Util.number import long_to_bytes

p = 10424356578148041779853991789187969944186570125402901113699573185144158488847151089093649435805832723680640302469301322004769382556869280204369016044400623
k = 2016425917343526209264752974016973527106088400191647819396444997081866888816818440804306653900752825844532111319244334210470353279795203950886189568717273
m = 9640575609666038466312358795458735166723157003124018050805657432015561577987823522956739610343817276374800232163184447140344754253531140765054930193240661
n = 8539207304708818916453730202381072788689351891251165656488809155919585187699733568697903825636944248694317545906020707873051567183468920809837554174735591
f = 3760813688323379339493776734416231127517302841171887658445242754803946122769018586447782634756726656702581791734772105099204609201876825961922712387326893

B = IntegerMatrix(4, 4)
for i, r in enumerate([[k, 1, 0, 0], [m, 0, 1, 0], [n, 0, 0, 1], [p, 0, 0, 0]]):
    for j, v in enumerate(r):
        B[i, j] = v
LLL.reduction(B)
red = [[B[i, j] for j in range(4)] for i in range(4)]

def dot(a, b):
    return sum(x*y for x, y in zip(a, b))

Bv = [[Fraction(x) for x in r] for r in red]
m_ = 4
Bstar = [[Fraction(0)] * 4 for _ in range(m_)]
for i in range(m_):
    v = Bv[i]
    for j in range(i):
        proj = dot(v, Bstar[j]) / dot(Bstar[j], Bstar[j])
        v = [v[t] - proj*Bstar[j][t] for t in range(4)]
    Bstar[i] = v

target = [Fraction(f), Fraction(0), Fraction(0), Fraction(0)]
b = target[:]
for i in range(m_-1, -1, -1):                 # Babai 最近平面
    proj = dot(b, Bstar[i]) / dot(Bstar[i], Bstar[i])
    c = round(proj)
    b = [b[t] - c*Bv[i][t] for t in range(4)]
v = [target[t] - b[t] for t in range(4)]

a_, bb, cc = int(v[1]), int(v[2]), int(v[3])
assert (k*a_ + m*bb + n*cc - f) % p == 0
print('FLAG:', (long_to_bytes(a_) + long_to_bytes(bb) + long_to_bytes(cc)).decode())
```

输出：

```
FLAG: flag{op3n_A_d007_t0_th3_w0rld_0f_latt1ce}
```

### FLAG

```
flag{op3n_A_d007_t0_th3_w0rld_0f_latt1ce}
```

---

## 简约但不简单

### 题目信息

- 题号：83
- 类型：多项式求值 + 线性包裹
- FLAG：动态 FLAG

### 题面

题目把 flag 当成一个以 `x` 为基底的"大整数"求值，再用 32 位随机数 `a, b` 线性包裹后给出三组数据：

```python
import uuid
from random import getrandbits as grb

flag = "flag{" + str(uuid.uuid4()) + "}"
a, b = [grb(32) for _ in range(2)]     # a, b 都是 32 位

def f(s, j):
    n = len(s)
    return sum(ord(s[i]) * j**(n-1-i) for i in range(n))

pd = {}
for _ in range(3):
    x = grb(32)
    pd[x] = a*f(flag, x) + b
```

### 分析

`f(flag, x)` 等于把 `flag` 的每个字符 ASCII 码当作 base-`x` 进制下的数字位：高位是 `ord('f')`，低位是 `ord('}')`。所以只要能确定 `a, b`，把 `(y - b) // a` 在 base-`x` 下展开就能逐位还原出 flag 的 ASCII 码。

`y_i = a·f(flag, x_i) + b`，于是任意两个 `y_i` 之差都是 `a` 的倍数：

```
y1-y2 = a*(f(flag,x1)-f(flag,x2))
```

对三组差取 `gcd` 得到 `g = a * c`，其中 `c` 是叉积差值的公因子。所以真正的 `a` 是 `g` 的某个因子。`b` 不一定是 `y % a`（`b` 可能大于 `a`），因此枚举 `a = gcd` 的每个因子，并遍历 `b = (y % a) + k*a, k = 0,1,2,...`，只要 base-`x` 展开后的每一位都在 `[32, 126]` 且以 `flag{` 开头、`}` 结尾即命中。

### 解题步骤

1. 读入三组 `(x, y)`，对 `y` 两两作差取 `gcd`：`g = 4293602092`。
2. 枚举 `g` 的全部因子 `a`，要求三个 `y % a` 相等（记作 `b0`）。
3. `b` 取 `b0 + k*a`，`k` 从 `0` 到 `(2^32-1-b0)//a`，因为 `b` 是 32 位数。
4. 对每个 `(a, b)` 计算 `P = (y - b)//a`，在 base-`x1` 下循环取余展开。
5. 检查展开的每一位都在 `[32,126]`、恰 42 位、`flag{` 开头 `}` 结尾。
6. 命中：`a = 2146801046`，`b = 2680882101`。
7. 命中后拼接得到最终 FLAG。

### EXP

```python
import sympy
from math import gcd

pd = {
    3413676640: 1594077971399385299395022227852120555480881869700637958117720940776903900048909126220647862398841465330414656859614557714565079951005622575312330146529382177601052870025387871105367157364980720098108223606218778071591962312625545928833475405327437929990676527598584146131583628543440856728345525538339583048836248707122644351050182499626881169032352787112151495775408995081033982986335846819558919915251,
    1750756035: 2054200758155809430584682000748084645623817029820517053922743364374804105875884926940420627189956084606447359376765801210864111309534028184840667117141884507600723257114137325445664302774484068353837055532470902698739100719671542290651856331138066968452527405350535656340120689540541436633603023418382432662235969191092536737362557358534747146579541901899362864001727095589806693532072254751,
    2784498663: 375854307330722604895974468090858814864572180251131715939732683940369788071083742192233859810935302243896235156472567348202741984360129992791781365677098394056713626446456459605416838890813014133791849451618056825242399275114351112835538706806874580862351976739195216744313743979529905098368548935904803841295421642793890717398476615519687117378253101704831174492618046725311143847432708224771894487,
}

xs = list(pd.keys())
ys = list(pd.values())
M = 2**32

g = gcd(abs(ys[0]-ys[1]), abs(ys[1]-ys[2]))

def expand(val, base):
    digs = []
    while val:
        digs.append(val % base)
        val //= base
    return digs[::-1]

x1 = xs[0]
for a in sorted(sympy.divisors(g), reverse=True):
    if a < 2:
        continue
    b0 = ys[0] % a
    if not all(y % a == b0 for y in ys):
        continue
    for k in range((M-1-b0)//a + 1):
        b = b0 + k*a
        digs = expand((ys[0]-b)//a, x1)
        if len(digs) != 42 or not all(32 <= d <= 126 for d in digs):
            continue
        s = ''.join(chr(d) for d in digs)
        if s.startswith('flag{') and s.endswith('}'):
            print('a =', a)
            print('b =', b)
            print('FLAG =', s)
            raise SystemExit(0)
```

输出：

```
a = 2146801046
b = 2680882101
FLAG = flag{a9eef27e-2229-4110-a28f-42f7f007c06d}
```

### FLAG

```
flag{a9eef27e-2229-4110-a28f-42f7f007c06d}
```

---

## 随机数之旅 1.3

### 题目信息

- 题号：84
- 类型：LCG 线性同余
- FLAG：动态 FLAG

### 题面

想恢复 flag，但直接给了一个"最旧最冷"的配置：有一个未知的线性同余生成器，把 flag 的值混了进去：

```python
m = bytes_to_long(flag.encode())
p = getPrime(m.bit_length()+3)
a = getPrime(p.bit_length())

hint = [random.randint(1, p-1)]
for i in range(10):
    hint.append((a*hint[-1]+m) % p)
```

### 分析

序列满足一阶线性递推：

```
h[k+1] = a*h[k] + m (mod p)
```

两式相减消去 `m`：

```
h[k+2] - h[k+1] = a*(h[k+1] - h[k]) (mod p)
```

于是 `a = (h[2]-h[1]) * (h[1]-h[0])^{-1} (mod p)`，再代回第一式得 `m = h[1] - a*h[0] (mod p)`。`m` 就是 flag 的长整数形式，`long_to_bytes` 即还原。

### 解题步骤

1. 取前三个 hint 值，利用差分公式恢复 `a`。
2. 代回 `h[1] = a*h[0] + m (mod p)` 恢复 `m`。
3. `long_to_bytes(m)` 得到 flag。

### EXP

```python
from Crypto.Util.number import long_to_bytes

p = 478475545597700801137542329947268027178596565166277501475984783168264336204134464479893480035711325623
hint = [
    249919247565764496968024420668100990050724930264873012553221627994767139138419916559737152956192938786,
    341098538517870638403021803297435486563954299904421591195678329627022088404800269966659959073623486227,
    20018219100052262465673657639106096626775270934552714906385093540517665089433306304783945869390965352,
    477110987927537932362183022083084081803652185884243696031637228688890267574215943741789667631285188517,
    316109317526042308856009312339591028959770431193022541894694590723163440242617594274841279773268292931,
    288838512929949193288464156452590499193348618769922838206940876596503314942400180385295933551444987426,
    181266945000896484248052902194760405660042158622313374086868842724033187572461235292532472052806294610,
    363891817161955280083221864938995130581363107122643810787521989924285652140760869565757181912307151144,
    176158258425616548246181359314308658522975855113878838400631572536985398273419876407488652665740506588,
    226304243444318985869957901105733987782986057182483943969163921743774283862329285859875298207849486395,
    235563126973016483026307105002236457145848856279569924823679216801904771557144382780782533443602319128,
]

a = (hint[2] - hint[1]) * pow(hint[1] - hint[0], -1, p) % p
m = (hint[1] - a*hint[0]) % p
print("a =", a)
print("FLAG =", long_to_bytes(m).decode())
```

输出：

```
a = 50284842668591874286962530711840222441575267222168631627346628930023136944986518242285511306089960820
FLAG = flag{3ea753dc-8d46-41f7-b4a6-e828c0253831}
```

### FLAG

```
flag{3ea753dc-8d46-41f7-b4a6-e828c0253831}
```

---

## 随机数之旅 1.9

### 题目信息

- 题号：85
- 类型：LCG（模数未知）
- FLAG：动态 FLAG

### 题面

和 1.3 几乎一样，但这次没有直接给出模数 `p`：

```python
m = bytes_to_long(flag.encode())
p = getPrime(m.bit_length()+3)
a = getPrime(p.bit_length())

hint = [random.randint(1, p-1)]
for i in range(15):
    hint.append((a*hint[-1]+m) % p)
```

### 分析

序列仍是 `h[k+1] = a*h[k] + m (mod p)`。两两差分有等比性质：

```
h[k+2] - h[k+1] = a*(h[k+1] - h[k])   (mod p)
```

记 `d_k = h[k+1] - h[k]`，则 `d_{k+1} = a*d_k (mod p)`。于是对任意 `i != j`：

```
d_{i+1}*d_j = a*d_i*d_j = d_i*d_{j+1}   (mod p)
```

所以 `d_{i+1}*d_j - d_i*d_{j+1}` 是 `p` 的倍数。对多组交叉乘积求 `gcd` 即可得到 `p`（除掉夹带的 2、3 等小公因子），随后按 1.3 的方式恢复 `a, m`。

### 解题步骤

1. 计算 15 个差分 `d_k`。
2. 对多组 `(i,j)` 求 `|d_{i+1}*d_j - d_i*d_{j+1}|`，累乘 gcd 得到 `p` 的倍数。
3. 用 10000 以内小素数整除剩余数，得到素数 `p`。
4. `a = (h[2]-h[1])/(h[1]-h[0]) (mod p)`，`m = h[1] - a*h[0] (mod p)`。
5. 用若干组 `(a*h[i]+m) % p == h[i+1]` 校验后 `long_to_bytes(m)`。

### EXP

```python
from math import gcd
from Crypto.Util.number import long_to_bytes, isPrime

hint = [
    207815833858860472630525746720294722862686098236015762403351705374683468788325370179356514749526876950,
    211015979308620411696525425095777275753476560571747569104626146643460892934355111246007348590054728278,
    # ...（完整数据见题目附件 random_jerni1_9.py 注释）
]

d = [hint[i+1] - hint[i] for i in range(len(hint) - 1)]

G = 0
for i in range(len(d) - 2):
    for j in range(i + 1, min(len(d) - 1, i + 6)):
        cross = abs(d[i+1]*d[j] - d[i]*d[j+1])
        G = gcd(G, cross)

p = G
for pr in range(2, 10000):
    while p % pr == 0:
        p //= pr
assert isPrime(p)

a = (hint[2] - hint[1]) * pow(hint[1] - hint[0], -1, p) % p
m = (hint[1] - a*hint[0]) % p

for i in range(15):
    assert (a*hint[i] + m) % p == hint[i+1]

print("p    =", p)
print("a    =", a)
print("FLAG =", long_to_bytes(m).decode())
```

输出：

```
p    = 280850935843921831854086310440676685065750764735757538361697628591000158614408642674982565414740868673
a    = 204196471214096796071122233870504038461030399942935941771930578997515923491755381980140682166507542100
FLAG = flag{513a05ef-ca04-4e94-af25-a893da4221fe}
```

### FLAG

```
flag{513a05ef-ca04-4e94-af25-a893da4221fe}
```

---

## 随机数之旅 2

### 题目信息

- 题号：86
- 类型：MT19937 变体
- FLAG：动态 FLAG

### 题面

一个改了参数的梅森旋转（自称 MT19_937）：长度 114、加大常数 66、掩码 `0x0d000721`。

```python
class MT19_937:
    def __init__(self, seed):
        self.mt = [0] * 114
        self.mt[0] = seed
        for i in range(1, 114):
            self.mt[i] = _int32(1145141919 * (self.mt[i-1] ^ self.mt[i-1] >> 30) + i)

    def extract_number(self):
        if self.mti == 0:
            self.twist()
        y = self.mt[self.mti]
        y = y ^ y >> 11
        y = y ^ y << 7 & 0x0d000721
        self.mti = (self.mti + 1) % 114
        return _int32(y)

    def twist(self):
        for i in range(0, 114):
            y = _int32((self.mt[i] & 0x90000000) + (self.mt[(i+1) % 114] & 0x8fffffff))
            self.mt[i] = (y >> 1) ^ self.mt[(i + 66) % 114]
            if y % 2 != 0:
                self.mt[i] = self.mt[i] ^ 0x0d000721

hint = [task.extract_number() for _ in range(114)]
key = [task.extract_number() for _ in range(11)]
x = 1
for i in key:
    x *= i
print(hint)
print(m^x)          # m = bytes_to_long(flag)
```

### 分析

梅森旋转的输出经两个可逆变换（右移 11 的异或、左移 7 的掩码异或），按逆序做 untemper 即可还原每次输出的内部 32 位。1024 位伪随机数的 MT 用连续的输出就能重建整个状态。

`hint` 恰好是 114 个输出，正好等于状态长度：第一次 `extract_number` 在 `mti==0` 时触发 `twist()`，所以这 114 个输出正好覆盖一次 twist 之后的完整内部数组。随后下一次取数再触发一次 `twist()`，其前 11 个状态按同样 `temper` 之后就是 `key`。

流程：`hint → untemper → S1`（第一次 twist 后状态）→ `twist(S1)` 得第二次 twist 后状态 `S2` → `key[i] = temper(S2[i])`。

注意 untemper 与 temper 顺序相反：`temper` 先右移异或后左移掩码异或，`untemper` 应先解 `y ^ (y<<7 & mask)`（从低位向高位逐步恢复），再解 `y ^ y>>11`（从高位向低位逐步恢复）。

### 解题步骤

1. 实现 `_int32`、`temper`、`untemper`（含精确逐位的掩码 xorshift 反演）与 `twist`。
2. 把 `hint` 全部 untemper 得到第一次 twist 后的 114 个内部状态 `S1`。
3. 用同样的 twist 逻辑更新一次得到 `S2`。
4. `key = [temper(S2[i]) for i in range(11)]`，连乘得 `x`。
5. `m = (m^x) ^ x`，`long_to_bytes` 还原 flag。

### EXP

```python
from functools import reduce
from Crypto.Util.number import long_to_bytes

def _int32(x):
    return int(0xFFFFFFFF & x)

N, UP, MASK = 114, 66, 0x0d000721

def undo_right_hash(x, shift):
    res = 0
    for i in range(31, -1, -1):
        hi = (res >> (i + shift)) & 1 if i + shift < 32 else 0
        res |= ((x >> i) & 1 ^ hi) << i
    return _int32(res)

def undo_left(x, shift, mask):
    res = 0
    for j in range(32):
        mj = (mask >> j) & 1
        prev = (res >> (j - shift)) & 1 if j >= shift and mj else 0
        xj = ((x >> j) & 1) ^ prev
        res |= xj << j
    return _int32(res)

def untemper(y):
    return undo_right_hash(undo_left(y, 7, MASK), 11)

def temper(y):
    y = y ^ y >> 11
    y = y ^ ((y << 7) & MASK)
    return _int32(y)

def twist_arr(arr):
    mt = arr[:]
    for i in range(N):
        y = _int32((mt[i] & 0x90000000) + (mt[(i + 1) % N] & 0x8fffffff))
        mt[i] = (y >> 1) ^ mt[(i + UP) % N]
        if y % 2 != 0:
            mt[i] ^= MASK
    return [_int32(v) for v in mt]

hint = [...]          # 114 个随机数，见题目注释
enc = 174279382333440272527169405563126775575894462244164992062996670946512594329265894481264929021062073725

S1 = [untemper(y) for y in hint]
S2 = twist_arr(S1)
key = [temper(S2[i]) for i in range(11)]
x = reduce(lambda a, b: a * b, key)
m = enc ^ x
print("FLAG =", long_to_bytes(m).decode())
```

输出：

```
FLAG = flag{e9ef408f-feef-4732-b6d0-77d9813b8f9c}
```

### FLAG

```
flag{e9ef408f-feef-4732-b6d0-77d9813b8f9c}
```

---

## Weil 的噪声与秩序

### 题目信息

- 题号：91
- 类型：Weil 配对比特编码

### 题面

一个基于 BLS12-381 类型素数 `p` 上曲线 `E: y² = x³ + 4` 的 Weil 配对比特编码题。`flag` 逐字符转 8 位二进制后按位决定密文：

- 位为 `1`：`P,Q` 取 `E.random_element()` 并乘 `o//2//2`（处于 2-挠并由随机点缩放），`d = P.weil_pairing(Q, 2) * getrandbits(381)`，即**纯配对被随机噪声污染**；
- 位为 `0`：`P,Q` 乘 `o//3//3`，`d = P.weil_pairing(Q, 3)`，即**纯 3 阶 Weil 配对值**。

其中 `o = mul(res)` 是所有素数列表之积，`mul` 来自 `functools`.

### 分析

Weil 配对的定义性质：`e_m(P, Q)` 恒为方程的 m 次单位根。因此 `d = e_3(P,Q)` 必然满足 `d³ ≡ 1 (mod p)`——这是"秩序"侧。而噪声侧 `d = e_2(P,Q) * random` 中，`e_2` 取值仅在 `±1`，乘上 `getrandbits(381)` 后任意三次方几乎不可能回到 1. 由此每个密文可用一条判定区分：

- `pow(d, 3, p) == 1` → 位 0（纯 3-阶配对）
- 否则 → 位 1（被污染）

### 解题步骤

1. 从 `task.sage` 提取素数列表，`p = res[10]`.
2. 解析 `c.py` 的密文列表.
3. 逐元素判定 `pow(d % p, 3, p) == 1`，收集比特串.
4. 每 8 位转一个字符，按 `}` 截断即得 flag.

### EXP

```python
import ast, re

src = open('c.py').read()
c = ast.literal_eval(src.split('=', 1)[1].strip())

s = open('task.sage').read()
nums = [int(x) for x in re.findall(r'\d+', s.split('pp =')[0])][:25]
p = nums[10]

bits = ''
for v in c:
    bits += '0' if pow(v % p, 3, p) == 1 else '1'

flg = ''
for i in range(0, len(bits), 8):
    ch = chr(int(bits[i:i + 8], 2))
    flg += ch
    if ch == '}':
        break
print(flg)
```

输出：

```
flag{let_m3_exam1n3_wh3ther_U_h@v3_handled_weil_pair1n9}
```

### FLAG

```
flag{let_m3_exam1n3_wh3ther_U_h@v3_handled_weil_pair1n9}
```

---

## 随机数之旅 3.9

### 题目信息

- 题号：88
- 类型：类 LWE 二元噪声
- FLAG：动态 FLAG

### 题面

带二元噪声的"类 LWE"线性系统题：500×30 矩阵 `A`、模数 `p=random_prime(2^64)`、秘密 `x` 分量在 `[1,2^32]`，用 `b=A·x+e mod p` 加密，噪声 `e` 的每个分量只取两个固定值 `ec[0]`、`ec[1]`。`m = c ^ prod(x)`。

```python
n = 30
m = 500
p = random_prime(2**64)
ec = [random.randint(1, p-1) for _ in range(2)]
e = [random.choice(ec) for _ in range(m)]
A = matrix(Zmod(p), m, n, [random.randint(1, p-1) for _ in range(m*n)])
x = vector([random.randint(1, 2**32) for _ in range(n)])
b = A*x + e
print("A=", list(A)); print("ec=", ec); print("b=", list(b))
```

### 分析

噪声只有两个值，而它们已知。做"白化"把它压成 `0/1`：

- `d = ec[1]-ec[0] (mod p)`，`dinv = d⁻¹ mod p`
- `Ap = A·dinv mod p`，`bp = (b - ec[0])·dinv mod p`

则 `bp ≡ Ap·x + t (mod p)`，其中 `t_i∈{0,1}`，即每行都是一个"带二进制小噪声的模线性方程"。500 行方程、30 个未知数、32 位秘密 → 标准的"短噪声 CVP/SVP 嵌入"问题。

对接的嵌入格：

- 对每个未知数 `j`，行 = `(Ap 的第 j 列拼接进前 500 格) + (尾块第 j 位放权重 X)`；
- 对每个方程 `i`，行 = 第 i 格放 `p`（模作用）；
- 最后一行 = `(bp 拼接, …, 1)`（把目标嵌入格中）。

在这样 `m+n+1` 维的格上做 LLL，最短向量携带系数 `-X·x`（或相反数），读出尾块再除以 `X`、验符号即可得到 `x`。关键是**必须把 `closest_vector` 的返回值接住**（不是原地修改），并检查尾块系数做符号矫正。

### 解题步骤

1. 解析题目注释：第 30 行 `p`、第 31 行 `A`、第 32 行 `ec`、第 33 行 `b`、第 34 行 `c`。
2. 白化：`Ap[i] = A[i]·dinv`, `bp[i] = (b[i]-ec0)·dinv`，并把 `Ap`/`bp` 对称化到 `[-p/2, p/2]`。
3. 取前 `q=50` 行数据构造嵌入格（维度 `q+30+1=81`，行数 `30+q+1`）。
4. `LLL` 化简（本参数规模几秒即可，无需 BKZ），摘下前几个最短向量的尾块坐标。
5. 对每个候选 `nx·±1` 判定 `0<xⱼ≤2³²` 且 `(b[i]-A[i]·x) mod p ∈ {ec[0], ec[1]}` 全 500 行成立。
6. `m = c ^ prod(x)`，`long_to_bytes` 还原 flag。

### EXP

```python
import sys
from fpylll import IntegerMatrix, LLL

lines = open('random_jerni3_9.py').read().split('\n')
p = int(lines[30].split('p= ')[1])
A = eval(lines[31].split('A= ')[1])
ec = eval(lines[32].split('ec= ')[1])
b = eval(lines[33].split('b= ')[1])
c = int(lines[34].split('c= ')[1])
m, n = len(A), len(A[0])
d = (ec[1]-ec[0]) % p; dinv = pow(d, -1, p)
bp = [((b[i]-ec[0]) % p)*dinv % p for i in range(m)]
Ap = [[(A[i][j] % p)*dinv % p for j in range(n)] for i in range(m)]

def sym(r): return r if 2*r < p else r - p

q, X = 50, 1
bp2 = [sym(bp[i]) for i in range(q)]
Ap2 = [[sym(Ap[i][j]) for j in range(n)] for i in range(q)]
dim = q + n + 1
rows = []
for j in range(n):
    row = [0]*dim
    for i in range(q): row[i] = Ap2[i][j]
    row[q+j] = X; rows.append(row)
for i in range(q):
    row = [0]*dim; row[i] = p; rows.append(row)
last = [0]*dim
for i in range(q): last[i] = bp2[i]
last[dim-1] = 1; rows.append(last)

M = IntegerMatrix(len(rows), dim)
for i in range(len(rows)):
    for j in range(dim): M[i, j] = rows[i][j]
LLL.reduction(M)

def verify(xs):
    for i in range(m):
        lhs = sum(A[i][j]*xs[j] for j in range(n)) % p
        if (b[i]-lhs) % p not in (ec[0] % p, ec[1] % p):
            return False
    return True

for idx in range(min(6, dim)):
    short = [int(M[idx, j]) for j in range(dim)]
    for sgn in (1, -1):
        nx = [sgn*int(round(short[q+j]/X)) for j in range(n)]
        if all(0 < v <= (1 << 32) for v in nx) and verify(nx):
            key = 1
            for xi in nx: key *= xi
            msg = c ^ key
            print("FLAG =", msg.to_bytes(128, 'big').lstrip(b'\x00').decode())
            sys.exit(0)
print("failed")
```

输出：

```
FLAG = flag{12b2b60e-7783-4bfa-9e58-f77911a211c1_144a045e-0c31-4e5d-b7b5-7e69ac4344ac_19691419-c2f3-4b43-9955-d24adefd7005}
```

### FLAG

```
flag{12b2b60e-7783-4bfa-9e58-f77911a211c1_144a045e-0c31-4e5d-b7b5-7e69ac4344ac_19691419-c2f3-4b43-9955-d24adefd7005}
```

---

## [Cry] DLP

### 题目信息

- 题号：89
- 类型：离散对数（DLP）

### 题面

`gen_dlp_with_flag(16, 32, flag)`：取 16 个 32 位随机素数 `p_i`，各找一个原根 `g_i`，令 `y_i = g_i^x mod p_i`（`x` 是 flag 的字节整数），再用 CRT 组合 `y = CRT(primes, ys)`。题目给出模数 `N = ∏p_i` 与 `y`。

```
N = 309188900849282292730996572442105319804517021637303572285568169372827724672013943204807085606291832819055916540180210625660012888515667353984324438526947
y = 260785984269183342143040042876301128691169473526814133757612160538721419207138445246818874092343133346101040420148945804080352598475162932165207050154918
```

### 分析

N 是 16 个小素数之积（每个 32 位），逐素数分解后用 BSGS（Baby-step Giant-step，k₁ + 爆破量级每项关于 `∛p` 时间，实际 O(∛p)·表＋O(∛p)）恢复 `x mod (p_i-1)`，最后 CRT 组合 `x`。

- N 分解：32 位素因子，`sympy.ntheory.factorint` 秒级完成。
- 逐素数原根：对 `p` 的素因子集合 `facs`，对每个候选 `g` 检查 `pow(g,(p-1)//q,p)!=1` 即得原根。
- BSGS：`x_i = log_{g_i}(y mod p_i) mod (p_i-1)`（模数为 32 位，表长 `isqrt(p)+1 ≤ 65536`，极快）。
- 最后 CRT 合并 16 个同余式即得 `x`，`long_to_bytes`.

### 解题步骤

1. 用 `sympy.ntheory.factorint` 分解 `N`，得到 16 个 32 位素因子 `p_i`。
2. 对每个 `p_i`，枚举候选 `g` 并验证 `pow(g, (p_i-1)//q, p_i) != 1`（`q` 遍历 `p_i-1` 的所有素因子）得到原根 `g_i`。
3. 用 BSGS 求 `x_i = log_{g_i}(y mod p_i) mod (p_i-1)`，表长 `isqrt(p_i)+1 ≤ 65536`。
4. 对 16 个同余式 `x ≡ x_i (mod p_i-1)` 做 CRT，合并得 `x`。
5. `long_to_bytes(x)` 输出 flag。

### EXP

```python
from math import isqrt
from sympy.ntheory import factorint
from sympy.ntheory.modular import crt
from Crypto.Util.number import long_to_bytes

N = 309188900849282292730996572442105319804517021637303572285568169372827724672013943204807085606291832819055916540180210625660012888515667353984324438526947
y = 260785984269183342143040042876301128691169473526814133757612160538721419207138445246818874092343133346101040420148945804080352598475162932165207050154918


def find_primitive_root(p):
    phi = p - 1
    facs = set(factorint(phi))
    for g in range(2, p):
        if all(pow(g, phi // q, p) != 1 for q in facs):
            return g


def bsgs(g, h, p):
    m = isqrt(p) + 1
    table = {}
    e = 1
    for j in range(m):
        table.setdefault(e, j)
        e = e * g % p
    c = pow(g, (p - 2) * m, p)
    gamma = h
    for i in range(m + 1):
        if gamma in table:
            return (i * m + table[gamma]) % (p - 1)
        gamma = gamma * c % p


primes = [p for p, e in factorint(N).items() for _ in range(e)]
xs = [bsgs(find_primitive_root(p), y % p, p) for p in primes]
xval = int(crt([p - 1 for p in primes], xs)[0])
for p in primes:
    g = find_primitive_root(p)
    assert pow(g, xval, p) == y % p, p
print('FLAG =', long_to_bytes(xval).decode())
```

输出：

```
x = 50937517511022639871703333483128773651462640640207375656073560302191171538567074566455165
FLAG = flag{D0_y0u_lik3_4i5cr3te_1og@rit6m?}
```

### FLAG

```
flag{D0_y0u_lik3_4i5cr3te_1og@rit6m?}
```

---

## 随机数之旅 3.6

### 题目信息

- 题号：87
- 类型：欠定线性系统恢复 ASCII
- FLAG：动态 FLAG

### 题面

`n = len(flag)`（flag 为 ASCII 可打印），`m = n-6`，`p = random_prime(2^64)`，随机矩阵 `A ∈ (Z/pZ)^{m×n}`，`b = A·x`，其中 `x` 是 flag 各字符的 ASCII 码向量。题目给出 `p`、`A`、`b`。

```python
n = len(flag); m = n - 6
p = random_prime(2**64)
A = matrix(Zmod(p), m, n, [random.randint(p//2, p-1) for _ in range(m*n)])
x = vector([ord(i) for i in flag]); b = A*x
```

### 分析

`m < n`，这是**欠定**线性系统：方程数比未知数少 6 个，解空间维数为 `n-m=6` 的仿射子空间。但 `x` 分量全在 `32..126`（可打印 ASCII），这是一个"短解"约束 → 用**零空间格 + Babai 最近平面（CVP）**恢复。

思路：

1. 对增广矩阵做模 `p` 行化简（高斯消元）找到主元列，得特解 `x0` 与零空间基 `Ns`（6 个向量）。一般解 `x = x0 + Σ c_l·N_l (mod p)`。
2. 把零空间基拼进格（每行 `Ns[l]` + 对角 `p`），LLL 化，得到约减正交基。
3. 目标向量 `T = -x0`，对格做 Babai 最近平面法求最近格点 `g`，则 `x = x0 + g (mod p)`。
4. 试几个偏移量 `trial`（0..7），校验 `32 ≤ xⱼ ≤ 126` 即得 ASCII。

> 关键点：必须对 LLL 化后的基用 Gram-Schmidt 系数做 Babai 最近平面，且 LLL 约减后小数/符号问题通过 `Fraction` 精确运算规避。因为零空间维数只有 6，最近格点唯一对应短 ASCII 解。

### 解题步骤

1. 读取 `output.txt` 三行：`p`、`A`、`b`。
2. 增广矩阵 `[A | b]` 模 `p` 行化简求特解 `x0` 与零空间基 `Ns`（6 维）。
3. 构造格：前 `k` 行 = 各零空间向量 `mod p`，再对每个坐标加单位向量行乘 `p`，共 `k+n` 行、`n` 列；LLL 约减。
4. Gram-Schmidt 正交化得 `Bstar`，Babai 最近平面法对目标 `T=-x0-trial` 求 `g`。
5. `x = (x0 + g) mod p`，`trial=0..7` 中找全部分量落在 `32..126` 的解，拼接即 flag，并用 `A·x ≡ b` 全量校验。

### EXP

```python
from fractions import Fraction
from fpylll import IntegerMatrix, LLL
from sympy import mod_inverse

data = open('output.txt').read().split('\n')
p = int(data[0])
Arows = [list(r) for r in eval(data[1])]
bvec = eval(data[2])
R, C = len(Arows), len(Arows[0])

M2 = [Arows[i][:] + [bvec[i]] for i in range(R)]
col = 0; pivots = []
for r in range(R):
    while col < C:
        piv = next((rr for rr in range(r, R) if M2[rr][col] % p != 0), None)
        if piv is None:
            col += 1; continue
        M2[r], M2[piv] = M2[piv], M2[r]
        inv = mod_inverse(M2[r][col] % p, p)
        M2[r] = [(v * inv) % p for v in M2[r]]
        for rr in range(R):
            if rr != r and M2[rr][col] != 0:
                f = M2[rr][col]
                M2[rr] = [(a - f * bb) % p for a, bb in zip(M2[rr], M2[r])]
        pivots.append(col); col += 1; break

free = [c for c in range(C) if c not in pivots]
x0 = [0] * C
for i, c in enumerate(pivots):
    x0[c] = M2[i][-1]
Ns = []
for fv in free:
    nv = [0] * C; nv[fv] = 1
    for i, c in enumerate(pivots):
        nv[c] = (-M2[i][fv]) % p
    Ns.append(nv)

n = C; k = len(Ns)
rows = [[Ns[l][j] % p for j in range(n)] for l in range(k)]
for j in range(n):
    r = [0] * n; r[j] = p; rows.append(r)

B = IntegerMatrix(len(rows), n)
for i in range(len(rows)):
    for j in range(n):
        B[i, j] = rows[i][j]
LLL.reduction(B)
red = [[int(B[i, j]) for j in range(n)] for i in range(len(rows))]


def dot(a, b): return sum(x * y for x, y in zip(a, b))


Bv = [[Fraction(x) for x in r] for r in red]
NB = len(red); Bstar = [[Fraction(0)] * n for _ in range(NB)]
for i in range(NB):
    v = list(Bv[i])
    for j in range(i):
        d = dot(Bstar[j], Bstar[j])
        if d == 0: continue
        proj = dot(v, Bstar[j]) / d
        v = [v[t] - proj * Bstar[j][t] for t in range(n)]
    Bstar[i] = v


def babai(target):
    tgt = [Fraction(x) for x in target]
    b2 = list(tgt)
    for i in range(NB - 1, -1, -1):
        d = dot(Bstar[i], Bstar[i])
        if d == 0: continue
        c = round(dot(b2, Bstar[i]) / d)
        b2 = [b2[t] - c * Bv[i][t] for t in range(n)]
    return [tgt[t] - b2[t] for t in range(n)]


for trial in range(8):
    T = [-x0[j] - trial for j in range(n)]
    g = babai(T)
    x = [(x0[j] + int(g[j])) % p for j in range(n)]
    if all(32 <= z <= 126 for z in x):
        print('FLAG =', ''.join(chr(z) for z in x))
        assert all(sum(Arows[i][c] * x[c] for c in range(C)) % p == bvec[i] % p for i in range(R))
        break
```

输出：

```
FLAG = flag{0b319110-bdfa-411c-957f-50bdabe1fa1c}
equation verified OK
```

### FLAG

```
flag{0b319110-bdfa-411c-957f-50bdabe1fa1c}
```

---

## final_R

### 题目信息

- 题号：90
- 类型：循环卷积 = 多项式平方

### 题面

NewStar CTF 2025 密码学收官之作。加密脚本 `final_Q.py` 用一个 7 位 LFSR 构造置换，核心是 **GF(2⁷) 上的循环卷积**。

```python
from secret import flag; from functools import reduce; from itertools import accumulate; import operator
print((lambda z: (a:=7, b:=0b10000011, c := 59, d := (1 << a) - 1,
 e := list(accumulate(range(d), lambda r, l: (r << 1) ^ b if (r << 1) & (1 << a) else r << 1, initial=1))[1:],
 g := e + e, h := [0] * (1 << a), [h.__setitem__(r, l) for l, r in enumerate(e)],
 j := [g[ord(s) % d] for s in z],
 k := [(lambda q: h[q] if q else 0)(reduce(operator.xor,
        (g[h[j[l]] + h[j[(p - l) % c]]] if j[l] and j[(p - l) % c] else 0 for l in range(c)), 0))
        for p in range(c)], "".join(chr(l) for l in k).encode())[-1])(flag))
```

输出（59 字节）：

```
b'MfYGCnO`w%\x07zSzejG#kkb\x01\x01%eS?]GO`?]\x03m?`ab`kbnsS]``][?S`C\x1dB?{m'
```

### 分析

- `e` 是反馈多项式为 `0b10000011 = x⁷+x+1`、初值为 1 的 7 位 LFSR 连续 127 个状态。因为 `x⁷+x+1` 是本原多项式（周期 `2⁷-1=127`），`e` 恰好是 `1..127` 的一个置换，即 **GF(2⁷) 乘法群**的遍历。
- 记 `α` 为本原元（整数表示取 `α=x=2`，多项式基下按 `x⁷+x+1` 归约），则 `e[i] = α^(i+1)`。
- 对每个 flag 字符，`t_i = ord(s[i])`（`%127` 后仍是自身），且 `g = e+e`、`h` 为 `e` 的反查表。于是：
  - `j[l] = g[ord%127] = e[ord]`，`h[j[l]] = ord`（因为 `e` 是置换）。
  - 内部项 `g[h[j[l]]+h[j[(p-l)%c]]] = e[(t_l+t_{p-l}) mod 127] = α·α^{t_l}·α^{t_{p-l}}`。
- 令 `a_l = α^{t_l}`，输出字节 `k[p] = h[q_p]`（即 `q_p = e[k[p]]`）满足：

```
q_p = α · Σ_l a_l·a_{(p-l) mod 59}   (GF(2⁷) 中的和与积)
```

即 `q(x) = α·a(x)² ∈ GF(2⁷)[x]/(x⁵⁹-1)` —— **循环卷积等价于多项式平方**。

- 特征 2 下平方是 Frobenius：`a(x)² = Σ a_l²·x^(2l mod 59)`。因 `2` 与 `59` 互素，下标置换可逆，逐项开方（GF(2⁷) 中唯一平方根 `u^(2⁶)=u⁶⁴`）：

```
a_l = sqrt(q_{2l mod 59} · α⁻¹)   (α⁻¹ = α¹²⁶)
ord(s[l]) = h[a_l] + 1
```

### 解题步骤

1. 用反馈多项式 `x⁷+x+1` 生成 127 长的 LFSR 序列 `e`（本原多项式，恰好遍历 `GF(2⁷)` 乘法群），构造反查表 `h[e[i]] = i`。
2. 由密文字节 `out_p` 反查 `q_p = e[out_p]`，字节为 0 时取 `q_p = 0`。
3. 由「循环卷积 = 多项式平方」得 `a_l² = q_{2l mod 59} · α⁻¹`，其中 `α⁻¹ = α¹²⁶`。
4. 特征 2 下开方即 Frobenius：`a_l = (q_{2l mod 59} · α⁻¹)^64`。
5. 查表得 `ord(s[l]) = h[a_l] + 1`，逐字符拼回 flag。

### EXP

```python
from itertools import accumulate

a=7; b=0b10000011; c=59; d=(1<<a)-1
e=list(accumulate(range(d), lambda r,l: (r<<1)^b if (r<<1)&(1<<a) else r<<1, initial=1))[1:]
h=[0]*128
for l,r in enumerate(e): h[r]=l

def gfmul(x,y):          # GF(2^7) 乘法, P=x^7+x+1=131
    r=0
    while y:
        if y&1: r^=x
        y>>=1; x<<=1
        if x&0x80: x^=131
    return r
def gfpown(x,pw):
    r=1
    while pw:
        if pw&1: r=gfmul(r,x)
        x=gfmul(x,x); pw>>=1
    return r

out = b'MfYGCnO`w%\x07zSzejG#kkb\x01\x01%eS?]GO`?]\x03m?`ab`kbnsS]``][?S`C\x1dB?{m'
alpha_inv = gfpown(2,126)
q=[e[o] if o else 0 for o in out]
flag=''.join(chr(h[gfpown(gfmul(q[(2*l)%c], alpha_inv),64)]+1) for l in range(c))
print(flag)
# flag{Circu1@r_c0nv01u7i0n_0N_v3c70R==5Qu@Ring_A_p01yn0mia!}
```

### FLAG

```
flag{Circu1@r_c0nv01u7i0n_0N_v3c70R==5Qu@Ring_A_p01yn0mia!}
```

---

## Poly

### 题目信息

- 题号：93
- 类型：模素数多项式求根
- FLAG：动态 FLAG

### 题面

题目 *What's the gcd of three polynomials?* 实际是：已知两个模大素数 `p` 的 19 次多项式值与一个校验值，反解被编码进两个整数 `m1`、`m2` 的 flag 前后半。

```python
import uuid
p = random_prime(2**256)   # Sage 9.3
f = f"flag{{{uuid.uuid4()}}}"
x1 = f[:len(f)//2]; x2 = f[len(f)//2:]
m1 = b2l(x1.encode()); m2 = b2l(x2.encode())
c1 = (m1^19 + m1^18 + 4*m1^17) % p
c2 = (5*m2^19 + m2^18 + 4*m2^17) % p
s  = (m1^7 * m2^2 + m2) % p
print((p,c1,c2,s))
```

```
p  = 30784558756838163538710632027143185397437897603217673077150297305544071001199
c1 = 2909317260219356685336632301474678396728564531244632916913671591997406996972
c2 = 4294738619365099885640900866122577092111906369664055461700321556058254607968
s  = 8215705534787817006092091346252328321484153279277254569529867991109185617083
```

### 分析

`flag{uuid4()}` 长 42 字符，前半 `m1`（21 字节 ≈ 168 bit）与后半 `m2` 均小于 `p`（256 bit）。`m1`、`m2` 满足模 `p` 方程：

```
x^19 + x^18 + 4x^17 - c1 = 0   (求 m1)
5x^19 + x^18 + 4x^17 - c2 = 0  (求 m2)
```

两个 19 次多项式在 `GF(p)` 上的根（最多 19 个）中恰有一个是 ASCII 可读的 flag 半段。有限域求根标准做法：

1. 计算 `g(x) = gcd(f(x), x^p - x)`，其恰好为 `f` 所有互异一次因子之积（根都在 `GF(p)`）。
2. 对 `g` 用 Cantor–Zassenhaus 随机分裂提取线性因子（`(x+a)^((p-1)/2) ± 1` 与 `g` 取 gcd）。
3. 每个根转字节，筛出全 ASCII 可打印者即为 `m1`/`m2`，最后用 `s = (m1⁷·m2²+m2) mod p` 全量校验。

### 解题步骤

1. 由题给 `(p, c1, c2, s)` 构造两个模 `p` 的 19 次多项式 `f1 = x¹⁹+x¹⁸+4x¹⁷-c1` 与 `f2 = 5x¹⁹+x¹⁸+4x¹⁷-c2`。
2. 计算 `g(x) = gcd(f(x), x^p - x)`，其恰好为所有互异一次因子之积。
3. 对 `g` 用 Cantor–Zassenhaus 随机分裂 `((x+a)^((p-1)/2) ± 1)` 逐步提取线性因子，得到全部根。
4. 每个根 `long_to_bytes`，筛选全 ASCII 可打印且形如 `flag{`/`}` 的，分别得到 `m1`、`m2`。
5. 用 `s ≡ m1⁷·m2²+m2 (mod p)` 校验结果。

### EXP

```python
# 手写 GF(p) 多项式 gcd / Cantor-Zassenhaus（系数升序，常数项在前）
p = 30784558756838163538710632027143185397437897603217673077150297305544071001199
c1, c2, s = (2909317260219356685336632301474678396728564531244632916913671591997406996972,
             4294738619365099885640900866122577092111906369664055461700321556058254607968,
             8215705534787817006092091346252328321484153279277254569529867991109185617083)

def fpoly(c, coef19=1):
    d=[0]*20; d[0]=(-c)%p; d[17]=4; d[18]=1; d[19]=coef19; return d
# ... (多项式 +,-,*,divmod,gcd,powmod 标准实现)
# find_roots(c, coef19):  x^p mod f -> gcd(f, x^p-x) -> cz_roots()
# m1 = b'flag{3bdb2424-591a-4a'
# m2 = b'92-b587-74951c8ad192}'
```

### FLAG

```
flag{3bdb2424-591a-4a92-b587-74951c8ad192}
```

---

## LFSR

### 题目信息

- 题号：494
- 类型：LFSR 线性反馈移位寄存器

### 题面

128 位 LFSR 的掩码即 AES 密钥，由 256 位输出流直接解出。

```python
class LFSR:
    def __init__(self, Mask_seed=None, Length=128):
        self.Length = Length if Mask_seed is None else Mask_seed.bit_length()
        self.seed = random.getrandbits(self.Length)
        self.state = self.init_state(self.seed)
        self.mask = self.init_state(Mask_seed if Mask_seed is not None else random.getrandbits(self.Length))

    def next(self):
        output = 0
        for i in range(self.Length):
            output ^= self.state[i] & self.mask[i]
        self.state = self.state[1:] + [output]
        return output

    def getrandbits(self, Length):
        return int(''.join(str(self.next()) for _ in range(Length)), 2)

mask = random.getrandbits(128)
lfsr = LFSR(mask)
print(f"random1 = {lfsr.getrandbits(128)}")
print(f"random2 = {lfsr.getrandbits(128)}")
cipher = AES.new(mask.to_bytes(16, 'big'), AES.MODE_ECB)
ciphertext = cipher.encrypt(pad(flag, 16))
```

### 分析

`next()` 每次输出一个比特 `o = state · mask (mod 2)`，随后状态左移并把输出填到末尾。因此第 `128+t` 个输出的时刻，状态向量恰好是 `[o_t, o_{t+1}, ..., o_{t+127}]`（前 128 位输出已把未知种子全部挤出）。于是对 `t = 0..127` 都有

```
o_{128+t} = sum_{i=0..127} mask_i · o_{t+i}   (mod 2)
```

这是关于 128 个未知 `mask_i` 的线性方程组，GF(2) 高斯消元即可解出掩码，也就是 AES 密钥。

### 解题步骤

1. 把 `random1`、`random2` 拼成 256 位输出位序列 `o_0..o_255`。
2. 构造方程 `A[t][i] = o_{t+i}`、`b[t] = o_{128+t}`。
3. GF(2) 高斯消元解得 `mask` 位数组（秩为 127，取特解）。
4. `mask.to_bytes(16,'big')` 作为 AES-ECB 密钥解密密文，去 padding 得 flag。

### EXP

```python
from Crypto.Cipher import AES

r1 = 79262982171792651683253726993186021794
r2 = 121389030069245976625592065270667430301
ct = b'\xb9WE<\x8bC\xab\x92J7\xa9\xe6\xe8\xd8\x93D\xcc\xac\xfdvfZ}C\xe6\xd8;\xf7\x18\xbauz`\xb9\xe0\xe6\xc6\xae\x00\xfb\x96%;k{Ph\xfa'

o = list(map(int, f'{r1:0128b}{r2:0128b}'))
A, b = [], []
for t in range(128):
    A.append(o[t:t + 128])
    b.append(o[128 + t])

M = [row[:] + [bi] for row, bi in zip(A, b)]
where = [-1] * 128
r = 0
for c in range(128):
    sel = next((i for i in range(r, 128) if M[i][c]), None)
    if sel is None: continue
    M[r], M[sel] = M[sel], M[r]
    for i in range(128):
        if i != r and M[i][c]:
            for j in range(129): M[i][j] ^= M[r][j]
    where[c] = r
    r += 1

x = [0] * 128
for c in range(128):
    if where[c] != -1: x[c] = M[where[c]][-1]

mask = 0
for bit in x: mask = (mask << 1) | bit
pt = AES.new(mask.to_bytes(16, 'big'), AES.MODE_ECB).decrypt(ct)
print(pt[:-pt[-1]])
```

### FLAG

```
flag{124ab3f1-4c3e-4d2a-8e6f-9b5e6c7d8f90}
```

---

## baby_next

### 题目信息

- 题号：306
- 类型：RSA：Fermat 分解（近邻素数）

### 题面

`q` 是对 `p` 连续调用 114514 次 `next_prime` 的结果，两素数相距极近，Fermat 分解秒破。

```python
from Crypto.Util.number import *
from gmpy2 import next_prime
from functools import reduce

p = getPrime(512)
q = int(reduce(lambda res, _: next_prime(res), range(114514), p))   # p 之后第 114514 个素数
n = p * q
e = 65537
c = pow(m, e, n)
```

### 分析

素数平均间距约 `ln(p) ≈ 355`，114514 次 `next_prime` 后 `q - p ≈ 4×10⁷`，相对 512 位模数几乎为 0。此时 `sqrt(n)` 与 `(p+q)/2` 相差约 `d²/(8p) ≈ 10⁻¹⁴⁰`，即 `isqrt(n)` 基本就是 `(p+q)/2`。Fermat 分解的 `a = isqrt(n)+1` 处 `a²-n = ((q-p)/2)²` 已是完全平方，0 次迭代即可分解。

### 解题步骤

1. `a = isqrt(n) + 1`，计算 `t = a² - n`。
2. 检查 `t` 是否为完全平方（几乎立即成立）。
3. `p = a - isqrt(t)`，`q = a + isqrt(t)`，验证 `p·q == n`。
4. 常规 RSA 解密。

### EXP

```python
from Crypto.Util.number import long_to_bytes
from gmpy2 import isqrt

n = 96742777571959902478849172116992100058097986518388851527052638944778038830381328778848540098201307724752598903628039482354215330671373992156290837979842156381411957754907190292238010742130674404082688791216045656050228686469536688900043735264177699512562466087275808541376525564145453954694429605944189276397
c = 17445962474813629559693587749061112782648120738023354591681532173123918523200368390246892643206880043853188835375836941118739796280111891950421612990713883817902247767311707918305107969264361136058458670735307702064189010952773013588328843994478490621886896074511809007736368751211179727573924125553940385967
e = 65537

a = int(isqrt(n)) + 1
while True:
    t = a * a - n
    b = int(isqrt(t))
    if b * b == t:
        p, q = a - b, a + b
        break
    a += 1

phi = (p - 1) * (q - 1)
m = pow(c, pow(e, -1, phi), n)
print(long_to_bytes(m))
```

### FLAG

```
flag{vv0W_p_m1nu5_q_i5_r34l1y_sm4lI}
```

---

## Diffie-Hellman

### 题目信息

- 题号：696
- 类型：DH 密钥交换降级

### 题面

交互式题目：服务端生成 `p, g, a`，给出 `A = g^a`，并允许我们提供 Bob 的公钥 `B`，随后用 `s = B^a` 派生 AES-ECB 密钥加密 flag。密钥交换中 Bob 的公钥完全可控，可强制共享密钥退化。

```python
from Crypto.Util.number import *
from secret import flag
from hashlib import sha256
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad

p = getPrime(512)
g = getRandomRange(2, p)
a = getRandomRange(2, p)
A = pow(g, a, p)                     # Alice 的公钥
B = int(input("Bob's Public Key: "))
assert B != A
s = pow(B, a, p)                     # 共享密钥
key = sha256(long_to_bytes(s)).digest()
cipher = AES.new(key, AES.MODE_ECB)
enc = cipher.encrypt(pad(flag, 16))  # AES-ECB 加密 flag
```

### 分析

Bob 的公钥由我们指定，存在两个极简单的选择：

- `B = g`：`s = g^a ≡ A (mod p)`，共享密钥直接等于已知的 Alice 公钥 `A`。
- `B = 1`：`s = 1^a = 1`，共享密钥退化为 1。

题目名 "Diffie-Hellman" 直接提示了 DH 的经典不安全用法：Bob 端公钥未做身份/合法性校验。

### 解题步骤

1. 连接服务端，接收 `p, g, A`。
2. 发送 `B = 1`（或 `B = g`）。
3. 服务端返回 AES-ECB 密文。
4. 用 `key = sha256(long_to_bytes(1))`（或 `sha256(long_to_bytes(A))`）解密得到 flag。

### EXP

```python
from hashlib import sha256
from Crypto.Cipher import AES
from Crypto.Util.number import long_to_bytes
from Crypto.Util.Padding import unpad
import socket, re

host, port = "<host>", <port>
so = socket.create_connection((host, port), timeout=15)
so.settimeout(15)
buf = b''
while b"Bob's Public Key" not in buf:
    buf += so.recv(4096)
p = int(re.search(rb'The Prime is (\d+)', buf).group(1))
g = int(re.search(rb'The Generator is (\d+)', buf).group(1))
A = int(re.search(rb"Alice's Public Key is (\d+)", buf).group(1))

so.sendall(b'1\n')                       # B = 1 -> s = 1
buf = b''
while True:
    try:
        c = so.recv(4096)
        if not c:
            break
        buf += c
    except socket.timeout:
        break
enc = re.search(rb'Encrypted Flag: ([0-9a-f]+)', buf).group(1).decode()

key = sha256(long_to_bytes(1)).digest()  # s = 1
flag = unpad(AES.new(key, AES.MODE_ECB).decrypt(bytes.fromhex(enc)), 16)
print(flag)
```

### FLAG

```
flag{e2838a75-ccef-4089-8e60-6ebf6ae66d7e}
```

---

## Ez_RSA

### 题目信息

- 题号：490
- 类型：静态 RSA

### 题面

```python
from Crypto.Util.number import *
from secret import flag

p, q = [getPrime(256) for _ in range(2)]
n = p * q
e = 65537
m = bytes_to_long(flag)
c = pow(m, e, n)
print(f"n = {n}")
print(f"c = {c}")
```

```
n = 5288062996177288067805240670327919739339874127477405321607402348589147491552053048231920112750216696782518281218048178087877077018108705271341382858124037
c = 2454797328903978848197140611862882439826920912955785083080835692389929572917351093371626343669582289242212514789420568997224614087740388703381025018563979
```

### 分析

标准 RSA，`n` 仅 511 bit（两个 256 bit 素数之积），远低于一般安全下限，可直接查 FactorDB 或本地 ECM 秒级分解，得到 `p, q` 后按常规求 `d` 解密。

### 解题步骤

1. `n` 仅 511 bit，两个 256 bit 素数之积，可直接查 FactorDB 或本地 ECM 分解。
2. 得到 `p, q` 后算 `phi=(p-1)*(q-1)`，`d = e^{-1} mod phi`。
3. `m = c^d mod n`，转字节即 flag。

### EXP

```python
from Crypto.Util.number import long_to_bytes, inverse

n = 5288062996177288067805240670327919739339874127477405321607402348589147491552053048231920112750216696782518281218048178087877077018108705271341382858124037
c = 2454797328903978848197140611862882439826920912955785083080835692389929572917351093371626343669582289242212514789420568997224614087740388703381025018563979
e = 65537
p = 60979507724530093051797511853954365018147917052474373616663462193464369184711
q = 86718689499194998339746379891242621495538434539975542252458947218776577824467
d = inverse(e, (p - 1) * (q - 1))
print(long_to_bytes(pow(c, d, n)))
```

### FLAG

```
flag{F4ct0rDB_1s_usefu1_r19ht?}
```

---

## Vigenere

### 题目信息

- 题号：491
- 类型：静态古典密码

### 题面

```python
from string import digits, ascii_letters, punctuation
from secret import flag

key = "Welcome-2025-0xGame"
alphabet = digits + ascii_letters + punctuation

def vigenere_encrypt(plaintext, key):
    ciphertext = ""
    key_index = 0
    for char in plaintext:
        bias = alphabet.index(key[key_index])
        char_index = alphabet.index(char)
        new_index = (char_index + bias) % len(alphabet)
        ciphertext += alphabet[new_index]
        key_index = (key_index + 1) % len(key)
    return ciphertext

print(vigenere_encrypt(flag, key))
# WL"mKAaequ{q_aY$oz8`wBqLAF_{cku|eYAczt!pmoqAh+
```

### 分析

标准维吉尼亚密码，但密钥与字母表（数字 + 大小写 + 标点，共 93 字符）全部公开，加密过程完全可逆：对每个密文字符减去对应密钥字符在字母表中的位移量即可直接还原明文。

### 解题步骤

1. 密钥和字母表全部公开，按同样模长做减法还原。
2. 对密文每个字符：`plain = alphabet[(idx(c) - idx(key)) mod |alphabet|]`。

### EXP

```python
from string import digits, ascii_letters, punctuation

key = "Welcome-2025-0xGame"
alphabet = digits + ascii_letters + punctuation
ct = 'WL"mKAaequ{q_aY$oz8`wBqLAF_{cku|eYAczt!pmoqAh+'
pt = ""
ki = 0
for ch in ct:
    pt += alphabet[(alphabet.index(ch) - alphabet.index(key[ki])) % len(alphabet)]
    ki = (ki + 1) % len(key)
print(pt)
```

### FLAG

```
flag{you_learned_vigenere_cipher_2df4b1c2e3}
```

---

## Vigenere Advanced

### 题目信息

- 题号：492
- 类型：静态变种维吉尼亚

### 题面

```python
assert flag.startswith("0xGame{") and flag.endswith("}")
assert set(flag[7:-1]) < set(ascii_lowercase)
key = "QAQ(@.@)"
alphabet = digits + ascii_letters + punctuation
new_index = ((char_index + bias) * char_index) % len(alphabet)
# 0l0CSoYM<c;amo_P_
```

### 分析

变种维吉尼亚，加密映射 `new = (idx + bias) · idx mod L` 是非线性的，无法像标准维吉尼亚那样直接减位移。但题面给出强约束：明文以 `0xGame{` 开头、`}` 结尾，内文 9 个字符全部限定为小写字母，因此对每个位置枚举 26 个小写候选验证同余式即可唯一确定。

### 解题步骤

1. 前缀 `0xGame{`、后缀 `}`、中间全小写，密文长度 17，内文长度 9。
2. 对每个位置枚举候选字符，使 `((pidx+bias)*pidx) % L == cidx`。
3. 前缀位置用已知字符校验，中间只保留小写唯一解，得到 `excellent`。

### EXP

```python
from string import digits, ascii_letters, punctuation, ascii_lowercase

key = "QAQ(@.@)"
alphabet = digits + ascii_letters + punctuation
ct = "0l0CSoYM<c;amo_P_"
L = len(alphabet)
prefix = "0xGame{"
out = []
for i, ch in enumerate(ct):
    bias = alphabet.index(key[i % len(key)])
    cidx = alphabet.index(ch)
    if i < len(prefix):
        out.append(prefix[i])
    elif i == len(ct) - 1:
        out.append("}")
    else:
        ok = [pch for pch in ascii_lowercase
              if ((alphabet.index(pch) + bias) * alphabet.index(pch)) % L == cidx]
        out.append(ok[0])
print("".join(out))
```

### FLAG

```
flag{excellent}
```

---

## Ez_LLL

### 题目信息

- 题号：496
- 类型：静态格密码

### 题面

```python
f = bytes_to_long(flag)
p = getPrime(1024)
g = getPrime(350)
h = (g * pow(f, -1, p)) % p
print(f"p = {p}")
print(f"h = {h}")
```

`h ≡ g * f^{-1} (mod p)`，即 `g ≡ h f (mod p)`。`f` 约 350 bit（flag），`g` 350 bit，`p` 1024 bit。

### 分析

`h ≡ g·f⁻¹ (mod p)` 可改写成 `g ≡ h·f (mod p)`，即二维格 `Λ = {(x, y) : y ≡ h·x (mod p)}` 中含有短向量 `(f, g)`，而 `f, g` 均仅约 350 bit、`p` 为 1024 bit。取格基 `[[1, h], [0, p]]` 做 LLL 约减，最短向量第一坐标即 `f`，`long_to_bytes` 还原 flag。

### 解题步骤

1. 未知短向量 `(f, g)` 满足 `g - h f ≡ 0 (mod p)`。
2. 对格基 `[[1, h], [0, p]]` 做 LLL，最短向量第一坐标即 `f`。
3. `long_to_bytes(f)` 得 flag。

### EXP

```python
from fpylll import IntegerMatrix, LLL
from Crypto.Util.number import long_to_bytes

p = 151240196317566398919874094060690044886978001146739221635377812709640347441550250665168046149125216617951660209690860015625296899030453965800801283336223544189902980591153121592938172963303968803995733283426759581586368403208379337416298836517168491618212440911971420911495272791409112867645195821357346746831
h = 124332746104765845147133491132959579184849644379099440465281812273660434050281263409975356196112560300248343107170084466976976410232928660489912629913525776979726428263975968343564076005019264661696777686114079504603568726429498116488469855127100166072195548037981863885014261706582936943023968781022607949646

B = IntegerMatrix(2, 2)
B[0, 0] = 1; B[0, 1] = h
B[1, 0] = 0; B[1, 1] = p
LLL.reduction(B)
print(long_to_bytes(abs(int(B[0, 0]))))
```

### FLAG

```
flag{8dc1f4b8-3f4e-4c3e-9d1a-2b5e6f7a8b9c}
```

---

## ez_lattice

### 题目信息

- 题号：606
- 类型：静态格密码

### 题面

```python
assert len(flag) % 5 == 0
block_size = len(flag) // 5
m_blocks = [bytes_to_long(flag[i*block_size:(i+1)*block_size]) for i in range(5)]
p = getPrime(128)

def make_mask(n, p):          # 上三角 × 下三角，det = 1
    upper = identity_matrix(n)
    low   = identity_matrix(n)
    for i in range(n-1):
        for j in range(i+1, n):
            upper[i, j] = randrange(1, p)
            low[j, i]   = randrange(1, p)
    return upper * low

Noise = [[randrange(1, p) for _ in range(5)] for _ in range(4)]
Noise.append(m_blocks)
M = matrix(Noise)
A = make_mask(5, p)
C = A * M                       # 只给出 C
```

`M` 共 5 行：前 4 行是 `~128bit` 随机噪声，最后一行是 flag 的 5 个分块（每块约 64bit，远小于 p）。

### 分析

掩码 `A` 是单位行列式（上三角 × 下三角，`det = 1`）的整矩阵，因此整数乘法 `C = A·M` 不改变行空间：`C` 的行与 `M` 的行张成同一个格 `L`。`M` 最后一行是 5 个约 64 bit 的 flag 分块，噪声行元素约 128 bit，故 flag 行是格 `L` 中的显著短向量，直接对 `C` 的行做 LLL 约减即可约出该短向量。

### 解题步骤

1. `A` 由单位行列式的三角矩阵相乘得到，`det(A) = 1`。
2. 整数矩阵乘法下，`C` 的行向量与 `M` 的行向量张成同一个格 `L`（相差行列式为 ±1 的整线性变换）。
3. 因此 flag 分块行（5 个约 64bit 的小数）是格 `L` 中的一个短向量，而噪声行元素约 128bit。
4. 对 `C` 的行直接做 LLL 约减，约减后的第一行就是 flag 分块，`long_to_bytes` 拼接还原 flag。

### EXP

```python
from fpylll import IntegerMatrix, LLL
from Crypto.Util.number import long_to_bytes
import re

txt = open('output.txt').read()
p = int(re.search(r'p=(\d+)', txt).group(1))
C = eval(re.search(r'C=(\[\[.*\]\])', txt, re.S).group(1))

n = 5
B = IntegerMatrix(n, n)
for i in range(n):
    for j in range(n):
        B[i, j] = C[i][j]
LLL.reduction(B)

row = [int(B[0, j]) for j in range(n)]
print(b''.join(long_to_bytes(abs(x)) for x in row))
```

输出：`b'moectf{h0w_P0werfu1_7he_latt1ce_1s}'`

### FLAG

```
flag{h0w_P0werfu1_7he_latt1ce_1s}
```

---

## Ez_wiener

### 题目信息

- 题号：605
- 类型：静态 Wiener 攻击

### 题面

```python
d = getPrime(nbits // 5)          # 约 204 bit
assert 30 * pow(d, 4) < n         # Wiener 条件
e = pow(d, -1, phi)
c = pow(m, e, n)
```

### 分析

题面断言 `30·d⁴ < n`，即 `d` 满足 Wiener 界 `d < n^{1/4}/3`，说明存在小私钥。对 `e/n` 做连分数展开，其某个收敛子 `k/d` 恰为真实的 `k/d`（`ed = 1 + kφ`），反解 `φ` 后检验二次方程 `x² - (n - φ + 1)x + n = 0` 的判别式为完全平方即确认并得到 `p, q`。

### 解题步骤

1. `d` 满足 Wiener 界 `d < N^{1/4}/3`，对 `e/n` 连分数展开。
2. 每个收敛子 `k/d` 反解 `phi`，检验 `x^2-(n-phi+1)x+n=0` 的判别式是否完全平方。
3. 得到 `d` 后常规 RSA 解密。

### EXP

```python
from Crypto.Util.number import long_to_bytes
import gmpy2

n = 84605285758757851828457377667762294175752561129610097048351349279840138483398457225774806927631502994733733589395840262513798535197234231207789297886471069978772805190331670685610247724499942260404337703802384815835647029115023558590369107257177909006753910122009460031921101203824769814404613875312981158627
e = 36007582633238869298665544067678113422327323938964762672901735035127703586926259430077542134592019226503943946361640448762427529212920888008258014995041748515569059310310043800176826513779147205500576568904875173836996771537397098255940072198687847850344965265595497240636679977485413228850326441605991445193
c = 25377227886381037011295005467170637635721288768510629994676412581338590878502600384742518383737721726526909112479581593062708169548345605933735206312240456062728769148181062074615706885490647135341795076119102022317083118693295846052739605264954692456155919893515748429944928104584602929468479102980568366803

def cf(a, b):
    while b:
        yield a // b
        a, b = b, a % b

n0, n1, d0, d1 = 0, 1, 1, 0
for q in cf(e, n):
    n0, n1 = n1, q * n1 + n0
    d0, d1 = d1, q * d1 + d0
    k, d = n1, d1
    if k == 0 or (e * d - 1) % k:
        continue
    phi = (e * d - 1) // k
    s = n - phi + 1
    disc = s * s - 4 * n
    if disc >= 0:
        t = gmpy2.isqrt(disc)
        if t * t == disc:
            print(long_to_bytes(pow(c, int(d), n)))
            break
```

### FLAG

```
flag{Ez_W1NNer_@AtT@CK!||}
```

---

## ez_DES

### 题目信息

- 题号：305
- 类型：静态 DES 弱密钥爆破

### 题面

```python
key = 'ezdes' + ''.join(secrets.choice(characters) for _ in range(3))
cipher = DES.new(key.encode(), DES.MODE_ECB)
# c = b'\xe6\x8b0\xc8m\t?\x1d\xf6\x99sA>\xce \rN\x83z\xa0\xdc{\xbc\xb8X\xb2\xe2q\xa4"\xfc\x07'
```

### 分析

DES 密钥 56 bit，但前 5 字节 `ezdes` 已知，只有后 3 字节未知，密钥空间收缩到 `95³ ≈ 8.6×10⁵`，秒级枚举即可；用 ECB 解出的明文以 `moectf{` 开头作为命中判据。

### 解题步骤

1. 密钥前 5 字节固定为 `ezdes`，后 3 字节来自字母数字标点，空间约 `95^3 ≈ 8.6×10^5`。
2. 枚举后 3 字节，DES-ECB 解密，明文以 `moectf{` 开头即命中。
3. 密钥为 `ezdes8br`。

### EXP

```python
import itertools, string
from Crypto.Cipher import DES

c = b'\xe6\x8b0\xc8m\t?\x1d\xf6\x99sA>\xce \rN\x83z\xa0\xdc{\xbc\xb8X\xb2\xe2q\xa4"\xfc\x07'
chars = string.ascii_letters + string.digits + string.punctuation
for t in itertools.product(chars, repeat=3):
    key = ('ezdes' + ''.join(t)).encode()
    pt = DES.new(key, DES.MODE_ECB).decrypt(c)
    if pt.startswith(b'moectf{'):
        print(pt, key)
        break
```

### FLAG

```
flag{_Ju5t envmEra+e.!}
```

---

## lit_elgamal_handshake

### 题目信息

- 题号：805
- 类型：静态 ElGamal，私钥泄露

### 题面

附件直接给出公钥 `(p,g,y)`、密文 `(c1,c2)`，以及被误打印的长期私钥 `x`。

### 分析

ElGamal 解密需要共享密钥 `s = c1^x (mod p)`，而附件错误地打印了长期私钥 `x`，等于把私钥直接交出。拿到 `s` 后 `m = c2 · s⁻¹ (mod p)` 即得明文。

### 解题步骤

1. 共享密钥 `s = c1^x mod p`。
2. `m = c2 * s^{-1} mod p`。
3. `long_to_bytes(m)`。

### EXP

```python
from Crypto.Util.number import long_to_bytes, inverse

p = 9000784855376359808051354825193962042770028561343848432778443672755982397391267124312572697249531643069409873722736348916207732622884411596948807031140651
c1 = 5245857426274383693193378669425243235151460522527004924092730024427525619244222247576829782077334810173274945751493387545849499010408499951268967774043627
c2 = 6059939492718262451327758167005534191200936922719178843825888167191062504030471358635203794720371216217447404436172970111033824674731063386612549785069654
x = 633366293219022684108628483753423657477324253833657141033762971761747669344649667887002347907882241246119223126492863291886751205505360049793728851371884
s = pow(c1, x, p)
print(long_to_bytes(c2 * inverse(s, p) % p))
```

### FLAG

```
flag{elgamal_leak_makes_happy_decrypt}
```

---

## rsa_neighbor

### 题目信息

- 题号：806
- 类型：静态 Fermat 分解

### 题面

标准 RSA，`n,e,c` 直接给出。题名 neighbor 提示 `p,q` 接近。

### 分析

题名 neighbor 提示 `p, q` 取值接近。若 `p, q` 接近，则满足 Fermat 分解条件：从 `a = ⌈√n⌉` 出发逐次加一，检查 `a² - n` 是否为完全平方数，首个成立的 `a ± b` 即为 `p, q`。本组数据 0 次迭代即命中。

### 解题步骤

1. `a = isqrt(n)+1`，检查 `a^2-n` 是否完全平方。
2. 本题 0 次迭代即分解，`q-p = 1135234`。
3. 常规 RSA 解密。

### EXP

```python
from Crypto.Util.number import long_to_bytes, inverse
from gmpy2 import isqrt

n = 139637440016232025690294457609899605991056011052010466558411851317943636600860419882966079629826706361935550982744312593243181819999590825159611186779613601241742349986440676188542381451066058816661317621009248513651083772907520139375108426466691332559612971244160246310746215067136490772061317571744230078911
c = 81172369642931859390486697024961350889751244109623802937988620847486863147682579984823958801948701482096140632580173113959531836503723522945335985723867818778699337807630592078265626995722998378992215523352858561923474395550395284015986525513984910021995657780411466237306614109262460764382539311725297619429
e = 65537
a = int(isqrt(n)) + 1
while True:
    t = a * a - n
    b = int(isqrt(t))
    if b * b == t:
        p, q = a - b, a + b
        break
    a += 1
print(long_to_bytes(pow(c, inverse(e, (p - 1) * (q - 1)), n)))
```

### FLAG

```
flag{rsa_fermat_finds_close_primes}
```

---

## ezAES

### 题目信息

- 题号：600
- 类型：静态残缺 AES

### 题面

自定义 AES：密钥 `Slightly different from the AES.`，密文

```
b'%\x98\x10\x8b\x93O\xc7\xf02F\xae\xedA\x96\x1b\xf9\x9d\x96\xcb\x8bT\r\xd31P\xe6\x1a\xa1j\x0c\xe6\xc8'
```

`shift_rows` 在 `i=0` 切片赋值后把局部变量 `grid` 改绑到新列表，调用方列表只经历一次空旋转，等价于没有 ShiftRows。

### 分析

题目复刻了 AES，但 `shift_rows` 因切片赋值把局部 `grid` 重新绑定，调用方矩阵实际只经历一次空旋转，等价于去掉了 ShiftRows 层。去掉 ShiftRows 后整个变换仍可逆：按源码复现（非标准）密钥扩展，再逆序执行 InvShiftRows / InvSubBytes / InvMixColumns / InvAddRoundKey 即可解密。

### 解题步骤

1. 按源码复现密钥扩展（轮常数 `rc` 与标准 AES 不同）。
2. 加密路径为：ARK → 9 轮 (SubBytes + MixColumns + ARK) → SubBytes + ARK。
3. 逆序 InvARK / InvMixColumns / InvSubBytes 解密两个 16 字节块。

### EXP

```python
from copy import deepcopy

key = b'Slightly different from the AES.'
enc = b'%\x98\x10\x8b\x93O\xc7\xf02F\xae\xedA\x96\x1b\xf9\x9d\x96\xcb\x8bT\r\xd31P\xe6\x1a\xa1j\x0c\xe6\xc8'
expanded = key_expansion(bytearray(key))
pt = b''.join(decrypt_block(enc[i:i+16], expanded) for i in range(0, 32, 16))
print(pt)
```

### FLAG

```
flag{Th1s_1s_4n_E4ZY_AE5_!@#}
```

---

## ez_det

### 题目信息

- 题号：601
- 类型：静态矩阵掩码

### 题面

5×5 矩阵 `M` 前 4 行是噪声，最后一行 `[m,0,0,0,0]`。左乘 `det=1` 的掩码 `A` 得 `C`，并给出前 4 行噪声。

### 分析

`C = A·M`，`M` 前 4 行是已知噪声、最后一行是 `[m, 0, 0, 0, 0]`。`C` 的第 1~4 列只由 `A` 的前 4 列与噪声决定，与未知的 `m` 无关，因此可在有理数域上从 `C[:,1:] = A[:,:4]·Noise[:,1:]` 反解出整数的 `A` 前 4 列；再用第 0 列消去噪声贡献，剩余向量为 `A[:,4]·m`，对其各分量取 `gcd` 即得 `m`。

### 解题步骤

1. `C[:,1:] = A[:,:4] * Noise[:,1:]`，在有理数上求逆得到 `A` 的前 4 列（整数）。
2. `C[:,0] - A[:,:4] * Noise[:,0] = A[:,4] * m`。
3. 该向量各分量的 gcd 即 `m`。

### EXP

```python
from math import gcd
from sympy import Matrix, Integer
from Crypto.Util.number import long_to_bytes

N, C = Matrix(Noise1), Matrix(C)
Aleft = (C[:, 1:] * N[:, 1:].inv()).applyfunc(lambda x: Integer(x))
w = C[:, 0] - Aleft * N[:, 0]
g = 0
for x in w:
    g = gcd(g, abs(int(x)))
print(long_to_bytes(g))
```

### FLAG

```
flag{D0_Y0u_kn0w_wh@7_4_de7erm1n@n7_1s!}
```

---

## ezlegendre

### 题目信息

- 题号：602
- 类型：静态勒让德符号

### 题面

对 flag 的每个比特 `b`，输出 `n = (a + b*d)^e mod p`，`e` 为 16-bit 奇素数，`d ∈ [1,10]`。

### 分析

`e` 是奇素数，故 `(n/p) = ((a + b·d)^e/p) = ((a + b·d)/p)`（勒让德符号的幂不变性）。比特 `b = 0` 时恒有 `(n/p) = (a/p)`；比特 `b = 1` 时 `(a + d)/p` 与 `(a/p)` 以大概率不同（`d ∈ [1,10]` 很小，配合题目构造保证可区分）。逐比特比较符号即可还原二进制串。

### 解题步骤

1. `e` 为奇数，勒让德符号 `(n/p) = ((a+b d)/p)`。
2. `b=0` 时与 `(a/p)` 相同；`b=1` 时 `d` 很小，`(a+d/p)` 与 `(a/p)` 不同。
3. 比较 `(n/p)` 与 `(a/p)` 还原比特串。

### EXP

```python
p = 258669765135238783146000574794031096183
a = 144901483389896508632771215712413815934
la = pow(a, (p - 1) // 2, p)
bits = ['0' if pow(n, (p - 1) // 2, p) == la else '1' for n in ciphertext]
print(int(''.join(bits), 2).to_bytes(len(bits) // 8, 'big'))
```

### FLAG

```
flag{Y0u_h@v3_ju5t_s01v3d_7h1s_pr0b13m!}
```

---

## ezHalfGCD

### 题目信息

- 题号：608
- 类型：静态相关消息 / 多项式 GCD

### 题面

`e=11`，同时给出 `d^e`、`phi^e`、`m^e`（均 mod `n`）。`e d - k phi = 1`，`k < e`。

### 分析

题面同时给出 `d^e`、`φ^e`、`m^e (mod n)`，且 `ed = 1 + kφ`、`k < e = 11`。令 `f(X) = X^e - φ^e`、`g(X) = (1 + kX)^e - e^e·d^e`，两者在模 `n` 下共享根 `X = φ`（因 `(ed)^e ≡ (1 + kφ)^e (mod n)`），对每个候选 `k` 求多项式 GCD，GCD 降到一次式时即解出 `φ`，进而分解 `n`。

### 解题步骤

1. 整数上 `e d = 1 + k phi`，故 `(e d)^e ≡ (1 + k phi)^e (mod n)`。
2. 令 `f(X)=X^e - enc_phi`，`g(X)=(1+k X)^e - e^e enc_d`。
3. 枚举 `k=1..10`，对 `f,g` 做模 `n` 多项式 GCD；`k=10` 时得到一次式，解出 `phi`。
4. `p+q = n-phi+1`，判别式平方即分解，再解 RSA。

### EXP

```python
# k = 10 时 gcd(f, g) 为一次多项式，得 phi
s = n - phi + 1
delta = isqrt(s * s - 4 * n)
p, q = (s + delta) // 2, (s - delta) // 2
d = inverse(11, (p - 1) * (q - 1))
print(long_to_bytes(pow(enc_flag, d, n)))
```

### FLAG

```
flag{N0w_y0u_kn0w_h0w_t0_g3t_th1s_fl@G__!!!!!!!!!!}
```

---

## tiny_key_aes

### 题目信息

- 题号：807
- 类型：静态 AES 弱密钥爆破

### 题面

AES-128-ECB，密钥前 13 字节固定为 `LitCTF2026!!!`，后 3 字节随机。密文 48 字节。

### 分析

AES-128 密钥 16 字节，前 13 字节固定为 `LitCTF2026!!!`，仅后 3 字节随机，密钥空间仅 `256³ ≈ 1.7×10⁷`。逐个枚举后缀做 ECB 解密，以明文 `litctf{` 前缀为判据即可在可接受时间内爆破。

### 解题步骤

1. 枚举后 3 字节，共 `256^3 = 16777216`。
2. ECB 解密，明文以 `litctf{` 开头即命中。
3. 密钥后缀为 `7\xa2\x01`。

### EXP

```python
from Crypto.Cipher import AES

c = b"\x0c\xdb'`\xc91\xf7\x05\x91+\x0fM\xed\xbc\x9b\xf1\xd8D\xcd\xfd\x0c\xb9\xb6\xb2J<\x86\x19\x06K\xb3\xa2\xa4\x18\x87<v\xac\x1bbu#\xaa\xb5I\x7f\xd8\xd3"
prefix = b'LitCTF2026!!!'
for a in range(256):
    for b in range(256):
        for d in range(256):
            pt = AES.new(prefix + bytes([a, b, d]), AES.MODE_ECB).decrypt(c)
            if pt.startswith(b'litctf{'):
                print(pt)
                raise SystemExit
```

### FLAG

```
flag{aes_tiny_brut3_for_the_win!}
```

---

## Ez_ECC

### 题目信息

- 题号：493
- 类型：P-256 上的小规模 ECDLP（BSGS）

### 题面

P-256 曲线（`a = -3`），`s = random.randint(1, 2**40)`，`Q = s * P`。密钥为 `sha256(str(s))`，AES-ECB 加密 FLAG。

### 分析

`Q = s·P` 是一个小规模 ECDLP：`s` 仅 40 bit，直接用 Baby-step Giant-step 可解。取 `step = 2^20`，把 `s = i·step + j` 拆开，预计算 baby 表 `{j·P → j}`（1M 个点），再以 `step·P` 为巨人步逐次匹配 `Q - i·step·P`。曲线 `a = -3` 需在 Jacobian 坐标双倍公式中保留 `a·Z⁴` 项。解得 `s` 后以 `sha256(str(s))` 作 AES 密钥解密。

### 解题步骤

1. `s < 2^40`，用 BSGS 拆成 `s = i*step + j`，`step = 2^20`，baby 表存 `j*P`（1M 个点）。
2. 巨人步：从 `i = 0` 起累加 `step*P`，每步查询 `Q - i*step*P` 是否在 baby 表。
3. 曲线 `a = -3`，Jacobian 坐标双倍公式必须带 `a*Z^4` 项，加法公式 `Z3 = 2*Z1*Z2*H`。
4. 解出 `s = 109516527476`，还原 AES 密钥得到明文。

### EXP

```python
from Crypto.Util.number import inverse
from Crypto.Cipher import AES
from hashlib import sha256

p = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff
a_ = 0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc
P = (96072097493962089165616681758527365503518618338657020069385515845050052711198,
     106207812376588552122608666685749118279489006020794136421111385490430195590894)
Q = (100307267283773399335731485631028019332040775774395440323669585624446229655081,
     22957963484284064705317349990185223707693957911321089428005116099172185773154)
ct = bytes.fromhex('3ae55ed273926b589612b764541a6d9486cd2e842a2d93b5148d999492fa4345'
                   'bd01263fe10166ef8fe3131396a60fc0')

def to_jac(P1):
    return (P1[0], P1[1], 1)

def to_aff(P1):
    X, Y, Z = P1
    zi = inverse(Z, p); zi2 = zi * zi % p
    return (X * zi2 % p, Y * zi2 * zi % p)

def dbl_jac(P1):
    X1, Y1, Z1 = P1
    A = X1 * X1 % p; B = Y1 * Y1 % p; C = B * B % p
    D = 2 * ((X1 + B) * (X1 + B) - A - C) % p
    E = (3 * A + a_ * pow(Z1, 4, p)) % p
    F = E * E % p
    X3 = (F - 2 * D) % p
    Y3 = (E * (D - X3) - 8 * C) % p
    Z3 = 2 * Y1 * Z1 % p
    return (X3, Y3, Z3)

def add_jac(P1, P2):
    if P1 is None: return P2
    if P2 is None: return P1
    X1, Y1, Z1 = P1; X2, Y2, Z2 = P2
    Z1Z1 = Z1 * Z1 % p; Z2Z2 = Z2 * Z2 % p
    U1 = X1 * Z2Z2 % p; U2 = X2 * Z1Z1 % p
    S1 = Y1 * Z2 * Z2Z2 % p; S2 = Y2 * Z1 * Z1Z1 % p
    if U1 == U2:
        return dbl_jac(P1) if S1 == S2 else None
    H = (U2 - U1) % p; I = 4 * H * H % p; J = H * I % p
    r = 2 * (S2 - S1) % p; V = U1 * I % p
    X3 = (r * r - J - 2 * V) % p
    Y3 = (r * (V - X3) - 2 * S1 * J) % p
    Z3 = 2 * Z1 * Z2 * H % p
    return (X3, Y3, Z3)

def mul_jac(k, P1):
    R = None
    while k:
        if k & 1: R = add_jac(R, P1)
        P1 = dbl_jac(P1); k >>= 1
    return R

step = 1 << 20
minusP = (P[0], (-P[1]) % p, 1)
baby = {}
cur = (Q[0], Q[1], 1)
for j in range(step):
    baby[to_aff(cur)] = j
    cur = add_jac(cur, minusP)

giant = mul_jac(step, P)
cur_j = None
s = None
for i in range(0, (1 << 40) // step + 2):
    affine = to_aff(cur_j) if cur_j is not None else None
    if affine in baby:
        s = i * step + baby[affine]
        break
    cur_j = giant if cur_j is None else add_jac(cur_j, giant)

key = sha256(str(s).encode()).digest()
print(AES.new(key, AES.MODE_ECB).decrypt(ct))
```

### FLAG

```
flag{ECC_1s_4w3s0m3_but_n0t_perf3ct}
```

---

## Twin Orbit

### 题目信息

- 题号：823
- 类型：RSA 共模攻击

### 题面

同一明文 `m` 用同一模数 `n`、不同公钥指数 `e1=65537`、`e2=17` 加密得 `c1、c2`。

### 分析

同一明文 `m` 用同一模数 `n` 分别以 `e1 = 65537`、`e2 = 17` 加密，且 `gcd(e1, e2) = 1`，构成经典共模攻击。用扩展欧几里得求 `a·e1 + b·e2 = 1`，则 `m = c1^a · c2^b (mod n)`（负指数用模逆处理），即可绕过分解 `n` 直接恢复明文。

### 解题步骤

1. `gcd(e1, e2) = 1`，用扩展欧几里得求 `a*e1 + b*e2 = 1`。
2. `m = c1^a * c2^b mod n`（指数为负时用模逆）。

### EXP

```python
from Crypto.Util.number import long_to_bytes, inverse
import gmpy2

a, b = gmpy2.gcdext(e1, e2)[1], gmpy2.gcdext(e1, e2)[2]
a, b = int(a), int(b)
m = 1
if a >= 0:
    m *= pow(c1, a, n)
else:
    m *= pow(inverse(c1, n), -a, n)
m %= n
if b >= 0:
    m *= pow(c2, b, n)
else:
    m *= pow(inverse(c2, n), -b, n)
m %= n
print(long_to_bytes(m))
```

### FLAG

```
flag{ZeroG_common_modulus_attack}
```

---

## Lunar LCG

### 题目信息

- 题号：824
- 类型：LCG 状态恢复 + 流密码 XOR

### 题面

`m = 2^127 - 1` 素数，LCG `state = (a*state + c) mod m`。加密前泄露 6 个连续状态，加密时每个明文字节与 `state & 0xff` 异或。

### 分析

LCG `s_{t+1} = a·s_t + c (mod m)`，模数 `m = 2^127 - 1` 为素数且公开。连续 6 个泄露状态足以确定参数：由 `s2 - s1 ≡ a·(s1 - s0)` 解出 `a`，再由任一状态解出 `c`。此后按加密同路径继续迭代，每步取状态低 8 位与密文字节异或即还原明文。

### 解题步骤

1. 由相邻三个状态解出 `a = (s2-s1)/(s1-s0) mod m`、`c = s1 - a*s0 mod m`。
2. 从最后一个泄露状态继续迭代，取低 8 位与密文异或还原明文。

### EXP

```python
from Crypto.Util.number import inverse

mm = 170141183460469231731687303715884105727
leaks = [48077378362307815584689819960136019875,
         100310108693164117002347749113390493183,
         145646689101109657050476193569066602802,
         63949818470656288394594660187785964270,
         46314465195318558087862397882705709486,
         103138436636073932218183299598776830813]
a = (leaks[2] - leaks[1]) * inverse((leaks[1] - leaks[0]) % mm, mm) % mm
c = (leaks[1] - a * leaks[0]) % mm
state = leaks[-1]
ct = bytes.fromhex('39fe07de62fdc9bf74bbbcbd7e202386ca9e40451b46c74968e30fff138a95')
out = bytearray()
for bl in ct:
    state = (a * state + c) % mm
    out.append(bl ^ (state & 0xff))
print(bytes(out))
```

### FLAG

```
flag{ZeroG_lcg_stream_recovery}
```

---

## Phobos Padding

### 题目信息

- 题号：825
- 类型：RSA 低指数广播攻击（Håstad）

### 题面

`e = 3`，同一明文无填充加密到三个不同 `n`。

### 分析

`e = 3`，同一明文 `m` 无填充加密到三个不同模数，构成 Håstad 广播攻击。由于 `m³ < n1·n2·n3`，用 CRT 把三个密文合并成 `M ≡ m³ (mod n1·n2·n3)`，再对 `M` 开三次方根即直接得到整数明文。

### 解题步骤

1. CRT 合并三个密文得 `M = m^3 mod (n1*n2*n3)`。
2. 对 `M` 取立方根即得明文。

### EXP

```python
from Crypto.Util.number import long_to_bytes, inverse
from math import isqrt

N = n1 * n2 * n3
M = 0
for ni, ci in zip((n1, n2, n3), (c1, c2, c3)):
    Ni = N // ni
    M += ci * Ni * inverse(Ni, ni)
M %= N
m = isqrt(M)
while (m + 1) ** 3 <= M:
    m += 1
while m ** 3 > M:
    m -= 1
print(long_to_bytes(m))
```

### FLAG

```
flag{ZeroG_hastad_broadcast_attack}
```

---
