# 千颜的博客

纸面风格的个人静态博客，用来展示首页、项目页、关于页，以及从 `QianYan-KBase/public` 同步生成的文章索引和文章详情页。

## 特性

- 纯静态输出，Nginx 可直接托管。
- 宣纸 + 朱砂版画风：纸张纹理、线稿插图、衬线大标题与克制动效。
- 全部资源自托管：思源宋体等字体分块 woff2、MathJax、highlight.js 均在仓库内，不依赖任何外部 CDN。
- 文章列表支持分类、搜索、渐进加载；摘要在句界收尾，不做硬截断。
- 文章详情页：目录侧栏（滚动高亮、移动端折叠）、代码高亮与一键复制、阅读进度条、返回顶部。
- 文章来源只读取知识库 `public` 目录，不发布 `private` 内容。
- GitHub 私库 token 只在同步阶段使用，不写入前端页面。
- 移动端顶部导航使用更紧凑的 GitHub 图标入口，桌面端保留文字入口。
- 服务端对畸形 URL 返回 `400`，避免请求异常导致进程退出。
- Markdown 链接只允许安全协议（`http/https/mailto` 与站内相对链接）。

## 本地运行

```powershell
npm run dev
```

默认端口 `3000`（`server.js` 控制），可用 `node server.js --port=3777` 或环境变量 `PORT` 覆盖。

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
- `assets/css/`：样式（`tokens.css` 设计变量；`fonts.css` 为脚本生成的自托管字体声明）
- `assets/js/`：交互脚本（`home.js` 首页与跨栏对齐、`articles.js` 列表、`post.js` 文章页目录/进度/复制、`plate.js` 插图视差）
- `assets/fonts/`：自托管字体 woff2（`scripts/build-fonts.js` 生成，按 unicode-range 分块按需加载）
- `assets/vendor/`：本地化的 MathJax 与 highlight.js
- `scripts/sync-kbase.js`：知识库文章同步与静态页生成（文章页模板内嵌于此）
- `scripts/bump-assets-version.js`：一键刷新全站 `?v=` 缓存版本号（含 vendor 引用）
- `scripts/build-fonts.js`：从 @fontsource 包重新生成 `assets/fonts` 与 `fonts.css`
- `ops/blog-sync-kbase.sh`：服务器定时同步脚本模板
- `posts/kbase/`：生成后的文章详情页
- `posts/*.html`：少量手写旧文（已统一为文章页模板样式）

## 缓存版本号

Nginx 对 CSS/JS 设有缓存，改动样式或脚本后必须刷新版本串，访客才能拿到新资源：

```powershell
npm run bump:assets -- 20260612   # 用新日期；同日多次发布加后缀 b/c
```

文章详情页的版本号由 `sync-kbase.js` 模板控制，bump 脚本会同步更新模板，重新同步后不会丢失。`fonts.css` 的版本号写在 `base.css` 的 `@import` 中，变动时需手动同步。

## 版本标记

- `v1.0-pre-redesign`：2026-06 美化改版前基线
- `v2.0-paper-redesign`：宣纸版画风改版（自托管字体、文章页目录/高亮/进度条等）

## 部署

站点是纯静态产物：把整个仓库目录（至少包含各 HTML 页面与 `assets/`、`posts/`）放到任意静态服务器（Nginx、Caddy 等）的站点根目录即可运行，无需 Node 常驻服务。

两点提示：

- `assets/fonts/` 与 `assets/vendor/` 是字体和公式/高亮的本地资源，部署时不要遗漏。
- 如需定时从知识库同步文章，可参考 `ops/blog-sync-kbase.sh` 在服务器上配置计划任务（需要 Node 环境与只读 token）。

更完整的部署与文章同步说明见 `DEPLOY.md`。
