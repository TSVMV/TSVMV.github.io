---
title: 椭圆曲线密码学(ECC)详解—从数学原理到 CTF 密码学实战
date: 2026-09-16 12:00:00
categories: [CTF]
tags: [CTF, 密码学, 数论]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg39.jpg
---

椭圆曲线密码学（ECC）是现代密码学的基石之一。Bitcoin 用 secp256k1，TLS 用 secp256r1，Signal 用 X25519，WhatsApp 用 Curve25519。CTF 密码学题里，ECC 更是常客——从小白友好的非ce点攻击，到高难度的 SMART 攻击、无效曲线攻击、MOV 攻击，变种繁多。

这篇文章从零开始讲 ECC 的数学原理，然后落地到 CTF 中常见的攻击手法和解题套路。

<!-- more -->

## 1. 什么是椭圆曲线

在密码学中，椭圆曲线定义在有限域上，形如：

```
y² = x³ + ax + b  (mod p)
```

其中 p 是一个大质数，a、b 满足 `4a³ + 27b² ≠ 0 (mod p)`（防止曲线有奇点）。

这条曲线上的所有点 (x, y)，加上一个无穷远点 O（相当于"零元"），构成一个**阿贝尔群**。群运算定义为"点加法"。

## 2. 点加法的几何意义

给定曲线上两点 P 和 Q，P+Q 的几何做法：

1. 过 P 和 Q 画一条直线
2. 这条直线和曲线交于第三个点 R'
3. 把 R' 关于 x 轴翻折，得到 R = P + Q

如果 P = Q（两倍点），那直线换成 P 点的切线。

代数公式（a ≠ 0 的一般情况）：

```
如果 P ≠ Q：
  λ = (y_Q - y_P) / (x_Q - x_P)  (mod p)
如果 P = Q：
  λ = (3x_P² + a) / (2y_P)       (mod p)
  
x_R = λ² - x_P - x_Q  (mod p)
y_R = λ(x_P - x_R) - y_P  (mod p)
```

注意除法是模逆元——分母必须和 p 互质。如果分母为 0，结果就是无穷远点 O。

## 3. 标量乘法与离散对数

定义 kP = P + P + ... + P（k 次）。这就是椭圆曲线上的"乘法"。

- **正向计算**：给 k 和 P，算 kP。用 double-and-add 算法，O(log k) 次点加，很快。
- **逆向计算**：给 P 和 Q = kP，求 k。这就是**椭圆曲线离散对数问题（ECDLP）**。

ECDLP 目前没有已知的多项式时间经典算法。最著名的暴力方法是 Pollard's rho，复杂度 O(√n)，n 是群的阶。对于 256 位曲线，√n ≈ 2¹²⁸，计算上不可行。这就是 ECC 安全性的基础。

## 4. CTF 中 ECC 的常见曲线

| 曲线 | 参数 | 特点 |
|------|------|------|
| secp256k1 | Bitcoin 用 | a=0, b=7 |
| secp256r1 (NIST P-256) | TLS 用 | NIST 标准 |
| Curve25519 | X25519 用 |  Montgomery 形式 |
| secp112r1 / secp128r1 | CTF 出题常用 | 小曲线，可暴力 |

CTF 出题人喜欢用小曲线，因为群的阶小，方便演示攻击。比如 n = 10007 这种规模，直接暴力枚举 k 就行了。

## 5. 基础实现（Python）

```python
class Curve:
    def __init__(self, p, a, b):
        self.p = p
        self.a = a
        self.b = b
        self.O = (None, None)  # 无穷远点
    
    def add(self, P, Q):
        if P == self.O:
            return Q
        if Q == self.O:
            return P
        
        x1, y1 = P
        x2, y2 = Q
        
        if x1 == x2 and (y1 + y2) % self.p == 0:
            return self.O
        
        if P == Q:
            lam = (3 * x1 * x1 + self.a) * pow(2 * y1, -1, self.p) % self.p
        else:
            lam = (y2 - y1) * pow(x2 - x1, -1, self.p) % self.p
        
        x3 = (lam * lam - x1 - x2) % self.p
        y3 = (lam * (x1 - x3) - y1) % self.p
        return (x3, y3)
    
    def mul(self, k, P):
        result = self.O
        addend = P
        while k > 0:
            if k & 1:
                result = self.add(result, addend)
            addend = self.add(addend, addend)
            k >>= 1
        return result
```

## 6. 攻击一：小阶群暴力枚举

最基础的攻击。如果曲线的阶 n 很小（比如 n < 10⁶），直接枚举 k 就行了。

```python
# 已知 P 和 Q = kP，求 k
for k in range(1, n):
    if curve.mul(k, P) == Q:
        print(f"k = {k}")
        break
```

CTF 题里如果给了一个只有几百个点的曲线，别想太多，直接暴力。

## 7. 攻击二：Pohlig-Hellman 算法

如果群的阶 n 可以分解为小素数因子的乘积（n = q₁ × q₂ × ... × qₖ），可以用 Pohlig-Hellman 算法把大的离散对数问题分解为每个素因子上的小问题，最后用中国剩余定理（CRT）合并。

**前提**：n 的最大素因子要小。

```python
from sympy import factorint
from CRT import crt  # 中国剩余定理

def pohlig_hellman(curve, P, Q, n):
    factors = factorint(n)
    residues = []
    moduli = []
    
    for q, e in factors.items():
        # 在子群中求解（简化版，实际要处理 q^e）
        qj = q
        Pj = curve.mul(n // qj, P)
        Qj = curve.mul(n // qj, Q)
        
        # 在 qj 阶子群中暴力
        k_j = 0
        tmp = curve.O
        for i in range(qj):
            if tmp == Qj:
                k_j = i
                break
            tmp = curve.add(tmp, Pj)
        
        residues.append(k_j)
        moduli.append(qj)
    
    return crt(residues, moduli)
```

**防御**：选择 n 有一个大素因子（至少 200 位以上）的曲线。secp256k1 等标准曲线都满足这个条件。

## 8. 攻击三：无效曲线攻击（Invalid Curve Attack）

这是 ECC 最经典的攻击之一。核心思想：**如果你能让受害者在一条"坏曲线"上做点乘，而坏曲线上的离散对数是好解的，你就能反推出私钥。**

攻击流程：
1. 攻击者构造一条椭圆曲线 E'：y² = x³ + ax + b'（换一个 b'）
2. 受害者以为在正常曲线 E 上工作，但实际在 E' 上计算了点乘
3. E' 的阶可以被选择成一个光滑数（smooth number），Pohlig-Hellman 直接破解
4. 攻击者反推出私钥

关键点：点 (x, y) 是否在曲线上只取决于 y² == x³ + ax + b。如果服务端**不验证点是否在曲线上**，攻击者就可以随意构造在另一条曲线上的点发过去。

```python
# 攻击演示
# 服务端用的曲线：y² = x³ + 7 (secp256k1)
# 攻击者构造新曲线：y² = x³ + b'
# 选一个点 P' 在新曲线上
# 发 P' 给服务端，服务端算 k*P'
# 因为 P' 不在原曲线上，服务端的点加公式仍然适用（代数上一样）
# 但 P' 所在的新曲线阶是光滑的，用 Pohlig-Hellman 破解

b_prime = 12345  # 攻击者选的 b'
attack_curve = Curve(p, a, b_prime)
P_prime = (x, y)  # 攻击者构造的点，满足 y² = x³ + a*x + b_prime (mod p)

# 服务端算 k*P_prime，返回 Q'
# 攻击者在 attack_curve 上用 Pohlig-Hellman 求 k
```

**防御**：服务端必须验证收到的点是否在曲线上：`assert y² == x³ + ax + b (mod p)`。这一行代码就能挡住整个攻击。

## 9. 攻击四：Smart's Attack（异常曲线攻击）

Smart's Attack 针对的是**超奇异曲线**或**异常曲线**（anomalous curve）——即群的阶等于 p 的曲线。

对于异常曲线，离散对数可以在多项式时间内求解（Smart 1997, Satch 1997）。核心思路是利用曲线的 p 阶特性，把离散对数问题降级为整数环上的问题。

```python
# 异常曲线：#E(F_p) = p
# 此时 E(F_p) 同构于 F_p 的加法群
# 离散对数问题变得平凡

# 检测方法：计算 #E(F_p)，看是否等于 p
```

**防御**：使用经过标准验证的曲线参数（NIST、SECG 推荐的曲线），不要自己随便选参数。

## 10. 攻击五：MOV 攻击

MOV 攻击把椭圆曲线上的离散对数问题**规约**到有限域乘法群中的离散对数问题，然后用 Index Calculus 算法求解。

当曲线的嵌入度（embedding degree）很小的时候，MOV 攻击有效。嵌入度 k 是最小的正整数使得 pᵏ ≡ 1 (mod n)，其中 n 是曲线的阶。

```
MOV 规约：
1. 找一个 P 的 n 阶点，且 P 在 F_{p^k} 上
2. 用 Weil/Tate 配对把 (P, kP) 映射到 F_{p^k} 中的两个元素
3. 在 F_{p^k} 中求解普通离散对数
```

如果 k 很小（比如 k=2 或 3），F_{p^k} 的规模不大，Index Calculus 可以有效求解。

**防御**：选择嵌入度大的曲线。标准曲线都经过验证，嵌入度足够大。

## 11. ECDH 密钥交换

ECC 最常见的应用是 ECDH（椭圆曲线 Diffie-Hellman）密钥交换：

```
Alice 选私钥 a，公钥 A = aG
Bob   选私钥 b，公钥 B = bG

Alice 算 S = aB = abG
Bob   算 S = bA = abG

双方得到相同的共享密钥 S
```

中间人攻击：如果攻击者能替换公钥，就能冒充双方。这就是为什么需要证书认证（TLS 的做法）。

## 12. CTF 实战模板

遇到 ECC 题目的一般分析流程：

```
1. 看曲线参数：p、a、b、G、n
2. 检查 n 是否可分解（factorint）
   - 如果 n 光滑 → Pohlig-Hellman
   - 如果 n == p → Smart's Attack
3. 检查是否验证点在曲线上
   - 不验证 → Invalid Curve Attack
4. 检查嵌入度
   - 嵌入度小 → MOV Attack
5. 以上都不行
   - 标准曲线 → 没救了，找别的漏洞
   - 小曲线 → 暴力枚举
```

常用工具：
- **SageMath**：内置 ECC 运算、Pohlig-Hellman、MOV 攻击
- **ecc.py**：自己写的轻量级 ECC 库
- **Racket / Python**：纯实现

## 总结

ECC 是 CTF 密码学的核心考点。理解点加法的几何意义和代数公式是基础，掌握五种常见攻击（暴力、Pohlig-Hellman、Invalid Curve、Smart、MOV）就能应付绝大多数 ECC 题目。

关键提醒：
1. **永远用标准曲线**——自己选参数大概率有后门
2. **永远验证点在曲线上**——一行代码挡住 Invalid Curve
3. **n 必须有大素因子**——挡住 Pohlig-Hellman
4. **嵌入度必须大**——挡住 MOV

写 ECC 题的时候，先拿 SageMath 算一遍曲线参数，看看有没有明显弱点，再决定攻击方向。
