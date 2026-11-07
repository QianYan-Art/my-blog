const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "blog-article-assets-"));

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

try {
  const site = path.join(scratch, "site");
  const kbase = path.join(scratch, "kbase");
  write(path.join(site, "scripts", "sync-kbase.js"), fs.readFileSync(path.join(root, "scripts", "sync-kbase.js"), "utf8"));
  write(path.join(kbase, "public", "my_local", "2026-01-01_普通文章.md"), "# 普通文章\n\n只有正文。\n");
  write(path.join(kbase, "public", "my_local", "2026-01-02_代码文章.md"), "# 代码文章\n\n```bash\necho \"$HOME\"\n```\n");
  write(path.join(kbase, "public", "my_local", "2026-01-03_数学文章.md"), "# 数学文章\n\n行内公式 $x^2$。\n\n$$\ny=x^2\n$$\n");
  write(path.join(kbase, "public", "my_local", "2026-01-04_混合文章.md"), "# 混合文章\n\n公式 $x+y$。\n\n```js\nconsole.log(1);\n```\n");

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

  const index = JSON.parse(fs.readFileSync(path.join(site, "assets", "data", "articles.json"), "utf8"));
  const articles = new Map(index.articles.map((article) => [article.title, article]));
  function assets(title) {
    const article = articles.get(title);
    assert(article, `缺少文章：${title}`);
    const html = fs.readFileSync(path.join(site, article.href.replace(/^\//, "")), "utf8");
    return {
      html,
      math: html.includes("/assets/vendor/mathjax/"),
      highlight: html.includes("/assets/vendor/highlight/")
    };
  }

  const plain = assets("普通文章");
  assert(!plain.math && !plain.highlight, "普通文章不应加载 MathJax 或高亮库");
  const code = assets("代码文章");
  assert(!code.math && code.highlight, "代码文章应只加载高亮库，代码里的 $ 不应触发 MathJax");
  assert(code.html.includes("echo"), "代码正文丢失");
  const math = assets("数学文章");
  assert(math.math && !math.highlight, "数学文章应只加载 MathJax");
  assert(math.html.includes("x^2"), "公式源文本丢失");
  const mixed = assets("混合文章");
  assert(mixed.math && mixed.highlight, "混合文章应加载 MathJax 与高亮库");

  for (const article of index.articles) {
    const html = assets(article.title).html;
    assert(html.includes('<link rel="stylesheet" href="/assets/css/fonts.css?'), "文章未直接引用字体 CSS");
  }

  for (const file of ["index.html", "blog/index.html", "projects/index.html", "about/index.html", "404.html"]) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    assert(html.includes('<link rel="stylesheet" href="/assets/css/fonts.css?'), `${file} 未直接引用字体 CSS`);
  }
  assert(!fs.readFileSync(path.join(root, "assets", "css", "base.css"), "utf8").includes("@import"), "base.css 仍通过 @import 串行加载字体 CSS");

  console.log("文章按需加载与字体并行加载测试通过。");
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
