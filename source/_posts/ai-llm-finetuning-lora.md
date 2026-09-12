---
title: AI 大模型微调实战：从 LoRA 到全参数微调
date: 2026-09-12 22:00:00
categories: [AI, 大模型]
tags: [AI, LLM, 微调, LoRA, PEFT, 大模型]
cover: /img/bg6.jpg
---

## 为什么要微调

预训练大模型（如 LLaMA、Qwen、DeepSeek）虽然具备强大的通用能力，但在特定场景下往往不够"专业"——它可能不知道你的业务术语、不遵循你的输出格式、不了解你的领域知识。微调（Fine-tuning）就是在预训练模型的基础上，用特定领域的数据继续训练，让模型适应你的场景。

微调 vs 提示词工程（Prompt Engineering）：
- **提示词工程**：零成本，适合简单任务和快速验证，但模型可能不遵循复杂格式，上下文窗口有限
- **微调**：需要数据和算力，适合需要稳定输出格式、领域知识注入、风格对齐的场景
- **RAG**：适合需要外部知识库的场景，不改变模型本身

实际项目中往往三者结合：用 RAG 提供知识，用微调对齐格式和风格，用提示词工程做最终引导。

<!-- more -->

## 微调的几种方式

### 1. 全参数微调（Full Fine-tuning）

更新模型的所有参数。效果最好，但需要大量显存（7B 模型全参数微调需要约 100GB+ 显存），且容易过拟合和灾难性遗忘。

### 2. 参数高效微调（PEFT）

只更新模型的一小部分参数，冻结大部分预训练参数。显存需求大幅降低，效果接近全参数微调。

主流 PEFT 方法：
- **LoRA**（Low-Rank Adaptation）：最主流，在注意力层旁加低秩矩阵
- **QLoRA**：LoRA + 4bit 量化，7B 模型只需 6GB 显存
- **Adapter**：在 Transformer 层中插入小的适配器模块
- **Prefix Tuning / P-Tuning**：在输入前加可训练的前缀 token
- **IA3**：通过缩放激活值来适配，参数量极少

### 3. 继续预训练（Continued Pre-training）

用大量领域文本继续做预训练（MLM / CLM），让模型学习领域知识。适合领域术语和知识与通用语料差异很大的场景（如法律、医疗、代码）。数据量通常需要百万级 token 以上。

### 4. 指令微调（SFT, Supervised Fine-Tuning）

用"指令-回答"对来训练模型遵循指令。这是最常见的微调方式，数据格式是 `{"instruction": "...", "input": "...", "output": "..."}`。

## LoRA 原理

LoRA 的核心思想：模型权重的更新可以用低秩矩阵来近似。

原始权重更新：`W = W0 + ΔW`，其中 `ΔW` 是和 `W0` 同形状的矩阵，参数量巨大。

LoRA 的做法：`ΔW = BA`，其中 `B` 是 `r × d` 矩阵，`A` 是 `d × r` 矩阵，`r` 是秩（通常取 8-64）。这样参数量从 `d × d` 降到 `2 × d × r`，减少了几个数量级。

训练时只更新 `A` 和 `B`，冻结 `W0`。推理时把 `BA` 合并到 `W0` 中，不增加推理延迟。

LoRA 通常作用在 Transformer 的注意力层的查询和值投影矩阵（`q_proj`、`v_proj`）上，也可以作用在所有线性层上。

## 环境准备

### 硬件需求

| 模型大小 | QLoRA (4bit) | LoRA (16bit) | 全参数 (16bit) |
|----------|---------------|---------------|-----------------|
| 7B | 6-8 GB | 20-24 GB | 80+ GB |
| 13B | 10-12 GB | 32-40 GB | 160+ GB |
| 70B | 40-48 GB | 160+ GB | 600+ GB |

消费级显卡（RTX 3090/4090，24GB）可以用 QLoRA 微调 7B-13B 模型。

### 安装依赖

```bash
pip install torch transformers datasets peft accelerate bitsandbytes trl evaluate sentencepiece
```

- `transformers`：HuggingFace 模型库
- `peft`：参数高效微调
- `trl`：Transformer Reinforcement Learning，包含 SFTTrainer
- `bitsandbytes`：量化
- `datasets`：数据集处理
- `accelerate`：分布式训练

## 数据准备

### 数据格式

指令微调的数据通常是 JSONL 格式，每行一条：

```json
{"instruction": "解释什么是 SQL 注入", "input": "", "output": "SQL 注入是一种..."}
{"instruction": "把下面的句子翻译成英文", "input": "你好世界", "output": "Hello World"}
```

或者对话格式：

```json
{"messages": [
  {"role": "system", "content": "你是一个 CTF 专家。"},
  {"role": "user", "content": "什么是栈溢出？"},
  {"role": "assistant", "content": "栈溢出是..."}
]}
```

### 数据质量比数量重要

- **500 条高质量数据 > 50000 条低质量数据**
- 确保输出是你想要的风格和格式
- 去除重复、矛盾、低质量的样本
- 多样化：覆盖各种任务类型和输入模式
- 数据分布要和实际使用场景一致

### 数据清洗脚本

```python
import json
import re

def clean_text(text):
    # 去除多余空白
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()
    return text

cleaned = []
seen = set()

with open('data.jsonl', 'r') as f:
    for line in f:
        item = json.loads(line)
        # 去重
        key = item['instruction'] + item['input']
        if key in seen:
            continue
        seen.add(key)
        # 清洗
        item['instruction'] = clean_text(item['instruction'])
        item['output'] = clean_text(item['output'])
        # 过滤过短的输出
        if len(item['output']) < 10:
            continue
        cleaned.append(item)

with open('cleaned_data.jsonl', 'w') as f:
    for item in cleaned:
        f.write(json.dumps(item, ensure_ascii=False) + '\n')

print(f"清洗后: {len(cleaned)} 条")
```

## QLoRA 微调实战

下面用 QLoRA 微调一个 7B 模型（以 Qwen2.5-7B 为例）。

### 完整训练脚本

```python
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
    pipeline,
)
from peft import LoraConfig, PeftModel, prepare_model_for_kbit_training
from trl import SFTTrainer

# ========== 配置 ==========
model_name = "Qwen/Qwen2.5-7B-Instruct"
dataset_path = "cleaned_data.jsonl"
output_dir = "./qwen-lora-output"

# 4bit 量化配置
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",           # NF4 量化，比普通 4bit 效果好
    bnb_4bit_compute_dtype=torch.bfloat16,  # 计算时用 bf16
    bnb_4bit_use_double_quant=True,      # 双重量化
)

# LoRA 配置
lora_config = LoraConfig(
    r=16,                          # 秩，越大参数量越多，通常 8-64
    lora_alpha=32,                 # 缩放因子，通常是 r 的 2 倍
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=[                # 作用在哪些层
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
)

# 训练参数
training_args = TrainingArguments(
    output_dir=output_dir,
    num_train_epochs=3,             # 训练轮数，通常 2-5
    per_device_train_batch_size=2,  # 每张卡的 batch size
    gradient_accumulation_steps=8,  # 梯度累积，等效 batch size = 2*8=16
    learning_rate=2e-4,             # LoRA 的学习率，通常 1e-4 到 3e-4
    weight_decay=0.001,
    warmup_ratio=0.03,              # 预热步数比例
    lr_scheduler_type="cosine",     # 余弦学习率衰减
    logging_steps=10,
    save_strategy="epoch",          # 每个 epoch 保存一次
    bf16=True,                       # 用 bf16 混合精度
    gradient_checkpointing=True,     # 梯度检查点，省显存但慢 20%
    report_to="none",                # 不报告到 wandb
)

# ========== 加载模型和分词器 ==========
tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
)
model = prepare_model_for_kbit_training(model)

# ========== 加载数据集 ==========
dataset = load_dataset("json", data_files=dataset_path, split="train")

def format_prompt(example):
    """格式化训练样本"""
    prompt = f"""<|im_start|>system
你是一个 helpful 的助手。<|im_end|>
<|im_start|>user
{example['instruction']}
{example.get('input', '')}<|im_end|>
<|im_start|>assistant
{example['output']}<|im_end|>"""
    return {"text": prompt}

dataset = dataset.map(format_prompt)

# ========== 训练 ==========
trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    peft_config=lora_config,
    args=training_args,
    tokenizer=tokenizer,
    max_seq_length=2048,
    dataset_text_field="text",
)

trainer.train()
trainer.save_model(output_dir)
print(f"LoRA 权重已保存到 {output_dir}")
```

### 关键超参数说明

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `r` | 8-64 | LoRA 秩，越大容量越大，也更容易过拟合 |
| `lora_alpha` | 2×r | 缩放因子 |
| `learning_rate` | 1e-4 ~ 3e-4 | LoRA 的学习率比全参数高一个数量级 |
| `num_epochs` | 2-5 | 太多会过拟合 |
| `batch_size` | 尽量大 | 受显存限制，用梯度累积补足 |
| `max_seq_length` | 1024-4096 | 根据数据长度选择 |

## 合并 LoRA 权重

训练得到的是 LoRA 适配器（只有几十 MB），推理时可以合并到基础模型中：

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import torch

base_model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-7B-Instruct",
    torch_dtype=torch.bfloat16,
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-7B-Instruct")

# 加载 LoRA 权重
model = PeftModel.from_pretrained(base_model, "./qwen-lora-output")

# 合并并卸载 LoRA
model = model.merge_and_unload()

# 保存合并后的模型
model.save_pretrained("./qwen-merged")
tokenizer.save_pretrained("./qwen-merged")
```

合并后的模型可以像普通模型一样用 transformers 加载推理。

## 推理测试

```python
from transformers import pipeline

generator = pipeline(
    "text-generation",
    model="./qwen-merged",
    tokenizer="./qwen-merged",
    device_map="auto",
)

prompt = """<|im_start|>system
你是一个 CTF 专家。<|im_end|>
<|im_start|>user
什么是 ret2libc？<|im_end|>
<|im_start|>assistant
"""

output = generator(
    prompt,
    max_new_tokens=500,
    temperature=0.7,
    do_sample=True,
    top_p=0.9,
)
print(output[0]['generated_text'].split('<|im_start|>assistant')[1])
```

## 评估方法

### 1. 人工评估

准备一个测试集（不要出现在训练数据中），对比微调前后的输出质量，从以下维度打分：
- 准确性：回答是否正确
- 格式遵循：是否按要求的格式输出
- 风格一致性：是否符合目标风格
- 有用性：回答是否有帮助

### 2. 自动评估

- **困惑度（Perplexity）**：在验证集上的困惑度越低越好
- **BLEU / ROUGE**：和参考答案的重叠度（适合翻译、摘要）
- **LLM-as-Judge**：用更强的模型（如 GPT-4）来打分

```python
# 简单的困惑度计算
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("./qwen-merged")
tokenizer = AutoTokenizer.from_pretrained("./qwen-merged")

text = "测试文本..."
inputs = tokenizer(text, return_tensors="pt")
with torch.no_grad():
    outputs = model(**inputs, labels=inputs["input_ids"])
    perplexity = torch.exp(outputs.loss)
print(f"Perplexity: {perplexity.item():.2f}")
```

## 常见问题

### 1. 微调后效果变差

- 学习率太高，降低到 1e-5 ~ 5e-5
- 训练轮数太多，过拟合了，减少 epoch
- 数据质量差，清洗数据
- LoRA 秩太大，降低 r

### 2. 显存不够（OOM）

- 开启 4bit 量化（QLoRA）
- 减小 batch_size，增大 gradient_accumulation_steps
- 开启 gradient_checkpointing
- 减小 max_seq_length
- 用更小的模型

### 3. 微调后模型"忘"了通用能力

- 灾难性遗忘，LoRA 通常比全参数好很多
- 在训练数据中混入一些通用数据（如 Alpaca 的一部分）
- 降低学习率和训练轮数

### 4. 输出不稳定

- 增大训练数据量
- 提高数据质量和一致性
- 推理时降低 temperature

## DPO 对齐（可选进阶）

SFT 之后可以用 DPO（Direct Preference Optimization）进一步对齐人类偏好。需要准备偏好数据：`{"prompt": "...", "chosen": "好的回答", "rejected": "差的回答"}`。

```python
from trl import DPOTrainer, DPOConfig

dpo_args = DPOConfig(
    output_dir="./dpo-output",
    num_train_epochs=1,
    per_device_train_batch_size=2,
    learning_rate=5e-5,
    bf16=True,
)

trainer = DPOTrainer(
    model=model,          # SFT 后的模型
    args=dpo_args,
    train_dataset=dpo_dataset,
    tokenizer=tokenizer,
)
trainer.train()
```

## 总结

大模型微调的核心流程：**准备高质量数据 → 选择微调方法（QLoRA 是默认选择）→ 训练 → 评估 → 合并部署**。

对于个人开发者和小团队，QLoRA 是性价比最高的方案——一张 24GB 的消费级显卡就能微调 7B-13B 模型。数据质量是决定微调效果的最关键因素，花时间清洗和标注数据比调超参数更有价值。

微调不是万能的——如果你的需求是让模型访问外部知识，RAG 更合适；如果只是简单的格式要求，提示词工程就够了。根据场景选择合适的工具，才是高效的做法。
