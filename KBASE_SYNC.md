# 私有知识库同步说明

这个博客保持纯静态，不会在前端保存 GitHub token。

## 推荐方式：读取本地备份

你的本地知识库默认路径是：

```powershell
D:\Answer\QianYan-KBase
```

因此在这台电脑上直接运行：

```powershell
npm run sync:kbase:local
```

脚本会自动读取本地 Markdown / MDX 文件，生成：

- `assets/data/articles.json`
- `posts/kbase/*.html`

默认只读取：

```text
QianYan-KBase/public
```

其中：

- `public/my_local` 会显示为“本地记录”
- `public/my_server` 会显示为“服务器记录”
- `private` 目录不会被同步到博客

如果本地备份换了位置，可以临时指定：

```powershell
$env:KBASE_LOCAL_PATH="D:\Answer\QianYan-KBase"
npm run sync:kbase:local
```

如果公开目录名变了，可以指定：

```powershell
$env:KBASE_PUBLIC_DIR="public"
npm run sync:kbase:local
```

## 可选方式：从 GitHub 私库读取

1. 创建一个只读权限的 GitHub fine-grained token。
2. 只授权 `QianYan-Art/QianYan-KBase` 这个仓库。
3. 权限选择 `Contents: Read-only`。
4. 在本地或部署平台环境变量中设置：

```powershell
$env:GITHUB_TOKEN="你的 token"
```

5. 执行同步：

```powershell
$env:KBASE_SOURCE="github"
$env:KBASE_PUBLIC_DIR="public"
npm run sync:kbase
```

## 线上自动刷新

如果博客部署到服务器，线上页面不会读取你电脑里的本地文件。要刷新文章，需要让服务器在站点工作目录内执行同步脚本。

本站目前使用服务器脚本：

```text
/usr/local/bin/blog-sync-kbase.sh
```

这个脚本会在服务器本地读取 GitHub 私库或本地缓存，生成：

```text
assets/data/articles.json
posts/kbase/*.html
```

线上脚本优先建立 SSH SOCKS 隧道访问 GitHub；`scripts/sync-kbase.js` 会通过 `socks-proxy-agent` 显式使用 `ALL_PROXY` / `HTTPS_PROXY`，不能只依赖 Node 原生 `https.request` 自动读取代理环境变量。代理分支和直连回退分支默认都给 `600s` 超时，单个 GitHub API 请求默认 `45000ms` 超时，并保留 stderr 方便排查。

SSH 隧道建立失败、代理同步失败或超时，都会先清理代理环境变量与隧道，再尝试服务器直连；缺少代理密钥时也走直连。直连仍失败时保留非零退出码，不输出同步完成。同步成功后的文章数量安全阈值检查和异常回滚保持生效，退出时清理临时目录与隧道。

仓库中的源文件是 `ops/blog-sync-kbase.sh`。发布此脚本时，除更新站点目录里的源码，还必须更新 `/usr/local/bin/blog-sync-kbase.sh` 实际执行入口并核对内容一致；仅更新仓库副本不会改变 cron 的行为。保留现有入口权限、环境配置与调度时间，不把服务器凭据提交到仓库。

### 发布后保留 Hermes 同步权限

服务器通过 `blogsync` 共享组允许普通 `hermes` 用户同步，不能只验证 root 执行成功。Hermes 的全 sudo 权限不是这条非提权同步链路的前提，不应为修复博客目录而改动其用户、sudo、skill 或服务配置。

- 博客根目录、`assets`、`assets/data`、`posts`、`scripts`、`node_modules` 保持 `root:blogsync 2775`。目录的 setgid 位让新建目录和文件继承共享组。
- 生成目录 `posts/kbase` 与 `.tmp` 及其子目录保持 `blogsync` 组、`2775`；文章 HTML 和 `assets/data/articles.json` 保持 `blogsync` 组、`664`。产物所有者可为本次执行者 root 或 hermes，不必强制改回 root。
- `scripts/sync-kbase.js` 保持 `root:blogsync 664`；实际入口保持 `root:blogsync 750`，环境文件保持 `root:blogsync 640`，代理密钥保持 `hermes:blogsync 600`。不要把生成物的组写策略递归套到凭据、整站或依赖内部。
- 同步入口的 `umask 002` 与父目录 setgid 共同保证新产物权限。同步程序会在 `.tmp/kbase-sync` 生成数据，删除旧目标后移动到 `posts/kbase` 和 `assets/data/articles.json`，因此需要根目录、暂存目录和目标父目录的写入及执行权限。

发布时不能直接用 `cp -a` 将 Git 解包目录覆盖站点后就结束验收：归档的所有权和目录模式可能覆盖服务器共享组与 setgid。复制流程应保留目标权限；无论采用哪种发布方式，都要在发布后核对上述目录及实际入口，而不是只比较源码哈希。修复既有权限前应确认实际路径、软链接与并发同步状态，仅处理明确的共享目录及生成物。

部署后通过 `sudo -u hermes -H /usr/local/bin/blog-sync-kbase.sh` 验收。这里 sudo 仅由管理员切换为普通 hermes，脚本并未提权为 root。检查退出码、文章数量、索引 `updatedAt`、生成物的共享组与组写位，并确认现有 cron、Hermes 服务、配置、skill 和开发文档未变。成功同步后可删除空的 `.tmp`；下次由具有 setgid 的博客根目录重新创建。

### 同步故障回归

`npm test` 包含 `node scripts/test-sync-fallback.js`。测试在独立临时目录执行真实脚本的控制流，仅替换固定文件位置，并使用 SSH、同步与进程清理命令的替身，不连接服务器或 GitHub、不读取真实凭据。

覆盖代理成功、隧道失败、代理同步失败或超时、缺少密钥、直连失败、文章数量异常回滚，以及直连前清理代理和退出后清理临时目录。Windows 需要 Git for Windows 的 Bash；Linux 需要 Bash 与 Node.js。隔离测试通过不等于生产网络已验收，部署后仍需运行实际同步入口并检查最新文章索引。

文章索引与生成的 HTML 是部署工作目录里的运行产物，不是博客仓库源码。它们已经被 `.gitignore` 排除，不能提交到公开博客仓库。

不要恢复会自动提交文章产物的 GitHub Actions 工作流，尤其是这类行为：

1. 从 `QianYan-KBase` 拉取文章。
2. 生成 `assets/data/articles.json` 或 `posts/kbase/*.html`。
3. 使用 bot 或 GitHub token 把这些文件 commit/push 回 blog 仓库。

这种流程会让别人 clone blog 仓库时直接拿到文章索引和正文。正确做法是：blog 仓库只保留前端代码、同步脚本和占位说明；文章生成物只存在于本机预览目录或服务器部署目录。

## 服务器环境变量

如果后续改成在服务器上同步，服务器里只需要设置环境变量，不要把 token 写进项目文件：

```powershell
GITHUB_TOKEN=新的只读 token
KBASE_SOURCE=github
KBASE_OWNER=QianYan-Art
KBASE_REPO=QianYan-KBase
KBASE_BRANCH=main
KBASE_PUBLIC_DIR=public
KBASE_PROXY_TIMEOUT=600s
KBASE_DIRECT_TIMEOUT=600s
KBASE_REQUEST_TIMEOUT_MS=45000
```

注意：聊天里或代码里出现过的 token 都应视为已泄露，建议立刻撤销后重新生成。

同步脚本会读取私库中的 Markdown / MDX 文件，生成：

- `assets/data/articles.json`
- `posts/kbase/*.html`

公开站点会发布这些静态产物，但公开 Git 仓库不发布它们。需要注意：只要文章内容被生成到公开站点，访客就能看到文章正文；这和“不要把文章产物提交到 blog 仓库”是两个不同边界。

## 可选环境变量

```powershell
$env:KBASE_OWNER="QianYan-Art"
$env:KBASE_REPO="QianYan-KBase"
$env:KBASE_BRANCH="main"
```
