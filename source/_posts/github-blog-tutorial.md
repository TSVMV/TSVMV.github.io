---
title: 如何从0用GitHub搭建自己的博客
date: 2026-09-13 10:00:00
categories: [运维开发]
tags: [Hexo, GitHub, 博客搭建]
cover: /img/bg21.jpg
sticky: 100
---

## 前言

很多人都想拥有一个属于自己的博客，但又觉得搭建博客很复杂、需要花钱买服务器。其实，利用 GitHub Pages + Hexo，你可以完全免费地搭建一个功能强大、外观精美的个人博客，而且不需要任何服务器运维知识。

本文将带你从零开始，一步步搭建一个属于自己的博客。我会尽量写得详细，即使你是完全的新手，也能跟着操作完成。

<!-- more -->

## 一、准备工作

### 1.1 注册 GitHub 账号

GitHub 是全球最大的代码托管平台，我们的博客就托管在 GitHub 上。

1. 访问 [https://github.com](https://github.com)
2. 点击右上角 "Sign up"
3. 输入邮箱、密码、用户名，完成注册
4. 验证邮箱

> **注意**：用户名很重要，因为你的博客地址会是 `https://你的用户名.github.io`。建议取一个简短好记的名字。

### 1.2 安装 Git

Git 是版本控制工具，用来把本地代码推送到 GitHub。

**Windows：**
- 访问 [https://git-scm.com/download/win](https://git-scm.com/download/win)
- 下载并安装，一路默认即可

**macOS：**
```bash
brew install git
```

**Linux（Ubuntu/Debian）：**
```bash
sudo apt update
sudo apt install git
```

安装完成后，配置 Git 用户信息：
```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的邮箱"
```

### 1.3 安装 Node.js

Hexo 是基于 Node.js 的静态博客框架，所以需要安装 Node.js。

1. 访问 [https://nodejs.org](https://nodejs.org)
2. 下载 LTS（长期支持）版本
3. 安装，一路默认即可

验证安装：
```bash
node -v   # 应显示 v18.x.x 或更高
npm -v    # 应显示 9.x.x 或更高
```

## 二、Hexo 简介

Hexo 是一个快速、简洁且高效的博客框架。你用 Markdown 写文章，Hexo 会把它转换成静态 HTML 页面，然后部署到 GitHub Pages 上。

**Hexo 的优点：**
- 完全免费，不需要服务器
- 速度快，生成静态页面
- 支持 Markdown 写作
- 主题丰富，可高度自定义
- 支持插件扩展
- 版本控制，文章不会丢

## 三、安装 Hexo 并初始化博客

### 3.1 安装 Hexo CLI

打开终端（Windows 用 Git Bash，macOS/Linux 用终端），执行：

```bash
npm install -g hexo-cli
```

这会全局安装 Hexo 命令行工具。

验证安装：
```bash
hexo -v
```

### 3.2 初始化博客

选择一个目录存放博客文件，然后执行：

```bash
hexo init my-blog
cd my-blog
npm install
```

这会在当前目录创建一个 `my-blog` 文件夹，里面是博客的所有文件。

**目录结构说明：**
```
my-blog/
├── _config.yml          # 博客主配置文件
├── package.json         # 依赖配置
├── scaffolds/           # 文章模板
├── source/              # 内容目录
│   ├── _posts/          # 文章放在这里
│   └── about/           # 关于页面
└── themes/              # 主题目录
```

### 3.3 本地预览

执行以下命令启动本地服务器：

```bash
hexo server
```

然后在浏览器访问 [http://localhost:4000](http://localhost:4000)，你就能看到一个默认的 Hexo 博客了。

按 `Ctrl + C` 停止服务器。

## 四、配置博客

### 4.1 修改主配置

打开 `_config.yml`，修改以下内容：

```yaml
# 站点信息
title: 你的博客标题          # 比如：VMV 的博客
subtitle: ''                 # 副标题，留空即可
description: 博客描述        # 一句话描述你的博客
keywords: 博客,技术          # 关键词，用逗号分隔
author: 你的名字             # 作者名
language: zh-CN              # 语言，简体中文
timezone: Asia/Shanghai      # 时区

# URL
url: https://你的用户名.github.io
permalink: :year/:month/:day/:title/
```

> **重要**：`url` 一定要改成 `https://你的用户名.github.io`，否则部署后链接会出错。

### 4.2 安装 Butterfly 主题

Hexo 默认主题比较朴素，推荐使用 Butterfly 主题，功能强大、外观精美、支持深色模式。

在博客目录执行：

```bash
npm install hexo-theme-butterfly --save
```

然后修改 `_config.yml` 中的主题：

```yaml
theme: butterfly
```

### 4.3 配置 Butterfly 主题

在博客根目录创建 `_config.butterfly.yml` 文件，这是 Butterfly 主题的配置文件。

基础配置：

```yaml
# 导航栏
nav:
  logo: /img/favicon.png
  display_title: true
  fixed: false

# 网站图标
favicon: /img/favicon.png

# 头像
avatar:
  img: /images/avatar.jpg
  effect: false        # 头像动画，建议关闭

# 顶部图
default_top_img: /img/banner.jpg
index_img: /img/banner.jpg
archive_img: /img/bg.jpg
tag_img: /img/bg.jpg
category_img: /img/bg.jpg

# 背景图
background: /img/bg.jpg

# 代码高亮
highlight_theme: mac

# 深色模式
darkmode:
  enable: true
  button: true
  autoChangeMode: 2

# 打字机效果
subtitle:
  enable: true
  loop: true
  source: false
  sub: 
    - 欢迎来到我的博客
    - 记录技术与生活

# 本地搜索
search:
  path: search.xml
  field: post
  content: true
  format: html

# 懒加载
lazyload:
  enable: true
  native: false
  field: site
  blur: true

# 字数统计
wordcount:
  enable: true
  post_wordcount: true
  min2read: true
  total_wordcount: true
```

> 图片需要放在 `source/img/` 目录下，头像放在 `source/images/` 目录下。

## 五、写文章

### 5.1 创建新文章

```bash
hexo new "文章标题"
```

这会在 `source/_posts/` 目录下创建一个 `文章标题.md` 文件。

### 5.2 文章格式

用 Markdown 编辑器打开文章文件，开头是 Front-matter（文章元信息）：

```yaml
---
title: 文章标题
date: 2026-09-13 10:00:00
categories: [分类]
tags: [标签1, 标签2]
cover: /img/封面图.jpg
---
```

然后写正文，支持完整的 Markdown 语法：

```markdown
## 二级标题

这是正文，支持 **加粗**、*斜体*、`代码`。

### 三级标题

- 列表项1
- 列表项2

```代码块
print("Hello World")
```

> 引用文字

[链接文字](https://example.com)

![图片描述](/img/图片.jpg)
```

### 5.3 文章摘要

在文章中插入 `<!-- more -->`，前面的内容会作为首页摘要显示：

```markdown
这是文章摘要，会显示在首页。

<!-- more -->

这是文章正文，点击"阅读更多"后显示。
```

### 5.4 置顶文章

在 Front-matter 中添加 `sticky` 属性，数值越大越靠前：

```yaml
---
title: 置顶文章
sticky: 100
---
```

## 六、部署到 GitHub Pages

### 6.1 创建 GitHub 仓库

1. 登录 GitHub，点击右上角 "+" → "New repository"
2. 仓库名必须是 `你的用户名.github.io`（比如 `VMV.github.io`）
3. 选择 Public（公开）
4. 点击 "Create repository"

> **注意**：仓库名必须严格是 `用户名.github.io`，否则 GitHub Pages 不会正常工作。

### 6.2 配置 Git 认证

推送代码到 GitHub 需要认证。推荐使用 Personal Access Token（PAT）：

1. 访问 [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. 点击 "Generate new token" → "Generate new token (classic)"
3. Note 填个名字，比如 "blog-deploy"
4. Expiration 选 "No expiration"（不过期）
5. 勾选 `repo` 和 `workflow` 权限
6. 点击 "Generate token"
7. **复制生成的 token 并保存好**（只显示一次）

然后在终端配置 Git 凭证存储：

```bash
git config --global credential.helper store
```

### 6.3 初始化 Git 并推送

在博客目录执行：

```bash
git init
git add .
git commit -m "初始提交：搭建博客"
git branch -M main
git remote add origin https://github.com/你的用户名/你的用户名.github.io.git
git push -u origin main
```

第一次推送会要求输入用户名和密码，密码填上面生成的 token。

### 6.4 开启 GitHub Pages

1. 进入仓库页面，点击 "Settings"
2. 左侧找到 "Pages"
3. "Source" 选择 "Deploy from a branch"
4. "Branch" 选择 `main`，文件夹选 `/ (root)`
5. 点击 "Save"

等待 1-2 分钟，访问 `https://你的用户名.github.io` 就能看到博客了！

> 但这样部署的是 Hexo 源码，不是生成的静态文件。我们需要用 GitHub Actions 自动构建部署，见下一节。

## 七、GitHub Actions 自动部署（推荐）

手动部署很麻烦，推荐用 GitHub Actions 自动构建部署。每次推送代码，GitHub 会自动构建并发布。

### 7.1 创建工作流文件

在博客目录创建 `.github/workflows/pages.yml`：

```yaml
name: Deploy Hexo to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: true
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install Dependencies
        run: npm install

      - name: Build Hexo
        run: npx hexo clean && npx hexo generate

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 7.2 配置 Pages 源

1. 进入仓库 Settings → Pages
2. "Source" 改成 "GitHub Actions"
3. 保存

### 7.3 推送触发自动部署

```bash
git add .
git commit -m "添加GitHub Actions自动部署"
git push
```

推送后，进入仓库的 "Actions" 页面，可以看到构建进度。构建完成后（1-2分钟），博客自动更新。

以后每次写文章、修改配置，只需要：
```bash
git add .
git commit -m "更新内容"
git push
```

GitHub 会自动构建部署，非常方便。

## 八、自定义域名（可选）

如果你有自己的域名，可以绑定到博客：

1. 在域名服务商添加 CNAME 记录：`www` → `你的用户名.github.io`
2. 在博客 `source/` 目录创建 `CNAME` 文件，内容是你的域名（如 `www.example.com`）
3. 推送代码，GitHub Pages 会自动识别

## 九、常用命令速查

```bash
hexo new "标题"        # 新建文章
hexo new page "关于"   # 新建页面
hexo server            # 本地预览（http://localhost:4000）
hexo clean             # 清理缓存
hexo generate          # 生成静态文件
hexo deploy            # 部署（需配置deploy）
hexo list post         # 列出所有文章
```

常用组合：
```bash
hexo clean && hexo generate && hexo server  # 清理+生成+预览
```

## 十、常见问题

### Q1：推送后博客没更新？
A：检查 Actions 页面是否构建成功，可能是配置有误。查看构建日志找错误。

### Q2：图片显示不出来？
A：检查图片路径是否正确。图片放在 `source/img/` 目录，引用路径是 `/img/图片名.jpg`。

### Q3：国内访问慢？
A：可以用 jsDelivr CDN 加速图片，把图片路径改成 `https://cdn.jsdelivr.net/gh/用户名/仓库名@main/source/img/图片名.jpg`。

### Q4：怎么换主题？
A：`npm install hexo-theme-主题名 --save`，然后修改 `_config.yml` 中的 `theme` 字段。

### Q5：文章怎么置顶？
A：在文章 Front-matter 中加 `sticky: 100`，数值越大越靠前。

### Q6：怎么添加评论功能？
A：推荐用 Giscus（基于 GitHub Discussions），在主题配置中开启并配置仓库信息。

### Q7：博客怎么被搜索引擎搜到？
A：
1. 确保博客有清晰的标题和描述
2. 生成 sitemap.xml（Hexo 自带）
3. 提交到 Google Search Console
4. 多写原创高质量文章
5. 在其他平台（知乎、掘金等）留博客链接

## 十一、进阶优化

### 11.1 图片压缩
用 ImageMagick 批量压缩图片：
```bash
convert 原图.jpg -quality 70 -resize 1600x\> 压缩后.jpg
```

### 11.2 开启 PWA 离线访问
安装 `hexo-offline` 插件，支持离线访问已浏览的页面。

### 11.3 配置 CDN 加速
所有静态资源（图片、JS、CSS）都可以用 jsDelivr CDN 加速。

### 11.4 备份博客
博客源码在 GitHub 上，本身就是备份。建议定期 `git push`，不要只存在本地。

## 总结

搭建一个 GitHub 博客的核心流程：
1. 注册 GitHub，安装 Git 和 Node.js
2. 安装 Hexo，初始化博客
3. 配置主题（推荐 Butterfly）
4. 写文章（Markdown）
5. 创建 GitHub 仓库，配置 GitHub Actions 自动部署
6. 推送代码，博客上线

整个过程不需要花一分钱，也不需要服务器运维知识。只要你会用 Markdown 写文章，就能维护好自己的博客。

博客是一个长期的过程，不要追求一开始就完美。先搭建起来，然后慢慢优化、慢慢写文章。坚持记录，时间会给你回报。

祝你搭建顺利！如果有问题，欢迎在评论区留言。
