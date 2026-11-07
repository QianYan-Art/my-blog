const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "blog-sync-slugs-"));

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function runSync(site, kbase, expectedStatus = 0) {
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
  assert.strictEqual(result.status, expectedStatus, `同步退出码不符合预期：${result.stderr || result.stdout}`);
  return result;
}

function readIndex(site) {
  return JSON.parse(fs.readFileSync(path.join(site, "assets", "data", "articles.json"), "utf8"));
}

function htmlFiles(site) {
  return fs.readdirSync(path.join(site, "posts", "kbase")).filter((file) => file.endsWith(".html"));
}

try {
  const site = path.join(scratch, "site");
  const kbase = path.join(scratch, "kbase");
  const postsDir = path.join(site, "posts", "kbase");
  const indexFile = path.join(site, "assets", "data", "articles.json");
  write(path.join(site, "scripts", "sync-kbase.js"), fs.readFileSync(path.join(root, "scripts", "sync-kbase.js"), "utf8"));

  const original = path.join(kbase, "public", "my_local", "a-测试", "2026-01-02_短链接测试.md");
  write(original, "# 短链接测试\n\n正文内容。\n");
  runSync(site, kbase);

  const first = readIndex(site).articles[0];
  assert.match(first.id, /^2026-01-02-[0-9a-f]{12}$/, "默认地址应使用日期和短哈希");
  assert.strictEqual(first.href, `/posts/kbase/${first.id}.html`);
  assert(/^[\x00-\x7F]+$/.test(first.href), "默认文章地址不应包含中文或百分号编码");
  assert.strictEqual(first.title, "短链接测试", "短链接不应改变文章标题");
  assert(fs.existsSync(path.join(postsDir, `${first.id}.html`)), "短链接文章 HTML 未生成");

  const archived = path.join(kbase, "public", "my_local", "b-新目录", "archived", path.basename(original));
  fs.mkdirSync(path.dirname(archived), { recursive: true });
  fs.renameSync(original, archived);
  runSync(site, kbase);
  const moved = readIndex(site).articles[0];
  assert.strictEqual(moved.href, first.href, "移动目录或归档不应改变默认地址");
  assert.strictEqual(moved.sourcePath, "my_local/b-新目录/archived/2026-01-02_短链接测试.md");
  assert.deepStrictEqual(htmlFiles(site), [`${first.id}.html`]);

  const renamed = path.join(path.dirname(archived), "2026-01-03_改名后的记录.md");
  fs.renameSync(archived, renamed);
  runSync(site, kbase);
  const renamedArticle = readIndex(site).articles[0];
  assert.notStrictEqual(renamedArticle.href, first.href, "改文件名应生成新地址");
  assert(!fs.existsSync(path.join(postsDir, `${first.id}.html`)), "改名后的旧 HTML 应被删除");
  assert(fs.existsSync(path.join(postsDir, `${renamedArticle.id}.html`)), "改名后的新 HTML 未生成");

  const duplicate = path.join(kbase, "public", "my_server", "d-测试", path.basename(renamed));
  write(duplicate, "# 同名文章\n\n另一篇同名文章。\n");
  const indexBeforeConflict = fs.readFileSync(indexFile, "utf8");
  const conflict = runSync(site, kbase, 1);
  assert.match(conflict.stderr, /文章地址冲突/, "同名冲突应给出明确错误");
  assert.match(conflict.stderr, /显式设置不同的 slug/, "同名冲突应提示处理方式");
  assert.strictEqual(fs.readFileSync(indexFile, "utf8"), indexBeforeConflict, "同名冲突不应替换现有索引");
  assert.deepStrictEqual(htmlFiles(site), [`${renamedArticle.id}.html`], "同名冲突不应改动现有文章");
  fs.rmSync(duplicate);

  const privateFile = path.join(kbase, "private", path.basename(renamed));
  fs.mkdirSync(path.dirname(privateFile), { recursive: true });
  fs.renameSync(renamed, privateFile);
  runSync(site, kbase);
  assert.strictEqual(readIndex(site).articles.length, 0, "移到 private 的文章应下线");
  assert.deepStrictEqual(htmlFiles(site), [], "移到 private 后旧 HTML 应被删除");

  const explicit = path.join(kbase, "public", "my_local", "a-测试", "2026-02-03_显式地址.md");
  write(explicit, "---\nslug: custom-note\n---\n# 显式地址\n\n正文内容。\n");
  runSync(site, kbase);
  const explicitArticle = readIndex(site).articles[0];
  assert.strictEqual(explicitArticle.href, "/posts/kbase/custom-note.html");
  const renamedExplicit = path.join(path.dirname(explicit), "2026-02-04_显式地址改名.md");
  fs.renameSync(explicit, renamedExplicit);
  runSync(site, kbase);
  assert.strictEqual(readIndex(site).articles[0].href, explicitArticle.href, "显式 slug 应在改名后保持固定地址");

  const undated = path.join(kbase, "public", "my_local", "a-测试", "长期规范.md");
  write(undated, "# 长期规范\n\n正文内容。\n");
  runSync(site, kbase);
  const undatedArticle = readIndex(site).articles.find((article) => article.title === "长期规范");
  assert.match(undatedArticle.id, /^note-[0-9a-f]{12}$/, "无日期文件应使用 note 前缀");

  console.log("文章短链接、目录移动、归档、改名、冲突与下线测试通过。");
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
