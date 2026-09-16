---
title: 后缀数组(SA)详解—从倍增法到 LCP 应用
date: 2026-09-16 23:00:00
categories: [CTF]
tags: [CTF, 算法, 字符串]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg48.jpg
---

后缀数组（Suffix Array, SA）是字符串处理的另一大杀器。和 SAM 相比，SA 写起来简单一些，功能也覆盖了大部分字符串问题：不同子串个数、最长公共子串、出现次数统计、模式匹配。

这篇文章讲倍增法构造 SA，以及 LCP 数组的应用。

<!-- more -->

## 1. 什么是后缀数组

对字符串 S，后缀数组 SA[i] 表示"排名第 i 的后缀的起始位置"。

比如 S = "ababa"：
- 后缀 0: ababa
- 后缀 1: baba
- 后缀 2: aba
- 后缀 3: ba
- 后缀 4: a

按字典序排序：
- a (后缀4)
- aba (后缀2)
- ababa (后缀0)
- ba (后缀3)
- baba (后缀1)

所以 SA = [4, 2, 0, 3, 1]。

## 2. 倍增法构造

### 原理

直接排序所有后缀 O(n² log n) 太慢。倍增法利用"长度为 2^k 的前缀排序结果"来加速。

1. 先按首字符排序（长度 1）
2. 然后按长度 2 排序：每个后缀的前两个字符 = 首字符 + 第二个字符
3. 然后按长度 4 排序：前四个字符 = 前两个字符 + 接下来两个字符
4. ...每次翻倍，直到 2^k ≥ n

关键：第 k 轮排序时，每个后缀的"关键字"是一个二元组 (rank[i], rank[i+2^(k-1)])。这个二元组的比较可以直接用之前的 rank 数组，不需要真正比较字符串。

### 实现

```python
def build_sa(s):
    n = len(s)
    sa = list(range(n))
    rank = [ord(c) for c in s]
    k = 1
    
    while k < n:
        # 按 (rank[i], rank[i+k]) 排序
        sa.sort(key=lambda i: (rank[i], rank[i+k] if i+k < n else -1))
        
        new_rank = [0] * n
        new_rank[sa[0]] = 0
        for i in range(1, n):
            prev, curr = sa[i-1], sa[i]
            prev_key = (rank[prev], rank[prev+k] if prev+k < n else -1)
            curr_key = (rank[curr], rank[curr+k] if curr+k < n else -1)
            new_rank[curr] = new_rank[prev] + (1 if prev_key != curr_key else 0)
        
        rank = new_rank
        if rank[sa[-1]] == n - 1:
            break  # 全部不同了，提前结束
        k *= 2
    
    return sa
```

## 3. LCP 数组

LCP（Longest Common Prefix）数组记录"排名相邻的两个后缀的最长公共前缀长度"。

```
LCP[i] = lcp(sa[i], sa[i+1])
```

### 用 Kasai 算法 O(n) 求 LCP

```python
def build_lcp(s, sa):
    n = len(s)
    rank = [0] * n
    for i in range(n):
        rank[sa[i]] = i
    
    lcp = [0] * (n - 1)
    h = 0
    for i in range(n):
        if rank[i] > 0:
            j = sa[rank[i] - 1]
            while i + h < n and j + h < n and s[i + h] == s[j + h]:
                h += 1
            lcp[rank[i] - 1] = h
            if h > 0:
                h -= 1
    return lcp
```

## 4. 经典应用

### 4.1 不同子串个数

```
答案 = n*(n+1)/2 - sum(LCP)
```

所有子串总数 = n*(n+1)/2，减去重复的部分（LCP 数组的和）。

### 4.2 最长重复子串

LCP 数组的最大值就是最长重复子串的长度。

```python
max_lcp = max(lcp)
position = sa[lcp.index(max_lcp)]
print(s[position:position+max_lcp])
```

### 4.3 出现次数最多的子串

对每个 i，如果 LCP[i] ≥ L，说明 sa[i] 和 sa[i+1] 的公共前缀长度 ≥ L。用单调栈求 LCP 的"最大矩形"，就能找到每个子串的最大出现次数。

### 4.4 模式匹配

给一个模式 P，在 S 中找 P 出现的位置。用二分查找在 SA 中定位：

```python
def find_pattern(s, sa, pattern):
    import bisect
    n = len(s)
    m = len(pattern)
    
    # 二分找左边界
    lo, hi = 0, n - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if s[sa[mid]:sa[mid]+m] >= pattern:
            hi = mid
        else:
            lo = mid + 1
    
    if s[sa[lo]:sa[lo]+m] != pattern:
        return -1
    return sa[lo]
```

## 5. SA vs SAM

| 对比项 | 后缀数组 SA | 后缀自动机 SAM |
|--------|-----------|---------------|
| 构造时间 | O(n log n) | O(n) |
| 空间 | O(n) | O(n) |
| 不同子串 | O(n) 统计 | O(n) 统计 |
| 最长重复子串 | LCP 最大值 | 状态 maxlen |
| 模式匹配 | O(m log n) | O(m) |
| 实现难度 | 简单 | 中等 |
| 可扩展性 | 较弱 | 强 |

## 6. 常见坑

1. **字符映射**：如果字符不是小写字母，先映射到 0~n-1
2. **rank 越界**：i+k ≥ n 时第二个关键字设为 -1（比任何字符都小）
3. **提前终止**：当所有 rank 都不同时，可以提前结束倍增
4. **LCP 长度**：LCP 数组长度是 n-1，别越界

## 总结

后缀数组是字符串处理的基础工具。和 SAM 二选一就行，两者功能重叠度很高。SA 写起来更直观，SAM 功能更强。建议先学 SA 理解后缀排序的思想，再学 SAM 理解 endpos 等价类。
