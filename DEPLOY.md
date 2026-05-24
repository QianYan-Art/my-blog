# 部署说明（`www.shiqianyan.cn`）

本文档对应当前实际方案：**Nginx 直接托管静态文件 + 定时同步私库文章**。

## 1. 站点目录

- 线上目录：`/www/wwwroot/blog`
- 站点域名：`www.shiqianyan.cn`
- Nginx root 指向：`/www/wwwroot/blog`

## 2. 首次部署

```bash
cd /www/wwwroot
git clone https://github.com/QianYan-Art/my-blog.git blog
cd blog
npm ci --omit=dev
```

说明：
- 站点本身是静态页面，不依赖 Node 常驻服务。
- Node 仅用于执行同步脚本 `scripts/sync-kbase.js`。

## 3. 私库同步环境变量

服务器需要准备：

- `/etc/blog-sync.env`（`GITHUB_TOKEN`、`KBASE_OWNER`、`KBASE_REPO`、`KBASE_BRANCH`、`KBASE_PUBLIC_DIR` 等）
- `/usr/local/bin/blog-sync-kbase.sh`（可参考仓库 `ops/blog-sync-kbase.sh`）

手动执行一次同步：

```bash
/usr/local/bin/blog-sync-kbase.sh
```

成功后会刷新：

- `assets/data/articles.json`
- `posts/kbase/*.html`

## 4. 更新发布

```bash
cd /www/wwwroot/blog
git fetch --all --prune
git reset --hard origin/main
npm ci --omit=dev
/usr/local/bin/blog-sync-kbase.sh
```

## 5. 定时同步（可选）

```bash
crontab -e
```

示例（每 15 分钟）：

```cron
*/15 * * * * /usr/local/bin/blog-sync-kbase.sh >> /var/log/blog-sync.log 2>&1
```

## 6. 故障排查

- 同步失败先看：`/var/log/blog-sync.log`
- 核查 token 权限：私库 `Contents: Read-only` + `Metadata: Read-only`
- 如果直连 GitHub 不稳，脚本会按配置走代理重试（见 `ops/blog-sync-kbase.sh`）
