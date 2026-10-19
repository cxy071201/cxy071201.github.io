# 云端后端部署步骤（Cloudflare Workers + D1 + R2）

> 这一整套放在 `workers/` 文件夹里。目标是：让所有访客的**帖子、评论、点赞、图片投稿共享同一份数据**。
> 你只需要注册一个 Cloudflare 账号 + 安装 Node.js，其余代码我都写好了。

## 0. 前置准备
1. 到 https://dash.cloudflare.com/sign-up 用邮箱注册（免费）。
2. 安装 **Node.js**（LTS 版）：到 https://nodejs.org 下载安装，一路下一步。
3. 打开"终端/命令提示符"，输入 `npm -v` 有版本号即成功。

## 1. 安装并登录 wrangler（Cloudflare 官方命令行）
```bash
npm install -g wrangler
wrangler login
```
`wrangler login` 会自动打开浏览器，选你的 Cloudflare 账号授权即可。

## 2. 创建 D1 数据库
```bash
cd C:\Users\36505\Desktop\江苏省奶龙中学\workers
wrangler d1 create nailong-db
```
命令完成后会输出一个 `database_id`（一串字符），**复制它**，然后打开
`workers\wrangler.toml`，把 `database_id = "PASTE_YOUR_D1_DATABASE_ID_HERE"` 里的占位文字替换成你复制的 id。

## 3. 创建 R2 存储桶（存图片）
```bash
wrangler r2 bucket create nailong-uploads
```

## 4. 初始化数据库表
```bash
wrangler d1 execute nailong-db --remote --file=./schema.sql
```
看到成功即可。

## 5. 本地先测试后端（可选）
```bash
wrangler dev
```
浏览器打开 `http://localhost:8787/api/posts` 应返回 JSON 列表。

## 6. 部署到线上
```bash
wrangler deploy
```
部署成功后，`wrangler` 会返回你的线上地址，例如
`https://nailong-school.<你的子域>.workers.dev`。

**这个地址就够了——它会同时托管整个网站前端 + 云端后端 API**（一个网址搞定，跟你电脑开不开机无关）。
同学直接打开这个网址就能访问网站，发帖/评论/点赞/投稿全部云端共享。

## 7. 让前端切到云端（最后一步，把网址填进配置）
前端已经写好云端开关，只要把线上地址填进 `js/config.js` 的 `apiBase` 即可：

```js
// js/config.js
window.NL_CONFIG = {
  apiBase: "https://nailong-school.<你的子域>.workers.dev",  // 改成你的真实地址
  idKey: "nl_uid",
};
```

改完后刷新网站即切换到云端模式（所有人看到同一份数据）。想切回本地预览，把 `apiBase` 改成 `""` 即可。

> 在本地可以先跑 `python workers/mock_server.py` 用模拟后端测试云端逻辑（数据存 workers/mock.db）。

---

## 更新网站内容后重新部署
```bash
wrangler deploy
```
静态文件和 API 会一起更新。

## 常见问题
- **`wrangler` 不是内部命令**：没装成功 Node/npm，重装 Node.js。
- **上传播放的图片不显示**：检查 R2 桶是否创建、文件名是否含非法字符。
- **想绑定自己的域名**：Cloudflare 里 Workers → 你的服务 → Settings → Domains/Routes，可绑定域名。
