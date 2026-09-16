---
title: 线段树详解—从单点修改到区间操作
date: 2026-09-16 22:00:00
categories: [CTF]
tags: [CTF, 算法, 数据结构]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg46.jpg
---

线段树是竞赛算法中最常用的数据结构之一。它把数组按区间分治组织，让单点修改、区间查询、区间修改都能在 O(log n) 时间完成。CTF 中的 Misc、逆向、甚至部分 Pwn 题都可能用到。

这篇文章从基础线段树讲起，到懒标记（Lazy Propagation）的区间修改，最后讲几个经典建模。

<!-- more -->

## 1. 为什么需要线段树

先想一个问题：给一个数组 a[1..n]，需要支持两种操作：
1. 修改某个元素 a[i] = v
2. 查询区间 [l, r] 的和

朴素做法：修改 O(1)，查询 O(n)。n=10^6 时查询太慢。

前缀和：修改 O(n)，查询 O(1)。修改太多又太慢。

线段树：修改 O(log n)，查询 O(log n)。两种操作都快。

## 2. 基础结构

线段树把数组组织成一棵完全二叉树。每个节点代表一个区间：

```
         [1, 8]
        /       \
    [1,4]       [5,8]
    /    \      /    \
 [1,2] [3,4] [5,6] [7,8]
 / \   / \   / \   / \
1  2  3  4  5  6  7  8
```

叶子节点是单个元素，内部节点是子区间的聚合值（和、最大值、最小值等）。

用数组存储：节点 i 的左儿子是 2i，右儿子是 2i+1。

## 3. 构建与查询

```python
class SegmentTree:
    def __init__(self, data):
        self.n = len(data)
        self.size = 1
        while self.size < self.n:
            self.size *= 2
        self.tree = [0] * (2 * self.size)
        
        # 填充叶子
        for i in range(self.n):
            self.tree[self.size + i] = data[i]
        # 构建内部节点
        for i in range(self.size - 1, 0, -1):
            self.tree[i] = self.tree[2*i] + self.tree[2*i+1]
    
    def query(self, l, r):
        """查询 [l, r) 的和"""
        l += self.size
        r += self.size
        result = 0
        while l < r:
            if l % 2 == 1:
                result += self.tree[l]
                l += 1
            if r % 2 == 1:
                r -= 1
                result += self.tree[r]
            l //= 2
            r //= 2
        return result
    
    def update(self, pos, val):
        """单点修改 a[pos] = val"""
        pos += self.size
        self.tree[pos] = val
        pos //= 2
        while pos >= 1:
            self.tree[pos] = self.tree[2*pos] + self.tree[2*pos+1]
            pos //= 2
```

## 4. 懒标记（Lazy Propagation）

上面的基础线段树只支持单点修改。如果要做区间修改（如把 [l, r] 所有元素加 v），朴素做法是逐点修改，O(n)。

懒标记的思路：**先不更新子节点，在当前节点上记一个"待传递"的标记。** 等到必须访问子节点时，再把标记往下传。

```python
class LazySegmentTree:
    def __init__(self, data):
        self.n = len(data)
        self.size = 1
        while self.size < self.n:
            self.size *= 2
        self.tree = [0] * (2 * self.size)
        self.lazy = [0] * (2 * self.size)
        
        for i in range(self.n):
            self.tree[self.size + i] = data[i]
        for i in range(self.size - 1, 0, -1):
            self.tree[i] = self.tree[2*i] + self.tree[2*i+1]
    
    def push_down(self, node, l, r):
        """把懒标记从 node 传到子节点"""
        if self.lazy[node] != 0:
            mid = (l + r) // 2
            left_len = mid - l + 1
            right_len = r - mid
            
            self.tree[2*node] += self.lazy[node] * left_len
            self.lazy[2*node] += self.lazy[node]
            
            self.tree[2*node+1] += self.lazy[node] * right_len
            self.lazy[2*node+1] += self.lazy[node]
            
            self.lazy[node] = 0
    
    def range_add(self, ql, qr, val, node=1, l=0, r=None):
        """区间 [ql, qr) 每个元素加 val"""
        if r is None:
            r = self.size
        if ql <= l and r <= qr:
            self.tree[node] += val * (r - l)
            self.lazy[node] += val
            return
        self.push_down(node, l, r)
        mid = (l + r) // 2
        if ql < mid:
            self.range_add(ql, qr, val, 2*node, l, mid)
        if qr > mid:
            self.range_add(ql, qr, val, 2*node+1, mid, r)
        self.tree[node] = self.tree[2*node] + self.tree[2*node+1]
    
    def range_query(self, ql, qr, node=1, l=0, r=None):
        if r is None:
            r = self.size
        if ql <= l and r <= qr:
            return self.tree[node]
        self.push_down(node, l, r)
        mid = (l + r) // 2
        result = 0
        if ql < mid:
            result += self.range_query(ql, qr, 2*node, l, mid)
        if qr > mid:
            result += self.range_query(ql, qr, 2*node+1, mid, r)
        return result
```

## 5. 经典应用

### 5.1 区间最大值

把节点的聚合函数从"求和"改成"取最大值"：

```python
# 构建
self.tree[i] = max(self.tree[2*i], self.tree[2*i+1])

# 查询：返回 max 而不是 sum
```

### 5.2 区间第 K 小（主席树）

主席树是可持久化线段树，支持查询任意区间第 K 小。CTF 中偶尔用到。

### 5.3 逆序对计数

用线段树统计逆序对：从左到右扫描数组，对每个元素 a[i]，查询已经出现过的比 a[i] 大的元素个数。

```python
count = 0
for i in range(n):
    count += seg_tree.query(a[i] + 1, MAX_VALUE)
    seg_tree.update(a[i], 1)
```

## 6. 常见坑

1. **数组大小**：线段树数组要开 4n，不是 2n。递归实现时尤其要注意。
2. **懒标记传递时机**：只有在需要访问子节点时才 push_down，不要每次都传。
3. **区间开闭**：注意 [l, r] 是闭区间还是半开区间，不同人写法不一样，别搞混了。
4. **离散化**：如果值域很大（如 10^9），先把所有要用到的值离散化到 1..m。

## 总结

线段树是竞赛算法的基本功。掌握了它，你就有了处理"区间查询 + 单点/区间修改"类问题的标准武器。关键理解：
1. **分治结构**：每个节点管一个区间
2. **懒标记**：延迟更新，摊还复杂度
3. **聚合函数**：和、最大值、最小值、GCD 都能套

写线段树的模板要烂熟于心，考场上 5 分钟就能敲出来。
