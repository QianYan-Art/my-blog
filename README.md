# shiqianyan.cn 静态博客

一个仿 `RyuChan` 视觉风格的轻量静态博客，特点是：

- 顶部大图轮播 + 波浪过渡
- 玻璃态卡片布局 + 侧栏个人信息
- 纯静态页面，无构建步骤
- 仅依赖 Node 运行

## 本地运行

```bash
npm run start
```

默认端口 `3000`，可通过环境变量或参数改端口：

```bash
PORT=8080 npm run start
# 或
npm run start -- --port=8080
```

## 目录说明

- `index.html`：首页
- `about.html`：关于页
- `posts/*.html`：文章详情页
- `assets/css/style.css`：样式
- `assets/js/*.js`：交互
- `server.js`：Node 静态服务

## 内容修改

1. 在 `index.html` 修改文章卡片列表。
2. 在 `posts/` 新增文章页面。
3. 图片放在 `assets/images/` 并替换引用路径。
