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

如果博客部署到服务器或 GitHub Pages，线上页面不会读取你电脑里的本地文件。要自动刷新，需要让部署环境自己同步私库。

本项目已经提供 GitHub Actions：

```text
.github/workflows/sync-kbase.yml
```

你需要在博客仓库的 `Settings -> Secrets and variables -> Actions -> New repository secret` 添加：

```text
KBASE_READ_TOKEN
```

这个 token 建议使用 fine-grained personal access token：

- 只授权 `QianYan-Art/QianYan-KBase`
- `Contents` 权限选择 `Read-only`
- 不要写进 HTML、JS、CSS，也不要提交到仓库

工作流会：

1. 每 6 小时运行一次，也可以手动运行。
2. 使用 `KBASE_READ_TOKEN` 读取私有知识库。
3. 只读取私库中的 `public` 目录。
4. 生成 `assets/data/articles.json` 和 `posts/kbase/*.html`。
5. 自动提交生成结果到博客仓库。

如果你的服务器是从博客仓库自动部署，那么这次提交会触发重新部署；如果服务器不是自动部署，则还需要在服务器上执行拉取/部署流程。

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

公开站点只发布这些静态产物，不会发布 token。需要注意：只要文章内容被生成到公开站点，访客就能看到文章正文；仓库本身仍然可以保持私有。

## 可选环境变量

```powershell
$env:KBASE_OWNER="QianYan-Art"
$env:KBASE_REPO="QianYan-KBase"
$env:KBASE_BRANCH="main"
```
