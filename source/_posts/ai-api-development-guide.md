---
title: AI 大模型 API 开发实战：从调用到构建应用
date: 2026-09-12 17:00:00
categories: [AI, 编程]
tags: [AI, LLM, API, Python, 大模型, 开发]
cover: /img/bg11.jpg
---

## 大模型 API 是什么

大语言模型（LLM，Large Language Model）通过 API 的方式对外提供服务，开发者不需要自己训练和部署模型，只需发送 HTTP 请求就能获得 AI 能力。目前主流的大模型 API 都采用 OpenAI 兼容格式，包括 OpenAI 的 GPT 系列、Anthropic 的 Claude、Google 的 Gemini，以及国内的 DeepSeek、通义千问、文心一言、智谱 GLM 等。

掌握大模型 API 开发，是把 AI 能力集成到自己的应用、工具和自动化工作流中的基础。

<!-- more -->

## API 基础格式

### 认证

所有请求都需要在 HTTP 头中携带 API Key：

```http
Authorization: Bearer sk-xxxxxxxxxxxxxxxx
```

API Key 是敏感信息，绝对不能硬编码在前端代码或公开仓库中，应该用环境变量管理。

### 基础对话请求

最核心的接口是 `/v1/chat/completions`，发送消息列表，返回模型回复：

```python
import requests

url = "https://api.openai.com/v1/chat/completions"
headers = {
    "Authorization": "Bearer sk-xxxxxxxx",
    "Content-Type": "application/json"
}
data = {
    "model": "gpt-4o-mini",
    "messages": [
        {"role": "system", "content": "你是一个 helpful 的助手。"},
        {"role": "user", "content": "用一句话解释什么是递归。"}
    ],
    "temperature": 0.7,
    "max_tokens": 500
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result["choices"][0]["message"]["content"])
```

### 消息角色

- `system`：系统提示词，设定 AI 的角色、行为规则和输出格式
- `user`：用户输入
- `assistant`：AI 的回复，用于多轮对话上下文

## 使用官方 SDK

### 安装

```bash
pip install openai
```

### 基础调用

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-xxxxxxxx",
    base_url="https://api.openai.com/v1"  # 国内模型需要改这个地址
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "你是一个专业的代码审查助手。"},
        {"role": "user", "content": "审查这段 Python 代码有什么问题：\n\ndef add(a, b)\n    return a + b"}
    ],
    temperature=0.3
)

print(response.choices[0].message.content)
```

### 国内模型适配

国内大模型大多兼容 OpenAI 格式，只需改 `base_url` 和 `model`：

```python
# DeepSeek
client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com")
response = client.chat.completions.create(model="deepseek-chat", messages=[...])

# 通义千问
client = OpenAI(api_key="sk-xxx", base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")
response = client.chat.completions.create(model="qwen-plus", messages=[...])

# 智谱 GLM
client = OpenAI(api_key="xxx", base_url="https://open.bigmodel.cn/api/paas/v4/")
response = client.chat.completions.create(model="glm-4-flash", messages=[...])
```

## 流式输出（Streaming）

默认情况下，API 会等模型生成完所有内容才返回。对于长文本，用户等待时间很长。流式输出可以让内容逐字返回，体验更好：

```python
from openai import OpenAI

client = OpenAI(api_key="sk-xxxxxxxx")

stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "写一首关于秋天的诗。"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

流式输出在 Web 应用中通常配合 SSE（Server-Sent Events）实现逐字打字机效果。

## 多轮对话

多轮对话的关键是维护消息历史，把每一轮的 user 和 assistant 消息都追加到 messages 列表中：

```python
class ChatBot:
    def __init__(self, system_prompt="你是一个 helpful 的助手。"):
        self.client = OpenAI(api_key="sk-xxxxxxxx")
        self.messages = [{"role": "system", "content": system_prompt}]

    def chat(self, user_input):
        self.messages.append({"role": "user", "content": user_input})
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=self.messages,
            temperature=0.7
        )
        reply = response.choices[0].message.content
        self.messages.append({"role": "assistant", "content": reply})
        return reply

# 使用
bot = ChatBot("你是一个 CTF 出题专家，擅长出 Web 安全方向的题目。")
print(bot.chat("给我出一道 SQL 注入的入门题。"))
print(bot.chat("这道题的预期解法是什么？"))
```

注意：消息列表会越来越长，token 消耗也会增加。实际应用中需要做上下文管理，比如只保留最近 N 轮对话，或者用摘要压缩历史。

## Function Calling（工具调用）

Function Calling 让模型能够调用外部函数，是构建 AI Agent 和工具链的核心能力。

### 定义工具

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的当前天气",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，如北京、上海"
                    }
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "执行数学计算",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "数学表达式，如 2+3*4"
                    }
                },
                "required": ["expression"]
            }
        }
    }
]
```

### 实现工具调用循环

```python
import json

def get_weather(city):
    # 实际项目中调用天气 API
    return f"{city}今天晴，25°C，微风。"

def calculate(expression):
    return str(eval(expression))  # 生产环境不要用 eval

def chat_with_tools(user_input):
    messages = [{"role": "user", "content": user_input}]

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        tools=tools,
        tool_choice="auto"
    )

    message = response.choices[0].message

    # 如果模型决定调用工具
    while message.tool_calls:
        messages.append(message)

        for tool_call in message.tool_calls:
            func_name = tool_call.function.name
            func_args = json.loads(tool_call.function.arguments)

            # 执行对应的函数
            if func_name == "get_weather":
                result = get_weather(func_args["city"])
            elif func_name == "calculate":
                result = calculate(func_args["expression"])
            else:
                result = "未知工具"

            # 把工具执行结果返回给模型
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result
            })

        # 模型根据工具结果继续生成回复
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=tools
        )
        message = response.choices[0].message

    return message.content

# 使用
print(chat_with_tools("北京今天天气怎么样？顺便算一下 123*456 等于多少。"))
```

模型会自动判断需要调用哪些工具、按什么顺序调用，然后把工具结果整合成自然语言回复。

## 构建一个实用的 AI 应用

下面用 Flask + 大模型 API 构建一个代码解释器 Web 应用，支持流式输出。

### 项目结构

```
code-explainer/
├── app.py
├── requirements.txt
├── templates/
│   └── index.html
└── .env
```

### 后端代码

```python
# app.py
import os
from flask import Flask, render_template, request, Response, stream_with_context
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """你是一个资深的代码解释器。用户会给你一段代码，你需要：
1. 用通俗的语言解释这段代码做了什么
2. 指出代码中可能存在的问题或可以优化的地方
3. 如果代码有 bug，给出修复建议
用中文回答，格式清晰。"""

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/explain", methods=["POST"])
def explain():
    code = request.json.get("code", "")

    def generate():
        stream = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"请解释这段代码：\n\n```\n{code}\n```"}
            ],
            temperature=0.3,
            stream=True
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    return Response(stream_with_context(generate()), mimetype="text/event-stream")

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

### 前端页面

```html
<!-- templates/index.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>代码解释器 AI</title>
    <style>
        body { font-family: sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
        textarea { width: 100%; height: 200px; font-family: monospace; padding: 10px; }
        #output { margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; min-height: 100px; white-space: pre-wrap; }
        button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>代码解释器 AI</h1>
    <textarea id="code" placeholder="在这里粘贴代码..."></textarea>
    <br>
    <button onclick="explain()">解释代码</button>
    <div id="output"></div>

    <script>
    async function explain() {
        const code = document.getElementById('code').value;
        const output = document.getElementById('output');
        output.textContent = '思考中...';

        const response = await fetch('/explain', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({code})
        });

        output.textContent = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            output.textContent += decoder.decode(value);
        }
    }
    </script>
</body>
</html>
```

### 运行

```bash
pip install flask openai python-dotenv
echo "OPENAI_API_KEY=sk-xxxxxxxx" > .env
python app.py
```

访问 http://localhost:5000 就能使用了。

## 提示词工程基础

同样的模型，提示词写得好不好，输出质量天差地别。

### 结构化提示词

```
# 角色
你是一个有 10 年经验的 CTF Web 安全专家。

# 任务
分析下面的题目描述，给出解题思路和预期的 payload。

# 输出格式
1. 漏洞类型判断
2. 解题思路（分步骤）
3. 关键 payload
4. 可能的坑和绕过点

# 题目描述
{题目内容}
```

### 关键技巧

1. **明确角色**：告诉模型它是谁，设定专业背景
2. **明确任务**：具体说明要做什么，不要模糊
3. **明确格式**：指定输出格式，结构化输出更好用
4. **给出示例**：Few-shot learning，给 1-2 个输入输出示例
5. **分步思考**：让模型"先思考再回答"，复杂任务效果更好
6. **约束条件**：明确说明不要做什么，比如"不要使用 Markdown 表格"

### 温度参数选择

- `temperature=0`：确定性输出，适合代码生成、事实问答、数据提取
- `temperature=0.3-0.5`：平衡，适合代码解释、技术分析
- `temperature=0.7-1.0`：创造性输出，适合写文章、头脑风暴、创意写作
- `temperature>1.0`：高随机性，不推荐

## 成本优化

大模型 API 按 token 计费，token 大致可以理解为"分词后的词块"，中文 1 个字约 1-2 个 token，英文 1 个单词约 1-1.5 个 token。

### 省钱技巧

1. **选对模型**：简单任务用小模型（gpt-4o-mini、deepseek-chat、qwen-turbo），复杂任务才用大模型
2. **控制输出长度**：设置合理的 `max_tokens`
3. **精简上下文**：不要把所有历史都塞进去，做上下文裁剪和摘要
4. **缓存结果**：相同的请求缓存响应，避免重复调用
5. **批量处理**：多个小任务合并成一次请求
6. **用流式输出**：不省钱，但用户体验好，可以提前中断不需要的输出

### 各模型大致价格参考（2026 年）

| 模型 | 输入价格（每百万 token） | 输出价格（每百万 token） |
|------|--------------------------|--------------------------|
| GPT-4o-mini | $0.15 | $0.60 |
| GPT-4o | $2.50 | $10.00 |
| DeepSeek-V3 | ¥1 | ¥2 |
| 通义千问 Plus | ¥0.8 | ¥2 |
| GLM-4-Flash | 免费 | 免费 |

个人开发和学习用小模型完全够用，成本很低。

## 常见问题

### 401 Unauthorized

API Key 错误或过期，检查 `Authorization` 头和 Key 是否正确。

### 429 Too Many Requests

请求频率超限或余额不足。检查账户余额，降低请求频率，加重试和退避机制。

### 输出被截断

`max_tokens` 设置太小，调大这个值。或者内容太长超出了模型的上下文窗口，需要做分段处理。

### 模型幻觉（胡说八道）

大模型会编造不存在的事实。对于事实性任务，降低 temperature，在提示词中要求"只根据提供的信息回答，不知道就说不知道"，或者接入搜索引擎做 RAG。

### 国内访问 OpenAI 超时

需要代理，或者直接用国内模型（DeepSeek、通义千问等），它们兼容 OpenAI 格式，改个 base_url 就行。

## 总结

大模型 API 开发的核心就三件事：

1. **会调用**：掌握基础对话、流式输出、多轮对话、Function Calling
2. **会集成**：把 AI 能力嵌入到自己的应用中，做好工程化（错误处理、缓存、日志）
3. **会写提示词**：好的提示词能让模型输出质量提升一个档次

从简单的 API 调用到完整的 AI Agent，中间的桥梁就是 Function Calling 和工具链的组合。当你能让模型调用搜索、代码执行、数据库、外部 API 等工具时，就已经在构建真正的 AI 应用了。

下一步可以学习 RAG（检索增强生成）、AI Agent 框架（LangChain、LlamaIndex）、以及模型微调，这些是把大模型用得更深的方向。
