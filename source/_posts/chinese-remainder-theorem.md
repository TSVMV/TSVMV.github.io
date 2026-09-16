---
title: 中国剩余定理(CRT)详解—从孙子定理到 RSA 应用
date: 2026-09-16 22:30:00
categories: [CTF]
tags: [CTF, 密码学, 数论]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg47.jpg
---

"有物不知其数，三三数之剩二，五五数之剩三，七七数之剩二，问物几何？"——《孙子算经》

这就是中国剩余定理（CRT）的起源。在 CTF 密码学中，CRT 无处不在：RSA 加速解密、共模攻击、广播攻击、Elliptic Curve 点合并……不会 CRT，密码学题基本做不动。

<!-- more -->

## 1. 定理内容

给定一组同余方程：

```
x ≡ a₁ (mod m₁)
x ≡ a₂ (mod m₂)
...
x ≡ aₖ (mod mₖ)
```

如果 m₁, m₂, ..., mₖ 两两互质，则存在唯一解 mod M = m₁ × m₂ × ... × mₖ。

## 2. 标准 CRT 实现

```python
def crt(remainders, moduli):
    """
    remainders: [a1, a2, ..., ak]
    moduli:     [m1, m2, ..., mk]  两两互质
    返回 x mod M
    """
    M = 1
    for m in moduli:
        M *= m
    
    result = 0
    for a, m in zip(remainders, moduli):
        Mi = M // m
        # Mi 在 mod m 下的逆元
        inv = pow(Mi, -1, m)
        result += a * Mi * inv
    
    return result % M
```

## 3. 扩展 CRT（模数不互质）

实际题目中模数经常不互质。这时候需要用扩展 CRT。

思路：两两合并。先解前两个方程：

```
x ≡ a₁ (mod m₁)
x ≡ a₂ (mod m₂)
```

设 x = a₁ + k·m₁，代入第二个方程：
```
a₁ + k·m₁ ≡ a₂ (mod m₂)
k·m₁ ≡ (a₂ - a₁) (mod m₂)
```

设 g = gcd(m₁, m₂)。如果 (a₂-a₁) 不能被 g 整除，无解。否则解出 k mod (m₂/g)，合并为新的同余方程。

```python
from math import gcd

def ext_gcd(a, b):
    if b == 0:
        return a, 1, 0
    g, x, y = ext_gcd(b, a % b)
    return g, y, x - (a // b) * y

def crt_merge(a1, m1, a2, m2):
    """合并 x ≡ a1 (mod m1) 和 x ≡ a2 (mod m2)"""
    g, p, q = ext_gcd(m1, m2)
    if (a2 - a1) % g != 0:
        return None  # 无解
    lcm = m1 // g * m2
    k = ((a2 - a1) // g * p) % (m2 // g)
    x = (a1 + k * m1) % lcm
    return x, lcm

def ext_crt(remainders, moduli):
    a, m = remainders[0], moduli[0]
    for i in range(1, len(remainders)):
        merged = crt_merge(a, m, remainders[i], moduli[i])
        if merged is None:
            return None
        a, m = merged
    return a % m
```

## 4. CTF 实战：RSA CRT 加速

RSA 中，解密 m = c^d mod n。如果知道 p 和 q，可以用 CRT 加速：

```
dp = d mod (p-1)
dq = d mod (q-1)
mp = c^dp mod p
mq = c^dq mod q
m = CRT(mp, p, mq, q)
```

比直接算 c^d mod n 快 4 倍左右。

## 5. CTF 实战：RSA 共模攻击

如果两组 (e1, n) 和 (e2, n) 用同一个 n 加密同一条明文 m：

```
c1 = m^e1 mod n
c2 = m^e2 mod n
```

找 s1, s2 使得 s1·e1 + s2·e2 = 1（扩展欧几里得），则：

```
m = c1^s1 · c2^s2 mod n
```

```python
def common_modulus_attack(c1, c2, e1, e2, n):
    g, s1, s2 = ext_gcd(e1, e2)
    # g 应该 = 1
    m = (pow(c1, s1, n) * pow(c2, s2, n)) % n
    if s1 < 0:
        m = pow(m, -1, n)  # 负指数要取逆
    return m
```

## 6. CTF 实战：RSA 广播攻击

如果 e=3 且同一条明文 m 用三个不同的模数 n1, n2, n3 加密：

```
c1 = m³ mod n1
c2 = m³ mod n2
c3 = m³ mod n3
```

用 CRT 合并 c1, c2, c3 和 n1, n2, n3，得到 m³ mod (n1·n2·n3)。因为 m < n1, n2, n3，所以 m³ < n1·n2·n3，直接开立方根就得到 m。

```python
def broadcast_attack(c1, c2, c3, n1, n2, n3):
    # CRT 合并
    M = n1 * n2 * n3
    N1, N2, N3 = M // n1, M // n2, M // n3
    m3 = (c1 * N1 * pow(N1, -1, n1) + 
          c2 * N2 * pow(N2, -1, n2) + 
          c3 * N3 * pow(N3, -1, n3)) % M
    # 开立方根
    return integer_cbrt(m3)
```

## 7. CTF 实战：CRT 拆分 ECC 点

椭圆曲线中，如果知道点 P 在多个子群上的投影，可以用 CRT 合并回来。这在 Smart 攻击和 Pohlig-Hellman 中常用。

## 总结

CRT 是数论密码学的核心工具。记住：
1. **标准 CRT**：模数两两互质，直接套公式
2. **扩展 CRT**：模数不互质，两两合并
3. **RSA 中**：共模攻击、广播攻击、CRT 加速解密
4. **ECC 中**：Pohlig-Hellman 的 CRT 合并

实际做题时，sympy 有现成的 `crp_crt` 函数，但理解原理比调库重要。
