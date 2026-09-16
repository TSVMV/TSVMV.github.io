---
title: Miller-Rabin 素性测试与 Pollard's Rho 分解详解
date: 2026-09-16 21:30:00
categories: [CTF]
tags: [CTF, 密码学, 数论]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg45.jpg
---

大数分解是 RSA 密码学的命门。CTF 密码学题里，给你一个几百位的 n 让你分解，你总不能从 2 试到 √n 吧？这时候就需要 Miller-Rabin 判断是不是质数，Pollard's Rho 做概率分解。

这篇文章把这两个算法讲透，附上可直接用的 Python 实现。

<!-- more -->

## 1. Miller-Rabin 素性测试

### 原理

费马小定理：如果 p 是质数，那么对任意 a，a^(p-1) ≡ 1 (mod p)。

反过来，如果 a^(n-1) ≢ 1 (mod n)，那 n 一定不是质数。这就是 Miller-Rabin 的基础。

但费马小定理的逆命题不成立——存在 Carmichael 数（如 561），它们是合数但满足所有 a 的费马条件。Miller-Rabin 加了一层二次检测来排除这些伪证。

### 算法步骤

给定 n，把 n-1 写成 d * 2^s：

1. 随机选一个 a ∈ [2, n-2]
2. 计算 x = a^d mod n
3. 如果 x=1 或 x=n-1，通过本轮测试
4. 否则重复 s-1 次：
   - x = x² mod n
   - 如果 x = n-1，通过本轮测试，跳出
5. 如果循环结束都没通过，n 一定是合数
6. 通过多轮测试，n 是合数的概率是 (1/4)^k

```python
import random
from math import gcd

def miller_rabin(n, k=40):
    if n < 2:
        return False
    if n == 2 or n == 3:
        return True
    if n % 2 == 0:
        return False
    
    # 写成 d * 2^s = n - 1
    d = n - 1
    s = 0
    while d % 2 == 0:
        d //= 2
        s += 1
    
    # 对几个固定的小基数，对 2^64 以内的数是确定性的
    bases = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]
    # 大数用随机基数
    if n > 331:
        bases = [random.randint(2, n-2) for _ in range(k)]
    
    for a in bases:
        if a >= n:
            continue
        x = pow(a, d, n)
        if x == 1 or x == n - 1:
            continue
        for _ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True
```

### 确定性测试范围

对不同范围的 n，只需要固定几个基数就能 100% 确定：

| n 的范围 | 必测基数 |
|---------|---------|
| < 2,047 | {2} |
| < 1,373,653 | {2, 3} |
| < 9,080,191 | {31, 73} |
| < 4,759,123,141 | {2, 7, 61} |
| < 2^64 | {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37} |

## 2. Pollard's Rho 分解

### 原理

Pollard's Rho 是一个概率算法，比试除法快得多。核心思路：

1. 用伪随机函数 f(x) = (x² + c) mod n 生成序列
2. 序列中有两个数 x, y，如果 gcd(|x-y|, n) 是 n 的非平凡因子 d
3. 用 Floyd 环检测找重复值，避免存储整个序列

### 算法步骤

```python
def pollards_rho(n):
    if n % 2 == 0:
        return 2
    if n % 3 == 0:
        return 3
    
    while True:
        c = random.randint(1, n - 1)
        f = lambda x: (pow(x, 2, n) + c) % n
        
        x, y, d = 2, 2, 1
        while d == 1:
            x = f(x)
            y = f(f(y))
            d = gcd(abs(x - y), n)
        
        if d != n:
            return d
```

### 递归分解

```python
def factorize(n):
    factors = []
    
    def _factor(n):
        if n == 1:
            return
        if miller_rabin(n):
            factors.append(n)
            return
        d = pollards_rho(n)
        _factor(d)
        _factor(n // d)
    
    _factor(n)
    factors.sort()
    return factors
```

### 示例

```python
# 分解一个 RSA 模数（假设 n = p * q）
n = 12345678901234567890123456789
factors = factorize(n)
print(factors)
# [123457, 999999937] 之类的
```

## 3. CTF 实战：RSA 分解

CTF RSA 题中，如果 n 不算特别大（2048 位以下），Pollard's Rho 几秒就能分解：

```python
# 典型 RSA 题目
n = 0x... # 题目给的大整数
e = 65537
c = 0x...

# 分解 n = p * q
factors = factorize(n)
p, q = factors[0], factors[1]

# 计算私钥
phi = (p - 1) * (q - 1)
d = pow(e, -1, phi)
m = pow(c, d, n)
print(m.to_bytes((m.bit_length() + 7) // 8, 'big'))
```

## 4. CTF 实战：Fermat 分解

如果 n = p * q 且 p 和 q 很接近，可以用 Fermat 分解：

```python
def fermat_factor(n):
    a = int(n ** 0.5)
    b2 = a * a - n
    while True:
        b = int(b2 ** 0.5)
        if b * b == b2:
            return a - b, a + b
        a += 1
        b2 = a * a - n
```

如果 p 和 q 只差几百，这个方法比 Pollard's Rho 还快。

## 5. 复杂度

| 算法 | 复杂度 | 适用场景 |
|------|--------|---------|
| 试除法 | O(√n) | n < 10^12 |
| Fermat | O(|p-q|) | p ≈ q |
| Pollard's Rho | O(n^(1/4)) | RSA 2048 位以内 |
| ECM | 亚指数 | 中等大小因子 |
| GNFS | 亚指数 | RSA 1024+ 位 |

Python 的 Pollard's Rho 对 1024 位 RSA 模数大约需要几秒到几分钟。2048 位就别想了，那是超算干的事。

## 总结

Miller-Rabin + Pollard's Rho 是 CTF 密码学的标配工具。记住：
1. **先 Miller-Rabin 判断**是不是质数
2. **Pollard's Rho 找非平凡因子**
3. **递归分解**到所有质因子
4. **CTF 中**，n 通常不会太大，Python 版本足够用

实际做题时，建议直接用 sympy 的 `factorint`，它内部已经优化了 Pollard's Rho 和其他算法。但理解原理很重要——题目经常会在分解方法上设坑。
