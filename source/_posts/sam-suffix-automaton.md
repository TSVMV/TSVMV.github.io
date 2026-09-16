---
title: 后缀自动机(SAM)详解—从原理到 CTF 字符串题实战
date: 2026-09-16 11:00:00
categories: [CTF]
tags: [CTF, 算法, 字符串]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg38.jpg
---

后缀自动机（Suffix Automaton，简称 SAM）是处理字符串问题最强大的数据结构之一。它能在 O(n) 时间内构造出一个状态数 O(n) 的自动机，之后可以在线性时间内回答大量字符串相关的问题：不同子串个数、最长重复子串、出现次数最多的子串、子串出现次数、最小表示法……在 CTF 的 Misc 和逆向题中，SAM 经常用来做字符串匹配、密码分析、文本去重等任务。

很多人觉得 SAM 难，其实核心就两条：**endpos 等价类**和**后缀链接**。把这两个概念搞懂了，剩下的都是工程细节。

<!-- more -->

## 1. 为什么需要 SAM

先想一个朴素问题：给一个长度为 n 的字符串，统计它有多少个不同的子串。

最暴力的做法是枚举所有起点和终点，插入一个 set，O(n²) 个串，每个串 O(n) 比较，总 O(n³)。优化一下用哈希，O(n²)。

但如果 n 是 10⁵ 呢？O(n²) 直接 TLE。

SAM 的做法是：构造 SAM 本身 O(n)，构造完之后，**不同子串个数 = 所有状态的 (len[v] - len[link[v]]) 之和**。O(n) 构造，O(n) 统计。这就是 SAM 的威力。

## 2. endpos 等价类

定义：对于字符串 S 的一个子串 t，endpos(t) 表示 t 在 S 中所有出现位置的右端点集合。

举个例子，S = "abcabx"：

- 子串 "ab" 出现在位置 1 和 4，endpos = {1, 4}（0-indexed 的话是 {1, 4}）
- 子串 "b" 出现在位置 2 和 5，endpos = {2, 5}
- 子串 "bc" 出现在位置 3，endpos = {3}

关键观察：**如果两个子串的 endpos 相同，那么它们要么互为后缀关系，要么一个不出现另一个就不出现。** 换句话说，同一个 endpos 类里的所有子串，形成了一条从短到长的后缀链。

SAM 的每个状态代表一个 endpos 等价类。每个状态 v 记录：
- `len[v]`：这个类中最长的子串长度
- `link[v]`：后缀链接，指向另一个 endpos 类（代表更短的后缀）
- `next[v][c]`：转移，加一个字符 c 后跳到哪个状态

同一个状态 v 中，所有子串的长度范围是 (len[link[v]], len[v]]，且它们都是最长子串的后缀。所以这个状态代表的子串数量是 `len[v] - len[link[v]]`。

## 3. 构造过程：在线增量构造

SAM 的构造是**在线**的——逐个字符加入，每次加入后维护好自动机。

设当前已经有一个 SAM，现在要加字符 c。我们维护一个 `last` 指针，指向整个字符串对应的状态。

```
1. 创建新状态 cur，len[cur] = len[last] + 1
2. 从 last 开始沿后缀链接向上跳，
   对每个没有 c 转移的状态 p，设置 next[p][c] = cur
3. 找到第一个有 c 转移的状态 p，设 q = next[p][c]
4. 如果不存在这样的 p：
   - link[cur] = 根节点(0)，结束
5. 如果 len[q] == len[p] + 1：
   - link[cur] = q，结束
6. 否则需要拆分：
   - 创建 clone 状态 clone，复制 q 的转移和 link
   - len[clone] = len[p] + 1
   - 从 p 开始沿后缀链接，把所有指向 q 的 c 转移改为指向 clone
   - link[q] = clone，link[cur] = clone
7. last = cur
```

上面的第 6 步是 SAM 最 tricky 的部分。为什么要拆？因为 q 这个状态里混了两类子串：一类长度 ≤ len[p]+1，它们的 endpos 和 clone 一样；另一类长度 > len[p]+1，它们的 endpos 不同。拆分就是把这两类分开。

## 4. 完整实现（Python）

```python
class SAM:
    def __init__(self):
        self.len = [0]        # 每个状态的最长子串长度
        self.link = [-1]      # 后缀链接
        self.next = [{}]      # 转移表
        self.last = 0         # 当前末尾状态
    
    def extend(self, c):
        # c 是字符，可以是单个字符或整数
        cur = len(self.len)
        self.len.append(self.len[self.last] + 1)
        self.link.append(0)
        self.next.append({})
        self.cnt.append(1)   # 每个新状态至少出现一次
        
        p = self.last
        while p != -1 and c not in self.next[p]:
            self.next[p][c] = cur
            p = self.link[p]
        
        if p == -1:
            self.link[cur] = 0
        else:
            q = self.next[p][c]
            if self.len[p] + 1 == self.len[q]:
                self.link[cur] = q
            else:
                clone = len(self.len)
                self.len.append(self.len[p] + 1)
                self.link.append(self.link[q])
                self.next.append(self.next[q].copy())
                self.cnt.append(0)  # clone 不是新前缀，cnt 初始为 0
                
                while p != -1 and self.next[p].get(c, -1) == q:
                    self.next[p][c] = clone
                    p = self.link[p]
                self.link[q] = clone
                self.link[cur] = clone
        
        self.last = cur
    
    @classmethod
    def build(cls, s):
        sam = cls()
        for c in s:
            sam.extend(c)
        return sam
    
    def count_distinct_substrings(self):
        """不同子串个数"""
        total = 0
        for v in range(1, len(self.len)):
            total += self.len[v] - self.len[self.link[v]]
        return total
    
    def get_occurrence_count(self):
        """统计每个状态对应子串的出现次数"""
        # 按 len 降序排列
        order = sorted(range(len(self.len)), key=lambda x: -self.len[x])
        for v in order:
            if self.link[v] != -1:
                self.cnt[self.link[v]] += self.cnt[v]
        return self.cnt
```

## 5. CTF 实战：不同子串个数

最基础的应用。给一个超长字符串（比如题目里 dump 出来的一段日志或密文），问有多少个不同的子串。

```python
s = "ababa" * 100000
sam = SAM.build(s)
print(sam.count_distinct_substrings())
# 直接 O(n) 搞定，n=500000 也不会炸
```

## 6. CTF 实战：出现次数最多的子串

在密码分析题中，经常需要找出一段文本中出现频率最高的特定模式。SAM 可以帮你快速统计每个子串的出现次数。

```python
sam = SAM.build(text)
cnt = sam.get_occurrence_count()

# 找到出现次数最多的子串长度
max_occur = max(cnt)
# 遍历所有状态，找到对应长度的子串
for v in range(1, len(sam.len)):
    if cnt[v] == max_occur:
        length_range = (sam.len[sam.link[v]], sam.len[v]]
        print(f"状态 {v}: 长度 {length_range} 的子串出现 {max_occur} 次")
```

## 7. CTF 实战：子串匹配

给一个文本 T 和一个模式 P，判断 P 是否是 T 的子串。

```python
def match(sam, pattern):
    v = 0
    for c in pattern:
        if c not in sam.next[v]:
            return False
        v = sam.next[v][c]
    return True

sam = SAM.build("hello world")
print(match(sam, "world"))   # True
print(match(sam, "xyz"))     # False
```

这个方法 O(|P|)，比 KMP 还简单。而且 SAM 一旦建好，多次匹配都是 O(|P|)。

## 8. CTF 实战：最长公共子串

给两个字符串 A 和 B，求它们的最长公共子串。

```python
def longest_common_substring(a, b):
    sam = SAM.build(a)
    v = 0
    cur_len = 0
    best_len = 0
    
    for c in b:
        while v != 0 and c not in sam.next[v]:
            v = sam.link[v]
            cur_len = sam.len[v]
        if c in sam.next[v]:
            v = sam.next[v][c]
            cur_len += 1
        else:
            cur_len = 0
        best_len = max(best_len, cur_len)
    
    return best_len

print(longest_common_substring("abcde", "bcdef"))  # 3 ("bcd")
```

## 9. 复杂度分析

- **空间**：状态数 ≤ 2n - 1，转移数 ≤ 3n - 4。对 n=10⁶ 来说，大概 200 万个状态，Python 里用 dict 存转移可能会有点慢，C++ 数组就很轻松。
- **时间**：构造 O(n)，每个查询 O(|P|)。均摊线性。
- **常数**：Python 的 dict 转移常数偏大，如果题目卡常，可以考虑用数组代替 dict（把字符映射到 0~255）。

## 10. 常见坑

1. **clone 状态的 cnt 初始化为 0**。clone 不是新前缀，它的出现次数要从子节点累加。
2. **后缀链接跳的时候注意 -1**。根节点的 link 是 -1，循环终止条件是 `p == -1`。
3. **字符映射**。如果是任意字节，记得把字符映射到 0~255，用数组存转移会快很多。
4. **多测清空**。多组数据记得重新建 SAM，不要复用状态数组。

## 总结

SAM 是字符串处理的瑞士军刀。掌握了 endpos 等价类和后缀链接这两个核心概念，所有变种问题都能推导出来。在 CTF 中，它常用于：
- 超长文本的子串统计
- 密码分析中的频率统计
- 逆向题中的字符串匹配
- Misc 题中的文本去重和模式发现

写 SAM 的代码量不大，但调试起来容易出微妙的 bug。建议先在小例子上手动画一遍状态转移图，理解每一步在干什么，再写代码。
