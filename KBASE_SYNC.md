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

这些是部署工作目录里的运行产物，不是博客仓库源码。它们已经被 `.gitignore` 排除，不能提交到公开博客仓库。

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
