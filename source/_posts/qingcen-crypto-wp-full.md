---
title: 青岑密码学题集 WP
date: 2026-09-21 17:30:00
categories: [CTF]
tags: [CTF, 密码学, WP]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg51.jpg
---


## 开始之前，几个绕不开的概念

后面 53 道题反复用到这些东西，先花五分钟过一遍，能省掉大量卡壳。

**模运算**。`a mod m` 就是 a 除以 m 的余数，`a ≡ b (mod m)` 表示两者余数相同。密码学里加、减、乘都照常算，算完取余，世界只有 0 到 m-1 这么大。

**模逆元**。模世界里没有除法，但有它的替代品：`3 * x ≡ 1 (mod 7)` 的解是 x=5，5 就叫 3 模 7 的逆元。逆元存在要求 `gcd(a, m) = 1`。Python 3.8+ 一行搞定：`pow(3, -1, 7)`。

**字节、十六进制、ASCII**。文本在内存里就是字节串。每个英文字符有编号（`'A'` 是 65），`ord`/`chr` 负责编号和字符互转。十六进制是字节的书写格式，两个 hex 字符一个字节：`bytes.fromhex("4142") == b"AB"`。大整数和字节串互转用 `int.to_bytes` / `int.from_bytes`，pycryptodome 里叫 `long_to_bytes` / `bytes_to_long`。

**异或**。相同为 0 不同为 1，最重要的性质是 `a ^ b ^ b == a`——加密时 XOR 一遍密钥流，解密再 XOR 一遍就回来。

**解析 chall.txt 的套路**。很多题的 chall.txt 前面带中文说明行，整个 `exec` 会炸，逐行提取最稳：

```python
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v
```

后面大量 EXP 用这个模式，不再解释。

工具就一句话：`pip install pycryptodome sympy gmpy2`。05–07 三题用 SageMath 更顺手，但没有也完全能做。

<!-- more -->

---

# 第一部分 入门与工具链（01–08）

## 01 欢迎来到密文大陆

考点：ROT13。

打开 chall.txt 是一段英文字母被打乱的文字。字母还在、顺序变了数字没动，这个特征基本就是移位密码。逐个字符试一下可以发现字母整体后移了 13 位——ROT13。26 个字母移 13 位再移 13 位正好回原位，所以加密解密是同一个操作。

直接构造映射表翻译全文：

```python
# exp01.py
abc = "abcdefghijklmnopqrstuvwxyz"
t = str.maketrans(abc + abc.upper(),
                   abc[13:] + abc[:13] + abc.upper()[13:] + abc.upper()[:13])
ct = open("chall.txt", encoding="utf-8").read()
print(ct.translate(t))
```

FLAG：`flag{h3x_w31c0me_bdf64294}`

`str.maketrans` 加 `translate` 是批量替换字符的标准写法，比手写循环省心。如果移位数未知，把 1 到 25 全试一遍看哪个输出是人话就行。

## 02 巨树的年轮

考点：仿射密码。

这次每个字符不只移位，还先乘了个系数：`c = (a*x + b) mod m`。题目把参数给得很清楚——字符域是可打印 ASCII（32 到 126 共 95 个字符），所以 m=95，字符编号 `x = ord(ch) - 32`，a=29，b=17。

解密就是反着来：`x = (c - b) * a^-1 mod 95`。这里有个前提：a 的逆元得存在，条件是 a 和 m 互素。29 和 95 没有公因子，`pow(29, -1, 95)` 直接用。

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

为什么必须互素？如果 a 和 m 有公因子，不同的明文字符会撞到同一个密文字符，想还原就对不回来了。出题人选参数时必须避开这一点。

## 03 青铜试炼

考点：库函数串烧。

这题没有任何攻击，纯粹考你会不会把三个库按说明书串起来。chall.txt 给了 p、a、s、ct，题面把密钥的锻造过程写得明明白白：先算 a 模 p 的逆元，把"逆元的十进制字符串 + 盐 s"扔进 SHA-256，摘要的十六进制串取前 16 个字符当 AES 密钥，ECB 模式解密。

照着复现就行。容易翻车的都是类型问题：逆元是 int，拼字符串前要 `str()`；哈希输入要 `.encode()`；`hexdigest()` 出来是字符串，取前 16 个字符再 encode 成 bytes 才能当密钥。

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

p, a = int(ns["p"], 16), int(ns["a"], 16)   # 注意这题的数字是十六进制
s = ns["s"]
ct = bytes.fromhex(ns["ct"])

inv = gmpy2.invert(a, p)
key = hashlib.sha256((str(inv) + s).encode()).hexdigest()[:16].encode()
print(unpad(AES.new(key, AES.MODE_ECB).decrypt(ct), 16).decode())
```

FLAG：`flag{lib_1s_y0ur_bl4de_e2788ba8}`

做密码学题八成的报错来自 int、str、bytes 之间转来转去搞错了。写脚本前先把每一步"输入是什么类型、输出是什么类型"想清楚，能少调半天。

## 04 试炼塔第一层

考点：列置换密码。

前面的题都在"改字符"，这题换了个思路：一个字符都不改，只把位置打乱。

列置换的加密过程是：把明文按行填进一个宽度为 key 长度的矩阵，然后按 key 的字母序一列一列读出来。key 是 KEY，三个字母的字典序是 E < K < Y，所以先读 E 对应的第 1 列，再读 K 对应的第 0 列，最后第 2 列。

解密倒着走：按同样的列顺序把密文依次切回各列，再按行拼回去。

```python
# exp04.py
import re

raw = open("chall.txt").read()
key = re.search(r"key\s*=\s*(\w+)", raw).group(1)
ct = raw.split("ct = ", 1)[1].strip()          # 注意 ct 跨了两行，要整段读

order = sorted(range(len(key)), key=lambda i: key[i])   # [1, 0, 2]
ncols = len(key)
nrows = -(-len(ct) // ncols)                   # 行数上取整
padded = ct.ljust(nrows * ncols, "#")          # 补齐

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

两个小坑：一是 chall.txt 里 ct 断成两行，只读第一行会得到莫名其妙的乱序文本，老老实实整段读；二是长度补齐用的 `#` 记得最后去掉。

`sorted(range(n), key=...)` 这个"对下标排序"的写法很常用，建议记住。

## 05 长阶递推

考点：把明文藏进质数指数里。

题目设计了个挺巧的编码：FLAG 第 i 个字节当作第 i 个质数的指数，全部乘起来得到一个大整数 N。也就是说 `N = 2^b1 * 3^b2 * 5^b3 * 7^b4 ...`，b1 是 FLAG 第一个字节的 ASCII 值。

还原靠算术基本定理：每个整数的质因数分解是唯一的。所以分解 N，读出每个质数对应的指数，字节就回来了。N 有四千多位看着吓人，但它的质因数全是很小的质数（大的都在指数上），sympy 的 factorint 秒解，SageMath 里一行 `factor(N)` 同样。

```python
# exp05.py
import re, sys
sys.set_int_max_str_digits(100000)     # Python 3.11 默认限制 4300 位，先放开
from sympy import factorint

lines = open("chall.txt").read().splitlines()
i = next(k for k, l in enumerate(lines) if l.startswith("N = "))
N = int(re.sub(r"\D", "", "".join(lines[i:])))   # N 跨行，把后面的数字全拼起来

fac = factorint(N)
primes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127]
print(bytes(fac[p] for p in primes if p in fac))
```

FLAG：`flag{s4ge_zz_f4ct0r_{41c2c039}}`

三个坑：Python 3.11 起整数转字符串默认最多 4300 位，不放开 `set_int_max_str_digits` 会直接报错；N 是跨行存的，要拼起来；说明文字里也出现过 "N" 这个词，定位要从以 `N = ` 开头的那行开始。

这题算是"大整数不等于安全"的第一课——能不能分解，关键看质因子的结构，其次才是位数。

## 06 异界投影

考点：GF(p) 上的仿射变换。

和 02 题一个模子，只是"模 95"换成了"模素数 p"。加密 `c = (a*t + b) mod p`，解密 `(c - b) * a^-1 mod p`，没什么新东西。这题的意义在于引入 GF(p) 这个记号：模素数 p 的算术世界里加、减、乘、除（除法就是乘逆元）全部畅通，这样的世界叫"域"，记作 GF(p)。SageMath 里写 `GF(p)((x-b)/a)`，那个除号自动就是乘逆元。

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

以后看到 `/` 出现在模运算的语境里，条件反射应该是指 `pow(除数, -1, p)`。

## 07 三角之钥

考点：模 p 的线性方程组。

密文由 `b = A * x (mod p)` 生成，x 的每个分量是一个明文字节。解方程组就行——中学的高斯消元照搬，只有两处要改：除法换成乘逆元，所有加减乘都取模。

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
        # 选第 i 列非零的行当主元（0 没有逆元，必须换行）
        for k in range(i, n):
            if M[k][i] % p:
                M[i], M[k] = M[k], M[i]
                v[i], v[k] = v[k], v[i]
                break
        inv = pow(M[i][i], -1, p)          # 主元归一：除法变乘逆元
        M[i] = [(x * inv) % p for x in M[i]]
        v[i] = (v[i] * inv) % p
        for k in range(n):                 # 消掉其他行的第 i 列
            if k != i and M[k][i]:
                f = M[k][i]
                M[k] = [(M[k][j] - f * M[i][j]) % p for j in range(n)]
                v[k] = (v[k] - f * v[i]) % p
    return v

print(bytes(solve_mod(A, b, p)))
```

FLAG：`flag{s4ge_m4trix_s0lver_{1e674f01}}`

模 p 高斯消元是后面椭圆曲线那几章的基本工具，值得自己独立写一遍。

## 08 古老约定

考点：最大公约数。

每组数据是 `(t*k, t*l)`，且 k、l 互素。gcd 有个很顺手的性质：`gcd(k*a, k*b) = k * gcd(a, b)`。代进去：`gcd(t*k, t*l) = t * gcd(k, l) = t`。所以每对数字求个 gcd，明文字节自己跳出来了。

```python
# exp08.py
import ast, math

pairs = ast.literal_eval(open("chall.txt").read().split("pairs = ")[1].strip())
a, b = pairs
print(bytes(math.gcd(x, y) for x, y in zip(a, b)))
```

FLAG：`flag{ex_gcd_1s_p0w3rful_{aa0139c6}}`

题目名字里提到的扩展欧几里得（egcd）是进阶版：求 gcd 的同时给出一组整数 u、v 满足 `u*a + v*b = gcd(a,b)`。实现背一份，第 38 题共模攻击会直接用：

```python
def egcd(a, b):
    if b == 0:
        return a, 1, 0
    g, x, y = egcd(b, a % b)
    return g, y, x - (a // b) * y
```

读数据用 `ast.literal_eval` 代替 `eval`，它只解析字面量，安全一些。

# 第二部分 数论工具箱（09–14）

## 09 互质之墙

考点：模逆元。

每个密文元素满足 `x = t^-1 (mod p)`，也就是加密时把明文字节替换成了自己的逆元。互逆这件事是对称的——t 的逆元是 x，那 x 的逆元就是 t。对每个密文再求一次逆元就还原了。

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

模逆元是整个现代密码学的"除法"，RSA、Diffie-Hellman、椭圆曲线全建在它上面。`pow(x, -1, p)` 在 x 和 p 不互素时会抛 ValueError，那本身就是个提示信号。

## 10 费马的秘密

考点：费马小定理。

加密公式是 `ci = t^(p-2) mod p`，看着挺唬人，其实就是求逆元。费马小定理说，p 是素数且 t 不是 p 的倍数时，`t^(p-1) ≡ 1 (mod p)`。两边同除一个 t（乘 t 的逆元），得到 `t^(p-2) ≡ t^-1 (mod p)`——"求 p-2 次幂"和"求逆元"是同一件事。

解密就顺理成章：逆元的逆元是自己，对每个 ci 再算一次 `ci^(p-2)`，或者等价地 `pow(ci, -1, p)`。

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

把 `a^(p-2) ≡ a^-1 (mod p)` 记住，素数域的题里出场率极高。下一题会看到它的"加强版"。

## 11 欧拉的馈赠

考点：欧拉定理、费马分解、RSA 的数学骨架。

这题是个迷你 RSA：`c = t^e mod n`，n = p*q，而且 p、q 接近。先把数学理顺。

费马小定理要求模数是素数，欧拉把它推广到任意模数：引入欧拉函数 φ(n)——1 到 n 里与 n 互素的数的个数。对两个不同素数乘起来的 n，`φ(n) = (p-1)(q-1)`。欧拉定理说 `gcd(t,n)=1` 时 `t^φ(n) ≡ 1 (mod n)`。

RSA 的全部魔法就是挑一个 e，使 `e*d ≡ 1 (mod φ(n))`，也就是 `e*d = k*φ(n) + 1`。于是：

```
(t^e)^d = t^(e*d) = t^(k*φ(n)+1) = (t^φ(n))^k * t ≡ 1 * t = t (mod n)
```

加密解密互逆。想算 d 必须先知道 φ(n)，想知道 φ(n) 必须分解 n——这就是 RSA 安全性的全部来源。

分解用费马法：p、q 接近时，`n = ((p+q)/2)^2 - ((p-q)/2)^2 = a^2 - b^2`，其中 a 大约是 √n。从 `⌈√n⌉` 开始一个个试 a，看 `a^2 - n` 是不是完全平方数，是的话 p = a-b，q = a+b。p 和 q 越接近试的次数越少。

```python
# exp11.py
import math

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

n, e, ct = int(ns["n"]), int(ns["e"]), eval(ns["ct"])

# 费马分解
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

"分解 → φ → d → 解密"这条流水线是整个 RSA 章节的地基，后面十几题全是它的变体，区别只在"怎么分解"或者"怎么绕过分解"。另外求平方根一定用 `math.isqrt`，浮点的 `math.sqrt` 在大数上会精度出错。

## 12 余数的密语

考点：中国剩余定理（CRT）。

明文被拼成一个大整数 x，然后分别模三个两两互素的模数，得到三个余数。CRT 回答的问题是：知道 x 在几个不同模世界里的余数，能唯一确定 x 吗？答案是在 `m1*m2*m3` 范围内唯一，而且有显式构造公式：

```
x = ( a1*M1*t1 + a2*M2*t2 + a3*M3*t3 ) mod M
    其中 M = m1*m2*m3，Mi = M/mi，ti = Mi 模 mi 的逆元
```

为什么成立？拿第一项看：`M1*t1 ≡ 1 (mod m1)`，所以这一项模 m1 等于 a1；而另外两项都含因子 M1，模 m1 全是 0。每个方程由"自己那项"满足、被其他项放过，加起来全对。

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

sympy 也有现成的：`int(sympy.crt([m1,m2,m3],[a1,a2,a3])[0])`。CRT 在后面会反复出现——39 题广播攻击、50 题 Pohlig-Hellman 都靠它"合"回结果，值得把公式亲手推一遍。注意模数两两互素是前提，不互素时公式直接失效。

## 13 原根之杖

考点：原根、阶、小范围离散对数。

加密是 `y = g^t mod p`，g 是 p 的原根，t 是明文字节。离散对数（给 y 反推 t）一般被认为是难的，但这题 t 只有 256 种取值——预计算 `g^0` 到 `g^255` 存个字典，拿密文查表，完事。

顺便说说原根为什么重要：元素 g 的"阶"是最小的 k 使 `g^k ≡ 1 (mod p)`。如果 g 的阶恰好是 p-1（把所有非零元素转了一整圈才回到 1），g 就叫原根。原根保证 `g^0..g^(p-2)` 两两不同——每个明文字节都能唯一加密、唯一还原，字典才建得起来。

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

离散对数的安全性完全取决于指数空间大小。空间 256 查表就行，空间 2^256 就得靠算法了——下一题的 BSGS 就是第一个正经理论工具。

## 14 离散之梯

考点：BSGS（大步小步）。

和 13 题同款加密，这题正经用 BSGS 来解。核心想法是把指数劈成两半：`t = i*m + j`，代进 `y = g^t` 移个项：

```
y * (g^-m)^i = g^j
```

左边从 y 出发，每次乘 `g^-m`，最多走 m 步；右边 `g^j` 只有 m 个（j 取 0 到 m-1），先算好存表。两边一定会撞上，撞上时 `t = i*m + j`。时间空间都是 O(√p)，比 O(p) 的暴力强了一个数量级。

```python
# exp14.py
import re

raw = open("chall.txt").read()
p = int(re.search(r"^p = (\d+)$", raw, re.M).group(1))
g = int(re.search(r"^g = (\d+)$", raw, re.M).group(1))
ct = eval(re.search(r"^ct = \[(.*)\]$", raw, re.M).group(0).split(" = ", 1)[1])

m = 16                                        # 本题 t < 256，取 16 就够
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

BSGS 是通用的离散对数算法，任何群都能用。记住 √n 这个量级：40 位的群 BSGS 瞬间出解，256 位的群（2^128 步）依然不可行。椭圆曲线章节（50–52 题）会把它当子工具反复调用。

# 第三部分 古典密码变奏（15–20）

## 15 序的迷宫

考点：栅栏密码。

栅栏密码把明文沿锯齿形写在 k 行上：第 1 个字符放第 0 行，第 2 个放第 1 行，第 3 个又回第 0 行……写完逐行读出。k=2 时等价于：偶数位字符全进第 0 行，奇数位进第 1 行。所以加密结果 = 偶位串 + 奇位串，解密就是把前一半（长度 ⌈n/2⌉）填回偶数位、后一半填回奇数位。

这题有两个实测出来的坑。一是 ct 跨行，要整段读进来。二是明文其实是"说明句子 + FLAG"两段**分别独立加密**后拼在一起的——整段一起解会得到正确的句子配上乱码的 flag，特别迷惑人。解决办法也简单：对每个可能的分段点，把尾部单独做栅栏还原，看到 `flag{` 就是它。

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

整体解出来"半对半乱"的时候，第一反应应该是分段加密。多段拼接是出题人常用的干扰手法，遇到就搜边界。

## 16 异或之镜

考点：单字节 XOR 爆破。

密文由一个单字节密钥逐字节 XOR 得到。XOR 的自逆性（`a ^ b ^ b == a`）保证解密就是再 XOR 一遍，而密钥只有一个字节、256 种可能——全试一遍，哪个结果以 `flag{` 开头哪个就是对的。

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

这题的价值在于建立"已知明文特征 + 小密钥空间 = 爆破"的直觉。flag 格式本身就是校验条件；如果连 `flag{` 前缀都没有，可以给每个候选解打"可打印字符占比"分取最高。

## 17 移位齿轮

考点：希尔密码。

前面 02 题的仿射密码一次处理一个字符（乘常数加常数），希尔密码把它升级成一次处理一组：把两个字符拼成向量，乘一个 2×2 矩阵 K，取模 95。这是"分组密码"最原始的雏形——AES 一次处理 16 字节，精神上就是它的巨型后代。

解密需要 K 的逆矩阵。2×2 的公式是手算友好的：`K^-1 = det(K)^-1 * adj(K)`，其中伴随矩阵就是"主对角互换、副对角变号"。`det(K) = 3*5 - 3*2 = 9`，9 和 95 互素，逆元存在。

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

逆矩阵存在当且仅当行列式与模数互素，和仿射密码里"a 要与 m 互素"是同一个道理的矩阵版。

## 18 编码双面人

考点：ROT47。

ROT13 只动 26 个字母，数字标点原样保留。ROT47 的作用域扩大到全部可打印 ASCII：从 `!`(33) 到 `~`(126) 共 94 个字符，统一后移 47 位。94 正好是 47 的两倍，所以它和 ROT13 一样自逆——再做一遍就还原。

```python
# exp18.py
def rot47(s):
    return "".join(chr(33 + (ord(c) - 33 + 47) % 94)
                   if 33 <= ord(c) <= 126 else c
                   for c in s)

print(rot47(open("chall.txt", encoding="utf-8").read()))
```

FLAG：`flag{r0t47_a5cii_sh1ft_{3b6d9a1f}}`

区分口诀就一句：ROT13 管字母，ROT47 管所有可打印字符。密文里连数字都"乱"了，就该往 ROT47 想。

## 19 凯撒的变奏

考点：维吉尼亚密码。

凯撒只有一个移位量，频率分析一打就穿。维吉尼亚的改进是用一个循环密钥引入多个移位量：第 1 个字符移 K 的量、第 2 个移 E、第 3 个移 Y、第 4 个又回到 K……同一个字母在不同位置被移不同的量，单字母统计失效。

解法没悬念，题目把 key 给了，逐字符减去密钥流就行。注意编号基准还是 32（可打印域），字符和密钥都要先减 32 再做模 95 运算。

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

把"减法密钥流"换成"XOR 密钥流"，维吉尼亚就变成了流密码——这个视角能把古典和现代串起来。如果 key 未知，套路是先猜密钥长度（Kasiski 或重合指数），把密文按位置分组，每组退化成凯撒做频率分析。

## 20 字母的指纹

考点：频率分析。

这题连偏移量都不给了，只说"每个可打印字符偏移了固定位数"。95 个字符的域，偏移量最多 94 种，暴力全试一遍人工挑人话当然行，但更优雅的是频率分析：英文文本里空格、e、t 的出现频率远高于其他字符。统计密文里哪个字符出现最多，它大概率对应原文的空格（编号 32），两个编号一减，偏移量就出来了。

本题算出来偏移是 7，反向减 7：

```python
# exp20.py
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v

ct = ns["ct"]
print("".join(chr((ord(c) - 32 - 7) % 95 + 32) for c in ct))

# 偏移未知时的通用爆破，人工挑可读的：
# for k in range(1, 95):
#     print(k, "".join(chr((ord(c)-32-k) % 95 + 32) for c in ct))
```

FLAG：`flag{frequ3ncy_4n4lys1s_{bccd9e92}}`

频率分析可以越做越精：单字符频率、双字符组合（th、he）、重合指数……古典密码在统计面前全线失守。建议写一个自动打分版（英文字符占比最高的 k 胜出），以后所有凯撒题一键解决。

# 第四部分 分组密码与工作模式（21–25）

## 21 镜中块

考点：AES-ECB。

AES 是现在最主流的分组密码：明文切成 16 字节一块，在密钥控制下做多轮替换、移位、混淆，输出 16 字节密文块。"工作模式"说的是多个块之间怎么串。ECB 是最原始的串法——每块独立加密，互相不掺和。

独立意味着实现简单，也意味着**相同的明文块加密出相同的密文块**。密文里的图案就是明文的图案，著名的"ECB 企鹅图"就是这么来的。本题 key 直接给了，逐块解密 unpad 就行；留意密文里如果有重复块，对应的正是明文里的重复内容。

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

`AES.new(key, 模式)` → `.decrypt(ct)` → `unpad(..., 16)` 这三步以后每题都写，熟到不用想。ECB 只适合单块无结构的数据，长数据请用后面的 CBC/CTR。

## 22 翻转之咒

考点：AES-CBC 的块链结构。

CBC 给 ECB 加了一条链：每块明文先和前一块密文异或，再拿去加密；第一块没有"前一块"，用 IV 顶上。解密反过来：先 ECB 解出中间值，再异或前一块密文。

链式结构有个经典性质：改密文第 i 块的某一位，解密后第 i 块明文报废（变成乱码），但第 i+1 块明文的对应位被**精确翻转**——因为 `P_{i+1} = D(C_{i+1}) XOR C_i`，C_i 的位翻转原样传给 P_{i+1}。这就是比特翻转攻击，全程不需要密钥。

本题要求手工实现 CBC 解密（写完可以和库函数结果对一下）：

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

口诀："解密先解后异或，加密先异或后加密"。另外 CBC 只有保密性没有完整性，改一位接收方察觉不了——所以现实里要配 HMAC 或者直接用 GCM。

## 23 填充预言

考点：CBC 解密 + Padding Oracle 思想。

这个版本的题目直接给了 key，用标准 CBC 流程解密拿 flag。这题真正的含金量在延伸知识：Padding Oracle。

PKCS#7 填充的规则是缺几字节补几个"几"。解密端最后会检查填充合不合法——"合法/非法"这个一比特的信息就是一个预言机（oracle）。攻击场景是：攻击者没有密钥，但能提交任意密文并观察服务端对填充的反应。做法是构造一块伪造块 F 拼在目标密文块前面，改 F 的最后一个字节从 0 试到 255，直到服务端说"填充合法"——那一刻 `F[15] ^ I[15] == 0x01`（I 是目标块的解密中间值），I[15] 就到手了。接着构造倒数第二字节使填充为 `0x02 0x02`，推出 I[14]……逐字节向左吃掉整块，再异或原前块密文得到明文。每字节最多 256 次查询，不需要任何密钥。老版本 ASP.NET 的著名漏洞（CVE-2010-3332）就是这个。

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

"预言机"是个通用思维：任何能区分两种状态的旁路信号（填充报错、时间差、响应长短）都可能被攻击者利用。防御是把错误信息统一化、加密后附带认证。

## 24 重复的钥匙

考点：CTR 模式的 nonce 重用。

CTR 模式把分组密码当流密码用：密钥流块 = E(key, nonce‖计数器)，密文 = 明文 XOR 密钥流。密钥流只由 key、nonce、counter 决定，和明文无关。所以**同一个 nonce 加密两段明文，产出的密钥流一模一样**，两式相减密钥流消失：

```
ct_known ^ ct_flag = (known ^ ks) ^ (flag ^ ks) = known ^ flag
```

已知 known，先 `ks = known ^ ct_known` 还原密钥流，再 `flag = ct_flag ^ ks`。两步异或，结束。

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

流密码的铁律：密钥流绝不重复。nonce 重用就是密钥流重用，管你是 CTR、OFB 还是 RC4。以后看到题目同时给"已知明文 + 对应密文 + 目标密文"，条件反射就是异或三连。

## 25 流之断章

考点：AES-OFB。

OFB 和 CTR 一样是"分组密码当流密码"，区别在密钥流的造法：CTR 加密的是计数器，OFB 加密的是**上一块密钥流**——`ks_1 = E(IV)`，`ks_i = E(ks_{i-1})`，一条自反馈的链。密钥流与明文无关，可以预先整条生成。

手工实现一遍：从 IV 开始迭代加密，攒够等长密钥流，XOR 密文。

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

flag 里的 sync_loss 指的是 OFB 的一个特性：传输中丢几字节，接收方从错位处继续解密会全错，必须重新同步。21 到 25 题做完，ECB/CBC/OFB/CTR 四种模式的手工实现都过了一遍，再看到库函数的 mode 参数就不是黑盒了。

# 第五部分 弱算法与密钥流重用（26–29）

## 26 AES弱密钥的陷阱

考点：弱密钥。

这题简单到离谱：key 就是 16 字节全零。AES 算法本身没有被实用破解过，但这题的密钥一眼可见——最脆弱的环节从来是密钥的选取，不是算法。现实中"密钥随手填"（全零、`123456...`、重复字节、字典词哈希）造成的事故比算法被破多得多。

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

做这类"key + ct 都给了"的题，先老老实实直接解密，确认不是白送的，再考虑上攻击。生产环境里密钥必须来自 `os.urandom` 这类密码学安全的随机源。

## 27 三重锁的中途

考点：2DES 中间相遇。

2DES 的结构是 `c = E_{k2}(E_{k1}(m))`，直觉上密钥空间 2^112。但中间相遇攻击（MITM）把它砍回去：枚举 k1 算出 `E_{k1}(m)` 存表；枚举 k2 算出 `D_{k2}(c)` 查表。一旦命中，说明两个"半程"在中间值上会师，`(k1, k2)` 就是候选密钥对。代价从 2^112 时间降到 2^57 时间加 2^57 空间——空间换时间，和 14 题的 BSGS 是同一个思想。

本题的密钥设计得更狠：每把 DES 密钥都是单字节重复 8 次，各只有 256 种，总共 2^16，秒出。用已知明文对锁定 (k1, k2)，再用它们解 flag。

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

table = {}                                   # 前半程建表
for b in range(256):
    table[DES.new(dk(b), DES.MODE_ECB).encrypt(pt)] = b

for b in range(256):                         # 后半程查表
    mid = DES.new(dk(b), DES.MODE_ECB).decrypt(ct)
    if mid in table:
        k1, k2 = table[mid], b
        break

flag = DES.new(dk(k1), DES.MODE_ECB).decrypt(
       DES.new(dk(k2), DES.MODE_ECB).decrypt(ct_flag))
print(flag)
```

FLAG：`flag{m1tm_m33t_1n_th3_m1ddl3_5f7e2b}`

判断一题能不能上 MITM：加密能拆成"两段独立密钥控制的复合"，且中间值可以比较。2DES 正因此被废弃，3DES 用 EDE 三层结构才躲过这一刀。

## 28 RC4的偏颇

考点：RC4 密钥流重用。

RC4 曾是 WEP 和 SSL 的主力流密码：用密钥打乱一个 256 字节的状态置换 S，之后每输出一字节密钥流就再打乱一次。它的死穴和 24 题 CTR 一模一样——同一密钥永远产出同一密钥流。重用时密文异或等于明文异或，密钥流被消去。

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

flag 里的 bias 指的是 RC4 的另一个毛病：输出初始字节有统计偏置（某些位置出现某些值的概率异常高），WEP 就是被这个偏置 + IV 重用联手打死的。RC4 已被 RFC 7465 禁用于 TLS，现代替代品是 ChaCha20-Poly1305。

## 29 复用的密语

考点：OTP 复用。

一次一密（OTP）是密码学里唯一被证明"无条件安全"的方案：密钥和明文等长、完全随机、用一次就扔。三条缺一不可——尤其"只用一次"。复用的瞬间，`c1 ^ c2 = m1 ^ m2`，密钥消失，安全性从"信息论不可破"直接跌到"两段明文互相出卖"。历史上苏联外交密电复用密钥本，被美军 VENONA 计划读了个底朝天，就是现成的教训。

解法和 24、28 完全一样，注意这题的 known_plaintext 是明文原文，直接 encode 参与异或：

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

24 / 28 / 29 三题是同一个漏洞换的三件马甲（CTR、RC4、OTP），模板一字不差。更进阶的场景是多段密文共用密钥流（比如 WEP），可以用 crib dragging：猜一个常见词，在多段密文异或结果里滑动找碰撞。

# 第六部分 伪随机数攻防（30–33）

## 30 反馈之链

考点：LFSR + Berlekamp-Massey。

LFSR（线性反馈移位寄存器）的输出满足一个线性递推：

```
s[n] = c1*s[n-1] ^ c2*s[n-2] ^ ... ^ cL*s[n-L]
```

整个序列只由这个递推式决定——它是"线性"的，这就是它脆弱的根源。Berlekamp-Massey 算法只用 2L 个连续比特就能恢复产生序列的最短递推式，之后想生成多少后续比特都行。

题目给了 LFSR 输出的前 160 比特和用后续密钥流 XOR 的密文。跑 BM 拿到递推式，接着生成，拼字节，XOR：

```python
# exp30.py
import re

raw = open("chall.txt").read()
seq = [int(b) for b in re.search(r"= ([01]+)", raw).group(1)]
ct = bytes.fromhex(re.search(r"ct_flag_hex = ([0-9a-f]+)", raw).group(1))

def berlekamp_massey(s):
    """返回 (L, C)：最短递推 s[n] = XOR(C[i] & s[n-i])"""
    C, B = [1], [1]
    L, m, b = 0, 1, 1
    for N in range(len(s)):
        d = s[N]
        for i in range(1, L + 1):
            d ^= C[i] & s[N - i]          # 当前偏差
        if d == 0:
            m += 1
        else:
            T = C[:]
            coef = d * pow(b, -1, 2) % 2  # GF(2) 上 b 恒为 1
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
while len(bits) < len(seq) + len(ct) * 8:   # 再往后续生成 len(ct)*8 位
    nxt = 0
    for i in range(1, L + 1):
        nxt ^= C[i] & bits[-i]
    bits.append(nxt)

# 前 160 位是给 BM 分析的 seq，密钥流从第 160 位之后开始取
ksbits = bits[len(seq):len(seq) + len(ct) * 8]
ks = bytes(int("".join(map(str, ksbits[i*8:(i+1)*8])), 2) for i in range(len(ct)))
print(bytes(a ^ b for a, b in zip(ct, ks)))
```

FLAG：`flag{lfsr_bm_p0lyn0m1al_r3c0v3r_a3c9d1}`

BM 算法这段代码值得存进工具箱，"给序列猜递推"的题直接套。LFSR 想变安全需要引入非线性（比如 GSM 的 A5/1 用三个 LFSR 不规则钟控），但历史证明线性结构终究会被代数攻击撕开。

## 31 线性之钟

考点：LCG 参数恢复。

LCG 是最老牌的伪随机数生成器：`X_{n+1} = (a*X_n + c) mod m`。C 语言的 rand() 就是这个家族的。它完全线性，所以三个连续输出就能解出全部参数：

```
X2 - X1 ≡ a * (X1 - X0)  (mod m)
a = (X2 - X1) * (X1 - X0)^-1 (mod m)
c = X1 - a*X0 (mod m)
```

拿到 (a, c, m)，从最后一个已知输出继续递推，后面的"随机数"全是已知的。本题模数 2^31，实测 (X1-X0) 与 m 互素，逆元直接求。

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

如果 (X1-X0) 和 m 不互素，要先约去公因子再解。名字里带"线性"的生成器（LCG、LFSR、矩阵法）都默认可被代数攻击，用于抽样模拟没问题，用于密钥生成等于裸奔。

## 32 梅森的低语

考点：MT19937 状态恢复。

Python 的 random 模块基于 MT19937。它的内部状态是 624 个 32 位整数，每个输出在给出前要做一次 tempering（淬火）——四层移位和掩码 XOR。tempering 的每一层都是可逆的，把输出逆着变换回去（untemper）就还原出真实状态字。攒齐 624 个，等于完整克隆了生成器，之后每个输出都能预测。

untemper 每一层的逆需要逐位迭代还原（右移 XOR 的逆不能一步做出来），标准实现如下，建议整段收藏：

```python
# exp32.py
import re, random, struct

raw = open("chall.txt").read()
rand32 = eval(re.search(r"rand32 = (\[.*?\])", raw, re.S).group(1))
next_output = float(re.search(r"next_output = ([\d.]+)", raw).group(1))
ct = bytes.fromhex(re.search(r"ct_flag_hex = ([0-9a-f]+)", raw).group(1))

def unshift_right(y, shift):
    x = y
    for _ in range(32 // shift + 1):      # 迭代到不动点
        x = y ^ (x >> shift)
    return x

def unshift_left(y, shift, mask):
    x = y
    for _ in range(32 // shift + 1):
        x = y ^ ((x << shift) & mask)
    return x & 0xffffffff

def untemper(y):
    y = unshift_right(y, 18)              # 逆着 tempering 的顺序做
    y = unshift_left(y, 15, 0xefc60000)
    y = unshift_left(y, 7, 0x9d2c5680)
    y = unshift_right(y, 11)
    return y

mt = [untemper(x) for x in rand32[:624]]
r = random.Random()
r.setstate((3, tuple(mt + [624]), None))  # 装载克隆状态

assert r.random() == next_output          # next_output 是 float（占 2 个字），用 random() 消耗对齐
ks = b"".join(struct.pack(">d", r.random()) for _ in range((len(ct) + 7) // 8))[:len(ct)]
print(bytes(x ^ k for x, k in zip(ct, ks)))
```

FLAG：`flag{mt19937_st4t3_r3c0v3r_0f_624_c9d7e5}`

两个要点：**624** 这个数字要背下来（MT19937 状态 = 624×32 bit）；setstate 的格式是 `(3, tuple(624个状态字+[624]), None)`。这题出题脚本用 `random()` 输出 double（每个 8 字节，恰好是 IEEE-754 的大端表示）当密钥流，而且 next_output 本身就是个 float——所以对齐要算准：random() 内部占 53 个随机位（约 2 个字）。如果解出来对不上，先检查出题脚本到底是 getrandbits 还是 random() 生成的密钥流，消耗方式和取字节方式都要跟着它来。

## 33 预言之舌

考点：预测 Python random。

和 32 题同源：给 624 个 getrandbits(32) 的历史输出，密钥流由后续随机数生成。untemper 克隆状态后按出题脚本同款方式取字节即可。

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

# 密钥流 = 后续 getrandbits(32) 按大端拼 4 字节
ks = b"".join(r.getrandbits(32).to_bytes(4, "big") for _ in range((len(ct) + 3) // 4))[:len(ct)]
print(bytes(x ^ k for x, k in zip(ct, ks)))
```

FLAG：`flag{py_r4nd0m_br34k_unt3mp3r_3f6a8b}`

30 到 33 四题一句话说透：伪随机数的"随机"只对不知道内部状态的人生效。LFSR、LCG、MT19937 都能被状态恢复，所以安全场景一律用 `secrets` 模块或 `os.urandom`。

# 第七部分 RSA：从分解到代数结构（34–40）

从这章开始的套路高度统一：n 能分解就分解，分解出 p、q 之后永远都是那三步——`phi = (p-1)(q-1)`，`d = pow(e, -1, phi)`，明文 `pow(c, d, n)`。每题真正的新东西只有"怎么把 n 拆开"或者"怎么不拆 n 也把 m 要回来"。收尾代码里反复出现两个工具，先备好：

```python
from Crypto.Util.number import long_to_bytes, inverse
```

## 34 试除之刃

考点：小 n 试除。

n 只有 10 位数（约 30 bit），sympy 的 factorint 眨眼出结果。密文是逐字节加密的整数列表，解出来用 long_to_bytes 拼接。

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

RSA 的安全性完全押在"n 难分解"上。n 一小，整座大厦直接塌——所以真实密钥至少 2048 位。

## 35 费马的近邻

考点：费马分解。

11 题已经讲过原理：p、q 接近时 `n = a^2 - b^2`，从 ⌈√n⌉ 向上试 a，直到 `a²-n` 是完全平方数。这次 n 有 160 位，费马法依然几步就中。

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

生成 RSA 密钥时 p、q 必须拉开足够距离，这就是原因。顺手记一个方法论：拿到 RSA 题，先用费马试十几步，成本极低，命中了就是白捡。

## 36 p减一的巧取

考点：Pollard p-1。

如果 p-1 是光滑数（所有质因子都很小），Pollard p-1 算法能把它挖出来。原理一/concept一句话：算 `a = 2^(B!) mod n`。B! 里包含了 p-1 的所有质因子，所以 `2^(B!) ≡ 1 (mod p)`（费马小定理），于是 `gcd(a - 1, n)` 就把 p 分离出来——q-1 不光滑时 gcd 只会掉出 p。

实现上不用真的算 B!，按 i = 2,3,4,... 逐次把 a 自乘 i 再取模，每隔一段 gcd 检查一次。

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
        if i % 1000 == 0:            # 定期检查，省时间
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

防御方法：p、q 都取安全素数（p-1 有大质因子）。B 从小往大试是常规操作——太大会变慢，且 a-1 ≡ 0 (mod n) 时反而失败。

## 37 随机漫步的rho

考点：Pollard rho。

p-1 光滑才有效，这题换 Pollard rho——不依赖任何特殊结构，通用分解算法。原理：用伪随机序列 `x_{i+1} = x_i² + c (mod p)` 在模 p 下走，由生日悖论约 n^(1/4) 步内出现碰撞；用 Floyd 判环（一个走一步一个走两步）找到 `gcd(|x-y|, n)` 得到因子。

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
        x = (x * x + c) % n              # 慢指针一步
        y = (y * y + c) % n
        y = (y * y + c) % n              # 快指针两步
        d = gcd(abs(x - y), n)
        if d == n:                       # 这组 (c) 失败，换一个
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

至此分解工具箱齐了，按 n 的规模和结构选：试除（<2^40）→ 费马（p、q 接近）→ p-1（光滑）→ rho（64 位左右通用）→ ECM/GNFS（更大）。实战先上 `sympy.factorint` 或 yafu，不行再手写。

## 38 共模的裂痕

考点：共模攻击。

同一份明文用同一个 n、两个互素的指数 e1、e2 加密发给两处。扩展欧几里得找到 `s*e1 + t*e2 = 1`（08 题的 egcd 在这里兑现），于是：

```
c1^s * c2^t ≡ m^(s*e1 + t*e2) = m^1 = m  (mod n)
```

不需要分解 n，不需要私钥，代数上直接把明文"配平"出来。s、t 一负一正很正常，负指数用模逆元处理。

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

s, t, g = sympy.gcdex(int(e1), int(e2))      # s*e1 + t*e2 = 1
s, t = int(s), int(t)

# 负指数先取逆元
m = pow(pow(c1, 1, n), 1, n)
m = pow(c1, s, n) if s >= 0 else pow(pow(c1, -1, n), -s, n)
m = m * (pow(c2, t, n) if t >= 0 else pow(pow(c2, -1, n), -t, n)) % n

print(long_to_bytes(m))
```

FLAG：`flag{rsa_c0mm0n_m0dulu5_4tt4ck_b2f6c4}`

防御一句话：每个用户必须有自己独立的模数，共享 n 是协议设计的大忌。

## 39 三处广播

考点：Håstad 广播攻击。

同一明文（无填充）用 e=3 发给三个不同模数的接收者。三组密文用 CRT 合并成一个数 x，由于 `m³` 小于三模数之积，x 就是 `m³` 的真值——直接开整数立方根还原 m，全程没有模运算挡路。

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

成立条件：k 个接收者时需要 `m^e < n1*...*nk`。防御就是正经填充（OAEP），让每次加密的 m 都不同且足够大。

## 40 同态的欺骗

考点：RSA 乘法同态。

RSA 有个天然性质：`E(m1) * E(m2) = E(m1*m2) mod n`——密文相乘等于明文相乘。这本是同态加密的种子，但在教科书 RSA（无填充）里是个可利用的代数结构。本题 n 只有 128 位，直接分解，FLAG 分三段加密，逐段解密拼接；题目给的 known_m/known_c 一对可以用来验证同态性质。

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

34–40 一路下来，RSA 的"教科书弱点"基本集齐：小 n、近素数、光滑 p-1、共模、低指数广播、无填充同态。现实中的 RSA 之所以还能用，靠的是 OAEP 填充、大模数、独立参数——这些工程约束一个都不能省。

# 第八部分 RSA 进阶（43–49）

这章的题都是一样的配方：n 拆不掉没关系，出题人留了别的门。先记住两个伴随的 RSA 工具，后面每题都会用到：

```python
from Crypto.Util.number import inverse, long_to_bytes
from math import gcd
```

## 43 密钥的暗门

考点：RSA · 素数间代数关系。

题面说"p 和 q 之间藏着一个线性关系"。仔细读题发现 `q = 3p + 2`。这个条件一出，分解立刻降级成解方程：

```
n = p * q = p * (3p + 2) = 3p² + 2p
```

把 p 当未知数，这是一个一元二次方程。判别式 `Δ = 4 + 12n`，它必须恰好是完全平方数——这本身就是出题人埋的验证条件。开出来之后 `p = (-2 + √Δ) / 6`，n 哪怕一千位也瞬间瓦解。

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
assert s * s == 4 + 12 * n       # 判别式必须为完全平方数
p = (-2 + s) // 6
q = n // p

d = inverse(e, (p - 1) * (q - 1))
print(long_to_bytes(pow(c, d, n)))
```

FLAG：`flag{rsa_b4ckd00r_l1n34r_h1dd3n_6f9a2c}`

做题教训：RSA 题先读题面，任何"p 与 q 的关系"提示（线性、接近、相等、差为偶数……）都是出题人递出来的分解钥匙。

## 44 连分数的逼近

考点：RSA · Wiener 攻击。

当私钥指数 d 太小（`d < n^0.25 / 3`）时，Wiener 攻击用连分数把 e/n 逼近成 k/d。原理：e/n 的连分数渐进分数序列里必然藏着一项 `k/d`（约分后），逐个验证就能把 d 揪出来。

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

cf = []                                   # 连分数展开 e/n
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
        continue                            # 整除失败，不是这一项
    phi = (e * d - 1) // k
    s = n - phi + 1                         # s = p + q
    t = math.isqrt(s * s - 4 * n)
    if t * t == s * s - 4 * n:              # 判别式验证
        p = (s + t) // 2
        q = (s - t) // 2
        if p * q == n:                      # 命中
            print(long_to_bytes(pow(c, d, n)))
            break
```

FLAG：`flag{w13n3r_l0w_d_c0nt1nu3d_frac_8d1b4e}`

做题教训：拿到 RSA 题先看一眼 d 有没有给、e 是不是巨大无比。e 接近 n 而 n 不太大时，多半在诱你做 Wiener。防御也简单：d 取得足够大即可。

## 45 小根的秘密

考点：RSA · 低指数小明文开根。

`c = m^e mod n`。当明文 m 非常小、`m^e` 根本不会超过 n 时，取模是多余的，`c` 就是 `m^e` 的**真值**。于是直接开 e 次根就行，既不需要分解 n 也不需要私钥。这类题的共同特征是：`c` 的长度明显短于 n 一大截。

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

m = sympy.integer_nthroot(c, e)[0]          # 整数开 e 次根
print(long_to_bytes(m))
```

FLAG：`flag{sm411_3_m3ss4ge_cub3_r00t_4c19d7}`

做题教训：开根必须用整数版本（`integer_nthroot`），浮点 `c ** (1/e)` 精度不够，大数会错。防御就是 OAEP 填充——它保证明文经过填充后足够大，`m^e > n` 恒成立。

## 46 私钥的残片

考点：RSA · 素数高位泄露。

题目给了一个 p 的高位（hex 字符串），只缺低 16 位。办法粗暴但有效：低位枚举 2^16 = 65536 种，逐个拼起来试整除 n，整除的那一个就是 p。

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
for lo in range(65536):                     # 枚举缺失的低位
    cand = (lead << 16) + lo
    if n % cand == 0:
        p = cand
        break

q = n // p
d = inverse(e, (p - 1) * (q - 1))
print(long_to_bytes(pow(c, d, n)))
```

FLAG：`flag{p4rt14l_k3y_l34k_h1gh_b1ts_1f4a63}`

做题教训：只知道高位能枚举低位，只知道低位当然也可以枚举高位。更一般的情况（中间缺一段）就要上 Coppersmith 的格攻击了，`sympy`/sage 都有现成封装。

## 47 故障的讯息

考点：RSA-CRT · 故障注入。

RSA 用 CRT 加速时，签名分别算 `S_p = m^dp mod p` 和 `S_q = m^dq mod q` 再合并。如果计算过程中某一半出了错（被注入故障），错误签名 S' 和正确签名 S 之间会留下痕迹：S' 与 S 在 mod p 下一致、在 mod q 下不一致（或反过来）。于是 `gcd(S - S', n)` 直接把出错的素因子分离出来。题目的 chall.txt 同时给了 `s_correct` 和 `s_faulty` 两个签名。

```python
# exp47.py
from math import gcd
from Crypto.Util.number import inverse, long_to_bytes

ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k.strip()] = v.strip()      # 注意：有些行在 = 前有多个空格，需再 strip

n, e, c = int(ns["n"]), int(ns["e"]), int(ns["c"])
s_ok = int(ns["s_correct"])
s_bad = int(ns["s_faulty"])

p = gcd(s_ok - s_bad, n)                    # 一次故障泄露素因子
q = n // p

d = inverse(e, (p - 1) * (q - 1))
print(long_to_bytes(pow(c, d, n)))
```

FLAG：`flag{rsa_crt_fault_1nj3ct10n_p_4e2b8c}`

做题教训：这在真实世界里是真发生过的事——Chrome 的 RSA 签名就有过类似漏洞。防御办法是签名后校验 `S^e ≡ m`，不通过就拒绝输出。

## 48 重复的随机数

考点：RSA · 共享素数。

两个模数 n1、n2 看着都挺大，但它们的生成脚本偷懒用了同一个随机数源，导致它们**共享一个素数因子**。`gcd(n1, n2)` 一步到位把那颗公共素数抠出来。所谓"大数分解很难"的保证，在随机数复用的现实面前薄如纸。

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

p = gcd(n1, n2)                             # 共享素因子
q = n1 // p

d = inverse(e, (p - 1) * (q - 1))
print(long_to_bytes(pow(c, d, n1)))
```

FLAG：`flag{sh4r3d_pr1m3_gcd_n1_n2_d4f9a7}`

做题教训：给了两个以上 RSA 模数，第一件事永远是互相 gcd 一轮。历史上 Debian 的弱熵事件让海量公钥共享素数，真实世界被这样批量破过。

## 49 有偏的随机数

考点：RSA · 伪随机后门。

素数生成被限制在一个极小的窗口：p = base + x，其中 x 只有 32768 种可能。随机性名存实亡，密钥后门天然存在。枚举 x 试整除即可。

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

for x in range(window):                     # 枚举窗口内的偏移
    if n % (base + x) == 0:
        p = base + x
        break

q = n // p
d = inverse(e, (p - 1) * (q - 1))
print(long_to_bytes(pow(c, d, n)))
```

FLAG：`flag{b1a5ed_pr1m3_w1nd0w_0f_2_17_c6e4d1}`

做题教训：flag 里的 `0f_2_17` 指生成器用了 `getPrime(2)` 之类的小参数。随机数生成器的熵一旦被压缩，RSA 就等于明文。防御：用密码学安全的随机源，并做公钥筛查。

# 第九部分 椭圆曲线与实现层攻击（50–55）

椭圆曲线题先立一套公共工具：点的加法、倍点、标量乘法、BSGS。曲线参数从 chall.txt 读（格式：`p`、`a`、`b`、生成元 `P`、目标点 `Q = d*P`）。下面先给出通用函数，50–53 题共用：

```python
def ecc_add(p, a, P, Q):
    """椭圆曲线点加法（含无穷远点 None）"""
    if P is None:
        return Q
    if Q is None:
        return P
    x1, y1 = P
    x2, y2 = Q
    if x1 == x2 and (y1 + y2) % p == 0:
        return None                      # 互为负元 -> 无穷远点
    if P == Q:
        lam = (3 * x1 * x1 + a) * pow(2 * y1, -1, p) % p
    else:
        lam = (y2 - y1) * pow((x2 - x1) % p, -1, p) % p
    x3 = (lam * lam - x1 - x2) % p
    y3 = (lam * (x1 - x3) - y1) % p
    return (x3, y3)

def ecc_mul(p, a, k, P):
    """标量乘法：快速幂式重复倍点"""
    R = None
    while k:
        if k & 1:
            R = ecc_add(p, a, R, P)
        P = ecc_add(p, a, P, P)
        k >>= 1
    return R

def bsgs(p, a, G, Q, r):
    """BSGS 解 Q = d*G，群阶 r"""
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

BSGS 的思想和 14 题完全一致：大步存表、小步查表，时间空间互换。唯一的差别是"加法"从模乘换成了曲线点加法。

## 50 光滑的阶

考点：ECDLP · Pohlig-Hellman。

群阶 N 是光滑数——分解后全是小素因子幂。Pohlig-Hellman 的思路：把大问题拆成小问题。对每个素因子幂 q^e，把生成元 P 和目标点 Q 都乘以 N/q^e，把它们投影到阶为 q^e 的子群里，再用 BSGS 解出 d mod q^e。最后 CRT 把所有子群答案合并成完整的 d。

```python
# exp50.py
import math
from Crypto.Util.number import long_to_bytes

# 从 chall.txt 读取参数
ns = {}
for line in open("chall.txt"):
    if " = " in line:
        k, v = line.strip().split(" = ", 1)
        ns[k] = v
p = int(ns["p"]); a = int(ns["a"])
P = eval(ns["P"]); Q = eval(ns["Q"])
N = int(ns["group_order"])
facts = eval(ns["order_factorization"])

# --- 此处粘贴上方 ecc_add / ecc_mul / bsgs ---

def crt(rs, ms):                     # 中国剩余定理合并
    M = 1
    for m in ms:
        M *= m
    x = 0
    for r, m in zip(rs, ms):
        x += r * (M // m) * pow(M // m, -1, m)
    return x % M

res, mods = [], []
for q, e in facts.items():           # 逐个素因子幂子群
    mod = q ** e
    G = ecc_mul(p, a, N // mod, P)   # 投影：阶恰好整除 mod
    H = ecc_mul(p, a, N // mod, Q)
    x = bsgs(p, a, G, H, mod)
    res.append(x)
    mods.append(mod)

d = crt(res, mods)
print("d =", d)                      # 之后按出题脚本方式用 d 派生密钥解密
```

FLAG：`flag{poh1ig_he11man_sm00th_o1der_3f8b2a}`

做题教训：只要群阶的最大素因子小（比如 2^20 内），ECDLP 就瞬间可解。防御就是在素数阶曲线上做密码学，群阶本身必须是不可分解的大素数。这也解释了为什么 ECC 都要求 #E 是大素数。

## 51 MOV的桥梁

考点：ECDLP · MOV 攻击。

超奇异曲线有个特殊性质：嵌入度 k 很小（这题 k=2）。Weil/Tate 配对能构造双线性映射 `e(P, xP) = e(P,P)^x`，把椭圆曲线上的离散对数问题**搬**到 F_{p²} 乘法群里去。题目的 chall.txt 已经把配对算好，直接给了乘法群里的 `g`、`h = g^x`，剩下就是在 F_{p²} 里跑 BSGS。F_{p²} 的元素用 `(u,v) = u + v*i`（`i² = -1`）表示，加法和乘法都有明确公式。

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

def f2_mul(A, B):                    # F_{p^2} 乘法
    a, b = A
    c, d = B
    return ((a * c - b * d) % p, (a * d + b * c) % p)

def f2_pow(A, k):                    # 幂（平方-乘）
    R = (1, 0)
    while k:
        if k & 1:
            R = f2_mul(R, A)
        A = f2_mul(A, A)
        k >>= 1
    return R

def bsgs_f2(g, h, r):                # F_{p^2} 中的 BSGS
    m = math.isqrt(r) + 1
    table = {}
    cur = (1, 0)
    for j in range(m):
        table[cur] = j
        cur = f2_mul(cur, g)
    gm = f2_pow(g, m)
    a0, b0 = gm                      # 求逆：(u,v)^{-1} = (u,-v)/(u^2+v^2)
    inv = pow((a0 * a0 + b0 * b0) % p, -1, p)
    ginv = (a0 * inv % p, (-b0) * inv % p)
    cur = h
    for i in range(m):
        if cur in table:
            return (i * m + table[cur]) % r
        cur = f2_mul(cur, ginv)
    return None

x = bsgs_f2(g, h, order)
print("x =", x)                      # 与原始曲线上的私钥一致
```

FLAG：`flag{mov_emb3dd1ng_k2_p41r1ng_5c9d1f}`

做题教训：曲线选错（超奇异、小嵌入度）会把"困难"的 ECDLP 降级成"容易"的 DLP。配对带来的归约是双刃剑：一方面支撑起双线性配对密码学，另一方面让坏曲线完全失效。标准曲线（如 P-256）嵌入度大得吓人，MOV 才打不动。

## 52 无效的点

考点：ECDLP · 无效曲线攻击。

注意到点加法公式只用到了系数 a，**完全不碰 b**。所以"在同一台加法公式下"运算的两条曲线 y²=x³+2 和 y²=x³+3 具有相同的加法规则——a 一样就是"同一台机器"。服务端只校验坐标存在、不校验点在原曲线上，于是提交一条小阶曲线上的点（G1 阶 8191、G2 阶 16381），让服务端做标量乘法，返回的就是 `d mod 8191` 和 `d mod 16381`。两个小答案 BSGS 秒解，CRT 合并出完整 d。

```python
# exp52.py
import math, re

raw = open("chall.txt").read()

def ev(pat):
    return eval(re.search(pat, raw).group(1))

p = int(re.search(r"p = (\d+)", raw).group(1))
G1 = ev(r"G1.*?= \(([-\d, ]+)\)")        # 无效曲线 y^2=x^3+3 上的点，阶 8191
R1 = ev(r"R1 = d\*G1 = \(([-\d, ]+)\)")
G2 = ev(r"G2.*?= \(([-\d, ]+)\)")        # 阶 16381
R2 = ev(r"R2 = d\*G2 = \(([-\d, ]+)\)")
r1, r2 = 8191, 16381

# --- 此处粘贴上方 ecc_add / ecc_mul / bsgs ---
# 两条曲线 a 都是 0，共用同一套加法公式

d1 = bsgs(p, 0, G1, R1, r1)          # 在小子群上解 d mod 8191
d2 = bsgs(p, 0, G2, R2, r2)          # 解 d mod 16381

M = r1 * r2
d = (d1 * r2 * pow(r2, -1, r1) + d2 * r1 * pow(r1, -1, r2)) % M
print("d =", d)
```

FLAG：`flag{1nval1d_curv3_sm411_subgr0up_1b7d9e}`

做题教训：签名/密钥交换协议必须验证传入点确实在既定曲线上（且非无穷远、阶正确）。只查"坐标合法"是最经典的实现漏洞之一。

## 53 异常之曲线

考点：ECDLP · Smart 攻击。

`#E(F_p) = p` 的曲线叫异常曲线（anomalous）。这时 Smart / Semaev 攻击通过 p-adic 提升把曲线群映射成加法群，ECDLP 变成普通整除问题，多项式时间可解。这题 p=7 极小，直接暴力累加 P 直到等于 Q 就行——最朴素的解法恰好诠释了"把 Q 看成 d 个 P"。

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

# --- 此处粘贴上方 ecc_add ---

cur = None
x = None
for k in range(p):                   # p 很小，暴力
    if cur == Q:
        x = k
        break
    cur = ecc_add(p, a, cur, P)
print("x =", x)
```

FLAG：`flag{an0ma1us_curv3_sm4rt_p3rl_h0ng_a6e0c1}`

做题教训：异常曲线再配上小 p 就是白送。标准曲线生成后必须验证 `#E != p` 且为非超奇异。Smart 攻击本身是椭圆曲线密码学里程碑式的格/进数应用，原理展开会用到 p-adic 对数，入门阶段记住结论即可。

## 54 差分故障

考点：AES · 差分故障分析（DFA）。

AES 的最后一轮没有 MixColumns，所以注入到第 9 轮输出（最后一轮 SubBytes 前）的单字节故障，经过 ShiftRows 后只污染**一个输出字节**。手里同时有正确密文和 16 个故障密文（每个位置故障一次），对每个位置枚举最后一轮密钥字节 K，用 S 盒前后关系筛出唯一候选：

```
c  = SBOX[x]    ^ K     （正确）
cf = SBOX[x^1]  ^ K     （故障）
```

由 `c[j] ^ K` 反查 S 盒得到 x，再验证 `SBOX[x^1] == cf[j] ^ K`。单个位置可能有 2~4 个候选，凑齐 16 字节后用已知明文 + 密钥调度一致性筛出唯一主密钥。之后逆推密钥调度（10 轮）或直接用筛出的主密钥 AES 解密目标密文。

```python
# exp54.py
import re
from itertools import product
from Crypto.Cipher import AES

# 标准 AES S 盒（256 字节）——建议收藏完整表
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
    # 状态数组列优先：索引 i -> (r = i%4, 列 = i//4)；ShiftRows 后列变为 (列 - r) % 4
    r = pos % 4
    col = pos // 4
    return r + 4 * ((col - r) % 4)

cands_pos = []
for pos in range(16):
    cf = faults[pos]
    out = out_for_pos(pos)
    cands = []
    for K in range(256):
        x = SINV[c[out] ^ K]               # 反 S 盒拿故障前字节
        if SBOX[x ^ 1] == cf[out] ^ K:     # 用故障关系筛 K
            cands.append(K)
    cands_pos.append((out, cands))

Rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]

def inv_keyschedule(k10):
    """由最后一轮密钥逆推主密钥"""
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
    if AES.new(master, AES.MODE_ECB).encrypt(pt) == c:   # 已知明文验证
        found = master
        break

assert found is not None, "未找到匹配密钥"
print("主密钥:", found.hex())
print(AES.new(found, AES.MODE_ECB).decrypt(ct_flag))
```

FLAG：`flag{a3s_d1ff_fault_1nj3ct10n_c0nt30nd_9c4e1b}`

做题教训：DFA 属于实现攻击——不碰数学弱点，靠物理注入让芯片算错。现代防御是在解密后做一致性校验（密文验证），以及用随机掩码打乱中间值。智能卡、TLS 里的 RSA/AES 加速都曾被这类攻击伤过。

## 55 时间的窃听

考点：RSA · 时序侧信道。

平方-乘模幂算法按 d 的每一位分支：位是 1 就多做一次乘法，执行时间悄悄变长。把每次模幂计时，每位采样 10 次取平均压掉噪声，平均耗时明显偏高（这题约 103）的位就是 1，偏低（约 100）的位就是 0。逐位拼出 64 位 d，之后按出题脚本方式用 d 派生密钥解密。

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
    bits.append(1 if avg > 101.5 else 0)   # 100 与 103 两簇，取中值分类

d = 0
for b in bits:
    d = (d << 1) | b
print("d =", hex(d))                       # 之后按出题脚本方式用 d 派生密钥解密
```

FLAG：`flag{t1m1ng_s1d3_ch4nn3l_k0ch3r_d3f9a2c}`

做题教训：侧信道泄漏的可怕之处在于算法数学上完全正确，秘密却从时间、功耗、电磁波里漏走。Kocher 的时序攻击打穿了当年的 RSA/智能卡。防御：恒定时间算法（位无关的分支结构）+ 随机盲化（乘随机数再除掉）。

---

# 收尾

从 01 到 55（跳过 41、42），一路刷过来：工具链、数论、古典密码、分组密码、弱算法、伪随机数、RSA 全家桶、椭圆曲线、实现层攻击。回头复盘一下，其实题目翻来覆去就那几条路。

前面几题全在搞格式和解析——chall.txt 逐行抠、hex 和 bytes 来回转，这些看着不起眼，但后面所有题都建立在这上面。再往后就是"已知明文/已知结构 + 枚举"这一套，单字节 XOR、凯撒、频率分析、小窗口爆破，本质上是一回事。

RSA 那块套路最固定：n 能拆就拆，拆出 p、q 之后永远是 phi、d、pow 三步，每题真正新的东西只是"怎么把 n 拆开"或者"不拆 n 怎么把 m 要回来"。伪随机数那几题也是一句话——所谓的随机只对不知道内部状态的人有效，LFSR、LCG、MT19937 状态全能恢复，密钥流重用和 IV 重用就是送 flag。最后几题的 ECC 和实现层攻击（填充预言、无效曲线、DFA、时序侧信道）则提醒你：算法数学上再安全，用错了照样被打穿。

这套题做下来最大的收获不是这些 flag，而是形成了一个条件反射——看到一段密文先看它长什么样、有没有泄露的参数、算法本身有没有代数或实现上的弱点。三个问题问完，大部分题心里就有数了。剩下的就是动手写 exp 的事。
