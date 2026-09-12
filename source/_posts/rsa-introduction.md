---
title: RSA 攻击讲解—从数学原理到实战利用
date: 2026-09-11 20:35:00
categories: [密码学, CTF]
tags: [密码学, RSA, CTF]
cover: /img/bg.jpg
---

## RSA 基础回顾

RSA 的安全性基于大整数分解难题（IFP, Integer Factorization Problem）。密钥生成：

1. 选两个大素数 p, q
2. n = p × q
3. φ(n) = (p-1)(q-1)
4. 选 e 满足 1 < e < φ(n) 且 gcd(e, φ(n)) = 1
5. d = e⁻¹ mod φ(n)

公钥 (n, e)，私钥 (n, d)。加密 c = m^e mod n，解密 m = c^d mod n。

RSA 本身的数学是安全的，但**实现和使用中的错误**会导致各种攻击。CTF 中的 RSA 题几乎都是在考这些攻击方法。

<!-- more -->

## 攻击 1：小模数分解（n 太小）

当 n 的位数不够（如 256 位以下），可以直接用工具分解：

```bash
# 在线分解
# factordb.com：输入 n，直接返回 p, q

# 本地工具
yafu 'factor(123456789...)'
msieve -q 123456789...
```

Python 实现：

```python
from sympy import factorint
n = 1234567890123456789012345678901234567890123456789012345678901234567890
factors = factorint(n)
print(factors)
```

CTF 中 n < 512 位基本都可以直接分解，512-1024 位需要看具体情况。

## 攻击 2：低加密指数攻击（e 太小）

当 e = 3 且明文 m 较小时，m^e < n，此时密文 c = m^e 没有取模效果，直接开 e 次方即可：

```python
from gmpy2 import iroot

e = 3
c = 123456789...

# 直接开三次方
m, is_perfect = iroot(c, e)
if is_perfect:
    print(hex(m))
    print(bytes.fromhex(hex(m)[2:]))
```

如果 m^e > n 但差距不大，可以用 Coppersmith 攻击（见攻击 6）。

### 低指数广播攻击（Håstad's Broadcast Attack）

当同一个明文用相同的小 e 加密，但用不同的 n 加密至少 e 次时，可以用中国剩余定理（CRT）恢复明文：

```python
from sympy.ntheory.modular import crt
from gmpy2 import iroot

# e=3，有三组 (n_i, c_i)
ns = [n1, n2, n3]
cs = [c1, c2, c3]

# CRT 求出 m^e mod (n1*n2*n3)
M, _ = crt(ns, cs)

# 开 e 次方
m, _ = iroot(M, 3)
print(bytes.fromhex(hex(m)[2:]))
```

原理：m^3 < n1×n2×n3（因为 m < n_i），所以 CRT 结果就是 m^3 的精确值。

## 攻击 3：共模攻击（Common Modulus）

当两个用户使用相同的 n 但不同的 e1, e2 加密同一个明文时：

c1 = m^e1 mod n
c2 = m^e2 mod n

如果 gcd(e1, e2) = 1，存在 a, b 使得 a×e1 + b×e2 = 1（扩展欧几里得算法），则：

m = c1^a × c2^b mod n

```python
from gmpy2 import gcdext, invert

def common_modulus_attack(c1, c2, e1, e2, n):
    g, a, b = gcdext(e1, e2)
    # g 应该为 1
    # 处理负数指数
    if a < 0:
        c1 = invert(c1, n)
        a = -a
    if b < 0:
        c2 = invert(c2, n)
        b = -b
    m = (pow(c1, a, n) * pow(c2, b, n)) % n
    return m
```

## 攻击 4：Wiener 攻击（d 太小）

当私钥指数 d 太小（d < n^0.25 / 3）时，Wiener 攻击可以通过连分数展开从公钥 (n, e) 恢复 d。

原理：d/e 是 φ(n)/e 的一个连分数收敛项，而 φ(n) ≈ n，所以可以通过 e/n 的连分数展开找到 d。

```python
from sympy import continued_fraction_convergents, continued_fraction_iterator
from gmpy2 import isqrt

def wiener_attack(e, n):
    # 生成 e/n 的连分数收敛项
    convergents = continued_fraction_convergents(
        continued_fraction_iterator(e / n)
    )
    
    for conv in convergents:
        k = conv.p  # 分子
        d = conv.q  # 分母
        
        if k == 0:
            continue
        
        # 验证：(e*d - 1) / k 应该是整数，且等于 φ(n)
        if (e * d - 1) % k != 0:
            continue
        
        phi = (e * d - 1) // k
        
        # 解二次方程 x^2 - (n - phi + 1)x + n = 0
        # 根为 p, q
        b = n - phi + 1
        discriminant = b * b - 4 * n
        
        if discriminant < 0:
            continue
        
        sqrt_disc = isqrt(discriminant)
        if sqrt_disc * sqrt_disc != discriminant:
            continue
        
        p = (b + sqrt_disc) // 2
        q = (b - sqrt_disc) // 2
        
        if p * q == n:
            return d, p, q
    
    return None
```

Wiener 攻击的扩展：Boneh-Durfee 攻击可以在 d < n^0.292 时恢复 d，但实现更复杂（需要格基约减）。

## 攻击 5：p 和 q 接近（Fermat 分解）

当 p 和 q 非常接近时，n = p×q 可以用 Fermat 分解法快速分解。

原理：设 a = ceil(sqrt(n))，则 n = a² - b² = (a-b)(a+b)，其中 p = a-b, q = a+b。p 和 q 越接近，b 越小，需要的迭代次数越少。

```python
from gmpy2 import isqrt, is_square

def fermat_factor(n):
    a = isqrt(n)
    if a * a < n:
        a += 1
    
    while True:
        b2 = a * a - n
        if is_square(b2):
            b = isqrt(b2)
            p = a - b
            q = a + b
            return p, q
        a += 1
```

当 |p-q| < n^0.25 时，Fermat 分解非常快。

## 攻击 6：Coppersmith 攻击

Coppersmith 攻击是 RSA 攻击中最强大的工具之一，由 Don Coppersmith 于 1996 年提出。它可以在已知多项式的小根时，通过格基约减（LLL 算法）恢复根。

### 场景 1：已知明文高位（明文中的 Coppersmith）

当知道明文 m 的高位部分（如 m = known_prefix + x，其中 x 很小），可以构造多项式 f(x) = (known_prefix + x)^e - c mod n，求 f(x) 的小根。

```python
# 使用 sage math
# sage -python attack.py

from sage.all import *

def coppersmith_known_high_bits(n, e, c, known_prefix, unknown_bits):
    """
    已知明文高位，恢复低位
    known_prefix: 已知的高位部分
    unknown_bits: 未知部分的位数
    """
    P = PolynomialRing(Zmod(n), 'x')
    x = P.gen()
    
    # m = known_prefix * 2^unknown_bits + x
    m = known_prefix * (2 ** unknown_bits) + x
    f = (m ** e - c).monic()
    
    # Coppersmith 方法求小根
    # 上界 X = 2^unknown_bits
    X = 2 ** unknown_bits
    roots = f.small_roots(X=X, beta=1, epsilon=0.01)
    
    for root in roots:
        m_full = known_prefix * (2 ** unknown_bits) + int(root)
        return m_full
    
    return None
```

### 场景 2：低指数相关消息攻击

当 e=3 且两个明文 m1, m2 满足 m2 = m1 + b（b 已知），可以用 Coppersmith 恢复 m1。

### 场景 3：部分密钥泄露攻击

当知道 d 的一部分比特（如低位或高位），可以用 Coppersmith 恢复完整的 d。

Coppersmith 攻击的核心是 LLL 格基约减算法，把多项式求根问题转化为格中的短向量问题。这是 CTF RSA 题中最常考的高级攻击。

## 攻击 7：CRT 实现错误

RSA 解密通常用 CRT（中国剩余定理）加速：

m_p = c^(d mod (p-1)) mod p
m_q = c^(d mod (q-1)) mod q
m = CRT(m_p, m_q)

如果 CRT 实现有错误（如 Garner 算法中的符号错误），可以通过一个错误的解密结果分解 n：

- 如果 m_p 正确但 m_q 错误，则 gcd(m - m_correct, n) = p
- 更常见的：错误解密结果 m_wrong，gcd(m_wrong - m_correct, n) 可以分解 n

```python
from math import gcd

# m_correct: 正确的明文
# m_wrong: 错误实现解密得到的结果
p = gcd(m_correct - m_wrong, n)
q = n // p
```

## 攻击 8：侧信道攻击

在实际环境中，RSA 实现可能受到侧信道攻击：

- **计时攻击**：测量解密时间差异，恢复 d 的比特（Kocher 攻击）
- **功耗分析**：通过功耗轨迹恢复密钥（DPA / CPA）
- **故障注入**：在解密过程中注入故障，利用错误结果分解 n（Bellcore 攻击）

CTF 中偶尔会出现侧信道相关的题目，通常是给一组计时数据或功耗轨迹，需要写脚本分析。

## 攻击 9：填充预言机攻击（Padding Oracle）

当 RSA 使用 PKCS#1 v1.5 填充且服务器会返回"填充是否正确"的信息时，可以用 Bleichenbacher 攻击逐步恢复明文。

攻击原理：构造大量密文，根据服务器返回的填充正确/错误信息，逐步缩小明文的范围，最终恢复完整明文。

```python
# Bleichenbacher 攻击简化框架
def bleichenbacher_attack(c, n, e, padding_oracle):
    """
    padding_oracle(c): 返回 True 如果解密后填充有效
    """
    B = 2 ** (8 * (n.bit_length() // 8 - 2))  # PKCS#1 填充的边界
    
    # 第一步：找到最小的 s 使得 c*s^e mod n 的解密结果填充有效
    s = 2
    while not padding_oracle((c * pow(s, e, n)) % n):
        s += 1
    
    # 后续步骤：逐步缩小范围...
    # 完整实现较复杂，参考 Bleichenbacher 1998 论文
```

## 攻击 10：其他常见 CTF 考点

### 模逆不存在（gcd(e, φ(n)) != 1）

当 e 和 φ(n) 不互素时，d 不存在。此时如果 gcd(e, φ(n)) = g，可以：
1. 先求 c^(e/g)^(-1) mod n，得到 m^g
2. 然后对 m^g 开 g 次方（如果 m 较小）

### n 是素数幂（n = p^k）

如果 n = p^k（k > 1），φ(n) = p^(k-1)(p-1)，可以直接计算 d。

### 多个素数（n = p×q×r...）

如果 n 是多个素数的乘积，φ(n) = ∏(p_i - 1)，分解后正常计算。

### 明文就是 flag 的某种编码

有时候不需要攻击，直接：
- c 转 hex 转 ASCII 就是 flag
- n 或 e 中隐藏了 flag（LSB 隐写）
- 公钥文件中注释里有 flag

## 实战工具

### RsaCtfTool

一站式 RSA CTF 工具，自动检测并执行各种攻击：

```bash
git clone https://github.com/RsaCtfTool/RsaCtfTool
cd RsaCtfTool
pip install -r requirements.txt

# 自动攻击
python RsaCtfTool.py --publickey pub.key --encrypted c.enc --private

# 指定攻击方法
python RsaCtfTool.py --attack wiener --publickey pub.key --encrypted c.enc
```

支持的攻击：factordb、wiener、boneh_durfee、smallq、fermat、londahl、common_modulus、hastad、coppersmith 等。

### SageMath

高级 RSA 攻击（Coppersmith、格基约减）基本都需要 SageMath：

```bash
# 安装
sudo apt install sagemath

# 运行脚本
sage attack.sage
```

### yafu / msieve

大整数分解工具：

```bash
yafu 'factor(123456...)'
msieve -q 123456...
```

## CTF 解题流程

```
拿到 RSA 题
    │
    ├─ 提取公钥 (n, e) 和密文 c
    │   openssl rsa -pubin -in pub.key -text -noout
    │
    ├─ n 太小？→ 直接分解（factordb / yafu）
    ├─ e 太小？→ 低指数攻击 / 广播攻击
    ├─ d 太小？→ Wiener 攻击
    ├─ p, q 接近？→ Fermat 分解
    ├─ 多个 n 有共同因子？→ gcd 分解
    ├─ 相同 n 不同 e？→ 共模攻击
    ├─ 已知明文部分？→ Coppersmith 攻击
    ├─ 填充预言机？→ Bleichenbacher 攻击
    ├─ CRT 错误？→ 故障攻击分解 n
    │
    └─ 都不是？→ 检查是否有隐写、编码、信息泄露
```

## 总结

RSA 的数学本身是安全的，但 CTF 中的 RSA 题几乎都是在考**实现和使用中的错误**。从小模数分解、低指数攻击，到 Wiener 攻击、Coppersmith 攻击，每一种攻击都对应着一种特定的密钥生成或使用错误。

掌握 RSA 攻击需要：
1. **数论基础**：欧拉定理、中国剩余定理、连分数、格基约减
2. **攻击方法库**：记住每种攻击的适用条件和原理
3. **工具熟练度**：RsaCtfTool、SageMath、yafu 的使用
4. **数学直觉**：看到 n、e、c 的特征，能快速判断可能的攻击方向

RSA 是 CTF 密码学方向的入门必修课，也是实际密码学安全的重要内容。理解这些攻击，不仅能做 CTF 题，也能在实际工程中避免这些致命的实现错误。
