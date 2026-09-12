---
title: 大模型训练讲解—RLHF、DPO与分布式训练深度解析
date: 2026-09-12 22:00:00
categories: [AI, 大模型]
tags: [AI, 大模型, 对齐]
cover: /img/bg6.jpg
---

## 大模型训练的完整流程

训练一个大语言模型（LLM）不是简单的"喂数据、调参数"，而是一个多阶段的复杂工程。完整的训练流程包括：

1. **预训练（Pre-training）**：在海量文本上做自监督学习（下一个 token 预测），让模型学会语言知识和世界知识
2. **监督微调（SFT, Supervised Fine-Tuning）**：用高质量的"指令-回答"对微调，让模型学会遵循指令
3. **对齐（Alignment）**：用 RLHF（人类反馈强化学习）或 DPO（直接偏好优化）让模型的输出符合人类偏好
4. **安全对齐**：让模型拒绝有害请求，遵守安全规范
5. **推理优化**：量化、蒸馏、KV 缓存优化，让模型高效部署

本文重点讲解对齐阶段（RLHF、DPO）和分布式训练技术，这些是大模型训练中最复杂、最有技术含量的部分。

<!-- more -->

## 预训练基础

### 自监督学习

预训练的目标是让模型学会预测下一个 token。给定文本序列 $x_1, x_2, ..., x_n$，模型的目标是最大化：

$$
\mathcal{L} = -\sum_{i=1}^{n} \log P(x_i | x_1, ..., x_{i-1})
$$

这就是语言模型的最大似然估计（MLE）。模型通过预测下一个 token，隐式地学会了语法、语义、世界知识、推理能力。

### 预训练数据

预训练数据的质量和多样性决定了模型的能力上限。典型的预训练数据组成：

- **网页文本**：CommonCrawl 等（占比最大，但质量参差不齐，需要清洗）
- **书籍**：高质量长文本，培养推理和叙事能力
- **代码**：GitHub 代码，培养逻辑推理和代码能力
- **学术论文**：arXiv 等，培养专业知识
- **百科**：Wikipedia 等，培养事实知识
- **对话数据**：培养对话能力

数据清洗是预训练的关键步骤：
- 去重（精确去重 + 模糊去重）
- 质量过滤（用分类器过滤低质量文本）
- 有毒内容过滤
- 隐私信息去除（PII 脱敏）
- 语言识别和比例控制

### 预训练的挑战

1. **数据规模**：万亿 token 级别的数据，存储和处理都是挑战
2. **计算规模**：千亿参数模型需要数千张 GPU 训练数月
3. **稳定性**：大模型训练容易出现 loss 尖峰（loss spike），需要精心调参
4. **评估**：如何在训练过程中评估模型能力，避免过拟合或欠拟合

## 监督微调（SFT）

预训练模型虽然有强大的语言能力，但它只会"续写文本"，不会"回答问题"。SFT 的目标是让模型学会遵循指令，以对话的方式回答问题。

### SFT 数据

SFT 数据是"指令-回答"对：

```json
{
  "instruction": "解释什么是量子计算",
  "input": "",
  "output": "量子计算是一种利用量子力学原理..."
}
```

高质量 SFT 数据的特点：
- **多样性**：覆盖各种任务类型（问答、翻译、摘要、代码、推理、创意写作等）
- **高质量**：回答准确、格式规范、有帮助
- **难度梯度**：从简单到复杂，培养模型的逐步推理能力
- **一致性**：相似问题的回答风格一致

SFT 数据的来源：
- 人工标注（成本高但质量最好）
- 用强模型（GPT-4）生成（Self-Instruct、Evol-Instruct）
- 开源数据集（Alpaca、Vicuna、OpenAssistant、Orca）

### SFT 训练技巧

1. **学习率**：SFT 的学习率比预训练小一个数量级（通常 1e-5 到 2e-5）
2. **训练轮数**：2-3 轮，太多会过拟合
3. **损失掩码**：只计算回答部分的 loss，不计算指令部分的 loss（让模型专注于学习回答）
4. **打包训练**：把多个短样本打包成一个长序列，提高 GPU 利用率
5. **LoRA / QLoRA**：用参数高效微调，降低显存需求

## RLHF（人类反馈强化学习）

SFT 让模型学会了回答问题，但回答的质量（有帮助性、诚实性、无害性）还不够好。RLHF 的目标是用人类偏好来进一步对齐模型。

### RLHF 的三个阶段

#### 阶段 1：监督微调（SFT）

先用高质量的"指令-回答"对微调模型，得到 SFT 模型。这是 RLHF 的起点。

#### 阶段 2：训练奖励模型（RM, Reward Model）

收集人类偏好数据：对同一个问题，让模型生成多个回答，人类标注员排序（哪个更好）。用这些偏好数据训练一个奖励模型，输入是"问题+回答"，输出是一个标量分数（奖励）。

奖励模型的训练目标：对于一对回答（$y_w$ 更好，$y_l$ 更差），最大化：

$$
\mathcal{L}_{RM} = -\log \sigma(R(x, y_w) - R(x, y_l))
$$

其中 $R(x, y)$ 是奖励模型的分数，$\sigma$ 是 sigmoid 函数。这本质上是一个二分类问题：判断哪个回答更好。

奖励模型的特点：
- 通常和 SFT 模型同架构（去掉语言模型头，加一个标量输出头）
- 训练数据量：数万到数十万偏好对
- 奖励模型的质量直接决定 RLHF 的效果

#### 阶段 3：强化学习微调（PPO）

用 PPO（Proximal Policy Optimization）算法，以奖励模型为奖励信号，微调 SFT 模型。

PPO 的目标函数：

$$
\mathcal{L}_{PPO} = \mathbb{E}\left[\min(r_t(\theta)A_t, \text{clip}(r_t(\theta), 1-\epsilon, 1+\epsilon)A_t)\right]
$$

其中：
- $r_t(\theta) = \frac{\pi_\theta(y_t|x)}{\pi_{old}(y_t|x)}$ 是新旧策略的概率比
- $A_t$ 是优势函数（GAE，Generalized Advantage Estimation）
- $\epsilon$ 是裁剪范围（通常 0.2）

RLHF 的完整奖励函数：

$$
R(x, y) = R_{RM}(x, y) - \beta \cdot D_{KL}(\pi_\theta(y|x) \| \pi_{SFT}(y|x))
$$

- $R_{RM}$：奖励模型的分数
- $D_{KL}$：当前策略和 SFT 策略的 KL 散度，防止模型偏离 SFT 太远（避免奖励黑客 reward hacking）
- $\beta$：KL 惩罚系数

### RLHF 的挑战

1. **奖励黑客（Reward Hacking）**：模型可能找到利用奖励模型漏洞的方法，生成看起来得分高但实际质量差的回答。KL 惩罚可以缓解但不能完全解决。
2. **训练不稳定**：PPO 训练大模型容易不稳定，需要精心调参。
3. **成本高**：需要大量人类标注（偏好数据），PPO 训练计算成本高。
4. **评估难**：如何评估对齐效果，没有统一的客观指标。

### RLHF 的改进

- **RLAIF**：用 AI 反馈代替人类反馈，降低成本
- **Constitutional AI**：用一套"宪法"（原则）让模型自我批判和改进，不需要人类标注
- **Best-of-N**：生成 N 个回答，用奖励模型选最好的，不需要 PPO 训练
- **Rejection Sampling**：类似 Best-of-N，用拒绝采样微调

## DPO（直接偏好优化）

DPO 是 2023 年提出的 RLHF 替代方案，核心思想是：**不需要训练奖励模型，也不需要 PPO，直接用偏好数据优化语言模型**。

### DPO 的原理

RLHF 的目标是最大化奖励，而奖励模型和策略模型之间有复杂的关系。DPO 证明了：在一定条件下，RLHF 的最优解可以直接通过偏好数据的似然优化得到，不需要显式的奖励模型和 PPO。

DPO 的损失函数：

$$
\mathcal{L}_{DPO} = -\mathbb{E}\left[\log \sigma\left(\beta \log \frac{\pi_\theta(y_w|x)}{\pi_{ref}(y_w|x)} - \beta \log \frac{\pi_\theta(y_l|x)}{\pi_{ref}(y_l|x)}\right)\right]
$$

其中：
- $\pi_\theta$ 是当前策略（正在训练的模型）
- $\pi_{ref}$ 是参考策略（SFT 模型，冻结）
- $y_w$ 是更好的回答，$y_l$ 是更差的回答
- $\beta$ 是温度参数（控制偏离参考模型的程度）

直观理解：DPO 让模型增加好回答的概率，降低差回答的概率，同时用参考模型做正则化，防止偏离太远。

### DPO vs RLHF

| 特性 | RLHF | DPO |
|------|------|-----|
| 奖励模型 | 需要训练 | 不需要 |
| PPO 训练 | 需要 | 不需要 |
| 训练稳定性 | 不稳定 | 稳定（类似 SFT） |
| 计算成本 | 高 | 低（和 SFT 相当） |
| 实现复杂度 | 高 | 低 |
| 效果 | 好 | 相当（某些场景更好） |
| 可控性 | 高（奖励模型可调整） | 中（通过 β 控制） |

### DPO 的优势

1. **简单**：不需要奖励模型，不需要 PPO，实现和 SFT 一样简单
2. **稳定**：训练过程稳定，不会出现 PPO 的训练崩溃
3. **高效**：训练成本和 SFT 相当，比 RLHF 低一个数量级
4. **效果好**：在多个基准上达到或超过 RLHF 的效果

### DPO 的变体

- **IPO（Identity Policy Optimization）**：DPO 的改进，解决 DPO 的过拟合问题
- **KTO（Kahneman-Tversky Optimization）**：基于前景理论，用二元反馈（喜欢/不喜欢）而不是偏好对
- **ORPO**：把 SFT 和对齐合并成一个阶段
- **SimPO**：简化偏好优化，不需要参考模型

### DPO 实战

```python
from trl import DPOTrainer, DPOConfig
from datasets import Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer

# 加载模型和参考模型
model = AutoModelForCausalLM.from_pretrained("sft-model")
ref_model = AutoModelForCausalLM.from_pretrained("sft-model")  # 参考模型（SFT）
tokenizer = AutoTokenizer.from_pretrained("sft-model")

# 偏好数据格式
data = [
    {
        "prompt": "解释什么是量子计算",
        "chosen": "量子计算是一种利用量子力学原理...（详细准确的回答）",
        "rejected": "量子计算就是很快的计算。（简单模糊的回答）"
    },
    # ... 更多样本
]
dataset = Dataset.from_list(data)

# DPO 训练配置
training_args = DPOConfig(
    output_dir="./dpo-output",
    num_train_epochs=1,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,
    learning_rate=5e-7,        # DPO 的学习率比 SFT 小
    beta=0.1,                   # 温度参数
    bf16=True,
    gradient_checkpointing=True,
    logging_steps=10,
    save_strategy="epoch",
)

# 训练
trainer = DPOTrainer(
    model=model,
    ref_model=ref_model,
    args=training_args,
    train_dataset=dataset,
    tokenizer=tokenizer,
)

trainer.train()
trainer.save_model("./dpo-final")
```

## 分布式训练技术

大模型训练（无论是预训练还是微调）需要大量 GPU，分布式训练是必备技术。

### 数据并行（Data Parallelism）

最简单的并行方式：每个 GPU 都有完整的模型副本，每个 GPU 处理不同的数据批次，梯度通过 AllReduce 聚合。

- **DP（DataParallel）**：单机器多 GPU，PyTorch 原生支持
- **DDP（DistributedDataParallel）**：多机器多 GPU，比 DP 更高效
- **ZeRO（Zero Redundancy Optimizer）**：DeepSpeed 提出的优化，把模型参数、梯度、优化器状态分片到不同 GPU，减少显存占用

ZeRO 的三个阶段：
- **ZeRO-1**：分片优化器状态
- **ZeRO-2**：分片优化器状态 + 梯度
- **ZeRO-3**：分片优化器状态 + 梯度 + 模型参数

ZeRO-3 可以把显存需求降低 N 倍（N 是 GPU 数量），但通信开销更大。

### 张量并行（Tensor Parallelism）

把模型的每一层（矩阵乘法）拆分到多个 GPU。例如，一个 4096×4096 的矩阵乘法，可以拆成 4 个 4096×1024 的矩阵乘法，每个 GPU 算一部分。

- 适合单节点内的多 GPU（NVLink 高速互联）
- 通信开销大，不适合跨节点
- Megatron-LM 是张量并行的代表实现

### 流水线并行（Pipeline Parallelism）

把模型的不同层放到不同 GPU，数据像流水线一样流过各个 GPU。

- 适合超大模型（单节点放不下）
- 有"气泡"（bubble）问题：GPU 空闲等待
- GPipe、PipeDream 是流水线并行的代表

### 3D 并行

把数据并行、张量并行、流水线并行组合使用：

- **张量并行**：节点内（8 GPU）拆分一层
- **流水线并行**：跨节点拆分模型层
- **数据并行**：在剩余维度复制模型

例如，训练一个千亿参数模型，用 384 张 GPU：
- 张量并行：8（节点内）
- 流水线并行：6（6 个节点，每个节点 8 GPU）
- 数据并行：8（8 个流水线副本）
- 总计：8 × 6 × 8 = 384 GPU

### 分布式训练框架

- **DeepSpeed**：微软开发，支持 ZeRO、张量并行、流水线并行，易用性好
- **Megatron-LM**：NVIDIA 开发，性能最优，支持 3D 并行
- **FSDP（Fully Sharded Data Parallel）**：PyTorch 原生，类似 ZeRO-3
- **vLLM / TGI**：推理阶段的分布式框架

### 通信原语

分布式训练的核心是 GPU 间通信，常用的通信原语：

- **AllReduce**：所有 GPU 求和，结果广播到所有 GPU（数据并行的梯度聚合）
- **AllGather**：所有 GPU 收集数据，拼接后广播（ZeRO-3 的参数收集）
- **ReduceScatter**：求和后分片到各 GPU（ZeRO-2 的梯度分片）
- **P2P（Point-to-Point）**：两个 GPU 之间直接传输（张量并行）

通信效率是分布式训练性能的关键：
- **NVLink**：节点内 GPU 间高速互联（600GB/s）
- **InfiniBand**：节点间高速网络（400Gbps）
- **RDMA**：远程直接内存访问，绕过 CPU

## 训练稳定性与调优

### Loss Spike（损失尖峰）

大模型训练中经常出现 loss 突然飙升然后恢复的现象。原因和解决：

1. **学习率过大**：降低学习率，用 warmup
2. **数据问题**：某些批次数据异常（全是特殊字符），做好数据清洗
3. **梯度爆炸**：用梯度裁剪（gradient clipping）
4. **混合精度问题**：FP16 训练时梯度下溢/上溢，用 GradScaler 或 BF16

### 学习率调度

大模型训练常用的学习率调度：

1. **Warmup + Cosine Decay**：先线性 warmup 到峰值，然后余弦衰减到 0
2. **Warmup + Linear Decay**：先 warmup，然后线性衰减
3. **Warmup + Constant**：先 warmup，然后保持恒定

```python
from transformers import get_cosine_schedule_with_warmup

optimizer = AdamW(model.parameters(), lr=3e-4, betas=(0.9, 0.95), weight_decay=0.1)
scheduler = get_cosine_schedule_with_warmup(
    optimizer,
    num_warmup_steps=2000,
    num_training_steps=100000
)
```

### 混合精度训练

- **FP16**：半精度，速度快但容易溢出，需要 GradScaler
- **BF16**：bfloat16，指数位和 FP32 一样多，不容易溢出，不需要 GradScaler，是大模型训练的首选
- **FP8**：8 位浮点，训练速度更快，但需要特殊硬件（H100）

```python
# PyTorch BF16 训练
model = model.to(torch.bfloat16)
# 不需要 GradScaler
```

### 梯度累积

当显存不够大 batch 时，用梯度累积：多个小 batch 的梯度累积后再更新参数，等效于大 batch。

```python
accumulation_steps = 8

for i, batch in enumerate(dataloader):
    loss = model(**batch)
    loss = loss / accumulation_steps  # 归一化
    loss.backward()
    
    if (i + 1) % accumulation_steps == 0:
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad()
```

## 模型评估

大模型训练的评估是一个挑战，因为模型能力是多维度的。

### 客观基准

- **MMLU**：多任务语言理解（57 个学科）
- **GSM8K**：小学数学应用题
- **HumanEval**：代码生成
- **MATH**：数学竞赛题
- **TruthfulQA**：事实性（检测幻觉）
- **BBH**：Big-Bench Hard（困难推理任务）
- **MT-Bench**：多轮对话质量（GPT-4 评分）

### 人工评估

客观基准不能完全衡量模型能力，特别是对话质量、创意写作、有用性等。人工评估（Human Evaluation）是金标准：
- 双盲对比（A/B 测试）
- 多维度评分（有用性、诚实性、无害性、格式、语言）
- 标注员一致性（Kappa 系数）

### 自动评估

- **LLM-as-Judge**：用 GPT-4 等强模型评分，成本低但有偏差
- **奖励模型评分**：用训练好的奖励模型打分
- **基于参考的指标**：BLEU、ROUGE、BERTScore（适合翻译、摘要）

## 大模型训练的成本

### 预训练成本

| 模型大小 | GPU 数量 | 训练时间 | 估算成本（A100 云服务） |
|----------|----------|----------|------------------------|
| 7B | 64 | 1 周 | ~$50K |
| 13B | 128 | 2 周 | ~$200K |
| 70B | 512 | 1 月 | ~$2M |
| 175B | 1024 | 2 月 | ~$10M |

### 微调成本

- **SFT（7B，LoRA）**：1 张 A100，几小时，~$10
- **SFT（70B，全参数）**：8 张 A100，1 天，~$500
- **DPO（7B）**：1-2 张 A100，几小时，~$20
- **RLHF（7B）**：4-8 张 A100，1 天，~$300

## 总结

大模型训练是一个系统工程，从预训练到 SFT 到对齐（RLHF/DPO），每个阶段都有独特的技术挑战。核心要点：

1. **预训练**：数据是关键，清洗和质量决定模型上限
2. **SFT**：高质量的指令数据让模型学会遵循指令
3. **RLHF**：用人类偏好对齐模型，但成本高、训练不稳定
4. **DPO**：RLHF 的简化替代，简单、稳定、高效，正在成为主流
5. **分布式训练**：3D 并行（数据+张量+流水线）是训练大模型的必备技术
6. **训练稳定性**：loss spike、学习率调度、混合精度是关键调优点
7. **评估**：客观基准 + 人工评估 + LLM-as-Judge 多维度评估

大模型训练技术在快速演进，新的对齐方法（DPO 变体、在线 RLHF、多智能体对齐）、新的训练效率技术（FP8、推测解码训练、课程学习）不断涌现。保持对最新研究的关注，是这个领域从业者的必修课。
