---
title: 大模型推理讲解—量化、KV缓存与推理加速技术深度解析
date: 2026-09-12 17:00:00
categories: [AI, 大模型]
tags: [AI, 大模型, 推理优化]
cover: /img/bg11.jpg
---

## 大模型推理的挑战

大语言模型（LLM）的推理和训练是两个完全不同的问题。训练关注的是吞吐量（throughput）——在固定时间内处理尽可能多的数据；而推理关注的是**延迟（latency）和吞吐量的平衡**——既要让单个用户等待时间短，又要在单位时间内服务尽可能多的用户。

大模型推理的核心挑战：

1. **内存墙**：模型参数巨大（7B 模型 FP16 需要 14GB 显存），参数加载和读取是瓶颈
2. **KV 缓存爆炸**：自回归生成时，每生成一个 token 都要缓存 Key 和 Value，长上下文下 KV 缓存占用巨大
3. **解码速度慢**：自回归生成是串行的，每个 token 都要等前一个 token 生成完
4. **显存碎片化**：多用户并发时，KV 缓存的分配和释放导致显存碎片化
5. **批处理效率低**：不同请求的输入输出长度差异大，静态批处理效率低

理解这些挑战，才能理解各种推理优化技术为什么存在。

<!-- more -->

## 模型量化

量化是降低模型推理内存和计算需求的最有效手段。核心思想：用更低精度的数值表示（如 INT8、INT4）代替 FP16/FP32，牺牲少量精度换取大幅的内存减少和速度提升。

### 量化基础

| 精度 | 每参数字节数 | 7B 模型显存 | 相对精度 |
|------|-------------|-------------|----------|
| FP32 | 4 | 28 GB | 100% |
| FP16/BF16 | 2 | 14 GB | ~99.9% |
| INT8 | 1 | 7 GB | ~99% |
| INT4 | 0.5 | 3.5 GB | ~95-98% |
| INT3 | 0.375 | 2.6 GB | ~90-95% |

### 量化方法分类

#### 1. 按量化时机分

- **PTQ（Post-Training Quantization，训练后量化）**：在已训练好的模型上直接量化，不需要重新训练，速度快，是最常用的方法
- **QAT（Quantization-Aware Training，量化感知训练）**：在训练过程中模拟量化误差，微调模型适应量化，精度更高但成本高
- **GPTQ / AWQ**：介于 PTQ 和 QAT 之间的方法，用少量校准数据优化量化参数，精度接近 QAT 但成本低很多

#### 2. 按量化粒度分

- **逐张量（Per-tensor）**：整个张量用一组缩放因子，最简单但精度损失大
- **逐通道（Per-channel）**：每个输出通道用一组缩放因子，精度更好
- **逐组（Per-group）**：把通道分成组，每组用一组缩放因子，精度和显存的平衡（GPTQ/AWQ 常用 128 组大小）

#### 3. 按量化方案分

- **对称量化**：零点为 0，`real = scale × quant`，适合以 0 为中心分布的权重
- **非对称量化**：有零点，`real = scale × (quant - zero_point)`，适合有偏置的激活值

### GPTQ 量化原理

GPTQ 是目前最流行的 INT4 量化方法，由 IST Austria 于 2022 年提出。核心思想：**逐列量化权重，同时最小化量化误差**。

算法流程：
1. 按列处理权重矩阵 W（d × d）
2. 对第 i 列，计算量化后的误差
3. 把误差传播到后续未量化的列（Hessian 逆矩阵加权）
4. 这样量化完所有列后，整体输出误差最小

关键技术：
- **Hessian 矩阵**：用二阶信息（Hessian）衡量每个权重的重要性，重要的权重分配更多量化精度
- **逐列更新**：量化一列后，把误差传播到后续列，避免误差累积
- **分组量化**：按 128 个通道一组，每组独立量化，平衡精度和显存

GPTQ 的优势：
- 只需要少量校准数据（128-512 个样本）
- 量化速度快（7B 模型几分钟）
- INT4 精度损失很小（困惑度增加 <5%）
- 推理速度快（INT4 计算比 FP16 快 2-3 倍）

### AWQ 量化原理

AWQ（Activation-aware Weight Quantization）由 MIT 于 2023 年提出。核心观察：**不是所有权重都同等重要，1% 的显著权重（salient weights）对输出影响最大，保护这些权重不被量化可以大幅减少精度损失**。

AWQ 的方法：
1. 分析激活值，找出对输出影响最大的权重通道
2. 对这些显著通道的权重用更高精度（或不量化）
3. 其他通道正常量化
4. 通过逐通道缩放（per-channel scaling）来平衡

AWQ vs GPTQ：
- AWQ 通常在相同位宽下精度略好
- GPTQ 量化速度更快
- 两者都支持 INT4，推理框架（vLLM、Text Generation Inference）都支持

### 量化实战

```bash
# 用 AutoGPTQ 量化模型
pip install auto-gptq

python -c "
from transformers import AutoModelForCausalLM, AutoTokenizer
from auto_gptq import AutoGPTQForCausalLM, BaseQuantizeConfig
import numpy as np

model_name = 'Qwen/Qwen2.5-7B-Instruct'
quantize_config = BaseQuantizeConfig(
    bits=4,                    # 4bit 量化
    group_size=128,            # 分组大小
    desc_act=False,            # 是否按激活值排序（desc_act=True 精度更好但慢）
    model_file_base_name='model'
)

# 加载模型
model = AutoGPTQForCausalLM.from_pretrained(
    model_name,
    quantize_config=quantize_config,
    trust_remote_code=True
)

# 校准数据（128 个样本）
examples = [
    tokenizer('请解释什么是深度学习。', return_tensors='pt'),
    # ... 更多样本
]

# 量化
model.quantize(examples)

# 保存
model.save_quantized('./qwen-7b-gptq-4bit')
tokenizer.save_pretrained('./qwen-7b-gptq-4bit')
"

# 用 AWQ 量化
pip install autoawq

python -c "
from awq import AutoAWQForCausalLM
from transformers import AutoTokenizer

model_path = 'Qwen/Qwen2.5-7B-Instruct'
quant_config = { 'zero_point': True, 'q_group_size': 128, 'w_bit': 4, 'version': 'GEMM' }

model = AutoAWQForCausalLM.from_pretrained(model_path)
tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)

model.quantize(tokenizer, quant_config=quant_config)
model.save_quantized('./qwen-7b-awq-4bit')
tokenizer.save_pretrained('./qwen-7b-awq-4bit')
"
```

### 量化的注意事项

1. **量化不是万能的**：INT4 对某些任务（如精确计算、代码生成）可能有明显精度损失
2. **校准数据很重要**：校准数据应该和实际使用场景的数据分布一致
3. **推理框架支持**：不是所有框架都支持所有量化格式，部署前确认
4. **量化+推理加速**：量化后的模型需要用支持量化的推理框架（vLLM、TensorRT-LLM）才能获得速度提升，普通 transformers 加载量化模型可能反而更慢

## KV 缓存优化

### KV 缓存是什么

自回归生成时，每个 token 的生成需要用到之前所有 token 的 Key 和 Value（注意力机制）。如果每次都重新计算，复杂度是 O(n²)。KV 缓存把之前计算好的 K 和 V 保存下来，新 token 只需要计算自己的 K 和 V，然后和缓存的 K、V 做注意力，复杂度降到 O(n)。

KV 缓存的大小：
```
KV 缓存大小 = 2 × 层数 × 头数 × 头维度 × 序列长度 × 精度字节数
```

以 LLaMA-7B 为例（32 层，32 头，128 头维度，FP16）：
```
每 token KV 缓存 = 2 × 32 × 32 × 128 × 2 = 524,288 字节 = 512 KB
4096 上下文 = 512 KB × 4096 = 2 GB
```

长上下文下，KV 缓存甚至比模型参数还大。

### PagedAttention（vLLM 的核心创新）

vLLM 提出的 PagedAttention 是目前 KV 缓存管理的最优方案，灵感来自操作系统的虚拟内存分页。

传统 KV 缓存的问题：
- 每个请求的 KV 缓存是连续的大块内存
- 请求结束后释放，导致显存碎片化
- 不同请求的输入输出长度差异大，预分配的显存大部分被浪费
- 显存利用率通常只有 20-40%

PagedAttention 的方案：
- 把 KV 缓存分成固定大小的块（block，通常 16 个 token）
- 每个请求的 KV 缓存由一个块表（block table）映射到物理块
- 物理块可以不连续，类似虚拟内存的页表
- 请求结束后，物理块可以被其他请求复用
- 显存利用率提升到 90%+

PagedAttention 的优势：
- 几乎消除显存碎片化
- 支持高效的批处理（不同长度的请求可以一起处理）
- 支持前缀共享（多个请求共享相同前缀的 KV 缓存，如系统提示词）
- 支持 Beam Search 和并行采样

### KV 缓存量化

KV 缓存也可以量化，进一步减少显存占用：

- **FP8 KV 缓存**：用 FP8 代替 FP16，KV 缓存减半，精度损失很小
- **INT8 KV 缓存**：INT8 量化，KV 缓存减半
- **KV 缓存驱逐**：对长上下文，驱逐不重要的 KV（如 H2O、StreamingLLM）

```python
# vLLM 中启用 FP8 KV 缓存
from vllm import LLM, SamplingParams

llm = LLM(
    model="Qwen/Qwen2.5-7B-Instruct",
    kv_cache_dtype="fp8",  # FP8 KV 缓存
    max_model_len=8192,
    gpu_memory_utilization=0.9,
)
```

### 前缀缓存（Prefix Caching）

多个请求共享相同的前缀（如系统提示词、few-shot 示例）时，前缀的 KV 缓存可以在请求间共享，避免重复计算：

```python
# vLLM 启用前缀缓存
llm = LLM(
    model="Qwen/Qwen2.5-7B-Instruct",
    enable_prefix_caching=True,
)
```

这在多轮对话和 RAG 场景中特别有效——系统提示词和检索到的文档是相同的，只需要计算一次 KV 缓存。

## 推理加速框架

### vLLM

vLLM 是目前最流行的大模型推理框架，由 UC Berkeley 开发。核心优势：

1. **PagedAttention**：高效的 KV 缓存管理
2. **连续批处理（Continuous Batching）**：请求完成后立即加入新请求，不需要等整个批次完成
3. **前缀缓存**：共享前缀的 KV 缓存
4. **多 GPU 支持**：Tensor Parallel、Pipeline Parallel
5. **量化支持**：GPTQ、AWQ、FP8、INT8
6. **OpenAI 兼容 API**：一行命令启动 API 服务

```bash
# 启动 vLLM API 服务
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-7B-Instruct \
    --served-model-name qwen-7b \
    --host 0.0.0.0 \
    --port 8000 \
    --tensor-parallel-size 1 \
    --gpu-memory-utilization 0.9 \
    --max-model-len 8192 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8

# 测试
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-7b",
    "messages": [{"role": "user", "content": "你好"}],
    "max_tokens": 100
  }'
```

### TensorRT-LLM

NVIDIA 官方的推理优化框架，针对 NVIDIA GPU 深度优化：

- **TensorRT 优化**：算子融合、内核自动调优
- **In-flight Batching**：类似 vLLM 的连续批处理
- **KV 缓存量化**：FP8、INT8
- **Speculative Decoding**：投机解码（小模型草稿，大模型验证）
- **多 GPU 支持**：Tensor Parallel、Pipeline Parallel
- **性能最强**：在 NVIDIA GPU 上通常比 vLLM 快 20-50%

```bash
# 构建 TensorRT-LLM 引擎
python build.py \
    --model_dir Qwen/Qwen2.5-7B-Instruct \
    --output_dir ./trt_engines/qwen-7b \
    --dtype float16 \
    --use_gpt_attention_plugin float16 \
    --use_gemm_plugin float16 \
    --max_batch_size 64 \
    --max_input_len 4096 \
    --max_output_len 2048

# 启动 API
python3 scripts/serve.py \
    --engine_dir ./trt_engines/qwen-7b \
    --host 0.0.0.0 \
    --port 8000
```

### Text Generation Inference (TGI)

HuggingFace 官方的推理框架，特点：

- 与 HuggingFace 生态深度集成
- 支持 Flash Attention、PagedAttention
- 支持连续批处理
- 支持量化（GPTQ、AWQ、bitsandbytes）
- OpenAI 兼容 API

```bash
docker run -p 8080:80 -v $PWD/data:/data \
    ghcr.io/huggingface/text-generation-inference:latest \
    --model-id Qwen/Qwen2.5-7B-Instruct \
    --max-input-length 4096 \
    --max-total-tokens 6144 \
    --max-batch-prefill-tokens 4096
```

### 框架对比

| 特性 | vLLM | TensorRT-LLM | TGI |
|------|------|--------------|-----|
| 易用性 | 高 | 中（需构建引擎） | 高 |
| 性能 | 高 | 最高 | 高 |
| 量化支持 | GPTQ/AWQ/FP8 | FP8/INT8/FP4 | GPTQ/AWQ/bnb |
| 多 GPU | TP/PP | TP/PP | TP |
| 社区 | 最大 | NVIDIA 官方 | HF 官方 |
| 适用场景 | 通用 | 极致性能 | HF 生态 |

## 高级推理技术

### 1. 投机解码（Speculative Decoding）

自回归生成的瓶颈是解码速度——每个 token 都要等大模型前向传播一次。投机解码用一个小模型（草稿模型）快速生成多个候选 token，然后用大模型一次验证所有候选 token。

流程：
1. 小模型（如 0.5B）自回归生成 K 个候选 token（草稿）
2. 大模型一次前向传播，验证这 K 个 token
3. 接受正确的 token，从第一个错误的 token 开始重新生成
4. 平均接受率 70-80%，速度提升 2-3 倍

```python
# vLLM 启用投机解码
llm = LLM(
    model="Qwen/Qwen2.5-7B-Instruct",
    speculative_model="Qwen/Qwen2.5-0.5B-Instruct",
    num_speculative_tokens=5,
)
```

### 2.  Medusa 解码

Medusa 是投机解码的改进，不需要额外的小模型，而是在大模型上添加几个"Medusa 头"，每个头预测未来的多个 token。训练简单，推理速度提升 2 倍左右。

### 3. 连续批处理（Continuous Batching）

传统批处理：等批次中所有请求都完成后，才处理下一批。如果一个请求输出很长，其他请求都要等。

连续批处理：每个 token 生成后，检查是否有请求完成，完成的请求立即移出，新请求立即加入。GPU 利用率从 40-50% 提升到 80-90%。

### 4. Chunked Prefill

预填充（prefill）阶段处理长输入时，会占用大量 GPU 计算时间，导致解码阶段的请求被阻塞。Chunked Prefill 把长输入分成多个块，和解码请求交替处理，平衡预填充和解码的延迟。

```python
# vLLM 启用 Chunked Prefill
llm = LLM(
    model="Qwen/Qwen2.5-7B-Instruct",
    enable_chunked_prefill=True,
    max_num_batched_tokens=8192,
)
```

### 5. Flash Attention

Flash Attention 是注意力机制的高效实现，通过分块计算和减少 HBM 访问，把注意力的复杂度从 O(n²) 内存访问降到 O(n² / M)（M 是 SRAM 大小），速度提升 2-4 倍，显存减少 2-3 倍。

```python
# vLLM 默认启用 Flash Attention
# transformers 中启用
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-7B-Instruct",
    attn_implementation="flash_attention_2",
    torch_dtype=torch.bfloat16,
)
```

## 部署架构

### 单 GPU 部署

```
用户 → 负载均衡（Nginx）→ vLLM API 服务（单 GPU）
```

适合：7B 以下模型，QPS 不高（<10）。

### 多 GPU 张量并行

```
用户 → 负载均衡 → vLLM（Tensor Parallel = 2/4/8 GPU）
```

张量并行把模型的每层拆分到多个 GPU，每个 GPU 只存一部分参数。适合：13B-70B 模型，单 GPU 显存不够。

### 多实例负载均衡

```
用户 → 负载均衡 → vLLM 实例 1（GPU 0）
                → vLLM 实例 2（GPU 1）
                → vLLM 实例 3（GPU 2）
```

每个实例独立运行完整模型，负载均衡分发请求。适合：高并发场景，QPS 高。

### 模型路由（多模型服务）

```
用户 → 模型路由器 → 7B 模型池（3 个实例）
                  → 70B 模型池（2 个实例，TP=4）
                  → 嵌入模型池（2 个实例）
```

根据请求的模型名路由到对应的模型池。适合：SaaS 服务，同时提供多个模型。

## 成本优化

### 1. 选择合适的模型大小

- 简单任务（分类、提取）：1-3B 模型足够
- 中等任务（对话、写作）：7-14B 模型
- 复杂任务（推理、代码）：32-70B 模型
- 不要用大模型做小模型能做的事

### 2. 量化

- INT4 量化：显存减半，速度提升 2 倍，精度损失 <5%
- 7B INT4 可以在 6GB 显存上运行（消费级显卡）

### 3. 批处理

- 高并发场景：增大 batch size，提高 GPU 利用率
- 低延迟场景：减小 batch size，降低单个请求的等待时间
- 用连续批处理自动平衡

### 4. 自动扩缩容

- 根据队列长度自动扩缩容实例数量
- 空闲时缩容到 0（Serverless）
- 用 KEDA 或自定义控制器实现

### 5. 缓存

- 前缀缓存：共享系统提示词和 RAG 文档的 KV 缓存
- 响应缓存：相同问题直接返回缓存结果
- 嵌入缓存：相同文本的嵌入向量缓存

## 性能基准测试

```python
# vLLM 基准测试
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-7B-Instruct \
    --port 8000

# 用 vLLM 自带的基准测试工具
python benchmarks/benchmark_serving.py \
    --backend vllm \
    --model Qwen/Qwen2.5-7B-Instruct \
    --dataset-name random \
    --num-prompts 1000 \
    --request-rate 10 \
    --max-input-len 512 \
    --max-output-len 256

# 关键指标
# - 吞吐量（tokens/s）：每秒生成的 token 数
# - 首 token 延迟（TTFT）：从请求到第一个 token 的时间
# - 每 token 延迟（TPOT）：每个 token 的平均生成时间
# - 端到端延迟：从请求到完成的总时间
```

## 总结

大模型推理优化是一个系统工程，涉及模型量化、KV 缓存管理、批处理策略、算子优化、部署架构等多个层面。核心目标是在**延迟、吞吐量、成本**三者之间找到最优平衡。

关键技术总结：
1. **量化**（GPTQ/AWQ INT4）：显存减半，速度翻倍，精度损失可控
2. **PagedAttention**（vLLM）：KV 缓存高效管理，显存利用率从 40% 提升到 90%
3. **连续批处理**：请求完成后立即加入新请求，GPU 利用率最大化
4. **Flash Attention**：注意力计算加速 2-4 倍，显存减少 2-3 倍
5. **投机解码**：小模型草稿+大模型验证，速度提升 2-3 倍
6. **前缀缓存**：共享前缀的 KV 缓存，多轮对话和 RAG 场景效果显著

推理优化没有银弹，需要根据具体场景（模型大小、并发量、延迟要求、成本预算）选择合适的技术组合。但理解这些技术的原理，是做出正确选择的基础。
