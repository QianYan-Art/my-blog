# 千颜的博客

纸面风格的个人静态博客，用来展示首页、项目页、关于页，以及从 `QianYan-KBase/public` 同步生成的文章索引和文章详情页。

## 特性

- 纯静态输出，Nginx 可直接托管。
- 首页采用纸张纹理、线稿插图和克制动效。
- 文章页支持分类、搜索、渐进加载和静态详情页。
- 文章来源只读取知识库 `public` 目录，不发布 `private` 内容。
- GitHub 私库 token 只在同步阶段使用，不写入前端页面。
- 移动端顶部导航使用更紧凑的 GitHub 图标入口，桌面端保留文字入口。
- 服务端对畸形 URL 返回 `400`，避免请求异常导致进程退出。
- Markdown 链接只允许安全协议（`http/https/mailto` 与站内相对链接）。

## 本地运行

```powershell
npm run dev
```

默认服务端口由 `server.js` 控制，当前开发环境常用 `http://127.0.0.1:3333`。

## 代码检查

```powershell
npm run check
```

该命令会对仓库内 JS 文件执行语法检查。

## 同步文章

从本地知识库同步：

```powershell
npm run sync:kbase:local
```

从 GitHub 私库同步：

```powershell
$env:GITHUB_TOKEN="你的只读 token"
npm run sync:kbase
```

同步后会生成：

- `assets/data/articles.json`
- `posts/kbase/*.html`

## 目录结构

- `index.html`：首页
- `blog/index.html`：文章列表页
- `projects/index.html`：项目页
- `about/index.html`：关于页
- `assets/css/`：样式与响应式布局
- `assets/js/`：首页、插图和文章列表交互
- `scripts/sync-kbase.js`：知识库文章同步与静态页生成
- `ops/blog-sync-kbase.sh`：服务器定时同步脚本模板
- `posts/kbase/`：生成后的文章详情页

## 部署说明

线上站点目录为 `/www/wwwroot/blog`。部署时上传当前静态项目，随后在服务器执行文章同步脚本：

```bash
/usr/local/bin/blog-sync-kbase.sh
```

服务器同步脚本会读取 GitHub 私库的 `public` 目录，生成新的静态文章索引与详情页，并带有文章数量保护，避免异常同步把线上文章刷空。

当前线上自动刷新以服务器定时任务为主，执行入口是：

- `/usr/local/bin/blog-sync-kbase.sh`

同步策略为：

1. 优先通过境外腾讯云机器提供的临时 SOCKS 代理访问 GitHub。
2. 如果代理同步失败，再回退到服务器本机直连重试。
3. 如果代理 key 缺失，则直接走本机直连。

仓库中的 `.github/workflows/sync-kbase.yml` 现在只保留手动触发，用于排查或临时补同步，不再按固定周期运行。
