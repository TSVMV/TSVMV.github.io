---
title: 二次剩余与 Tonelli-Shanks 算法详解
date: 2026-09-16 19:30:00
categories: [CTF]
tags: [CTF, 密码学, 数论]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg42.jpg
---

二次剩余（Quadratic Residue）是 CTF 密码学里的高频考点。RSA 中解密需要求模 n 的平方根，ECDSA 签名验证涉及二次剩余判定， even 简单的"猜数"题都可能藏着 Legendre 符号的套路。

这篇文章从定义出发，讲清楚什么是二次剩余、怎么判定、怎么求平方根，最后落地到 CTF 中的常见应用。

<!-- more -->

## 1. 什么是二次剩余

给定奇质数 p 和整数 a，如果存在 x 使得：

```
x² ≡ a (mod p)
```

则称 a 是模 p 的**二次剩余**（Quadratic Residue, QR），否则称为**二次非剩余**（Quadratic Non-Residue, QNR）。

举个例子，p=7：
- 1²=1, 2²=4, 3²=2, 4²=2, 5²=4, 6²=1
- 所以模 7 的二次剩余是 {1, 2, 4}，非剩余是 {3, 5, 6}

注意 x 和 -x 给出同一个平方值，所以模 p 有 (p-1)/2 个二次剩余和 (p-1)/2 个二次非剩余。

## 2. Legendre 符号

定义 Legendre 符号：

```
(a|p) =  1  如果 a 是模 p 的二次剩余且 a ≠ 0
(a|p) = -1  如果 a 是模 p 的二次非剩余
(a|p) =  0  如果 a ≡ 0 (mod p)
```

Euler 判别法给出了计算方法：

```
(a|p) ≡ a^((p-1)/2) (mod p)
```

```python
def legendre(a, p):
    result = pow(a, (p - 1) // 2, p)
    if result == p - 1:
        return -1
    return result  # 0 或 1
```

## 3. 高斯互反律

二次互反律是数论中最优美的定理之一：

```
(p|q) * (q|p) = (-1)^((p-1)/2 * (q-1)/2)
```

换句话说：
- 如果 p 或 q ≡ 1 (mod 4)，则 (p|q) = (q|p)
- 如果 p 和 q 都 ≡ 3 (mod 4)，则 (p|q) = -(q|p)

辅助律：
- (2|p) = 1 当 p ≡ ±1 (mod 8)
- (2|p) = -1 当 p ≡ ±3 (mod 8)

## 4. Tonelli-Shanks 算法：求模平方根

知道 a 是二次剩余后，怎么求 x 使得 x² ≡ a (mod p)？这就是 Tonelli-Shanks 算法。

### 4.1 特殊情况：p ≡ 3 (mod 4)

最简单的情况。直接公式：

```
x ≡ a^((p+1)/4) (mod p)
```

```python
def sqrt_mod_congruent_3(a, p):
    assert p % 4 == 3
    x = pow(a, (p + 1) // 4, p)
    assert (x * x - a) % p == 0
    return x
```

### 4.2 一般情况：Tonelli-Shanks

对于任意奇质数 p，算法步骤：

1. 把 p-1 写成 Q * 2^S
2. 找一个二次非剩余 z
3. 初始化 M=S, c=z^(2^Q), t=a^Q, R=a^((Q+1)/2)
4. 循环：
   - 如果 t=0，返回 0
   - 如果 t=1，返回 R
   - 找最小的 i (0 < i < M) 使得 t^(2^i) = 1
   - 设 b = c^(2^(M-i-1))
   - 更新 M=i, c=b², t=t*b², R=R*b

```python
def tonelli_shanks(n, p):
    """求 x 使得 x² ≡ n (mod p)，p 是奇质数"""
    assert legendre(n, p) == 1, "n 不是二次剩余"
    
    # 特殊情况
    if p % 4 == 3:
        return pow(n, (p + 1) // 4, p)
    
    # 分解 p-1 = Q * 2^S
    Q = p - 1
    S = 0
    while Q % 2 == 0:
        Q //= 2
        S += 1
    
    # 找二次非剩余
    z = 2
    while legendre(z, p) != -1:
        z += 1
    
    M = S
    c = pow(z, Q, p)
    t = pow(n, Q, p)
    R = pow(n, (Q + 1) // 2, p)
    
    while True:
        if t == 1:
            return R
        if t == 0:
            return 0
        
        # 找最小的 i
        i = 0
        temp = t
        while temp != 1:
            temp = pow(temp, 2, p)
            i += 1
        
        b = pow(c, 1 << (M - i - 1), p)
        M = i
        c = pow(b, 2, p)
        t = (t * c) % p
        R = (R * b) % p
```

## 5. CTF 实战：RSA 解密

RSA 中，如果知道私钥 d，解密就是 m = c^d mod n。但如果题目给了 e=3 且 m 很小，m³ < n，就可以直接开三次方根。类似地，e=2 时就是开平方根。

```python
# RSA 低加密指数攻击，e=3
# m³ ≡ c (mod n)，但 m³ < n，所以 m³ = c（无模约简）
# 直接开立方根
def integer_cbrt(n):
    if n < 0:
        return -integer_cbrt(-n)
    if n == 0:
        return 0
    x = int(round(n ** (1/3)))
    while (x+1)**3 <= n:
        x += 1
    while x**3 > n:
        x -= 1
    return x
```

## 6. CTF 实战：二次剩余编码

有一种隐写术叫"二次剩余编码"：把信息嵌入到模 p 的二次剩余/非剩余序列中。解密时只需要对每个块算 Legendre 符号，1 表示 QR，0 表示 QNR。

```python
def decode_quadratic_residue(data, p):
    bits = []
    for block in data:
        if legendre(block, p) == 1:
            bits.append(1)
        else:
            bits.append(0)
    return bits
```

## 7. CTF 实战：Tonelli-Shanks 求 RSA 明文

在 RSA 共模攻击、wiener 攻击等场景中，有时需要对模合数 n 求平方根。如果 n = p*q 且知道 p 和 q，可以分别在 mod p 和 mod q 下求平方根，然后用 CRT 合并。

```python
def sqrt_mod_n(a, p, q):
    """n = p*q，求 x 使得 x² ≡ a (mod n)"""
    # 分别求 mod p 和 mod q 的平方根
    xp = tonelli_shanks(a % p, p)
    xq = tonelli_shanks(a % q, q)
    
    # CRT 合并，有四个解
    # x ≡ xp (mod p), x ≡ xq (mod q)
    # x ≡ xp (mod p), x ≡ -xq (mod q)
    # x ≡ -xp (mod p), x ≡ xq (mod q)
    # x ≡ -xp (mod p), x ≡ -xq (mod q)
    return crt([xp, xq], [p, q])
```

## 8. 雅可比符号

当模数不是质数时，用雅可比符号推广 Legendre 符号。雅可比符号 (a|n) 定义为 n 的所有质因子的 Legendre 符号乘积。

```python
def jacobi(a, n):
    assert n > 0 and n % 2 == 1
    a %= n
    result = 1
    while a != 0:
        while a % 2 == 0:
            a //= 2
            if n % 8 in (3, 5):
                result = -result
        a, n = n, a
        if a % 4 == 3 and n % 4 == 3:
            result = -result
        a %= n
    return result if n == 1 else 0
```

雅可比符号可以高效计算，但它不告诉你 a 是否是模 n 的二次剩余——只有当 n 是质数时才等价于 Legendre 符号。

## 总结

二次剩余是数论密码学的基础组件。掌握 Legendre 符号判定和 Tonelli-Shanks 求根，能应对 CTF 中大量的密码学题目。关键记住：

1. **p ≡ 3 (mod 4)**：直接公式 x = a^((p+1)/4)
2. **一般情况**：Tonelli-Shanks 算法
3. **合数模**：分解后 CRT 合并
4. **CTF 套路**：低指数开方、二次剩余隐写、RSA 变体攻击
