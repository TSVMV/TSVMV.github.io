---
title: 青岑密码学题集 WP
date: 2026-09-21 17:30:00
categories: [CTF]
tags: [CTF, 密码学, WP]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg51.jpg
---

## 写在前面

这套题从 01 做到 55（中间跳了 41、42），工具链、古典密码、数论、分组密码、伪随机数、RSA、椭圆曲线、侧信道都过了一遍。写的时候就是边做边记，卡哪写哪。

几个反复用到的东西先写这儿，后面就不重复了。

模运算不用解释。模逆元就是模世界里的除法，`pow(a, -1, m)` 一行搞定，前提是 gcd(a,m)=1。字节和十六进制来回转是日常：`bytes.fromhex()`、`int.to_bytes()`、pycryptodome 的 `long_to_bytes` / `bytes_to_long`。异或记住 `a ^ b ^ b == a`，流密码的命根子。

chall.txt 的解析有个固定套路——前面带中文说明行，直接 exec 会炸，逐行抠：

```python
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v
```

后面大量 exp 都用这个模式。环境就 `pip install pycryptodome sympy gmpy2`，05–07 用 SageMath 更顺手，没装也能做。

<!-- more -->

---

# 一、入门（01–08）

## 01 欢迎来到密文大陆

ROT13。打开 chall.txt，英文字母被打乱了但数字没动，位置变了字符还在——这就是移位密码。挨个试一下发现整体后移了 13 位。26 个字母移 13 再移 13 正好回来，所以加解密同一个操作。

```python
# exp01.py
abc = "abcdefghijklmnopqrstuvwxyz"
t = str.maketrans(abc + abc.upper(),
                   abc[13:] + abc[:13] + abc.upper()[13:] + abc.upper()[:13])
ct = open("chall.txt", encoding="utf-8").read()
print(ct.translate(t))
```

FLAG：`flag{h3x_w31c0me_bdf64294}`

`str.maketrans` 配 `translate` 比手写循环省心。移位数不知道的话，1 到 25 全试一遍看哪个出人话。

## 02 巨树的年轮

仿射密码。这次不只移位还乘了个系数：`c = (a*x + b) mod m`。题目把参数给得很清楚——字符域是可打印 ASCII 32 到 126 共 95 个字符，m=95，字符编号 `x = ord(ch) - 32`，a=29，b=17。

解密就是反着来：`x = (c - b) * a^-1 mod 95`。前提是 a 和 m 互素才有逆元，29 和 95 没公因子，`pow(29, -1, 95)` 直接用。

```python
# exp02.py
a, b, mod = 29, 17, 95
a_inv = pow(a, -1, mod)

ct = open("chall.txt", encoding="utf-8").read().strip()
pt = ""
for ch in ct:
    x = (ord(ch) - 32 - b) * a_inv % mod
    pt += chr(x + 32)
print(pt)
```

FLAG：`flag{b1g_1nt_b1g_p0wer_30293ea3}`

a 和 m 不互素的话不同明文会撞到同一个密文，解不回来，出题人选参数必须避开。

## 03 青铜试炼

这题没什么攻击，纯考你会不会把三个库串起来。chall.txt 给了 p、a、s、ct，题面把密钥怎么造写得明明白白：先算 a 模 p 的逆元，把"逆元的十进制字符串 + 盐 s"扔进 SHA-256，取摘要十六进制串前 16 个字符当 AES 密钥，ECB 解密。

照着做就行。翻车全在类型上：逆元是 int，拼字符串前要 str()；哈希输入要 .encode()；hexdigest() 出来是字符串，取前 16 字符再 encode 成 bytes 才能当密钥。

```python
# exp03.py
import gmpy2, hashlib
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

p, a = int(ns["p"], 16), int(ns["a"], 16)   # 这题数字是十六进制
s = ns["s"]
ct = bytes.fromhex(ns["ct"])

inv = gmpy2.invert(a, p)
key = hashlib.sha256((str(inv) + s).encode()).hexdigest()[:16].encode()
print(unpad(AES.new(key, AES.MODE_ECB).decrypt(ct), 16).decode())
```

FLAG：`flag{lib_1s_y0ur_bl4de_e2788ba8}`

做密码题一半的报错来自 int/str/bytes 互转搞错。写之前先想清楚每步输入输出什么类型，能少调半天。

## 04 试炼塔第一层

列置换。前面几题都在改字符，这题一个字符不改，只把位置打乱。

加密是把明文按行填进宽度为 key 长度的矩阵，然后按 key 的字母序一列一列读出来。key 是 KEY，字典序 E<K<Y，先读 E 对应的第 1 列，再第 0 列，最后第 2 列。解密倒着走，按同样列顺序把密文切回各列再按行拼回去。

```python
# exp04.py
import re

raw = open("chall.txt").read()
key = re.search(r"key\s*=\s*(\w+)", raw).group(1)
ct = raw.split("ct = ", 1)[1].strip()          # ct 跨了两行，整段读

order = sorted(range(len(key)), key=lambda i: key[i])   # [1, 0, 2]
ncols = len(key)
nrows = -(-len(ct) // ncols)                   # 上取整
padded = ct.ljust(nrows * ncols, "#")

cols, idx = {}, 0
for c in order:
    cols[c] = padded[idx:idx + nrows]
    idx += nrows

pt = ""
for r in range(nrows):
    for c in range(ncols):
        if r < len(cols[c]):
            pt += cols[c][r]
print(pt.rstrip("#"))
```

FLAG：`flag{c01umn4r_tr4nsp0s1t10n_{9c2f8e17}}`

踩了两个坑：一是 ct 断成两行，只读第一行得到一堆乱序字符；二是补齐的 # 最后要去掉。`sorted(range(n), key=...)` 对下标排序这个写法记住。

## 05 长阶递推

FLAG 第 i 个字节当第 i 个质数的指数，全乘起来得 N。`N = 2^b1 * 3^b2 * 5^b3 * ...`，b1 是第一个字节的 ASCII 值。

还原靠算术基本定理，分解 N 读指数就行。N 四千多位看着吓人，但质因数全是小质数（大的都在指数上），sympy factorint 秒出，SageMath 里 factor(N) 一样。

```python
# exp05.py
import re, sys
sys.set_int_max_str_digits(100000)     # Python 3.11 默认限 4300 位，先放开
from sympy import factorint

lines = open("chall.txt").read().splitlines()
i = next(k for k, l in enumerate(lines) if l.startswith("N = "))
N = int(re.sub(r"\D", "", "".join(lines[i:])))   # N 跨行，拼起来

fac = factorint(N)
primes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127]
print(bytes(fac[p] for p in primes if p in fac))
```

FLAG：`flag{s4ge_zz_f4ct0r_{41c2c039}}`

三个坑：Python 3.11 起整数转字符串默认限 4300 位不放开直接报错；N 跨行要拼；说明文字里也出现过 "N"，定位要从以 `N = ` 开头那行开始。大整数能不能分解看质因子结构，其次才是位数。

## 06 异界投影

和 02 一个模子，模 95 换成模素数 p。加密 `c = (a*t + b) mod p`，解密 `(c - b) * a^-1 mod p`，没新东西。这题主要是引入 GF(p)——模素数 p 的算术世界里加减乘除全通，叫"域"。SageMath 里写 `GF(p)((x-b)/a)`，除号自动就是乘逆元。

```python
# exp06.py
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

p, a, b = int(ns["p"]), int(ns["a"]), int(ns["b"])
ct = eval(ns["ct"])
ainv = pow(a, -1, p)
print(bytes(((x - b) * ainv) % p for x in ct))
```

FLAG：`flag{s4ge_gf16_pr0j3ct_{2a0297a4}}`

以后看到模运算语境里的 `/`，就是 `pow(除数, -1, p)`。

## 07 三角之钥

密文 `b = A * x (mod p)`，x 每个分量一个明文字节。解方程组就行，中学高斯消元搬过来，就两处要改：除法换乘逆元，所有加减乘取模。

SageMath 一行：`Matrix(GF(p), A).solve_right(vector(GF(p), b))`。手写也不长：

```python
# exp07.py
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

p, A, b = int(ns["p"]), eval(ns["A"]), eval(ns["b"])

def solve_mod(A, b, p):
    n = len(A)
    M = [row[:] for row in A]
    v = b[:]
    for i in range(n):
        for k in range(i, n):       # 选第 i 列非零行当主元
            if M[k][i] % p:
                M[i], M[k] = M[k], M[i]
                v[i], v[k] = v[k], v[i]
                break
        inv = pow(M[i][i], -1, p)
        M[i] = [(x * inv) % p for x in M[i]]
        v[i] = (v[i] * inv) % p
        for k in range(n):
            if k != i and M[k][i]:
                f = M[k][i]
                M[k] = [(M[k][j] - f * M[i][j]) % p for j in range(n)]
                v[k] = (v[k] - f * v[i]) % p
    return v

print(bytes(solve_mod(A, b, p)))
```

FLAG：`flag{s4ge_m4trix_s0lver_{1e674f01}}`

模 p 高斯消元后面 ECC 那几章要用，自己写一遍比较踏实。

## 08 古老约定

每组数据 `(t*k, t*l)`，k、l 互素。gcd 的性质 `gcd(t*k, t*l) = t * gcd(k, l) = t`，因为 gcd(k,l)=1。每对数字求个 gcd，明文字节自己跳出来。

```python
# exp08.py
import ast, math

pairs = ast.literal_eval(open("chall.txt").read().split("pairs = ")[1].strip())
a, b = pairs
print(bytes(math.gcd(x, y) for x, y in zip(a, b)))
```

FLAG：`flag{ex_gcd_1s_p0w3rful_{aa0139c6}}`

题目提到扩展欧几里得（egcd），求 gcd 的同时给出 u、v 满足 `u*a + v*b = gcd(a,b)`。背一份，38 题共模攻击直接用：

```python
def egcd(a, b):
    if b == 0:
        return a, 1, 0
    g, x, y = egcd(b, a % b)
    return g, y, x - (a // b) * y
```

读数据用 `ast.literal_eval` 代替 `eval`，只解析字面量，安全点。

---

# 二、数论（09–14）

## 09 互质之墙

每个密文元素 `x = t^-1 (mod p)`，明文字节被换成了自己的逆元。互逆是对称的——t 的逆元是 x，x 的逆元就是 t。每个密文再求一次逆元就回来了。

```python
# exp09.py
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

p = int(ns["p"])
ct = eval(ns["ct"])
print(bytes(pow(x, -1, p) for x in ct))
```

FLAG：`flag{inv_m0d_1s_k3y_{a5abaac7}}`

`pow(x, -1, p)` 抛 ValueError 说明 x 和 p 不互素，这本身就是提示。

## 10 费马的秘密

加密 `ci = t^(p-2) mod p`，看着唬人其实就是求逆元。费马小定理说 p 是素数且 t 不是 p 的倍数时 `t^(p-1) ≡ 1 (mod p)`，两边除 t 得 `t^(p-2) ≡ t^-1 (mod p)`。求 p-2 次幂和求逆元是一回事。

逆元的逆元是自己，对每个 ci 再算一次 `ci^(p-2)` 就行：

```python
# exp10.py
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

p = int(ns["p"])
ct = eval(ns["ct"])
print(bytes(pow(c, p - 2, p) for c in ct))
```

FLAG：`flag{ferm4t_s4ys_1nvert_{a639e9e9}}`

`a^(p-2) ≡ a^-1 (mod p)` 记住，素数域的题里常出。

## 11 欧拉的馈赠

迷你 RSA：`c = t^e mod n`，n = p*q，p、q 接近。

费马小定理要求模数是素数，欧拉推广到任意模数。φ(n) 是 1 到 n 里和 n 互素的数的个数，n=pq 时 `φ(n) = (p-1)(q-1)`。欧拉定理说 gcd(t,n)=1 时 `t^φ(n) ≡ 1 (mod n)`。

RSA 就是挑个 e 使 `e*d ≡ 1 (mod φ(n))`，于是：

```
(t^e)^d = t^(e*d) = t^(k*φ(n)+1) = (t^φ(n))^k * t ≡ t (mod n)
```

想算 d 必须知道 φ(n)，想知道 φ(n) 必须分解 n。这就是 RSA 安全的全部来源。

p、q 接近时用费马分解：`n = a² - b²`，a 约 √n。从 ⌈√n⌉ 开始试 a，看 `a² - n` 是不是完全平方数。

```python
# exp11.py
import math

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e, ct = int(ns["n"]), int(ns["e"]), eval(ns["ct"])

a = math.isqrt(n) + 1
while True:
    b2 = a * a - n
    b = math.isqrt(b2)
    if b * b == b2:
        break
    a += 1
p, q = a - b, a + b

d = pow(e, -1, (p - 1) * (q - 1))
print(bytes(pow(c, d, n) for c in ct))
```

FLAG：`flag{ph1_eul3r_1s_tr1cky_{175f7b6d}}`

"分解 → φ → d → 解密"这条流水线是 RSA 整章的地基，后面十几题全是变体。求平方根用 `math.isqrt`，浮点 sqrt 在大数上会精度出错。

## 12 余数的密语

CRT。明文拼成大整数 x，分别模三个两两互素的模数得到三个余数。知道几个模世界里的余数，在 `m1*m2*m3` 范围内唯一确定 x：

```
x = ( a1*M1*t1 + a2*M2*t2 + a3*M3*t3 ) mod M
    M = m1*m2*m3, Mi = M/mi, ti = Mi 模 mi 的逆元
```

为什么成立？拿第一项看，`M1*t1 ≡ 1 (mod m1)`，这一项模 m1 等于 a1；另外两项都含 M1，模 m1 全是 0。每个方程自己那项满足、其他项放过，加起来全对。

```python
# exp12.py
import re

raw = open("chall.txt").read()
m1, m2, m3 = [int(x) for x in re.search(r"^m1, m2, m3 = (.+)$", raw, re.M).group(1).split(",")]
a1, a2, a3 = [int(x) for x in re.search(r"^a1, a2, a3 = (.+)$", raw, re.M).group(1).split(",")]

M = m1 * m2 * m3
x = (a1 * (M//m1) * pow(M//m1, -1, m1)
   + a2 * (M//m2) * pow(M//m2, -1, m2)
   + a3 * (M//m3) * pow(M//m3, -1, m3)) % M
print(x.to_bytes((x.bit_length() + 7) // 8, "big"))
```

FLAG：`flag{cr1t_s1lm3r_m0rf3v_{bfd3c20a}}`

sympy 有现成的 `crt()`。CRT 后面反复用——39 题广播攻击、50 题 Pohlig-Hellman 都靠它合回结果。模数两两互素是前提，不互素公式直接失效。

## 13 原根之杖

`y = g^t mod p`，g 是 p 的原根，t 是明文字节。离散对数一般很难，但这题 t 只有 256 种取值——预计算 g^0 到 g^255 存字典，拿密文查表完事。

原根为什么重要？元素 g 的"阶"是最小的 k 使 `g^k ≡ 1 (mod p)`。阶恰好 p-1 就叫原根，保证 g^0 到 g^(p-2) 两两不同，每个字节唯一加密唯一还原。

```python
# exp13.py
import re

raw = open("chall.txt").read()
p = int(re.search(r"^p = (\d+)$", raw, re.M).group(1))
g = int(re.search(r"^g = (\d+)$", raw, re.M).group(1))
ct = eval(re.search(r"^ct = \[(.*)\]$", raw, re.M).group(0).split(" = ", 1)[1])

table = {pow(g, i, p): i for i in range(256)}
print(bytes(table[y] for y in ct))
```

FLAG：`flag{pr1m4t3_r00t_0rd3r_{5eacf3b2}}`

离散对数难度看指数空间大小。256 查表就行，2^256 就得靠算法了。

## 14 离散之梯

BSGS。和 13 同款加密，这次正经用 BSGS 解。把指数劈两半：`t = i*m + j`，代进 `y = g^t` 移项：

```
y * (g^-m)^i = g^j
```

左边从 y 出发每次乘 g^-m 最多走 m 步，右边 g^j 只有 m 个先算好存表。两边撞上时 `t = i*m + j`。时间空间都是 O(√p)。

```python
# exp14.py
import re

raw = open("chall.txt").read()
p = int(re.search(r"^p = (\d+)$", raw, re.M).group(1))
g = int(re.search(r"^g = (\d+)$", raw, re.M).group(1))
ct = eval(re.search(r"^ct = \[(.*)\]$", raw, re.M).group(0).split(" = ", 1)[1])

m = 16                                        # 本题 t < 256，取 16 够
tbl = {pow(g, j, p): j for j in range(m)}     # baby steps
factor = pow(g, -m, p)                        # giant step 乘子

msg = []
for y in ct:
    cur = y
    for i in range(m):
        if cur in tbl:
            msg.append(i * m + tbl[cur])
            break
        cur = cur * factor % p
print(bytes(msg))
```

FLAG：`flag{bsgs_1s_s0_f4st_{ce81f699}}`

√n 这个量级记住：40 位的群 BSGS 瞬间出解，256 位的还是没戏。ECC 章节（50–52）会把它当子工具反复用。

---

# 三、古典密码变奏（15–20）

## 15 序的迷宫

栅栏密码。明文沿锯齿写在 k 行：第 1 个放第 0 行，第 2 个放第 1 行，第 3 个又回第 0 行……写完逐行读出。k=2 时偶数位全进第 0 行，奇数位进第 1 行。加密结果 = 偶位串 + 奇位串，解密就是前一半填回偶数位、后一半填回奇数位。

踩了个坑：ct 跨行要整段读。还有更坑的——明文其实是"说明句子 + FLAG"两段分别独立加密后拼在一起的，整段一起解会得到正确句子配上乱码 flag。对每个可能的分段点把尾部单独做栅栏还原，看到 `flag{` 就是它。

```python
# exp15.py
raw = open("chall.txt").read()
ct = raw.split("ct = ", 1)[1].replace("\n", "").strip()

def zigdec(s):
    n = len(s)
    half = (n + 1) // 2
    r0, r1 = s[:half], s[half:]
    pt = ""
    for i in range(n):
        if i % 2 == 0:
            pt += r0[i // 2] if i // 2 < len(r0) else ""
        else:
            pt += r1[i // 2] if i // 2 < len(r1) else ""
    return pt

for b in range(len(ct)):
    d = zigdec(ct[b:])
    if "flag{" in d:
        print(d)
        break
```

FLAG：`flag{r41l_f3nc3_c1ph3r_{8b3a5d2c}}`

解出来半对半乱的时候，第一反应分段加密。

## 16 异或之镜

单字节 XOR。密文一个单字节密钥逐字节 XOR，密钥只有 256 种可能，全试一遍哪个以 `flag{` 开头就是对的。

```python
# exp16.py
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

ct = bytes.fromhex(ns["ct"])
for k in range(256):
    m = bytes(b ^ k for b in ct)
    if m.startswith(b"flag{"):
        print(hex(k), m.decode())
        break
```

FLAG：`flag{x0r_s1ngl3_byt3_brut3_{d1c4e7b9}}`

flag 格式本身就是校验条件。没有前缀线索就给候选解打"可打印字符占比"分取最高。

## 17 移位齿轮

希尔密码。02 题仿射一次处理一个字符，希尔一次处理一组：两个字符拼成向量乘 2×2 矩阵 K 再 mod 95。分组密码最原始的雏形，AES 一次处理 16 字节精神上就是它的巨型后代。

解密要 K 的逆矩阵。2×2 公式手算友好：`K^-1 = det(K)^-1 * adj(K)`，伴随矩阵主对角互换副对角变号。`det(K) = 3*5 - 3*2 = 9`，和 95 互素逆元存在。

```python
# exp17.py
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

K = eval(ns["K"])
ct = ns["ct"]
mod = 95

det = (K[0][0] * K[1][1] - K[0][1] * K[1][0]) % mod
dinv = pow(det, -1, mod)
K_inv = [[ K[1][1] * dinv % mod, -K[0][1] * dinv % mod],
         [-K[1][0] * dinv % mod,  K[0][0] * dinv % mod]]

vals = [ord(c) - 32 for c in ct]
pt = ""
for i in range(0, len(vals), 2):
    v = vals[i:i + 2]
    pt += chr((K_inv[0][0]*v[0] + K_inv[0][1]*v[1]) % mod + 32)
    pt += chr((K_inv[1][0]*v[0] + K_inv[1][1]*v[1]) % mod + 32)
print(pt)
```

FLAG：`flag{h1ll_c1ph3r_m4tr1x_{7a9f2c4e}}`

逆矩阵存在当且仅当行列式和模数互素，和仿射密码 a 要与 m 互素一个道理的矩阵版。

## 18 编码双面人

ROT47。ROT13 只动 26 个字母，ROT47 作用域扩大到全部可打印 ASCII：从 `!`(33) 到 `~`(126) 共 94 个字符统一后移 47 位。94 是 47 的两倍，自逆，再做一遍还原。

```python
# exp18.py
def rot47(s):
    return "".join(chr(33 + (ord(c) - 33 + 47) % 94)
                   if 33 <= ord(c) <= 126 else c
                   for c in s)

print(rot47(open("chall.txt", encoding="utf-8").read()))
```

FLAG：`flag{r0t47_a5cii_sh1ft_{3b6d9a1f}}`

密文里连数字都"乱"了就往 ROT47 想，ROT13 只管字母。

## 19 凯撒的变奏

维吉尼亚。凯撒只有一个移位量频率分析一打就穿，维吉尼亚用循环密钥引入多个移位：第 1 个移 K 的量、第 2 个移 E、第 3 个移 Y、第 4 个回 K……同一个字母在不同位置被移不同量，单字母统计失效。

key 给了，逐字符减密钥流就行。编号基准还是 32，字符和密钥都先减 32 再 mod 95。

```python
# exp19.py
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

key, ct = ns["key"], ns["ct"]
msg = ""
for i, c in enumerate(ct):
    shift = ord(key[i % len(key)]) - 32
    msg += chr((ord(c) - 32 - shift) % 95 + 32)
print(msg)
```

FLAG：`flag{v1g3n3r3_c1ph3r_m4th_{c71c32e4}}`

把"减法密钥流"换成"XOR 密钥流"维吉尼亚就变成流密码了。key 未知时先猜密钥长度（Kasiski 或重合指数），按位置分组退化成凯撒做频率分析。

## 20 字母的指纹

频率分析。连偏移量都不给，只说每个可打印字符偏移了固定位数。95 个字符域偏移最多 94 种，暴力全试人工挑也行，但频率分析更省事——英文里空格、e、t 出现频率远高于其他。统计密文里哪个字符最多，大概率对应原文空格（编号 32），两个编号一减偏移就出来了。

这题算出来偏移 7：

```python
# exp20.py
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

ct = ns["ct"]
print("".join(chr((ord(c) - 32 - 7) % 95 + 32) for c in ct))

# 偏移未知时通用爆破，人工挑可读的：
# for k in range(1, 95):
#     print(k, "".join(chr((ord(c)-32-k) % 95 + 32) for c in ct))
```

FLAG：`flag{frequ3ncy_4n4lys1s_{bccd9e92}}`

建议写个自动打分版（英文字符占比最高的 k 胜出），以后凯撒题一键解决。

---

# 四、分组密码（21–25）

## 21 镜中块

AES-ECB。明文切 16 字节一块，密钥控制下多轮替换移位混淆输出密文块。ECB 是最原始的工作模式——每块独立加密互不掺和。

独立意味着相同明文块加密出相同密文块，密文里的图案就是明文的图案。ECB 企鹅图就是这么来的。key 直接给了，逐块解密 unpad 就行。

```python
# exp21.py
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

key = bytes.fromhex(ns["key"])
ct = bytes.fromhex(ns["ct"])
print(unpad(AES.new(key, AES.MODE_ECB).decrypt(ct), 16).decode())
```

FLAG：`flag{ecb_l34k5_bl0ck_b0und4ry_{af4dd734}}`

`AES.new(key, 模式) → .decrypt(ct) → unpad(..., 16)` 三步以后每题都写。

## 22 翻转之咒

CBC。每块明文先和前一块密文异或再加密，第一块用 IV 顶上。解密反过来：先 ECB 解出中间值，再异或前一块密文。

链式结构有个经典性质：改密文第 i 块某一位，解密后第 i 块明文报废，但第 i+1 块对应位被精确翻转——`P_{i+1} = D(C_{i+1}) XOR C_i`，C_i 的位翻转原样传给 P_{i+1}。这就是比特翻转攻击，全程不要密钥。

这题要求手写 CBC 解密：

```python
# exp22.py
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

key, iv, ct = bytes.fromhex(ns["key"]), bytes.fromhex(ns["iv"]), bytes.fromhex(ns["ct"])

ecb = AES.new(key, AES.MODE_ECB)
prev, pt = iv, b""
for i in range(0, len(ct), 16):
    blk = ecb.decrypt(ct[i:i+16])                       # 先解
    pt += bytes(a ^ b for a, b in zip(blk, prev))       # 后异或
    prev = ct[i:i+16]
print(unpad(pt, 16).decode())
```

FLAG：`flag{cb1t_fl1p_ch4ng3s_m3ss4g3_{69cbfed8}}`

CBC 只有保密性没有完整性，改一位接收方察觉不了，现实里要配 HMAC 或直接用 GCM。

## 23 填充预言

这版直接给了 key，标准 CBC 解密拿 flag。但延伸知识值得记——Padding Oracle。

PKCS#7 缺几字节补几个"几"。解密端检查填充合不合法，"合法/非法"这一比特就是个预言机。攻击场景：没密钥但能提交密文观察服务端反应。构造伪造块拼在目标密文块前，改伪造块最后一字节从 0 试到 255 直到服务端说"填充合法"——那一刻 `F[15] ^ I[15] == 0x01`，中间值 I[15] 到手。接着构造 `0x02 0x02` 推出 I[14]……逐字节向左吃掉整块，再异或原前块密文得明文。每字节最多 256 次查询，不要密钥。老版 ASP.NET 的 CVE-2010-3332 就是这个。

```python
# exp23.py
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

key, iv, ct = bytes.fromhex(ns["key"]), bytes.fromhex(ns["iv"]), bytes.fromhex(ns["ct"])
print(unpad(AES.new(key, AES.MODE_CBC, iv).decrypt(ct), 16).decode())
```

FLAG：`flag{padd1ng_0r4cl3_cbc_bl0ck_{4d199582}}`

任何能区分两种状态的旁路信号（填充报错、时间差、响应长短）都可能被利用。

## 24 重复的钥匙

CTR 的 nonce 重用。CTR 把分组密码当流密码：密钥流 = E(key, nonce‖计数器)，密文 = 明文 XOR 密钥流。密钥流只由 key、nonce、counter 决定，和明文无关。同一个 nonce 加密两段明文产出的密钥流一模一样，两式相减密钥流消失：

```
ct_known ^ ct_flag = (known ^ ks) ^ (flag ^ ks) = known ^ flag
```

已知 known，先 `ks = known ^ ct_known` 还原密钥流，再 `flag = ct_flag ^ ks`。两步异或。

```python
# exp24.py
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

known = bytes.fromhex(ns["known"])
ct_known = bytes.fromhex(ns["ct_known"])
ct_flag = bytes.fromhex(ns["ct_flag"])

ks = bytes(a ^ b for a, b in zip(known, ct_known))
print(bytes(a ^ b for a, b in zip(ct_flag, ks)).decode())
```

FLAG：`flag{ctr_n0nc3_r3us3_{d996f10a}}`

流密码铁律：密钥流绝不重复。nonce 重用就是密钥流重用，CTR、OFB、RC4 都一样。看到"已知明文 + 对应密文 + 目标密文"三件套，异或三连走起。

## 25 流之断章

OFB。和 CTR 一样当流密码用，但密钥流造法不同：CTR 加密计数器，OFB 加密上一块密钥流——`ks_1 = E(IV)`，`ks_i = E(ks_{i-1})`，一条自反馈链。

```python
# exp25.py
from Crypto.Cipher import AES

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

key, iv, ct = bytes.fromhex(ns["key"]), bytes.fromhex(ns["iv"]), bytes.fromhex(ns["ct"])

ecb = AES.new(key, AES.MODE_ECB)
ks, pt = iv, b""
for i in range(0, len(ct), 16):
    ks = ecb.encrypt(ks)
    pt += bytes(a ^ b for a, b in zip(ct[i:i+16], ks))
print(pt.decode())
```

FLAG：`flag{0fb_sync_l0ss_{f7b9789b}}`

flag 里 sync_loss 是说 OFB 传输出错几字节后必须重新同步。21–25 做完四种模式都手写了一遍，再看库函数的 mode 参数就不是黑盒了。

---

# 五、弱算法与密钥流重用（26–29）

## 26 AES弱密钥的陷阱

key 就是 16 字节全零，简单到离谱。AES 本身没被实用破解过，但密钥一眼可见。最脆弱的从来是密钥选取不是算法。

```python
# exp26.py
from Crypto.Cipher import AES

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

key = bytes.fromhex(ns["key_hex"])
ct = bytes.fromhex(ns["ct_hex"])
print(AES.new(key, AES.MODE_ECB).decrypt(ct))
```

FLAG：`flag{aes_w34k_k3y_z3r0_f1ll_8c2f4a}`

"key + ct 都给了"的题先直接解密，确认不是白送的再考虑上攻击。

## 27 三重锁的中途

2DES 中间相遇。`c = E_{k2}(E_{k1}(m))`，直觉上密钥空间 2^112。MITM 砍回去：枚举 k1 算 `E_{k1}(m)` 存表，枚举 k2 算 `D_{k2}(c)` 查表，命中就是候选密钥对。从 2^112 时间降到 2^57 时间加 2^57 空间——空间换时间，和 14 题 BSGS 一个思想。

这题密钥设计更狠：每把 DES 密钥单字节重复 8 次各只有 256 种，总共 2^16 秒出。

```python
# exp27.py
from Crypto.Cipher import DES

def dk(b):
    return bytes([b]) * 8

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

pt = bytes.fromhex(ns["known_plaintext_hex"])
ct = bytes.fromhex(ns["known_ciphertext_hex"])
ct_flag = bytes.fromhex(ns["ct_flag_hex"])

table = {}
for b in range(256):
    table[DES.new(dk(b), DES.MODE_ECB).encrypt(pt)] = b

for b in range(256):
    mid = DES.new(dk(b), DES.MODE_ECB).decrypt(ct)
    if mid in table:
        k1, k2 = table[mid], b
        break

flag = DES.new(dk(k1), DES.MODE_ECB).decrypt(
       DES.new(dk(k2), DES.MODE_ECB).decrypt(ct_flag))
print(flag)
```

FLAG：`flag{m1tm_m33t_1n_th3_m1ddl3_5f7e2b}`

能上 MITM 的条件：加密能拆成两段独立密钥控制的复合，中间值可比较。2DES 正因此被废弃，3DES 用 EDE 三层才躲过。

## 28 RC4的偏颇

RC4 密钥流重用。死穴和 24 题 CTR 一模一样——同一密钥永远产出同一密钥流。重用时密文异或等于明文异或。

```python
# exp28.py
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

pt_known = bytes.fromhex(ns["known_plaintext_hex"])
ct_known = bytes.fromhex(ns["ct_known_hex"])
ct_flag = bytes.fromhex(ns["ct_flag_hex"])

ks = bytes(a ^ b for a, b in zip(ct_known, pt_known))
print(bytes(a ^ b for a, b in zip(ct_flag, ks)).decode())
```

FLAG：`flag{rc4_k3ystr34m_b1as_4b1d9c}`

flag 里 bias 是 RC4 另一个毛病：输出初始字节有统计偏置，WEP 就是被这个偏置加 IV 重用联手打死的。RC4 已被 RFC 7465 禁用于 TLS。

## 29 复用的密语

OTP 复用。一次一密是唯一被证明无条件安全的方案：密钥和明文等长、完全随机、用一次就扔。三条缺一不可，尤其"只用一次"。复用瞬间 `c1 ^ c2 = m1 ^ m2`，密钥消失，从信息论不可破跌到两段明文互相出卖。历史上苏联外交密电复用密钥本被 VENONA 计划读了个底朝天。

解法和 24、28 一样，注意这题 known_plaintext 是明文原文直接 encode：

```python
# exp29.py
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

known = ns["known_plaintext"].encode()
ct_known = bytes.fromhex(ns["ct_known_hex"])
ct_flag = bytes.fromhex(ns["ct_flag_hex"])

ks = bytes(a ^ b for a, b in zip(ct_known, known))
print(bytes(a ^ b for a, b in zip(ct_flag, ks)).decode())
```

FLAG：`flag{0tp_r3us3_l34k5_x0r_x0r_d6e8a3}`

24、28、29 同一漏洞换三件马甲（CTR、RC4、OTP），模板一字不差。多段密文共用密钥流时可以 crib dragging：猜个常见词在异或结果里滑动找碰撞。

---

# 六、伪随机数攻防（30–33）

## 30 反馈之链

LFSR + Berlekamp-Massey。LFSR 输出满足线性递推，整个序列只由递推式决定——"线性"就是它脆弱的根源。BM 算法只用 2L 个连续比特就能恢复最短递推式，之后想生成多少后续比特都行。

题目给了前 160 比特和用后续密钥流 XOR 的密文。跑 BM 拿递推式，接着生成拼字节 XOR：

```python
# exp30.py
import re

raw = open("chall.txt").read()
seq = [int(b) for b in re.search(r"= ([01]+)", raw).group(1)]
ct = bytes.fromhex(re.search(r"ct_flag_hex = ([0-9a-f]+)", raw).group(1))

def berlekamp_massey(s):
    C, B = [1], [1]
    L, m, b = 0, 1, 1
    for N in range(len(s)):
        d = s[N]
        for i in range(1, L + 1):
            d ^= C[i] & s[N - i]
        if d == 0:
            m += 1
        else:
            T = C[:]
            coef = d * pow(b, -1, 2) % 2
            if len(C) < len(B) + m:
                C += [0] * (len(B) + m - len(C))
            for j in range(len(B)):
                C[j + m] ^= coef & B[j]
            if 2 * L <= N:
                L, B, b, m = N + 1 - L, T, d, 1
            else:
                m += 1
    return L, C

L, C = berlekamp_massey(seq)
print("递推长度 L =", L)

bits = seq[:]
while len(bits) < len(seq) + len(ct) * 8:
    nxt = 0
    for i in range(1, L + 1):
        nxt ^= C[i] & bits[-i]
    bits.append(nxt)

ksbits = bits[len(seq):len(seq) + len(ct) * 8]
ks = bytes(int("".join(map(str, ksbits[i*8:(i+1)*8])), 2) for i in range(len(ct)))
print(bytes(a ^ b for a, b in zip(ct, ks)))
```

FLAG：`flag{lfsr_bm_p0lyn0m1al_r3c0v3r_a3c9d1}`

BM 代码存工具箱，"给序列猜递推"直接套。LFSR 想变安全要引入非线性（A5/1 三个 LFSR 不规则钟控），但线性结构终究会被代数攻击撕开。

## 31 线性之钟

LCG 参数恢复。`X_{n+1} = (a*X_n + c) mod m`，C 语言 rand() 就是这个家族。完全线性，三个连续输出解出全部参数：

```
X2 - X1 ≡ a * (X1 - X0)  (mod m)
a = (X2 - X1) * (X1 - X0)^-1 (mod m)
c = X1 - a*X0 (mod m)
```

拿到 (a, c, m) 从最后一个已知输出继续递推，后面"随机数"全是已知的。本题模数 2^31，实测 (X1-X0) 和 m 互素逆元直接求。

```python
# exp31.py
import re

raw = open("chall.txt").read()
m = int(re.search(r"modulus_m = (\d+)", raw).group(1))
X = [int(x) for x in re.search(r"outputs = (.+)", raw).group(1).split(",")]
M = [int(x) for x in re.search(r"more_outputs = (.+)", raw).group(1).split(",")]
ct = bytes.fromhex(re.search(r"ct_flag_hex = ([0-9a-f]+)", raw).group(1))

a = (X[2] - X[1]) * pow(X[1] - X[0], -1, m) % m
c = (X[1] - a * X[0]) % m

state = M[-1]
ks = b""
for _ in range(len(ct)):
    state = (a * state + c) % m
    ks += bytes([state & 0xff])

print(bytes(x ^ k for x, k in zip(ct, ks)))
```

FLAG：`flag{lcg_p4r4m_r3c0v3r_1in34r_f8b4a2}`

(X1-X0) 和 m 不互素要先约公因子再解。名字带"线性"的生成器（LCG、LFSR、矩阵法）都默认可被代数攻击，抽样模拟没问题，密钥生成等于裸奔。

## 32 梅森的低语

MT19937 状态恢复。Python random 基于它，内部状态 624 个 32 位整数，每个输出前做一次 tempering——四层移位和掩码 XOR。tempering 每一层可逆，逆着变换回去（untemper）就还原状态字。攒齐 624 个等于完整克隆生成器。

untemper 每层要逐位迭代还原（右移 XOR 的逆不能一步做出来）：

```python
# exp32.py
import re, random, struct

raw = open("chall.txt").read()
rand32 = eval(re.search(r"rand32 = (\[.*?\])", raw, re.S).group(1))
next_output = float(re.search(r"next_output = ([\d.]+)", raw).group(1))
ct = bytes.fromhex(re.search(r"ct_flag_hex = ([0-9a-f]+)", raw).group(1))

def unshift_right(y, shift):
    x = y
    for _ in range(32 // shift + 1):
        x = y ^ (x >> shift)
    return x

def unshift_left(y, shift, mask):
    x = y
    for _ in range(32 // shift + 1):
        x = y ^ ((x << shift) & mask)
    return x & 0xffffffff

def untemper(y):
    y = unshift_right(y, 18)
    y = unshift_left(y, 15, 0xefc60000)
    y = unshift_left(y, 7, 0x9d2c5680)
    y = unshift_right(y, 11)
    return y

mt = [untemper(x) for x in rand32[:624]]
r = random.Random()
r.setstate((3, tuple(mt + [624]), None))

assert r.random() == next_output          # next_output 是 float，用 random() 消耗对齐
ks = b"".join(struct.pack(">d", r.random()) for _ in range((len(ct) + 7) // 8))[:len(ct)]
print(bytes(x ^ k for x, k in zip(ct, ks)))
```

FLAG：`flag{mt19937_st4t3_r3c0v3r_0f_624_c9d7e5}`

624 这个数背下来。setstate 格式 `(3, tuple(624个状态字+[624]), None)`。这题出题脚本用 `random()` 输出 double（每个 8 字节 IEEE-754 大端）当密钥流，next_output 本身就是 float——random() 内部占 53 个随机位（约 2 个字）。解出来对不上先检查出题脚本是 getrandbits 还是 random()，消耗方式和取字节方式都要跟着来。

## 33 预言之舌

和 32 同源：给 624 个 getrandbits(32) 历史输出，密钥流由后续随机数生成。untemper 克隆状态后按出题脚本同款方式取字节：

```python
# exp33.py
import re, random

raw = open("chall.txt").read()
prev = eval(re.search(r"prev_randbits32 = (\[.*?\])", raw, re.S).group(1))
ct = bytes.fromhex(re.search(r"ct_flag_hex = ([0-9a-f]+)", raw).group(1))

def unshift_right(y, shift):
    x = y
    for _ in range(32 // shift + 1):
        x = y ^ (x >> shift)
    return x

def unshift_left(y, shift, mask):
    x = y
    for _ in range(32 // shift + 1):
        x = y ^ ((x << shift) & mask)
    return x & 0xffffffff

def untemper(y):
    y = unshift_right(y, 18)
    y = unshift_left(y, 15, 0xefc60000)
    y = unshift_left(y, 7, 0x9d2c5680)
    y = unshift_right(y, 11)
    return y

mt = [untemper(x) for x in prev[:624]]
r = random.Random()
r.setstate((3, tuple(mt + [624]), None))

ks = b"".join(r.getrandbits(32).to_bytes(4, "big") for _ in range((len(ct) + 3) // 4))[:len(ct)]
print(bytes(x ^ k for x, k in zip(ct, ks)))
```

FLAG：`flag{py_r4nd0m_br34k_unt3mp3r_3f6a8b}`

30 到 33 做完一个感觉：伪随机数的"随机"只对不知道内部状态的人生效。安全场景一律 `secrets` 或 `os.urandom`。

---

# 七、RSA：从分解到代数结构（34–40）

从这章开始套路高度统一：n 能分解就分解，分解出 p、q 后永远那三步——`phi = (p-1)(q-1)`，`d = pow(e, -1, phi)`，明文 `pow(c, d, n)`。每题真正的新东西只是"怎么把 n 拆开"或"不拆 n 怎么把 m 要回来"。先备好：

```python
from Crypto.Util.number import long_to_bytes, inverse
```

## 34 试除之刃

n 只有 10 位数（约 30 bit），sympy factorint 眨眼出结果。密文逐字节加密成整数列表，解出来 long_to_bytes 拼接。

```python
# exp34.py
import sympy
from Crypto.Util.number import inverse, long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e = int(ns["n"]), int(ns["e"])
ct = [int(x) for x in ns["ct_bytes"].split(",")]

p, q = sympy.factorint(n).keys()
d = inverse(e, (p - 1) * (q - 1))
print(b"".join(long_to_bytes(pow(c, d, n)) for c in ct))
```

FLAG：`flag{rsa_tr14l_d1v1s10n_sm411_n_7c3f1a}`

RSA 全押在 n 难分解上，n 一小整座大厦塌。真实密钥至少 2048 位。

## 35 费马的近邻

11 题讲过原理：p、q 接近时 `n = a² - b²`，从 ⌈√n⌉ 向上试 a 直到 `a²-n` 是完全平方。这次 n 160 位，费马法几步就中。

```python
# exp35.py
import math
from Crypto.Util.number import inverse, long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e, c = int(ns["n"]), int(ns["e"]), int(ns["c"])

a = math.isqrt(n)
if a * a < n:
    a += 1
while True:
    b2 = a * a - n
    b = math.isqrt(b2)
    if b * b == b2:
        break
    a += 1
p, q = a - b, a + b

d = inverse(e, (p - 1) * (q - 1))
print(long_to_bytes(pow(c, d, n)))
```

FLAG：`flag{rsa_f3rm4t_cl0s3_pr1m3s_4e8b2d}`

拿到 RSA 题先用费马试十几步，成本极低，命中了白捡。

## 36 p减一的巧取

Pollard p-1。p-1 是光滑数（所有质因子都很小）时能挖出来。算 `a = 2^(B!) mod n`，B! 里包含 p-1 所有质因子，所以 `2^(B!) ≡ 1 (mod p)`，于是 `gcd(a-1, n)` 把 p 分离出来——q-1 不光滑时 gcd 只会掉出 p。

不用真算 B!，按 i=2,3,4,... 逐次自乘 i 再取模，每隔一段 gcd 检查一次。

```python
# exp36.py
from math import gcd
from Crypto.Util.number import inverse, long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e = int(ns["n"]), int(ns["e"])
ct = [int(x) for x in ns["ct_bytes"].split(",")]

def pollard_pm1(n, B=100000):
    a = 2
    for i in range(2, B + 1):
        a = pow(a, i, n)
        if i % 1000 == 0:
            g = gcd(a - 1, n)
            if 1 < g < n:
                return g
    return None

p = pollard_pm1(n)
q = n // p
d = inverse(e, (p - 1) * (q - 1))
print(b"".join(long_to_bytes(pow(c, d, n)) for c in ct))
```

FLAG：`flag{rsa_p0ll4rd_pm1_sm00th_a1c7e3}`

B 从小往大试，太大会慢，且 a-1 ≡ 0 (mod n) 时反而失败。

## 37 随机漫步的rho

Pollard rho。不依赖任何特殊结构，通用分解。用伪随机序列 `x_{i+1} = x_i² + c (mod n)` 在模 p 下走，生日悖论约 n^(1/4) 步内碰撞，Floyd 判环（一个走一步一个走两步）找 `gcd(|x-y|, n)` 得因子。

```python
# exp37.py
from math import gcd
from Crypto.Util.number import inverse, long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e = int(ns["n"]), int(ns["e"])
ct = [int(x) for x in ns["ct_bytes"].split(",")]

def pollard_rho(n):
    if n % 2 == 0:
        return 2
    x = y = 2
    c = 1
    d = 1
    while d == 1:
        x = (x * x + c) % n
        y = (y * y + c) % n
        y = (y * y + c) % n
        d = gcd(abs(x - y), n)
        if d == n:
            x = y = 2
            c += 1
            d = 1
    return d

p = pollard_rho(n)
q = n // p
d = inverse(e, (p - 1) * (q - 1))
print(b"".join(long_to_bytes(pow(c, d, n)) for c in ct))
```

FLAG：`flag{rsa_p0ll4rd_rh0_m1ddl3_s1z3_9d5b2f}`

分解工具箱按规模选：试除（<2^40）→ 费马（p、q 接近）→ p-1（光滑）→ rho（64 位左右通用）→ ECM/GNFS（更大）。实战先上 sympy.factorint 或 yafu，不行再手写。

## 38 共模的裂痕

共模攻击。同一明文用同一个 n、两个互素指数 e1、e2 加密发给两处。egcd 找到 `s*e1 + t*e2 = 1`（08 题的 egcd 在这里兑现），于是：

```
c1^s * c2^t ≡ m^(s*e1 + t*e2) = m  (mod n)
```

不用分解 n 不用私钥，代数上直接把明文配平出来。s、t 一负一正很正常，负指数用模逆元处理。

```python
# exp38.py
import sympy
from Crypto.Util.number import long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e1, e2 = int(ns["n"]), int(ns["e1"]), int(ns["e2"])
c1, c2 = int(ns["c1"]), int(ns["c2"])

s, t, g = sympy.gcdex(int(e1), int(e2))
s, t = int(s), int(t)

m = pow(c1, s, n) if s >= 0 else pow(pow(c1, -1, n), -s, n)
m = m * (pow(c2, t, n) if t >= 0 else pow(pow(c2, -1, n), -t, n)) % n

print(long_to_bytes(m))
```

FLAG：`flag{rsa_c0mm0n_m0dulu5_4tt4ck_b2f6c4}`

每个用户必须有独立模数，共享 n 是协议设计大忌。

## 39 三处广播

Håstad 广播攻击。同一明文（无填充）e=3 发给三个不同模数。三组密文 CRT 合并成一个数 x，`m³` 小于三模数之积，x 就是 m³ 的真值——直接开整数立方根。

```python
# exp39.py
import sympy
from Crypto.Util.number import long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n1, n2, n3 = int(ns["n1"]), int(ns["n2"]), int(ns["n3"])
c1, c2, c3 = int(ns["c1"]), int(ns["c2"]), int(ns["c3"])

def crt(rs, ms):
    M = 1
    for m in ms:
        M *= m
    x = 0
    for r, m in zip(rs, ms):
        x += r * (M // m) * pow(M // m, -1, m)
    return x % M

x = crt([c1, c2, c3], [n1, n2, n3])
m = sympy.integer_nthroot(x, 3)[0]
print(long_to_bytes(m))
```

FLAG：`flag{rsa_broadc4st_1o3_3xp0n3nt_7d4a8c}`

k 个接收者时需要 `m^e < n1*...*nk`。防御就是 OAEP 填充。

## 40 同态的欺骗

RSA 乘法同态：`E(m1) * E(m2) = E(m1*m2) mod n`。教科书 RSA 无填充时这是个可利用的代数结构。这题 n 只有 128 位直接分解，FLAG 分三段加密逐段解密拼接。

```python
# exp40.py
import sympy
from Crypto.Util.number import inverse

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e = int(ns["n"]), int(ns["e"])
chunks = eval(ns["ct_chunks"])

p, q = sympy.factorint(n).keys()
d = inverse(e, (p - 1) * (q - 1))
flag = b"".join(pow(c, d, n).to_bytes(15, "big").lstrip(b"\x00") for c in chunks)
print(flag)
```

FLAG：`flag{rsa_mult1pl1c4t1v3_h0m0m0rp4_b9c3e7}`

34–40 教科书弱点基本集齐：小 n、近素数、光滑 p-1、共模、低指数广播、无填充同态。现实 RSA 还能用靠的是 OAEP、大模数、独立参数。

---

# 八、RSA 进阶（43–49）

这章 n 拆不掉没关系，出题人留了别的门。工具备好：

```python
from Crypto.Util.number import inverse, long_to_bytes
from math import gcd
```

## 43 密钥的暗门

题面说 p 和 q 之间藏着线性关系，仔细读发现 `q = 3p + 2`。条件一出分解降级成解方程：

```
n = p * q = p * (3p + 2) = 3p² + 2p
```

一元二次方程，判别式 `Δ = 4 + 12n` 必须是完全平方数（出题人埋的验证条件）。开出来 `p = (-2 + √Δ) / 6`，n 一千位也瞬间瓦解。

```python
# exp43.py
import math
from Crypto.Util.number import inverse, long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e, c = int(ns["n"]), int(ns["e"]), int(ns["c"])

s = math.isqrt(4 + 12 * n)
assert s * s == 4 + 12 * n
p = (-2 + s) // 6
q = n // p

d = inverse(e, (p - 1) * (q - 1))
print(long_to_bytes(pow(c, d, n)))
```

FLAG：`flag{rsa_b4ckd00r_l1n34r_h1dd3n_6f9a2c}`

RSA 题先读题面，任何"p 与 q 的关系"提示（线性、接近、相等、差为偶数）都是出题人递出来的钥匙。

## 44 连分数的逼近

Wiener 攻击。d 太小（`d < n^0.25 / 3`）时，连分数把 e/n 逼近成 k/d。e/n 的连分数渐进分数序列里必然藏着一项 k/d，逐个验证揪出 d。

```python
# exp44.py
import math
from Crypto.Util.number import inverse, long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e, c = int(ns["n"]), int(ns["e"]), int(ns["c"])

cf = []
a, b = e, n
while b:
    cf.append(a // b)
    a, b = b, a % b

p0, q0 = 1, 0
p1, q1 = cf[0], 1
for a in cf[1:]:
    p0, q0, p1, q1 = p1, q1, a * p1 + p0, a * q1 + q0
    k, d = p1, q1
    if k == 0:
        continue
    if (e * d - 1) % k:
        continue
    phi = (e * d - 1) // k
    s = n - phi + 1
    t = math.isqrt(s * s - 4 * n)
    if t * t == s * s - 4 * n:
        p = (s + t) // 2
        q = (s - t) // 2
        if p * q == n:
            print(long_to_bytes(pow(c, d, n)))
            break
```

FLAG：`flag{w13n3r_l0w_d_c0nt1nu3d_frac_8d1b4e}`

拿到 RSA 题先看 d 有没有给、e 是不是巨大。e 接近 n 而 n 不太大时多半在诱你做 Wiener。

## 45 小根的秘密

`c = m^e mod n`。明文 m 非常小、`m^e` 根本不超过 n 时，取模是多余的，c 就是 m^e 的真值。直接开 e 次根，不用分解 n 不用私钥。特征：c 的长度明显短于 n 一大截。

```python
# exp45.py
import sympy
from Crypto.Util.number import long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e, c = int(ns["n"]), int(ns["e"]), int(ns["c"])

m = sympy.integer_nthroot(c, e)[0]
print(long_to_bytes(m))
```

FLAG：`flag{sm411_3_m3ss4ge_cub3_r00t_4c19d7}`

开根必须用整数版 `integer_nthroot`，浮点 `c ** (1/e)` 精度不够大数会错。

## 46 私钥的残片

给了 p 的高位（hex 字符串），只缺低 16 位。低位枚举 2^16=65536 种逐个拼起来试整除 n，整除的就是 p。

```python
# exp46.py
from Crypto.Util.number import inverse, long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e, c = int(ns["n"]), int(ns["e"]), int(ns["c"])
p_high_hex = ns["p_high_hex"]

lead = int(p_high_hex, 16)
for lo in range(65536):
    cand = (lead << 16) + lo
    if n % cand == 0:
        p = cand
        break

q = n // p
d = inverse(e, (p - 1) * (q - 1))
print(long_to_bytes(pow(c, d, n)))
```

FLAG：`flag{p4rt14l_k3y_l34k_h1gh_b1ts_1f4a63}`

知道高位能枚举低位，知道低位当然也能枚举高位。中间缺一段就要上 Coppersmith 格攻击了。

## 47 故障的讯息

RSA-CRT 故障注入。CRT 加速时签名分别算 `S_p = m^dp mod p` 和 `S_q = m^dq mod q` 再合并。某一半出故障，错误签名 S' 和正确签名 S 在 mod p 下一致、mod q 下不一致。`gcd(S - S', n)` 直接把出错的素因子分离出来。chall.txt 同时给了 s_correct 和 s_faulty。

```python
# exp47.py
from math import gcd
from Crypto.Util.number import inverse, long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k.strip()] = v.strip()      # 有些行 = 前有多个空格，再 strip

n, e, c = int(ns["n"]), int(ns["e"]), int(ns["c"])
s_ok = int(ns["s_correct"])
s_bad = int(ns["s_faulty"])

p = gcd(s_ok - s_bad, n)
q = n // p

d = inverse(e, (p - 1) * (q - 1))
print(long_to_bytes(pow(c, d, n)))
```

FLAG：`flag{rsa_crt_fault_1nj3ct10n_p_4e2b8c}`

这在真实世界真发生过——Chrome 的 RSA 签名就有类似漏洞。防御是签名后校验 `S^e ≡ m`，不通过就拒绝输出。

## 48 重复的随机数

共享素数。两个模数 n1、n2 看着都大，但生成脚本偷懒用了同一个随机数源，导致共享一个素因子。`gcd(n1, n2)` 一步抠出来。

```python
# exp48.py
from math import gcd
from Crypto.Util.number import inverse, long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n1, n2, e = int(ns["n1"]), int(ns["n2"]), int(ns["e"])
c = int(ns["c"])

p = gcd(n1, n2)
q = n1 // p

d = inverse(e, (p - 1) * (q - 1))
print(long_to_bytes(pow(c, d, n1)))
```

FLAG：`flag{sh4r3d_pr1m3_gcd_n1_n2_d4f9a7}`

给了两个以上 RSA 模数第一件事永远互相 gcd 一轮。历史上 Debian 弱熵事件让海量公钥共享素数，真实世界被批量破过。

## 49 有偏的随机数

素数生成被限制在极小窗口：`p = base + x`，x 只有 32768 种可能。随机性名存实亡。枚举 x 试整除就行。

```python
# exp49.py
from Crypto.Util.number import inverse, long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e, c = int(ns["n"]), int(ns["e"]), int(ns["c"])
base = int(ns["base"])
window = int(ns["window"])

for x in range(window):
    if n % (base + x) == 0:
        p = base + x
        break

q = n // p
d = inverse(e, (p - 1) * (q - 1))
print(long_to_bytes(pow(c, d, n)))
```

FLAG：`flag{b1a5ed_pr1m3_w1nd0w_0f_2_17_c6e4d1}`

flag 里 `0f_2_17` 指生成器用了 `getPrime(2)` 之类的小参数。随机数熵一旦被压缩 RSA 就等于明文。

---

# 九、椭圆曲线与实现层攻击（50–55）

椭圆曲线题公共工具先立好：点加法、倍点、标量乘法、BSGS。曲线参数从 chall.txt 读（p、a、b、生成元 P、目标点 Q = d*P）。50–53 共用：

```python
def ecc_add(p, a, P, Q):
    if P is None:
        return Q
    if Q is None:
        return P
    x1, y1 = P
    x2, y2 = Q
    if x1 == x2 and (y1 + y2) % p == 0:
        return None
    if P == Q:
        lam = (3 * x1 * x1 + a) * pow(2 * y1, -1, p) % p
    else:
        lam = (y2 - y1) * pow((x2 - x1) % p, -1, p) % p
    x3 = (lam * lam - x1 - x2) % p
    y3 = (lam * (x1 - x3) - y1) % p
    return (x3, y3)

def ecc_mul(p, a, k, P):
    R = None
    while k:
        if k & 1:
            R = ecc_add(p, a, R, P)
        P = ecc_add(p, a, P, P)
        k >>= 1
    return R

def bsgs(p, a, G, Q, r):
    m = math.isqrt(r) + 1
    table = {}
    cur = None
    for j in range(m):
        table[cur] = j
        cur = ecc_add(p, a, cur, G)
    mG = ecc_mul(p, a, m, G)
    neg = None if mG is None else (mG[0], (-mG[1]) % p)
    cur = Q
    for i in range(m):
        if cur in table:
            return (i * m + table[cur]) % r
        cur = ecc_add(p, a, cur, neg)
    return None
```

BSGS 思想和 14 题完全一致，只是"加法"从模乘换成了曲线点加法。

## 50 光滑的阶

Pohlig-Hellman。群阶 N 是光滑数，分解后全是小素因子幂。把大问题拆成小问题：对每个素因子幂 q^e，把 P 和 Q 都乘以 N/q^e 投影到阶为 q^e 的子群，BSGS 解出 d mod q^e，CRT 合并成完整 d。

```python
# exp50.py
import math
from Crypto.Util.number import long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v
p = int(ns["p"]); a = int(ns["a"])
P = eval(ns["P"]); Q = eval(ns["Q"])
N = int(ns["group_order"])
facts = eval(ns["order_factorization"])

# --- ecc_add / ecc_mul / bsgs 粘贴上方 ---

def crt(rs, ms):
    M = 1
    for m in ms:
        M *= m
    x = 0
    for r, m in zip(rs, ms):
        x += r * (M // m) * pow(M // m, -1, m)
    return x % M

res, mods = [], []
for q, e in facts.items():
    mod = q ** e
    G = ecc_mul(p, a, N // mod, P)
    H = ecc_mul(p, a, N // mod, Q)
    x = bsgs(p, a, G, H, mod)
    res.append(x)
    mods.append(mod)

d = crt(res, mods)
print("d =", d)
```

FLAG：`flag{poh1ig_he11man_sm00th_o1der_3f8b2a}`

群阶最大素因子小（2^20 内）ECDLP 瞬间可解。ECC 要求 #E 是大素数就是这个原因。

## 51 MOV的桥梁

MOV 攻击。超奇异曲线嵌入度 k 很小（这题 k=2），Weil/Tate 配对把 ECDLP 搬到 F_{p²} 乘法群里。题目的 chall.txt 已把配对算好，直接给了乘法群里的 g、h=g^x，在 F_{p²} 里跑 BSGS。F_{p²} 元素用 (u,v)=u+v*i（i²=-1）表示。

```python
# exp51.py
import math

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v
p = int(ns["p"])
g = eval(ns["g"]); h = eval(ns["h"])
order = int(ns["order(g)"]) if "order(g)" in ns else eval(ns["order_g"])

def f2_mul(A, B):
    a, b = A
    c, d = B
    return ((a * c - b * d) % p, (a * d + b * c) % p)

def f2_pow(A, k):
    R = (1, 0)
    while k:
        if k & 1:
            R = f2_mul(R, A)
        A = f2_mul(A, A)
        k >>= 1
    return R

def bsgs_f2(g, h, r):
    m = math.isqrt(r) + 1
    table = {}
    cur = (1, 0)
    for j in range(m):
        table[cur] = j
        cur = f2_mul(cur, g)
    gm = f2_pow(g, m)
    a0, b0 = gm
    inv = pow((a0 * a0 + b0 * b0) % p, -1, p)
    ginv = (a0 * inv % p, (-b0) * inv % p)
    cur = h
    for i in range(m):
        if cur in table:
            return (i * m + table[cur]) % r
        cur = f2_mul(cur, ginv)
    return None

x = bsgs_f2(g, h, order)
print("x =", x)
```

FLAG：`flag{mov_emb3dd1ng_k2_p41r1ng_5c9d1f}`

曲线选错（超奇异、小嵌入度）把"困难"的 ECDLP 降级成"容易"的 DLP。P-256 这种标准曲线嵌入度大得吓人，MOV 打不动。

## 52 无效的点

无效曲线攻击。点加法公式只用到 a 完全不碰 b，所以 a 一样的两条曲线（y²=x³+2 和 y²=x³+3）加法规则一样。服务端只校验坐标存在不校验点在原曲线上，提交小阶曲线上的点（G1 阶 8191、G2 阶 16381），让服务端做标量乘法，返回的就是 d mod 8191 和 d mod 16381。两个小答案 BSGS 秒解 CRT 合并。

```python
# exp52.py
import math, re

raw = open("chall.txt").read()

def ev(pat):
    return eval(re.search(pat, raw).group(1))

p = int(re.search(r"p = (\d+)", raw).group(1))
G1 = ev(r"G1.*?= \(([-\d, ]+)\)")
R1 = ev(r"R1 = d\*G1 = \(([-\d, ]+)\)")
G2 = ev(r"G2.*?= \(([-\d, ]+)\)")
R2 = ev(r"R2 = d\*G2 = \(([-\d, ]+)\)")
r1, r2 = 8191, 16381

# --- ecc_add / ecc_mul / bsgs 粘贴上方，两条曲线 a 都是 0 ---

d1 = bsgs(p, 0, G1, R1, r1)
d2 = bsgs(p, 0, G2, R2, r2)

M = r1 * r2
d = (d1 * r2 * pow(r2, -1, r1) + d2 * r1 * pow(r1, -1, r2)) % M
print("d =", d)
```

FLAG：`flag{1nval1d_curv3_sm411_subgr0up_1b7d9e}`

协议必须验证传入点确实在既定曲线上，只查"坐标合法"是经典实现漏洞。

## 53 异常之曲线

Smart 攻击。`#E(F_p) = p` 的曲线叫异常曲线，Smart/Semaev 通过 p-adic 提升把曲线群映射成加法群，ECDLP 变普通整除问题多项式时间可解。这题 p=7 极小，直接暴力累加 P 直到等于 Q。

```python
# exp53.py
import math

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v
p = int(ns["p"]); a = int(ns["a"])
P = eval(ns["P"]); Q = eval(ns["Q"])

# --- ecc_add 粘贴上方 ---

cur = None
x = None
for k in range(p):
    if cur == Q:
        x = k
        break
    cur = ecc_add(p, a, cur, P)
print("x =", x)
```

FLAG：`flag{an0ma1us_curv3_sm4rt_p3rl_h0ng_a6e0c1}`

异常曲线配小 p 就是白送。标准曲线生成后必须验证 `#E != p` 且非超奇异。

## 54 差分故障

AES 差分故障分析（DFA）。最后一轮没有 MixColumns，注入到第 9 轮输出的单字节故障经过 ShiftRows 后只污染一个输出字节。手里同时有正确密文和 16 个故障密文（每个位置故障一次），对每个位置枚举最后一轮密钥字节 K，用 S 盒前后关系筛唯一候选：

```
c  = SBOX[x]   ^ K   （正确）
cf = SBOX[x^1] ^ K   （故障）
```

由 `c[j] ^ K` 反查 S 盒得 x，再验证 `SBOX[x^1] == cf[j] ^ K`。单个位置可能 2~4 个候选，凑齐 16 字节后用已知明文 + 密钥调度一致性筛出唯一主密钥。

```python
# exp54.py
import re
from itertools import product
from Crypto.Cipher import AES

SBOX = bytes([
0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16])
SINV = [0] * 256
for i in range(256):
    SINV[SBOX[i]] = i

data = open("chall.txt").read()
pt_hex = data.split("pt_hex = ")[1].split()[0]
c_hex = data.split("c_hex = ")[1].split()[0]
faults_src = data.split("faults = {")[1].split("}")[0]
faults = {}
for m in re.finditer(r"(\d+):\s*([0-9a-f]+)", faults_src):
    faults[int(m.group(1))] = bytes.fromhex(m.group(2))
ct_flag = bytes.fromhex(data.split("ct_flag_hex = ")[1].split()[0])

pt = bytes.fromhex(pt_hex)
c = bytes.fromhex(c_hex)

def out_for_pos(pos):
    r = pos % 4
    col = pos // 4
    return r + 4 * ((col - r) % 4)

cands_pos = []
for pos in range(16):
    cf = faults[pos]
    out = out_for_pos(pos)
    cands = []
    for K in range(256):
        x = SINV[c[out] ^ K]
        if SBOX[x ^ 1] == cf[out] ^ K:
            cands.append(K)
    cands_pos.append((out, cands))

Rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]

def inv_keyschedule(k10):
    words = [None] * 44
    for i in range(4):
        words[40 + i] = list(k10[i*4:i*4+4])
    for i in range(43, 3, -1):
        if i % 4 == 0:
            t = words[i - 1][:]
            t = t[1:] + [t[0]]
            t = [SBOX[b] for b in t]
            t[0] ^= Rcon[i // 4 - 1]
            words[i - 4] = [words[i][j] ^ t[j] for j in range(4)]
        else:
            words[i - 4] = [words[i][j] ^ words[i - 1][j] for j in range(4)]
    return b"".join(bytes(w) for w in words[:4])

found = None
for combo in product(*[cds for _, cds in cands_pos]):
    k10 = bytearray(16)
    for (out, _), K in zip(cands_pos, combo):
        k10[out] = K
    master = inv_keyschedule(bytes(k10))
    if AES.new(master, AES.MODE_ECB).encrypt(pt) == c:
        found = master
        break

assert found is not None, "未找到匹配密钥"
print("主密钥:", found.hex())
print(AES.new(found, AES.MODE_ECB).decrypt(ct_flag))
```

FLAG：`flag{a3s_d1ff_fault_1nj3ct10n_c0nt30nd_9c4e1b}`

DFA 不碰数学弱点，靠物理注入让芯片算错。现代防御是解密后做一致性校验加随机掩码。

## 55 时间的窃听

RSA 时序侧信道。平方-乘模幂按 d 每位分支：位是 1 就多做一次乘法，执行时间变长。每次模幂计时，每位采样 10 次取平均压噪声，平均耗时偏高（约 103）的位是 1，偏低（约 100）的位是 0。逐位拼出 64 位 d。

```python
# exp55.py
import re

raw = open("chall.txt").read()

bits = []
pat = re.compile(r"bit(\d+):\s*(.+)")
rows = [(int(m.group(1)), [float(x) for x in m.group(2).split()])
        for m in pat.finditer(raw)]
rows.sort()

for idx, vals in rows:
    avg = sum(vals) / len(vals)
    bits.append(1 if avg > 101.5 else 0)

d = 0
for b in bits:
    d = (d << 1) | b
print("d =", hex(d))
```

FLAG：`flag{t1m1ng_s1d3_ch4nn3l_k0ch3r_d3f9a2c}`

算法数学上完全正确，秘密却从时间、功耗、电磁波里漏走。Kocher 的时序攻击打穿过 RSA/智能卡。防御就是恒定时间算法加随机盲化。

---

# 收尾

从 01 刷到 55（跳了 41、42），工具链、数论、古典密码、分组密码、伪随机数、RSA、椭圆曲线、侧信道全过了一遍。回头说点具体的。

chall.txt 解析和 hex/bytes 互换看着琐碎，但占了前三题全部内容，后面每道题都要先过这关。"已知明文特征 + 小密钥空间 = 爆破"是最常用的起手式——单字节 XOR、凯撒、频率分析、小窗口枚举，本质都是一个套路。

RSA 那块翻来覆去就是"分解 n 或者绕过分解"：近素数用费马，p-1 光滑用 Pollard p-1，中间大小用 rho，读题面找 p/q 的代数关系，e 太大用 Wiener，明文太小直接开根，高位泄露就枚举低位。拿到题先把 n 的大小、e 的大小、有没有给部分参数扫一遍，方向基本就定了。

伪随机数那四题做完一个感受：LFSR、LCG、MT19937 全是纸老虎，只要拿到足够多的连续输出，内部状态直接被克隆。安全场景别用 random 模块，secrets 或 os.urandom 才对。

ECC 和侧信道是另一个量级的东西。Pohlig-Hellman 就是把大问题用 CRT 拆成小问题；无效曲线攻击的关键观察是加法公式不碰 b；DFA 和时序攻击告诉你算法再安全，实现和物理层照样漏。

这套题做下来最大的收获是条件反射：看到密文先想"数据长什么样、有没有泄露部分、算法有没有弱点"。三个问题答完，大半题目方向就有了，剩下就是写 exp 的事。
