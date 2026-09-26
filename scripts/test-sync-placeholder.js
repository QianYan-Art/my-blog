// 回归测试：文章同步整体替换 posts/kbase 时保留受 Git 跟踪的占位说明 README.md。
// 在临时目录中运行同步脚本的副本，读取临时知识库，不触碰仓库内的真实文章与索引。
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "blog-sync-placeholder-"));

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function runSync(site, kbase) {
  const result = spawnSync(process.execPath, [path.join(site, "scripts", "sync-kbase.js")], {
    cwd: site,
    encoding: "utf8",
    env: {
      ...process.env,
      KBASE_SOURCE: "local",
      KBASE_LOCAL_PATH: kbase,
      KBASE_PUBLIC_DIR: "public",
      NODE_PATH: path.join(root, "node_modules")
    }
  });
  assert.strictEqual(result.status, 0, `同步失败：${result.stderr || result.stdout}`);
}

try {
  const site = path.join(scratch, "site");
  const kbase = path.join(scratch, "kbase");
  const placeholder = fs.readFileSync(path.join(root, "posts", "kbase", "README.md"));

  write(path.join(site, "scripts", "sync-kbase.js"), fs.readFileSync(path.join(root, "scripts", "sync-kbase.js"), "utf8"));
  fs.mkdirSync(path.join(site, "posts", "kbase"), { recursive: true });
  fs.writeFileSync(path.join(site, "posts", "kbase", "README.md"), placeholder);
  write(path.join(site, "posts", "kbase", "stale.html"), "<p>旧文章</p>");
  write(path.join(kbase, "public", "my_local", "a-测试", "2026-01-02_占位测试记录.md"),
    "# 占位测试记录\n\n## 0. 第一节\n\n正文内容，用于验证同步。\n\n## 1. 第二节\n\n```bash\necho ok\n```\n");

  runSync(site, kbase);
  const postsDir = path.join(site, "posts", "kbase");
  const files = fs.readdirSync(postsDir).sort();
  assert(files.includes("README.md"), "首次同步后占位说明被删除");
  assert(fs.readFileSync(path.join(postsDir, "README.md")).equals(placeholder), "占位说明内容被改变");
  assert(!files.includes("stale.html"), "旧文章未被替换");
  assert.strictEqual(files.filter((f) => f.endsWith(".html")).length, 1, "生成文章数量不正确");

  const index = JSON.parse(fs.readFileSync(path.join(site, "assets", "data", "articles.json"), "utf8"));
  assert.strictEqual(index.articles.length, 1, "索引文章数量不正确");
  assert(index.articles[0].wordCount > 0, "索引缺少字数");

  // 再次同步：占位说明仍保留且只有一份
  runSync(site, kbase);
  assert(fs.readFileSync(path.join(postsDir, "README.md")).equals(placeholder), "再次同步后占位说明丢失或改变");

  // 目录中原本没有占位说明时，同步不应凭空创建
  fs.rmSync(path.join(postsDir, "README.md"));
  runSync(site, kbase);
  assert(!fs.existsSync(path.join(postsDir, "README.md")), "不应凭空生成占位说明");

  console.log("文章同步保留占位说明测试通过。");
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
