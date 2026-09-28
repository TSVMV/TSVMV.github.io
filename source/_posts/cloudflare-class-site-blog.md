---
title: 如何用 Cloudflare 搭建班级文化网站 / 个人博客
date: 2026-09-28 20:30:00
categories: [运维开发]
tags: [Cloudflare, Cloudflare Pages, Vue, Hexo, 网站搭建]
cover: /img/bg23.jpg
sticky: 90
---

## 前言

想给班级做一个文化展示网站，或者想搭一个属于自己的博客，第一反应往往是"是不是要买服务器、买域名、学运维"。其实不用。借助 Cloudflare Pages，你可以完全免费地得到一个带全球 CDN、自动 HTTPS、支持自定义域名的网站，而且部署过程比想象中简单得多。

本文会带你用同一套 Cloudflare Pages 的思路，从零搭建两个站点：

- 一个**班级文化网站**：用 Vue 3 + Vite 写成，用来展示班级风采、成员、荣誉和活动纪事；
- 一个**个人博客**：用 Hexo + Butterfly 写成，用来沉淀技术文章。

两者都不需要服务器，push 到 GitHub 就会自动构建、自动上线。

<!-- more -->

## 一、为什么选择 Cloudflare

在开始动手之前，先说清楚为什么推荐 Cloudflare Pages，而不是别的方案。

Cloudflare Pages 的核心优势：

- **免费**：静态站点托管免费，没有服务器费用，也没有按流量计费的负担；
- **全球 CDN**：全球几百个节点，静态资源就近分发，访问速度快；
- **自动 HTTPS**：绑定自定义域名后自动签发并续期证书，不用自己配置；
- **与 GitHub 深度集成**：push 代码即自动构建部署，不用本地打包上传；
- **预览部署**：每个分支、每次提交都能生成一个独立的预览地址，方便改版对比；
- **支持 Cloudflare Workers**：需要动态能力时，可以在静态站点旁边挂一个 Worker 处理接口，同一个域名下就能用。

和 GitHub Pages 相比，Cloudflare Pages 的优势主要在**访问速度**和**动态扩展能力**上。GitHub Pages 在国内的访问体验经常不稳定，而 Cloudflare 的节点覆盖面更广。实际使用中，很多人的做法是**同一份源码同时部署到两个平台**，互为备份，后文会专门讲这一点。

## 二、准备工作

整个流程需要准备三样东西。

### 2.1 GitHub 账号

所有代码都托管在 GitHub 上，同时它也是自动部署的触发源。

1. 访问 [https://github.com](https://github.com) 注册账号；
2. 建议取一个简短好记的用户名，因为它会出现在站点地址里。

### 2.2 Cloudflare 账号

1. 访问 [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) 注册；
2. 邮箱验证后即可使用，免费套餐足够。

### 2.3 域名（可选）

不绑定域名也能用，Cloudflare 会分配一个 `项目名.pages.dev` 的免费地址。如果你希望有 `banji.example.com` 这样的地址，就需要一个域名。

域名可以在任意注册商购买，购买后把 DNS 托管到 Cloudflare，就能在 Pages 里绑定自定义域。没有域名也完全不影响先把网站跑起来，可以后面再补。

### 2.4 本地环境

本地需要 Node.js 和 Git：

```bash
git --version
```

```bash
node -v
npm -v
```

如果 `node -v` 没有输出，去 [https://nodejs.org](https://nodejs.org) 下载 LTS 版本安装即可。写这篇文章时使用 Node 20 比较稳妥，Cloudflare 的构建环境默认也是 Node 20。

## 三、方案一：班级文化网站（Vue 3 + Vite）

班级文化网站适合用**前端框架**来做，因为它的页面结构比较固定、组件复用多，而且做出来的效果比纯 HTML 好看很多。这里用 Vue 3 + Vite。

### 3.1 创建项目

```bash
npm create vite@latest class-site -- --template vue
```

```bash
cd class-site
npm install
```

此时目录结构大致如下：

```
class-site/
├── index.html            # 入口 HTML
├── package.json
├── vite.config.js        # Vite 配置
├── public/               # 静态资源，构建后原样拷贝
│   └── photos/           # 照片等
└── src/
    ├── main.js           # 应用入口
    ├── App.vue           # 根组件
    └── components/       # 各个区块组件
```

### 3.2 拆分页面区块

一个班级文化网站通常包含这些区块，建议一个区块一个组件：

| 组件 | 作用 |
| --- | --- |
| `HeroSection.vue` | 首屏，班级名称、班训 |
| `AboutSection.vue` | 班级简介 |
| `TeachersSection.vue` | 师者风采 |
| `GallerySection.vue` | 班级风采相册 |
| `MembersSection.vue` | 班级成员 / 名字墙 |
| `HonorsSection.vue` | 荣誉墙 |
| `TimelineSection.vue` | 班级纪事 |
| `AboutSiteSection.vue` | 关于本站 |

在 `App.vue` 里把它们按顺序拼起来即可。这样做的好处是：改某一个区块不会影响其他部分，后期增删板块也非常方便。

### 3.3 本地开发与构建

启动本地开发服务器：

```bash
npm run dev
```

浏览器打开终端里提示的地址（一般是 `http://localhost:5173`）即可实时预览，改代码会自动热更新。

确认没问题后，构建生产版本：

```bash
npm run build
```

构建产物会输出到 `dist/` 目录。**部署时用的就是这个 `dist/`**，而不是源码目录。

### 3.4 部署到 Cloudflare Pages

有两种方式，任选其一。

**方式 A：Git 集成（推荐）**

1. 在 Cloudflare 控制台进入 **Workers & Pages -> Create -> Pages -> Connect to Git**；
2. 授权 GitHub，选择你的仓库；
3. 填写构建配置：
   - Framework preset：`Vue`（或 `None`）
   - Build command：`npm run build`
   - Build output directory：`dist`
4. 点击保存并部署。

之后每次 push 到指定分支，Cloudflare 都会自动重新构建部署。

**方式 B：GitHub Actions + Wrangler**

如果不想在 Cloudflare 后台点来点去，也可以在仓库里放一个 workflow，用 Wrangler 自动部署：

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: pages-deploy
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: 拉取代码
        uses: actions/checkout@v4

      - name: 安装 Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: 安装依赖
        run: npm ci

      - name: 构建
        run: npm run build

      - name: 部署到 Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=class-site --branch=main
```

其中 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 要配置到仓库的 **Settings -> Secrets and variables -> Actions** 里。

- `CLOUDFLARE_ACCOUNT_ID`：在 Cloudflare 控制台右下角或 Workers 概览页可以看到；
- `CLOUDFLARE_API_TOKEN`：在 **My Profile -> API Tokens -> Create Token** 创建，模板选 **Edit Cloudflare Workers** 或自定义带 `Cloudflare Pages: Edit` 权限的令牌。

> **安全提醒**：API Token 只能放在 GitHub Secrets 或 Cloudflare 环境变量里，绝对不要写进代码提交到仓库。

## 四、方案二：个人博客（Hexo + Butterfly）

博客和班级网站的思路完全一致，区别只是"构建产物"由不同的框架生成。博客推荐 **Hexo + Butterfly 主题**：Markdown 写作、静态输出、主题好看。

搭建 Hexo 博客的详细步骤可以看我之前那篇《如何从0用GitHub搭建自己的博客》，这里只强调**部署到 Cloudflare Pages** 的差异：

1. 构建命令是 `npx hexo generate`（简写 `npx hexo g`），而不是 `npm run build`；
2. 构建产物目录是 `public/`，而不是 `dist/`；
3. 如果主题是作为 npm 包安装的，构建前要先 `npm ci` 安装依赖。

对应的 Wrangler 部署命令：

```bash
npx hexo generate
npx wrangler pages deploy public --project-name=my-blog --branch=main
```

放到 GitHub Actions 里，和上面班级网站的 workflow 几乎一样，只需把构建命令和输出目录换掉。

## 五、绑定自定义域名与 DNS

用 `xxx.pages.dev` 的默认地址也能访问，但绑定自己的域名会更正式、更好记。

### 5.1 把域名托管到 Cloudflare

1. 登录 Cloudflare，点击 **Add a site**，输入你的域名；
2. 选择 Free 套餐；
3. Cloudflare 会给出两个名称服务器（Name Server）地址，形如 `xxx.ns.cloudflare.com`；
4. 到你的域名注册商后台，把域名的 DNS 服务器改成这两个地址；
5. 等待生效（通常几分钟到几小时）。

> **注意**：一定要等域名的 NS 真正指向 Cloudflare 之后，再在 Pages 里绑定自定义域，否则会一直提示验证失败。可以用 `nslookup -type=ns 你的域名` 来确认 NS 是否已经切换。

### 5.2 在 Pages 里绑定

1. 进入你的 Pages 项目 -> **Custom domains -> Set up a custom domain**；
2. 输入域名，例如 `banji.example.com`；
3. 如果域名已经托管在同一个 Cloudflare 账号下，Cloudflare 会自动添加一条 CNAME 记录并签发证书，直接点确认即可；
4. 稍等片刻，用浏览器访问你的域名验证。

如果是 `www` 子域或裸域，处理方式略有不同，Cloudflare 会自动给出对应的目标记录，按提示操作就行。

## 六、同一份源码，双平台部署

前面提到，Cloudflare Pages 和 GitHub Pages 可以同时用。好处是：

- 国内访问走 Cloudflare，速度更稳；
- GitHub Pages 作为备份，两个平台互不影响；
- 同一份源码，两个站点，内容自动保持一致。

做法是在 `.github/workflows/` 下放两个 workflow，一个部署 Cloudflare Pages（见 3.4），一个部署 GitHub Pages。它们都在 `push` 到 `main` 时触发。

需要注意一个关键点：**两个站点的域名不同**。Hexo 里站点域名写在 `_config.yml` 的 `url` 字段，如果共用一份配置，就会导致其中一个平台的链接指向另一个平台。

解决办法是用一份**覆盖配置**。例如新增 `_config.cloudflare.yml`：

```yaml
url: https://你的博客域名
```

Cloudflare 的构建命令改成同时加载两个配置：

```bash
npx hexo generate --config _config.yml,_config.cloudflare.yml
```

后面的配置会覆盖前面的同名字段，这样 GitHub Pages 用 `_config.yml` 里的 `url`，Cloudflare 用覆盖后的 `url`，两边互不干扰。

Vue 的班级网站没有这个问题，因为它的站点地址基本是纯静态跳转，不依赖 `url` 配置，直接两个平台部署同一份产物即可。

## 七、进阶玩法

静态站点搭好之后，如果还想加一点动态能力，Cloudflare Workers 是很好的补充。它和 Pages 在同一个账号里，可以在同一个域名下提供接口。

一些常见场景：

- **夜间自动关闭**：写一个 Worker，在指定时间段（比如 23:00 到次日 06:00）返回维护页面，其他时间正常放行。适合不希望半夜有人访问的班级站点；
- **访问统计**：用 Workers 或 Cloudflare 自带的 Web Analytics 统计访问量，不需要引入第三方统计脚本；
- **留言墙 / 表单**：前端提交到 Worker 接口，Worker 再把数据写入存储。不过要注意，Cloudflare 的 KV、D1 等存储需要单独创建并绑定，仅靠 Pages 权限是拿不到的；
- **图片压缩与防盗链**：结合 Cloudflare 的图片转换和规则功能。

### 7.1 缓存优化

静态站点的图片、JS、CSS 可以设置长缓存，配合文件名哈希实现"内容变则 URL 变"。在 Pages 项目根目录放一个 `_headers` 文件：

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

这样带哈希的静态资源会被长期缓存，二次访问几乎瞬间加载。

### 7.2 关于国内访问

Cloudflare 默认分配的 `pages.dev` 域名在国内可能不稳定。如果对国内访问有要求，可以：

1. 绑定自己的域名（自定义域的访问通常比 `pages.dev` 稳定一些）；
2. 使用 Cloudflare 的优选 IP 思路优化解析；
3. 同时保留 GitHub Pages 作为备用入口。

需要说明的是，任何方案都无法保证在所有网络环境下都稳定，双平台部署是性价比最高的兜底方式。

## 八、常见问题

**Q1：部署成功但页面 404？**
检查构建输出目录填对没有。Vue 是 `dist`，Hexo 是 `public`。填错目录会导致部署了一个空站点。

**Q2：改了代码但线上没更新？**
先看 GitHub Actions 或 Cloudflare 的构建日志有没有报错；再确认浏览器缓存，可以强刷或换无痕窗口。如果是自定义域，还要确认 DNS 已经指向 Cloudflare。

**Q3：自定义域一直验证失败？**
多半是域名的 NS 还没切到 Cloudflare。先在域名注册商处确认 NS 已修改，等待生效后再绑定。

**Q4：构建时提示找不到主题或依赖？**
Hexo 的主题如果通过 npm 安装，必须在构建前执行 `npm ci`。GitHub Actions 里要单独加一步安装依赖。

**Q5：能不能直接在本地打包后上传？**
可以，用 `npx wrangler pages deploy 产物目录` 手动上传。但推荐用 Git 集成或 Actions，这样每次改动都能自动部署，也保留了完整的部署记录。

## 九、小结

用 Cloudflare Pages 搭建班级文化网站和个人博客，本质上都是同一件事：**把一份源码构建成静态文件，交给 Cloudflare 托管，push 即上线**。区别只在于用什么框架生成这些文件：

- 班级网站用 Vue 3 + Vite，输出 `dist/`；
- 个人博客用 Hexo + Butterfly，输出 `public/`。

再配合自定义域名、双平台部署和少量 Workers 进阶能力，就能得到一个免费、稳定、好维护的站点。

如果你也想给自己的班级做一个这样的网站，不妨从最简单的 Vue 项目开始，先把首屏跑起来，再一块一块地往里加内容。做出来之后，你会发现在没有服务器的情况下，也能拥有一个像模像样的站点。
