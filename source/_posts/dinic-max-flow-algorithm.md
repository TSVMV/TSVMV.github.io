---
title: Dinic 网络流算法详解—从原理到竞赛实战
date: 2026-09-16 20:00:00
categories: [CTF]
tags: [CTF, 算法, 图论]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg43.jpg
---

网络流是图论中最实用的算法之一。最大流最小割定理把"求最大流"和"求最小割"等价起来，于是大量看似和流没关系的问题——二分图匹配、边连通度、选边方案、拆点建模——都能套上网络流的框架。

Dinic 算法是实际竞赛中最高效的最大流算法，复杂度 O(V²E)，在实际图中远快于理论上界。这篇文章把 Dinic 的原理讲透，然后落地到建模套路。

<!-- more -->

## 1. 流网络的基本概念

一个流网络是一个有向图 G=(V,E)，每条边有容量 c(u,v)，有一个源点 s 和汇点 t。

**流 f** 满足三个条件：
1. **容量限制**：0 ≤ f(u,v) ≤ c(u,v)
2. **流量守恒**：除 s 和 t 外，所有点的流入量 = 流出量
3. **斜对称性**：f(u,v) = -f(v,u)

**残量网络**：对每条边 (u,v)，残量 r(u,v) = c(u,v) - f(u,v)。残量网络中还可以有反向边 r(v,u) = f(u,v)——这允许"反悔"。

**增广路**：残量网络中从 s 到 t 的路径。找到一条增广路，把路上的最小残量加上去，就得到了新的流。Ford-Fulkerson 方法就是反复找增广路，直到找不到为止。

## 2. Dinic 算法的两个核心

Dinic 比朴素 Ford-Fulkerson 快，靠两个优化：

### 2.1 BFS 分层（Level Graph）

先 BFS 残量网络，只走残量 > 0 的边，给每个点标上距离 s 的层数。只有从第 i 层到第 i+1 层的边才允许在下一步 DFS 中使用。

这样做的好处：DFS 只会沿着"更靠近 t"的方向走，不会走回头路。

### 2.2 DFS 阻塞流（Blocking Flow）

在分层图上做 DFS，一次把所有能走的增广路都走完，而不是只走一条。这叫"阻塞流"。

每轮 BFS 分层 + DFS 阻塞流后，s 到 t 的最短距离严格增加。最多 V 轮，每轮 DFS 总 O(VE)，所以总 O(V²E)。

## 3. 完整实现

```python
from collections import deque

class Dinic:
    def __init__(self, n):
        self.n = n
        self.graph = [[] for _ in range(n)]  # 邻接表
    
    def add_edge(self, u, v, cap):
        """加边 u->v 容量 cap，同时加反向边 0"""
        self.graph[u].append([v, cap, len(self.graph[v])])
        self.graph[v].append([u, 0, len(self.graph[u]) - 1])
    
    def bfs(self, s, t, level):
        """构建分层图，返回 t 是否可达"""
        for i in range(len(level)):
            level[i] = -1
        level[s] = 0
        q = deque([s])
        while q:
            u = q.popleft()
            for v, cap, rev in self.graph[u]:
                if cap > 0 and level[v] < 0:
                    level[v] = level[u] + 1
                    q.append(v)
        return level[t] >= 0
    
    def dfs(self, u, t, flow, level, iter_ptr):
        if u == t:
            return flow
        while iter_ptr[u] < len(self.graph[u]):
            edge = self.graph[u][iter_ptr[u]]
            v, cap, rev = edge
            if cap > 0 and level[u] < level[v]:
                pushed = self.dfs(v, t, min(flow, cap), level, iter_ptr)
                if pushed > 0:
                    edge[1] -= pushed           # 正向边减
                    self.graph[v][rev][1] += pushed  # 反向边加
                    return pushed
            iter_ptr[u] += 1
        return 0
    
    def max_flow(self, s, t):
        flow = 0
        level = [-1] * self.n
        while self.bfs(s, t, level):
            iter_ptr = [0] * self.n
            while True:
                pushed = self.dfs(s, t, float('inf'), level, iter_ptr)
                if pushed == 0:
                    break
                flow += pushed
            level = [-1] * self.n
        return flow
```

## 4. 最小割

最大流 = 最小割（Max-Flow Min-Cut Theorem）。

最小割是把点集分成 S（含 s）和 T（含 t），使得从 S 到 T 的所有边的容量之和最小。

求最小割的边：跑完最大流后，在残量网络中从 s 做 BFS，所有能到达的点属于 S。跨 S-T 的原始边就是割边。

```python
def min_cut(self, s, t):
    self.max_flow(s, t)
    visited = [False] * self.n
    q = deque([s])
    visited[s] = True
    while q:
        u = q.popleft()
        for v, cap, rev in self.graph[u]:
            if cap > 0 and not visited[v]:
                visited[v] = True
                q.append(v)
    cut_edges = []
    for u in range(self.n):
        if visited[u]:
            for v, cap, rev in self.graph[u]:
                if not visited[v]:
                    cut_edges.append((u, v))
    return cut_edges
```

## 5. 建模套路一：二分图最大匹配

二分图最大匹配等价于最大流：
- 源点 s 连到左边所有点，容量 1
- 左边点连到右边匹配点，容量 1
- 右边所有点连到汇点 t，容量 1
- 最大流 = 最大匹配数

```python
# 左边 n 个点，右边 m 个点，s=0，t=n+m+1
dinic = Dinic(n + m + 2)
for i in range(n):
    dinic.add_edge(0, i + 1, 1)        # s -> 左边
for j in range(m):
    dinic.add_edge(n + 1 + j, n + m + 1, 1)  # 右边 -> t
for u, v in edges:
    dinic.add_edge(u + 1, n + 1 + v, 1)  # 左边 -> 右边
print(dinic.max_flow(0, n + m + 1))
```

## 6. 建模套路二：最大权闭合子图

选一些点，每个点有权值（正或负），要求选了一个点就必须选它依赖的点。求最大权值和。

建图：
- 正权点连 s，容量 = 权值
- 负权点连 t，容量 = -权值
- 依赖关系 u->v，容量 = INF
- 答案 = 所有正权之和 - 最小割

## 7. 建模套路三：边连通度

无向图中，最少删多少条边让 s 和 t 不连通？

把每条无向边拆成两个方向的有向边，容量都是 1，然后跑 s 到 t 的最大流。答案就是最大流。

## 8. 常用优化

### 8.1 当前弧优化（Current Arc）

上面实现中的 `iter_ptr` 就是当前弧优化。它记录每个点下一次该试哪条边，避免重复试已经走不通的边。这是 Dinic 能跑得飞快的关键。

### 8.2 容量缩放

对大图，可以用 capacity scaling：先只考虑容量 ≥ Δ 的边，跑完最大流后把 Δ 减半。这样可以减少无效搜索。

### 8.3 ISAP 优化

ISAP 是 Dinic 的变种，只做一次 BFS，之后用 gap 优化动态修改层数。在某些图上比 Dinic 快 2-3 倍。

## 9. 复杂度参考

| 图类型 | Dinic 实际运行 |
|--------|---------------|
| 二分图匹配（V=10⁴, E=10⁵） | < 0.1s |
| 一般图（V=10⁴, E=10⁵） | 0.2-0.5s |
| 稠密图（V=10³, E=10⁵） | 1-2s |
| 网格图（V=10⁵, E=4×10⁵） | 1-3s |

Python 版本比 C++ 慢 10-50 倍，大规模图建议用 C++ 或 pypy。

## 总结

Dinic 是网络流的标配算法。掌握它的关键是理解三个东西：
1. **残量网络**（为什么要有反向边）
2. **BFS 分层**（为什么要按层走）
3. **当前弧优化**（为什么不会重复试已经废的边）

建模比算法本身更重要。看到问题先想：能不能转化成选点/选边/匹配/连通问题？能的话就往网络流上靠。
