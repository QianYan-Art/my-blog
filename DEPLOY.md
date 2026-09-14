# 部署说明

本项目是纯静态站点：部署的本质是把仓库内容放到静态服务器的站点根目录。本文以 Nginx 为例说明通用流程。

## 1. 站点托管

1. 把仓库目录上传到服务器的站点根目录（至少包含各 HTML 页面与 `assets/`、`posts/`）。
2. 将 Nginx（或 Caddy 等）的 `root` 指向该目录即可，无需 Node 常驻服务。

注意：

- `assets/fonts/`（自托管字体）与 `assets/vendor/`（MathJax / highlight.js）是站点必需资源，不要遗漏。
- 建议对 CSS/JS 配置缓存（如 `expires 1d`），配合项目的 `?v=` 版本串使用。

## 2. 更新发布

1. 本地改完并验证后，执行 `npm run bump:assets -- <新版本串>` 刷新缓存版本号（如 `20260612`，同日多次发布加后缀 `b`/`c`）。
2. 运行 `npm run check`，用浏览器检查桌面和手机尺寸下的文章、分页、搜索、项目链接与页脚。
3. 提交并推送到目标分支，核对本地提交与远程分支一致。用该提交的 `git archive` 制作发布包，不打包工作区、密钥、`.env`、`node_modules` 或本地生成的文章。
4. 服务器覆盖前备份站点，上传并解包已核对的发布包，保留服务器自己的环境配置与文章数据。不要对整个站点执行镜像删除。
5. 如有模板变化，运行服务器同步入口重新生成文章；随后执行 `nginx -t`、文件哈希比对与线上浏览器验收。没有修改 Nginx 配置时，无需为了静态页面更新而重启服务。

三端一致指本地提交、GitHub 提交以及服务器上该提交管理的文件一致，不要求把服务器的环境文件、日志和生成文章提交到 GitHub。保留本次发布的提交号、资源版本号与备份路径，便于回滚。

如果改动了文章页模板（`scripts/sync-kbase.js`），需要把该脚本一并上传，并重新执行一次文章同步，让所有文章详情页按新模板重新生成。

## 3. 文章同步（可选）

文章来自知识库仓库的 `public` 目录，由 `scripts/sync-kbase.js` 生成静态产物：

- `assets/data/articles.json`（列表索引）
- `posts/kbase/*.html`（文章详情页）

若希望服务器自动同步，需要 Node 环境，并：

1. 在站点目录执行 `npm ci --omit=dev` 安装同步依赖。
2. 准备环境变量（`GITHUB_TOKEN`、`KBASE_OWNER`、`KBASE_REPO`、`KBASE_BRANCH`、`KBASE_PUBLIC_DIR`）。token 只需私库 `Contents: Read-only` + `Metadata: Read-only` 权限。
3. 参考 `ops/blog-sync-kbase.sh` 编写同步入口脚本，并加入计划任务，例如每天凌晨执行：

```cron
0 4 * * * /path/to/blog-sync-kbase.sh >> /var/log/blog-sync.log 2>&1
```

同步产物由服务器自行生成后，日常更新发布时不要从本地整传 `assets/data/articles.json` 与 `posts/kbase/*.html`，避免用旧数据覆盖线上文章。文章页模板变更也应在服务器重新同步，而不是整传本地文章。

## 4. 故障排查

- 同步失败先看同步日志。
- 核查 token 权限是否满足上面第 3 节的最小权限。
- 同步脚本采用“先生成到临时目录、再整体替换”的策略，并带文章数量保护，异常同步不会把线上文章清空。
