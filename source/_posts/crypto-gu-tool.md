---
title: crypto-gu：纯标准库密码学工具箱，原语和攻击放在同一个内核
date: 2026-09-25 10:30:00
categories: [系统&内核]
tags: [密码学, RSA, AES, ECC, 攻击, Python]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg53.jpg
---

做 CTF 密码学题的时候，经常需要自己实现一些原语或者攻击。pycryptodome 能加密解密，但攻击（padding oracle、共模攻击、Wiener 这些）得自己写。每次比赛翻以前的 exp 复制粘贴，时间长了就想把这些东西整理成一个库。

crypto-gu 就是这么来的。纯 Python 标准库，零第三方依赖，把生产形态的密码学原语和确定性攻击实现放在同一个内核里。

<!-- more -->

## 原语层

哈希：SHA-1、SHA-256、SHA-512、MD5、BLAKE2b、BLAKE2s、HMAC。还有长度扩展攻击的实现。

KDF：PBKDF2、HKDF（extract/expand）、scrypt。

对称加密：AES-128/192/256 分组原语，ECB/CBC/CFB/OFB/CTR 五种模式。ChaCha20 流密码。Poly1305 MAC。ChaCha20-Poly1305 和 AES-GCM 两个 AEAD。

非对称：RSA 密钥生成和教科书式原语，配合攻击层做因子恢复。PKCS#1 里的 MGF1、RSAES-OAEP、RSASSA-PSS，按 RFC 8017 实现。

数论：素性检验、模逆、CRT、Tonelli-Shanks、Pollard rho/p-1、Fermat 分解、BSGS。

ECC：素域椭圆曲线点运算（短 Weierstrass）、点阶、曲线阶、EC BSGS。

随机数：MT19937 生成器和从输出反推内部状态（untemper）。

编码和填充：hex、base32/58/64/85、XOR、Morse、BCD、PKCS#7。

常量时间：无提前退出的比较和无分支 select。CPython 没法提供严格的常量时间保证，这里保持诚实定位。

## 攻击层

这是这个库和别的密码学库最大的区别——攻击和原语放在一起。

AES 攻击：ECB byte-at-a-time、CBC padding oracle、最后一轮 DFA 密钥恢复。

RSA 攻击：Wiener（d 过小）、Fermat 分解、Pollard p-1、共模攻击、Hastad 广播攻击。

ECC 攻击：Pohlig-Hellman（光滑阶群）、invalid-curve 小子群恢复。

时序攻击：从逐位计时恢复模幂指数、位分类。

攻击层只做确定性恢复（利用结构弱点），不做密钥空间暴力枚举。

## 验证

每个原语都有权威测试向量背书，取自 RFC/NIST 原文，或者由 hashlib、OpenSSL、cryptography、pycryptodome 实测生成，逐条嵌入测试。这一点很重要——自己实现的 AES 如果没有 NIST 测试向量验证，你根本不知道它对不对。

```python
# 快速上手
from crypto_gu.hashes import sha256
from crypto_gu.symmetric import aes_gcm
from crypto_gu.attacks.rsa import wiener

sha256(b"message").hex()

key = bytes(range(32))
nonce = b"\x00" * 12
sealed = aes_gcm.encrypt(key, nonce, b"payload", b"header")

wiener(n, e)  # d 过小时由 (n, e) 恢复私钥
```

项目地址：[github.com/TSVMV/crypto-gu](https://github.com/TSVMV/crypto-gu)。Python >= 3.11，pip install 就能用。
